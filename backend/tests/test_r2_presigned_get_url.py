from __future__ import annotations

from app.utils import r2_storage


class FakeS3:
    def __init__(self) -> None:
        self.calls: list[dict] = []

    def generate_presigned_url(self, operation: str, Params: dict, ExpiresIn: int) -> str:
        self.calls.append({"operation": operation, "Params": Params, "ExpiresIn": ExpiresIn})
        return f"https://signed.example/{Params['Bucket']}/{Params['Key']}?expires={ExpiresIn}"


def test_build_presigned_get_url_uses_bucket_key_and_ttl(monkeypatch) -> None:
    fake = FakeS3()
    monkeypatch.setattr(r2_storage, "s3", fake)
    monkeypatch.setenv("R2_BUCKET_NAME", "bucket-a")
    monkeypatch.setenv("R2_PRESIGNED_GET_EXPIRES_SECONDS", "1800")

    url = r2_storage.build_presigned_get_url("/short-drama/reference-videos/a/original.mp4")

    assert url == "https://signed.example/bucket-a/short-drama/reference-videos/a/original.mp4?expires=1800"
    assert fake.calls == [
        {
            "operation": "get_object",
            "Params": {"Bucket": "bucket-a", "Key": "short-drama/reference-videos/a/original.mp4"},
            "ExpiresIn": 1800,
        }
    ]


def test_build_presigned_get_url_clamps_ttl(monkeypatch) -> None:
    fake = FakeS3()
    monkeypatch.setattr(r2_storage, "s3", fake)
    monkeypatch.setenv("R2_BUCKET_NAME", "bucket-a")
    monkeypatch.setenv("R2_PRESIGNED_GET_EXPIRES_SECONDS", "999999")

    r2_storage.build_presigned_get_url("video.mp4")

    assert fake.calls[0]["ExpiresIn"] == 24 * 60 * 60
