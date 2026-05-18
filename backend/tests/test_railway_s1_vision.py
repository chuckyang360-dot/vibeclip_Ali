"""Railway AI Proxy S1 vision path (mocked HTTP, no live calls)."""

from __future__ import annotations

import json

import pytest

from app.config import settings
from app.short_drama.exceptions import ShortDramaInvalidModelOutputError, ShortDramaProviderError
from app.short_drama.providers import railway_s1_vision as rs1
from app.short_drama.providers.railway_s1_vision import (
    ai_provider_wants_railway_proxy,
    generate_product_image_understanding_via_railway_proxy,
)
from app.short_drama.schemas.product import ProductImageInputSchema, ProductRawInputSchema
from app.short_drama.services import image_understanding_service as ius


def test_ai_provider_wants_railway_proxy_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "AI_PROVIDER", "  railway_proxy  ")
    assert ai_provider_wants_railway_proxy() is True
    monkeypatch.setattr(settings, "AI_PROVIDER", "direct_xai")
    assert ai_provider_wants_railway_proxy() is False


def test_s1_vision_provider_railway_string_does_not_trigger_ai_provider_gate(monkeypatch: pytest.MonkeyPatch) -> None:
    """S1_VISION_PROVIDER=railway_proxy must not enable Railway; only AI_PROVIDER=railway_proxy does."""
    monkeypatch.setattr(settings, "S1_VISION_PROVIDER", "railway_proxy")
    monkeypatch.setattr(settings, "AI_PROVIDER", "direct_xai")
    assert ai_provider_wants_railway_proxy() is False


def test_railway_missing_token_raises(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "AI_PROXY_BASE_URL", "https://proxy.example")
    monkeypatch.setattr(settings, "AI_PROXY_TOKEN", None)
    monkeypatch.setattr(settings, "AI_PROXY_TIMEOUT_SECONDS", 60)
    with pytest.raises(ShortDramaProviderError) as ei:
        generate_product_image_understanding_via_railway_proxy(
            project_id=9,
            system_prompt="SYS",
            user_payload={"project_id": 9},
            image_urls=["https://example.com/x.png"],
        )
    assert "AI_PROXY_TOKEN" in str(ei.value)


def test_understand_railway_missing_token(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "AI_PROVIDER", "railway_proxy")
    monkeypatch.setattr(settings, "AI_PROXY_BASE_URL", "https://proxy.example")
    monkeypatch.setattr(settings, "AI_PROXY_TOKEN", None)
    monkeypatch.setattr(settings, "AI_PROXY_TIMEOUT_SECONDS", 60)
    monkeypatch.setattr(settings, "SHORT_DRAMA_USE_MOCK_TEXT_PROVIDER", False)

    raw = ProductRawInputSchema(
        product_images=[ProductImageInputSchema(image_url="https://example.com/p.png")]
    )
    svc = ius.ProductImageUnderstandingService(text_provider=None)
    with pytest.raises(ShortDramaProviderError) as ei:
        svc.understand(42, raw)
    assert "AI_PROXY_TOKEN" in str(ei.value)


def test_railway_raw_text_goes_through_json_parse(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "AI_PROXY_BASE_URL", "https://proxy.example")
    monkeypatch.setattr(settings, "AI_PROXY_TOKEN", "t0k")
    monkeypatch.setattr(settings, "AI_PROXY_TIMEOUT_SECONDS", 60)

    inner = json.dumps(
        {"detected_product_type": "cup", "detected_visual_features": ["white"]},
        ensure_ascii=False,
    )

    class Resp:
        status_code = 200
        text = ""

        def json(self) -> dict:
            return {"raw_text": inner}

    class FakeClient:
        def __init__(self, *a, **k):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return None

        def post(self, url: str, headers=None, json=None):
            assert url == "https://proxy.example/s1/vision"
            assert headers.get("Authorization") == "Bearer t0k"
            assert json["system_prompt"] == "SYS"
            assert json["user_payload"] == {"project_id": 3}
            assert json["image_urls"] == ["https://example.com/a.png"]
            return Resp()

    monkeypatch.setattr(rs1.httpx, "Client", lambda **kw: FakeClient())

    out = generate_product_image_understanding_via_railway_proxy(
        project_id=3,
        system_prompt="SYS",
        user_payload={"project_id": 3},
        image_urls=["https://example.com/a.png"],
    )
    assert out["detected_product_type"] == "cup"
    assert out["detected_visual_features"] == ["white"]


