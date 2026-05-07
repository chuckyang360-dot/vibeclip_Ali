from __future__ import annotations

import hashlib
import logging
from typing import Any

from ...config import settings
from ..exceptions import ShortDramaImageProviderError
from .generated_image import GeneratedImage
from .xai_image_client import XaiImageClient, effective_xai_image_model

logger = logging.getLogger(__name__)

_PROVIDER_ID = "xai_image"


class XaiImageProvider:
    """xAI grok-imagine-image text-to-image; returns downloaded bytes (not CDN URLs)."""

    def __init__(self, client: XaiImageClient | None = None):
        self._client = client or XaiImageClient()

    def capabilities(self) -> dict[str, Any]:
        return {
            "provider_id": _PROVIDER_ID,
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
            "xAI image edit is not enabled in this build (use text-to-image only)",
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
        model = effective_xai_image_model()
        meta_in = metadata or {}
        fmt = (settings.SHORT_DRAMA_IMAGE_RETURN_FORMAT or "url").strip().lower()

        logger.info(
            "[IMAGE_RENDER_STARTED] provider=%s model=%s project_id=%s target_type=%s target_id=%s",
            _PROVIDER_ID,
            model,
            project_id,
            asset_type,
            asset_id,
        )
        try:
            url, _b64, raw_opt = self._client.create_image_from_text(
                prompt=prompt,
                model=model,
                response_format=fmt,
                aspect_ratio=(settings.SHORT_DRAMA_IMAGE_ASPECT_RATIO or "").strip() or None,
                resolution=(settings.SHORT_DRAMA_IMAGE_RESOLUTION or "").strip() or None,
            )
            if raw_opt is not None:
                raw = raw_opt
                mime = "image/png"
            elif url:
                raw, mime = self._client.download_url(url)
            else:
                raise ShortDramaImageProviderError(
                    "xAI response invalid: neither url nor image bytes",
                    category="xai_response_invalid",
                )
        except ShortDramaImageProviderError:
            logger.warning(
                "[IMAGE_RENDER_FAILED] provider=%s model=%s project_id=%s target_type=%s target_id=%s",
                _PROVIDER_ID,
                model,
                project_id,
                asset_type,
                asset_id,
                exc_info=True,
            )
            raise
        except Exception as e:
            logger.warning(
                "[IMAGE_RENDER_FAILED] provider=%s model=%s project_id=%s target_type=%s target_id=%s",
                _PROVIDER_ID,
                model,
                project_id,
                asset_type,
                asset_id,
                exc_info=True,
            )
            raise ShortDramaImageProviderError(str(e), category="provider") from e

        prompt_hash = hashlib.sha256(prompt.encode("utf-8")).hexdigest()[:16]
        out_meta = {
            "provider": _PROVIDER_ID,
            "model": model,
            "prompt_hash": prompt_hash,
            "generation_seed": meta_in.get("generation_seed"),
            "style_tags": meta_in.get("style_tags") or ["commercial_short_drama", "clean_composition"],
            "response_format": fmt,
        }
        logger.info(
            "[IMAGE_RENDER_SUCCESS] provider=%s model=%s project_id=%s target_type=%s target_id=%s",
            _PROVIDER_ID,
            model,
            project_id,
            asset_type,
            asset_id,
        )
        return GeneratedImage(
            data=raw,
            mime_type=mime,
            provider=_PROVIDER_ID,
            model=model,
            meta=out_meta,
        )

    def generate_image_from_prompt(
        self,
        *,
        prompt: str,
        asset_type: str,
        project_id: int,
        asset_id: int,
        metadata: dict[str, Any] | None = None,
    ) -> GeneratedImage:
        """Backward-compatible alias for older call sites / tests."""
        return self.generate_from_text(
            prompt=prompt,
            asset_type=asset_type,
            project_id=project_id,
            asset_id=asset_id,
            metadata=metadata,
        )
