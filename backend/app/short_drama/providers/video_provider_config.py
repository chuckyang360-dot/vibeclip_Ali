"""Resolve video model name for RenderJob / logs by active provider label."""

from __future__ import annotations

from ...config import settings
from .seedance_video_client import effective_seedance_video_model
from .xai_video_client import effective_xai_video_model
from ..utils.ai_runtime_config import STAGE_S4_VIDEO_GENERATION, get_ai_runtime_config


def effective_video_model_for_provider(provider_label: str) -> str:
    label = (provider_label or "").strip().lower()
    cfg = get_ai_runtime_config(STAGE_S4_VIDEO_GENERATION)
    configured_model = (cfg.model_id or "").strip()
    configured_provider = (cfg.provider or "").strip().lower()
    if label == "seedance":
        if configured_provider == "seedance" and configured_model:
            return configured_model
        return effective_seedance_video_model()
    if label == "mock":
        return "mock-ffmpeg"
    if label in {"xai", "railway_xai_proxy"}:
        if configured_model and configured_provider in {"xai", "grok", "gemini"}:
            return configured_model
        return effective_xai_video_model()
    return settings.XAI_VIDEO_MODEL or effective_xai_video_model()
