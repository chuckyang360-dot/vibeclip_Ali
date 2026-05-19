"""Railway image proxy path for S3 asset images (mocked HTTP)."""

from __future__ import annotations

import json
from unittest.mock import MagicMock

import pytest

from app.config import settings
from app.short_drama.exceptions import ShortDramaImageProviderError
from app.short_drama.providers.image_provider_factory import build_short_drama_image_provider
from app.short_drama.providers.railway_image_proxy import (
    image_provider_wants_railway_proxy,
    railway_create_image_from_text,
)
from app.short_drama.providers.railway_image_provider import RailwayImageProvider
from app.short_drama.providers.xai_image_provider import XaiImageProvider


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


def test_railway_create_image_defaults_b64_json_request(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "AI_PROXY_BASE_URL", "https://proxy.example")
    monkeypatch.setattr(settings, "AI_PROXY_TOKEN", "tok")
    monkeypatch.setattr(settings, "RAILWAY_IMAGE_PROXY_TIMEOUT_SECONDS", 300)

    captured: dict = {}

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
            captured["body"] = json
            return FakeResp()

    monkeypatch.setattr("app.short_drama.providers.railway_image_proxy.httpx.Client", FakeClient)
    u, b64, raw = railway_create_image_from_text(
        project_id=1,
        target_type="character",
        target_id=9,
        prompt="a cat",
        model="grok-imagine-image",
        response_format="",
        aspect_ratio=None,
        resolution=None,
    )
    assert captured["body"]["response_format"] == "b64_json"
    assert u is None
    assert b64 == "aGVsbG8="
    assert raw == b"hello"


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
    u, b64, raw = railway_create_image_from_text(
        project_id=1,
        target_type="character",
        target_id=9,
        prompt="a cat",
        model="grok-imagine-image",
        response_format="url",
        aspect_ratio=None,
        resolution=None,
    )
    assert u == "https://cdn.example/img.png"
    assert b64 is None
    assert raw is None


def test_railway_image_provider_b64_json_no_download(monkeypatch: pytest.MonkeyPatch) -> None:
    fake_bytes = b"\x89PNG\r\n\x1a\n"

    def fake_railway(**kwargs):
        assert kwargs["response_format"] == "b64_json"
        return None, "e30=", fake_bytes

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
    assert out.provider == "railway_proxy"
    assert out.meta.get("image_source") == "b64_json"
    download.download_url.assert_not_called()


def test_railway_image_provider_url_fallback_download(monkeypatch: pytest.MonkeyPatch) -> None:
    fake_bytes = b"\x89PNG\r\n\x1a\n"

    def fake_railway(**kwargs):
        return "https://cdn.example/img.png", None, None

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
