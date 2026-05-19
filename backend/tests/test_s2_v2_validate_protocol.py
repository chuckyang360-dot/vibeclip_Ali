"""S2 creative_blueprint_v2 与 legacy shot_plan.segments 校验分流。"""

from __future__ import annotations

import pytest

from app.short_drama.exceptions import ShortDramaInvalidModelOutputError
from app.short_drama.schemas.story import StoryBlueprintSchema, default_creative_blueprint_v2_attachment
from app.short_drama.services.story_planner_service import _normalize_blueprint_for_execution, _validate_creative_blueprint_v2
from tests.test_p1_creative_blueprint_v2_schema import _product, _project_config


def _v2_dict_base() -> dict:
    v2 = default_creative_blueprint_v2_attachment(product_name="DemoSKU")
    return {
        **v2,
        "title": "T",
        "script_title": "T",
        "script_structure_type": "story_drama",
        "script_type_display": "剧情",
        "structure_type_display": "a → b",
        "structure_reason_for_user": "reason text long enough for normalize",
        "segment_plan": [
            {
                "segment_id": "seg_1",
                "segment_title": "T1",
                "segment_goal": "g1",
                "summary": "sum1",
                "duration_seconds": 10.0,
            }
        ],
        "story_framework": {"type": "story_drama", "name": "n", "structure": ["开场"], "reason": "r"},
        "asset_requirements": {"characters": [{"name": "c"}], "scenes": [{"name": "s"}], "products": [{"name": "p"}]},
    }


def test_creative_blueprint_v2_ok_without_shot_plan():
    d = _v2_dict_base()
    assert "shot_plan" not in d
    out = _normalize_blueprint_for_execution(StoryBlueprintSchema.model_validate(d), _product(), _project_config())
    assert out.blueprint_schema_version == "creative_blueprint_v2"


def test_creative_blueprint_v2_ok_shot_plan_empty_dict():
    d = _v2_dict_base()
    d["shot_plan"] = {}
    out = _normalize_blueprint_for_execution(StoryBlueprintSchema.model_validate(d), _product(), _project_config())
    assert out.blueprint_schema_version == "creative_blueprint_v2"


def test_v2_validate_fails_without_video_generation_specs():
    d = _v2_dict_base()
    d["video_generation_specs"] = []
    with pytest.raises(ShortDramaInvalidModelOutputError) as ei:
        _validate_creative_blueprint_v2(StoryBlueprintSchema.model_validate(d), project_id=1)
    assert "video_generation_specs" in (ei.value.missing_fields or [])


def test_v2_validate_fails_without_asset_generation_specs():
    d = _v2_dict_base()
    d["asset_generation_specs"] = []
    with pytest.raises(ShortDramaInvalidModelOutputError) as ei:
        _validate_creative_blueprint_v2(StoryBlueprintSchema.model_validate(d), project_id=1)
    assert "asset_generation_specs" in (ei.value.missing_fields or [])


def test_v2_validate_fails_without_segment_plan():
    d = _v2_dict_base()
    d["segment_plan"] = []
    with pytest.raises(ShortDramaInvalidModelOutputError) as ei:
        _validate_creative_blueprint_v2(StoryBlueprintSchema.model_validate(d), project_id=1)
    assert "segment_plan" in (ei.value.missing_fields or [])


def test_v2_normalize_logs_success_markers(caplog):
    import logging

    caplog.set_level(logging.INFO)
    d = _v2_dict_base()
    _normalize_blueprint_for_execution(StoryBlueprintSchema.model_validate(d), _product(), _project_config())
    msgs = [r.message for r in caplog.records]
    assert any("[S2_V2_BLUEPRINT_DETECTED]" in m for m in msgs)
    assert any("[S2_V2_SKIP_LEGACY_SHOT_PLAN_VALIDATION]" in m for m in msgs)
    assert any("[S2_V2_VALIDATE_SUCCESS]" in m for m in msgs)


def test_legacy_normalize_fails_without_shot_plan_segments():
    bp = StoryBlueprintSchema(
        blueprint_schema_version="",
        title="T",
        script_title="T",
        script_structure_type="story_drama",
        script_type_display="d",
        structure_type_display="a → b",
        structure_reason_for_user="reason text long enough for normalize",
        segment_plan=[
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
        story_framework={"type": "story_drama", "name": "n", "structure": ["开场"], "reason": "r"},
        shot_plan={},
        asset_requirements={"characters": [{"name": "c"}], "scenes": [{"name": "s"}], "products": [{"name": "p"}]},
    )
    with pytest.raises(ShortDramaInvalidModelOutputError) as ei:
        _normalize_blueprint_for_execution(bp, _product(), _project_config())
    assert "shot_plan.segments" in (ei.value.missing_fields or [])
