"""P4: v2 main path must never invoke legacy S2/S3/S4 creative fallbacks."""

from __future__ import annotations

import pytest

from app.short_drama.exceptions import ShortDramaInvalidModelOutputError
from app.short_drama.schemas.product import ProductContextSchema
from app.short_drama.schemas.story import (
    SegmentPlanItemSchema,
    StoryBlueprintSchema,
    default_creative_blueprint_v2_attachment,
)
import importlib

ass_pkg = importlib.import_module("app.short_drama.services.asset_spec_service")
sds_pkg = importlib.import_module("app.short_drama.services.segment_director_service")
sps_pkg = importlib.import_module("app.short_drama.services.story_planner_service")
from app.short_drama.services.asset_v2_materialize_service import build_v2_asset_specs_bundle
from app.short_drama.schemas.asset import (
    AssetSpecsBundleSchema,
    CharacterAssetSchema,
    ProductAssetSchema,
    SceneAssetSchema,
)
from app.short_drama.services.video_v2_materialize_service import materialize_segment_scripts_from_v2_video_generation_specs
from app.short_drama.utils.video_prompt_builder import build_segment_video_plan


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


def _cfg() -> dict:
    return {
        "project_id": 501,
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


def _bundle() -> AssetSpecsBundleSchema:
    return AssetSpecsBundleSchema(
        characters=[
            CharacterAssetSchema(
                id=1,
                name="Lead",
                role_type="main",
                description="commuter",
                visual_prompt="vp",
                image_url="https://example.invalid/char.png",
                meta={"type_fields": {"asset_key": "asset_char_main"}},
            )
        ],
        scenes=[
            SceneAssetSchema(
                id=2,
                name="Morning apartment",
                scene_type="interior",
                description="kitchen daylight",
                visual_prompt="svp",
                image_url="https://example.invalid/scene.png",
                meta={"type_fields": {"asset_key": "asset_scene_main"}},
            )
        ],
        products=[
            ProductAssetSchema(
                id=3,
                name="DemoSKU",
                description="hero sku",
                visual_prompt="pvp",
                image_url="https://example.invalid/prod.png",
                meta={"type_fields": {"asset_key": "asset_prod_main"}},
            )
        ],
    )


def _v2_bp() -> StoryBlueprintSchema:
    v2 = default_creative_blueprint_v2_attachment(product_name="DemoSKU")
    return StoryBlueprintSchema(
        title="t",
        script_title="t",
        script_structure_type="story_drama",
        script_type_display="剧情",
        structure_type_display="a → b",
        structure_reason_for_user="reason text long enough for normalize",
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


def test_v2_s2_normalize_never_calls_asset_requirements_with_market_constraints(monkeypatch):
    def boom(*_a, **_k):
        raise AssertionError("_asset_requirements_with_market_constraints must not run on v2 normalize")

    monkeypatch.setattr(sps_pkg, "_asset_requirements_with_market_constraints", boom)
    sps_pkg._normalize_blueprint_for_execution(_v2_bp(), _product(), _cfg())


def test_v2_s3_generate_forbidden(monkeypatch):
    def boom(*_a, **_k):
        raise AssertionError("asset_spec_service.generate must not run for v2")

    monkeypatch.setattr(ass_pkg.asset_spec_service, "generate", boom)
    build_v2_asset_specs_bundle(project_id=1, blueprint=_v2_bp())


def test_v2_s3_asset_bundle_forbidden():
    with pytest.raises(ShortDramaInvalidModelOutputError) as ei:
        ass_pkg.asset_bundle_from_story_requirements(_v2_bp(), product=_product(), project_config=_cfg())
    assert ei.value.code == "s3_v2_legacy_asset_bundle_forbidden"


def test_v2_s4_segment_director_generate_forbidden():
    with pytest.raises(ShortDramaInvalidModelOutputError):
        sds_pkg.segment_director_service.generate(1, _v2_bp(), _bundle(), _cfg())


def test_v2_s4_segments_from_story_shot_plan_forbidden():
    with pytest.raises(ShortDramaInvalidModelOutputError):
        sds_pkg.segments_from_story_shot_plan(_v2_bp(), assets=_bundle(), project_config=_cfg())


def test_v2_s4_compose_generation_prompt_not_used_by_materialize(monkeypatch):
    def boom(*_a, **_k):
        raise AssertionError("_compose_generation_prompt must not run for v2 materialization")

    monkeypatch.setattr(sds_pkg, "_compose_generation_prompt", boom)
    materialize_segment_scripts_from_v2_video_generation_specs(9, _v2_bp(), _bundle(), workflow_language="zh-CN")


def test_v2_build_segment_video_plan_never_calls_build_compact_shot_prompt(monkeypatch):
    from app.short_drama.schemas.segment import SegmentScriptSchema, ShotSchema

    def boom(*_a, **_k):
        raise AssertionError("_build_compact_shot_prompt must not run for v2 pass-through")

    from app.short_drama.utils import video_prompt_builder as vpb

    monkeypatch.setattr(vpb, "_build_compact_shot_prompt", boom)
    vp = "vertical 9:16 pass-through prompt " + ("x" * 80)
    seg = SegmentScriptSchema(
        segment_id="seg_1",
        title="t",
        duration_limit=6.0,
        shots=[
            ShotSchema(
                shot_id="s1",
                video_prompt=vp,
                generation_prompt=vp,
                character_asset_ids=["1"],
                scene_asset_id="2",
                product_asset_id="3",
                character_refs=["1"],
                scene_ref="2",
                product_refs=["3"],
            )
        ],
        meta={"video_prompt_v2_pass_through": True},
    )

    class _Row:
        __slots__ = ("id", "name", "image_url")

        def __init__(self, id: int, name: str, image_url: str):
            self.id = id
            self.name = name
            self.image_url = image_url

    chars = [_Row(1, "Lead", "https://example.invalid/c.png")]
    scenes = [_Row(2, "Apartment", "https://example.invalid/s.png")]
    prods = [_Row(3, "SKU", "https://example.invalid/p.png")]
    plan = build_segment_video_plan(
        seg,
        characters=chars,
        scenes=scenes,
        products=prods,
        project_aspect_ratio="9:16",
        project_id=55,
    )
    assert plan.segment_video_prompt.strip() == vp.strip()
