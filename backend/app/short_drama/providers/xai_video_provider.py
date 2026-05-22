"""High-level video provider: reference-to-video via xAI (or mock)."""

from __future__ import annotations

import logging
import os
import subprocess
import tempfile
import time
from pathlib import Path
from typing import Any
import shutil

from ...config import settings
from ..exceptions import ShortDramaVideoProviderError
from ..utils.flow_logging import log_ai_error, log_ai_request, log_ai_response
from .segment_video_types import SegmentVideoProvider, SegmentVideoResult
from .xai_video_client import XAIVideoClient, effective_xai_video_model
from ..utils.ai_runtime_config import STAGE_S4_VIDEO_GENERATION, get_ai_runtime_config

logger = logging.getLogger(__name__)
_XAI_PROVIDER_DURATION_CAP_SECONDS = 10
_PRODUCTION_VIDEO_PROVIDER_ERROR = "生产环境未配置真实视频 provider，禁止使用 mock video provider"

# Mock dev video must be produced by ffmpeg from runtime PATH.
MOCK_FFMPEG_BIN = "ffmpeg"


def _is_truthy(raw: str | None) -> bool:
    return str(raw or "").strip().lower() in {"1", "true", "yes", "on"}


def _is_production_env() -> bool:
    markers = [
        os.getenv("APP_ENV"),
        os.getenv("ENVIRONMENT"),
        os.getenv("NODE_ENV"),
        os.getenv("RAILWAY_ENVIRONMENT"),
    ]
    for raw in markers:
        val = str(raw or "").strip().lower()
        if val in {"prod", "production"}:
            return True
    return False


class XAIVideoProvider:
    """reference-to-video only for Phase 4."""

    def __init__(self, client: XAIVideoClient | None = None):
        self._client = client or XAIVideoClient()

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
        try:
            ai_cfg = get_ai_runtime_config(STAGE_S4_VIDEO_GENERATION)
            provider = (ai_cfg.provider or "").strip().lower()
            model = (ai_cfg.model_id or "").strip() or effective_xai_video_model()
            if provider and provider not in {"xai", "grok"}:
                logger.warning(
                    "[AI_RUNTIME_PROVIDER_UNSUPPORTED_DIRECT_VIDEO] project_id=%s segment_id=%s "
                    "provider=%s model=%s fallback_provider=xai",
                    project_id,
                    segment_id,
                    provider,
                    model,
                )
                model = effective_xai_video_model()
            dur = int(duration_seconds)
            dur_pass = dur <= _XAI_PROVIDER_DURATION_CAP_SECONDS
            logger.info(
                "[XAI_SEGMENT_DURATION_CHECK] project_id=%s segment_id=%s requested_duration_seconds=%s provider_cap_seconds=%s pass=%s",
                project_id,
                segment_id,
                dur,
                _XAI_PROVIDER_DURATION_CAP_SECONDS,
                dur_pass,
            )
            if not dur_pass:
                err = (
                    f"单个片段时长 {dur}s 超过 provider 上限 {_XAI_PROVIDER_DURATION_CAP_SECONDS}s。"
                    "请将该片段拆分到更多片段中生成；完整视频可通过多片段合成实现（如 45s/60s）。"
                )
                logger.error(
                    "[XAI_SEGMENT_DURATION_REJECT] project_id=%s segment_id=%s requested_duration_seconds=%s provider_cap_seconds=%s err=%s",
                    project_id,
                    segment_id,
                    dur,
                    _XAI_PROVIDER_DURATION_CAP_SECONDS,
                    err,
                )
                raise ShortDramaVideoProviderError(err)
            logger.info(
                "[XAI_REFERENCE_IMAGE_URLS] project_id=%s segment_id=%s urls=%s",
                project_id,
                segment_id,
                [u for u in (reference_image_urls or []) if (u or "").strip()],
            )
            return self._client.start_video_generation(
                model=model,
                prompt=prompt,
                reference_image_urls=reference_image_urls,
                duration=duration_seconds,
                aspect_ratio=aspect_ratio,
                resolution=resolution,
                project_id=project_id,
                segment_id=segment_id,
            )
        except ShortDramaVideoProviderError as e:
            logger.error(
                "[XAI_GENERATION_START_FAIL] project_id=%s segment_id=%s exception_class=%s err=%s",
                project_id,
                segment_id,
                type(e).__name__,
                str(e),
            )
            raise
        except Exception as e:
            logger.error(
                "[XAI_GENERATION_START_FAIL] project_id=%s segment_id=%s exception_class=%s err=%s",
                project_id,
                segment_id,
                type(e).__name__,
                str(e),
            )
            raise ShortDramaVideoProviderError(f"XAI video generation failed: {e}") from e

    def complete_segment_video(
        self,
        *,
        request_id: str,
        project_id: int,
        segment_id: str,
        duration_seconds: int = 6,
    ) -> SegmentVideoResult:
        try:
            _ = duration_seconds
            ai_cfg = get_ai_runtime_config(STAGE_S4_VIDEO_GENERATION)
            provider = (ai_cfg.provider or "").strip().lower()
            model = (ai_cfg.model_id or "").strip() or effective_xai_video_model()
            if provider and provider not in {"xai", "grok"}:
                model = effective_xai_video_model()
            final = self._client.poll_video_generation(
                request_id=request_id,
                model=model,
                project_id=project_id,
                segment_id=segment_id,
            )
            logger.info(
                "[XAI_PROVIDER_RAW_RESPONSE] project_id=%s segment_id=%s request_id=%s phase=%s status_code=%s payload_keys=%s payload_preview=%s",
                project_id,
                segment_id,
                request_id,
                "pre_download_metadata",
                "",
                list(final.keys())[:20] if isinstance(final, dict) else [],
                (str(final)[:1000] + "…") if len(str(final)) > 1000 else str(final),
            )
            video = final.get("video") or {}
            vurl = video.get("url") if isinstance(video, dict) else None
            if not vurl:
                raise ShortDramaVideoProviderError(f"xAI video result missing video.url: {final!r}")
            data = self._client.download_video_bytes(
                video_url=vurl, project_id=project_id, segment_id=segment_id, request_id=request_id
            )
            meta = {
                "provider": "xai",
                "model": model,
                "request_id": request_id,
                "raw_status_payload_keys": list(final.keys()),
            }
            return SegmentVideoResult(
                video_bytes=data,
                provider_video_url=vurl,
                provider_metadata=meta,
            )
        except ShortDramaVideoProviderError:
            raise
        except Exception as e:
            raise ShortDramaVideoProviderError(f"XAI video generation failed: {e}") from e


