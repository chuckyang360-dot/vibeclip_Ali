"""Shared types for short-drama segment video providers (xAI, Seedance, mock)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol


@dataclass
class SegmentVideoResult:
    video_bytes: bytes
    provider_video_url: str | None
    provider_metadata: dict[str, Any]


class SegmentVideoProvider(Protocol):
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
    ) -> str: ...

    def complete_segment_video(
        self,
        *,
        request_id: str,
        project_id: int,
        segment_id: str,
        duration_seconds: int = 6,
    ) -> SegmentVideoResult: ...

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
    ) -> SegmentVideoResult: ...
