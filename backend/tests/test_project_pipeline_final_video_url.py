from __future__ import annotations

from app.short_drama.routes.project import _rewrite_final_video_url_from_segments


def test_rewrite_final_video_url_keeps_presigned_query() -> None:
    final_url = (
        "https://account.r2.cloudflarestorage.com/vibeclip/short-drama/videos/20/final_20.mp4"
        "?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=cred&X-Amz-Signature=sig"
    )
    segment_url = (
        "https://account.r2.cloudflarestorage.com/vibeclip/short-drama/videos/20/segment_1.mp4"
        "?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=cred&X-Amz-Signature=sig"
    )

    assert _rewrite_final_video_url_from_segments(final_url, [{"video_url": segment_url}]) == final_url


def test_rewrite_final_video_url_still_rewrites_unsigned_public_base() -> None:
    final_url = "https://wrong.example/short-drama/videos/20/final_20.mp4"
    segment_url = "https://pub.example/short-drama/videos/20/segment_1.mp4"

    assert (
        _rewrite_final_video_url_from_segments(final_url, [{"video_url": segment_url}])
        == "https://pub.example/short-drama/videos/20/final_20.mp4"
    )
