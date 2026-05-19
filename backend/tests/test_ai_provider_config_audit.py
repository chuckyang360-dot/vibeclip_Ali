"""AI provider config audit logs."""

from __future__ import annotations

import logging

import pytest

from app.config import settings
from app.short_drama.providers.ai_provider_config_audit import log_ai_provider_config_audit


def test_audit_logs_railway_proxy(caplog: pytest.LogCaptureFixture, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "AI_PROVIDER", "railway_proxy")
    monkeypatch.setattr(settings, "AI_PROXY_BASE_URL", "https://proxy.example")
    monkeypatch.setattr(settings, "AI_PROXY_TOKEN", "secret-token-should-not-appear")
    monkeypatch.setattr(settings, "AI_PROXY_TIMEOUT_SECONDS", 300)
    monkeypatch.setattr(settings, "SHORT_DRAMA_USE_MOCK_TEXT_PROVIDER", False)
    monkeypatch.setattr(settings, "SHORT_DRAMA_USE_MOCK_IMAGE_PROVIDER", False)
    monkeypatch.setattr(settings, "SHORT_DRAMA_IMAGE_PROVIDER", "xai")

    import app.short_drama.providers.ai_provider_config_audit as audit_mod

    audit_mod._audit_logged = False
    with caplog.at_level(logging.INFO):
        log_ai_provider_config_audit(force=True)

    text = caplog.text
    assert "[AI_PROVIDER_CONFIG]" in text
    assert "text_provider=railway_proxy" in text
    assert "proxy_base_url=https://proxy.example" in text
    assert "proxy_token=configured" in text
    assert "secret-token" not in text
    assert "[IMAGE_PROVIDER_CONFIG]" in text
    assert "resolved_image_provider=railway_proxy" in text
