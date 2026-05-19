"""S5 segment video via Railway AI Proxy → xAI (no direct api.x.ai from Aliyun backend)."""

from __future__ import annotations

import logging
import threading
from typing import Any
from urllib.parse import urlparse

import httpx

from ...config import settings
from ..exceptions import ShortDramaVideoProviderError
from .railway_s1_vision import _effective_proxy_base_url
from .segment_video_types import SegmentVideoResult
from .xai_video_client import effective_xai_video_model

logger = logging.getLogger(__name__)

_SYNC_RESULT_LOCK = threading.Lock()
_SYNC_RESULTS: dict[str, dict[str, Any]] = {}


def effective_railway_xai_video_proxy_base_url() -> str:
    explicit = (settings.RAILWAY_XAI_VIDEO_PROXY_BASE_URL or "").strip().rstrip("/")
    if explicit:
        return explicit
    return _effective_proxy_base_url()


def effective_railway_xai_video_proxy_token() -> str:
    return (settings.RAILWAY_XAI_VIDEO_PROXY_TOKEN or settings.AI_PROXY_TOKEN or "").strip()


def effective_railway_xai_video_proxy_timeout_seconds() -> float:
    raw = settings.RAILWAY_XAI_VIDEO_PROXY_TIMEOUT_SECONDS
    if raw is not None and float(raw) > 0:
        return float(raw)
    return max(30.0, float(settings.AI_PROXY_TIMEOUT_SECONDS or 120))


