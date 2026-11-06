"""Implementações da porta `FileStorage`: S3 (produção) e disco local (dev/testes)."""

import re
from pathlib import Path
from typing import Any

from app.application.ports import PresignedUpload, StoredObject

_MISSING_CODES = {"404", "NoSuchKey", "NotFound"}
_SAFE_KEY = re.compile(r"[A-Za-z0-9_\-]+(/[A-Za-z0-9_\-]+)*(\.[A-Za-z0-9]+)?", re.ASCII)


class S3FileStorage:
    """Bucket privado. Upload via POST pré-assinado, que (diferente do PUT) permite impor no
    próprio S3 o limite de tamanho (`content-length-range`) e o `Content-Type`.

    As credenciais vêm exclusivamente da cadeia padrão do boto3 (role da instância EC2);
    nada é lido de `Settings` nem do código.
    """

    def __init__(self, bucket: str, region: str, client: Any | None = None) -> None:
        if not bucket:
            raise ValueError("S3_BUCKET é obrigatório para o armazenamento S3")
        self._bucket = bucket
        self._region = region
        self._client = client

    @property
    def client(self) -> Any:
        if self._client is None:
            import boto3  # import tardio: só é necessário quando o backend S3 é usado

            self._client = boto3.client("s3", region_name=self._region)
        return self._client

    def presign_upload(
        self, key: str, content_type: str, max_bytes: int, expires_in: int = 900
    ) -> PresignedUpload:
        post = self.client.generate_presigned_post(
            Bucket=self._bucket,
            Key=key,
            Fields={"Content-Type": content_type},
            Conditions=[
                {"Content-Type": content_type},
                ["content-length-range", 1, max_bytes],
            ],
            ExpiresIn=expires_in,
        )
        return PresignedUpload(url=post["url"], method="POST", fields=dict(post["fields"]))

    def presign_download(self, key: str, expires_in: int = 900) -> str:
        return self.client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self._bucket, "Key": key},
            ExpiresIn=expires_in,
        )

    def _head(self, key: str) -> dict | None:
        try:
            return self.client.head_object(Bucket=self._bucket, Key=key)
        except Exception as exc:  # botocore.exceptions.ClientError (sem importar botocore)
            code = str(getattr(exc, "response", {}).get("Error", {}).get("Code", ""))
            if code in _MISSING_CODES:
                return None
            raise

    def exists(self, key: str) -> bool:
        return self._head(key) is not None

    def stat(self, key: str) -> StoredObject | None:
        head = self._head(key)
        if head is None:
            return None
        return StoredObject(
            size_bytes=int(head["ContentLength"]), content_type=head.get("ContentType")
        )

    def delete(self, key: str) -> None:
        self.client.delete_object(Bucket=self._bucket, Key=key)


class LocalFileStorage:
    """Somente desenvolvimento/testes: grava em disco (`backend/.storage/`, ignorado pelo git).

    Não há endpoint de upload: `presign_upload` devolve uma URL fictícia (`local://`) e os
    arquivos entram via `put()` (usado nos testes). Assim não existe superfície HTTP extra.
    """

    _TYPES = {"jpg": "image/jpeg", "png": "image/png", "webp": "image/webp"}

    def __init__(self, root: Path) -> None:
        self._root = Path(root).resolve()

    def _path(self, key: str) -> Path:
        if not _SAFE_KEY.fullmatch(key):
            raise ValueError("Chave de armazenamento inválida")
        path = (self._root / key).resolve()
        if not path.is_relative_to(self._root):
            raise ValueError("Chave de armazenamento inválida")
        return path

    def put(self, key: str, data: bytes) -> None:
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)

    def presign_upload(
        self, key: str, content_type: str, max_bytes: int, expires_in: int = 900
    ) -> PresignedUpload:
        self._path(key)
        return PresignedUpload(
            url=f"local://upload/{key}",
            method="PUT",
            headers={"Content-Type": content_type},
        )

    def presign_download(self, key: str, expires_in: int = 900) -> str:
        self._path(key)
        return f"local://download/{key}?expires_in={expires_in}"

    def exists(self, key: str) -> bool:
        return self._path(key).is_file()

    def stat(self, key: str) -> StoredObject | None:
        path = self._path(key)
        if not path.is_file():
            return None
        return StoredObject(
            size_bytes=path.stat().st_size,
            content_type=self._TYPES.get(path.suffix.lstrip(".").lower()),
        )

    def delete(self, key: str) -> None:
        self._path(key).unlink(missing_ok=True)
