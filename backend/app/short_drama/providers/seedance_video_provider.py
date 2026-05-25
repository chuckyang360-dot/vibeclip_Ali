"""Seedance 2.0 video provider (Volcano Ark) — same SegmentVideoProvider contract as xAI."""

from __future__ import annotations

import logging
from typing import Any

from ...config import settings
from ..exceptions import ShortDramaVideoProviderError
from ..utils.ai_runtime_config import STAGE_S4_VIDEO_GENERATION, get_ai_runtime_config
from .seedance_video_client import (
    SeedanceVideoClient,
    effective_seedance_video_model,
    extract_video_url,
)
from .segment_video_types import SegmentVideoResult

logger = logging.getLogger(__name__)


def _active_seedance_video_model() -> str:
    ai_cfg = get_ai_runtime_config(STAGE_S4_VIDEO_GENERATION)
    provider = (ai_cfg.provider or "").strip().lower()
    model = (ai_cfg.model_id or "").strip()
    if model and (provider == "seedance" or "seedance" in model.lower() or model.lower().startswith("doubao-seedance")):
        return model
    return effective_seedance_video_model()


class SeedanceVideoProvider:
    def __init__(self, client: SeedanceVideoClient | None = None):
        self._client = client or SeedanceVideoClient()

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
        _ = resolution
        model = _active_seedance_video_model()
        ratio = (aspect_ratio or "").strip() or (settings.SEEDANCE_DEFAULT_RATIO or "9:16")
        logger.info(
            "[SEEDANCE_VIDEO_PROVIDER_ROUTE] project_id=%s segment_id=%s route=direct_cn api_base=%s model=%s",
            project_id,
            segment_id,
            getattr(self._client, "_base", ""),
            model,
        )
        try:
            return self._client.create_video_task(
                model=model,
                prompt=prompt,
                reference_image_urls=reference_image_urls,
                duration_seconds=int(duration_seconds),
                ratio=ratio,
                generate_audio=bool(settings.SEEDANCE_GENERATE_AUDIO),
                watermark=bool(settings.SEEDANCE_WATERMARK),
                project_id=project_id,
                segment_id=segment_id,
            )
        except ShortDramaVideoProviderError:
            raise
        except Exception as e:
            raise ShortDramaVideoProviderError(f"Seedance video submit failed: {e}") from e

    def complete_segment_video(
        self,
        *,
        request_id: str,
        project_id: int,
        segment_id: str,
        duration_seconds: int = 6,
    ) -> SegmentVideoResult:
        _ = duration_seconds
        model = _active_seedance_video_model()
        task_id = request_id
        try:
            final = self._client.poll_video_task(
                task_id=task_id,
                project_id=project_id,
                segment_id=segment_id,
            )
            vurl = extract_video_url(final)
            if not vurl:
                raise ShortDramaVideoProviderError(
                    f"Seedance video result missing video URL (task_id={task_id}): {final!r}"
                )
            data = self._client.download_video_bytes(
                video_url=vurl,
                project_id=project_id,
                segment_id=segment_id,
                task_id=task_id,
            )
            meta: dict[str, Any] = {
                "provider": "seedance",
                "model": model,
                "request_id": task_id,
                "task_id": task_id,
                "raw_status_payload_keys": list(final.keys()) if isinstance(final, dict) else [],
            }
            return SegmentVideoResult(
                video_bytes=data,
                provider_video_url=vurl,
                provider_metadata=meta,
            )
        except ShortDramaVideoProviderError:
            raise
        except Exception as e:
            raise ShortDramaVideoProviderError(f"Seedance video generation failed: {e}") from e

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
