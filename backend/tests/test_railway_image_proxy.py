"""Railway image proxy path for S3 asset images (mocked HTTP)."""

from __future__ import annotations

import json
from unittest.mock import MagicMock

import pytest

from app.config import settings
from app.short_drama.exceptions import ShortDramaImageProviderError
from app.short_drama.providers.generated_image import GeneratedImage
from app.short_drama.providers.image_provider_factory import build_short_drama_image_provider
from app.short_drama.providers.railway_image_proxy import (
    RailwayProxyImageResult,
    image_provider_wants_railway_proxy,
    railway_create_image_from_text,
)
from app.short_drama.providers.railway_image_provider import RailwayImageProvider
from app.short_drama.providers.xai_image_provider import XaiImageProvider
from app.short_drama.utils.ai_runtime_config import AIRuntimeConfig
from app.short_drama.utils.image_storage import persist_generated_image_url


def test_image_provider_wants_railway_proxy_explicit(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "SHORT_DRAMA_IMAGE_PROVIDER", "railway_proxy")
    monkeypatch.setattr(settings, "AI_PROVIDER", "direct_xai")
    assert image_provider_wants_railway_proxy() is True


def test_image_provider_wants_railway_proxy_via_ai_provider(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "SHORT_DRAMA_IMAGE_PROVIDER", "xai")
    monkeypatch.setattr(settings, "AI_PROVIDER", "railway_proxy")
    assert image_provider_wants_railway_proxy() is True


def test_build_provider_railway_when_ai_provider_proxy(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "SHORT_DRAMA_USE_MOCK_IMAGE_PROVIDER", False)
    monkeypatch.setattr(settings, "SHORT_DRAMA_IMAGE_PROVIDER", "xai")
    monkeypatch.setattr(settings, "AI_PROVIDER", "railway_proxy")
    prov = build_short_drama_image_provider()
    assert isinstance(prov, RailwayImageProvider)


def test_build_provider_xai_direct(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "SHORT_DRAMA_USE_MOCK_IMAGE_PROVIDER", False)
    monkeypatch.setattr(settings, "SHORT_DRAMA_IMAGE_PROVIDER", "xai")
    monkeypatch.setattr(settings, "AI_PROVIDER", "direct_xai")
    prov = build_short_drama_image_provider()
    assert isinstance(prov, XaiImageProvider)


def test_railway_create_image_defaults_r2_url_request(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "AI_PROXY_BASE_URL", "https://proxy.example")
    monkeypatch.setattr(settings, "AI_PROXY_TOKEN", "tok")
    monkeypatch.setattr(settings, "RAILWAY_IMAGE_PROXY_TIMEOUT_SECONDS", 300)

    captured: dict = {}

    payload = {
        "data": [{"url": "https://bucket.r2.dev/proj/asset.jpg"}],
        "mime_type": "image/jpeg",
        "storage": "r2",
    }

    class FakeResp:
        status_code = 200
        text = json.dumps(payload)

        def json(self):
            return payload

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def post(self, url, headers=None, json=None):
            captured["body"] = json
            return FakeResp()

    monkeypatch.setattr("app.short_drama.providers.railway_image_proxy.httpx.Client", FakeClient)
    result = railway_create_image_from_text(
        project_id=1,
        target_type="character",
        target_id=9,
        prompt="a cat",
        model="grok-imagine-image",
        response_format="",
        aspect_ratio=None,
        resolution=None,
    )
    assert captured["body"]["response_format"] == "r2_url"
    assert isinstance(result, RailwayProxyImageResult)
    assert result.response_format == "r2_url"
    assert result.remote_url == "https://bucket.r2.dev/proj/asset.jpg"
    assert result.mime_type == "image/jpeg"
    assert result.storage == "r2"
    assert result.raw_bytes is None


def test_railway_create_image_normalizes_resolution_case(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "AI_PROXY_BASE_URL", "https://proxy.example")
    monkeypatch.setattr(settings, "AI_PROXY_TOKEN", "tok")

    captured: dict = {}
    payload = {"b64_json": "aGVsbG8="}

    class FakeResp:
        status_code = 200
        text = json.dumps(payload)

        def json(self):
            return payload

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def post(self, url, headers=None, json=None):
            captured["body"] = json
            return FakeResp()

    monkeypatch.setattr("app.short_drama.providers.railway_image_proxy.httpx.Client", FakeClient)
    railway_create_image_from_text(
        project_id=1,
        target_type="character",
        target_id=9,
        prompt="a cat",
        model="grok-imagine-image",
        response_format="b64_json",
        aspect_ratio="1:1",
        resolution="1K",
    )

    assert captured["body"]["resolution"] == "1k"


def test_railway_create_image_b64_json_compat(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "AI_PROXY_BASE_URL", "https://proxy.example")
    monkeypatch.setattr(settings, "AI_PROXY_TOKEN", "tok")

    class FakeResp:
        status_code = 200
        text = json.dumps({"b64_json": "aGVsbG8="})

        def json(self):
            return {"b64_json": "aGVsbG8="}

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def post(self, url, headers=None, json=None):
            return FakeResp()

    monkeypatch.setattr("app.short_drama.providers.railway_image_proxy.httpx.Client", FakeClient)
    result = railway_create_image_from_text(
        project_id=1,
        target_type="character",
        target_id=9,
        prompt="a cat",
        model="grok-imagine-image",
        response_format="b64_json",
        aspect_ratio=None,
        resolution=None,
    )
    assert result.response_format == "b64_json"
    assert result.raw_bytes == b"hello"
    assert result.remote_url is None


