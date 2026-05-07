from __future__ import annotations

from typing import Any, Protocol, runtime_checkable

from .generated_image import GeneratedImage


@runtime_checkable
class AssetImageProvider(Protocol):
    """Pluggable Short Drama asset image backend (text-to-image now; edit reserved)."""

    def generate_from_text(
        self,
        *,
        prompt: str,
        asset_type: str,
        project_id: int,
        asset_id: int,
        metadata: dict[str, Any] | None = None,
    ) -> GeneratedImage:
        """Return raw image bytes; business layer writes to static + DB."""

    def edit_from_images(
        self,
        *,
        prompt: str,
        asset_type: str,
        project_id: int,
        asset_id: int,
        images: list[Any],
        metadata: dict[str, Any] | None = None,
    ) -> GeneratedImage:
        """Reserved: multi-reference edits (xAI / Gemini). Implementations may raise if unsupported."""

    def capabilities(self) -> dict[str, Any]:
        """e.g. provider_id, text_to_image, image_edit."""
