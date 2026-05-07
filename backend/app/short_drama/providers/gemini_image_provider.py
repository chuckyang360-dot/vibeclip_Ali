from __future__ import annotations

import hashlib
import logging
from typing import Any

from ...config import settings
from ..exceptions import ShortDramaImageProviderError
from .gemini_image_client import GeminiImageClient, effective_gemini_image_model
from .generated_image import GeneratedImage

logger = logging.getLogger(__name__)

_GEMINI_ID = "gemini_image"
_MOCK_ID = "mock_gemini_image"


class GeminiImageProvider:
    """Gemini text-to-image for Short Drama assets."""

    def __init__(self, client: GeminiImageClient | None = None):
        self._client = client or GeminiImageClient()

    def capabilities(self) -> dict[str, Any]:
        return {
            "provider_id": _GEMINI_ID,
            "text_to_image": True,
            "image_edit": False,
        }

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
        raise ShortDramaImageProviderError(
            "Gemini image edit is not enabled in this build",
            category="unsupported",
        )

    def generate_from_text(
        self,
        *,
        prompt: str,
        asset_type: str,
        project_id: int,
        asset_id: int,
        metadata: dict[str, Any] | None = None,
    ) -> GeneratedImage:
        model = effective_gemini_image_model()
        meta_in = metadata or {}
        log_ctx = {
            "project_id": project_id,
            "asset_id": asset_id,
            "asset_type": asset_type,
            "provider": _GEMINI_ID,
            "model": model,
        }
        logger.info(
            "[IMAGE_RENDER_STARTED] provider=%s model=%s project_id=%s target_type=%s target_id=%s",
            _GEMINI_ID,
            model,
            project_id,
            asset_type,
            asset_id,
        )
        try:
            raw, mime = self._client.generate_image_from_text(
                prompt=prompt,
                model=model,
                log_context=log_ctx,
            )
        except Exception:
            logger.warning(
                "[IMAGE_RENDER_FAILED] provider=%s model=%s project_id=%s target_type=%s target_id=%s",
                _GEMINI_ID,
                model,
                project_id,
                asset_type,
                asset_id,
                exc_info=True,
            )
            raise
        prompt_hash = hashlib.sha256(prompt.encode("utf-8")).hexdigest()[:16]
        out_meta = {
            "provider": _GEMINI_ID,
            "model": model,
            "prompt_hash": prompt_hash,
            "generation_seed": meta_in.get("generation_seed"),
            "style_tags": meta_in.get("style_tags") or ["commercial_short_drama", "clean_composition"],
        }
        logger.info(
            "[IMAGE_RENDER_SUCCESS] provider=%s model=%s project_id=%s target_type=%s target_id=%s",
            _GEMINI_ID,
            model,
            project_id,
            asset_type,
            asset_id,
        )
        return GeneratedImage(data=raw, mime_type=mime, provider=_GEMINI_ID, model=model, meta=out_meta)

    def generate_image_from_prompt(
        self,
        *,
        prompt: str,
        asset_type: str,
        project_id: int,
        asset_id: int,
        metadata: dict[str, Any] | None = None,
    ) -> GeneratedImage:
        return self.generate_from_text(
            prompt=prompt,
            asset_type=asset_type,
            project_id=project_id,
            asset_id=asset_id,
            metadata=metadata,
        )


class MockGeminiImageProvider:
    """1×1 PNG placeholder; no external calls."""

    _PNG_1X1 = bytes(
        [
            0x89,
            0x50,
            0x4E,
            0x47,
            0x0D,
            0x0A,
            0x1A,
            0x0A,
            0x00,
            0x00,
            0x00,
            0x0D,
            0x49,
            0x48,
            0x44,
            0x52,
            0x00,
            0x00,
            0x00,
            0x01,
            0x00,
            0x00,
            0x00,
            0x01,
            0x08,
            0x06,
            0x00,
            0x00,
            0x00,
            0x1F,
            0x15,
            0xC4,
            0x89,
            0x00,
            0x00,
            0x00,
            0x0A,
            0x49,
            0x44,
            0x41,
            0x54,
            0x78,
            0x9C,
            0x63,
            0x00,
            0x01,
            0x00,
            0x00,
            0x05,
            0x00,
            0x01,
            0x0D,
            0x0A,
            0x2D,
            0xB4,
            0x00,
            0x00,
            0x00,
            0x00,
            0x49,
            0x45,
            0x4E,
            0x44,
            0xAE,
            0x42,
            0x60,
            0x82,
        ]
    )

    def capabilities(self) -> dict[str, Any]:
        return {
            "provider_id": _MOCK_ID,
            "text_to_image": True,
            "image_edit": False,
        }

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
        raise ShortDramaImageProviderError(
            "Mock image provider does not support image edit",
            category="unsupported",
        )

    def generate_from_text(
        self,
        *,
        prompt: str,
        asset_type: str,
        project_id: int,
        asset_id: int,
        metadata: dict[str, Any] | None = None,
    ) -> GeneratedImage:
        model = effective_gemini_image_model()
        meta_in = metadata or {}
        logger.info(
            "[IMAGE_RENDER_STARTED] provider=%s model=%s project_id=%s target_type=%s target_id=%s",
            _MOCK_ID,
            model,
            project_id,
            asset_type,
            asset_id,
        )
        try:
            prompt_hash = hashlib.sha256(prompt.encode("utf-8")).hexdigest()[:16]
            seed = meta_in.get("generation_seed")
            if seed is None:
                seed = hash(f"{project_id}:{asset_id}:{asset_type}:{prompt_hash}") % (2**31)
            out_meta = {
                "provider": _MOCK_ID,
                "model": model,
                "prompt_hash": prompt_hash,
                "generation_seed": seed,
                "style_tags": meta_in.get("style_tags") or ["commercial_short_drama", "clean_composition"],
            }
            logger.info(
                "[IMAGE_RENDER_SUCCESS] provider=%s model=%s project_id=%s target_type=%s target_id=%s",
                _MOCK_ID,
                model,
                project_id,
                asset_type,
                asset_id,
            )
            return GeneratedImage(
                data=self._PNG_1X1,
                mime_type="image/png",
                provider=_MOCK_ID,
                model=model,
                meta=out_meta,
            )
        except Exception:
            logger.warning(
                "[IMAGE_RENDER_FAILED] provider=%s model=%s project_id=%s target_type=%s target_id=%s",
                _MOCK_ID,
                model,
                project_id,
                asset_type,
                asset_id,
                exc_info=True,
            )
            raise

    def generate_image_from_prompt(
        self,
        *,
        prompt: str,
        asset_type: str,
        project_id: int,
        asset_id: int,
        metadata: dict[str, Any] | None = None,
    ) -> GeneratedImage:
        return self.generate_from_text(
            prompt=prompt,
            asset_type=asset_type,
            project_id=project_id,
            asset_id=asset_id,
            metadata=metadata,
        )