class MockXAIVideoProvider:
    """Dev mock: MP4 bytes only from ffmpeg (testsrc + libx264). No pseudo-MP4 if ffmpeg missing or fails."""

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
        _ = (prompt, reference_image_urls, aspect_ratio, resolution, duration_seconds)
        log_ai_request(
            logger,
            "mock_video",
            "mock",
            project_id=project_id,
            segment_id=segment_id,
            phase="submit_reference_segment_video",
            prompt_len=len(prompt or ""),
            reference_image_count=len(reference_image_urls or []),
        )
        log_ai_response(
            logger,
            "mock_video",
            "mock",
            project_id=project_id,
            segment_id=segment_id,
            phase="submit_reference_segment_video",
            request_id="mock",
        )
        return "mock"

    def complete_segment_video(
        self,
        *,
        request_id: str,
        project_id: int,
        segment_id: str,
        duration_seconds: int = 6,
    ) -> SegmentVideoResult:
        _ = request_id
        dur = max(1, min(10, int(duration_seconds)))
        return self._produce_bytes(project_id=project_id, segment_id=segment_id, duration_seconds=dur)

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
        self.submit_reference_segment_video(
            prompt=prompt,
            reference_image_urls=reference_image_urls,
            duration_seconds=duration_seconds,
            aspect_ratio=aspect_ratio,
            resolution=resolution,
            project_id=project_id,
            segment_id=segment_id,
        )
        return self.complete_segment_video(
            request_id="mock",
            project_id=project_id,
            segment_id=segment_id,
            duration_seconds=duration_seconds,
        )

    def _produce_bytes(self, *, project_id: int, segment_id: str, duration_seconds: int) -> SegmentVideoResult:
        dur = max(1, min(10, int(duration_seconds)))
        t0 = time.perf_counter()
        ffmpeg_path = shutil.which(MOCK_FFMPEG_BIN)
        if not ffmpeg_path:
            cmd_preview = " ".join(
                [
                    MOCK_FFMPEG_BIN,
                    "-y",
                    "-f",
                    "lavfi",
                    "-i",
                    f"testsrc=duration={dur}:size=320x240:rate=24",
                ]
            )
            logger.error(
                "[FFMPEG_NOT_FOUND_IN_ENV] project_id=%s segment_id=%s ffmpeg_cmd=%s exception_class=%s err=%s",
                project_id,
                segment_id,
                cmd_preview,
                "FileNotFoundError",
                "ffmpeg not found in PATH",
            )
            log_ai_error(
                logger,
                "mock_video",
                "mock-ffmpeg",
                f"ffmpeg missing in PATH (command={MOCK_FFMPEG_BIN})",
                project_id=project_id,
            )
            raise ShortDramaVideoProviderError(
                "Mock video requires ffmpeg in runtime PATH; binary not found. "
                "Install ffmpeg or disable SHORT_DRAMA_USE_MOCK_VIDEO_PROVIDER."
            )
        logger.info(
            "[FFMPEG_RUNTIME_READY] project_id=%s segment_id=%s ffmpeg_cmd=%s",
            project_id,
            segment_id,
            ffmpeg_path,
        )

        fd, tmp_name = tempfile.mkstemp(suffix=".mp4")
        os.close(fd)
        out_path = Path(tmp_name)
        ffmpeg_cmd = [
            MOCK_FFMPEG_BIN,
            "-y",
            "-f",
            "lavfi",
            "-i",
            f"testsrc=duration={dur}:size=320x240:rate=24",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            str(out_path),
        ]
        ffmpeg_cmd_str = " ".join(ffmpeg_cmd)
        try:
            try:
                logger.info(
                    "[FFMPEG_COMMAND_START] project_id=%s segment_id=%s ffmpeg_cmd=%s",
                    project_id,
                    segment_id,
                    ffmpeg_cmd_str,
                )
                proc = subprocess.run(
                    ffmpeg_cmd,
                    capture_output=True,
                    timeout=60,
                )
            except FileNotFoundError as e:
                logger.error(
                    "[FFMPEG_NOT_FOUND_IN_ENV] project_id=%s segment_id=%s ffmpeg_cmd=%s exception_class=%s err=%s",
                    project_id,
                    segment_id,
                    ffmpeg_cmd_str,
                    type(e).__name__,
                    str(e),
                )
                log_ai_error(logger, "mock_video", "mock-ffmpeg", f"ffmpeg_skip: {e}", project_id=project_id)
                raise ShortDramaVideoProviderError(
                    f"Mock video could not execute ffmpeg command '{MOCK_FFMPEG_BIN}': {e}"
                ) from e
            except subprocess.TimeoutExpired as e:
                logger.error(
                    "[FFMPEG_COMMAND_FAIL] project_id=%s segment_id=%s ffmpeg_cmd=%s returncode=%s stderr_preview=%s",
                    project_id,
                    segment_id,
                    ffmpeg_cmd_str,
                    "timeout",
                    str(e)[:500],
                )
                log_ai_error(logger, "mock_video", "mock-ffmpeg", f"ffmpeg_timeout: {e}", project_id=project_id)
                raise ShortDramaVideoProviderError("Mock ffmpeg timed out generating segment video") from e
            except OSError as e:
                logger.error(
                    "[FFMPEG_COMMAND_FAIL] project_id=%s segment_id=%s ffmpeg_cmd=%s returncode=%s stderr_preview=%s",
                    project_id,
                    segment_id,
                    ffmpeg_cmd_str,
                    "oserror",
                    str(e)[:500],
                )
                log_ai_error(logger, "mock_video", "mock-ffmpeg", f"ffmpeg_oserror: {e}", project_id=project_id)
                raise ShortDramaVideoProviderError(f"Mock ffmpeg failed: {e}") from e

            elapsed_ms = int((time.perf_counter() - t0) * 1000)
            if proc.returncode != 0:
                stderr = (proc.stderr or b"").decode("utf-8", errors="replace").strip()
                if len(stderr) > 2000:
                    stderr = stderr[:2000] + "…"
                logger.error(
                    "[FFMPEG_COMMAND_FAIL] project_id=%s segment_id=%s ffmpeg_cmd=%s returncode=%s stderr_preview=%s",
                    project_id,
                    segment_id,
                    ffmpeg_cmd_str,
                    proc.returncode,
                    stderr[:500],
                )
                log_ai_error(
                    logger,
                    "mock_video",
                    "mock-ffmpeg",
                    f"ffmpeg_exit={proc.returncode} stderr={stderr or '(empty)'}",
                    project_id=project_id,
                )
                raise ShortDramaVideoProviderError(
                    f"Mock ffmpeg failed (exit {proc.returncode}): {stderr or 'unknown error'}"
                )
            logger.info(
                "[FFMPEG_COMMAND_SUCCESS] project_id=%s segment_id=%s ffmpeg_cmd=%s",
                project_id,
                segment_id,
                ffmpeg_cmd_str,
            )

            try:
                video_bytes = out_path.read_bytes()
            except OSError as e:
                raise ShortDramaVideoProviderError(f"Mock ffmpeg output not readable: {e}") from e
            if not video_bytes:
                raise ShortDramaVideoProviderError("Mock ffmpeg produced empty MP4 file")
        finally:
            try:
                out_path.unlink(missing_ok=True)
            except OSError:
                pass

        log_ai_response(
            logger,
            "mock_video",
            "mock-ffmpeg",
            project_id=project_id,
            segment_id=segment_id,
            phase="complete_segment_video",
            video_bytes=len(video_bytes),
            duration_ms=elapsed_ms,
            video_url="",
        )
        return SegmentVideoResult(
            video_bytes=video_bytes,
            provider_video_url=None,
            provider_metadata={
                "provider": "mock",
                "model": "mock-ffmpeg",
                "request_id": "mock",
                "duration_seconds": dur,
            },
        )


