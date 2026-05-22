"""Google Gemini Veo video client (create operation + poll + download)."""

from __future__ import annotations

import logging
import time
from typing import Any

import httpx

from ...config import settings
from ..exceptions import ShortDramaVideoProviderError
from .xai_video_client import validate_reference_image_urls_for_xai

logger = logging.getLogger(__name__)

_DEFAULT_GEMINI_VIDEO_MODEL = "veo-3.1-generate-preview"
_SUCCESS_DONE = True


def effective_gemini_video_model() -> str:
    return (settings.GEMINI_VIDEO_MODEL or _DEFAULT_GEMINI_VIDEO_MODEL).strip()


def effective_gemini_video_base_url() -> str:
    return (settings.GEMINI_VIDEO_BASE_URL or "https://generativelanguage.googleapis.com/v1beta").rstrip("/")


def _safe_response_preview(text: str, *, limit: int = 1000) -> str:
    s = text or ""
    if len(s) > limit:
        return s[:limit] + "..."
    return s


def _extract_operation_name(body: Any) -> str | None:
    if not isinstance(body, dict):
        return None
    name = body.get("name")
    if isinstance(name, str) and name.strip():
        return name.strip()
    return None


def _extract_video_uri(body: Any) -> str | None:
    if not isinstance(body, dict):
        return None
    response = body.get("response")
    if not isinstance(response, dict):
        return None
    generate_response = response.get("generateVideoResponse")
    if isinstance(generate_response, dict):
        samples = generate_response.get("generatedSamples")
        if isinstance(samples, list):
            for sample in samples:
                if not isinstance(sample, dict):
                    continue
                video = sample.get("video")
                if isinstance(video, dict):
                    uri = video.get("uri")
                    if isinstance(uri, str) and uri.strip():
                        return uri.strip()
    generated_videos = response.get("generatedVideos")
    if isinstance(generated_videos, list):
        for item in generated_videos:
            if not isinstance(item, dict):
                continue
            video = item.get("video")
            if isinstance(video, dict):
                uri = video.get("uri")
                if isinstance(uri, str) and uri.strip():
                    return uri.strip()
    return None


def _extract_operation_error(body: Any) -> str:
    if not isinstance(body, dict):
        return ""
    err = body.get("error")
    if isinstance(err, dict):
        msg = err.get("message") or err.get("code") or err.get("status")
        if msg is not None and str(msg).strip():
            return str(msg).strip()
    if err is not None and str(err).strip():
        return str(err).strip()
    return ""


def build_gemini_veo_payload(
    *,
    prompt: str,
    reference_image_urls: list[str],
    aspect_ratio: str,
    duration_seconds: int,
    resolution: str | None,
) -> dict[str, Any]:
    instance: dict[str, Any] = {"prompt": (prompt or "").strip()}
    # Gemini REST accepts image guidance in predictLongRunning as reference images.
    # Keep a conservative shape; unsupported fields surface as provider errors.
    refs = [{"image": {"url": u}} for u in reference_image_urls if (u or "").strip()]
    if refs:
        instance["referenceImages"] = refs[:3]
    parameters: dict[str, Any] = {
        "aspectRatio": (aspect_ratio or "9:16").strip(),
        "durationSeconds": int(duration_seconds),
    }
    if resolution:
        parameters["resolution"] = str(resolution).strip()
    return {"instances": [instance], "parameters": parameters}


