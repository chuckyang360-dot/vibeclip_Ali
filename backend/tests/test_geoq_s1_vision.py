"""Minimal tests for GeoQ S1 vision gating (no live HTTP)."""

from __future__ import annotations

import pytest

from app.config import settings
from app.short_drama.exceptions import ShortDramaProviderError
from app.short_drama.providers.geoq_s1_vision import (
    classify_s1_image_input_type_for_log,
    generate_product_image_understanding_json,
    s1_vision_wants_geoq,
)


def test_classify_s1_image_input_type_for_log() -> None:
    assert classify_s1_image_input_type_for_log([]) == "none"
    assert classify_s1_image_input_type_for_log(["https://example.com/x.png"]) == "url"
    assert classify_s1_image_input_type_for_log(["data:image/png;base64,xxx"]) == "base64"
    assert classify_s1_image_input_type_for_log(
        ["https://a.com/x.png", "data:image/jpeg;base64,yy"]
    ) == "mixed"


def test_s1_vision_wants_geoq_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("S1_VISION_PROVIDER", "  GeoQ  ")
    # Settings is constructed at import; re-read is not automatic — patch attribute
    monkeypatch.setattr(settings, "S1_VISION_PROVIDER", "  GeoQ  ")
    assert s1_vision_wants_geoq() is True
    monkeypatch.setattr(settings, "S1_VISION_PROVIDER", None)
    assert s1_vision_wants_geoq() is False


def test_geoq_missing_api_key_raises(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "GEOQ_API_KEY", None)
    monkeypatch.setattr(settings, "GEOQ_BASE_URL", "https://api.geoq.help/v1")
    monkeypatch.setattr(settings, "GEOQ_S1_VISION_MODEL", "gpt-image-2")
    monkeypatch.setattr(settings, "GEOQ_TIMEOUT_SECONDS", 30)
    with pytest.raises(ShortDramaProviderError) as ei:
        generate_product_image_understanding_json(
            project_id=1,
            system_prompt="SYS",
            user_payload={"a": 1},
            image_urls=["https://example.com/i.png"],
        )
    assert "GEOQ_API_KEY" in str(ei.value) or "missing" in str(ei.value).lower()