def build_xai_video_provider() -> SegmentVideoProvider:
    is_prod = _is_production_env()
    provider_env = str(os.getenv("VIDEO_PROVIDER") or "").strip().lower()
    explicit_mock = provider_env == "mock" or _is_truthy(os.getenv("MOCK_VIDEO_PROVIDER"))
    legacy_mock = bool(settings.SHORT_DRAMA_USE_MOCK_VIDEO_PROVIDER)
    use_mock = explicit_mock or (provider_env == "" and legacy_mock)

    if is_prod and use_mock:
        raise ShortDramaVideoProviderError(_PRODUCTION_VIDEO_PROVIDER_ERROR)

    if use_mock:
        logger.warning("[VIDEO_PROVIDER] MOCK provider ENABLED")
        return MockXAIVideoProvider()

    if provider_env == "railway_xai_proxy":
        from .railway_xai_video_proxy import RailwayXAIVideoProxyProvider

        base = (
            (settings.RAILWAY_XAI_VIDEO_PROXY_BASE_URL or "").strip()
            or (settings.AI_PROXY_BASE_URL or "").strip()
        )
        token = (
            (settings.RAILWAY_XAI_VIDEO_PROXY_TOKEN or "").strip()
            or (settings.AI_PROXY_TOKEN or "").strip()
        )
        if not base:
            raise ShortDramaVideoProviderError(
                "RAILWAY_XAI_VIDEO_PROXY_BASE_URL is required when VIDEO_PROVIDER=railway_xai_proxy "
                "(or set AI_PROXY_BASE_URL)"
            )
        if not token:
            raise ShortDramaVideoProviderError(
                "RAILWAY_XAI_VIDEO_PROXY_TOKEN is required when VIDEO_PROVIDER=railway_xai_proxy "
                "(or set AI_PROXY_TOKEN)"
            )
        logger.info("[VIDEO_PROVIDER] RAILWAY_XAI_PROXY video provider ENABLED")
        return RailwayXAIVideoProxyProvider()

    if provider_env == "seedance":
        from .seedance_video_provider import SeedanceVideoProvider

        ark_key = (settings.ARK_API_KEY or "").strip()
        if not ark_key:
            raise ShortDramaVideoProviderError("ARK_API_KEY is required when VIDEO_PROVIDER=seedance")
        logger.info("[VIDEO_PROVIDER] SEEDANCE provider ENABLED")
        return SeedanceVideoProvider()

    if is_prod and not (settings.XAI_API_KEY or "").strip():
        raise ShortDramaVideoProviderError(_PRODUCTION_VIDEO_PROVIDER_ERROR)

    logger.info("[VIDEO_PROVIDER] XAI provider ENABLED")
    return XAIVideoProvider()
