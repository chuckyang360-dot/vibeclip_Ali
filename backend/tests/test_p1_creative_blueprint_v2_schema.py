"""P1: Creative Blueprint v2 schema + normalize validation."""

from __future__ import annotations

import pytest

from app.short_drama.exceptions import ShortDramaInvalidModelOutputError
from app.short_drama.schemas.product import ProductContextSchema
from app.short_drama.schemas.story import (
    StoryBlueprintSchema,
    default_creative_blueprint_v2_attachment,
    parse_story_blueprint_json,
)
from app.short_drama.services.story_planner_service import (
    XAIStoryPlannerProvider,
    _normalize_blueprint_for_execution,
    _validate_creative_blueprint_v2,
)


def _product() -> ProductContextSchema:
    return ProductContextSchema(
        product_name="DemoSKU",
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


def _project_config() -> dict:
    return {
        "project_id": 99,
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


def test_story_blueprint_schema_accepts_v2_roundtrip():
    raw = {
        "title": "T",
        "script_title": "T",
        "script_structure_type": "story_drama",
        "script_type_display": "d",
        "structure_type_display": "a → b",
        "structure_reason_for_user": "reason text long enough for normalize",
        "segment_plan": [],
        "story_framework": {"type": "story_drama", "name": "n", "structure": ["开场"], "reason": "r"},
        **default_creative_blueprint_v2_attachment(product_name="DemoSKU"),
    }
    bp = StoryBlueprintSchema.model_validate(raw)
    assert bp.asset_generation_specs[0].asset_kind == "character"
    assert bp.blueprint_schema_version == "creative_blueprint_v2"


def test_normalize_sets_version_and_preserves_v2_layers():
    from app.short_drama.schemas.story import SegmentPlanItemSchema

    product = _product()
    cfg = _project_config()
    v2 = default_creative_blueprint_v2_attachment(product_name=product.product_name)
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
        shot_plan={"segments": [{"id": "seg_1", "name": "n1", "shots": [{"id": "x", "video_prompt": "p"}]}]},
        asset_requirements={"characters": [{"name": "c"}], "scenes": [{"name": "s"}], "products": [{"name": "p"}]},
        **v2,
    )
    out = _normalize_blueprint_for_execution(bp, product, cfg)
    assert out.blueprint_schema_version == "creative_blueprint_v2"
    assert len(out.asset_generation_specs) == 3
    assert out.story_overview is not None


def test_normalize_accepts_minimal_asset_prompts_no_constraint_phrases():
    """S2 no longer requires no_xxx / white background phrases in asset_generation_specs."""
    from app.short_drama.schemas.story import SegmentPlanItemSchema

    product = _product()
    cfg = _project_config()
    v2 = default_creative_blueprint_v2_attachment(product_name=product.product_name)
    bad_specs = list(v2["asset_generation_specs"])
    bad_specs[0] = {
        **bad_specs[0],
        "image_prompt": "portrait of lead talent",
        "negative_prompt": "",
        "immutable_constraints": [],
    }
    v2_ok = {**v2, "asset_generation_specs": bad_specs}
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
        shot_plan={"segments": [{"id": "seg_1", "name": "n1", "shots": [{"id": "x", "video_prompt": "p"}]}]},
        asset_requirements={"characters": [{"name": "c"}], "scenes": [{"name": "s"}], "products": [{"name": "p"}]},
        **v2_ok,
    )
    out = _normalize_blueprint_for_execution(bp, product, cfg)
    assert out.blueprint_schema_version == "creative_blueprint_v2"


def test_parse_story_blueprint_json_maps_pydantic_to_domain_error():
    with pytest.raises(ShortDramaInvalidModelOutputError) as ei:
        parse_story_blueprint_json({"characters": "not-a-list"})
    assert ei.value.code == "ai_blueprint_validate_failed"
    assert ei.value.missing_fields