def test_railway_create_image_url_response_when_explicit_url(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "AI_PROXY_BASE_URL", "https://proxy.example")
    monkeypatch.setattr(settings, "AI_PROXY_TOKEN", "tok")

    class FakeResp:
        status_code = 200
        text = json.dumps({"url": "https://cdn.example/img.png"})

        def json(self):
            return {"url": "https://cdn.example/img.png"}

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def post(self, url, headers=None, json=None):
            assert json["response_format"] == "url"
            return FakeResp()

    monkeypatch.setattr("app.short_drama.providers.railway_image_proxy.httpx.Client", FakeClient)
    result = railway_create_image_from_text(
        project_id=1,
        target_type="character",
        target_id=9,
        prompt="a cat",
        model="grok-imagine-image",
        response_format="url",
        aspect_ratio=None,
        resolution=None,
    )
    assert result.remote_url == "https://cdn.example/img.png"


def test_railway_image_provider_r2_url_no_download(monkeypatch: pytest.MonkeyPatch) -> None:
    r2 = "https://bucket.r2.dev/generated/asset.jpg"

    def fake_railway(**kwargs):
        assert kwargs["response_format"] == "r2_url"
        return RailwayProxyImageResult(
            response_format="r2_url",
            remote_url=r2,
            mime_type="image/jpeg",
            storage="r2",
        )

    monkeypatch.setattr(
        "app.short_drama.providers.railway_image_provider.railway_create_image_from_text",
        fake_railway,
    )
    download = MagicMock()
    download.download_url = MagicMock(
        side_effect=AssertionError("download_url must not run for r2_url")
    )
    prov = RailwayImageProvider(download_client=download)
    out = prov.generate_from_text(
        prompt="test",
        asset_type="scene",
        project_id=2,
        asset_id=3,
    )
    assert out.remote_url == r2
    assert out.data == b""
    assert out.meta.get("image_source") == "r2_url"
    download.download_url.assert_not_called()


def test_railway_image_provider_gemini_runtime_uses_direct_client(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.short_drama.providers.railway_image_provider.get_ai_runtime_config",
        lambda stage: AIRuntimeConfig(
            stage_key=stage,
            provider="gemini",
            model_id="gemini-3.1-flash-image-preview",
        ),
    )
    monkeypatch.setattr(
        "app.short_drama.providers.railway_image_provider.railway_create_image_from_text",
        MagicMock(side_effect=AssertionError("Gemini image models must not be sent to Railway /images/generations")),
    )

    class FakeGeminiClient:
        def generate_image_from_text(self, **kwargs):
            assert kwargs["model"] == "gemini-3.1-flash-image-preview"
            return b"png-bytes", "image/png"

    monkeypatch.setattr(
        "app.short_drama.providers.railway_image_provider.GeminiImageClient",
        lambda: FakeGeminiClient(),
    )

    prov = RailwayImageProvider(download_client=MagicMock())
    out = prov.generate_from_text(
        prompt="test",
        asset_type="scene",
        project_id=2,
        asset_id=3,
    )

    assert out.provider == "gemini_image"
    assert out.model == "gemini-3.1-flash-image-preview"
    assert out.data == b"png-bytes"
    assert out.meta.get("image_source") == "gemini_direct"
    assert out.meta.get("via_railway_proxy") is False


def test_persist_generated_image_url_uses_remote(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.short_drama.utils.image_storage.save_image_bytes",
        MagicMock(side_effect=AssertionError("save_image_bytes must not run when remote_url set")),
    )
    gen = GeneratedImage(
        data=b"",
        mime_type="image/jpeg",
        provider="railway_proxy",
        model="grok-imagine-image",
        remote_url="https://bucket.r2.dev/x.jpg",
    )
    url = persist_generated_image_url(gen, project_id=1, asset_type="character", asset_id=1)
    assert url == "https://bucket.r2.dev/x.jpg"


def test_railway_image_provider_b64_json_no_download(monkeypatch: pytest.MonkeyPatch) -> None:
    fake_bytes = b"\x89PNG\r\n\x1a\n"

    def fake_railway(**kwargs):
        return RailwayProxyImageResult(
            response_format="b64_json",
            raw_bytes=fake_bytes,
            mime_type="image/png",
        )

    monkeypatch.setattr(
        "app.short_drama.providers.railway_image_provider.railway_create_image_from_text",
        fake_railway,
    )
    download = MagicMock()
    download.download_url = MagicMock(
        side_effect=AssertionError("download_url must not run when b64_json bytes are returned")
    )
    prov = RailwayImageProvider(download_client=download)
    out = prov.generate_from_text(
        prompt="test",
        asset_type="scene",
        project_id=2,
        asset_id=3,
    )
    assert out.data == fake_bytes
    assert out.meta.get("image_source") == "b64_json"
    download.download_url.assert_not_called()


def test_railway_image_provider_url_fallback_download(monkeypatch: pytest.MonkeyPatch) -> None:
    fake_bytes = b"\x89PNG\r\n\x1a\n"

    def fake_railway(**kwargs):
        return RailwayProxyImageResult(
            response_format="url",
            remote_url="https://cdn.example/img.png",
        )

    monkeypatch.setattr(
        "app.short_drama.providers.railway_image_provider.railway_create_image_from_text",
        fake_railway,
    )
    download = MagicMock()
    download.download_url.return_value = (fake_bytes, "image/png")
    prov = RailwayImageProvider(download_client=download)
    out = prov.generate_from_text(
        prompt="test",
        asset_type="scene",
        project_id=2,
        asset_id=3,
    )
    assert out.data == fake_bytes
    assert out.meta.get("image_source") == "url_fallback"
    download.download_url.assert_called_once_with("https://cdn.example/img.png")
