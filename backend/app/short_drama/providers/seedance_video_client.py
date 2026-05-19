"""HTTP client for Volcano Ark Seedance video generation (create task + poll + download)."""

from __future__ import annotations

import logging
import time
from typing import Any

import httpx

from ...config import settings
from ..exceptions import ShortDramaVideoProviderError
from .xai_video_client import validate_reference_image_urls_for_xai

logger = logging.getLogger(__name__)

_DEFAULT_SEEDANCE_MODEL = "doubao-seedance-2-0-260128"
_TASKS_PATH = "/contents/generations/tasks"

_SUCCESS_STATUSES = frozenset({"succeeded", "success", "completed"})
_FAIL_STATUSES = frozenset({"failed", "cancelled", "expired", "error"})


def effective_seedance_video_model() -> str:
    return (settings.SEEDANCE_VIDEO_MODEL or _DEFAULT_SEEDANCE_MODEL).strip()


def effective_seedance_api_base() -> str:
    return (settings.SEEDANCE_API_BASE or "https://ark.cn-beijing.volces.com/api/v3").rstrip("/")


def build_seedance_task_payload(
    *,
    model: str,
    prompt: str,
    reference_image_urls: list[str],
    duration_seconds: int,
    ratio: str,
    generate_audio: bool,
    watermark: bool,
) -> dict[str, Any]:
    """Assemble POST body for Seedance contents/generations/tasks."""
    content: list[dict[str, Any]] = [
        {"type": "text", "text": (prompt or "").strip()},
    ]
    for raw in reference_image_urls or []:
        u = (raw or "").strip()
        if not u:
            continue
        content.append(
            {
                "type": "image_url",
                "image_url": {"url": u},
                "role": "reference_image",
            }
        )
    return {
        "model": model,
        "content": content,
        "generate_audio": bool(generate_audio),
        "ratio": (ratio or settings.SEEDANCE_DEFAULT_RATIO or "9:16").strip(),
        "duration": int(duration_seconds),
        "watermark": bool(watermark),
    }


def _safe_response_preview(text: str, *, limit: int = 1000) -> str:
    s = text or ""
    if len(s) > limit:
        return s[:limit] + "…"
    return s


def extract_task_id(body: Any) -> str | None:
    """Parse task id from create-task JSON (id / task_id / data.id / data.task_id)."""
    if isinstance(body, str) and body.strip():
        return body.strip()
    if not isinstance(body, dict):
        return None
    for key in ("id", "task_id"):
        val = body.get(key)
        if val is not None and str(val).strip():
            return str(val).strip()
    data = body.get("data")
    if isinstance(data, dict):
        for key in ("id", "task_id"):
            val = data.get(key)
            if val is not None and str(val).strip():
                return str(val).strip()
    return None


def extract_task_status(body: Any) -> str:
    if not isinstance(body, dict):
        return ""
    raw = body.get("status")
    if raw is None:
        data = body.get("data")
        if isinstance(data, dict):
            raw = data.get("status")
    return str(raw or "").strip().lower()


def extract_video_url(body: Any) -> str | None:
    """Resolve remote MP4 URL from poll response (multiple Ark response shapes)."""

    def _from_mapping(obj: dict[str, Any]) -> str | None:
        content = obj.get("content")
        if isinstance(content, dict):
            vu = content.get("video_url")
            if isinstance(vu, str) and vu.strip():
                return vu.strip()
            if isinstance(vu, dict):
                nested = vu.get("url")
                if isinstance(nested, str) and nested.strip():
                    return nested.strip()
        for key in ("video_url", "url"):
            val = obj.get(key)
            if isinstance(val, str) and val.strip():
                return val.strip()
        output = obj.get("output")
        if isinstance(output, dict):
            found = _from_mapping(output)
            if found:
                return found
        outputs = obj.get("outputs")
        if isinstance(outputs, list):
            for item in outputs:
                if isinstance(item, dict):
                    found = _from_mapping(item)
                    if found:
                        return found
        return None

    if not isinstance(body, dict):
        return None
    found = _from_mapping(body)
    if found:
        return found
    data = body.get("data")
    if isinstance(data, dict):
        return _from_mapping(data)
    return None


