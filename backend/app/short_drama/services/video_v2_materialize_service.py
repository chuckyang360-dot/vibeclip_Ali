"""P3: deterministic S4 segment scripts from creative_blueprint_v2.video_generation_specs only."""

from __future__ import annotations

import json
import logging
from collections import OrderedDict
from typing import Any

from ..exceptions import ShortDramaInvalidModelOutputError
from ..schemas.asset import AssetSpecsBundleSchema, CharacterAssetSchema, ProductAssetSchema, SceneAssetSchema
from ..schemas.segment import SegmentScriptSchema, ShotSchema
from ..schemas.story import StoryBlueprintSchema, VideoGenerationSpecSchema
from .segment_director_service import (
    CREATIVE_BLUEPRINT_V2_SCHEMA_VERSION,
    _segment_title_from_plan,
    _spoken_voiceover_subtitle_for_ref,
)

logger = logging.getLogger(__name__)
_PROVIDER_MAX_DURATION_SECONDS = 10.0


def _log_validate_fail(
    project_id: int,
    *,
    spec_key: str,
    segment_id: str,
    shot_id: str,
    missing_field: str,
    reason: str,
) -> None:
    logger.warning(
        "[S4_VIDEO_SPEC_VALIDATE_FAILED] %s",
        json.dumps(
            {
                "project_id": project_id,
                "spec_key": spec_key,
                "segment_id": segment_id,
                "shot_id": shot_id,
                "missing_field": missing_field,
                "reason": reason,
            },
            ensure_ascii=False,
        ),
    )


def _raise_v(
    project_id: int,
    *,
    spec_key: str,
    segment_id: str,
    shot_id: str,
    missing_field: str,
    reason: str,
) -> None:
    _log_validate_fail(
        project_id,
        spec_key=spec_key,
        segment_id=segment_id,
        shot_id=shot_id,
        missing_field=missing_field,
        reason=reason,
    )
    raise ShortDramaInvalidModelOutputError(
        reason,
        code="s4_v2_video_spec_invalid",
        missing_fields=[f"{spec_key or segment_id}:{missing_field}"],
    )


def _type_fields_asset_key(meta: dict[str, Any] | None) -> str:
    m = meta or {}
    tf = m.get("type_fields")
    if isinstance(tf, dict):
        return str(tf.get("asset_key") or "").strip()
    return ""


def _find_bundle_row_for_asset_key(
    assets: AssetSpecsBundleSchema,
    asset_key: str,
) -> tuple[str, CharacterAssetSchema | SceneAssetSchema | ProductAssetSchema] | None:
    key = str(asset_key or "").strip()
    if not key:
        return None
    for c in assets.characters:
        if _type_fields_asset_key(c.meta if isinstance(c.meta, dict) else {}) == key:
            return "character", c
    for s in assets.scenes:
        if _type_fields_asset_key(s.meta if isinstance(s.meta, dict) else {}) == key:
            return "scene", s
    for p in assets.products:
        if _type_fields_asset_key(p.meta if isinstance(p.meta, dict) else {}) == key:
            return "product", p
    return None


def v2_video_spec_expects_product_reference(
    blueprint: StoryBlueprintSchema,
    assets: AssetSpecsBundleSchema,
    segment_id: str,
) -> bool:
    """True iff the v2 video_generation_specs row for segment_id lists a reference_asset_key bound to a product row."""
    sid = str(segment_id or "").strip()
    for sp in blueprint.video_generation_specs or []:
        if str(sp.segment_id or "").strip() != sid:
            continue
        for rk in sp.reference_asset_keys or []:
            found = _find_bundle_row_for_asset_key(assets, str(rk).strip())
            if found is not None and found[0] == "product":
                return True
        return False
    return False


def _validate_single_spec_per_segment(project_id: int, specs: list[VideoGenerationSpecSchema]) -> None:
    counts: dict[str, int] = {}
    for sp in specs:
        sid = str(sp.segment_id or "").strip()
        if not sid:
            _raise_v(
                project_id,
                spec_key=str(sp.spec_key or ""),
                segment_id="",
                shot_id=str(sp.shot_id or ""),
                missing_field="segment_id",
                reason="Each video_generation_specs row requires segment_id.",
            )
        counts[sid] = counts.get(sid, 0) + 1
    for sid, n in counts.items():
        if n > 1:
            _raise_v(
                project_id,
                spec_key="(multiple)",
                segment_id=sid,
                shot_id="",
                missing_field="video_generation_specs_per_segment",
                reason=(
                    f"creative_blueprint_v2 allows at most one video_generation_specs row per segment_id; "
                    f"found {n} for {sid!r}. Regenerate S2 so each segment has a single spec, or split segments."
                ),
            )


