"""Text / structured-json turns via Railway AI Proxy when AI_PROVIDER=railway_proxy (no ECS→xAI)."""

from __future__ import annotations

import json
import logging
from typing import Any

import httpx

from ...config import settings
from ..exceptions import ShortDramaProviderError
from .railway_s1_vision import _effective_proxy_base_url, _proxy_detail_upstream_error

logger = logging.getLogger(__name__)

_STORY_LONG_TIMEOUT_STAGES = frozenset({"STORY_GENERATION", "STORY_GENERATION_REPAIR"})
_STORY_LONG_TIMEOUT_SERVICES = frozenset({"story_planner", "story_planner_repair"})


def effective_railway_text_proxy_timeout_seconds(
    *,
    service_name: str = "",
    stage: str = "",
) -> int:
    """Per-stage Railway text proxy read timeout; story generation uses a longer budget."""
    stage_key = (stage or "").strip().upper()
    svc_key = (service_name or "").strip().lower()
    if (
        stage_key in _STORY_LONG_TIMEOUT_STAGES
        or stage_key.startswith("STORY_GENERATION")
        or svc_key in _STORY_LONG_TIMEOUT_SERVICES
    ):
        raw = settings.STORY_GENERATION_PROXY_TIMEOUT_SECONDS
        if raw is not None and int(raw) > 0:
            return max(5, int(raw))
        return max(5, int(settings.SHORT_DRAMA_XAI_TEXT_TIMEOUT_SECONDS or 180))
    return max(5, int(settings.AI_PROXY_TIMEOUT_SECONDS or 120))


def _trunc_log_message(message: str, max_len: int = 500) -> str:
    t = (message or "").strip().replace("\n", " ")
    if len(t) <= max_len:
        return t
    return t[: max_len - 3] + "..."


def _text_proxy_error(
    project_id: int,
    error_type: str,
    message: str,
    *,
    timeout_seconds: int | None = None,
    service_name: str = "",
    stage: str = "",
) -> None:
    logger.error(
        "[RAILWAY_PROXY_TEXT_ERROR] project_id=%s error_type=%s message=%s "
        "timeout_seconds=%s service_name=%s stage=%s",
        project_id,
        error_type,
        _trunc_log_message(message),
        timeout_seconds if timeout_seconds is not None else "",
        service_name or "",
        stage or "",
    )


