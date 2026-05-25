"""S4 segment video via Railway AI Proxy -> Google Gemini Veo.

Aliyun ECS must not call Google directly. This provider sends the request to the
Railway proxy, where Google API access and R2 rehosting happen.
"""

from __future__ import annotations

import logging
import threading
import time
from typing import Any

import httpx

from ..exceptions import ShortDramaVideoProviderError
from ..utils.ai_runtime_config import STAGE_S4_VIDEO_GENERATION, get_ai_runtime_config
from .gemini_veo_video_client import effective_gemini_video_model
from .railway_xai_video_proxy import (
    _is_r2_proxy_result,
    _safe_body_prefix,
    build_railway_xai_video_proxy_payload,
    download_remote_video_bytes,
    effective_railway_xai_video_proxy_base_url,
    effective_railway_xai_video_proxy_timeout_seconds,
    effective_railway_xai_video_proxy_token,
)
from .segment_video_types import SegmentVideoResult

logger = logging.getLogger(__name__)

_SYNC_RESULT_LOCK = threading.Lock()
_SYNC_RESULTS: dict[str, dict[str, Any]] = {}
_GEMINI_VEO_MIN_DURATION_SECONDS = 4
_GEMINI_VEO_MAX_DURATION_SECONDS = 8


def _gemini_veo_safe_duration_seconds(duration_seconds: int) -> int:
    try:
        duration = int(round(float(duration_seconds)))
    except (TypeError, ValueError):
        duration = 6
    return max(_GEMINI_VEO_MIN_DURATION_SECONDS, min(_GEMINI_VEO_MAX_DURATION_SECONDS, duration))