def test_understand_ai_provider_railway_schema_validate(monkeypatch: pytest.MonkeyPatch) -> None:
    """Railway returns raw_text JSON → try_parse_json_object → normalize → ProductImageUnderstandingSchema."""
    monkeypatch.setattr(settings, "AI_PROVIDER", "railway_proxy")
    monkeypatch.setattr(settings, "AI_PROXY_BASE_URL", "https://proxy.example")
    monkeypatch.setattr(settings, "AI_PROXY_TOKEN", "tok")
    monkeypatch.setattr(settings, "AI_PROXY_TIMEOUT_SECONDS", 60)
    monkeypatch.setattr(settings, "SHORT_DRAMA_USE_MOCK_TEXT_PROVIDER", False)

    inner = json.dumps({"detected_product_type": "mug"}, ensure_ascii=False)

    class Resp:
        status_code = 200
        text = ""

        def json(self) -> dict:
            return {"raw_text": inner}

    class FakeClient:
        def __init__(self, *a, **k):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return None

        def post(self, url: str, headers=None, json=None):
            return Resp()

    monkeypatch.setattr(rs1.httpx, "Client", lambda **kw: FakeClient())

    raw = ProductRawInputSchema(
        product_images=[ProductImageInputSchema(image_url="https://example.com/z.png")]
    )
    svc = ius.ProductImageUnderstandingService(text_provider=None)
    out = svc.understand(7, raw)
    assert out.detected_product_type == "mug"


def test_understand_default_does_not_call_railway(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "AI_PROVIDER", "direct_xai")
    monkeypatch.setattr(settings, "S1_VISION_PROVIDER", None)
    monkeypatch.setattr(settings, "SHORT_DRAMA_USE_MOCK_TEXT_PROVIDER", False)

    def boom_railway(**kwargs):
        raise AssertionError("railway proxy should not be called")

    def boom_geoq(**kwargs):
        raise AssertionError("geoq should not be called")

    monkeypatch.setattr(ius, "generate_product_image_understanding_via_railway_proxy", boom_railway)
    monkeypatch.setattr(ius, "generate_product_image_understanding_json", boom_geoq)

    class FakeText:
        def generate_structured_json(self, **kwargs):
            return {"detected_product_type": "xai_path"}

    raw = ProductRawInputSchema(
        product_images=[ProductImageInputSchema(image_url="https://example.com/p.png")]
    )
    svc = ius.ProductImageUnderstandingService(text_provider=FakeText())
    result = svc.understand(100, raw)
    assert result.detected_product_type == "xai_path"


def test_understand_s1_vision_railway_legacy_ignored_routes_xai(monkeypatch: pytest.MonkeyPatch) -> None:
    """Old env S1_VISION_PROVIDER=railway_proxy does not select Railway without AI_PROVIDER."""
    monkeypatch.setattr(settings, "AI_PROVIDER", "direct_xai")
    monkeypatch.setattr(settings, "S1_VISION_PROVIDER", "railway_proxy")
    monkeypatch.setattr(settings, "SHORT_DRAMA_USE_MOCK_TEXT_PROVIDER", False)

    calls_railway: list[bool] = []

    def track_railway(**kwargs):
        calls_railway.append(True)
        return {}

    monkeypatch.setattr(ius, "generate_product_image_understanding_via_railway_proxy", track_railway)

    class FakeText:
        def generate_structured_json(self, **kwargs):
            return {"detected_product_type": "fallback_xai"}

    raw = ProductRawInputSchema(
        product_images=[ProductImageInputSchema(image_url="https://example.com/q.png")]
    )
    svc = ius.ProductImageUnderstandingService(text_provider=FakeText())
    out = svc.understand(8, raw)
    assert out.detected_product_type == "fallback_xai"
    assert calls_railway == []


def test_understand_ai_provider_railway_branch(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "AI_PROVIDER", "railway_proxy")
    monkeypatch.setattr(settings, "SHORT_DRAMA_USE_MOCK_TEXT_PROVIDER", False)

    calls: list[dict] = []

    def fake_railway(**kwargs):
        calls.append(kwargs)
        return {"detected_product_type": "via_proxy"}

    monkeypatch.setattr(ius, "generate_product_image_understanding_via_railway_proxy", fake_railway)

    class FakeText:
        def generate_structured_json(self, **kwargs):
            raise AssertionError("xai should not be called")

    raw = ProductRawInputSchema(
        product_images=[ProductImageInputSchema(image_url="https://example.com/q.png")]
    )
    svc = ius.ProductImageUnderstandingService(text_provider=FakeText())
    out = svc.understand(5, raw)
    assert out.detected_product_type == "via_proxy"
    assert calls[0]["project_id"] == 5
    assert "user_payload" in calls[0]


