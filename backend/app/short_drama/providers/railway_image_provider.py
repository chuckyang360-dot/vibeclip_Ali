from __future__ import annotations

import hashlib
import logging
from typing import Any

from ...config import settings
from ..exceptions import ShortDramaImageProviderError
from .generated_image import GeneratedImage
from .railway_image_proxy import (
    effective_railway_image_proxy_base_url,
    effective_railway_image_proxy_timeout_seconds,
    railway_create_image_from_text,
)
from .xai_image_client import XaiImageClient, effective_xai_image_model

logger = logging.getLogger(__name__)

_PROVIDER_ID = "railway_proxy"


class RailwayImageProvider:
    """S3 asset images via Railway AI Proxy → upstream xAI images API (no ECS direct)."""

    def __init__(self, download_client: XaiImageClient | None = None):
        self._download_client = download_client or XaiImageClient()

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
            "Railway image proxy edit is not enabled in this build (use text-to-image only)",
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
        proxy_base = effective_railway_image_proxy_base_url()
        timeout_sec = effective_railway_image_proxy_timeout_seconds()

        logger.info(
            "[IMAGE_RENDER_STARTED] provider=%s model=%s project_id=%s target_type=%s target_id=%s "
            "image_proxy_base_url=%s timeout_seconds=%s direct=false",
            _PROVIDER_ID,
            model,
            project_id,
            asset_type,
            asset_id,
            proxy_base,
            timeout_sec,
        )
        try:
            url, _b64, raw_opt = railway_create_image_from_text(
                project_id=project_id,
                target_type=asset_type,
                target_id=asset_id,
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
                raw, mime = self._download_client.download_url(url)
            else:
                raise ShortDramaImageProviderError(
                    "railway image response invalid: neither url nor image bytes",
                    category="xai_response_invalid",
                )
        except ShortDramaImageProviderError:
            logger.warning(
                "[IMAGE_RENDER_FAILED] provider=%s model=%s project_id=%s target_type=%s target_id=%s direct=false",
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
                "[IMAGE_RENDER_FAILED] provider=%s model=%s project_id=%s target_type=%s target_id=%s direct=false",
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
            "via_railway_proxy": True,
        }
        logger.info(
            "[IMAGE_RENDER_SUCCESS] provider=%s model=%s project_id=%s target_type=%s target_id=%s direct=false",
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
