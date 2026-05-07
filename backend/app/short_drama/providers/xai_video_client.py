"""HTTP client for xAI video REST: POST /v1/videos/generations + GET /v1/videos/{request_id}."""

from __future__ import annotations

import logging
import ssl
import time
from typing import Any

import httpx

from ...config import settings
from ..exceptions import ShortDramaVideoProviderError
from ..utils.flow_logging import log_ai_error, log_ai_request, log_ai_response

logger = logging.getLogger(__name__)

_DEFAULT_XAI_VIDEO_MODEL = "grok-imagine-video"

# Reference-image precheck (GET): separate shorter connect vs read
_REF_IMG_TIMEOUT_CONNECT = 10.0
_REF_IMG_TIMEOUT_READ = 30.0
_REF_IMG_TIMEOUT_WRITE = 30.0
_REF_IMG_TIMEOUT_POOL = 5.0


def _reference_image_check_timeout() -> httpx.Timeout:
    return httpx.Timeout(
        connect=_REF_IMG_TIMEOUT_CONNECT,
        read=_REF_IMG_TIMEOUT_READ,
        write=_REF_IMG_TIMEOUT_WRITE,
        pool=_REF_IMG_TIMEOUT_POOL,
    )


def _log_xai_http_client_config(*, phase: str, timeout: httpx.Timeout) -> None:
    logger.info(
        "[XAI_HTTP_CLIENT_CONFIG] phase=%s http2=%s verify=%s follow_redirects=%s "
        "timeout_connect=%s timeout_read=%s timeout_write=%s timeout_pool=%s",
        phase,
        False,
        True,
        True,
        timeout.connect,
        timeout.read,
        timeout.write,
        timeout.pool,
    )


def _is_xai_post_transport_retryable(exc: BaseException) -> bool:
    if isinstance(exc, ssl.SSLError):
        return True
    return isinstance(exc, (httpx.ConnectError, httpx.ReadError, httpx.RemoteProtocolError))


def _log_xai_ssl_if_applicable(exc: BaseException, *, attempt: int) -> None:
    if isinstance(exc, ssl.SSLError):
        logger.error("[XAI_SSL_ERROR] attempt=%s exc=%s", attempt, exc)
        return
    c = getattr(exc, "__cause__", None)
    if isinstance(c, ssl.SSLError):
        logger.error("[XAI_SSL_ERROR] attempt=%s exc=%s ssl_cause=%s", attempt, exc, c)


def _payload_preview(payload: Any, *, limit: int = 1000) -> str:
    try:
        text = str(payload)
    except Exception:
        text = "<unprintable>"
    if len(text) > limit:
        return text[:limit] + "…"
    return text


def validate_reference_image_urls_for_xai(
    *,
    urls: list[str],
    project_id: int,
    segment_id: str,
) -> None:
    """GET each URL before xAI submit; fail fast if not HTTP 200 image/* (avoids HTML interstitials)."""
    timeout = _reference_image_check_timeout()
    _log_xai_http_client_config(phase="reference_image_check", timeout=timeout)
    for raw in urls:
        u = (raw or "").strip()
        if not u:
            continue
        try:
            with httpx.Client(
                timeout=timeout,
                http2=False,
                verify=True,
                follow_redirects=True,
            ) as client:
                with client.stream("GET", u) as resp:
                    status = resp.status_code
                    ct = (resp.headers.get("content-type") or "").split(";")[0].strip().lower()
                    cl = resp.headers.get("content-length")
                    final_url = str(resp.url)
                    for _ in resp.iter_bytes(chunk_size=65536):
                        break
        except Exception as e:
            logger.error(
                "[XAI_REFERENCE_IMAGE_CHECK_FAIL] project_id=%s segment_id=%s url=%s exception_class=%s err=%s",
                project_id,
                segment_id,
                u,
                type(e).__name__,
                str(e),
            )
            logger.error(
                "[XAI_REFERENCE_IMAGE_INVALID] project_id=%s segment_id=%s url=%s reason=request_error_%s",
                project_id,
                segment_id,
                u,
                e,
            )
            raise ShortDramaVideoProviderError(
                f"Reference image URL could not be fetched (project_id={project_id}, segment_id={segment_id}): {u} ({e})"
            ) from e

        logger.info(
            "[XAI_REFERENCE_IMAGE_CHECK] url=%s status_code=%s content_type=%s content_length=%s final_url=%s",
            u,
            status,
            ct,
            cl,
            final_url,
        )
        if status != 200:
            logger.error(
                "[XAI_REFERENCE_IMAGE_CHECK_FAIL] project_id=%s segment_id=%s url=%s exception_class=%s err=%s",
                project_id,
                segment_id,
                u,
                "HttpStatusInvalid",
                f"status_code={status}",
            )
            logger.error(
                "[XAI_REFERENCE_IMAGE_INVALID] project_id=%s segment_id=%s url=%s reason=status_%s",
                project_id,
                segment_id,
                u,
                status,
            )
            raise ShortDramaVideoProviderError(
                f"Reference image URL returned HTTP {status} (project_id={project_id}, segment_id={segment_id}): {u}"
            )
        if not ct.startswith("image/"):
            logger.error(
                "[XAI_REFERENCE_IMAGE_CHECK_FAIL] project_id=%s segment_id=%s url=%s exception_class=%s err=%s",
                project_id,
                segment_id,
                u,
                "ContentTypeInvalid",
                f"content_type={ct or '(empty)'}",
            )
            logger.error(
                "[XAI_REFERENCE_IMAGE_INVALID] project_id=%s segment_id=%s url=%s reason=bad_content_type_%s",
                project_id,
                segment_id,
                u,
                ct or "(empty)",
            )
            raise ShortDramaVideoProviderError(
                f"Reference image URL is not an image (content-type={ct!r}, project_id={project_id}, segment_id={segment_id}): {u}"
            )


