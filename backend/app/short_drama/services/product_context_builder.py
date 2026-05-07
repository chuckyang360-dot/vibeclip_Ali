from __future__ import annotations

import logging
import json
from typing import Any

from ...config import settings
from ..providers.xai_text_provider import XAITextProvider, get_xai_text_provider
from ..schemas.product import ProductContextSchema, ProductImageUnderstandingSchema, ProductRawInputSchema
from ..utils.prompts import PRODUCT_CONTEXT_BUILDER_SYSTEM_PROMPT

logger = logging.getLogger(__name__)


def _trace(tag: str, payload: dict[str, Any]) -> None:
    logger.info("[AI_CHAIN_TRACE][%s] %s", tag, json.dumps(payload, ensure_ascii=False, default=str))


class ProductContextBuilderService:
    def __init__(self, text_provider: XAITextProvider | None = None):
        self._text = text_provider or get_xai_text_provider()

    def build(
        self,
        project_id: int,
        raw_input: ProductRawInputSchema,
        image_understanding: ProductImageUnderstandingSchema,
        project_constraints: dict[str, Any] | None = None,
    ) -> ProductContextSchema:
        if settings.SHORT_DRAMA_USE_MOCK_TEXT_PROVIDER:
            out = ProductContextSchema(
                product_name=raw_input.product_name_raw or "未命名产品",
                product_category=raw_input.product_category_raw,
                product_summary=f"{raw_input.product_name_raw}，适用于{raw_input.target_users_raw}"[:220],
                core_selling_points=list(raw_input.selling_points_raw)[:8],
                target_users=[raw_input.target_users_raw] if raw_input.target_users_raw else [],
                usage_scenarios=list(raw_input.usage_scenarios_raw)[:8],
                visual_features=list(image_understanding.detected_visual_features)[:10],
                product_form="",
                key_functions=list(raw_input.selling_points_raw)[:6],
                emotional_value=[],
                suitable_story_angles=["场景代入型", "痛点型"],
                user_pain_points=[],
                visual_risk_notes=list(image_understanding.detected_quality_risks)[:8],
                consistency_notes=["主体外观与主图保持一致"],
                immutable_structure_constraints=[],
                extracted_from_images=list(image_understanding.detected_visual_features)[:10],
                parse_confidence=0.55,
                source_trace={
                    "product_name": "user_input",
                    "visual_features": "image_understanding",
                    "product_summary": "merged_inference",
                },
            )
            out = _normalize_product_context(out, raw_input, image_understanding)
            logger.info("[S1_CONTEXT_BUILDER_RESULT] project_id=%s result=%s", project_id, out.model_dump())
            return out

        payload = {
            "project_id": project_id,
            "raw_input": raw_input.model_dump(),
            "image_understanding": image_understanding.model_dump(),
            "project_constraints": project_constraints or {},
            "creative_intent": (project_constraints or {}).get("creative_intent") or (project_constraints or {}).get("legacy_creative_intent_summary") or "",
            "language_policy": (project_constraints or {}).get("language_policy", {}),
            "language_prompt_rules": (project_constraints or {}).get("language_prompt_rules", ""),
        }
        _trace(
            "S1_CONTEXT_BUILDER_PROMPT",
            {
                "project_id": project_id,
                "system_prompt": PRODUCT_CONTEXT_BUILDER_SYSTEM_PROMPT,
                "user_payload": payload,
                "input_source": {
                    "raw_input": "S1 user form",
                    "image_understanding": "S1 image understanding response",
                    "project_constraints": "S0 project config / language policy",
                },
            },
        )
        data = self._text.generate_structured_json(
            project_id=project_id,
            service_name="product_context_builder",
            system_prompt=PRODUCT_CONTEXT_BUILDER_SYSTEM_PROMPT,
            user_payload=payload,
            image_urls=None,
            expected_schema_name="ProductContext",
            stage="PRODUCT_CONTEXT_BUILD",
        )
        data = _normalize_source_trace(project_id, data)
        _trace(
            "S1_CONTEXT_BUILDER_RESPONSE",
            {"project_id": project_id, "product_context_before_normalize": data},
        )
        out = _normalize_product_context(ProductContextSchema.model_validate(data), raw_input, image_understanding)
        _trace(
            "S1_CONTEXT_NORMALIZED",
            {"project_id": project_id, "product_context_after_normalize": out.model_dump()},
        )
        logger.info("[S1_CONTEXT_BUILDER_RESULT] project_id=%s result=%s", project_id, out.model_dump())
        return out


