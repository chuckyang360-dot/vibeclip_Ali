from __future__ import annotations

import pytest

from app.short_drama.services.merge_service import _downloadable_merge_video_url


def test_merge_uses_presigned_url_for_private_r2_video(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("R2_BUCKET_NAME", "bucket-a")
    monkeypatch.setattr(
        "app.utils.r2_storage.build_presigned_get_url",
        lambda key: f"https://signed.example/{key}",
    )

    url = "https://pub-abc.r2.dev/short-drama/videos/19/segment_seg_1.mp4"

    assert (
        _downloadable_merge_video_url(url)
        == "https://signed.example/short-drama/videos/19/segment_seg_1.mp4"
    )


def test_merge_keeps_non_r2_video_url() -> None:
    url = "/static/short-drama-videos/19/segment_seg_1.mp4"
    assert _downloadable_merge_video_url(url) == url
