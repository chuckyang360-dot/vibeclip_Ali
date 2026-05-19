"""Resolve video model name for RenderJob / logs by active provider label."""

from __future__ import annotations

from ...config import settings
from .seedance_video_client import effective_seedance_video_model
from .xai_video_client import effective_xai_video_model


def effective_video_model_for_provider(provider_label: str) -> str:
    label = (provider_label or "").strip().lower()
    if label == "seedance":
        return effective_seedance_video_model()
    if label == "mock":
        return "mock-ffmpeg"
    if label in {"xai", "railway_xai_proxy"}:
        return effective_xai_video_model()
    return settings.XAI_VIDEO_MODEL or effective_xai_video_model()