class GeminiVeoVideoClient:
    def __init__(
        self,
        *,
        base_url: str | None = None,
        api_key: str | None = None,
        http_client: httpx.Client | None = None,
    ):
        self._base = (base_url or effective_gemini_video_base_url()).rstrip("/")
        self._api_key = api_key if api_key is not None else settings.GEMINI_API_KEY
        self._http_client = http_client
        sec = float(settings.GEMINI_VIDEO_TIMEOUT_SECONDS)
        self._timeout = httpx.Timeout(connect=min(30.0, sec), read=sec, write=sec, pool=10.0)

    def _api_key_value(self) -> str:
        key = (self._api_key or "").strip()
        if not key:
            raise ShortDramaVideoProviderError("GEMINI_API_KEY is required when VIDEO_PROVIDER=gemini_veo")
        return key

    def _client(self) -> httpx.Client:
        if self._http_client is not None:
            return self._http_client
        return httpx.Client(timeout=self._timeout, http2=False, verify=True, follow_redirects=True)

    def _request(
        self,
        method: str,
        path_or_url: str,
        *,
        json_body: dict[str, Any] | None = None,
        absolute: bool = False,
    ) -> httpx.Response:
        url = path_or_url if absolute else f"{self._base}{path_or_url}"
        sep = "&" if "?" in url else "?"
        url = f"{url}{sep}key={self._api_key_value()}"
        client = self._client()
        owns_client = self._http_client is None
        try:
            if method.upper() == "POST":
                return client.post(url, headers={"Content-Type": "application/json"}, json=json_body)
            return client.get(url)
        finally:
            if owns_client:
                client.close()

    def create_video_operation(
        self,
        *,
        model: str,
        prompt: str,
        reference_image_urls: list[str],
        duration_seconds: int,
        aspect_ratio: str,
        resolution: str | None,
        project_id: int,
        segment_id: str,
    ) -> str:
        refs = [u for u in (reference_image_urls or []) if (u or "").strip()][:3]
        validate_reference_image_urls_for_xai(
            urls=refs,
            project_id=project_id,
            segment_id=segment_id,
        )
        payload = build_gemini_veo_payload(
            prompt=prompt,
            reference_image_urls=refs,
            duration_seconds=duration_seconds,
            aspect_ratio=aspect_ratio,
            resolution=resolution,
        )
        logger.info(
            "[GEMINI_VEO_REQUEST] project_id=%s segment_id=%s model=%s duration=%s aspect_ratio=%s "
            "resolution=%s reference_image_count=%s prompt_chars=%s",
            project_id,
            segment_id,
            model,
            int(duration_seconds),
            payload.get("parameters", {}).get("aspectRatio"),
            payload.get("parameters", {}).get("resolution") or "",
            len(refs),
            len((prompt or "")),
        )
        resp = self._request("POST", f"/models/{model}:predictLongRunning", json_body=payload)
        if resp.status_code < 200 or resp.status_code >= 300:
            body_text = resp.text or ""
            logger.error(
                "[GEMINI_VEO_CREATE_HTTP_ERROR] project_id=%s segment_id=%s status_code=%s body_prefix=%s",
                project_id,
                segment_id,
                resp.status_code,
                _safe_response_preview(body_text),
            )
            raise ShortDramaVideoProviderError(
                f"Gemini Veo create HTTP {resp.status_code} (project_id={project_id}, segment_id={segment_id}): "
                f"{_safe_response_preview(body_text)}"
            )
        try:
            data = resp.json()
        except Exception as e:
            raise ShortDramaVideoProviderError(f"Gemini Veo create returned non-JSON: {e}") from e
        operation_name = _extract_operation_name(data)
        if not operation_name:
            raise ShortDramaVideoProviderError(
                f"Gemini Veo create missing operation name: {_safe_response_preview(str(data))}"
            )
        logger.info(
            "[GEMINI_VEO_OPERATION_CREATED] project_id=%s segment_id=%s operation_name=%s",
            project_id,
            segment_id,
            operation_name,
        )
        return operation_name

    def poll_video_operation(
        self,
        *,
        operation_name: str,
        project_id: int,
        segment_id: str,
    ) -> dict[str, Any]:
        deadline = time.monotonic() + float(settings.GEMINI_VIDEO_TIMEOUT_SECONDS)
        interval_s = max(1.0, float(settings.GEMINI_VIDEO_POLL_INTERVAL_SECONDS))
        path = f"/{operation_name.lstrip('/')}"
        while time.monotonic() < deadline:
            resp = self._request("GET", path)
            if resp.status_code < 200 or resp.status_code >= 300:
                raise ShortDramaVideoProviderError(
                    f"Gemini Veo poll HTTP {resp.status_code} (operation={operation_name}): "
                    f"{_safe_response_preview(resp.text or '')}"
                )
            try:
                data = resp.json()
            except Exception as e:
                raise ShortDramaVideoProviderError(f"Gemini Veo poll non-JSON: {e}") from e
            if not isinstance(data, dict):
                raise ShortDramaVideoProviderError(f"Gemini Veo poll unexpected body: {data!r}")
            done = data.get("done") is _SUCCESS_DONE
            logger.info(
                "[GEMINI_VEO_OPERATION_POLL] project_id=%s segment_id=%s operation_name=%s done=%s",
                project_id,
                segment_id,
                operation_name,
                bool(done),
            )
            if done:
                err = _extract_operation_error(data)
                if err:
                    raise ShortDramaVideoProviderError(
                        f"Gemini Veo operation failed (operation={operation_name}): {err}"
                    )
                video_uri = _extract_video_uri(data)
                if not video_uri:
                    raise ShortDramaVideoProviderError(
                        f"Gemini Veo operation completed without video URI: {_safe_response_preview(str(data))}"
                    )
                logger.info(
                    "[GEMINI_VEO_OPERATION_SUCCEEDED] project_id=%s segment_id=%s operation_name=%s video_uri=%s",
                    project_id,
                    segment_id,
                    operation_name,
                    video_uri,
                )
                return data
            time.sleep(interval_s)
        raise ShortDramaVideoProviderError(
            f"Gemini Veo poll exceeded {settings.GEMINI_VIDEO_TIMEOUT_SECONDS}s (operation={operation_name})"
        )

    def download_video_bytes(
        self,
        *,
        video_uri: str,
        project_id: int,
        segment_id: str,
        operation_name: str | None = None,
    ) -> bytes:
        logger.info(
            "[GEMINI_VEO_DOWNLOAD_START] project_id=%s segment_id=%s operation_name=%s video_uri=%s",
            project_id,
            segment_id,
            operation_name or "",
            video_uri,
        )
        resp = self._request("GET", video_uri, absolute=True)
        if resp.status_code >= 400:
            raise ShortDramaVideoProviderError(
                f"Gemini Veo download HTTP {resp.status_code} (project_id={project_id}, segment_id={segment_id})"
            )
        data = resp.content
        logger.info(
            "[GEMINI_VEO_DOWNLOAD_SUCCESS] project_id=%s segment_id=%s operation_name=%s bytes_size=%s",
            project_id,
            segment_id,
            operation_name or "",
            len(data),
        )
        return data


def extract_gemini_video_uri(body: Any) -> str | None:
    return _extract_video_uri(body)
