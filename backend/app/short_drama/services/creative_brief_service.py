from __future__ import annotations

import json
import logging
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.sql import func

from ...config import settings
from ..models import ShortDramaProject
from ..providers.xai_text_provider import XAITextProvider, get_xai_text_provider
from ..schemas.product import ProductImageInputSchema, ProductImageUnderstandingSchema, ProductRawInputSchema
from ..utils.enums import ProjectStatus
from .image_understanding_service import product_image_understanding_service
from .project_state_service import STEP_1, mark_step_completed, normalize_step_status, propagate_downstream_stale, update_last_active_step

logger = logging.getLogger(__name__)

S0_S1_STATE_KEY = "_s0_s1"

CREATIVE_BRIEF_SYSTEM_PROMPT = """You generate the S0/S1 creative brief for a short-drama video workflow.
Output ONLY one JSON object. No markdown, no code fences, no commentary.

Important boundaries:
- Platform, duration, and aspect ratio values from the user are hints only, not fixed rules.
- Do not infer a fixed number of segments from duration hints.
- Do not infer a fixed story structure from platform hints.
- Do not infer shot templates from aspect ratio hints.
- Do not use product category templates. Understand this product from supplied text and image understanding.
- The goal is to understand what the user wants to create and how the product may be expressed.
- Put uncertainty in uncertainties. Do not invent product functions, claims, certifications, or facts.
- If a product function cannot be confirmed from image or text, do not state it as fact.

Language rules:
- JSON keys must stay in English exactly as shown in the schema.
- JSON string values must use the same language as creative_intent_input.intent_text.
- If creative_intent_input.intent_text is Chinese, all user-facing text inside user_goal, product_understanding,
  creative_intent, ai_interpretation, and uncertainties must be Chinese.
- Preserve user-provided platform names as written. For example, if the user wrote "小红书", keep "小红书"; do not
  force it into "Xiaohongshu".
- image_understanding may contain English source text. Translate or rewrite the final creative_brief values into
  the user's language for display.

Required JSON shape:
{
  "user_goal": "string",
  "product_understanding": {
    "what_it_is": "string",
    "key_visual_features": ["string"],
    "likely_use_situations": ["string"],
    "avoid_notes": ["string"]
  },
  "creative_intent": {
    "platform_context": "string",
    "tone": "string",
    "desired_emphasis": ["string"],
    "avoid": ["string"]
  },
  "ai_interpretation": {
    "core_direction": "string",
    "possible_story_space": ["string"],
    "visual_direction": "string",
    "risk_notes": ["string"]
  },
  "uncertainties": ["string"]
}
"""


def _state(project: ShortDramaProject) -> dict[str, Any]:
    raw = project.step_status if isinstance(project.step_status, dict) else {}
    node = raw.get(S0_S1_STATE_KEY)
    return dict(node) if isinstance(node, dict) else {}


def get_s0_s1_state(project: ShortDramaProject) -> dict[str, Any]:
    return _state(project)


def update_s0_s1_state(project: ShortDramaProject, patch: dict[str, Any]) -> dict[str, Any]:
    status_map = normalize_step_status(project.step_status)
    node = dict(status_map.get(S0_S1_STATE_KEY) or {})
    node.update(patch)
    status_map[S0_S1_STATE_KEY] = node
    project.step_status = status_map
    project.updated_at = func.now()
    return node


def normalize_creative_intent_input(raw: dict[str, Any] | None) -> dict[str, Any]:
    raw = raw or {}
    return {
        "intent_text": str(raw.get("intent_text") or "").strip(),
        "platform_hints": [str(x).strip() for x in (raw.get("platform_hints") or []) if str(x).strip()],
        "duration_hint": str(raw.get("duration_hint") or "").strip(),
        "aspect_ratio_hint": str(raw.get("aspect_ratio_hint") or "").strip(),
    }


