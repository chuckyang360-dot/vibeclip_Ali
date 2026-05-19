from __future__ import annotations

from ...config import settings
from ..exceptions import ShortDramaImageProviderError
from .gemini_image_provider import GeminiImageProvider, MockGeminiImageProvider
from .image_provider_protocol import AssetImageProvider
from .railway_image_proxy import image_provider_wants_railway_proxy
from .railway_image_provider import RailwayImageProvider
from .xai_image_provider import XaiImageProvider


def build_short_drama_image_provider() -> AssetImageProvider:
    """Select image backend from SHORT_DRAMA_IMAGE_PROVIDER (xai|gemini|mock|railway_proxy).

    When AI_PROVIDER=railway_proxy and image provider is xai (default), routes through Railway.
    Legacy: SHORT_DRAMA_USE_MOCK_IMAGE_PROVIDER=true forces mock without changing provider key.
    """
    if settings.SHORT_DRAMA_USE_MOCK_IMAGE_PROVIDER:
        return MockGeminiImageProvider()

    kind = (settings.SHORT_DRAMA_IMAGE_PROVIDER or "xai").strip().lower()
    if kind == "mock":
        return MockGeminiImageProvider()
    if kind == "gemini":
        return GeminiImageProvider()
    if image_provider_wants_railway_proxy():
        return RailwayImageProvider()
    if kind == "xai":
        return XaiImageProvider()
    raise ShortDramaImageProviderError(
        f"Invalid SHORT_DRAMA_IMAGE_PROVIDER={kind!r}; expected xai, gemini, mock, or railway_proxy",
        category="configuration",
    )