def test_legacy_field_type_flex_accepts_string_list_dict():
    v2 = default_creative_blueprint_v2_attachment(product_name="DemoSKU")
    raw = {
        **v2,
        "title": "T",
        "script_title": "T",
        "script_structure_type": "story_drama",
        "script_type_display": "d",
        "structure_type_display": "a → b",
        "structure_reason_for_user": "reason text long enough for normalize",
        "segment_plan": [
            {
                "segment_id": "seg_1",
                "stage_name": "开场",
                "title": "T1",
                "segment_title": "T1",
                "segment_goal": "g",
                "goal": "g",
                "summary": "sum",
                "transition_to_next": "next",
                "duration_seconds": 10.0,
                "story_beat": "hook",
                "source_selling_point": "a",
                "key_message": "a",
                "target_user_trigger": "u1",
                "required_assets": ["r1"],
            }
        ],
        "shot_plan": {"segments": [{"id": "seg_1", "name": "n1", "shots": [{"id": "x", "video_prompt": "p"}]}]},
        "scene_goals": ["unexpected", "list"],
        "product_selling_point_mapping": [{"k": "v"}],
        "visual_requirements": "single string blob",
        "marketing_strategy": "one line strategy",
        "story_structure": "arc as prose",
        "story_framework": {"type": "story_drama", "name": "n", "structure": ["开场"], "reason": "r"},
        "asset_requirements": "legacy string",
        "spoken_strategy": "vo style notes",
        "market_visual_constraints": "market notes",
        "visual_style_constraints": "style notes",
        "continuity_rules": [
            {
                "rule_key": "r1",
                "applies_to": "characters",
                "rule_text": "keep consistent",
                "severity": "medium",
            }
        ],
    }
    bp = parse_story_blueprint_json(raw)
    assert bp.scene_goals == ["unexpected", "list"]
    assert bp.visual_requirements == "single string blob"
    assert bp.continuity_rules[0].severity == "medium"
    out = _normalize_blueprint_for_execution(bp, _product(), _project_config())
    assert out.blueprint_schema_version == "creative_blueprint_v2"


def test_normalize_rejects_empty_asset_generation_specs():
    v2 = default_creative_blueprint_v2_attachment(product_name="DemoSKU")
    v2.pop("asset_generation_specs", None)
    raw = {
        **v2,
        "asset_generation_specs": [],
        "title": "T",
        "script_title": "T",
        "script_structure_type": "story_drama",
        "script_type_display": "d",
        "structure_type_display": "a → b",
        "structure_reason_for_user": "reason text long enough for normalize",
        "segment_plan": [
            {
                "segment_id": "seg_1",
                "stage_name": "开场",
                "title": "T1",
                "segment_title": "T1",
                "segment_goal": "g",
                "goal": "g",
                "summary": "sum",
                "transition_to_next": "next",
                "duration_seconds": 10.0,
                "story_beat": "hook",
                "source_selling_point": "a",
                "key_message": "a",
                "target_user_trigger": "u1",
                "required_assets": ["r1"],
            }
        ],
        "shot_plan": {"segments": [{"id": "seg_1", "name": "n1", "shots": [{"id": "x", "video_prompt": "p"}]}]},
        "story_framework": {"type": "story_drama", "name": "n", "structure": ["开场"], "reason": "r"},
    }
    bp = parse_story_blueprint_json(raw)
    with pytest.raises(ShortDramaInvalidModelOutputError):
        _normalize_blueprint_for_execution(bp, _product(), _project_config())


def test_normalize_rejects_empty_video_prompt():
    v2 = default_creative_blueprint_v2_attachment(product_name="DemoSKU")
    specs = list(v2["video_generation_specs"])
    specs[0] = {**specs[0], "video_prompt": "  "}
    raw = {
        **v2,
        "video_generation_specs": specs,
        "title": "T",
        "script_title": "T",
        "script_structure_type": "story_drama",
        "script_type_display": "d",
        "structure_type_display": "a → b",
        "structure_reason_for_user": "reason text long enough for normalize",
        "segment_plan": [
            {
                "segment_id": "seg_1",
                "stage_name": "开场",
                "title": "T1",
                "segment_title": "T1",
                "segment_goal": "g",
                "goal": "g",
                "summary": "sum",
                "transition_to_next": "next",
                "duration_seconds": 10.0,
                "story_beat": "hook",
                "source_selling_point": "a",
                "key_message": "a",
                "target_user_trigger": "u1",
                "required_assets": ["r1"],
            }
        ],
        "shot_plan": {"segments": [{"id": "seg_1", "name": "n1", "shots": [{"id": "x", "video_prompt": "p"}]}]},
        "story_framework": {"type": "story_drama", "name": "n", "structure": ["开场"], "reason": "r"},
        "asset_requirements": {"characters": [{"name": "c"}], "scenes": [{"name": "s"}], "products": [{"name": "p"}]},
    }
    bp = parse_story_blueprint_json(raw)
    with pytest.raises(ShortDramaInvalidModelOutputError):
        _normalize_blueprint_for_execution(bp, _product(), _project_config())


