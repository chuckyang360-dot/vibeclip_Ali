"""S1-only product image understanding via GeoQ OpenAI-compatible API (optional, env-gated)."""

from __future__ import annotations

import json
import logging
from typing import Any

import httpx

from ...config import settings
from ..exceptions import ShortDramaInvalidModelOutputError, ShortDramaProviderError
from ..utils.json_parser import try_parse_json_object

logger = logging.getLogger(__name__)


def s1_vision_wants_geoq() -> bool:
    return (settings.S1_VISION_PROVIDER or "").strip().lower() == "geoq"


def classify_s1_image_input_type_for_log(image_urls: list[str]) -> str:
    if not image_urls:
        return "none"
    kinds: set[str] = set()
    for u in image_urls:
        s = str(u or "").strip()
        if not s:
            continue
        if s.startswith("data:image/"):
            kinds.add("base64")
        elif s.startswith("http://") or s.startswith("https://"):
            kinds.add("url")
        else:
            kinds.add("other")
    if not kinds:
        return "none"
    if len(kinds) == 1:
        return next(iter(kinds))
    return "mixed"


def _effective_geoq_base_url() -> str:
    return (settings.GEOQ_BASE_URL or "").strip().rstrip("/")


def _geoq_error(project_id: int, error_type: str, message: str) -> None:
    logger.error("[S1_GEOQ_VISION_ERROR] project_id=%s error_type=%s message=%s", project_id, error_type, message)


def _extract_chat_completion_text(data: dict[str, Any]) -> str:
    choices = data.get("choices")
    if not isinstance(choices, list) or not choices:
        raise ShortDramaProviderError("geoq_empty_choices: API returned no choices")
    msg = choices[0].get("message") if isinstance(choices[0], dict) else None
    if not isinstance(msg, dict):
        raise ShortDramaProviderError("geoq_invalid_message_shape: choices[0].message missing")
    content = msg.get("content")
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        parts: list[str] = []
        for p in content:
            if isinstance(p, dict) and p.get("type") == "text":
                parts.append(str(p.get("text") or ""))
        return "".join(parts).strip()
    if content is None:
        return ""
    return str(content).strip()


def _map_http_status_to_error_type(status_code: int, body_snippet: str) -> str:
    low = body_snippet.lower()
    if status_code == 401:
        return "auth_failed"
    if status_code == 403:
        return "auth_failed"
    if status_code == 404:
        if "model" in low or "model_not_found" in low:
            return "model_not_found"
        return "not_found"
    if status_code == 400:
        if "image" in low or "vision" in low or "content" in low or "multipart" in low:
            return "image_input_invalid"
        return "bad_request"
    if status_code == 408:
        return "timeout"
    if status_code == 429:
        return "quota_or_rate_limit"
    if status_code >= 500:
        return "geoq_upstream_error"
    if status_code == 422:
        return "model_unsupported_or_invalid_payload"
    return f"http_{status_code}"


def generate_product_image_understanding_json(
    *,
    project_id: int,
    system_prompt: str,
    user_payload: dict[str, Any],
    image_urls: list[str],
) -> dict[str, Any]:
    """Call GeoQ chat/completions with vision + text; return parsed ProductImageUnderstanding JSON dict."""
    base = _effective_geoq_base_url()
    model = (settings.GEOQ_S1_VISION_MODEL or "gpt-image-2").strip()
    api_key = (settings.GEOQ_API_KEY or "").strip()
    timeout_sec = max(5, int(settings.GEOQ_TIMEOUT_SECONDS or 120))

    logger.info(
        "[S1_VISION_PROVIDER] provider=geoq model=%s base_url=%s",
        model,
        base,
    )

    if not api_key:
        _geoq_error(project_id, "missing_api_key", "GEOQ_API_KEY is not set")
        raise ShortDramaProviderError(
            "GEOQ_API_KEY is not configured (S1_VISION_PROVIDER=geoq requires GEOQ_API_KEY)"
        )

    if not base:
        _geoq_error(project_id, "missing_base_url", "GEOQ_BASE_URL is empty")
        raise ShortDramaProviderError("GEOQ_BASE_URL is not configured")

    has_image = bool(image_urls)
    image_input_type = classify_s1_image_input_type_for_log(image_urls)
    logger.info(
        "[S1_GEOQ_VISION_REQUEST] project_id=%s has_image=%s image_input_type=%s image_count=%s",
        project_id,
        has_image,
        image_input_type,
        len(image_urls),
    )

    user_text = json.dumps(user_payload, ensure_ascii=False)
    user_content: list[dict[str, Any]] = []
    for u in image_urls:
        url = str(u or "").strip()
        if not url:
            continue
        user_content.append({"type": "image_url", "image_url": {"url": url}})
    user_content.append({"type": "text", "text": user_text})

    url = f"{base}/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    body = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
        "max_tokens": 8192,
    }

    timeout = httpx.Timeout(timeout_sec, connect=min(30.0, float(timeout_sec)))
    try:
        with httpx.Client(timeout=timeout) as client:
            resp = client.post(url, headers=headers, json=body)
    except httpx.TimeoutException as e:
        _geoq_error(project_id, "timeout", str(e))
        raise ShortDramaProviderError(f"geoq_request_timeout: {e}") from e
    except httpx.ConnectError as e:
        _geoq_error(project_id, "network_connect_error", str(e))
        raise ShortDramaProviderError(f"geoq_network_connect_error: {e}") from e
    except httpx.HTTPError as e:
        _geoq_error(project_id, "network_error", str(e))
        raise ShortDramaProviderError(f"geoq_network_error: {e}") from e

    body_text = (resp.text or "")[:1500]
    if resp.status_code != 200:
        err_type = _map_http_status_to_error_type(resp.status_code, body_text)
        _geoq_error(project_id, err_type, f"HTTP {resp.status_code}: {body_text}")
        raise ShortDramaProviderError(
            f"geoq_http_{resp.status_code} ({err_type}): {body_text or resp.reason_phrase}"
        )

    try:
        data = resp.json()
    except json.JSONDecodeError as e:
        _geoq_error(project_id, "invalid_response_json", str(e))
        raise ShortDramaProviderError(f"geoq_invalid_response_json: {e}") from e

    try:
        assistant_text = _extract_chat_completion_text(data)
    except ShortDramaProviderError as e:
        _geoq_error(project_id, "invalid_response_shape", str(e))
        raise

    raw_len = len(assistant_text or "")
    logger.info(
        "[S1_GEOQ_VISION_RESPONSE] project_id=%s success=true raw_length=%s",
        project_id,
        raw_len,
    )

    if not assistant_text or len(assistant_text.strip()) < 20:
        _geoq_error(project_id, "empty_model_output", f"assistant_len={raw_len}")
        raise ShortDramaInvalidModelOutputError("geoq S1 vision: empty or too short model output")

    parsed = try_parse_json_object(assistant_text)
    if parsed is None:
        _geoq_error(
            project_id,
            "json_parse_failed",
            f"could not parse JSON from model output, raw_length={raw_len}",
        )
        raise ShortDramaInvalidModelOutputError(
            "geoq S1 vision: model output is not valid JSON (no Grok repair for GeoQ path)"
        )
    if parsed.get("error") == "unrecoverable":
        _geoq_error(project_id, "json_marker_unrecoverable", "model returned unrecoverable marker in JSON")
        raise ShortDramaInvalidModelOutputError("geoq S1 vision: unrecoverable JSON marker in output")

    return parsed
