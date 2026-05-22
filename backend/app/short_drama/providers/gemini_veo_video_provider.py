"""Google Gemini Veo provider using the SegmentVideoProvider contract."""

from __future__ import annotations

from typing import Any

from ..exceptions import ShortDramaVideoProviderError
from .gemini_veo_video_client import (
    GeminiVeoVideoClient,
    effective_gemini_video_model,
    extract_gemini_video_uri,
)
from .segment_video_types import SegmentVideoResult


class GeminiVeoVideoProvider:
    def __init__(self, client: GeminiVeoVideoClient | None = None):
        self._client = client or GeminiVeoVideoClient()

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
        model = effective_gemini_video_model()
        try:
            return self._client.create_video_operation(
                model=model,
                prompt=prompt,
                reference_image_urls=reference_image_urls,
                duration_seconds=int(duration_seconds),
                aspect_ratio=aspect_ratio,
                resolution=resolution,
                project_id=project_id,
                segment_id=segment_id,
            )
        except ShortDramaVideoProviderError:
            raise
        except Exception as e:
            raise ShortDramaVideoProviderError(f"Gemini Veo video submit failed: {e}") from e

    def complete_segment_video(
        self,
        *,
        request_id: str,
        project_id: int,
        segment_id: str,
        duration_seconds: int = 6,
    ) -> SegmentVideoResult:
        _ = duration_seconds
        model = effective_gemini_video_model()
        try:
            final = self._client.poll_video_operation(
                operation_name=request_id,
                project_id=project_id,
                segment_id=segment_id,
            )
            video_uri = extract_gemini_video_uri(final)
            if not video_uri:
                raise ShortDramaVideoProviderError(
                    f"Gemini Veo result missing video URI (operation={request_id}): {final!r}"
                )
            data = self._client.download_video_bytes(
                video_uri=video_uri,
                project_id=project_id,
                segment_id=segment_id,
                operation_name=request_id,
            )
            meta: dict[str, Any] = {
                "provider": "gemini_veo",
                "model": model,
                "request_id": request_id,
                "operation_name": request_id,
                "raw_status_payload_keys": list(final.keys()) if isinstance(final, dict) else [],
            }
            return SegmentVideoResult(
                video_bytes=data,
                provider_video_url=video_uri,
                provider_metadata=meta,
            )
        except ShortDramaVideoProviderError:
            raise
        except Exception as e:
            raise ShortDramaVideoProviderError(f"Gemini Veo video generation failed: {e}") from e

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