def extract_task_error(body: Any) -> str:
    if not isinstance(body, dict):
        return ""
    for key in ("error", "message", "error_message"):
        val = body.get(key)
        if val is not None and str(val).strip():
            return str(val).strip()
    err = body.get("error")
    if isinstance(err, dict):
        for key in ("message", "code", "msg"):
            val = err.get(key)
            if val is not None and str(val).strip():
                return str(val).strip()
    data = body.get("data")
    if isinstance(data, dict):
        nested = extract_task_error(data)
        if nested:
            return nested
    return ""


class SeedanceVideoClient:
    def __init__(
        self,
        *,
        base_url: str | None = None,
        api_key: str | None = None,
        http_client: httpx.Client | None = None,
    ):
        self._base = (base_url or effective_seedance_api_base()).rstrip("/")
        self._api_key = api_key if api_key is not None else settings.ARK_API_KEY
        self._http_client = http_client
        sec = float(settings.SEEDANCE_TASK_TIMEOUT_SECONDS)
        self._timeout = httpx.Timeout(connect=min(30.0, sec), read=sec, write=sec, pool=10.0)

    def _headers(self) -> dict[str, str]:
        key = (self._api_key or "").strip()
        if not key:
            raise ShortDramaVideoProviderError("ARK_API_KEY is required when VIDEO_PROVIDER=seedance")
        return {
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        }

    def _client(self) -> httpx.Client:
        if self._http_client is not None:
            return self._http_client
        return httpx.Client(timeout=self._timeout, http2=False, verify=True, follow_redirects=True)

    def _request(
        self,
        method: str,
        path: str,
        *,
        json_body: dict[str, Any] | None = None,
    ) -> httpx.Response:
        url = f"{self._base}{path}"
        client = self._client()
        owns_client = self._http_client is None
        try:
            if method.upper() == "POST":
                return client.post(url, headers=self._headers(), json=json_body)
            return client.get(url, headers=self._headers())
        finally:
            if owns_client:
                client.close()

    def create_video_task(
        self,
        *,
        model: str,
        prompt: str,
        reference_image_urls: list[str],
        duration_seconds: int,
        ratio: str,
        generate_audio: bool,
        watermark: bool,
        project_id: int,
        segment_id: str,
    ) -> str:
        refs = [u for u in (reference_image_urls or []) if (u or "").strip()]
        validate_reference_image_urls_for_xai(
            urls=refs,
            project_id=project_id,
            segment_id=segment_id,
        )
        payload = build_seedance_task_payload(
            model=model,
            prompt=prompt,
            reference_image_urls=refs,
            duration_seconds=duration_seconds,
            ratio=ratio,
            generate_audio=generate_audio,
            watermark=watermark,
        )
        logger.info(
            "[SEEDANCE_VIDEO_REQUEST] project_id=%s segment_id=%s model=%s duration=%s ratio=%s "
            "reference_image_count=%s prompt_chars=%s",
            project_id,
            segment_id,
            model,
            int(duration_seconds),
            payload.get("ratio"),
            len(refs),
            len((prompt or "")),
        )
        resp = self._request("POST", _TASKS_PATH, json_body=payload)
        if resp.status_code < 200 or resp.status_code >= 300:
            body_text = ""
            try:
                body_text = resp.text or ""
            except Exception:
                pass
            logger.error(
                "[SEEDANCE_VIDEO_TASK_CREATE_HTTP_ERROR] project_id=%s segment_id=%s status_code=%s body_prefix=%s",
                project_id,
                segment_id,
                resp.status_code,
                _safe_response_preview(body_text),
            )
            raise ShortDramaVideoProviderError(
                f"Seedance create task HTTP {resp.status_code} (project_id={project_id}, segment_id={segment_id}): "
                f"{_safe_response_preview(body_text)}"
            )
        try:
            data = resp.json()
        except Exception as e:
            raise ShortDramaVideoProviderError(
                f"Seedance create task returned non-JSON (project_id={project_id}, segment_id={segment_id}): {e}"
            ) from e
        task_id = extract_task_id(data)
        if not task_id:
            preview = _safe_response_preview(str(data))
            logger.error(
                "[SEEDANCE_VIDEO_TASK_CREATE_PARSE_FAIL] project_id=%s segment_id=%s response_preview=%s",
                project_id,
                segment_id,
                preview,
            )
            raise ShortDramaVideoProviderError(
                f"Seedance create task missing task id (project_id={project_id}, segment_id={segment_id}): {preview}"
            )
        logger.info(
            "[SEEDANCE_VIDEO_TASK_CREATED] project_id=%s segment_id=%s task_id=%s",
            project_id,
            segment_id,
            task_id,
        )
        return task_id

    def poll_video_task(
        self,
        *,
        task_id: str,
        project_id: int,
        segment_id: str,
    ) -> dict[str, Any]:
        path = f"{_TASKS_PATH}/{task_id}"
        deadline = time.monotonic() + float(settings.SEEDANCE_TASK_TIMEOUT_SECONDS)
        interval_s = max(0.5, float(settings.SEEDANCE_TASK_POLL_INTERVAL_SECONDS))
        while time.monotonic() < deadline:
            resp = self._request("GET", path)
            if resp.status_code < 200 or resp.status_code >= 300:
                body_text = ""
                try:
                    body_text = resp.text or ""
                except Exception:
                    pass
                raise ShortDramaVideoProviderError(
                    f"Seedance poll HTTP {resp.status_code} (task_id={task_id}): "
                    f"{_safe_response_preview(body_text)}"
                )
            try:
                data = resp.json()
            except Exception as e:
                raise ShortDramaVideoProviderError(f"Seedance poll non-JSON (task_id={task_id}): {e}") from e
            if not isinstance(data, dict):
                raise ShortDramaVideoProviderError(f"Seedance poll unexpected body (task_id={task_id}): {data!r}")

            status = extract_task_status(data)
            logger.info(
                "[SEEDANCE_VIDEO_TASK_POLL] project_id=%s segment_id=%s task_id=%s status=%s",
                project_id,
                segment_id,
                task_id,
                status or "(empty)",
            )

            if status in _SUCCESS_STATUSES:
                video_url = extract_video_url(data)
                if not video_url:
                    raise ShortDramaVideoProviderError(
                        f"Seedance task succeeded but video URL missing (task_id={task_id}): {data!r}"
                    )
                logger.info(
                    "[SEEDANCE_VIDEO_TASK_SUCCEEDED] project_id=%s segment_id=%s task_id=%s remote_video_url=%s",
                    project_id,
                    segment_id,
                    task_id,
                    video_url,
                )
                return data

            if status in _FAIL_STATUSES:
                err_msg = extract_task_error(data) or status
                logger.error(
                    "[SEEDANCE_VIDEO_TASK_FAILED] project_id=%s segment_id=%s task_id=%s status=%s error=%s",
                    project_id,
                    segment_id,
                    task_id,
                    status,
                    err_msg,
                )
                raise ShortDramaVideoProviderError(
                    f"Seedance video task failed (task_id={task_id}, status={status}): {err_msg}"
                )

            time.sleep(interval_s)

        raise ShortDramaVideoProviderError(
            f"Seedance poll exceeded {settings.SEEDANCE_TASK_TIMEOUT_SECONDS}s (task_id={task_id})"
        )

    def download_video_bytes(
        self,
        *,
        video_url: str,
        project_id: int,
        segment_id: str,
        task_id: str | None = None,
    ) -> bytes:
        logger.info(
            "[SEEDANCE_VIDEO_DOWNLOAD_START] project_id=%s segment_id=%s task_id=%s video_url=%s",
            project_id,
            segment_id,
            task_id or "",
            video_url,
        )
        client = self._client()
        owns_client = self._http_client is None
        try:
            resp = client.get(video_url, timeout=self._timeout)
        finally:
            if owns_client:
                client.close()
        if resp.status_code >= 400:
            raise ShortDramaVideoProviderError(
                f"Seedance video download HTTP {resp.status_code} (project_id={project_id}, segment_id={segment_id})"
            )
        data = resp.content
        logger.info(
            "[SEEDANCE_VIDEO_DOWNLOAD_SUCCESS] project_id=%s segment_id=%s task_id=%s bytes_size=%s",
            project_id,
            segment_id,
            task_id or "",
            len(data),
        )
        return data