def test_normalize_rejects_bad_reference_asset_keys():
    v2 = default_creative_blueprint_v2_attachment(product_name="DemoSKU")
    specs = list(v2["video_generation_specs"])
    specs[0] = {**specs[0], "reference_asset_keys": ["no_such_asset_key"]}
    raw = {
        **v2,
        "video_generation_specs": specs,
        "title": "T",
        "script_title": "T",
        "script_structure_type": "story_drama",
        "script_type_display": "d",
        "structure_type_display": "a → b",
        "structure_reason_for_user": "reason text long enough for normalize",
        "segment_plan": [
            {
                "segment_id": "seg_1",
                "stage_name": "开场",
                "title": "T1",
                "segment_title": "T1",
                "segment_goal": "g",
                "goal": "g",
                "summary": "sum",
                "transition_to_next": "next",
                "duration_seconds": 10.0,
                "story_beat": "hook",
                "source_selling_point": "a",
                "key_message": "a",
                "target_user_trigger": "u1",
                "required_assets": ["r1"],
            }
        ],
        "shot_plan": {"segments": [{"id": "seg_1", "name": "n1", "shots": [{"id": "x", "video_prompt": "p"}]}]},
        "story_framework": {"type": "story_drama", "name": "n", "structure": ["开场"], "reason": "r"},
        "asset_requirements": {"characters": [{"name": "c"}], "scenes": [{"name": "s"}], "products": [{"name": "p"}]},
    }
    bp = parse_story_blueprint_json(raw)
    with pytest.raises(ShortDramaInvalidModelOutputError):
        _normalize_blueprint_for_execution(bp, _product(), _project_config())


def _v2_normalize_shell(*, segment_plan: list[dict]) -> dict:
    v2 = default_creative_blueprint_v2_attachment(product_name="DemoSKU")
    return {
        **v2,
        "title": "T",
        "script_title": "T",
        "script_structure_type": "story_drama",
        "script_type_display": "d",
        "structure_type_display": "a → b",
        "structure_reason_for_user": "reason text long enough for normalize",
        "segment_plan": segment_plan,
        "shot_plan": {"segments": [{"id": "seg_1", "name": "n1", "shots": [{"id": "x", "video_prompt": "p"}]}]},
        "story_framework": {"type": "story_drama", "name": "n", "structure": ["开场"], "reason": "r"},
        "asset_requirements": {"characters": [{"name": "c"}], "scenes": [{"name": "s"}], "products": [{"name": "p"}]},
    }


def test_normalize_accepts_minimal_v2_segment_without_legacy_enhancements():
    raw = _v2_normalize_shell(
        segment_plan=[
            {
                "segment_id": "seg_1",
                "segment_title": "Opening beat",
                "segment_goal": "Establish tension",
                "summary": "Morning rush montage.",
                "duration_seconds": 10.0,
                "required_assets": ["char_ref"],
            }
        ]
    )
    out = _normalize_blueprint_for_execution(parse_story_blueprint_json(raw), _product(), _project_config())
    assert out.blueprint_schema_version == "creative_blueprint_v2"
    seg0 = out.segment_plan[0]
    assert str(seg0.segment_title or "").strip()
    assert str(seg0.summary or "").strip()


def test_normalize_rejects_segment_without_summary_or_story_beat():
    raw = _v2_normalize_shell(
        segment_plan=[
            {
                "segment_id": "seg_1",
                "segment_title": "T",
                "segment_goal": "g",
                "summary": "",
                "story_beat": "",
                "duration_seconds": 10.0,
                "required_assets": ["r1"],
            }
        ]
    )
    with pytest.raises(ShortDramaInvalidModelOutputError):
        _normalize_blueprint_for_execution(parse_story_blueprint_json(raw), _product(), _project_config())


def test_normalize_rejects_segment_without_positive_duration():
    raw = _v2_normalize_shell(
        segment_plan=[
            {
                "segment_id": "seg_1",
                "segment_title": "T",
                "segment_goal": "g",
                "summary": "s",
                "duration_seconds": 0.0,
                "duration_sec": 0.0,
                "required_assets": ["r1"],
            }
        ]
    )
    with pytest.raises(ShortDramaInvalidModelOutputError):
        _normalize_blueprint_for_execution(parse_story_blueprint_json(raw), _product(), _project_config())


def test_v2_normalize_rejects_segment_duration_over_provider_max():
    raw = _v2_normalize_shell(
        segment_plan=[
            {
                "segment_id": "seg_1",
                "segment_title": "T",
                "segment_goal": "g",
                "summary": "s",
                "duration_seconds": 12.0,
                "required_assets": ["r1"],
            }
        ]
    )
    with pytest.raises(ShortDramaInvalidModelOutputError) as ei:
        _normalize_blueprint_for_execution(parse_story_blueprint_json(raw), _product(), _project_config())
    assert "10" in str(ei.value) or "duration" in str(ei.value).lower()
    assert ei.value.code == "s2_provider_duration_exceeded"
    assert ei.value.duration_seconds == 12.0