def build_railway_xai_video_proxy_payload(
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
    body: dict[str, Any] = {
        "project_id": project_id,
        "segment_id": segment_id,
        "prompt": prompt,
        "reference_image_urls": [u for u in (reference_image_urls or []) if (u or "").strip()],
        "duration_seconds": int(duration_seconds),
        "aspect_ratio": aspect_ratio,
        "model": model,
        "metadata": {
            "service_name": "segment_video_generation",
            "stage": "S5_VIDEO_GENERATION",
        },
    }
    if resolution:
        body["resolution"] = resolution
    return body


def _video_url_host(url: str) -> str:
    try:
        return (urlparse((url or "").strip()).hostname or "").lower()
    except Exception:
        return ""


def _ensure_not_vidgen_video_url(
    video_url: str,
    *,
    project_id: int,
    segment_id: str,
    request_id: str,
) -> None:
    host = _video_url_host(video_url)
    if host == "vidgen.x.ai" or host.endswith(".vidgen.x.ai"):
        logger.error(
            "[RAILWAY_XAI_VIDEO_PROXY_FAILED] project_id=%s segment_id=%s status_code=%s "
            "error_code=%s error_message=%s request_id=%s",
            project_id,
            segment_id,
            200,
            "RAW_XAI_VIDEO_URL",
            "Railway returned raw xAI video URL; expected R2 URL.",
            request_id,
        )
        raise ShortDramaVideoProviderError("Railway returned raw xAI video URL; expected R2 URL.")


def _is_r2_proxy_result(data: dict[str, Any]) -> bool:
    storage = str(data.get("storage") or "").strip().lower()
    video_url = (data.get("video_url") or "").strip() if isinstance(data.get("video_url"), str) else ""
    return storage == "r2" and bool(video_url)


def _safe_body_prefix(text: str, *, limit: int = 1000) -> str:
    s = text or ""
    if len(s) > limit:
        return s[:limit] + "…"
    return s


def request_railway_xai_video_generation(
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
    """POST Railway /api/xai/videos/generations; returns parsed JSON body."""
    base = effective_railway_xai_video_proxy_base_url()
    token = effective_railway_xai_video_proxy_token()
    if not base:
        raise ShortDramaVideoProviderError(
            "RAILWAY_XAI_VIDEO_PROXY_BASE_URL is not configured "
            "(or set AI_PROXY_BASE_URL as fallback)"
        )
    if not token:
        raise ShortDramaVideoProviderError(
            "RAILWAY_XAI_VIDEO_PROXY_TOKEN is not configured (or set AI_PROXY_TOKEN as fallback)"
        )

    url = f"{base}/api/xai/videos/generations"
    payload = build_railway_xai_video_proxy_payload(
        project_id=project_id,
        segment_id=segment_id,
        prompt=prompt,
        reference_image_urls=reference_image_urls,
        duration_seconds=duration_seconds,
        aspect_ratio=aspect_ratio,
        resolution=resolution,
        model=model,
    )
    timeout_sec = effective_railway_xai_video_proxy_timeout_seconds()
    timeout = httpx.Timeout(connect=min(30.0, timeout_sec), read=timeout_sec, write=timeout_sec, pool=10.0)

    logger.info(
        "[RAILWAY_XAI_VIDEO_PROXY_REQUEST] project_id=%s segment_id=%s proxy_base_url=%s "
        "prompt_chars=%s reference_image_count=%s duration_seconds=%s aspect_ratio=%s resolution=%s model=%s",
        project_id,
        segment_id,
        base,
        len(prompt or ""),
        len(payload.get("reference_image_urls") or []),
        int(duration_seconds),
        aspect_ratio,
        resolution or "",
        model,
    )

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}",
    }
    try:
        with httpx.Client(timeout=timeout, http2=False, verify=True, follow_redirects=True) as client:
            resp = client.post(url, headers=headers, json=payload)
    except httpx.TimeoutException as e:
        logger.error(
            "[RAILWAY_XAI_VIDEO_PROXY_FAILED] project_id=%s segment_id=%s status_code=%s "
            "error_code=%s error_message=%s request_id=%s",
            project_id,
            segment_id,
            "timeout",
            "PROXY_TIMEOUT",
            str(e),
            "",
        )
        raise ShortDramaVideoProviderError(f"Railway xAI video proxy timeout: {e}") from e
    except httpx.RequestError as e:
        logger.error(
            "[RAILWAY_XAI_VIDEO_PROXY_FAILED] project_id=%s segment_id=%s status_code=%s "
            "error_code=%s error_message=%s request_id=%s",
            project_id,
            segment_id,
            "network",
            "PROXY_NETWORK_ERROR",
            str(e),
            "",
        )
        raise ShortDramaVideoProviderError(f"Railway xAI video proxy network error: {e}") from e

    body_text = ""
    try:
        body_text = resp.text or ""
    except Exception:
        pass

    if resp.status_code < 200 or resp.status_code >= 300:
        logger.error(
            "[RAILWAY_XAI_VIDEO_PROXY_FAILED] project_id=%s segment_id=%s status_code=%s "
            "error_code=%s error_message=%s request_id=%s body_prefix=%s",
            project_id,
            segment_id,
            resp.status_code,
            "PROXY_HTTP_ERROR",
            _safe_body_prefix(body_text),
            "",
            _safe_body_prefix(body_text),
        )
        raise ShortDramaVideoProviderError(
            f"Railway xAI video proxy HTTP {resp.status_code} (project_id={project_id}, segment_id={segment_id}): "
            f"{_safe_body_prefix(body_text)}"
        )

    try:
        data = resp.json()
    except Exception as e:
        raise ShortDramaVideoProviderError(
            f"Railway xAI video proxy returned non-JSON (project_id={project_id}, segment_id={segment_id}): {e}"
        ) from e

    if not isinstance(data, dict):
        raise ShortDramaVideoProviderError(
            f"Railway xAI video proxy invalid response type (project_id={project_id}, segment_id={segment_id})"
        )

    ok = bool(data.get("ok"))
    request_id = str(data.get("request_id") or "")
    video_url = (data.get("video_url") or "").strip() if isinstance(data.get("video_url"), str) else ""
    storage = str(data.get("storage") or "").strip()
    r2_key = str(data.get("r2_key") or "").strip()
    xai_video_url_raw = data.get("xai_video_url")
    has_xai_video_url = bool(
        isinstance(xai_video_url_raw, str) and (xai_video_url_raw or "").strip()
    )
    logger.info(
        "[RAILWAY_XAI_VIDEO_PROXY_RESPONSE] project_id=%s segment_id=%s ok=%s provider=%s model=%s "
        "request_id=%s has_video_url=%s storage=%s r2_key=%s has_xai_video_url=%s",
        project_id,
        segment_id,
        ok,
        data.get("provider"),
        data.get("model"),
        request_id,
        bool(video_url),
        storage,
        r2_key,
        has_xai_video_url,
    )

    if not ok:
        error_code = str(data.get("error_code") or "XAI_VIDEO_GENERATION_FAILED")
        error_message = str(data.get("error_message") or "Railway xAI video proxy reported failure")
        logger.error(
            "[RAILWAY_XAI_VIDEO_PROXY_FAILED] project_id=%s segment_id=%s status_code=%s "
            "error_code=%s error_message=%s request_id=%s",
            project_id,
            segment_id,
            200,
            error_code,
            error_message,
            request_id,
        )
        raise ShortDramaVideoProviderError(
            f"Railway xAI video proxy failed ({error_code}): {error_message} "
            f"(project_id={project_id}, segment_id={segment_id}, request_id={request_id})"
        )

    if not video_url:
        raise ShortDramaVideoProviderError(
            f"Railway xAI video proxy ok=true but video_url missing "
            f"(project_id={project_id}, segment_id={segment_id}, request_id={request_id})"
        )

    _ensure_not_vidgen_video_url(
        video_url,
        project_id=project_id,
        segment_id=segment_id,
        request_id=request_id,
    )

    return data