def normalize_product_input(raw: dict[str, Any] | None) -> dict[str, Any]:
    raw = raw or {}
    images: list[dict[str, Any]] = []
    for idx, item in enumerate(raw.get("product_images") or []):
        row = item if isinstance(item, dict) else {}
        url = str(row.get("url") or row.get("image_url") or "").strip()
        if not url:
            continue
        images.append(
            {
                "url": url,
                "image_order": row.get("image_order") if isinstance(row.get("image_order"), int) else idx,
                "is_main_image": bool(row.get("is_main_image")),
                "image_caption_raw": str(row.get("image_caption_raw") or "").strip(),
            }
        )
    return {
        "product_images": images,
        "product_note": str(raw.get("product_note") or "").strip(),
        "product_url": str(raw.get("product_url") or "").strip(),
    }


def _product_raw_input(product_input: dict[str, Any]) -> ProductRawInputSchema:
    note = str(product_input.get("product_note") or "").strip()
    product_url = str(product_input.get("product_url") or "").strip()
    extra_notes = note if not product_url else f"{note}\nProduct URL: {product_url}".strip()
    images = []
    for idx, row in enumerate(product_input.get("product_images") or []):
        item = row if isinstance(row, dict) else {}
        images.append(
            ProductImageInputSchema(
                image_url=str(item.get("url") or item.get("image_url") or "").strip(),
                image_order=int(item.get("image_order") if isinstance(item.get("image_order"), int) else idx),
                is_main_image=bool(item.get("is_main_image")),
                image_caption_raw=str(item.get("image_caption_raw") or "").strip(),
            )
        )
    return ProductRawInputSchema(extra_notes_raw=extra_notes, product_images=images)


def _build_product_understanding(
    *,
    product_input: dict[str, Any],
    image_understanding: ProductImageUnderstandingSchema,
    creative_brief: dict[str, Any] | None = None,
) -> dict[str, Any]:
    brief_product = creative_brief.get("product_understanding") if isinstance(creative_brief, dict) else {}
    brief_product = brief_product if isinstance(brief_product, dict) else {}
    return {
        "source": {
            "image_understanding": image_understanding.model_dump(),
            "user_product_input": product_input,
        },
        "product_summary": str(brief_product.get("what_it_is") or "").strip(),
        "visual_identity": {
            "key_visual_features": list(brief_product.get("key_visual_features") or []),
        },
        "use_contexts": list(brief_product.get("likely_use_situations") or []),
        "likely_selling_angles": [],
        "avoid_notes": list(brief_product.get("avoid_notes") or []),
        "uncertainties": list((creative_brief or {}).get("uncertainties") or []),
    }


def product_context_from_creative_brief(creative_brief: dict[str, Any]) -> dict[str, Any]:
    product = creative_brief.get("product_understanding") if isinstance(creative_brief.get("product_understanding"), dict) else {}
    intent = creative_brief.get("creative_intent") if isinstance(creative_brief.get("creative_intent"), dict) else {}
    interpretation = creative_brief.get("ai_interpretation") if isinstance(creative_brief.get("ai_interpretation"), dict) else {}
    return {
        "product_name": "",
        "product_category": "",
        "product_summary": str(product.get("what_it_is") or "").strip(),
        "core_selling_points": [str(x).strip() for x in product.get("likely_use_situations") or [] if str(x).strip()],
        "target_users": [],
        "usage_scenarios": [str(x).strip() for x in product.get("likely_use_situations") or [] if str(x).strip()],
        "visual_features": [str(x).strip() for x in product.get("key_visual_features") or [] if str(x).strip()],
        "product_form": str(product.get("what_it_is") or "").strip(),
        "key_functions": [str(x).strip() for x in intent.get("desired_emphasis") or [] if str(x).strip()],
        "emotional_value": [],
        "suitable_story_angles": [str(x).strip() for x in interpretation.get("possible_story_space") or [] if str(x).strip()],
        "user_pain_points": [],
        "visual_risk_notes": [str(x).strip() for x in (product.get("avoid_notes") or intent.get("avoid") or []) if str(x).strip()],
        "consistency_notes": [],
        "immutable_structure_constraints": [],
        "extracted_from_images": [str(x).strip() for x in product.get("key_visual_features") or [] if str(x).strip()],
        "parse_confidence": 0.0,
        "source_trace": {},
        "field_meta": {},
    }