def test_v2_normalize_rejects_video_spec_duration_over_provider_max():
    raw = _v2_normalize_shell(
        segment_plan=[
            {
                "segment_id": "seg_1",
                "segment_title": "T",
                "segment_goal": "g",
                "summary": "s",
                "duration_seconds": 10.0,
                "required_assets": ["r1"],
            }
        ]
    )
    raw["video_generation_specs"] = [
        {**raw["video_generation_specs"][0], "duration_sec": 12.0},
    ]
    with pytest.raises(ShortDramaInvalidModelOutputError) as ei:
        _normalize_blueprint_for_execution(parse_story_blueprint_json(raw), _product(), _project_config())
    assert ei.value.code == "s2_provider_duration_exceeded"
    assert ei.value.segment_id == "seg_1"
    assert ei.value.duration_seconds == 12.0


class _FakeStoryTextProvider:
    def __init__(self, outputs: list[dict]):
        self.outputs = list(outputs)
        self.stages: list[str] = []

    def generate_structured_json(self, **kwargs):
        self.stages.append(str(kwargs.get("stage") or ""))
        if not self.outputs:
            raise AssertionError("unexpected extra model call")
        return self.outputs.pop(0)


def test_xai_story_planner_repairs_provider_duration_error_once():
    bad = _v2_normalize_shell(
        segment_plan=[
            {
                "segment_id": "seg_1",
                "segment_title": "T",
                "segment_goal": "g",
                "summary": "s",
                "duration_seconds": 12.0,
                "required_assets": ["r1"],
            }
        ]
    )
    repaired = _v2_normalize_shell(
        segment_plan=[
            {
                "segment_id": "seg_1",
                "segment_title": "T",
                "segment_goal": "g",
                "summary": "s",
                "duration_seconds": 8.0,
                "required_assets": ["r1"],
            }
        ]
    )
    provider = _FakeStoryTextProvider([bad, repaired])
    out = XAIStoryPlannerProvider(provider).plan(123, _product(), _project_config())

    assert provider.stages == ["STORY_GENERATION", "STORY_GENERATION_REPAIR"]
    assert out.segment_plan[0].duration_seconds == 8.0
    assert all(float(v.duration_sec or 0.0) <= 10.0 for v in out.video_generation_specs)


def test_xai_story_planner_repair_failure_keeps_specific_duration_error():
    bad = _v2_normalize_shell(
        segment_plan=[
            {
                "segment_id": "seg_1",
                "segment_title": "T",
                "segment_goal": "g",
                "summary": "s",
                "duration_seconds": 12.0,
                "required_assets": ["r1"],
            }
        ]
    )
    still_bad = _v2_normalize_shell(
        segment_plan=[
            {
                "segment_id": "seg_1",
                "segment_title": "T",
                "segment_goal": "g",
                "summary": "s",
                "duration_seconds": 11.0,
                "required_assets": ["r1"],
            }
        ]
    )
    provider = _FakeStoryTextProvider([bad, still_bad])

    with pytest.raises(ShortDramaInvalidModelOutputError) as ei:
        XAIStoryPlannerProvider(provider).plan(123, _product(), _project_config())

    assert provider.stages == ["STORY_GENERATION", "STORY_GENERATION_REPAIR"]
    assert ei.value.code == "s2_provider_duration_exceeded"
    assert ei.value.duration_seconds == 11.0


def test_normalize_rejects_segment_without_asset_hints():
    raw = _v2_normalize_shell(
        segment_plan=[
            {
                "segment_id": "seg_1",
                "segment_title": "T",
                "segment_goal": "g",
                "summary": "s",
                "duration_seconds": 10.0,
                "required_assets": [],
                "expected_assets": [],
                "required_visual_elements": [],
            }
        ]
    )
    with pytest.raises(ShortDramaInvalidModelOutputError):
        _normalize_blueprint_for_execution(parse_story_blueprint_json(raw), _product(), _project_config())


def test_normalize_rejects_segment_missing_segment_id():
    raw = _v2_normalize_shell(
        segment_plan=[
            {
                "segment_title": "T",
                "segment_goal": "g",
                "summary": "s",
                "duration_seconds": 10.0,
                "required_assets": ["r1"],
            }
        ]
    )
    with pytest.raises(ShortDramaInvalidModelOutputError):
        _normalize_blueprint_for_execution(parse_story_blueprint_json(raw), _product(), _project_config())


