"""S3 asset image generation via Railway AI Proxy (no ECS→xAI images API)."""

from __future__ import annotations

import base64
import json
import logging
from typing import Any

import httpx

from ...config import settings
from ..exceptions import ShortDramaImageProviderError
from .railway_s1_vision import _effective_proxy_base_url, _proxy_detail_upstream_error

logger = logging.getLogger(__name__)


def _trunc_log_message(message: str, max_len: int = 500) -> str:
    t = (message or "").strip().replace("\n", " ")
    if len(t) <= max_len:
        return t
    return t[: max_len - 3] + "..."


def _image_proxy_error(project_id: int, error_type: str, message: str) -> None:
    logger.error(
        "[RAILWAY_PROXY_IMAGE_ERROR] project_id=%s error_type=%s message=%s",
        project_id,
        error_type,
        _trunc_log_message(message),
    )


def effective_railway_image_proxy_base_url() -> str:
    explicit = (settings.RAILWAY_IMAGE_PROXY_BASE_URL or "").strip().rstrip("/")
    if explicit:
        return explicit
    return _effective_proxy_base_url()


def effective_railway_image_proxy_timeout_seconds() -> int:
    raw = settings.RAILWAY_IMAGE_PROXY_TIMEOUT_SECONDS
    if raw is not None and int(raw) > 0:
        return max(5, int(raw))
    return max(5, int(settings.AI_PROXY_TIMEOUT_SECONDS or 120))


def image_provider_wants_railway_proxy() -> bool:
    """True when S3 images must not call xAI/Gemini directly from ECS."""
    kind = (settings.SHORT_DRAMA_IMAGE_PROVIDER or "xai").strip().lower()
    if kind == "railway_proxy":
        return True
    if kind == "xai":
        from .railway_s1_vision import ai_provider_wants_railway_proxy

        return ai_provider_wants_railway_proxy()
    return False