def _bind_reference_asset_keys_strict(
    project_id: int,
    spec: VideoGenerationSpecSchema,
    assets: AssetSpecsBundleSchema,
) -> dict[str, Any]:
    """Resolve reference_asset_keys to legacy bundle rows with image_url; no fallbacks."""
    spec_key = str(spec.spec_key or "").strip()
    segment_id = str(spec.segment_id or "").strip()
    shot_id = str(spec.shot_id or "").strip()
    keys = [str(x).strip() for x in (spec.reference_asset_keys or []) if str(x).strip()]
    if not keys:
        _raise_v(
            project_id,
            spec_key=spec_key,
            segment_id=segment_id,
            shot_id=shot_id,
            missing_field="reference_asset_keys",
            reason="reference_asset_keys is required for v2 video_generation_specs.",
        )

    character_refs: list[str] = []
    character_asset_ids: list[str] = []
    product_refs: list[str] = []
    scene_ref = ""
    scene_asset_id = ""
    product_asset_id = ""

    for rk in keys:
        found = _find_bundle_row_for_asset_key(assets, rk)
        if found is None:
            logger.warning(
                "[S4_VIDEO_SPEC_ASSET_REF_MISSING] %s",
                json.dumps({"project_id": project_id, "spec_key": spec_key, "reference_asset_key": rk}, ensure_ascii=False),
            )
            _raise_v(
                project_id,
                spec_key=spec_key,
                segment_id=segment_id,
                shot_id=shot_id,
                missing_field="reference_asset_keys",
                reason=f"No pipeline asset row with type_fields.asset_key matching reference_asset_key {rk!r}. Complete S3 first.",
            )
        kind, row = found
        url = str(row.image_url or "").strip()
        if not url:
            aid = getattr(row, "id", None)
            logger.warning(
                "[S4_VIDEO_SPEC_ASSET_IMAGE_MISSING] %s",
                json.dumps(
                    {
                        "project_id": project_id,
                        "spec_key": spec_key,
                        "reference_asset_key": rk,
                        "asset_id": aid,
                    },
                    ensure_ascii=False,
                ),
            )
            _raise_v(
                project_id,
                spec_key=spec_key,
                segment_id=segment_id,
                shot_id=shot_id,
                missing_field="image_url",
                reason=f"Asset for reference_asset_key {rk!r} has no image_url; run S3 image generation first.",
            )
        rid = getattr(row, "id", None)
        sid = str(rid) if rid is not None else ""
        if kind == "character" and sid:
            if sid not in character_asset_ids:
                character_asset_ids.append(sid)
            if sid not in character_refs:
                character_refs.append(sid)
        elif kind == "scene" and sid:
            scene_ref = sid
            scene_asset_id = sid
        elif kind == "product" and sid:
            if sid not in product_refs:
                product_refs.append(sid)
            if not product_asset_id:
                product_asset_id = sid

    scene_description = ""
    if scene_asset_id:
        for s in assets.scenes:
            if str(s.id) == scene_asset_id:
                scene_description = str(s.description or s.name or "").strip()
                break
    subject_description = ""
    if character_asset_ids:
        cid = character_asset_ids[0]
        for c in assets.characters:
            if c.id is not None and str(c.id) == cid:
                subject_description = str(c.description or c.name or "").strip()
                break

    return {
        "character_refs": character_refs,
        "character_asset_ids": character_asset_ids,
        "scene_ref": scene_ref,
        "scene_asset_id": scene_asset_id,
        "product_refs": product_refs,
        "product_asset_id": product_asset_id,
        "scene_description": scene_description,
        "subject_description": subject_description,
    }