def test_normalize_accepts_goal_from_key_message_only():
    """v2: alternate fields may satisfy row validation, but normalize does not copy them into segment_goal."""
    raw = _v2_normalize_shell(
        segment_plan=[
            {
                "segment_id": "seg_1",
                "segment_title": "T",
                "segment_goal": "",
                "goal": "",
                "key_message": "Primary angle for this beat",
                "summary": "Narrative body text.",
                "duration_seconds": 10.0,
                "required_assets": ["r1"],
            }
        ]
    )
    out = _normalize_blueprint_for_execution(parse_story_blueprint_json(raw), _product(), _project_config())
    assert out.segment_plan[0].segment_goal == ""
    assert out.segment_plan[0].key_message == "Primary angle for this beat"


def test_normalize_accepts_narrative_from_story_beat_only():
    """v2: story_beat can satisfy validation for narrative presence; summary is not backfilled."""
    raw = _v2_normalize_shell(
        segment_plan=[
            {
                "segment_id": "seg_1",
                "segment_title": "T",
                "segment_goal": "g",
                "summary": "",
                "story_beat": "Rising action beat description.",
                "duration_seconds": 10.0,
                "required_assets": ["r1"],
            }
        ]
    )
    out = _normalize_blueprint_for_execution(parse_story_blueprint_json(raw), _product(), _project_config())
    assert (out.segment_plan[0].summary or "") == ""
    assert "Rising action" in (out.segment_plan[0].story_beat or "")


def test_normalize_accepts_title_from_stage_name_only():
    """v2: stage_name can satisfy title validation; segment_title/title are not auto-filled."""
    raw = _v2_normalize_shell(
        segment_plan=[
            {
                "segment_id": "seg_1",
                "segment_title": "",
                "title": "",
                "stage_name": "Act I label",
                "segment_goal": "g",
                "summary": "body",
                "duration_seconds": 10.0,
                "required_assets": ["r1"],
            }
        ]
    )
    out = _normalize_blueprint_for_execution(parse_story_blueprint_json(raw), _product(), _project_config())
    assert (out.segment_plan[0].segment_title or "") == ""
    assert (out.segment_plan[0].title or "") == ""
    assert "Act I" in (out.segment_plan[0].stage_name or "")


def _minimal_three_asset_specs(*, fill: str) -> list[dict]:
    """fill: 'image' | 'display' | 'description' — which field is non-empty per row."""
    def row(kind: str, key: str, entity: str, label: str) -> dict:
        base = {
            "asset_key": key,
            "asset_kind": kind,
            "reference_role": f"{kind}_reference",
            "display_name": "",
            "description": "",
            "image_prompt": "",
            "negative_prompt": "",
            "immutable_constraints": [],
            "linked_entity_key": entity,
        }
        if fill == "image":
            base["image_prompt"] = f"{label} visual brief"
        elif fill == "display":
            base["display_name"] = label
        else:
            base["description"] = f"{label} description body"
        return base

    return [
        row("character", "asset_char_main", "char_main", "Lead"),
        row("scene", "asset_scene_main", "scene_main", "Kitchen"),
        row("product", "asset_prod_main", "prod_main", "SKU"),
    ]


def _full_v2_blueprint_dict_with_asset_specs(asset_specs: list[dict]) -> dict:
    v2 = default_creative_blueprint_v2_attachment(product_name="DemoSKU")
    return {
        **v2,
        "blueprint_schema_version": "creative_blueprint_v2",
        "title": "T",
        "script_title": "T",
        "script_structure_type": "story_drama",
        "script_type_display": "d",
        "structure_type_display": "a → b",
        "structure_reason_for_user": "reason text long enough for normalize",
        "segment_plan": [
            {
                "segment_id": "seg_1",
                "segment_title": "T1",
                "segment_goal": "g",
                "summary": "sum",
                "duration_seconds": 10.0,
                "required_assets": ["r1"],
            }
        ],
        "shot_plan": {"segments": [{"id": "seg_1", "name": "n1", "shots": [{"id": "x", "video_prompt": "p"}]}]},
        "story_framework": {"type": "story_drama", "name": "n", "structure": ["开场"], "reason": "r"},
        "asset_requirements": {"characters": [{"name": "c"}], "scenes": [{"name": "s"}], "products": [{"name": "p"}]},
        "asset_generation_specs": asset_specs,
    }


