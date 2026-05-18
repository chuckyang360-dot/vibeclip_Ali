"""S1 product image understanding via deployed Railway AI Proxy when AI_PROVIDER=railway_proxy."""

from __future__ import annotations

import json
import logging
from typing import Any

import httpx

from ...config import settings
from ..exceptions import ShortDramaInvalidModelOutputError, ShortDramaProviderError
from ..utils.json_parser import try_parse_json_object

logger = logging.getLogger(__name__)


def ai_provider_wants_railway_proxy() -> bool:
    return (settings.AI_PROVIDER or "").strip().lower() == "railway_proxy"


def _trunc_log_message(message: str, max_len: int = 500) -> str:
    t = (message or "").strip().replace("\n", " ")
    if len(t) <= max_len:
        return t
    return t[: max_len - 3] + "..."


def _railway_error(project_id: int, error_type: str, message: str) -> None:
    logger.error(
        "[S1_RAILWAY_PROXY_ERROR] project_id=%s error_type=%s message=%s",
        project_id,
        error_type,
        _trunc_log_message(message),
    )


def _effective_proxy_base_url() -> str:
    return (settings.AI_PROXY_BASE_URL or "").strip().rstrip("/")


def _proxy_detail_upstream_error(body: Any) -> bool:
    if not isinstance(body, dict):
        return False
    detail = body.get("detail")
    if isinstance(detail, dict) and detail.get("error") == "upstream_error":
        return True
    return False


def generate_product_image_understanding_via_railway_proxy(
    *,
    project_id: int,
    system_prompt: str,
    user_payload: dict[str, Any],
    image_urls: list[str],
) -> dict[str, Any]:
    base = _effective_proxy_base_url()
    token = (settings.AI_PROXY_TOKEN or "").strip()
    timeout_sec = max(5, int(settings.AI_PROXY_TIMEOUT_SECONDS or 120))

    logger.info("[AI_PROVIDER] provider=railway_proxy proxy_base_url=%s", base or "(empty)")

    if not base:
        _railway_error(project_id, "missing_proxy_base_url", "AI_PROXY_BASE_URL is not set")
        raise ShortDramaProviderError(
            "AI_PROXY_BASE_URL is not configured (AI_PROVIDER=railway_proxy requires AI_PROXY_BASE_URL)"
        )

    if not token:
        _railway_error(project_id, "missing_proxy_token", "AI_PROXY_TOKEN is not set")
        raise ShortDramaProviderError(
            "AI_PROXY_TOKEN is not configured (AI_PROVIDER=railway_proxy requires AI_PROXY_TOKEN)"
        )

    logger.info(
        "[S1_RAILWAY_PROXY_REQUEST] project_id=%s image_count=%s",
        project_id,
        len(image_urls),
    )

    url = f"{base}/s1/vision"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    body = {
        "image_urls": image_urls,
        "system_prompt": system_prompt,
        "user_payload": user_payload,
    }

    timeout = httpx.Timeout(timeout_sec, connect=min(30.0, float(timeout_sec)))
    try:
        with httpx.Client(timeout=timeout) as client:
            resp = client.post(url, headers=headers, json=body)
    except httpx.TimeoutException as e:
        _railway_error(project_id, "timeout", str(e))
        raise ShortDramaProviderError(f"railway_ai_proxy_timeout: {e}") from e
    except httpx.ConnectError as e:
        _railway_error(project_id, "network_error", str(e))
        raise ShortDramaProviderError(f"railway_ai_proxy_network_error: {e}") from e
    except httpx.HTTPError as e:
        _railway_error(project_id, "network_error", str(e))
        raise ShortDramaProviderError(f"railway_ai_proxy_network_error: {e}") from e

    snippet = _trunc_log_message((resp.text or ""), 1500)

    if resp.status_code in (401, 403):
        _railway_error(project_id, "auth_failed", f"HTTP {resp.status_code}: {snippet}")
        raise ShortDramaProviderError(
            f"railway_ai_proxy_auth_failed ({resp.status_code}): {snippet or resp.reason_phrase}"
        )

    if resp.status_code == 504:
        _railway_error(project_id, "timeout", f"HTTP 504: {snippet}")
        raise ShortDramaProviderError(f"railway_ai_proxy_timeout: {snippet or resp.reason_phrase}")

    if resp.status_code == 502:
        try:
            jb = resp.json()
        except json.JSONDecodeError:
            jb = None
        if _proxy_detail_upstream_error(jb):
            _railway_error(project_id, "proxy_upstream_error", f"HTTP 502: {snippet}")
            raise ShortDramaProviderError(f"railway_ai_proxy_upstream_error: {snippet or resp.reason_phrase}")
        _railway_error(project_id, "bad_gateway", f"HTTP 502: {snippet}")
        raise ShortDramaProviderError(f"railway_ai_proxy_http_502: {snippet or resp.reason_phrase}")

    if resp.status_code != 200:
        _railway_error(project_id, "http_error", f"HTTP {resp.status_code}: {snippet}")
        raise ShortDramaProviderError(
            f"railway_ai_proxy_http_{resp.status_code}: {snippet or resp.reason_phrase}"
        )

    try:
        data = resp.json()
    except json.JSONDecodeError as e:
        _railway_error(project_id, "invalid_proxy_response", str(e))
        raise ShortDramaProviderError(f"railway_ai_proxy_invalid_proxy_response: {e}") from e

    if not isinstance(data, dict):
        _railway_error(project_id, "invalid_proxy_response", "response JSON is not an object")
        raise ShortDramaProviderError("railway_ai_proxy_invalid_proxy_response: expected JSON object")

    raw_text = data.get("raw_text")
    if not isinstance(raw_text, str) or not raw_text.strip():
        _railway_error(project_id, "empty_raw_text", "raw_text missing, not a string, or empty")
        raise ShortDramaProviderError("railway_ai_proxy_empty_raw_text: missing or empty raw_text")

    raw_stripped = raw_text.strip()
    raw_len = len(raw_stripped)
    logger.info(
        "[S1_RAILWAY_PROXY_RESPONSE] project_id=%s success=true raw_length=%s",
        project_id,
        raw_len,
    )

    parsed = try_parse_json_object(raw_stripped)
    if parsed is None:
        _railway_error(
            project_id,
            "json_parse_failed",
            f"could not parse JSON from raw_text, raw_length={raw_len}",
        )
        raise ShortDramaInvalidModelOutputError(
            "railway S1 vision: model output is not valid JSON (raw_text JSON parse failed)"
        )
    if parsed.get("error") == "unrecoverable":
        _railway_error(project_id, "json_marker_unrecoverable", "model returned unrecoverable marker in JSON")
        raise ShortDramaInvalidModelOutputError("railway S1 vision: unrecoverable JSON marker in output")

    return parsed
