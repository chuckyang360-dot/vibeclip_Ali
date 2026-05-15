"""P2: S3 v2 asset_generation_specs — structure/link validation only (no creative keyword gate)."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.short_drama.exceptions import ShortDramaInvalidModelOutputError
from app.short_drama.models import CharacterAsset
from app.short_drama.schemas.product import ProductContextSchema
from app.short_drama.schemas.story import (
    AssetGenerationSpecSchema,
    SegmentPlanItemSchema,
    StoryBlueprintSchema,
    default_creative_blueprint_v2_attachment,
)
from app.short_drama.services.asset_image_service import _should_skip_prompt_mutations
from app.short_drama.services.asset_image_service import AssetImageService
from app.short_drama.services.asset_spec_service import asset_bundle_from_story_requirements
from app.short_drama.services.asset_v2_materialize_service import (
    build_v2_asset_specs_bundle,
    is_creative_blueprint_v2_project,
    validate_v2_asset_generation_specs,
)
from app.short_drama.services.story_planner_service import _normalize_blueprint_for_execution
from app.short_drama.utils.image_prompts import prepare_image_prompt, prepare_image_prompt_v2_asset_spec_pass_through


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
        "project_id": 42,
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


def _normalized_v2_blueprint() -> StoryBlueprintSchema:
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
    return _normalize_blueprint_for_execution(bp, product=product, project_config=cfg)


def test_v2_bundle_materializes_three_kinds():
    bp = _normalized_v2_blueprint()
    assert is_creative_blueprint_v2_project(bp)

    bundle = build_v2_asset_specs_bundle(project_id=1, blueprint=bp)
    assert len(bundle.characters) == 1
    assert len(bundle.scenes) == 1
    assert len(bundle.products) == 1
    assert bundle.characters[0].visual_prompt == bundle.characters[0].image_prompt
    tf = (bundle.characters[0].meta or {}).get("type_fields") or {}
    assert tf.get("asset_spec_source") == "s2_asset_generation_specs"


def test_v2_materializes_without_boundary_english_phrases():
    """S3 v2 does not require white background / no extra people / etc. in image_prompt."""
    bp = _normalized_v2_blueprint()
    specs: list[AssetGenerationSpecSchema] = []
    for s in bp.asset_generation_specs:
        specs.append(
            AssetGenerationSpecSchema.model_validate(
                {
                    **s.model_dump(),
                    "image_prompt": f"Minimal {s.asset_kind} reference for unit test; 中文描述也可。",
                    "negative_prompt": "",
                    "immutable_constraints": [],
                }
            )
        )
    bp2 = bp.model_copy(update={"asset_generation_specs": specs})
    bundle = build_v2_asset_specs_bundle(project_id=2, blueprint=bp2)
    assert len(bundle.characters) == 1
    assert "中文" in (bundle.characters[0].image_prompt or "")


def test_v2_asset_key_empty_fails():
    bp = _normalized_v2_blueprint()
    specs = list(bp.asset_generation_specs)
    s0 = specs[0].model_dump()
    s0["asset_key"] = "  "
    specs[0] = AssetGenerationSpecSchema.model_validate(s0)
    bp2 = bp.model_copy(update={"asset_generation_specs": specs})
    with pytest.raises(ShortDramaInvalidModelOutputError) as ei:
        validate_v2_asset_generation_specs(3, bp2)
    assert "asset_key" in (ei.value.missing_fields[0] if ei.value.missing_fields else "")


def test_v2_asset_key_duplicate_fails():
    bp = _normalized_v2_blueprint()
    specs = list(bp.asset_generation_specs)
    dup_key = specs[0].asset_key
    s1 = specs[1].model_dump()
    s1["asset_key"] = dup_key
    specs[1] = AssetGenerationSpecSchema.model_validate(s1)
    bp2 = bp.model_copy(update={"asset_generation_specs": specs})
    with pytest.raises(ShortDramaInvalidModelOutputError) as ei:
        validate_v2_asset_generation_specs(4, bp2)
    assert "asset_key" in (ei.value.missing_fields[0] if ei.value.missing_fields else "")


def test_v2_invalid_asset_kind_fails_validate():
    bp = _normalized_v2_blueprint()
    specs = list(bp.asset_generation_specs)
    s0 = specs[0]
    bad = AssetGenerationSpecSchema.model_construct(
        asset_key=s0.asset_key,
        asset_kind="camera",
        reference_role=s0.reference_role,
        display_name=s0.display_name,
        description=s0.description,
        image_prompt=s0.image_prompt or "x",
        negative_prompt=s0.negative_prompt,
        immutable_constraints=s0.immutable_constraints,
        linked_entity_key=s0.linked_entity_key,
    )
    bp2 = bp.model_copy(update={"asset_generation_specs": [bad, specs[1], specs[2]]})
    with pytest.raises(ShortDramaInvalidModelOutputError) as ei:
        validate_v2_asset_generation_specs(5, bp2)
    assert "asset_kind" in (ei.value.missing_fields[0] if ei.value.missing_fields else "")


def test_v2_invalid_asset_kind_rejected_by_schema():
    bp = _normalized_v2_blueprint()
    d = bp.model_dump()
    d["asset_generation_specs"][0]["asset_kind"] = "camera"
    with pytest.raises(ValidationError):
        StoryBlueprintSchema.model_validate(d)


def test_v2_image_prompt_empty_fails():
    bp = _normalized_v2_blueprint()
    specs = list(bp.asset_generation_specs)
    for i, s in enumerate(specs):
        if s.asset_kind == "character":
            specs[i] = AssetGenerationSpecSchema.model_validate({**s.model_dump(), "image_prompt": "  "})
            break
    bp2 = bp.model_copy(update={"asset_generation_specs": specs})
    with pytest.raises(ShortDramaInvalidModelOutputError) as ei:
        validate_v2_asset_generation_specs(6, bp2)
    assert "image_prompt" in (ei.value.missing_fields[0] if ei.value.missing_fields else "")


def test_v2_linked_entity_key_not_found_fails():
    bp = _normalized_v2_blueprint()
    specs = list(bp.asset_generation_specs)
    for i, s in enumerate(specs):
        if s.asset_kind == "scene":
            specs[i] = AssetGenerationSpecSchema.model_validate({**s.model_dump(), "linked_entity_key": "no_such_scene"})
            break
    bp2 = bp.model_copy(update={"asset_generation_specs": specs})
    with pytest.raises(ShortDramaInvalidModelOutputError) as ei:
        validate_v2_asset_generation_specs(7, bp2)
    assert "linked_entity_key" in (ei.value.missing_fields[0] if ei.value.missing_fields else "")


def test_v2_character_spec_linked_to_scene_key_fails():
    bp = _normalized_v2_blueprint()
    specs = list(bp.asset_generation_specs)
    for i, s in enumerate(specs):
        if s.asset_kind == "character":
            specs[i] = AssetGenerationSpecSchema.model_validate({**s.model_dump(), "linked_entity_key": "scene_main"})
            break
    bp2 = bp.model_copy(update={"asset_generation_specs": specs})
    with pytest.raises(ShortDramaInvalidModelOutputError) as ei:
        validate_v2_asset_generation_specs(8, bp2)
    assert "linked_entity_key" in (ei.value.missing_fields[0] if ei.value.missing_fields else "")


def test_v2_scene_spec_linked_to_product_key_fails():
    bp = _normalized_v2_blueprint()
    specs = list(bp.asset_generation_specs)
    for i, s in enumerate(specs):
        if s.asset_kind == "scene":
            specs[i] = AssetGenerationSpecSchema.model_validate({**s.model_dump(), "linked_entity_key": "prod_main"})
            break
    bp2 = bp.model_copy(update={"asset_generation_specs": specs})
    with pytest.raises(ShortDramaInvalidModelOutputError) as ei:
        validate_v2_asset_generation_specs(9, bp2)
    assert "linked_entity_key" in (ei.value.missing_fields[0] if ei.value.missing_fields else "")


def test_v2_product_spec_linked_to_character_key_fails():
    bp = _normalized_v2_blueprint()
    specs = list(bp.asset_generation_specs)
    for i, s in enumerate(specs):
        if s.asset_kind == "product":
            specs[i] = AssetGenerationSpecSchema.model_validate({**s.model_dump(), "linked_entity_key": "char_main"})
            break
    bp2 = bp.model_copy(update={"asset_generation_specs": specs})
    with pytest.raises(ShortDramaInvalidModelOutputError) as ei:
        validate_v2_asset_generation_specs(10, bp2)
    assert "linked_entity_key" in (ei.value.missing_fields[0] if ei.value.missing_fields else "")


def test_v2_prompt_fields_pass_through_unchanged():
    bp = _normalized_v2_blueprint()
    specs = list(bp.asset_generation_specs)
    np = "NEGATIVE_CUSTOM_NO_APPEND"
    ic = ["IMMUTABLE_A", "IMMUTABLE_B"]
    for i, s in enumerate(specs):
        if s.asset_kind == "character":
            ip = "IMAGE_PROM_CUSTOM_BODY_XYZ"
            specs[i] = AssetGenerationSpecSchema.model_validate(
                {**s.model_dump(), "image_prompt": ip, "negative_prompt": np, "immutable_constraints": ic}
            )
            break
    bp2 = bp.model_copy(update={"asset_generation_specs": specs})
    bundle = build_v2_asset_specs_bundle(project_id=11, blueprint=bp2)
    c0 = bundle.characters[0]
    tf = (c0.meta or {}).get("type_fields") or {}
    assert c0.image_prompt == "IMAGE_PROM_CUSTOM_BODY_XYZ"
    assert c0.visual_prompt == "IMAGE_PROM_CUSTOM_BODY_XYZ"
    assert tf.get("image_prompt") == "IMAGE_PROM_CUSTOM_BODY_XYZ"
    assert tf.get("negative_prompt") == np
    assert tf.get("immutable_constraints") == ic


def test_non_v2_not_flagged_as_v2_project():
    bp = StoryBlueprintSchema.model_validate(
        {
            "title": "t",
            "script_title": "t",
            "script_structure_type": "story_drama",
            "script_type_display": "d",
            "structure_type_display": "a → b",
            "structure_reason_for_user": "reason text long enough for normalize",
            "segment_plan": [],
            "story_framework": {"type": "story_drama", "name": "n", "structure": ["开场"], "reason": "r"},
        }
    )
    assert not is_creative_blueprint_v2_project(bp)


def test_v2_prepare_image_prompt_does_not_append_global_negatives():
    base = (
        "white background, clean plain background, only the character, no scene environment, "
        "no product, no extra people, no story action, reusable character reference image"
    )
    legacy = prepare_image_prompt(base)
    v2p = prepare_image_prompt_v2_asset_spec_pass_through(base)
    assert "no text" in legacy.lower()
    assert "no text" not in v2p.lower()


def test_v2_meta_skips_prompt_mutation_flag():
    assert _should_skip_prompt_mutations({"v2_asset_spec_pass_through": True})
    assert _should_skip_prompt_mutations({"type_fields": {"asset_spec_source": "s2_asset_generation_specs"}})
    assert not _should_skip_prompt_mutations({"type_fields": {}})


def test_asset_image_failure_status_is_per_asset_and_cleared_on_success():
    svc = AssetImageService(provider=object())
    row = CharacterAsset(project_id=1, name="Lead", role_type="main", visual_prompt="prompt", meta_json={"keep": "x"})

    svc._mark_image_generation_failed(row, RuntimeError("provider traceback should stay in logs"))

    assert row.meta_json["keep"] == "x"
    assert row.meta_json["image_generation_status"] == "failed"
    assert row.meta_json["image_generation_error_type"] == "RuntimeError"

    svc._clear_image_generation_failure(row)

    assert row.meta_json == {"keep": "x"}


def test_legacy_bundle_still_available_for_non_v2_blueprint():
    product = _product()
    cfg = _project_config()
    bp = StoryBlueprintSchema(
        title="t",
        script_title="t",
        script_structure_type="story_drama",
        script_type_display="剧情",
        structure_type_display="a → b",
        structure_reason_for_user="reason text long enough",
        segment_plan=[],
        story_framework={"type": "story_drama", "name": "n", "structure": ["开场"], "reason": "r"},
        asset_requirements={
            "characters": [{"name": "Alice", "visual_prompt": "x" * 30}],
            "scenes": [{"name": "Office", "visual_prompt": "y" * 30}],
            "products": [{"name": "SKU", "visual_prompt": "z" * 30}],
        },
    )
    assert not is_creative_blueprint_v2_project(bp)
    b = asset_bundle_from_story_requirements(bp, product=product, project_config=cfg)
    assert len(b.characters) >= 1
