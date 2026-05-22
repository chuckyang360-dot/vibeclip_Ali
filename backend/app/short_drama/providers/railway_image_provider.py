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
from ..utils.ai_runtime_config import STAGE_S3_ASSET_MANAGEMENT, get_ai_runtime_config

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
        ai_cfg = get_ai_runtime_config(STAGE_S3_ASSET_MANAGEMENT)
        model = (ai_cfg.model_id or "").strip() or effective_xai_image_model()
        provider = (ai_cfg.provider or "").strip().lower() or None
        meta_in = metadata or {}
        proxy_base = effective_railway_image_proxy_base_url()
        timeout_sec = effective_railway_image_proxy_timeout_seconds()

        logger.info(
            "[IMAGE_RENDER_STARTED] provider=%s model=%s project_id=%s target_type=%s target_id=%s "
            "image_proxy_base_url=%s timeout_seconds=%s response_format=r2_url direct=false",
            _PROVIDER_ID,
            model,
            project_id,
            asset_type,
            asset_id,
            proxy_base,
            timeout_sec,
        )
        image_source = "r2_url"
        try:
            proxy_result = railway_create_image_from_text(
                project_id=project_id,
                target_type=asset_type,
                target_id=asset_id,
                prompt=prompt,
                model=model,
                provider=provider,
                response_format="r2_url",
                aspect_ratio=(settings.SHORT_DRAMA_IMAGE_ASPECT_RATIO or "").strip() or None,
                resolution=(settings.SHORT_DRAMA_IMAGE_RESOLUTION or "").strip() or None,
            )
            if proxy_result.response_format == "r2_url" and proxy_result.remote_url:
                mime = proxy_result.mime_type or "image/jpeg"
                raw = b""
                remote_url = proxy_result.remote_url
            elif proxy_result.raw_bytes is not None:
                image_source = "b64_json"
                raw = proxy_result.raw_bytes
                mime = proxy_result.mime_type or "image/png"
                remote_url = None
            elif proxy_result.remote_url:
                image_source = "url_fallback"
                logger.warning(
                    "[RAILWAY_PROXY_IMAGE_URL_FALLBACK_DOWNLOAD] provider=%s project_id=%s target_type=%s "
                    "target_id=%s image_url=%s",
                    _PROVIDER_ID,
                    project_id,
                    asset_type,
                    asset_id,
                    proxy_result.remote_url[:240],
                )
                raw, mime = self._download_client.download_url(proxy_result.remote_url)
                remote_url = None
            else:
                raise ShortDramaImageProviderError(
                    "railway image response invalid: no r2 url, bytes, or fallback url",
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
            "response_format": "r2_url",
            "via_railway_proxy": True,
            "configured_provider": provider,
            "ai_stage_key": STAGE_S3_ASSET_MANAGEMENT,
            "image_source": image_source,
            "storage": proxy_result.storage,
        }
        logger.info(
            "[IMAGE_RENDER_SUCCESS] provider=%s model=%s project_id=%s target_type=%s target_id=%s "
            "direct=false source=%s",
            _PROVIDER_ID,
            model,
            project_id,
            asset_type,
            asset_id,
            image_source,
        )
        return GeneratedImage(
            data=raw,
            mime_type=mime,
            provider=_PROVIDER_ID,
            model=model,
            meta=out_meta,
            remote_url=remote_url,
        )