class CreativeBriefService:
    def __init__(self, text_provider: XAITextProvider | None = None):
        self._text = text_provider or get_xai_text_provider()

    def generate_for_project(self, db: Session, project_id: int) -> dict[str, Any]:
        project = db.query(ShortDramaProject).filter(ShortDramaProject.id == project_id).first()
        if not project:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

        state = _state(project)
        creative_intent_input = normalize_creative_intent_input(state.get("creative_intent_input"))
        product_input = normalize_product_input(state.get("product_input"))
        if not creative_intent_input["intent_text"]:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="请先完成创作意图。")
        if not product_input["product_images"] and not product_input["product_note"]:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="请至少上传商品图片或补充商品信息。")

        raw_input = _product_raw_input(product_input)
        image_understanding = product_image_understanding_service.understand(project_id, raw_input)

        if settings.SHORT_DRAMA_USE_MOCK_TEXT_PROVIDER:
            creative_brief = {
                "user_goal": creative_intent_input["intent_text"],
                "product_understanding": {
                    "what_it_is": product_input["product_note"],
                    "key_visual_features": image_understanding.detected_visual_features,
                    "likely_use_situations": [],
                    "avoid_notes": image_understanding.detected_quality_risks,
                },
                "creative_intent": {
                    "platform_context": ", ".join(creative_intent_input["platform_hints"]),
                    "tone": "",
                    "desired_emphasis": [],
                    "avoid": [],
                },
                "ai_interpretation": {
                    "core_direction": creative_intent_input["intent_text"],
                    "possible_story_space": [],
                    "visual_direction": "",
                    "risk_notes": [],
                },
                "uncertainties": [],
            }
        else:
            payload = {
                "project_id": project_id,
                "creative_intent_input": creative_intent_input,
                "product_input": {
                    **product_input,
                    "product_images": [
                        {k: v for k, v in row.items() if k != "url"} for row in product_input["product_images"]
                    ],
                    "product_image_count": len(product_input["product_images"]),
                },
                "image_understanding": image_understanding.model_dump(),
            }
            logger.info("[CREATIVE_BRIEF_PROMPT] %s", json.dumps(payload, ensure_ascii=False, default=str))
            creative_brief = self._text.generate_structured_json(
                project_id=project_id,
                service_name="creative_brief",
                system_prompt=CREATIVE_BRIEF_SYSTEM_PROMPT,
                user_payload=payload,
                image_urls=None,
                expected_schema_name="CreativeBrief",
                stage="CREATIVE_BRIEF_GENERATION",
            )

        product_understanding = _build_product_understanding(
            product_input=product_input,
            image_understanding=image_understanding,
            creative_brief=creative_brief,
        )
        creative_brief = {
            **creative_brief,
            "source_inputs": {
                "creative_intent_input": creative_intent_input,
                "product_input": product_input,
            },
        }
        update_s0_s1_state(
            project,
            {
                "product_understanding": product_understanding,
                "creative_brief": creative_brief,
                "creative_brief_status": "success",
                "creative_brief_error": "",
            },
        )
        mark_step_completed(project, STEP_1)
        propagate_downstream_stale(project, STEP_1)
        update_last_active_step(project, STEP_1)
        project.status = ProjectStatus.PRODUCT_PARSED.value
        db.add(project)
        db.commit()
        return {
            "project_id": project_id,
            "product_understanding": product_understanding,
            "creative_brief": creative_brief,
        }


creative_brief_service = CreativeBriefService()
