"""Build public HTTPS URLs for Short Drama /static assets (xAI, browsers, API responses)."""

from __future__ import annotations

import logging
from typing import Tuple
from urllib.parse import urljoin

from ...config import settings

logger = logging.getLogger(__name__)


def effective_short_drama_public_base() -> Tuple[str, str]:
    """Return (base_url, source_label_for_logs)."""
    a = (getattr(settings, "SHORT_DRAMA_PUBLIC_BASE_URL", None) or "").strip().rstrip("/")
    if a:
        return a, "short_drama_public_base_url"
    # Dev-safe default: when DEBUG=true and未显式配置 short drama 公网域名，
    # 始终使用本地后端地址，避免误走 PUBLIC_BASE_URL(线上 Railway 域名)。
    if bool(getattr(settings, "DEBUG", False)):
        return "http://127.0.0.1:8000", "debug_local_default"
    b = (getattr(settings, "PUBLIC_BASE_URL", None) or "").strip().rstrip("/")
    if b:
        return b, "public_base_url"
    legacy = (settings.SHORT_DRAMA_PUBLIC_MEDIA_BASE_URL or "").strip().rstrip("/")
    if legacy:
        return legacy, "short_drama_public_media_base_url_legacy"
    fallback = "http://127.0.0.1:8000"
    logger.warning(
        "[SHORT_DRAMA_PUBLIC_URL] No SHORT_DRAMA_PUBLIC_BASE_URL, PUBLIC_BASE_URL, or "
        "SHORT_DRAMA_PUBLIC_MEDIA_BASE_URL configured; using fallback=%s (dev only)",
        fallback,
    )
    return fallback, "fallback_local"


def build_public_static_url(path_or_url: str) -> str:
    """
    Turn a /static/... path into a full public URL using configured base.
    Pass through if already http(s)://.
    """
    s = (path_or_url or "").strip()
    if not s:
        return s
    if s.startswith("https://") or s.startswith("http://"):
        logger.info(
            "[SHORT_DRAMA_PUBLIC_URL] original_path=%s resolved_url=%s source=absolute_passthrough",
            s[:500],
            s[:500],
        )
        return s
    base, source = effective_short_drama_public_base()
    base_for_join = base if base.endswith("/") else base + "/"
    rel = s if s.startswith("/") else f"/{s}"
    resolved = urljoin(base_for_join, rel)
    logger.info(
        "[SHORT_DRAMA_PUBLIC_URL] original_path=%s resolved_url=%s source=%s",
        path_or_url[:500],
        resolved[:500],
        source,
    )
    return resolved