def download_remote_video_bytes(
    *,
    video_url: str,
    project_id: int,
    segment_id: str,
    request_id: str = "",
) -> bytes:
    timeout_sec = effective_railway_xai_video_proxy_timeout_seconds()
    timeout = httpx.Timeout(connect=min(30.0, timeout_sec), read=timeout_sec, write=timeout_sec, pool=10.0)
    logger.info(
        "[RAILWAY_XAI_VIDEO_DOWNLOAD_START] project_id=%s segment_id=%s request_id=%s video_url=%s",
        project_id,
        segment_id,
        request_id,
        video_url,
    )
    try:
        with httpx.Client(timeout=timeout, http2=False, verify=True, follow_redirects=True) as client:
            resp = client.get(video_url)
    except httpx.TimeoutException as e:
        raise ShortDramaVideoProviderError(f"Video download timeout: {e}") from e
    except httpx.RequestError as e:
        raise ShortDramaVideoProviderError(f"Video download network error: {e}") from e
    if resp.status_code >= 400:
        raise ShortDramaVideoProviderError(
            f"Video download HTTP {resp.status_code} (project_id={project_id}, segment_id={segment_id})"
        )
    data = resp.content
    logger.info(
        "[RAILWAY_XAI_VIDEO_DOWNLOAD_SUCCESS] project_id=%s segment_id=%s request_id=%s bytes_size=%s",
        project_id,
        segment_id,
        request_id,
        len(data),
    )
    return data


class RailwayXAIVideoProxyProvider:
    """Calls Railway proxy once on submit; complete uses R2 URL directly or downloads legacy responses."""

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
        model = effective_xai_video_model()
        try:
            data = request_railway_xai_video_generation(
                project_id=project_id,
                segment_id=segment_id,
                prompt=prompt,
                reference_image_urls=reference_image_urls,
                duration_seconds=duration_seconds,
                aspect_ratio=aspect_ratio,
                resolution=resolution,
                model=model,
            )
        except ShortDramaVideoProviderError:
            raise
        except Exception as e:
            raise ShortDramaVideoProviderError(f"Railway xAI video proxy submit failed: {e}") from e

        request_id = str(data.get("request_id") or f"railway-{project_id}-{segment_id}")
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
                f"Railway xAI video proxy missing cached result for request_id={request_id!r}"
            )
        video_url = str(data.get("video_url") or "").strip()
        model = str(data.get("model") or effective_xai_video_model())
        _ensure_not_vidgen_video_url(
            video_url,
            project_id=project_id,
            segment_id=segment_id,
            request_id=request_id,
        )

        storage = str(data.get("storage") or "").strip()
        r2_key = str(data.get("r2_key") or "").strip()
        xai_video_url = (
            str(data.get("xai_video_url") or "").strip()
            if isinstance(data.get("xai_video_url"), str)
            else ""
        )
        if xai_video_url:
            logger.info(
                "[RAILWAY_XAI_VIDEO_PROXY_XAI_URL] project_id=%s segment_id=%s request_id=%s "
                "xai_video_url=%s (diagnostic only, not downloaded)",
                project_id,
                segment_id,
                request_id,
                xai_video_url,
            )

        meta: dict[str, Any] = {
            "provider": "railway_xai_proxy",
            "model": model,
            "request_id": request_id,
            "upstream_provider": data.get("provider"),
            "duration_seconds": data.get("duration_seconds"),
            "storage": storage,
            "r2_key": r2_key,
        }
        if xai_video_url:
            meta["xai_video_url"] = xai_video_url

        if _is_r2_proxy_result(data):
            logger.info(
                "[RAILWAY_XAI_VIDEO_R2_RESULT_ACCEPTED] project_id=%s segment_id=%s request_id=%s "
                "video_url=%s r2_key=%s",
                project_id,
                segment_id,
                request_id,
                video_url,
                r2_key,
            )
            return SegmentVideoResult(
                video_bytes=b"",
                provider_video_url=video_url,
                provider_metadata=meta,
            )

        try:
            video_bytes = download_remote_video_bytes(
                video_url=video_url,
                project_id=project_id,
                segment_id=segment_id,
                request_id=request_id,
            )
        except ShortDramaVideoProviderError:
            raise
        except Exception as e:
            raise ShortDramaVideoProviderError(f"Railway xAI video download failed: {e}") from e

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
