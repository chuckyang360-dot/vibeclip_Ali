"""Railway xAI video proxy provider (Aliyun backend → Railway → xAI)."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import httpx
import pytest

from app.config import settings
from app.short_drama.exceptions import ShortDramaVideoProviderError
from app.short_drama.providers.railway_xai_video_proxy import (
    RailwayXAIVideoProxyProvider,
    build_railway_xai_video_proxy_payload,
    request_railway_xai_video_generation,
)
from app.short_drama.providers.xai_video_provider import (
    MockXAIVideoProvider,
    XAIVideoProvider,
    build_xai_video_provider,
)
from app.short_drama.providers.seedance_video_provider import SeedanceVideoProvider


def test_build_railway_payload_fields() -> None:
    payload = build_railway_xai_video_proxy_payload(
        project_id=2,
        segment_id="seg_1",
        prompt="final prompt text",
        reference_image_urls=["https://cdn.example.com/a.jpg", ""],
        duration_seconds=8,
        aspect_ratio="9:16",
        resolution="720p",
        model="grok-imagine-video",
    )
    assert payload["project_id"] == 2
    assert payload["segment_id"] == "seg_1"
    assert payload["prompt"] == "final prompt text"
    assert payload["reference_image_urls"] == ["https://cdn.example.com/a.jpg"]
    assert payload["duration_seconds"] == 8
    assert payload["aspect_ratio"] == "9:16"
    assert payload["resolution"] == "720p"
    assert payload["model"] == "grok-imagine-video"
    assert payload["metadata"]["stage"] == "S5_VIDEO_GENERATION"


def test_build_provider_railway_xai_proxy(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("VIDEO_PROVIDER", "railway_xai_proxy")
    monkeypatch.setenv("SHORT_DRAMA_USE_MOCK_VIDEO_PROVIDER", "true")
    monkeypatch.setattr(settings, "RAILWAY_XAI_VIDEO_PROXY_BASE_URL", "https://proxy.example.com")
    monkeypatch.setattr(settings, "RAILWAY_XAI_VIDEO_PROXY_TOKEN", "tok")
    provider = build_xai_video_provider()
    assert isinstance(provider, RailwayXAIVideoProxyProvider)


def test_build_provider_railway_requires_base(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("VIDEO_PROVIDER", "railway_xai_proxy")
    monkeypatch.setattr(settings, "RAILWAY_XAI_VIDEO_PROXY_BASE_URL", None)
    monkeypatch.setattr(settings, "AI_PROXY_BASE_URL", None)
    monkeypatch.setattr(settings, "RAILWAY_XAI_VIDEO_PROXY_TOKEN", "tok")
    with pytest.raises(ShortDramaVideoProviderError, match="RAILWAY_XAI_VIDEO_PROXY_BASE_URL"):
        build_xai_video_provider()


def test_build_provider_xai_and_seedance_unchanged(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("VIDEO_PROVIDER", "xai")
    monkeypatch.setattr(settings, "XAI_API_KEY", "k")
    assert isinstance(build_xai_video_provider(), XAIVideoProvider)

    monkeypatch.setenv("VIDEO_PROVIDER", "seedance")
    monkeypatch.setattr(settings, "ARK_API_KEY", "ark")
    assert isinstance(build_xai_video_provider(), SeedanceVideoProvider)

    monkeypatch.setenv("VIDEO_PROVIDER", "mock")
    assert isinstance(build_xai_video_provider(), MockXAIVideoProvider)


def test_request_proxy_ok_false_raises(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.short_drama.providers.railway_xai_video_proxy.effective_railway_xai_video_proxy_base_url",
        lambda: "https://proxy.example.com",
    )
    monkeypatch.setattr(
        "app.short_drama.providers.railway_xai_video_proxy.effective_railway_xai_video_proxy_token",
        lambda: "tok",
    )

    resp = MagicMock()
    resp.status_code = 200
    resp.text = '{"ok": false, "error_code": "XAI_VIDEO_GENERATION_FAILED", "error_message": "bad"}'
    resp.json.return_value = {
        "ok": False,
        "error_code": "XAI_VIDEO_GENERATION_FAILED",
        "error_message": "bad",
        "request_id": "rid-1",
    }

    with patch("httpx.Client") as client_cls:
        client_cls.return_value.__enter__.return_value.post.return_value = resp
        with pytest.raises(ShortDramaVideoProviderError, match="XAI_VIDEO_GENERATION_FAILED"):
            request_railway_xai_video_generation(
                project_id=1,
                segment_id="s1",
                prompt="p",
                reference_image_urls=[],
                duration_seconds=6,
                aspect_ratio="9:16",
                resolution="720p",
                model="grok-imagine-video",
            )


def test_provider_r2_result_skips_download(monkeypatch: pytest.MonkeyPatch) -> None:
    proxy_json = {
        "ok": True,
        "provider": "xai",
        "model": "grok-imagine-video",
        "request_id": "xai-req-r2",
        "storage": "r2",
        "video_url": "https://cdn.vibeclip.cn/short-drama/videos/2/seg.mp4",
        "r2_key": "short-drama/videos/2/seg.mp4",
        "xai_video_url": "https://vidgen.x.ai/some/path.mp4",
        "duration_seconds": 8,
    }
    monkeypatch.setattr(
        "app.short_drama.providers.railway_xai_video_proxy.request_railway_xai_video_generation",
        lambda **kwargs: dict(proxy_json),
    )

    def _must_not_download(**kwargs: object) -> bytes:
        raise AssertionError("download_remote_video_bytes must not be called for storage=r2")

    monkeypatch.setattr(
        "app.short_drama.providers.railway_xai_video_proxy.download_remote_video_bytes",
        _must_not_download,
    )

    provider = RailwayXAIVideoProxyProvider()
    rid = provider.submit_reference_segment_video(
        prompt="p",
        reference_image_urls=["https://img.example/r.jpg"],
        duration_seconds=8,
        aspect_ratio="9:16",
        resolution="720p",
        project_id=2,
        segment_id="seg_1",
    )
    result = provider.complete_segment_video(
        request_id=rid,
        project_id=2,
        segment_id="seg_1",
        duration_seconds=8,
    )
    assert result.video_bytes == b""
    assert result.provider_video_url == proxy_json["video_url"]
    assert result.provider_metadata["storage"] == "r2"
    assert result.provider_metadata["r2_key"] == proxy_json["r2_key"]


def test_provider_legacy_result_still_downloads(monkeypatch: pytest.MonkeyPatch) -> None:
    proxy_json = {
        "ok": True,
        "provider": "xai",
        "model": "grok-imagine-video",
        "request_id": "xai-req-1",
        "video_url": "https://cdn.example.com/v.mp4",
        "duration_seconds": 8,
    }
    monkeypatch.setattr(
        "app.short_drama.providers.railway_xai_video_proxy.request_railway_xai_video_generation",
        lambda **kwargs: dict(proxy_json),
    )
    monkeypatch.setattr(
        "app.short_drama.providers.railway_xai_video_proxy.download_remote_video_bytes",
        lambda **kwargs: b"mp4data",
    )

    provider = RailwayXAIVideoProxyProvider()
    rid = provider.submit_reference_segment_video(
        prompt="p",
        reference_image_urls=["https://img.example/r.jpg"],
        duration_seconds=8,
        aspect_ratio="9:16",
        resolution="720p",
        project_id=2,
        segment_id="seg_1",
    )
    result = provider.complete_segment_video(
        request_id=rid,
        project_id=2,
        segment_id="seg_1",
        duration_seconds=8,
    )
    assert result.video_bytes == b"mp4data"
    assert result.provider_video_url == "https://cdn.example.com/v.mp4"


def test_vidgen_video_url_raises(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.short_drama.providers.railway_xai_video_proxy import _ensure_not_vidgen_video_url

    with pytest.raises(ShortDramaVideoProviderError, match="expected R2 URL"):
        _ensure_not_vidgen_video_url(
            "https://vidgen.x.ai/generated/abc.mp4",
            project_id=1,
            segment_id="s1",
            request_id="r1",
        )


def test_request_proxy_http_500_raises(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.short_drama.providers.railway_xai_video_proxy.effective_railway_xai_video_proxy_base_url",
        lambda: "https://proxy.example.com",
    )
    monkeypatch.setattr(
        "app.short_drama.providers.railway_xai_video_proxy.effective_railway_xai_video_proxy_token",
        lambda: "tok",
    )
    resp = MagicMock()
    resp.status_code = 500
    resp.text = "internal error"
    with patch("httpx.Client") as client_cls:
        client_cls.return_value.__enter__.return_value.post.return_value = resp
        with pytest.raises(ShortDramaVideoProviderError, match="HTTP 500"):
            request_railway_xai_video_generation(
                project_id=1,
                segment_id="s1",
                prompt="p",
                reference_image_urls=[],
                duration_seconds=6,
                aspect_ratio="9:16",
                resolution=None,
                model="grok-imagine-video",
            )


def test_video_model_for_provider_labels() -> None:
    from app.short_drama.providers.video_provider_config import effective_video_model_for_provider

    monkeypatch = pytest.MonkeyPatch()
    monkeypatch.setattr(settings, "XAI_VIDEO_MODEL", "grok-imagine-video")
    monkeypatch.setattr(settings, "SEEDANCE_VIDEO_MODEL", "doubao-seedance-2-0-260128")
    try:
        assert "grok" in effective_video_model_for_provider("railway_xai_proxy").lower()
        assert "seedance" in effective_video_model_for_provider("seedance").lower() or "doubao" in effective_video_model_for_provider("seedance").lower()
        assert effective_video_model_for_provider("mock") == "mock-ffmpeg"
    finally:
        monkeypatch.undo()
