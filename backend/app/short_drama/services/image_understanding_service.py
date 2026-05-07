from __future__ import annotations

import logging
import json
import re
from typing import Any

from ...config import settings
from ..providers.xai_text_provider import XAITextProvider, get_xai_text_provider
from ..schemas.product import ProductImageUnderstandingSchema, ProductRawInputSchema
from ..utils.prompts import (
    ASSET_CREATE_FROM_IMAGE_SYSTEM_PROMPT,
    ASSET_REFERENCE_IMAGE_ANALYSIS_SYSTEM_PROMPT,
    PRODUCT_IMAGE_UNDERSTANDING_SYSTEM_PROMPT,
)

logger = logging.getLogger(__name__)
SUPPORTED_IMAGE_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}
_DATA_URL_RE = re.compile(r"^data:(image/[a-zA-Z0-9.+-]+);base64,", re.IGNORECASE)

_S1_IMAGE_UNDERSTANDING_LIST_FIELDS = (
    "detected_visual_features",
    "detected_materials",
    "detected_colors",
    "detected_usage_context",
    "detected_people_type",
    "detected_pose_or_usage",
    "detected_packaging",
    "detected_brand_clues",
    "detected_quality_risks",
    "image_conflicts",
    "per_image_notes",
)


def _trace(tag: str, payload: dict[str, Any]) -> None:
    logger.info("[AI_CHAIN_TRACE][%s] %s", tag, json.dumps(payload, ensure_ascii=False, default=str))


def _normalize_image_understanding_list_fields(project_id: int, data: dict[str, Any]) -> dict[str, Any]:
    out = dict(data or {})
    for field in _S1_IMAGE_UNDERSTANDING_LIST_FIELDS:
        if field not in out:
            continue
        value = out.get(field)
        original_type = type(value).__name__
        if value is None:
            out[field] = []
            logger.warning(
                "[S1_IMAGE_UNDERSTANDING_FIELD_NORMALIZED] project_id=%s field=%s original_type=%s normalized_type=%s reason=%s",
                project_id,
                field,
                original_type,
                "list",
                "none_to_empty_list",
            )
            continue
        if isinstance(value, str):
            text = value.strip()
            if not text:
                out[field] = []
                logger.warning(
                    "[S1_IMAGE_UNDERSTANDING_FIELD_NORMALIZED] project_id=%s field=%s original_type=%s normalized_type=%s reason=%s",
                    project_id,
                    field,
                    original_type,
                    "list",
                    "blank_string_to_empty_list",
                )
            else:
                out[field] = [text]
                logger.warning(
                    "[S1_IMAGE_UNDERSTANDING_FIELD_NORMALIZED] project_id=%s field=%s original_type=%s normalized_type=%s reason=%s",
                    project_id,
                    field,
                    original_type,
                    "list",
                    "string_wrapped_to_list",
                )
            continue
        if isinstance(value, list):
            continue
    return out


def _build_s1_image_understanding_text_payload(raw_input: ProductRawInputSchema) -> dict[str, Any]:
    image_items: list[dict[str, Any]] = []
    for row in raw_input.product_images:
        image_items.append(
            {
                "image_order": int(row.image_order or 0),
                "is_main_image": bool(row.is_main_image),
            }
        )
    return {
        "product_name_raw": raw_input.product_name_raw,
        "product_category_raw": raw_input.product_category_raw,
        "brand_raw": raw_input.brand_raw,
        "price_raw": raw_input.price_raw,
        "target_users_raw": raw_input.target_users_raw,
        "selling_points_raw": list(raw_input.selling_points_raw or []),
        "usage_scenarios_raw": list(raw_input.usage_scenarios_raw or []),
        "extra_notes_raw": raw_input.extra_notes_raw,
        "product_images_summary": {
            "image_count": len(image_items),
            "items": image_items,
        },
    }


def validate_supported_image_data_url(image_data_url: str) -> str:
    text = str(image_data_url or "").strip()
    if not text:
        raise ValueError("Unsupported image format. Please upload JPG, PNG, or WebP.")
    match = _DATA_URL_RE.match(text)
    if not match:
        raise ValueError("Unsupported image format. Please upload JPG, PNG, or WebP.")
    mime = str(match.group(1) or "").lower()
    if mime not in SUPPORTED_IMAGE_MIME_TYPES:
        raise ValueError("Unsupported image format. Please upload JPG, PNG, or WebP.")
    return mime


def _as_text(value: Any) -> str:
    return str(value or "").strip()


def _safe_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