def railway_create_image_from_text(
    *,
    project_id: int,
    target_type: str,
    target_id: int,
    prompt: str,
    model: str,
    response_format: str,
    aspect_ratio: str | None,
    resolution: str | None,
) -> tuple[str | None, str | None, bytes | None]:
    """
    POST Railway /images/generations.
    Returns (image_url_or_none, b64_json_or_none, raw_bytes_or_none) — same contract as XaiImageClient.
    """
    base = effective_railway_image_proxy_base_url()
    token = (settings.AI_PROXY_TOKEN or "").strip()
    timeout_sec = effective_railway_image_proxy_timeout_seconds()

    if not base:
        _image_proxy_error(project_id, "missing_proxy_base_url", "AI_PROXY_BASE_URL is not set")
        raise ShortDramaImageProviderError(
            "AI_PROXY_BASE_URL is not configured (railway image proxy requires AI_PROXY_BASE_URL or RAILWAY_IMAGE_PROXY_BASE_URL)",
            category="configuration",
        )

    if not token:
        _image_proxy_error(project_id, "missing_proxy_token", "AI_PROXY_TOKEN is not set")
        raise ShortDramaImageProviderError(
            "AI_PROXY_TOKEN is not configured (railway image proxy requires AI_PROXY_TOKEN)",
            category="auth",
        )

    fmt = (response_format or "url").strip().lower()
    logger.info(
        "[RAILWAY_PROXY_IMAGE_REQUEST] provider=railway_proxy image_proxy_base_url=%s project_id=%s "
        "target_type=%s target_id=%s model=%s timeout_seconds=%s response_format=%s direct=false",
        base,
        project_id,
        target_type,
        target_id,
        model,
        timeout_sec,
        fmt,
    )

    url = f"{base}/images/generations"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    body: dict[str, Any] = {
        "prompt": prompt,
        "response_format": fmt,
        "project_id": project_id,
        "target_type": target_type,
        "target_id": target_id,
    }
    if aspect_ratio:
        body["aspect_ratio"] = aspect_ratio
    if resolution:
        body["resolution"] = resolution

    timeout = httpx.Timeout(float(timeout_sec), connect=min(30.0, float(timeout_sec)))
    try:
        with httpx.Client(timeout=timeout) as client:
            resp = client.post(url, headers=headers, json=body)
    except httpx.TimeoutException as e:
        _image_proxy_error(project_id, "timeout", str(e))
        raise ShortDramaImageProviderError(f"railway_ai_proxy_image_timeout: {e}", category="provider") from e
    except httpx.ConnectError as e:
        _image_proxy_error(project_id, "network_error", str(e))
        raise ShortDramaImageProviderError(f"railway_ai_proxy_image_network_error: {e}", category="provider") from e
    except httpx.HTTPError as e:
        _image_proxy_error(project_id, "network_error", str(e))
        raise ShortDramaImageProviderError(f"railway_ai_proxy_image_network_error: {e}", category="provider") from e

    snippet = _trunc_log_message((resp.text or ""), 1500)

    if resp.status_code in (401, 403):
        _image_proxy_error(project_id, "auth_failed", f"HTTP {resp.status_code}: {snippet}")
        raise ShortDramaImageProviderError(
            f"railway_ai_proxy_image_auth_failed ({resp.status_code}): {snippet or resp.reason_phrase}",
            category="auth",
        )

    if resp.status_code == 504:
        _image_proxy_error(project_id, "timeout", f"HTTP 504: {snippet}")
        raise ShortDramaImageProviderError(
            f"railway_ai_proxy_image_timeout: {snippet or resp.reason_phrase}",
            category="provider",
        )

    if resp.status_code == 502:
        try:
            jb = resp.json()
        except json.JSONDecodeError:
            jb = None
        if _proxy_detail_upstream_error(jb):
            _image_proxy_error(project_id, "proxy_upstream_error", f"HTTP 502: {snippet}")
            raise ShortDramaImageProviderError(
                f"railway_ai_proxy_image_upstream_error: {snippet or resp.reason_phrase}",
                category="provider",
            )
        _image_proxy_error(project_id, "bad_gateway", f"HTTP 502: {snippet}")
        raise ShortDramaImageProviderError(
            f"railway_ai_proxy_image_http_502: {snippet or resp.reason_phrase}",
            category="provider",
        )

    if resp.status_code != 200:
        _image_proxy_error(project_id, "http_error", f"HTTP {resp.status_code}: {snippet}")
        raise ShortDramaImageProviderError(
            f"railway_ai_proxy_image_http_{resp.status_code}: {snippet or resp.reason_phrase}",
            category="provider",
        )

    try:
        data = resp.json()
    except json.JSONDecodeError as e:
        _image_proxy_error(project_id, "invalid_proxy_response", str(e))
        raise ShortDramaImageProviderError(
            f"railway_ai_proxy_image_invalid_proxy_response: {e}",
            category="xai_response_invalid",
        ) from e

    if not isinstance(data, dict):
        _image_proxy_error(project_id, "invalid_proxy_response", "response JSON is not an object")
        raise ShortDramaImageProviderError(
            "railway_ai_proxy_image_invalid_proxy_response: expected JSON object",
            category="xai_response_invalid",
        )

    if fmt == "b64_json":
        b64 = data.get("b64_json")
        if not isinstance(b64, str) or not b64.strip():
            _image_proxy_error(project_id, "missing_b64_json", "b64_json missing or empty")
            raise ShortDramaImageProviderError(
                "railway_ai_proxy_image_missing_b64_json",
                category="xai_response_invalid",
            )
        try:
            raw = base64.b64decode(b64.strip(), validate=False)
        except Exception as e:
            raise ShortDramaImageProviderError(
                f"railway_ai_proxy_image_bad_b64_json: {e}",
                category="xai_response_invalid",
            ) from e
        if not raw:
            raise ShortDramaImageProviderError(
                "railway_ai_proxy_image_empty_bytes",
                category="xai_response_invalid",
            )
        logger.info(
            "[RAILWAY_PROXY_IMAGE_RESPONSE] provider=railway_proxy project_id=%s target_type=%s target_id=%s "
            "success=true format=b64_json bytes_len=%s",
            project_id,
            target_type,
            target_id,
            len(raw),
        )
        return None, b64.strip(), raw

    u = data.get("url")
    if not isinstance(u, str) or not u.strip():
        _image_proxy_error(project_id, "missing_url", "url missing or empty in proxy response")
        raise ShortDramaImageProviderError(
            "railway_ai_proxy_image_missing_url",
            category="xai_response_invalid",
        )

    logger.info(
        "[RAILWAY_PROXY_IMAGE_RESPONSE] provider=railway_proxy project_id=%s target_type=%s target_id=%s "
        "success=true format=url",
        project_id,
        target_type,
        target_id,
    )
    return u.strip(), None, None
