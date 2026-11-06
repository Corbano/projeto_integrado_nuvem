import pytest

from app.infrastructure.storage import LocalFileStorage, S3FileStorage


class FakeClientError(Exception):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.response = {"Error": {"Code": code}}


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
            raise FakeClientError("404")
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


def test_s3_unexpected_errors_are_not_swallowed():
    class Boom(FakeS3Client):
        def head_object(self, Bucket, Key):  # noqa: N803
            raise FakeClientError("AccessDenied")

    with pytest.raises(FakeClientError):
        S3FileStorage("b", "r", client=Boom()).exists("k.png")


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