def test_v2_validate_accepts_character_scene_product_image_prompt_only():
    specs = _minimal_three_asset_specs(fill="image")
    _validate_creative_blueprint_v2(StoryBlueprintSchema.model_validate(_full_v2_blueprint_dict_with_asset_specs(specs)))


def test_v2_validate_accepts_character_scene_product_display_name_only():
    specs = _minimal_three_asset_specs(fill="display")
    _validate_creative_blueprint_v2(StoryBlueprintSchema.model_validate(_full_v2_blueprint_dict_with_asset_specs(specs)))


def test_v2_validate_accepts_character_scene_product_description_only():
    specs = _minimal_three_asset_specs(fill="description")
    _validate_creative_blueprint_v2(StoryBlueprintSchema.model_validate(_full_v2_blueprint_dict_with_asset_specs(specs)))


def test_v2_validate_accepts_empty_negative_and_immutable():
    specs = _minimal_three_asset_specs(fill="image")
    for s in specs:
        s["negative_prompt"] = ""
        s["immutable_constraints"] = []
    _validate_creative_blueprint_v2(StoryBlueprintSchema.model_validate(_full_v2_blueprint_dict_with_asset_specs(specs)))


def test_v2_validate_rejects_empty_asset_key():
    specs = _minimal_three_asset_specs(fill="image")
    specs[0]["asset_key"] = ""
    with pytest.raises(ShortDramaInvalidModelOutputError) as ei:
        _validate_creative_blueprint_v2(StoryBlueprintSchema.model_validate(_full_v2_blueprint_dict_with_asset_specs(specs)))
    assert any("asset_key" in str(m) for m in (ei.value.missing_fields or []))


def test_v2_validate_rejects_duplicate_asset_key():
    specs = _minimal_three_asset_specs(fill="image")
    specs[1]["asset_key"] = "asset_char_main"
    with pytest.raises(ShortDramaInvalidModelOutputError) as ei:
        _validate_creative_blueprint_v2(StoryBlueprintSchema.model_validate(_full_v2_blueprint_dict_with_asset_specs(specs)))
    assert "asset_generation_specs.asset_key" in (ei.value.missing_fields or [])


def test_v2_validate_rejects_invalid_asset_kind():
    raw = _full_v2_blueprint_dict_with_asset_specs(_minimal_three_asset_specs(fill="image"))
    raw["asset_generation_specs"][0]["asset_kind"] = "camera"
    with pytest.raises(ShortDramaInvalidModelOutputError):
        parse_story_blueprint_json(raw)


def test_v2_validate_rejects_all_text_fields_empty():
    specs = _minimal_three_asset_specs(fill="image")
    for s in specs:
        s["image_prompt"] = ""
        s["display_name"] = ""
        s["description"] = ""
    with pytest.raises(ShortDramaInvalidModelOutputError) as ei:
        _validate_creative_blueprint_v2(StoryBlueprintSchema.model_validate(_full_v2_blueprint_dict_with_asset_specs(specs)))
    assert "asset_generation_specs.display_or_prompt" in (ei.value.missing_fields or [])


def test_v2_validate_rejects_bad_video_reference_asset_key():
    specs = _minimal_three_asset_specs(fill="image")
    d = _full_v2_blueprint_dict_with_asset_specs(specs)
    vids = list(d["video_generation_specs"])
    vids[0] = {**vids[0], "reference_asset_keys": ["missing_asset_key"]}
    d["video_generation_specs"] = vids
    with pytest.raises(ShortDramaInvalidModelOutputError) as ei:
        _validate_creative_blueprint_v2(StoryBlueprintSchema.model_validate(d))
    assert any("reference_asset_keys" in str(m) for m in (ei.value.missing_fields or []))


def _five_segment_plan_items() -> list[dict]:
    return [
        {
            "segment_id": f"seg_{i}",
            "segment_title": f"T{i}",
            "segment_goal": "g",
            "summary": f"Narrative body for segment {i} with enough substance for validation.",
            "duration_seconds": 8.0,
            "required_assets": ["r1"],
        }
        for i in range(1, 6)
    ]


def _video_spec_row(seg_i: int, *, spec_suffix: str = "") -> dict:
    return {
        "spec_key": f"vid_seg_{seg_i}{spec_suffix}",
        "segment_id": f"seg_{seg_i}",
        "shot_id": f"seg_{seg_i}_display_meta" if seg_i == 1 else None,
        "video_prompt": (
            f"Continuous vertical 9:16 segment covering the full beat {seg_i} in one execution spec; "
            f"lifestyle pacing with natural blocking and clear product presence. {'x' * 40}"
        ),
        "reference_asset_keys": ["asset_char_main", "asset_scene_main", "asset_prod_main"],
        "duration_sec": 6.0,
        "aspect_ratio": "9:16",
        "camera": "handheld",
        "visual_action": "routine",
        "audio_notes": "",
        "dialogue_or_voiceover_ref": "",
        "must_show": [],
        "must_avoid": [],
    }