class ProductImageUnderstandingService:
    def __init__(self, text_provider: XAITextProvider | None = None):
        self._text = text_provider or get_xai_text_provider()

    def understand(self, project_id: int, raw_input: ProductRawInputSchema) -> ProductImageUnderstandingSchema:
        image_urls = [row.image_url for row in raw_input.product_images if row.image_url]
        logger.info(
            "[S1_IMAGE_UNDERSTANDING_START] project_id=%s image_count=%s use_mock=%s",
            project_id,
            len(image_urls),
            settings.SHORT_DRAMA_USE_MOCK_TEXT_PROVIDER,
        )
        if not image_urls:
            out = ProductImageUnderstandingSchema()
            logger.info("[S1_IMAGE_UNDERSTANDING_RESULT] project_id=%s result=%s", project_id, out.model_dump())
            return out
        if settings.SHORT_DRAMA_USE_MOCK_TEXT_PROVIDER:
            out = ProductImageUnderstandingSchema(
                detected_product_type=raw_input.product_category_raw,
                detected_visual_features=["mock_visual_feature"],
                per_image_notes=[{"image_url": u, "note": "mock"} for u in image_urls],
            )
            logger.info("[S1_IMAGE_UNDERSTANDING_RESULT] project_id=%s result=%s", project_id, out.model_dump())
            return out
        text_payload = _build_s1_image_understanding_text_payload(raw_input)
        text_payload_json = json.dumps(text_payload, ensure_ascii=False)
        contains_data_url_in_text = "data:image" in text_payload_json.lower()
        contains_base64_marker_in_text = "base64," in text_payload_json.lower()
        logger.info(
            "[S1_IMAGE_PAYLOAD_SANITIZED] project_id=%s image_count=%s image_input_count=%s text_chars=%s contains_data_url_in_text=%s contains_base64_marker_in_text=%s",
            project_id,
            len(image_urls),
            len(image_urls),
            len(text_payload_json),
            contains_data_url_in_text,
            contains_base64_marker_in_text,
        )
        if contains_data_url_in_text:
            logger.warning(
                "[S1_IMAGE_PAYLOAD_TEXT_CONTAINS_DATA_URL] project_id=%s image_count=%s",
                project_id,
                len(image_urls),
            )
        payload: dict[str, Any] = {
            "project_id": project_id,
            "raw_input": text_payload,
        }
        _trace(
            "S1_IMAGE_UNDERSTANDING_PROMPT",
            {
                "project_id": project_id,
                "system_prompt": PRODUCT_IMAGE_UNDERSTANDING_SYSTEM_PROMPT,
                "user_payload": payload,
                "image_urls_count": len(image_urls),
                "provider": "xai_text_provider",
                "model": "effective_xai_text_model",
            },
        )
        data = self._text.generate_structured_json(
            project_id=project_id,
            service_name="product_image_understanding",
            system_prompt=PRODUCT_IMAGE_UNDERSTANDING_SYSTEM_PROMPT,
            user_payload=payload,
            image_urls=image_urls,
            expected_schema_name="ProductImageUnderstanding",
            stage="PRODUCT_IMAGE_UNDERSTANDING",
        )
        data = _normalize_image_understanding_list_fields(project_id, data)
        _trace(
            "S1_IMAGE_UNDERSTANDING_RESPONSE",
            {"project_id": project_id, "response": data},
        )
        out = ProductImageUnderstandingSchema.model_validate(data)
        logger.info("[S1_IMAGE_UNDERSTANDING_RESULT] project_id=%s result=%s", project_id, out.model_dump())
        return out


class AssetImageUnderstandingService:
    def __init__(self, text_provider: XAITextProvider | None = None):
        self._text = text_provider or get_xai_text_provider()

    def analyze_reference_image(
        self,
        *,
        project_id: int,
        image_data_url: str,
        asset_context: dict[str, Any],
        project_context: dict[str, Any],
    ) -> dict[str, Any]:
        validate_supported_image_data_url(image_data_url)
        payload = {
            "project_id": project_id,
            "mode": "existing_asset_reference_analysis",
            "asset_context": asset_context,
            "project_context": project_context,
        }
        data = self._text.generate_structured_json(
            project_id=project_id,
            service_name="asset_reference_image_analysis",
            system_prompt=ASSET_REFERENCE_IMAGE_ANALYSIS_SYSTEM_PROMPT,
            user_payload=payload,
            image_urls=[image_data_url],
            expected_schema_name="AssetReferenceImageAnalysis",
            stage="ASSET_REFERENCE_IMAGE_ANALYSIS",
        )
        return {
            "is_same_asset": bool(data.get("is_same_asset", True)),
            "visual_description": _as_text(data.get("visual_description")),
            "image_prompt": _as_text(data.get("image_prompt")),
            "change_summary": _as_text(data.get("change_summary")),
        }

    def create_asset_from_image(
        self,
        *,
        project_id: int,
        asset_type: str,
        image_data_url: str,
        optional_name: str | None,
        project_context: dict[str, Any],
    ) -> dict[str, Any]:
        validate_supported_image_data_url(image_data_url)
        normalized_type = _as_text(asset_type).lower()
        payload = {
            "project_id": project_id,
            "mode": "create_asset_from_image",
            "asset_type": normalized_type,
            "optional_name": _as_text(optional_name),
            "project_context": project_context,
        }
        data = self._text.generate_structured_json(
            project_id=project_id,
            service_name="asset_create_from_image",
            system_prompt=ASSET_CREATE_FROM_IMAGE_SYSTEM_PROMPT,
            user_payload=payload,
            image_urls=[image_data_url],
            expected_schema_name="AssetCreateFromImage",
            stage="ASSET_CREATE_FROM_IMAGE",
        )
        out = _safe_dict(data)
        result_type = _as_text(out.get("asset_type")).lower() or normalized_type
        return {
            "asset_type": result_type if result_type in {"character", "scene", "product"} else normalized_type,
            "name": _as_text(out.get("name")),
            "position": _as_text(out.get("position")),
            "visual_description": _as_text(out.get("visual_description")),
            "image_prompt": _as_text(out.get("image_prompt")),
        }


product_image_understanding_service = ProductImageUnderstandingService()
asset_image_understanding_service = AssetImageUnderstandingService()