def effective_xai_video_model() -> str:
    """Single source of truth for video model name."""
    return settings.XAI_VIDEO_MODEL or _DEFAULT_XAI_VIDEO_MODEL


def effective_xai_video_base_url() -> str:
    return settings.XAI_VIDEO_BASE_URL.rstrip("/")


class XAIVideoClient:
    def __init__(
        self,
        *,
        base_url: str | None = None,
        api_key: str | None = None,
    ):
        self._base = (base_url or effective_xai_video_base_url()).rstrip("/")
        self._api_key = api_key if api_key is not None else settings.XAI_API_KEY
        sec = float(settings.XAI_VIDEO_TIMEOUT_SECONDS)
        self._timeout_connect = min(30.0, sec)
        self._timeout_read = sec
        self._timeout_write = sec
        self._timeout_pool = 10.0
        self._video_timeout = httpx.Timeout(
            connect=self._timeout_connect,
            read=self._timeout_read,
            write=self._timeout_write,
            pool=self._timeout_pool,
        )
        self._max_retries = max(0, int(settings.XAI_VIDEO_MAX_RETRIES))

    def _make_xai_video_http_client(self) -> httpx.Client:
        return httpx.Client(
            timeout=self._video_timeout,
            http2=False,
            verify=True,
            follow_redirects=True,
        )

    def _post_video_generations_once(self, url: str, payload: dict[str, Any]) -> httpx.Response:
        with self._make_xai_video_http_client() as client:
            return client.post(url, headers=self._headers(), json=payload)

    def _headers(self) -> dict[str, str]:
        if not self._api_key:
            raise ShortDramaVideoProviderError("XAI_API_KEY is not configured")
        return {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }

    def _classify_http_error(self, resp: httpx.Response) -> ShortDramaVideoProviderError:
        body = ""
        try:
            body = resp.text[:2000]
        except Exception:
            pass
        if resp.status_code == 429:
            return ShortDramaVideoProviderError(f"xAI video rate limit / quota (429): {body}")
        if resp.status_code >= 500:
            return ShortDramaVideoProviderError(f"xAI video server error ({resp.status_code}): {body}")
        return ShortDramaVideoProviderError(f"xAI video HTTP {resp.status_code}: {body}")

    def start_video_generation(
        self,
        *,
        model: str,
        prompt: str,
        reference_image_urls: list[str],
        duration: int,
        aspect_ratio: str,
        resolution: str | None,
        project_id: int,
        segment_id: str,
    ) -> str:
        """Submit reference-to-video job; returns request_id."""
        url = f"{self._base}/v1/videos/generations"
        refs = [{"url": u} for u in reference_image_urls if u]
        validate_reference_image_urls_for_xai(
            urls=[u for u in reference_image_urls if (u or "").strip()],
            project_id=project_id,
            segment_id=segment_id,
        )
        payload: dict[str, Any] = {
            "model": model,
            "prompt": prompt,
            "reference_images": refs,
            "duration": int(duration),
            "aspect_ratio": aspect_ratio,
        }
        if resolution:
            payload["resolution"] = resolution

        log_ai_request(
            logger,
            "xai_video",
            model,
            project_id=project_id,
            segment_id=segment_id,
            phase="start_video_generation",
            prompt_len=len(prompt or ""),
            reference_image_count=len(refs),
            duration_seconds=duration,
            aspect_ratio=aspect_ratio,
            resolution=resolution or "",
        )
        logger.info(
            "[XAI_GENERATION_START_REQUEST] project_id=%s segment_id=%s model=%s duration_seconds=%s aspect_ratio=%s resolution=%s reference_image_count=%s",
            project_id,
            segment_id,
            model,
            duration,
            aspect_ratio,
            resolution or "",
            len(refs),
        )

        logger.info("[XAI_REQUEST] POST /v1/videos/generations model=%s", model)

        _log_xai_http_client_config(phase="start_video_generation", timeout=self._video_timeout)

        t0 = time.perf_counter()
        resp: httpx.Response | None = None
        first_transport_error: BaseException | None = None

        for attempt in (1, 2):
            logger.info(
                "[XAI_REQUEST_ATTEMPT] attempt=%s phase=start_video_generation url=%s",
                attempt,
                url,
            )
            try:
                resp = self._post_video_generations_once(url, payload)
                logger.info("[XAI_RESPONSE_STATUS] status_code=%s", resp.status_code)
                break
            except httpx.TimeoutException as e:
                logger.error(
                    "[XAI_NETWORK_ERROR] exception_class=%s exc=%s attempt=%s",
                    type(e).__name__,
                    str(e),
                    attempt,
                )
                log_ai_error(
                    logger,
                    "xai_video",
                    model,
                    f"start_timeout: {e}",
                    project_id=project_id,
                    segment_id=segment_id,
                    phase="start_video_generation",
                )
                raise ShortDramaVideoProviderError(f"xAI video start timeout: {e}") from e
            except (httpx.ConnectError, httpx.ReadError, httpx.RemoteProtocolError, ssl.SSLError) as e:
                logger.error(
                    "[XAI_NETWORK_ERROR] exception_class=%s exc=%s attempt=%s",
                    type(e).__name__,
                    str(e),
                    attempt,
                )
                _log_xai_ssl_if_applicable(e, attempt=attempt)
                if attempt == 1:
                    first_transport_error = e
                    time.sleep(1.0)
                    continue
                raise ShortDramaVideoProviderError(
                    "xAI video POST /v1/videos/generations failed after transport retries: "
                    f"first_attempt_error={first_transport_error!r} second_attempt_error={e!r} "
                    f"exception_class={type(e).__name__}"
                ) from e
            except httpx.RequestError as e:
                logger.error(
                    "[XAI_NETWORK_ERROR] exception_class=%s exc=%s attempt=%s",
                    type(e).__name__,
                    str(e),
                    attempt,
                )
                raise ShortDramaVideoProviderError(f"xAI video start network error: {e}") from e

        if resp is None:
            raise ShortDramaVideoProviderError("xAI video POST failed: no response")

        server_retry = 0
        while resp.status_code >= 500 and server_retry < self._max_retries:
            time.sleep(1.0 + server_retry)
            server_retry += 1
            logger.info(
                "[XAI_REQUEST_ATTEMPT] attempt=%s phase=start_video_generation_5xx_retry url=%s",
                server_retry + 1,
                url,
            )
            resp = self._post_video_generations_once(url, payload)
            logger.info("[XAI_RESPONSE_STATUS] status_code=%s", resp.status_code)

        elapsed_ms = int((time.perf_counter() - t0) * 1000)

        if resp.status_code >= 400:
            err_body = ""
            try:
                err_body = (resp.text or "")[:500]
            except Exception:
                pass
            logger.error(
                "[XAI_ERROR_RESPONSE_BODY] status_code=%s body_prefix=%s",
                resp.status_code,
                err_body,
            )
            logger.info(
                "[XAI_PROVIDER_RAW_RESPONSE] project_id=%s segment_id=%s request_id=%s phase=%s status_code=%s payload_keys=%s payload_preview=%s",
                project_id,
                segment_id,
                "",
                "start_generation_http_error",
                resp.status_code,
                [],
                _payload_preview(err_body),
            )
            err = self._classify_http_error(resp)
            log_ai_error(
                logger,
                "xai_video",
                model,
                str(err),
                project_id=project_id,
                segment_id=segment_id,
                phase="start_video_generation",
                duration_ms=elapsed_ms,
                http_status=resp.status_code,
            )
            logger.error(
                "[XAI_GENERATION_START_FAIL] project_id=%s segment_id=%s exception_class=%s err=%s",
                project_id,
                segment_id,
                type(err).__name__,
                str(err),
            )
            raise err

        data = resp.json()
        logger.info(
            "[XAI_PROVIDER_RAW_RESPONSE] project_id=%s segment_id=%s request_id=%s phase=%s status_code=%s payload_keys=%s payload_preview=%s",
            project_id,
            segment_id,
            str(data.get("request_id") or ""),
            "start_generation",
            resp.status_code,
            list(data.keys())[:20] if isinstance(data, dict) else [],
            _payload_preview(data),
        )
        rid = data.get("request_id")
        if not rid:
            log_ai_error(
                logger,
                "xai_video",
                model,
                "missing_request_id",
                project_id=project_id,
                segment_id=segment_id,
                response_keys=list(data.keys())[:12] if isinstance(data, dict) else [],
            )
            raise ShortDramaVideoProviderError(f"xAI video start missing request_id: {data!r}")
        logger.info(
            "[XAI_GENERATION_START_SUCCESS] project_id=%s segment_id=%s request_id=%s",
            project_id,
            segment_id,
            str(rid),
        )
        logger.info("[XAI_RESPONSE] request_id=%s", rid)
        log_ai_response(
            logger,
            "xai_video",
            model,
            project_id=project_id,
            segment_id=segment_id,
            phase="start_video_generation",
            request_id=str(rid),
            duration_ms=elapsed_ms,
        )
        return str(rid)

    def poll_video_generation(
        self,
        *,
        request_id: str,
        model: str,
        project_id: int,
        segment_id: str,
    ) -> dict[str, Any]:
        """Poll until done / failed / expired / timeout. Returns final JSON body."""
        url = f"{self._base}/v1/videos/{request_id}"
        deadline = time.monotonic() + float(settings.XAI_VIDEO_POLL_TIMEOUT_SECONDS)
        interval_s = max(0.05, float(settings.XAI_VIDEO_POLL_INTERVAL_MS) / 1000.0)
        poll_count = 0
        t0 = time.perf_counter()
        _log_xai_http_client_config(phase="poll_video_generation", timeout=self._video_timeout)
        while time.monotonic() < deadline:
            poll_count += 1
            try:
                with self._make_xai_video_http_client() as client:
                    resp = client.get(url, headers=self._headers())
                if resp.status_code >= 400:
                    raise self._classify_http_error(resp)
                data = resp.json()
                logger.info(
                    "[XAI_PROVIDER_RAW_RESPONSE] project_id=%s segment_id=%s request_id=%s phase=%s status_code=%s payload_keys=%s payload_preview=%s",
                    project_id,
                    segment_id,
                    request_id,
                    "poll_generation",
                    resp.status_code,
                    list(data.keys())[:20] if isinstance(data, dict) else [],
                    _payload_preview(data),
                )
            except httpx.TimeoutException as e:
                raise ShortDramaVideoProviderError(f"xAI video poll timeout: {e}") from e
            except httpx.RequestError as e:
                raise ShortDramaVideoProviderError(f"xAI video poll network error: {e}") from e

            status = (data.get("status") or "").lower()
            progress = data.get("progress")
            video_obj = data.get("video") if isinstance(data.get("video"), dict) else {}
            has_video_url = bool(video_obj.get("url")) if isinstance(video_obj, dict) else False
            logger.info(
                "[XAI_GENERATION_POLL_STATUS] project_id=%s segment_id=%s request_id=%s status=%s progress=%s has_video_url=%s",
                project_id,
                segment_id,
                request_id,
                status,
                progress,
                has_video_url,
            )
            if status == "done":
                elapsed_ms = int((time.perf_counter() - t0) * 1000)
                video = data.get("video") if isinstance(data.get("video"), dict) else {}
                vurl = video.get("url") if isinstance(video, dict) else None
                logger.info(
                    "[XAI_GENERATION_POLL_COMPLETED] project_id=%s segment_id=%s request_id=%s video_url=%s duration=%s",
                    project_id,
                    segment_id,
                    request_id,
                    str(vurl) if vurl else "",
                    data.get("duration"),
                )
                log_ai_response(
                    logger,
                    "xai_video",
                    model,
                    project_id=project_id,
                    segment_id=segment_id,
                    phase="poll_video_done",
                    request_id=request_id,
                    duration_ms=elapsed_ms,
                    poll_count=poll_count,
                    video_url=str(vurl) if vurl else "",
                    payload_keys=list(data.keys())[:16],
                )
                return data
            if status in ("failed", "error"):
                logger.error(
                    "[XAI_GENERATION_POLL_FAILED] project_id=%s segment_id=%s request_id=%s status=%s err_payload=%s",
                    project_id,
                    segment_id,
                    request_id,
                    status,
                    data,
                )
                log_ai_error(
                    logger,
                    "xai_video",
                    model,
                    "poll_status_failed",
                    project_id=project_id,
                    segment_id=segment_id,
                    request_id=request_id,
                    payload_keys=list(data.keys())[:16] if isinstance(data, dict) else [],
                )
                raise ShortDramaVideoProviderError(f"xAI video generation failed: {data!r}")
            if status == "expired":
                logger.error(
                    "[XAI_GENERATION_POLL_FAILED] project_id=%s segment_id=%s request_id=%s status=%s err_payload=%s",
                    project_id,
                    segment_id,
                    request_id,
                    status,
                    data,
                )
                log_ai_error(
                    logger,
                    "xai_video",
                    model,
                    "poll_expired",
                    project_id=project_id,
                    segment_id=segment_id,
                    request_id=request_id,
                )
                raise ShortDramaVideoProviderError(f"xAI video request expired: {request_id}")
            time.sleep(interval_s)

        elapsed_ms = int((time.perf_counter() - t0) * 1000)
        logger.error(
            "[XAI_GENERATION_POLL_FAILED] project_id=%s segment_id=%s request_id=%s status=%s err_payload=%s",
            project_id,
            segment_id,
            request_id,
            "timeout",
            {"poll_count": poll_count, "duration_ms": elapsed_ms},
        )
        log_ai_error(
            logger,
            "xai_video",
            model,
            "poll_timeout",
            project_id=project_id,
            segment_id=segment_id,
            request_id=request_id,
            duration_ms=elapsed_ms,
            poll_count=poll_count,
        )
        raise ShortDramaVideoProviderError(
            f"xAI video poll exceeded {settings.XAI_VIDEO_POLL_TIMEOUT_SECONDS}s (request_id={request_id})"
        )

    def download_video_bytes(
        self,
        *,
        video_url: str,
        project_id: int,
        segment_id: str,
        request_id: str | None = None,
    ) -> bytes:
        try:
            logger.info(
                "[XAI_VIDEO_DOWNLOAD_START] project_id=%s segment_id=%s request_id=%s video_url=%s",
                project_id,
                segment_id,
                request_id or "",
                video_url,
            )
            _log_xai_http_client_config(phase="download_video_bytes", timeout=self._video_timeout)
            with self._make_xai_video_http_client() as client:
                resp = client.get(video_url)
            if resp.status_code >= 400:
                raise ShortDramaVideoProviderError(
                    f"Video download HTTP {resp.status_code} for project_id={project_id} segment_id={segment_id}"
                )
            video_bytes = resp.content
            logger.info("[XAI_DOWNLOAD] video_bytes=%s", len(video_bytes))
            logger.info(
                "[XAI_VIDEO_DOWNLOAD_SUCCESS] project_id=%s segment_id=%s request_id=%s video_url=%s bytes_size=%s",
                project_id,
                segment_id,
                request_id or "",
                video_url,
                len(video_bytes),
            )
            return video_bytes
        except (httpx.TimeoutException, httpx.RequestError, ShortDramaVideoProviderError) as e:
            logger.error(
                "[XAI_VIDEO_DOWNLOAD_FAIL] project_id=%s segment_id=%s request_id=%s video_url=%s exception_class=%s err=%s",
                project_id,
                segment_id,
                request_id or "",
                video_url,
                type(e).__name__,
                str(e),
            )
            if isinstance(e, ShortDramaVideoProviderError):
                raise
            if isinstance(e, httpx.TimeoutException):
                raise ShortDramaVideoProviderError(f"Video download timeout: {e}") from e
            raise ShortDramaVideoProviderError(f"Video download network error: {e}") from e
