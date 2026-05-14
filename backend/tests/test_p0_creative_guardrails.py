"""P0 guardrails: no silent blueprint rewrite, no asset bundle synthesis, video_prompt required."""

from __future__ import annotations

import pytest

from app.short_drama.exceptions import ShortDramaInvalidModelOutputError, ShortDramaVideoInputError
from app.short_drama.schemas.product import ProductContextSchema
from app.short_drama.schemas.segment import SegmentScriptSchema, ShotSchema
from app.short_drama.schemas.story import (
    SegmentPlanItemSchema,
    StoryBlueprintSchema,
    default_creative_blueprint_v2_attachment,
)
from app.short_drama.services.asset_spec_service import asset_bundle_from_story_requirements
from app.short_drama.services.story_planner_service import _normalize_blueprint_for_execution
from app.short_drama.utils.video_prompt_builder import build_segment_video_plan


def _minimal_product() -> ProductContextSchema:
    return ProductContextSchema(
        product_name="TestProduct",
        product_category="cat",
        product_summary="summary",
        core_selling_points=["a", "b"],
        target_users=["u1"],
        usage_scenarios=[],
        visual_features=["vf1"],
        product_form="",
        key_functions=[],
        emotional_value=[],
        suitable_story_angles=[],
        user_pain_points=[],
        visual_risk_notes=[],
        consistency_notes=[],
        immutable_structure_constraints=[],
        extracted_from_images=[],
        parse_confidence=0.0,
        source_trace={},
        field_meta={},
    )


def _minimal_project_config() -> dict:
    return {
        "project_id": 1,
        "duration": "45s",
        "format": "single_ad",
        "style": "light_conflict",
        "visual_style": "realistic_cinematic",
        "aspect_ratio": "9:16",
        "target_market": "North America",
        "marketing_goal": "brand_seeding",
        "target_audience": "young adults",
        "brand_tone": "natural",
        "creative_intent": "",
        "creative_brief": "",
        "workflow_language": "zh-CN",
        "video_language": "zh-CN",
        "language_policy": {"workflow_language": "zh-CN", "video_language": "zh-CN", "target_market": "North America"},
        "creative_brief_data": {
            "project_constraints": {"duration_sec": 45, "target_market": "North America"},
            "market_context": {},
            "visual_constraints": {},
        },
    }


def _with_v2(bp: StoryBlueprintSchema) -> StoryBlueprintSchema:
    return StoryBlueprintSchema.model_validate(
        {**bp.model_dump(), **default_creative_blueprint_v2_attachment(product_name="TestProduct")}
    )


def test_normalize_preserves_shot_plan_segments_and_shots():
    product = _minimal_product()
    cfg = _minimal_project_config()
    original_shots = [{"id": "s1", "video_prompt": "ORIGINAL_PROMPT_KEEP"}]
    bp = StoryBlueprintSchema(
        title="t",
        script_title="t",
        script_structure_type="story_drama",
        script_type_display="剧情",
        structure_type_display="a → b",
        structure_reason_for_user="reason text long enough",
        segment_plan=[
            SegmentPlanItemSchema(
                segment_id="seg_1",
                stage_name="开场",
                title="T1",
                segment_title="T1",
                segment_goal="g",
                goal="g",
                summary="sum",
                transition_to_next="next",
                duration_seconds=10.0,
                story_beat="hook",
                source_selling_point="a",
                key_message="a",
                target_user_trigger="u1",
                required_assets=["r1"],
            )
        ],
        story_framework={"type": "story_drama", "name": "n", "structure": ["开场"], "reason": "r"},
        shot_plan={"segments": [{"id": "seg_1", "name": "n1", "shots": original_shots}]},
        asset_requirements={"characters": [{"name": "c"}], "scenes": [{"name": "s"}], "products": [{"name": "p"}]},
    )
    out = _normalize_blueprint_for_execution(_with_v2(bp), product, cfg)
    seg0 = out.shot_plan["segments"][0]
    assert seg0["shots"][0]["video_prompt"] == "ORIGINAL_PROMPT_KEEP"


def test_normalize_rejects_empty_shot_plan_shots():
    product = _minimal_product()
    cfg = _minimal_project_config()
    bp = StoryBlueprintSchema(
        title="t",
        script_title="t",
        script_structure_type="story_drama",
        script_type_display="剧情",
        structure_type_display="a → b",
        structure_reason_for_user="reason",
        segment_plan=[
            SegmentPlanItemSchema(
                segment_id="seg_1",
                stage_name="开场",
                title="T1",
                segment_title="T1",
                segment_goal="g",
                goal="g",
                summary="sum",
                transition_to_next="next",
                duration_seconds=10.0,
                story_beat="hook",
                source_selling_point="a",
                key_message="a",
                target_user_trigger="u1",
                required_assets=["r1"],
            )
        ],
        story_framework={"type": "story_drama", "name": "n", "structure": ["开场"], "reason": "r"},
        shot_plan={"segments": [{"id": "seg_1", "name": "n1", "shots": []}]},
        asset_requirements={"characters": [{"name": "c"}], "scenes": [{"name": "s"}], "products": [{"name": "p"}]},
    )
    with pytest.raises(ShortDramaInvalidModelOutputError):
        _normalize_blueprint_for_execution(_with_v2(bp), product, cfg)


def test_asset_bundle_raises_when_requirements_empty():
    product = _minimal_product()
    bp = StoryBlueprintSchema(
        segment_plan=[
            SegmentPlanItemSchema(
                segment_id="seg_1",
                stage_name="开场",
                title="T1",
                segment_title="T1",
                segment_goal="g",
                goal="g",
                summary="sum",
                transition_to_next="next",
                duration_seconds=10.0,
                story_beat="hook",
                source_selling_point="a",
                key_message="a",
                target_user_trigger="u1",
                required_assets=["r1"],
            )
        ],
        story_framework={"type": "story_drama", "name": "n", "structure": ["开场"], "reason": "r"},
        script_structure_type="story_drama",
        script_type_display="剧情",
        structure_type_display="x",
        structure_reason_for_user="reason",
        shot_plan={"segments": [{"id": "seg_1", "shots": [{"id": "x", "video_prompt": "p"}]}]},
        asset_requirements={},
    )
    with pytest.raises(ShortDramaInvalidModelOutputError):
        asset_bundle_from_story_requirements(bp, product=product, project_config={"project_id": 2})


def test_video_prompt_missing_raises():
    seg = SegmentScriptSchema(
        segment_id="seg_1",
        shots=[
            ShotSchema(
                shot_id="1",
                video_prompt="",
                visual_action="walk",
                action_description="walk",
            )
        ],
    )
    with pytest.raises(ShortDramaVideoInputError):
        build_segment_video_plan(
            seg,
            characters=[],
            scenes=[],
            products=[],
            project_aspect_ratio="9:16",
            project_id=3,
        )