def _v2_blueprint_five_segments_dict(*, video_specs: list[dict]) -> dict:
    v2 = default_creative_blueprint_v2_attachment(product_name="DemoSKU")
    shot_segs = []
    for i in range(1, 6):
        shots = [{"id": f"seg_{i}_shot_a", "video_prompt": "planning shot a"}]
        if i == 1:
            shots.append({"id": f"seg_{i}_shot_b", "video_prompt": "planning shot b"})
        shot_segs.append({"id": f"seg_{i}", "name": f"n{i}", "shots": shots})
    return {
        **v2,
        "blueprint_schema_version": "creative_blueprint_v2",
        "title": "T",
        "script_title": "T",
        "script_structure_type": "story_drama",
        "script_type_display": "d",
        "structure_type_display": "a → b",
        "structure_reason_for_user": "reason text long enough for normalize",
        "segment_plan": _five_segment_plan_items(),
        "shot_plan": {"segments": shot_segs},
        "story_framework": {"type": "story_drama", "name": "n", "structure": ["开场"], "reason": "r"},
        "asset_requirements": {"characters": [{"name": "c"}], "scenes": [{"name": "s"}], "products": [{"name": "p"}]},
        "asset_generation_specs": _minimal_three_asset_specs(fill="image"),
        "video_generation_specs": video_specs,
    }


def test_v2_validate_five_segments_exactly_five_video_specs_passes():
    vids = [_video_spec_row(i) for i in range(1, 6)]
    d = _v2_blueprint_five_segments_dict(video_specs=vids)
    _validate_creative_blueprint_v2(StoryBlueprintSchema.model_validate(d))


def test_v2_validate_five_segments_four_video_specs_fails_missing_coverage():
    vids = [_video_spec_row(i) for i in range(1, 5)]
    d = _v2_blueprint_five_segments_dict(video_specs=vids)
    with pytest.raises(ShortDramaInvalidModelOutputError) as ei:
        _validate_creative_blueprint_v2(StoryBlueprintSchema.model_validate(d))
    assert "video_generation_specs.segment_id" in (ei.value.missing_fields or [])


def test_v2_validate_five_segments_duplicate_video_segment_id_fails():
    vids = [_video_spec_row(i) for i in range(1, 6)]
    vids[-1] = _video_spec_row(1, spec_suffix="_dup")
    d = _v2_blueprint_five_segments_dict(video_specs=vids)
    with pytest.raises(ShortDramaInvalidModelOutputError) as ei:
        _validate_creative_blueprint_v2(StoryBlueprintSchema.model_validate(d))
    assert "video_generation_specs.segment_id" in (ei.value.missing_fields or [])


def test_v2_validate_five_segments_unknown_video_segment_id_fails():
    vids = [_video_spec_row(i) for i in range(1, 5)]
    vids.append(
        {
            **_video_spec_row(5),
            "segment_id": "seg_unknown",
            "spec_key": "vid_seg_unknown",
        }
    )
    d = _v2_blueprint_five_segments_dict(video_specs=vids)
    with pytest.raises(ShortDramaInvalidModelOutputError) as ei:
        _validate_creative_blueprint_v2(StoryBlueprintSchema.model_validate(d))
    assert "video_generation_specs.segment_id" in (ei.value.missing_fields or [])


def test_v2_validate_multi_shot_shot_plan_does_not_require_multiple_video_specs():
    """shot_plan may list multiple shots per segment; execution coverage is video_generation_specs only."""
    vids = [_video_spec_row(i) for i in range(1, 6)]
    d = _v2_blueprint_five_segments_dict(video_specs=vids)
    _validate_creative_blueprint_v2(StoryBlueprintSchema.model_validate(d))