def test_understand_geoq_when_ai_unset_and_s1_geoq(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "AI_PROVIDER", "direct_xai")
    monkeypatch.setattr(settings, "S1_VISION_PROVIDER", "geoq")
    monkeypatch.setattr(settings, "SHORT_DRAMA_USE_MOCK_TEXT_PROVIDER", False)

    def boom_railway(**kwargs):
        raise AssertionError("railway should not be called")

    monkeypatch.setattr(ius, "generate_product_image_understanding_via_railway_proxy", boom_railway)

    def fake_geoq(**kwargs):
        return {"detected_product_type": "geoq_branch"}

    monkeypatch.setattr(ius, "generate_product_image_understanding_json", fake_geoq)

    class FakeText:
        def generate_structured_json(self, **kwargs):
            raise AssertionError("xai should not be called")

    raw = ProductRawInputSchema(
        product_images=[ProductImageInputSchema(image_url="https://example.com/g.png")]
    )
    svc = ius.ProductImageUnderstandingService(text_provider=FakeText())
    out = svc.understand(11, raw)
    assert out.detected_product_type == "geoq_branch"


def test_understand_railway_wins_over_geoq(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "AI_PROVIDER", "railway_proxy")
    monkeypatch.setattr(settings, "S1_VISION_PROVIDER", "geoq")
    monkeypatch.setattr(settings, "SHORT_DRAMA_USE_MOCK_TEXT_PROVIDER", False)

    def boom_geoq(**kwargs):
        raise AssertionError("geoq should not run when AI_PROVIDER=railway_proxy")

    monkeypatch.setattr(ius, "generate_product_image_understanding_json", boom_geoq)

    def fake_railway(**kwargs):
        return {"detected_product_type": "railway_priority"}

    monkeypatch.setattr(ius, "generate_product_image_understanding_via_railway_proxy", fake_railway)

    raw = ProductRawInputSchema(
        product_images=[ProductImageInputSchema(image_url="https://example.com/x.png")]
    )
    svc = ius.ProductImageUnderstandingService(text_provider=None)
    out = svc.understand(12, raw)
    assert out.detected_product_type == "railway_priority"


def test_railway_invalid_json_body_logs_invalid_proxy_response(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "AI_PROXY_BASE_URL", "https://proxy.example")
    monkeypatch.setattr(settings, "AI_PROXY_TOKEN", "t0k")
    monkeypatch.setattr(settings, "AI_PROXY_TIMEOUT_SECONDS", 60)

    class Resp:
        status_code = 200
        text = "not-json"

        def json(self):
            raise json.JSONDecodeError("msg", "doc", 0)

    class FakeClient:
        def __init__(self, *a, **k):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return None

        def post(self, url: str, headers=None, json=None):
            return Resp()

    monkeypatch.setattr(rs1.httpx, "Client", lambda **kw: FakeClient())

    with pytest.raises(ShortDramaProviderError):
        generate_product_image_understanding_via_railway_proxy(
            project_id=1,
            system_prompt="S",
            user_payload={},
            image_urls=["https://example.com/i.png"],
        )


def test_railway_bad_json_in_raw_text_raises_invalid_output(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "AI_PROXY_BASE_URL", "https://proxy.example")
    monkeypatch.setattr(settings, "AI_PROXY_TOKEN", "t0k")
    monkeypatch.setattr(settings, "AI_PROXY_TIMEOUT_SECONDS", 60)

    class Resp:
        status_code = 200
        text = ""

        def json(self) -> dict:
            return {"raw_text": "NOT_JSON"}

    class FakeClient:
        def __init__(self, *a, **k):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return None

        def post(self, url: str, headers=None, json=None):
            return Resp()

    monkeypatch.setattr(rs1.httpx, "Client", lambda **kw: FakeClient())

    with pytest.raises(ShortDramaInvalidModelOutputError):
        generate_product_image_understanding_via_railway_proxy(
            project_id=1,
            system_prompt="S",
            user_payload={},
            image_urls=["https://example.com/i.png"],
        )


def test_railway_502_upstream_error_detail(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "AI_PROXY_BASE_URL", "https://proxy.example")
    monkeypatch.setattr(settings, "AI_PROXY_TOKEN", "t0k")
    monkeypatch.setattr(settings, "AI_PROXY_TIMEOUT_SECONDS", 60)

    class Resp:
        status_code = 502
        text = '{"detail":{"error":"upstream_error"}}'

        def json(self) -> dict:
            return {"detail": {"error": "upstream_error"}}

    class FakeClient:
        def __init__(self, *a, **k):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return None

        def post(self, url: str, headers=None, json=None):
            return Resp()

    monkeypatch.setattr(rs1.httpx, "Client", lambda **kw: FakeClient())

    with pytest.raises(ShortDramaProviderError) as ei:
        generate_product_image_understanding_via_railway_proxy(
            project_id=1,
            system_prompt="S",
            user_payload={},
            image_urls=["https://example.com/i.png"],
        )
    assert "upstream" in str(ei.value).lower()