def _normalize_product_context(
    ctx: ProductContextSchema,
    raw_input: ProductRawInputSchema,
    image_understanding: ProductImageUnderstandingSchema,
) -> ProductContextSchema:
    data = ctx.model_dump()
    trace = dict(ctx.source_trace or {})
    for field, value in data.items():
        if field in {"source_trace", "field_meta"}:
            continue
        has_value = bool(value) if not isinstance(value, (list, dict)) else len(value) > 0
        if has_value and field not in trace:
            if field in {
                "visual_features",
                "product_form",
                "visual_risk_notes",
                "consistency_notes",
                "immutable_structure_constraints",
                "extracted_from_images",
            }:
                trace[field] = "image_understanding"
            elif field in {"product_name", "product_category", "target_users", "core_selling_points", "usage_scenarios"}:
                trace[field] = "user_input"
            else:
                trace[field] = "model_inference"

    conflicts = [str(x).strip() for x in image_understanding.image_conflicts if str(x).strip()]
    notes = list(ctx.visual_risk_notes or [])
    for c in conflicts:
        note = c if c.lower().startswith("conflict:") else f"conflict: {c}"
        if note not in notes:
            notes.append(note)
    if image_understanding.detected_visual_features:
        merged_visual = list(dict.fromkeys([*ctx.visual_features, *image_understanding.detected_visual_features]))
    else:
        merged_visual = ctx.visual_features
    if not ctx.product_form and image_understanding.detected_product_type:
        data["product_form"] = image_understanding.detected_product_type
        trace["product_form"] = "image_understanding"
    data["visual_features"] = merged_visual
    data["user_pain_points"] = [
        str(x).strip()
        for x in (ctx.user_pain_points or [])
        if str(x).strip() and not any(term in str(x) for term in ("不要", "禁止", "不能", "不可", "避免"))
    ]
    data["visual_risk_notes"] = notes
    data["source_trace"] = trace
    field_meta = dict(ctx.field_meta or {})
    for field, origin in trace.items():
        if field in data and field not in {"source_trace", "field_meta"}:
            existing = field_meta.get(field) if isinstance(field_meta.get(field), dict) else {}
            field_meta[field] = {**existing, "origin": origin}
    data["field_meta"] = field_meta
    if not data.get("product_name") and raw_input.product_name_raw:
        data["product_name"] = raw_input.product_name_raw
        trace["product_name"] = "user_input"
    return ProductContextSchema.model_validate(data)


def _normalize_source_trace_value(value: Any) -> str:
    allowed = {"user_input", "image_understanding", "merged_inference", "model_inference"}

    if isinstance(value, list):
        parts = {str(v).strip() for v in value if str(v).strip()}
    else:
        raw = str(value or "").strip()
        parts = {p.strip() for p in raw.replace(",", "|").split("|") if p.strip()}

    if not parts:
        return "merged_inference"

    if parts.issubset(allowed) and len(parts) == 1:
        return next(iter(parts))

    if "merged_inference" in parts:
        return "merged_inference"

    if "model_inference" in parts:
        return "model_inference"

    if "user_input" in parts and "image_understanding" in parts:
        return "merged_inference"

    if "user_input" in parts:
        return "user_input"

    if "image_understanding" in parts:
        return "image_understanding"

    return "merged_inference"


def _normalize_source_trace(project_id: int, data: dict[str, Any]) -> dict[str, Any]:
    source_trace = data.get("source_trace")
    if not isinstance(source_trace, dict):
        data["source_trace"] = {}
        return data

    before_values: dict[str, Any] = {}
    after_values: dict[str, str] = {}
    normalized_fields: list[str] = []
    normalized_trace: dict[str, str] = {}
    for key, value in source_trace.items():
        normalized = _normalize_source_trace_value(value)
        normalized_trace[str(key)] = normalized
        if value != normalized:
            normalized_fields.append(str(key))
            before_values[str(key)] = value
            after_values[str(key)] = normalized
    data["source_trace"] = normalized_trace
    if normalized_fields:
        logger.info(
            "[S1_SOURCE_TRACE_NORMALIZED] project_id=%s normalized_fields=%s before_values=%s after_values=%s",
            project_id,
            normalized_fields,
            before_values,
            after_values,
        )
    return data


product_context_builder_service = ProductContextBuilderService()