def _v2_bp_with_segment(*, extra: dict) -> StoryBlueprintSchema:
    from app.short_drama.schemas.story import SegmentPlanItemSchema

    product = _product()
    v2 = default_creative_blueprint_v2_attachment(product_name=product.product_name)
    base = {
        "title": "t",
        "script_title": "t",
        "script_structure_type": "story_drama",
        "script_type_display": "剧情",
        "structure_type_display": "a → b",
        "structure_reason_for_user": "reason text long enough for normalize",
        "segment_plan": [
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
        "shot_plan": {"segments": [{"id": "seg_1", "name": "n1", "shots": [{"id": "x", "video_prompt": "p"}]}]},
        **v2,
    }
    return StoryBlueprintSchema.model_validate({**base, **extra})


def test_v2_normalize_preserves_story_framework_string():
    fw = "Grok story_framework as single prose block must stay unchanged."
    out = _normalize_blueprint_for_execution(
        _v2_bp_with_segment(extra={"story_framework": fw}),
        _product(),
        _project_config(),
    )
    assert out.story_framework == fw


def test_v2_normalize_preserves_market_visual_constraints_string():
    mv = "Grok market visual constraints as string."
    out = _normalize_blueprint_for_execution(
        _v2_bp_with_segment(extra={"market_visual_constraints": mv}),
        _product(),
        _project_config(),
    )
    assert out.market_visual_constraints == mv


def test_v2_normalize_preserves_visual_style_constraints_string():
    vs = "Grok visual style constraints as string."
    out = _normalize_blueprint_for_execution(
        _v2_bp_with_segment(extra={"visual_style_constraints": vs}),
        _product(),
        _project_config(),
    )
    assert out.visual_style_constraints == vs


@pytest.mark.parametrize(
    "ms",
    [
        "one line marketing strategy",
        ["angle_a", "angle_b"],
        {"channel": "short_video", "tone": "warm"},
    ],
)
def test_v2_normalize_preserves_marketing_strategy_shape(ms):
    out = _normalize_blueprint_for_execution(
        _v2_bp_with_segment(extra={"marketing_strategy": ms}),
        _product(),
        _project_config(),
    )
    assert out.marketing_strategy == ms


def test_v2_normalize_preserves_asset_requirements_string_not_dictified():
    ar = "Grok asset_requirements as plain string; backend must not wrap with market constraints dict."
    out = _normalize_blueprint_for_execution(
        _v2_bp_with_segment(extra={"asset_requirements": ar}),
        _product(),
        _project_config(),
    )
    assert out.asset_requirements == ar
    assert isinstance(out.asset_requirements, str)


def test_legacy_normalize_runs_when_schema_not_v2_and_renumbers_segment_ids():
    """legacy only: pre-v2 blueprints without creative_blueprint_v2 still reshape segment_plan."""
    from app.short_drama.schemas.story import SegmentPlanItemSchema

    product = _product()
    cfg = _project_config()
    bp = StoryBlueprintSchema(
        blueprint_schema_version="",
        title="t",
        script_title="t",
        script_structure_type="story_drama",
        script_type_display="剧情",
        structure_type_display="a → b",
        structure_reason_for_user="reason text long enough",
        segment_plan=[
            SegmentPlanItemSchema(
                segment_id="custom_ai_id",
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
        shot_plan={"segments": [{"id": "seg_1", "name": "n1", "shots": [{"id": "x", "video_prompt": "p"}]}]},
        asset_requirements={"characters": [{"name": "c"}], "scenes": [{"name": "s"}], "products": [{"name": "p"}]},
    )
    out = _normalize_blueprint_for_execution(bp, product, cfg)
    assert out.blueprint_schema_version == ""
    assert out.segment_plan[0].segment_id == "seg_1"


def test_brand_seeding_risk_warning_uses_s2_tag_not_ai_blueprint_validate_failed(caplog):
    import logging

    caplog.set_level(logging.WARNING)
    out = _normalize_blueprint_for_execution(
        _v2_bp_with_segment(extra={"hook": "这里提到痛点以触发风险词扫描"}),
        _product(),
        _project_config(),
    )
    assert out.hook == "这里提到痛点以触发风险词扫描"
    assert any("[S2_BRAND_SEEDING_RISK_TERM_WARNING]" in r.message for r in caplog.records)
    assert not any("[AI_BLUEPRINT_VALIDATE_FAILED]" in r.message for r in caplog.records)


def test_v2_validate_failure_logs_ai_blueprint_validate_failed(caplog):
    import logging

    caplog.set_level(logging.WARNING)
    v2 = default_creative_blueprint_v2_attachment(product_name="DemoSKU")
    d = {**v2, "asset_generation_specs": []}
    bp = StoryBlueprintSchema.model_validate(d)
    with pytest.raises(ShortDramaInvalidModelOutputError):
        _validate_creative_blueprint_v2(bp, project_id=123)
    assert any("[AI_BLUEPRINT_VALIDATE_FAILED]" in r.message for r in caplog.records)
