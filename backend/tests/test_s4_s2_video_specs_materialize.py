"""P3 / S4: v2 video_generation_specs materialization + video_prompt_builder pass-through."""

from __future__ import annotations

import pytest

from app.short_drama.exceptions import ShortDramaInvalidModelOutputError, ShortDramaVideoInputError
from app.short_drama.schemas.asset import AssetSpecsBundleSchema, CharacterAssetSchema, ProductAssetSchema, SceneAssetSchema
from app.short_drama.schemas.segment import SegmentScriptSchema, ShotSchema
from app.short_drama.schemas.story import default_creative_blueprint_v2_attachment, parse_story_blueprint_json
from app.short_drama.services.segment_director_service import s2_video_specs_materialization_eligible
from app.short_drama.services.video_v2_materialize_service import (
    materialize_segment_scripts_from_v2_video_generation_specs,
    v2_video_spec_expects_product_reference,
)
from app.short_drama.utils.video_prompt_builder import build_segment_video_plan


def _bundle_with_asset_keys() -> AssetSpecsBundleSchema:
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
                name="HeroSKU",
                description="hero sku",
                visual_prompt="pvp",
                image_url="https://example.invalid/prod.png",
                meta={"type_fields": {"asset_key": "asset_prod_main"}},
            )
        ],
    )


def _v2_blueprint(*, extra_video: list[dict] | None = None) -> StoryBlueprintSchema:
    att = default_creative_blueprint_v2_attachment(product_name="HeroSKU")
    raw: dict = {
        "blueprint_schema_version": "creative_blueprint_v2",
        "title": "Test",
        "premise": "p",
        "language_policy": {"workflow_language": "zh-CN", "video_language": "zh-CN"},
        "segment_plan": [
            {
                "segment_id": "seg_1",
                "segment_title": "开场吸引",
                "title": "Hook",
                "summary": "让观众感到清晨通勤的压力与情绪共鸣。",
                "segment_goal": "建立情绪共鸣",
                "goal": "引发共情",
                "duration_sec": 8.0,
            }
        ],
        **att,
    }
    if extra_video is not None:
        raw["video_generation_specs"] = extra_video
    return parse_story_blueprint_json(raw)


def test_s2_eligible_helper_still_reports_v2():
    bp = _v2_blueprint()
    ok, reason = s2_video_specs_materialization_eligible(bp, force_segment_director=False)
    assert ok is True


def test_v2_materialize_single_shot_per_segment():
    bp = _v2_blueprint()
    assets = _bundle_with_asset_keys()
    segs = materialize_segment_scripts_from_v2_video_generation_specs(99, bp, assets, workflow_language="zh-CN")
    assert len(segs) == 1
    assert len(segs[0].shots) == 1
    assert segs[0].meta.get("video_prompt_v2_pass_through") is True
    assert "handheld" in (segs[0].shots[0].video_prompt or "").lower()


def test_v2_expects_product_reference_true_when_spec_lists_product_key():
    bp = _v2_blueprint()
    assets = _bundle_with_asset_keys()
    assert v2_video_spec_expects_product_reference(bp, assets, "seg_1") is True


def test_v2_expects_product_reference_false_when_only_char_scene_keys():
    vid = {
        "spec_key": "v1",
        "segment_id": "seg_1",
        "shot_id": "h1",
        "video_prompt": "D" * 80,
        "reference_asset_keys": ["asset_char_main", "asset_scene_main"],
        "duration_sec": 4.0,
        "aspect_ratio": "9:16",
        "camera": "static",
        "visual_action": "walk",
        "audio_notes": "",
        "dialogue_or_voiceover_ref": "",
        "must_show": [],
        "must_avoid": [],
    }
    bp = _v2_blueprint(extra_video=[vid])
    assets = _bundle_with_asset_keys()
    assert v2_video_spec_expects_product_reference(bp, assets, "seg_1") is False


def test_v2_materialize_empty_product_refs_when_no_product_reference_key():
    vid = {
        "spec_key": "v1",
        "segment_id": "seg_1",
        "shot_id": "h1",
        "video_prompt": "E" * 80,
        "reference_asset_keys": ["asset_char_main", "asset_scene_main"],
        "duration_sec": 4.0,
        "aspect_ratio": "9:16",
        "camera": "static",
        "visual_action": "walk",
        "audio_notes": "",
        "dialogue_or_voiceover_ref": "",
        "must_show": [],
        "must_avoid": [],
    }
    bp = _v2_blueprint(extra_video=[vid])
    segs = materialize_segment_scripts_from_v2_video_generation_specs(
        23, bp, _bundle_with_asset_keys(), workflow_language="zh-CN"
    )
    shot = segs[0].shots[0]
    assert shot.product_refs == []
    assert str(shot.product_asset_id or "").strip() == ""


