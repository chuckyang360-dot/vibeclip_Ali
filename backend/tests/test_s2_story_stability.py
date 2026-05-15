"""S2 story planner: dedicated model/token + compact payload helpers."""

from __future__ import annotations

import json

import pytest

from app.config import settings
from app.short_drama.providers.xai_client import (
    effective_xai_story_max_output_tokens,
    effective_xai_story_model,
)
from app.short_drama.schemas.product import ProductContextSchema
from app.short_drama.services.story_planner_service import (
    _validate_s2_payload_for_provider,
    build_s2_compact_context,
    _compact_creative_context_for_story,
    _compact_product_for_story,
    _compact_project_config_for_story,
)
from app.short_drama.utils.prompts import STORY_PLANNER_SYSTEM_PROMPT


def test_effective_xai_story_model_respects_override(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "XAI_STORY_MODEL", "grok-story-override")
    monkeypatch.setattr(settings, "XAI_TEXT_MODEL", "grok-global")
    assert effective_xai_story_model() == "grok-story-override"


def test_effective_xai_story_model_falls_back_to_global(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "XAI_STORY_MODEL", None)
    monkeypatch.setattr(settings, "XAI_TEXT_MODEL", "grok-global-fallback")
    monkeypatch.setattr(settings, "XAI_MODEL", None)
    assert effective_xai_story_model() == "grok-global-fallback"


def test_effective_xai_story_max_output_tokens_floor(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "XAI_STORY_MAX_OUTPUT_TOKENS", 100)
    assert effective_xai_story_max_output_tokens() == 1024


def test_story_planner_system_prompt_is_compact() -> None:
    assert len(STORY_PLANNER_SYSTEM_PROMPT) < 9000
    assert "creative_blueprint_v2" in STORY_PLANNER_SYSTEM_PROMPT
    assert "asset_generation_specs" in STORY_PLANNER_SYSTEM_PROMPT


def test_s2_compact_payload_smaller_than_full_dump() -> None:
    product = ProductContextSchema(
        product_name="P",
        product_category="c",
        product_summary="s",
        core_selling_points=["a"],
        target_users=["u"],
        usage_scenarios=[],
        visual_features=["v"],
        product_form="",
        key_functions=[],
        emotional_value=[],
        suitable_story_angles=[],
        user_pain_points=[],
        visual_risk_notes=[],
        consistency_notes=[],
        immutable_structure_constraints=[],
        extracted_from_images=["big"],
        parse_confidence=0.9,
        source_trace={"product_name": "user_input"},
        field_meta={"x": {"edited_by_user": True}},
    )
    full = len(json.dumps(product.model_dump(), ensure_ascii=False))
    compact = len(json.dumps(_compact_product_for_story(product), ensure_ascii=False))
    assert compact < full
    assert "extracted_from_images" not in _compact_product_for_story(product)
    assert "source_trace" not in _compact_product_for_story(product)
    assert "emotional_value" not in _compact_product_for_story(product)
    assert "suitable_story_angles" not in _compact_product_for_story(product)
    assert "visual_risk_notes" not in _compact_product_for_story(product)
    assert "consistency_notes" not in _compact_product_for_story(product)

    cfg = {
        "project_id": 1,
        "duration": "45s",
        "target_market": "Korea",
        "language_policy": {"workflow_language": "zh-CN", "target_market": "Korea"},
        "creative_brief_data": {
            "market_context": {"description": "m"},
            "visual_constraints": {"description": "v"},
            "creative_strategy": {"market_context": {"description": "m"}},
            "project_constraints": {"duration_sec": 45, "target_market": "North America"},
            "product_facts": {"name": "P", "product_visual_features": ["f"]},
            "extra_heavy": {"nested": list(range(50))},
        },
    }
    cc = _compact_creative_context_for_story(cfg)
    assert "extra_heavy" not in cc
    assert "market_context" not in cc
    assert "visual_constraints" not in cc
    assert "creative_strategy" not in cc
    assert cc["project_constraints"]["target_market"] == "Korea"
    pc = _compact_project_config_for_story(cfg)
    assert "creative_brief_data" not in pc


def test_s2_compact_context_omits_raw_product_image_data() -> None:
    long_base64 = "A" * 1_000_000
    project_config = {
        "language_policy": {"workflow_language": "zh-CN", "target_market": "China"},
        "creative_brief_data": {
            "user_goal": "做一个小红书种草短片",
            "product_understanding": {"product_summary": "便携咖啡杯", "raw_image": f"data:image/png;base64,{long_base64}"},
            "source_inputs": {
                "product_input": {
                    "product_images": [{"url": f"data:image/jpeg;base64,{long_base64}"}],
                }
            },
        },
        "source_inputs": {
            "creative_intent_input": {
                "intent_text": "做一个小红书种草短片",
                "platform_hints": ["小红书"],
                "duration_hint": "30s",
                "aspect_ratio_hint": "9:16",
            },
            "product_input": {
                "product_images": [{"url": f"data:image/jpeg;base64,{long_base64}", "image_url": f"data:image/jpeg;base64,{long_base64}"}],
                "product_note": "轻便、适合通勤",
                "product_url": "",
            },
            "product_understanding": {
                "product_summary": "便携咖啡杯",
                "visual_identity": {"raw_image": f"data:image/png;base64,{long_base64}"},
            },
        },
    }

    payload = build_s2_compact_context(project_id=16, project_config=project_config)
    payload_json = json.dumps(payload, ensure_ascii=False)

    assert _validate_s2_payload_for_provider(16, payload) < 100_000
    assert "data:image" not in payload_json
    assert "base64," not in payload_json
    assert long_base64 not in payload_json
    assert "source_inputs" not in payload["creative_brief"]
    assert payload["source_summary"] == {
        "has_product_images": True,
        "product_image_count": 1,
        "product_note": "轻便、适合通勤",
        "product_url_present": False,
    }