def request_railway_gemini_veo_video_generation(
    *,
    project_id: int,
    segment_id: str,
    prompt: str,
    reference_image_urls: list[str],
    duration_seconds: int,
    aspect_ratio: str,
    resolution: str | None,
    model: str,
) -> dict[str, Any]:
    """POST Railway /api/gemini/videos/generations; returns parsed JSON body."""
    base = effective_railway_xai_video_proxy_base_url()
    token = effective_railway_xai_video_proxy_token()
    if not base:
        raise ShortDramaVideoProviderError(
            "AI_PROXY_BASE_URL is required for Railway Gemini Veo video proxy "
            "(or set RAILWAY_XAI_VIDEO_PROXY_BASE_URL)"
        )
    if not token:
        raise ShortDramaVideoProviderError(
            "AI_PROXY_TOKEN is required for Railway Gemini Veo video proxy "
            "(or set RAILWAY_XAI_VIDEO_PROXY_TOKEN)"
        )

    safe_duration_seconds = _gemini_veo_safe_duration_seconds(duration_seconds)
    if safe_duration_seconds != int(duration_seconds):
        logger.info(
            "[RAILWAY_GEMINI_VEO_DURATION_NORMALIZED] project_id=%s segment_id=%s requested_duration_seconds=%s "
            "normalized_duration_seconds=%s min_seconds=%s max_seconds=%s",
            project_id,
            segment_id,
            duration_seconds,
            safe_duration_seconds,
            _GEMINI_VEO_MIN_DURATION_SECONDS,
            _GEMINI_VEO_MAX_DURATION_SECONDS,
        )

    url = f"{base}/api/gemini/videos/generations"
    payload = build_railway_xai_video_proxy_payload(
        project_id=project_id,
        segment_id=segment_id,
        prompt=prompt,
        reference_image_urls=reference_image_urls,
        duration_seconds=safe_duration_seconds,
        aspect_ratio=aspect_ratio,
        resolution=resolution,
        model=model,
        provider="gemini",
    )
    timeout_sec = effective_railway_xai_video_proxy_timeout_seconds()
    timeout = httpx.Timeout(connect=min(30.0, timeout_sec), read=timeout_sec, write=timeout_sec, pool=10.0)

    logger.info(
        "[RAILWAY_GEMINI_VEO_PROXY_REQUEST] project_id=%s segment_id=%s proxy_base_url=%s "
        "prompt_chars=%s reference_image_count=%s duration_seconds=%s aspect_ratio=%s resolution=%s model=%s "
        "timeout_seconds=%s",
        project_id,
        segment_id,
        base,
        len(prompt or ""),
        len(payload.get("reference_image_urls") or []),
        int(safe_duration_seconds),
        aspect_ratio,
        resolution or "",
        model,
        timeout_sec,
    )

    started = time.monotonic()
    try:
        with httpx.Client(timeout=timeout, http2=False, verify=True, follow_redirects=True) as client:
            resp = client.post(
                url,
                headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"},
                json=payload,
            )
    except httpx.TimeoutException as e:
        logger.error(
            "[RAILWAY_GEMINI_VEO_PROXY_FAILED] project_id=%s segment_id=%s status_code=%s "
            "error_code=%s error_message=%s request_id=%s elapsed_seconds=%.3f",
            project_id,
            segment_id,
            "timeout",
            "PROXY_TIMEOUT",
            str(e),
            "",
            time.monotonic() - started,
        )
        raise ShortDramaVideoProviderError(f"Railway Gemini Veo video proxy timeout: {e}") from e
    except httpx.RequestError as e:
        logger.error(
            "[RAILWAY_GEMINI_VEO_PROXY_FAILED] project_id=%s segment_id=%s status_code=%s "
            "error_code=%s error_message=%s request_id=%s elapsed_seconds=%.3f",
            project_id,
            segment_id,
            "network",
            "PROXY_NETWORK_ERROR",
            str(e),
            "",
            time.monotonic() - started,
        )
        raise ShortDramaVideoProviderError(f"Railway Gemini Veo video proxy network error: {e}") from e

    elapsed = time.monotonic() - started
    body_text = ""
    try:
        body_text = resp.text or ""
    except Exception:
        pass
    if resp.status_code < 200 or resp.status_code >= 300:
        logger.error(
            "[RAILWAY_GEMINI_VEO_PROXY_FAILED] project_id=%s segment_id=%s status_code=%s "
            "error_code=%s error_message=%s request_id=%s elapsed_seconds=%.3f body_prefix=%s",
            project_id,
            segment_id,
            resp.status_code,
            "PROXY_HTTP_ERROR",
            _safe_body_prefix(body_text),
            "",
            elapsed,
            _safe_body_prefix(body_text),
        )
        raise ShortDramaVideoProviderError(
            f"Railway Gemini Veo video proxy HTTP {resp.status_code} "
            f"(project_id={project_id}, segment_id={segment_id}): {_safe_body_prefix(body_text)}"
        )

    try:
        data = resp.json()
    except Exception as e:
        logger.error(
            "[RAILWAY_GEMINI_VEO_PROXY_FAILED] project_id=%s segment_id=%s status_code=%s "
            "error_code=%s error_message=%s request_id=%s elapsed_seconds=%.3f body_prefix=%s",
            project_id,
            segment_id,
            resp.status_code,
            "PROXY_NON_JSON",
            str(e),
            "",
            elapsed,
            _safe_body_prefix(body_text),
        )
        raise ShortDramaVideoProviderError(
            f"Railway Gemini Veo video proxy returned non-JSON "
            f"(project_id={project_id}, segment_id={segment_id}): {e}"
        ) from e
    if not isinstance(data, dict):
        logger.error(
            "[RAILWAY_GEMINI_VEO_PROXY_FAILED] project_id=%s segment_id=%s status_code=%s "
            "error_code=%s error_message=%s request_id=%s elapsed_seconds=%.3f body_prefix=%s",
            project_id,
            segment_id,
            resp.status_code,
            "PROXY_INVALID_JSON_TYPE",
            type(data).__name__,
            "",
            elapsed,
            _safe_body_prefix(body_text),
        )
        raise ShortDramaVideoProviderError(
            f"Railway Gemini Veo video proxy invalid response type "
            f"(project_id={project_id}, segment_id={segment_id})"
        )

    request_id = str(data.get("request_id") or "")
    video_url = (data.get("video_url") or "").strip() if isinstance(data.get("video_url"), str) else ""
    gemini_video_uri = (
        str(data.get("gemini_video_uri") or "").strip()
        if isinstance(data.get("gemini_video_uri"), str)
        else ""
    )
    operation_name = (
        str(data.get("operation_name") or data.get("operation") or "").strip()
        if isinstance(data.get("operation_name") or data.get("operation"), str)
        else ""
    )
    logger.info(
        "[RAILWAY_GEMINI_VEO_PROXY_RESPONSE] project_id=%s segment_id=%s ok=%s provider=%s model=%s "
        "request_id=%s has_video_url=%s storage=%s r2_key=%s has_gemini_video_uri=%s "
        "operation_name=%s elapsed_seconds=%.3f body_chars=%s",
        project_id,
        segment_id,
        bool(data.get("ok")),
        data.get("provider"),
        data.get("model"),
        request_id,
        bool(video_url),
        data.get("storage"),
        data.get("r2_key"),
        bool(gemini_video_uri),
        operation_name,
        elapsed,
        len(body_text),
    )

    if not bool(data.get("ok")):
        error_code = str(data.get("error_code") or "GEMINI_VEO_VIDEO_GENERATION_FAILED")
        error_message = str(data.get("error_message") or "Railway Gemini Veo proxy reported failure")
        logger.error(
            "[RAILWAY_GEMINI_VEO_PROXY_FAILED] project_id=%s segment_id=%s status_code=%s "
            "error_code=%s error_message=%s request_id=%s elapsed_seconds=%.3f body_prefix=%s",
            project_id,
            segment_id,
            resp.status_code,
            error_code,
            error_message,
            request_id,
            elapsed,
            _safe_body_prefix(body_text),
        )
        raise ShortDramaVideoProviderError(
            f"Railway Gemini Veo video proxy failed ({error_code}): {error_message} "
            f"(project_id={project_id}, segment_id={segment_id}, request_id={request_id})"
        )
    if not video_url:
        logger.error(
            "[RAILWAY_GEMINI_VEO_PROXY_FAILED] project_id=%s segment_id=%s status_code=%s "
            "error_code=%s error_message=%s request_id=%s elapsed_seconds=%.3f body_prefix=%s",
            project_id,
            segment_id,
            resp.status_code,
            "PROXY_MISSING_VIDEO_URL",
            "Railway Gemini Veo proxy ok=true but video_url missing",
            request_id,
            elapsed,
            _safe_body_prefix(body_text),
        )
        raise ShortDramaVideoProviderError(
            f"Railway Gemini Veo video proxy ok=true but video_url missing "
            f"(project_id={project_id}, segment_id={segment_id}, request_id={request_id})"
        )
    return data