def materialize_segment_scripts_from_v2_video_generation_specs(
    project_id: int,
    blueprint: StoryBlueprintSchema,
    assets: AssetSpecsBundleSchema,
    *,
    workflow_language: str = "",
    default_aspect_ratio: str = "9:16",
) -> list[SegmentScriptSchema]:
    """Strict v2 path: one video_generation_spec per segment_id; video_prompt is authoritative."""
    if str(blueprint.blueprint_schema_version or "").strip() != CREATIVE_BLUEPRINT_V2_SCHEMA_VERSION:
        _raise_v(
            project_id,
            spec_key="",
            segment_id="",
            shot_id="",
            missing_field="blueprint_schema_version",
            reason="materialize_segment_scripts_from_v2_video_generation_specs requires creative_blueprint_v2.",
        )

    specs = list(blueprint.video_generation_specs or [])
    if not specs:
        _raise_v(
            project_id,
            spec_key="",
            segment_id="",
            shot_id="",
            missing_field="video_generation_specs",
            reason="video_generation_specs is empty.",
        )

    _validate_single_spec_per_segment(project_id, specs)

    wf_lang = workflow_language or str((blueprint.language_policy or {}).get("workflow_language") or "")

    buckets: OrderedDict[str, VideoGenerationSpecSchema] = OrderedDict()
    for sp in specs:
        sid = str(sp.segment_id or "").strip()
        if sid in buckets:
            continue
        buckets[sid] = sp

    asset_ref_total = sum(len(list(s.reference_asset_keys or [])) for s in buckets.values())
    logger.info(
        "[S4_V2_VIDEO_SPECS_USE_BLUEPRINT] %s",
        json.dumps(
            {
                "project_id": project_id,
                "video_specs_count": len(buckets),
                "segment_count": len(buckets),
                "asset_ref_count": asset_ref_total,
            },
            ensure_ascii=False,
        ),
    )

    segments_out: list[SegmentScriptSchema] = []
    for segment_id, spec in buckets.items():
        sk = str(spec.spec_key or "").strip()
        if not sk:
            _raise_v(
                project_id,
                spec_key="",
                segment_id=segment_id,
                shot_id=str(spec.shot_id or ""),
                missing_field="spec_key",
                reason="spec_key is required for v2 video_generation_specs.",
            )
        vp = str(spec.video_prompt or "").strip()
        if not vp:
            _raise_v(
                project_id,
                spec_key=sk,
                segment_id=segment_id,
                shot_id=str(spec.shot_id or ""),
                missing_field="video_prompt",
                reason="video_prompt must be non-empty.",
            )
        d_sec = float(spec.duration_sec or 0.0)
        if d_sec <= 0:
            _raise_v(
                project_id,
                spec_key=sk,
                segment_id=segment_id,
                shot_id=str(spec.shot_id or ""),
                missing_field="duration_sec",
                reason="duration_sec must be > 0.",
            )
        if d_sec > _PROVIDER_MAX_DURATION_SECONDS:
            _raise_v(
                project_id,
                spec_key=sk,
                segment_id=segment_id,
                shot_id=str(spec.shot_id or ""),
                missing_field="duration_sec",
                reason=(
                    f"duration_sec must be <= {_PROVIDER_MAX_DURATION_SECONDS}; "
                    "regenerate or repair S2 so the AI shortens or splits this segment."
                ),
            )

        plan_row = next(
            (p for p in (blueprint.segment_plan or []) if str(p.segment_id or "").strip() == segment_id),
            None,
        )
        title = _segment_title_from_plan(plan_row, segment_id=segment_id)
        duration_limit = float(d_sec)

        bind = _bind_reference_asset_keys_strict(project_id, spec, assets)

        dref = str(spec.dialogue_or_voiceover_ref or "").strip()
        spoken_t, dialogue_t, vtext, subtxt = _spoken_voiceover_subtitle_for_ref(blueprint, dref)

        shot_id = str(spec.shot_id or "").strip() or sk
        ar_use = str(spec.aspect_ratio or "").strip() or str(default_aspect_ratio or "").strip() or "9:16"
        cam = str(spec.camera or "").strip()
        va = str(spec.visual_action or "").strip()
        audio_notes = str(spec.audio_notes or "").strip()
        ms = list(spec.must_show or []) if spec.must_show is not None else []
        ma = list(spec.must_avoid or []) if spec.must_avoid is not None else []

        scene_name = ""
        if bind.get("scene_asset_id"):
            for s in assets.scenes:
                if str(s.id) == str(bind.get("scene_asset_id")):
                    scene_name = str(s.name or "").strip()
                    break

        summary_any = ""
        if plan_row is not None:
            summary_any = (
                str(plan_row.summary or "").strip()
                or str(plan_row.segment_goal or "").strip()
                or str(plan_row.goal or "").strip()
            )
        overview = blueprint.story_overview
        if not summary_any and overview is not None:
            summary_any = str(overview.premise or overview.title or "").strip()

        pres_viewer = summary_any or title
        # v2 execution prompt is authoritative (video_prompt only); do not compose presentation hints from camera/visual_action.
        pres_visual = ""
        pres_char = ""
        pres_scene = scene_name or str(bind.get("scene_description") or "").strip()
        pres_prod = "product_reference_included" if bind.get("product_asset_id") else "no_product_reference"

        raw_spec = spec.model_dump()
        source_visual = {
            "v2_video_generation_spec": raw_spec,
            "segment_script_source": "v2_video_generation_specs",
            "reference_asset_keys": list(spec.reference_asset_keys or []),
            "dialogue_or_voiceover_ref": dref,
            "dialogue_or_voiceover_text": vtext or spoken_t or subtxt,
            "aspect_ratio": ar_use,
            "video_prompt_v2_pass_through": True,
        }

        shot = ShotSchema(
            shot_id=shot_id,
            shot_title=sk,
            shot_role=sk,
            shot_type="v2_video_spec",
            scene_ref=str(bind.get("scene_ref") or ""),
            scene_id=str(bind.get("scene_ref") or ""),
            character_refs=list(bind.get("character_refs") or []),
            character_ids=list(bind.get("character_refs") or []),
            character_asset_ids=[str(x) for x in (bind.get("character_asset_ids") or []) if str(x).strip()],
            product_refs=list(bind.get("product_refs") or []),
            product_ids=list(bind.get("product_refs") or []),
            scene_asset_id=str(bind.get("scene_asset_id") or ""),
            product_asset_id=str(bind.get("product_asset_id") or ""),
            visual_action=va,
            action_description=va,
            scene_description=str(bind.get("scene_description") or ""),
            subject_description=str(bind.get("subject_description") or ""),
            camera_description=cam,
            camera=cam,
            image_prompt=vp,
            video_prompt=vp,
            generation_prompt=vp,
            duration_seconds=duration_limit,
            duration_sec=duration_limit,
            spoken_text=spoken_t,
            dialogue=dialogue_t,
            voiceover_text=vtext,
            voiceover=vtext or None,
            narration=vtext or "",
            subtitle_text=subtxt,
            subtitle=subtxt,
            must_show=ms,
            must_avoid=ma,
            required_assets=[
                *(bind.get("character_refs") or []),
                str(bind.get("scene_ref") or ""),
                *(bind.get("product_refs") or []),
            ],
            source_segment_id=segment_id,
            source_visual_constraints=source_visual,
            audio_intent=audio_notes,
            presentation_viewer_takeaway=pres_viewer,
            presentation_visual_direction=pres_visual,
            presentation_character_action=pres_char,
            presentation_scene_direction=pres_scene,
            presentation_product_purpose=pres_prod,
        )

        function_label = ""
        if plan_row is not None:
            function_label = str(plan_row.stage_name or plan_row.goal or plan_row.segment_goal or "").strip()

        segments_out.append(
            SegmentScriptSchema(
                segment_id=segment_id,
                title=title,
                duration_limit=duration_limit,
                goal=str(plan_row.goal or plan_row.segment_goal or "") if plan_row is not None else "",
                shots=[shot],
                meta={
                    "source": "v2_video_generation_specs",
                    "video_prompt_v2_pass_through": True,
                    "function_label": function_label or title,
                    "workflow_language": wf_lang,
                },
            )
        )

        logger.info(
            "[S4_V2_VIDEO_SPEC_MATERIALIZED] %s",
            json.dumps(
                {
                    "project_id": project_id,
                    "segment_id": segment_id,
                    "shot_id": shot_id,
                    "spec_key": sk,
                    "reference_asset_keys_count": len(list(spec.reference_asset_keys or [])),
                },
                ensure_ascii=False,
            ),
        )

    return segments_out
