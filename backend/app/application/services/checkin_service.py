import uuid
from collections.abc import Callable
from datetime import UTC, datetime, timedelta

from app.application.dtos.checkin import (
    CheckinCreate,
    CheckinOut,
    CheckinSummaryOut,
    ChecklistEntryOut,
    PhotoOut,
    PhotoPresignIn,
    PhotoPresignOut,
    PresignedUploadOut,
)
from app.application.dtos.common import Page
from app.application.ports import FileStorage, UnitOfWork
from app.application.services.km_service import KmService
from app.domain.checkin import (
    MAX_PHOTO_BYTES,
    MAX_PHOTOS_PER_CHECKIN,
    PHOTO_URL_EXPIRES_SECONDS,
    Checkin,
    CheckinPhoto,
    CheckinPhotoRepository,
    CheckinRepository,
    ChecklistEntry,
    photo_storage_key,
    validate_checklist,
    validate_photo,
)
from app.domain.errors import BusinessRuleError, NotFoundError
from app.domain.km import KmSource
from app.domain.user import User
from app.domain.vehicle import VehicleRepository

_PHOTO_LIMIT = f"Limite de {MAX_PHOTOS_PER_CHECKIN} fotos por check-in atingido"


def _utcnow() -> datetime:
    """UTC ingênuo (as colunas DateTime do projeto são ingênuas)."""
    return datetime.now(UTC).replace(tzinfo=None)