class RailwayGeminiVeoVideoProxyProvider:
    """Calls Railway proxy once; complete uses the R2 URL returned by Railway."""

    def submit_reference_segment_video(
        self,
        *,
        prompt: str,
        reference_image_urls: list[str],
        duration_seconds: int,
        aspect_ratio: str,
        resolution: str | None,
        project_id: int,
        segment_id: str,
    ) -> str:
        ai_cfg = get_ai_runtime_config(STAGE_S4_VIDEO_GENERATION)
        model = (ai_cfg.model_id or "").strip() or effective_gemini_video_model()
        data = request_railway_gemini_veo_video_generation(
            project_id=project_id,
            segment_id=segment_id,
            prompt=prompt,
            reference_image_urls=reference_image_urls,
            duration_seconds=duration_seconds,
            aspect_ratio=aspect_ratio,
            resolution=resolution,
            model=model,
        )
        request_id = str(data.get("request_id") or f"railway-gemini-{project_id}-{segment_id}")
        with _SYNC_RESULT_LOCK:
            _SYNC_RESULTS[request_id] = data
        return request_id

    def complete_segment_video(
        self,
        *,
        request_id: str,
        project_id: int,
        segment_id: str,
        duration_seconds: int = 6,
    ) -> SegmentVideoResult:
        _ = duration_seconds
        with _SYNC_RESULT_LOCK:
            data = _SYNC_RESULTS.pop(request_id, None)
        if not data:
            raise ShortDramaVideoProviderError(
                f"Railway Gemini Veo video proxy missing cached result for request_id={request_id!r}"
            )
        video_url = str(data.get("video_url") or "").strip()
        model = str(data.get("model") or effective_gemini_video_model())
        meta: dict[str, Any] = {
            "provider": "railway_gemini_veo_proxy",
            "model": model,
            "request_id": request_id,
            "upstream_provider": data.get("provider"),
            "duration_seconds": data.get("duration_seconds"),
            "storage": str(data.get("storage") or "").strip(),
            "r2_key": str(data.get("r2_key") or "").strip(),
        }
        gemini_video_uri = data.get("gemini_video_uri")
        if isinstance(gemini_video_uri, str) and gemini_video_uri.strip():
            meta["gemini_video_uri"] = gemini_video_uri.strip()

        if _is_r2_proxy_result(data):
            return SegmentVideoResult(
                video_bytes=b"",
                provider_video_url=video_url,
                provider_metadata=meta,
            )

        video_bytes = download_remote_video_bytes(
            video_url=video_url,
            project_id=project_id,
            segment_id=segment_id,
            request_id=request_id,
        )
        return SegmentVideoResult(
            video_bytes=video_bytes,
            provider_video_url=video_url,
            provider_metadata=meta,
        )

    def generate_segment_video(
        self,
        *,
        prompt: str,
        reference_image_urls: list[str],
        duration_seconds: int,
        aspect_ratio: str,
        resolution: str | None,
        project_id: int,
        segment_id: str,
    ) -> SegmentVideoResult:
        rid = self.submit_reference_segment_video(
            prompt=prompt,
            reference_image_urls=reference_image_urls,
            duration_seconds=duration_seconds,
            aspect_ratio=aspect_ratio,
            resolution=resolution,
            project_id=project_id,
            segment_id=segment_id,
        )
        return self.complete_segment_video(
            request_id=rid,
            project_id=project_id,
            segment_id=segment_id,
            duration_seconds=duration_seconds,
        )