def test_v2_rejects_two_specs_same_segment():
    bp = _v2_blueprint()
    d = bp.model_dump()
    vids = list(d["video_generation_specs"])
    vids.append(
        {
            "spec_key": "vid_extra",
            "segment_id": "seg_1",
            "shot_id": "x",
            "video_prompt": "Second clip prompt text long enough for tests and provider minimums.",
            "reference_asset_keys": ["asset_char_main", "asset_scene_main"],
            "duration_sec": 3.0,
            "aspect_ratio": "9:16",
            "camera": "static",
            "visual_action": "look",
            "audio_notes": "",
            "dialogue_or_voiceover_ref": "",
            "must_show": [],
            "must_avoid": [],
        }
    )
    d["video_generation_specs"] = vids
    bp2 = parse_story_blueprint_json(d)
    assets = _bundle_with_asset_keys()
    with pytest.raises(ShortDramaInvalidModelOutputError):
        materialize_segment_scripts_from_v2_video_generation_specs(1, bp2, assets, workflow_language="zh-CN")


def test_v2_missing_reference_asset_key():
    bp = _v2_blueprint(
        extra_video=[
            {
                "spec_key": "v1",
                "segment_id": "seg_1",
                "shot_id": "h1",
                "video_prompt": "C" * 80,
                "reference_asset_keys": ["unknown_key"],
                "duration_sec": 4.0,
                "aspect_ratio": "9:16",
                "camera": "static",
                "visual_action": "walk",
                "audio_notes": "",
                "dialogue_or_voiceover_ref": "",
                "must_show": [],
                "must_avoid": [],
            }
        ]
    )
    assets = _bundle_with_asset_keys()
    with pytest.raises(ShortDramaInvalidModelOutputError):
        materialize_segment_scripts_from_v2_video_generation_specs(2, bp, assets, workflow_language="zh-CN")


def test_v2_missing_image_url_on_asset():
    bp = _v2_blueprint()
    bad_assets = _bundle_with_asset_keys()
    bad_assets = bad_assets.model_copy(
        update={
            "characters": [
                bad_assets.characters[0].model_copy(
                    update={"image_url": None, "meta": {"type_fields": {"asset_key": "asset_char_main"}}}
                )
            ]
        }
    )
    with pytest.raises(ShortDramaInvalidModelOutputError):
        materialize_segment_scripts_from_v2_video_generation_specs(3, bp, bad_assets, workflow_language="zh-CN")


def test_v2_video_prompt_pass_through_no_shot_prefix():
    vp = "Handheld lifestyle wide; vertical 9:16; natural pacing for reference-to-video."
    seg = SegmentScriptSchema(
        segment_id="seg_1",
        title="t",
        duration_limit=6.0,
        shots=[
            ShotSchema(
                shot_id="seg_1_shot_1",
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
        project_id=7,
    )
    assert not plan.segment_video_prompt.strip().lower().startswith("shot ")
    assert "Shot seg" not in plan.segment_video_prompt
    assert plan.segment_video_prompt.strip() == vp.strip()
    assert plan.prompt_budget.get("v2_pass_through") is True


def test_v2_prompt_too_long_raises():
    vp = "x" * 5000
    seg = SegmentScriptSchema(
        segment_id="seg_1",
        title="t",
        duration_limit=6.0,
        shots=[
            ShotSchema(
                shot_id="a",
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
    with pytest.raises(ShortDramaVideoInputError):
        build_segment_video_plan(
            seg,
            characters=chars,
            scenes=scenes,
            products=prods,
            project_aspect_ratio="9:16",
            project_id=8,
        )


def test_v2_materialize_never_invokes_segment_director_generate(monkeypatch):
    from app.short_drama.services import segment_director_service as sds

    def boom(*_a, **_k):
        raise AssertionError("segment_director_service.generate must not run for v2 materialization")

    monkeypatch.setattr(sds, "generate", boom)
    bp = _v2_blueprint()
    materialize_segment_scripts_from_v2_video_generation_specs(
        42, bp, _bundle_with_asset_keys(), workflow_language="zh-CN"
    )
