from __future__ import annotations

import json
import logging
import os
from typing import Any

import httpx

from ...config import settings
from ..exceptions import ShortDramaInvalidModelOutputError, ShortDramaProviderError
from ..utils.json_parser import try_parse_json_object
from .railway_s1_vision import _effective_proxy_base_url, _trunc_log_message

logger = logging.getLogger(__name__)


def analyze_reference_video_via_railway_proxy(
    *,
    video_id: int,
    video_url: str,
    mime_type: str,
    system_prompt: str,
    user_payload: dict[str, Any],
    provider: str | None = None,
    model: str | None = None,
) -> dict[str, Any]:
    base = _effective_proxy_base_url()
    token = (settings.AI_PROXY_TOKEN or "").strip()
    timeout_sec = max(30, int(settings.AI_PROXY_TIMEOUT_SECONDS or 120))
    if not base:
        raise ShortDramaProviderError("AI_PROXY_BASE_URL is required for video understanding")
    if not token:
        raise ShortDramaProviderError("AI_PROXY_TOKEN is required for video understanding")

    explicit_path = (os.getenv("RAILWAY_VIDEO_UNDERSTANDING_PATH") or "").strip()
    proxy_paths = [explicit_path] if explicit_path else [
        "/video/understanding",
        "/api/gemini/video-understanding",
        "/api/gemini/videos/understanding",
        "/api/video/understanding",
    ]
    proxy_paths = [p if p.startswith("/") else f"/{p}" for p in proxy_paths if p]
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    body = {
        "video_url": video_url,
        "mime_type": mime_type,
        "system_prompt": system_prompt,
        "user_payload": user_payload,
        "service_name": "reference_video_understanding",
    }
    if provider:
        body["provider"] = str(provider).strip()
    if model:
        body["model"] = str(model).strip()
    payload_chars = len(json.dumps(user_payload, ensure_ascii=False, default=str))

    timeout = httpx.Timeout(timeout_sec, connect=min(30.0, float(timeout_sec)))
    last_status = ""
    last_snippet = ""
    try:
        with httpx.Client(timeout=timeout, follow_redirects=True) as client:
            for proxy_path in proxy_paths:
                url = f"{base}{proxy_path}"
                logger.info(
                    "[RAILWAY_VIDEO_UNDERSTANDING_REQUEST] video_id=%s proxy_base_url=%s proxy_path=%s "
                    "mime_type=%s provider=%s model=%s payload_chars=%s",
                    video_id,
                    base,
                    proxy_path,
                    mime_type,
                    provider or "",
                    model or "",
                    payload_chars,
                )
                resp = client.post(url, headers=headers, json=body)
                snippet = _trunc_log_message(resp.text or "", 1500)
                if resp.status_code in (404, 405) and not explicit_path:
                    logger.warning(
                        "[RAILWAY_VIDEO_UNDERSTANDING_PATH_MISS] video_id=%s proxy_path=%s status_code=%s body=%s",
                        video_id,
                        proxy_path,
                        resp.status_code,
                        snippet,
                    )
                    last_status = str(resp.status_code)
                    last_snippet = snippet
                    continue
                break
            else:
                raise ShortDramaProviderError(
                    f"railway_video_understanding_no_supported_path: last_http_{last_status}: {last_snippet}"
                )
    except httpx.TimeoutException as e:
        raise ShortDramaProviderError(f"railway_video_understanding_timeout: {e}") from e
    except httpx.HTTPError as e:
        raise ShortDramaProviderError(f"railway_video_understanding_network_error: {e}") from e

    snippet = _trunc_log_message(resp.text or "", 1500)
    if resp.status_code < 200 or resp.status_code >= 300:
        raise ShortDramaProviderError(
            f"railway_video_understanding_http_{resp.status_code}: {snippet or resp.reason_phrase}"
        )

    try:
        data = resp.json()
    except json.JSONDecodeError as e:
        raise ShortDramaProviderError(f"railway_video_understanding_invalid_json: {e}") from e
    if not isinstance(data, dict):
        raise ShortDramaProviderError("railway_video_understanding_invalid_response: expected object")

    if isinstance(data.get("analysis_json"), dict):
        return data["analysis_json"]
    if isinstance(data.get("result"), dict):
        return data["result"]
    raw_text = data.get("raw_text")
    if isinstance(raw_text, str) and raw_text.strip():
        parsed = try_parse_json_object(raw_text.strip())
        if parsed is not None:
            return parsed
    raise ShortDramaInvalidModelOutputError("video understanding proxy response did not contain analysis JSON")