class CheckinService:
    """Check-in + fotos. A criação registra a quilometragem (`KmService.record`) na MESMA
    transação: qualquer falha desfaz tudo (check-in, checklist e leitura de km)."""

    def __init__(
        self,
        checkins: CheckinRepository,
        photos: CheckinPhotoRepository,
        vehicles: VehicleRepository,
        km_service: KmService,
        storage: FileStorage,
        uow: UnitOfWork,
        now: Callable[[], datetime] = _utcnow,
    ) -> None:
        self._checkins = checkins
        self._photos = photos
        self._vehicles = vehicles
        self._km = km_service
        self._storage = storage
        self._uow = uow
        self._now = now

    # ---- check-in -------------------------------------------------------------------------

    def create(self, data: CheckinCreate, actor: User) -> CheckinOut:
        validate_checklist(e.item for e in data.checklist)
        try:
            if self._vehicles.get_by_id(data.vehicle_id) is None:
                raise NotFoundError("Veículo não encontrado")
            self._km.record(data.vehicle_id, data.km, KmSource.CHECKIN, None, False, actor)
            saved = self._checkins.add(
                Checkin(
                    id=None,
                    vehicle_id=data.vehicle_id,
                    user_id=actor.id,
                    km=data.km,
                    fuel_level=data.fuel_level,
                    damages=data.damages,
                    accessories=data.accessories,
                    notes=data.notes,
                    created_by_id=actor.id,
                    checklist=[ChecklistEntry(e.item, e.condition, e.note) for e in data.checklist],
                )
            )
            self._uow.commit()
        except BaseException:
            self._uow.rollback()
            raise
        return self._detail(saved)

    def get(self, checkin_id: int) -> CheckinOut:
        return self._detail(self._checkin_or_404(checkin_id))

    def list(
        self, *, page: int, size: int, vehicle_id: int | None
    ) -> Page[CheckinSummaryOut]:
        rows, total = self._checkins.list_page(
            offset=(page - 1) * size, limit=size, vehicle_id=vehicle_id
        )
        return Page[CheckinSummaryOut](
            items=[CheckinSummaryOut.from_entity(c) for c in rows],
            total=total,
            page=page,
            size=size,
        )

    # ---- fotos ----------------------------------------------------------------------------

    def presign_photo(self, checkin_id: int, data: PhotoPresignIn) -> PhotoPresignOut:
        validate_photo(data.content_type, data.size_bytes)
        try:
            return self._presign_locked(checkin_id, data)
        except BaseException:
            self._uow.rollback()
            raise

    def _presign_locked(self, checkin_id: int, data: PhotoPresignIn) -> PhotoPresignOut:
        # Trava o check-in ANTES de contar: presigns concorrentes serializam (efetivo no MySQL).
        self._checkin_or_404(checkin_id, lock=True)
        now = self._now()
        pending_since = now - timedelta(seconds=PHOTO_URL_EXPIRES_SECONDS)
        if self._photos.count_active(checkin_id, pending_since=pending_since) >= (
            MAX_PHOTOS_PER_CHECKIN
        ):
            raise BusinessRuleError(_PHOTO_LIMIT)
        key = photo_storage_key(checkin_id, str(uuid.uuid4()), data.content_type)
        upload = self._storage.presign_upload(
            key, data.content_type, MAX_PHOTO_BYTES, PHOTO_URL_EXPIRES_SECONDS
        )
        try:
            photo = self._photos.add(
                CheckinPhoto(
                    id=None,
                    checkin_id=checkin_id,
                    storage_key=key,
                    content_type=data.content_type,
                    size_bytes=data.size_bytes,
                    created_at=now,
                )
            )
            self._uow.commit()
        except BaseException:
            self._uow.rollback()
            raise
        return PhotoPresignOut(
            photo_id=photo.id,
            upload=PresignedUploadOut(
                url=upload.url,
                method=upload.method,
                fields=upload.fields,
                headers=upload.headers,
            ),
            expires_in=PHOTO_URL_EXPIRES_SECONDS,
        )

    def confirm_photo(self, checkin_id: int, photo_id: int) -> PhotoOut:
        try:
            self._checkin_or_404(checkin_id, lock=True)  # antes de contar (ver presign)
            photo = self._photo_or_404(checkin_id, photo_id)
            if photo.confirmed:
                self._uow.rollback()  # libera a trava
                return self._photo_out(photo)
            stored = self._storage.stat(photo.storage_key)
            if stored is None:
                raise BusinessRuleError("O arquivo ainda não foi enviado ao armazenamento")
            if stored.size_bytes > MAX_PHOTO_BYTES or (
                stored.content_type is not None and stored.content_type != photo.content_type
            ):
                # Upload fora do combinado: descarta o objeto e a reserva.
                self._storage.delete(photo.storage_key)
                self._photos.delete(photo.id)
                self._uow.commit()
                raise BusinessRuleError("O arquivo enviado não atende tipo/tamanho permitidos")
            if self._photos.count_confirmed(checkin_id) >= MAX_PHOTOS_PER_CHECKIN:
                raise BusinessRuleError(_PHOTO_LIMIT)
            now = self._now()
            if not self._photos.mark_confirmed(photo.id, size_bytes=stored.size_bytes, at=now):
                raise NotFoundError("Foto não encontrada")
            self._uow.commit()
        except BaseException:
            self._uow.rollback()
            raise
        photo.size_bytes = stored.size_bytes
        photo.confirmed_at = now
        return self._photo_out(photo)

    def delete_photo(self, checkin_id: int, photo_id: int) -> None:
        self._checkin_or_404(checkin_id)
        photo = self._photo_or_404(checkin_id, photo_id)
        try:
            self._photos.delete(photo.id)
            self._storage.delete(photo.storage_key)  # idempotente; falha => linha preservada
            self._uow.commit()
        except BaseException:
            self._uow.rollback()
            raise

    # ---- helpers --------------------------------------------------------------------------

    def _checkin_or_404(self, checkin_id: int, *, lock: bool = False) -> Checkin:
        checkin = (
            self._checkins.get_for_update(checkin_id)
            if lock
            else self._checkins.get_by_id(checkin_id)
        )
        if checkin is None:
            raise NotFoundError("Check-in não encontrado")
        return checkin

    def _photo_or_404(self, checkin_id: int, photo_id: int) -> CheckinPhoto:
        photo = self._photos.get(checkin_id, photo_id)
        if photo is None:
            raise NotFoundError("Foto não encontrada")
        return photo

    def _photo_out(self, photo: CheckinPhoto) -> PhotoOut:
        url = (
            self._storage.presign_download(photo.storage_key, PHOTO_URL_EXPIRES_SECONDS)
            if photo.confirmed
            else None
        )
        return PhotoOut(
            id=photo.id,
            content_type=photo.content_type,
            size_bytes=photo.size_bytes,
            status="confirmed" if photo.confirmed else "pending",
            created_at=photo.created_at,
            confirmed_at=photo.confirmed_at,
            download_url=url,
        )

    def _detail(self, checkin: Checkin) -> CheckinOut:
        stale_before = self._now() - timedelta(seconds=PHOTO_URL_EXPIRES_SECONDS)
        # Reservas pendentes vencidas (upload nunca confirmado) não são exibidas.
        visible = [
            p
            for p in checkin.photos
            if p.confirmed or (p.created_at is not None and p.created_at >= stale_before)
        ]
        return CheckinOut(
            **CheckinSummaryOut.from_entity(checkin).model_dump(),
            download_expires_in=PHOTO_URL_EXPIRES_SECONDS,
            checklist=[
                ChecklistEntryOut(item=e.item, condition=e.condition, note=e.note)
                for e in checkin.checklist
            ],
            photos=[self._photo_out(p) for p in visible],
        )