def railway_chat_completion_raw_text(
    *,
    project_id: int,
    service_name: str,
    stage: str,
    system_prompt: str,
    user_text: str,
    image_urls: list[str] | None,
    max_output_tokens: int,
    provider: str | None = None,
    model: str | None = None,
) -> str:
    base = _effective_proxy_base_url()
    token = (settings.AI_PROXY_TOKEN or "").strip()
    timeout_sec = effective_railway_text_proxy_timeout_seconds(
        service_name=service_name,
        stage=stage,
    )

    if not base:
        _text_proxy_error(
            project_id,
            "missing_proxy_base_url",
            "AI_PROXY_BASE_URL is not set",
            timeout_seconds=timeout_sec,
            service_name=service_name,
            stage=stage,
        )
        raise ShortDramaProviderError(
            "AI_PROXY_BASE_URL is not configured (AI_PROVIDER=railway_proxy requires AI_PROXY_BASE_URL)"
        )

    if not token:
        _text_proxy_error(
            project_id,
            "missing_proxy_token",
            "AI_PROXY_TOKEN is not set",
            timeout_seconds=timeout_sec,
            service_name=service_name,
            stage=stage,
        )
        raise ShortDramaProviderError(
            "AI_PROXY_TOKEN is not configured (AI_PROVIDER=railway_proxy requires AI_PROXY_TOKEN)"
        )

    urls = [str(u).strip() for u in (image_urls or []) if str(u or "").strip()]
    logger.info(
        "[RAILWAY_PROXY_TEXT_REQUEST] project_id=%s service_name=%s stage=%s image_count=%s "
        "user_text_chars=%s proxy_base_url=%s max_output_tokens=%s timeout_seconds=%s",
        project_id,
        service_name,
        stage,
        len(urls),
        len(user_text or ""),
        base,
        max_output_tokens,
        timeout_sec,
    )

    url = f"{base}/text/completions"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    body: dict[str, Any] = {
        "system_prompt": system_prompt,
        "user_text": user_text,
        "image_urls": urls,
        "max_tokens": max(1, int(max_output_tokens)),
        "temperature": 0.2,
        "service_name": service_name,
    }
    if provider:
        body["provider"] = str(provider).strip()
    if model:
        body["model"] = str(model).strip()

    timeout = httpx.Timeout(timeout_sec, connect=min(30.0, float(timeout_sec)))
    try:
        with httpx.Client(timeout=timeout) as client:
            resp = client.post(url, headers=headers, json=body)
    except httpx.TimeoutException as e:
        _text_proxy_error(
            project_id,
            "timeout",
            str(e),
            timeout_seconds=timeout_sec,
            service_name=service_name,
            stage=stage,
        )
        raise ShortDramaProviderError(f"railway_ai_proxy_text_timeout: {e}") from e
    except httpx.ConnectError as e:
        _text_proxy_error(
            project_id,
            "network_error",
            str(e),
            timeout_seconds=timeout_sec,
            service_name=service_name,
            stage=stage,
        )
        raise ShortDramaProviderError(f"railway_ai_proxy_text_network_error: {e}") from e
    except httpx.HTTPError as e:
        _text_proxy_error(
            project_id,
            "network_error",
            str(e),
            timeout_seconds=timeout_sec,
            service_name=service_name,
            stage=stage,
        )
        raise ShortDramaProviderError(f"railway_ai_proxy_text_network_error: {e}") from e

    snippet = _trunc_log_message((resp.text or ""), 1500)

    if resp.status_code in (401, 403):
        _text_proxy_error(project_id, "auth_failed", f"HTTP {resp.status_code}: {snippet}")
        raise ShortDramaProviderError(
            f"railway_ai_proxy_text_auth_failed ({resp.status_code}): {snippet or resp.reason_phrase}"
        )

    if resp.status_code == 504:
        _text_proxy_error(
            project_id,
            "timeout",
            f"HTTP 504: {snippet}",
            timeout_seconds=timeout_sec,
            service_name=service_name,
            stage=stage,
        )
        raise ShortDramaProviderError(f"railway_ai_proxy_text_timeout: {snippet or resp.reason_phrase}")

    if resp.status_code == 502:
        try:
            jb = resp.json()
        except json.JSONDecodeError:
            jb = None
        if _proxy_detail_upstream_error(jb):
            _text_proxy_error(project_id, "proxy_upstream_error", f"HTTP 502: {snippet}")
            raise ShortDramaProviderError(f"railway_ai_proxy_text_upstream_error: {snippet or resp.reason_phrase}")
        _text_proxy_error(project_id, "bad_gateway", f"HTTP 502: {snippet}")
        raise ShortDramaProviderError(f"railway_ai_proxy_text_http_502: {snippet or resp.reason_phrase}")

    if resp.status_code != 200:
        _text_proxy_error(project_id, "http_error", f"HTTP {resp.status_code}: {snippet}")
        raise ShortDramaProviderError(
            f"railway_ai_proxy_text_http_{resp.status_code}: {snippet or resp.reason_phrase}"
        )

    try:
        data = resp.json()
    except json.JSONDecodeError as e:
        _text_proxy_error(project_id, "invalid_proxy_response", str(e))
        raise ShortDramaProviderError(f"railway_ai_proxy_text_invalid_proxy_response: {e}") from e

    if not isinstance(data, dict):
        _text_proxy_error(project_id, "invalid_proxy_response", "response JSON is not an object")
        raise ShortDramaProviderError("railway_ai_proxy_text_invalid_proxy_response: expected JSON object")

    raw_text = data.get("raw_text")
    if not isinstance(raw_text, str) or not raw_text.strip():
        _text_proxy_error(project_id, "empty_raw_text", "raw_text missing, not a string, or empty")
        raise ShortDramaProviderError("railway_ai_proxy_text_empty_raw_text: missing or empty raw_text")

    out = raw_text.strip()
    logger.info(
        "[RAILWAY_PROXY_TEXT_RESPONSE] project_id=%s service_name=%s stage=%s success=true raw_length=%s",
        project_id,
        service_name,
        stage,
        len(out),
    )
    return out
