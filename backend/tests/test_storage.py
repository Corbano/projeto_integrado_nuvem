import pytest
from botocore.exceptions import (
    ClientError,
    ConnectTimeoutError,
    EndpointConnectionError,
    NoCredentialsError,
    ReadTimeoutError,
)

from app.domain.errors import StorageUnavailableError
from app.infrastructure.storage import UNAVAILABLE_MESSAGE, LocalFileStorage, S3FileStorage


def client_error(code: str, op: str = "HeadObject") -> ClientError:
    return ClientError({"Error": {"Code": code, "Message": "secreto-bucket/chave"}}, op)


class FakeS3Client:
    def __init__(self) -> None:
        self.calls: list[tuple[str, dict]] = []
        self.objects: dict[str, dict] = {}

    def generate_presigned_post(self, **kwargs):
        self.calls.append(("post", kwargs))
        fields = {**kwargs["Fields"], "key": kwargs["Key"]}
        return {"url": "https://bucket.s3.example/", "fields": fields}

    def generate_presigned_url(self, op, **kwargs):
        self.calls.append((op, kwargs))
        return "https://signed.example/get"

    def head_object(self, Bucket, Key):  # noqa: N803
        self.calls.append(("head", {"Bucket": Bucket, "Key": Key}))
        if Key not in self.objects:
            raise client_error("404")
        return self.objects[Key]

    def delete_object(self, Bucket, Key):  # noqa: N803
        self.calls.append(("delete", {"Bucket": Bucket, "Key": Key}))
        self.objects.pop(Key, None)


def test_s3_presign_upload_enforces_type_size_bucket_and_expiry():
    client = FakeS3Client()
    storage = S3FileStorage("bucket-ficticio", "sa-east-1", client=client)

    upload = storage.presign_upload("checkins/1/a.png", "image/png", 1000, expires_in=900)

    op, kwargs = client.calls[0]
    assert op == "post"
    assert kwargs["Bucket"] == "bucket-ficticio"
    assert kwargs["Key"] == "checkins/1/a.png"
    assert kwargs["ExpiresIn"] == 900
    assert {"Content-Type": "image/png"} in kwargs["Conditions"]
    assert ["content-length-range", 1, 1000] in kwargs["Conditions"]
    assert upload.method == "POST"
    assert upload.url == "https://bucket.s3.example/"
    assert upload.fields["Content-Type"] == "image/png"


def test_s3_presign_download_uses_get_object_and_expiry():
    client = FakeS3Client()
    storage = S3FileStorage("bucket-ficticio", "sa-east-1", client=client)

    url = storage.presign_download("checkins/1/a.png", expires_in=900)

    op, kwargs = client.calls[0]
    assert url == "https://signed.example/get"
    assert op == "get_object"
    assert kwargs["Params"] == {"Bucket": "bucket-ficticio", "Key": "checkins/1/a.png"}
    assert kwargs["ExpiresIn"] == 900


def test_s3_exists_stat_and_delete():
    client = FakeS3Client()
    client.objects["k.png"] = {"ContentLength": 42, "ContentType": "image/png"}
    storage = S3FileStorage("b", "sa-east-1", client=client)

    assert storage.exists("k.png") is True
    assert storage.exists("outro.png") is False
    stat = storage.stat("k.png")
    assert stat is not None and stat.size_bytes == 42 and stat.content_type == "image/png"
    assert storage.stat("outro.png") is None
    storage.delete("k.png")
    assert storage.exists("k.png") is False
    assert ("delete", {"Bucket": "b", "Key": "k.png"}) in client.calls


ERRORS = [
    client_error("500"),
    client_error("AccessDenied"),
    EndpointConnectionError(endpoint_url="https://s3.example/segredo"),
    ConnectTimeoutError(endpoint_url="https://s3.example/segredo"),
    ReadTimeoutError(endpoint_url="https://s3.example/segredo"),
    NoCredentialsError(),
]
OPERATIONS = [
    lambda st: st.presign_upload("checkins/1/a.png", "image/png", 10),
    lambda st: st.presign_download("checkins/1/a.png"),
    lambda st: st.exists("checkins/1/a.png"),
    lambda st: st.stat("checkins/1/a.png"),
    lambda st: st.delete("checkins/1/a.png"),
]


class RaisingClient:
    def __init__(self, exc: Exception) -> None:
        self._exc = exc

    def _raise(self, *args, **kwargs):
        raise self._exc

    generate_presigned_post = generate_presigned_url = head_object = delete_object = _raise


@pytest.mark.parametrize("exc", ERRORS, ids=lambda e: type(e).__name__)
@pytest.mark.parametrize("operation", OPERATIONS)
def test_s3_failures_become_storage_unavailable(exc, operation, caplog):
    storage = S3FileStorage("bucket-ficticio", "sa-east-1", client=RaisingClient(exc))

    with caplog.at_level("ERROR", logger="autocenter.storage"):
        with pytest.raises(StorageUnavailableError) as info:
            operation(storage)

    assert info.value.message == UNAVAILABLE_MESSAGE
    assert "bucket" not in info.value.message and "checkins" not in info.value.message
    assert caplog.records and type(exc).__name__ in caplog.text
    assert "segredo" not in caplog.text and "checkins/1" not in caplog.text


def test_s3_403_on_head_logs_listbucket_hint(caplog):
    storage = S3FileStorage("b", "r", client=RaisingClient(client_error("403")))

    with caplog.at_level("ERROR", logger="autocenter.storage"):
        with pytest.raises(StorageUnavailableError):
            storage.exists("k.png")

    assert "s3:ListBucket" in caplog.text


@pytest.mark.parametrize("code", ["404", "NoSuchKey", "NotFound"])
def test_s3_missing_key_codes_mean_not_exists(code):
    storage = S3FileStorage("b", "r", client=RaisingClient(client_error(code)))

    assert storage.exists("k.png") is False
    assert storage.stat("k.png") is None


def test_s3_client_is_created_with_timeouts_and_retries(monkeypatch):
    import boto3

    captured = {}
    monkeypatch.setattr(boto3, "client", lambda *a, **kw: captured.update(kw) or object())

    S3FileStorage("b", "sa-east-1").client  # noqa: B018

    cfg = captured["config"]
    assert captured["region_name"] == "sa-east-1"
    assert cfg.connect_timeout == 3 and cfg.read_timeout == 5
    assert cfg.retries["max_attempts"] == 2


def test_s3_requires_bucket():
    with pytest.raises(ValueError):
        S3FileStorage("", "sa-east-1", client=FakeS3Client())


def test_local_roundtrip(tmp_path):
    storage = LocalFileStorage(tmp_path)
    key = "checkins/1/abc.jpg"

    assert storage.exists(key) is False and storage.stat(key) is None
    storage.put(key, b"12345")
    assert storage.exists(key) is True
    stat = storage.stat(key)
    assert stat.size_bytes == 5 and stat.content_type == "image/jpeg"
    assert storage.presign_download(key, 900).startswith("local://download/")
    assert storage.presign_upload(key, "image/jpeg", 10).method == "PUT"
    storage.delete(key)
    storage.delete(key)  # idempotente
    assert storage.exists(key) is False


@pytest.mark.parametrize(
    "key", ["../fora.jpg", "checkins/../../x.jpg", "/abs/x.jpg", "a\\b.jpg", "a//b.jpg", ""]
)
def test_local_rejects_path_traversal(tmp_path, key):
    storage = LocalFileStorage(tmp_path)

    with pytest.raises(ValueError):
        storage.exists(key)
    with pytest.raises(ValueError):
        storage.put(key, b"x")
