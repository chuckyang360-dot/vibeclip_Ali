"""Startup / one-shot audit logs for Short Drama AI provider routing (no secrets)."""

from __future__ import annotations

import logging

from ...config import settings
from .railway_image_proxy import (
    effective_railway_image_proxy_base_url,
    effective_railway_image_proxy_timeout_seconds,
    image_provider_wants_railway_proxy,
)
from .railway_s1_vision import _effective_proxy_base_url, ai_provider_wants_railway_proxy

logger = logging.getLogger(__name__)

_audit_logged = False


def _mask_token_configured() -> str:
    tok = (settings.AI_PROXY_TOKEN or "").strip()
    return "configured" if tok else "missing"


def _resolved_text_provider_label() -> str:
    if settings.SHORT_DRAMA_USE_MOCK_TEXT_PROVIDER:
        return "mock"
    if ai_provider_wants_railway_proxy():
        return "railway_proxy"
    return "grok"


def _resolved_image_provider_label() -> str:
    if settings.SHORT_DRAMA_USE_MOCK_IMAGE_PROVIDER:
        return "mock"
    kind = (settings.SHORT_DRAMA_IMAGE_PROVIDER or "xai").strip().lower()
    if kind == "mock":
        return "mock"
    if kind == "gemini":
        return "gemini"
    if image_provider_wants_railway_proxy():
        return "railway_proxy"
    if kind == "xai":
        return "xai_image"
    return kind


def log_ai_provider_config_audit(*, force: bool = False) -> None:
    global _audit_logged
    if _audit_logged and not force:
        return
    _audit_logged = True

    ai_provider = (settings.AI_PROVIDER or "direct_xai").strip().lower()
    text_provider = _resolved_text_provider_label()
    image_provider = _resolved_image_provider_label()
    text_base = _effective_proxy_base_url() if text_provider == "railway_proxy" else ""
    text_timeout = max(5, int(settings.AI_PROXY_TIMEOUT_SECONDS or 120))
    image_base = effective_railway_image_proxy_base_url() if image_provider == "railway_proxy" else ""
    image_timeout = effective_railway_image_proxy_timeout_seconds()

    logger.info(
        "[AI_PROVIDER_CONFIG] ai_provider=%s text_provider=%s proxy_base_url=%s "
        "timeout_seconds=%s proxy_token=%s s1_path=/s1/vision text_path=/text/completions "
        "use_mock_text=%s",
        ai_provider,
        text_provider,
        text_base or "(n/a)",
        text_timeout,
        _mask_token_configured(),
        bool(settings.SHORT_DRAMA_USE_MOCK_TEXT_PROVIDER),
    )

    logger.info(
        "[IMAGE_PROVIDER_CONFIG] short_drama_image_provider=%s resolved_image_provider=%s "
        "proxy_base_url=%s timeout_seconds=%s proxy_token=%s image_path=/images/generations "
        "use_mock_image=%s direct_xai_image=%s",
        (settings.SHORT_DRAMA_IMAGE_PROVIDER or "xai").strip().lower(),
        image_provider,
        image_base or "(n/a)",
        image_timeout,
        _mask_token_configured(),
        bool(settings.SHORT_DRAMA_USE_MOCK_IMAGE_PROVIDER),
        image_provider == "xai_image",
    )

    if ai_provider == "railway_proxy" and text_provider != "railway_proxy":
        logger.warning(
            "[AI_PROVIDER_CONFIG_WARN] AI_PROVIDER=railway_proxy but text resolves to %s "
            "(check SHORT_DRAMA_USE_MOCK_TEXT_PROVIDER)",
            text_provider,
        )
    if ai_provider == "railway_proxy" and image_provider == "xai_image":
        logger.warning(
            "[IMAGE_PROVIDER_CONFIG_WARN] AI_PROVIDER=railway_proxy but images still direct xai_image "
            "(set SHORT_DRAMA_IMAGE_PROVIDER=xai without mock, or railway_proxy; "
            "SHORT_DRAMA_USE_MOCK_IMAGE_PROVIDER must be false)",
        )
    if text_provider == "railway_proxy" and not text_base:
        logger.warning("[AI_PROVIDER_CONFIG_WARN] text_provider=railway_proxy but AI_PROXY_BASE_URL is empty")
    if image_provider == "railway_proxy" and not image_base:
        logger.warning("[IMAGE_PROVIDER_CONFIG_WARN] image_provider=railway_proxy but proxy base URL is empty")
