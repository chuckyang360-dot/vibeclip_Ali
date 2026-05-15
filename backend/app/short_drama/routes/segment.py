import logging
import json
import re
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ...database import SessionLocal, get_db
from ..exceptions import ShortDramaInvalidModelOutputError, ShortDramaProviderError
from ..http_errors import raise_short_drama_http
from ..models import SegmentScriptRecord
from ..schemas.asset import AssetSpecsBundleSchema, CharacterAssetSchema, ProductAssetSchema, SceneAssetSchema
from ..schemas.product import ProductContextSchema
from ..schemas.segment import (
    GenerateSegmentsRequest,
    GenerateSegmentsResponse,
    SegmentScriptSchema,
    UpdateSegmentShotRequest,
    UpdateSegmentShotResponse,
)
from ..schemas.story import parse_story_blueprint_json
from ..services.asset_v2_materialize_service import is_creative_blueprint_v2_project
from ..services.read_models import (
    latest_product_context,
    latest_story_blueprint,
    list_pipeline_asset_rows,
    next_segment_batch_version,
)
from ..services.segment_director_service import (
    segment_director_service,
    segments_from_story_shot_plan,
    s2_video_specs_materialization_eligible,
)
from ..services.video_v2_materialize_service import (
    materialize_segment_scripts_from_v2_video_generation_specs,
    v2_video_spec_expects_product_reference,
)
from ..services.project_state_service import STEP_4, mark_step_completed, update_last_active_step
from ..services.workflow_orchestrator import orchestrator
from ..services.project_task_guard import (
    acquire_project_task_lock,
    mark_project_stage_failed,
    mark_project_stage_succeeded,
    recover_stale_processing_status_if_possible,
)
from ..utils.enums import WorkflowStep
from ..utils.flow_logging import log_api_error, log_api_request, log_api_success
from ..utils.language import build_language_policy, language_prompt_rules, resolve_project_language_policy

logger = logging.getLogger(__name__)


def _trace(tag: str, payload: dict[str, Any]) -> None:
    logger.info("[AI_CHAIN_TRACE][%s] %s", tag, json.dumps(payload, ensure_ascii=False, default=str))

router = APIRouter()
_SECONDARY_MUST_SHOW_LIMIT = 3


def _clean_string_list(values: list[str] | None) -> list[str]:
    if values is None:
        return []
    out: list[str] = []
    seen: set[str] = set()
    for raw in values:
        item = str(raw or "").strip()
        if not item or item in seen:
            continue
        seen.add(item)
        out.append(item)
    return out


def _clean_asset_id_list(values: list[str] | None, *, keep_last_only: bool = False) -> list[str]:
    cleaned = [x for x in _clean_string_list(values) if re.fullmatch(r"\d+", x)]
    if keep_last_only and cleaned:
        return [cleaned[-1]]
    return cleaned


def _clean_asset_id(value: str | None) -> str:
    text = _safe_text(value)
    return text if re.fullmatch(r"\d+", text) else ""


def _safe_text(value: Any) -> str:
    return str(value or "").strip()


def _presentation_text(value: Any) -> str:
    text = _safe_text(value)
    blocked = (
        "MARKET VISUAL CONSTRAINTS",
        "STYLE CONSTRAINTS",
        "brand_raw",
        "conflict:",
        "detected_brand",
        "用户输入",
        "尽管输入",
    )
    out = text
    for token in blocked:
        out = out.replace(token, "")
    return re.sub(r"\s+", " ", out).strip()


def _presentation_product_presence(shot: dict[str, Any]) -> str:
    svc = shot.get("source_visual_constraints")
    if isinstance(svc, dict):
        v = str(svc.get("s2_ui_product_presence") or "").strip().lower()
        if v in ("explicit", "none"):
            return v
    return "explicit" if (shot.get("product_refs") or []) else "none"


def _presentation_shot_from_execution(shot: dict[str, Any], *, shot_index: int) -> dict[str, Any]:
    return {
        "shot_id": _safe_text(shot.get("shot_id") or f"shot_{shot_index}"),
        "shot_index": shot_index,
        "shot_role": _safe_text(shot.get("shot_role") or shot.get("shot_title")),
        "viewer_takeaway": _presentation_text(
            shot.get("presentation_viewer_takeaway")
            or shot.get("viewer_takeaway")
            or shot.get("source_selling_point")
            or shot.get("action_description")
        ),
        "visual_direction": _presentation_text(
            shot.get("presentation_visual_direction")
            or shot.get("visual_direction")
            or shot.get("visual_action")
            or shot.get("action_description")
        ),
        "character_action": _presentation_text(
            shot.get("presentation_character_action")
            or shot.get("character_action")
            or shot.get("action_description")
            or shot.get("visual_action")
        ),
        "product_presence": _presentation_product_presence(shot),
        "product_purpose": _safe_text(
            shot.get("presentation_product_purpose") or shot.get("product_purpose") or shot.get("source_selling_point")
        ),
        "scene_direction": _presentation_text(
            shot.get("presentation_scene_direction") or shot.get("scene_direction") or shot.get("scene_description") or shot.get("scene_ref")
        ),
        "camera_direction": _presentation_text(
            shot.get("camera_direction")
            or shot.get("camera_description")
            or " / ".join(
                [
                    _safe_text(shot.get("camera_framing") or shot.get("framing")),
                    _safe_text(shot.get("camera_movement")),
                ]
            )
        ),
        "duration_sec": float(shot.get("duration_seconds") or shot.get("duration_sec") or 0.0),
        "character_refs": [str(x) for x in (shot.get("character_refs") or []) if str(x).strip()],
        "character_asset_ids": _clean_asset_id_list([str(x) for x in (shot.get("character_asset_ids") or []) if str(x).strip()]),
        "scene_refs": [str(shot.get("scene_ref") or "").strip()] if str(shot.get("scene_ref") or "").strip() else [],
        "scene_asset_id": _clean_asset_id(_safe_text(shot.get("scene_asset_id"))),
        "product_refs": [str(x) for x in (shot.get("product_refs") or []) if str(x).strip()],
        "product_asset_id": _clean_asset_id(_safe_text(shot.get("product_asset_id"))),
        "dialogue_text": _presentation_text(shot.get("spoken_text") or shot.get("dialogue")),
        "voiceover_text": _presentation_text(shot.get("voiceover_text") or shot.get("voiceover") or shot.get("narration")),
        "subtitle_text": _presentation_text(shot.get("subtitle_text") or shot.get("subtitle")),
        "audio_intent": _presentation_text(shot.get("audio_intent") or shot.get("mood") or shot.get("emotion")),
    }


def _execution_shot_from_presentation(presentation: dict[str, Any], existing_execution: dict[str, Any] | None = None) -> dict[str, Any]:
    base = dict(existing_execution or {})
    shot_id = _safe_text(presentation.get("shot_id") or base.get("shot_id"))
    visual_direction = _safe_text(presentation.get("visual_direction") or base.get("visual_action") or base.get("action_description"))
    character_action = _safe_text(presentation.get("character_action") or visual_direction)
    dialogue_text = _safe_text(presentation.get("dialogue_text") or base.get("spoken_text") or base.get("dialogue"))
    voiceover_text = _safe_text(presentation.get("voiceover_text") or base.get("voiceover_text") or base.get("voiceover"))
    subtitle_text = _safe_text(presentation.get("subtitle_text") or base.get("subtitle_text") or base.get("subtitle"))
    character_refs = [str(x) for x in (presentation.get("character_refs") or base.get("character_refs") or []) if str(x).strip()]
    character_asset_ids = _clean_asset_id_list(
        [str(x) for x in (presentation.get("character_asset_ids") or base.get("character_asset_ids") or []) if str(x).strip()]
    )
    scene_refs = [str(x) for x in (presentation.get("scene_refs") or []) if str(x).strip()]
    scene_asset_id = _clean_asset_id(_safe_text(presentation.get("scene_asset_id") or base.get("scene_asset_id")))
    product_refs = [str(x) for x in (presentation.get("product_refs") or base.get("product_refs") or []) if str(x).strip()]
    product_asset_id = _clean_asset_id(_safe_text(presentation.get("product_asset_id") or base.get("product_asset_id")))
    scene_ref = scene_refs[0] if scene_refs else _safe_text(base.get("scene_ref"))
    duration_sec = float(presentation.get("duration_sec") or base.get("duration_seconds") or base.get("duration_sec") or 0.0)
    audio_intent = _safe_text(presentation.get("audio_intent") or base.get("audio_intent"))
    camera_direction = _safe_text(presentation.get("camera_direction"))
    subtitle_required = bool(subtitle_text)
    audio_required = bool(dialogue_text or voiceover_text)

    base.update(
        {
            "shot_id": shot_id,
            "shot_role": _safe_text(presentation.get("shot_role") or base.get("shot_role")),
            "shot_title": _safe_text(base.get("shot_title") or presentation.get("shot_role")),
            "visual_action": visual_direction,
            "action_description": character_action or visual_direction,
            "scene_ref": scene_ref,
            "character_refs": character_refs,
            "character_asset_ids": character_asset_ids,
            "product_refs": product_refs,
            "scene_asset_id": scene_asset_id,
            "product_asset_id": product_asset_id,
            "duration_seconds": duration_sec,
            "duration_sec": duration_sec,
            "spoken_text": dialogue_text,
            "dialogue": dialogue_text,
            "voiceover_text": voiceover_text,
            "voiceover": voiceover_text,
            "subtitle_text": subtitle_text,
            "subtitle": subtitle_text,
            "audio_intent": audio_intent,
            "dialogue_text": dialogue_text,
            "subtitle_text_presentation": subtitle_text,
            "camera_direction": camera_direction,
            "scene_description": _safe_text(presentation.get("scene_direction") or base.get("scene_description")),
            "camera_description": camera_direction or _safe_text(base.get("camera_description")),
            "source_selling_point": _safe_text(presentation.get("product_purpose") or base.get("source_selling_point")),
            "audio_required": audio_required,
            "subtitle_required": subtitle_required,
            "audio_status": "pending_tts_or_dubbing" if audio_required else "none",
        }
    )
    return base


def _build_layered_script_payload(seg: SegmentScriptSchema) -> dict[str, Any]:
    raw = seg.model_dump()
    execution_shots = [dict(s) for s in (raw.get("shots") or []) if isinstance(s, dict)]
    presentation_shots = [
        _presentation_shot_from_execution(shot, shot_index=idx + 1)
        for idx, shot in enumerate(execution_shots)
    ]
    meta = dict(raw.get("meta") or {})
    meta.setdefault("render_status", "clean")
    raw["meta"] = meta
    raw["presentation_shots"] = presentation_shots
    raw["execution_shots"] = execution_shots
    # Keep backward compatibility for S5 and legacy readers.
    raw["shots"] = execution_shots
    return raw


def _purpose_rank(v: str | None) -> int:
    x = (v or "").strip().lower()
    order = {
        "hero": 0,
        "core": 1,
        "sell": 2,
        "narrative": 3,
        "support": 4,
        "atmosphere": 5,
    }
    return order.get(x, 99)


def _narrative_rank(v: str | None) -> int:
    x = (v or "").strip().lower()
    order = {
        "hook": 0,
        "conflict": 1,
        "twist": 2,
        "resolution": 3,
    }
    return order.get(x, 99)


def _build_must_show_asset_ids(assets: AssetSpecsBundleSchema) -> list[int]:
    pool = [*assets.characters, *assets.scenes, *assets.products]
    primary = [a for a in pool if a.id is not None and (a.exposure_priority or "").lower() == "primary"]
    secondary = [a for a in pool if a.id is not None and (a.exposure_priority or "").lower() == "secondary"]
    # Hard constraint: background assets never enter must_show_asset_ids.
    secondary = sorted(
        secondary,
        key=lambda a: (
            _purpose_rank(a.purpose),
            _narrative_rank(a.narrative_function),
            int(a.id or 0),
        ),
    )[:_SECONDARY_MUST_SHOW_LIMIT]
    return [int(a.id) for a in [*primary, *secondary] if a.id is not None]


def _meta(row: Any) -> dict[str, Any]:
    m = getattr(row, "meta_json", None)
    return m if isinstance(m, dict) else {}


def _validate_step4_visual_anchor(assets: AssetSpecsBundleSchema) -> None:
    missing: list[str] = []

    def _check(kind: str, rows: list[Any]) -> None:
        for row in rows:
            if row.visual_anchor_image_id is None:
                missing.append(f"{kind}:{row.id or row.name}")

    _check("character", assets.characters)
    _check("scene", assets.scenes)
    _check("product", assets.products)
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Step4 generation blocked: visual_anchor_image_id is required for all "
                "CharacterSpec/SceneSpec/ProductSpec. Missing: " + ", ".join(missing)
            ),
        )


@router.post("/generate", response_model=GenerateSegmentsResponse)
async def generate_segments(body: GenerateSegmentsRequest, db: Session = Depends(get_db)):
    log_api_request(logger, "POST /segment/generate", project_id=body.project_id)
    lock_acquired = False
    try:
        project = orchestrator.get_project(db, body.project_id)
        recover_stale_processing_status_if_possible(db, project)
        project = orchestrator.get_project(db, body.project_id)
        orchestrator.assert_step_allowed(db, project, WorkflowStep.GENERATE_SEGMENTS)
        acquire_project_task_lock(db, project, stage="s4_segments")
        lock_acquired = True

        sb_row = latest_story_blueprint(db, body.project_id)
        pc_row = latest_product_context(db, body.project_id)
        if not sb_row:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Story blueprint missing; run /story/generate first",
            )

        chars, scenes, products = list_pipeline_asset_rows(db, body.project_id)
        if not chars and not scenes and not products:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Asset specs missing; run /assets/specs/generate first",
            )

        blueprint = parse_story_blueprint_json(sb_row.blueprint_json)
        product_ctx = ProductContextSchema.model_validate(pc_row.normalized_context_json) if pc_row else ProductContextSchema()
        assets = AssetSpecsBundleSchema(
            characters=[
                CharacterAssetSchema(
                    id=c.id,
                    name=c.name,
                    role_type=c.role_type,
                    description=c.description,
                    visual_prompt=c.visual_prompt,
                    image_url=c.image_url,
                    visual_anchor_image_id=_meta(c).get("visual_anchor_image_id"),
                    source_asset_version=str(_meta(c).get("source_asset_version") or "legacy-1"),
                    exposure_priority=str(_meta(c).get("exposure_priority") or "secondary"),
                    narrative_function=_meta(c).get("narrative_function"),
                    purpose=_meta(c).get("purpose"),
                    meta=_meta(c),
                )
                for c in chars
            ],
            scenes=[
                SceneAssetSchema(
                    id=s.id,
                    name=s.name,
                    scene_type=s.scene_type,
                    scene_form=_meta(s).get("scene_form"),
                    description=s.description,
                    visual_prompt=s.visual_prompt,
                    image_url=s.image_url,
                    visual_anchor_image_id=_meta(s).get("visual_anchor_image_id"),
                    source_asset_version=str(_meta(s).get("source_asset_version") or "legacy-1"),
                    exposure_priority=str(_meta(s).get("exposure_priority") or "secondary"),
                    narrative_function=_meta(s).get("narrative_function"),
                    purpose=_meta(s).get("purpose"),
                    meta=_meta(s),
                )
                for s in scenes
            ],
            products=[
                ProductAssetSchema(
                    id=p.id,
                    name=p.name,
                    product_role=_meta(p).get("product_role"),
                    description=p.description,
                    visual_prompt=p.visual_prompt,
                    image_url=p.image_url,
                    visual_anchor_image_id=_meta(p).get("visual_anchor_image_id"),
                    source_asset_version=str(_meta(p).get("source_asset_version") or "legacy-1"),
                    exposure_priority=str(_meta(p).get("exposure_priority") or "secondary"),
                    narrative_function=_meta(p).get("narrative_function"),
                    purpose=_meta(p).get("purpose"),
                    meta=_meta(p),
                )
                for p in products
            ],
        )
        must_show_asset_ids = _build_must_show_asset_ids(assets)
        assets = assets.model_copy(
            update={
                "characters": [
                    c.model_copy(update={"meta": {**(c.meta or {}), "must_show": (c.id in must_show_asset_ids)}})
                    for c in assets.characters
                ],
                "scenes": [
                    s.model_copy(update={"meta": {**(s.meta or {}), "must_show": (s.id in must_show_asset_ids)}})
                    for s in assets.scenes
                ],
                "products": [
                    p.model_copy(update={"meta": {**(p.meta or {}), "must_show": (p.id in must_show_asset_ids)}})
                    for p in assets.products
                ],
            }
        )

        raw_inputs = pc_row.raw_inputs_json if pc_row else {}
        inferred_language_policy = build_language_policy(
            workflow_source={"product": product_ctx.model_dump(), "raw_inputs": raw_inputs, "blueprint": blueprint.model_dump()},
            market_source={
                "raw_inputs": raw_inputs,
                "target_users": product_ctx.target_users,
                "usage_scenarios": product_ctx.usage_scenarios,
            },
            explicit_target_market=(project.target_market or "North America"),
        )
        language_policy = resolve_project_language_policy(
            project,
            inferred_language_policy,
            stage="S4_segment_director",
        )

        project_config = {
            "duration": project.duration,
            "format": project.format,
            "style": project.style,
            "visual_style": project.visual_style,
            "aspect_ratio": project.aspect_ratio,
            "target_market": language_policy["target_market"],
            "marketing_goal": project.marketing_goal or "brand_seeding",
            "target_audience": project.target_audience or "",
            "brand_tone": project.brand_tone or "natural",
            "creative_intent": project.creative_intent or "",
            "creative_brief": project.creative_brief or "",
            "workflow_language": language_policy["workflow_language"],
            "video_language": language_policy["video_language"],
            "language_policy": language_policy,
            "language_prompt_rules": language_prompt_rules(language_policy),
            "must_show_asset_ids": must_show_asset_ids,
            "s1_visual_constraints": {
                "visual_features": product_ctx.visual_features,
                "consistency_notes": product_ctx.consistency_notes,
                "visual_risk_notes": product_ctx.visual_risk_notes,
                "product_form": product_ctx.product_form,
                "usage_scenarios": product_ctx.usage_scenarios,
            },
        }
        project_config["legacy_creative_intent_summary"] = "；".join(
            [
                x
                for x in [
                    f"营销目标：{project_config['marketing_goal']}" if project_config["marketing_goal"] else "",
                    f"目标受众：{project_config['target_audience']}" if project_config["target_audience"] else "",
                    f"品牌调性：{project_config['brand_tone']}" if project_config["brand_tone"] else "",
                    f"补充说明：{project_config['creative_brief']}" if project_config["creative_brief"] else "",
                ]
                if x
            ]
        )
        project_config["effective_creative_intent"] = (
            project_config["creative_intent"] or project_config["legacy_creative_intent_summary"]
        )

        is_v2_blueprint = is_creative_blueprint_v2_project(blueprint)
        if is_v2_blueprint and body.force_segment_director:
            raise_short_drama_http(
                ShortDramaInvalidModelOutputError(
                    "creative_blueprint_v2 projects cannot use force_segment_director; S4 consumes video_generation_specs only.",
                    code="s4_v2_segment_director_forbidden",
                    missing_fields=["force_segment_director"],
                )
            )

        logger.info("[S4_DB_RELEASE_BEFORE_EXTERNAL_CALL] project_id=%s", body.project_id)
        db.close()
        try:
            segments: list[SegmentScriptSchema] | None = None
            source = ""

            if is_v2_blueprint:
                wf_lang = str(
                    project_config.get("workflow_language")
                    or (blueprint.language_policy or {}).get("workflow_language")
                    or ""
                )
                segments = materialize_segment_scripts_from_v2_video_generation_specs(
                    body.project_id,
                    blueprint,
                    assets,
                    workflow_language=wf_lang,
                    default_aspect_ratio=str(project.aspect_ratio or "9:16"),
                )
                source = "blueprint.video_generation_specs"
            else:
                logger.info(
                    "[S4_LEGACY_SEGMENT_PATH] %s",
                    json.dumps(
                        {"project_id": body.project_id, "reason": "not_creative_blueprint_v2"},
                        ensure_ascii=False,
                    ),
                )
                segments = None
                source = ""
                _, s2_skip_reason = s2_video_specs_materialization_eligible(
                    blueprint, force_segment_director=bool(body.force_segment_director)
                )

                if segments is None and not blueprint.creative_brief:
                    segments = segments_from_story_shot_plan(blueprint, assets=assets, project_config=project_config)
                    if segments is not None:
                        source = "story_blueprint.shot_plan"

                if segments is None:
                    fb_reason = s2_skip_reason
                    if body.force_segment_director:
                        fb_reason = "force_segment_director"
                    elif str(blueprint.blueprint_schema_version or "").strip() != "creative_blueprint_v2":
                        fb_reason = "not_creative_blueprint_v2"
                    elif not (blueprint.video_generation_specs or []):
                        fb_reason = "video_generation_specs_empty"
                    elif not any(str(x.video_prompt or "").strip() for x in blueprint.video_generation_specs):
                        fb_reason = "all_video_prompts_empty"
                    logger.info(
                        "[S4_FALLBACK_DIRECTOR_GENERATION] project_id=%s reason=%s",
                        body.project_id,
                        fb_reason,
                    )
                    try:
                        segments = segment_director_service.generate(body.project_id, blueprint, assets, project_config)
                        source = "segment_director_provider"
                    except ShortDramaInvalidModelOutputError as e:
                        logger.warning(
                            "[S4_SEGMENT_GENERATION_FALLBACK_TRIGGERED] project_id=%s error_type=%s error=%s",
                            body.project_id,
                            type(e).__name__,
                            str(e),
                        )
                        fallback_segments = segments_from_story_shot_plan(
                            blueprint,
                            assets=assets,
                            project_config=project_config,
                            force_from_shot_plan=True,
                        )
                        if fallback_segments:
                            source = "fallback_story_blueprint_shot_plan"
                            segments = []
                            for seg in fallback_segments:
                                seg_meta = dict(seg.meta or {})
                                seg_meta["source"] = "fallback_story_blueprint_shot_plan"
                                seg_meta["generation_warning"] = "structured_generation_failed_fallback_used"
                                seg_meta["original_error_type"] = type(e).__name__
                                segments.append(seg.model_copy(update={"meta": seg_meta}))
                        else:
                            shot_plan = blueprint.shot_plan if isinstance(blueprint.shot_plan, dict) else {}
                            shot_plan_segments = shot_plan.get("segments") if isinstance(shot_plan.get("segments"), list) else []
                            segment_plan = blueprint.segment_plan if isinstance(blueprint.segment_plan, list) else []
                            fallback_reason = "unknown"
                            if not shot_plan:
                                fallback_reason = "shot_plan_missing"
                            elif not shot_plan_segments:
                                fallback_reason = "shot_plan_segments_missing"
                            elif any(
                                not isinstance(seg, dict)
                                or not isinstance(seg.get("shots"), list)
                                or len(seg.get("shots") or []) == 0
                                for seg in shot_plan_segments
                            ):
                                fallback_reason = "shot_plan_segments_empty_or_invalid"
                            elif not segment_plan:
                                fallback_reason = "segment_plan_missing"
                            logger.warning(
                                "[S4_SEGMENT_GENERATION_FALLBACK_FAILED] %s",
                                {
                                    "project_id": body.project_id,
                                    "has_story_blueprint": bool(sb_row and sb_row.blueprint_json),
                                    "has_shot_plan": bool(shot_plan),
                                    "has_segment_plan": bool(segment_plan),
                                    "fallback_segments_count": 0,
                                    "reason": fallback_reason,
                                },
                            )
                            raise
            shot_count = sum(len(s.shots) for s in segments)
            story_framework = blueprint.story_framework if isinstance(blueprint.story_framework, dict) else {}
            original_structure = story_framework.get("structure") if isinstance(story_framework.get("structure"), list) else []
            segment_functions = [
                str((s.meta or {}).get("function_label") or s.goal or s.title or "").strip() for s in segments
            ]
            logger.info(
                "[S4_SHOT_PLAN_SOURCE] project_id=%s source=%s segment_count=%s shot_count=%s",
                body.project_id,
                source,
                len(segments),
                shot_count,
            )
            logger.info(
                "[S4_FRAMEWORK_SEGMENT_PLAN] %s",
                {
                    "project_id": body.project_id,
                    "duration": project_config.get("duration"),
                    "format": project_config.get("format"),
                    "story_framework_type": story_framework.get("type"),
                    "original_structure": original_structure,
                    "segment_count": len(segments),
                    "segment_functions": segment_functions,
                    "merged_from_structure": len(segments) <= len(original_structure),
                },
            )
            for seg in segments:
                first = seg.shots[0] if seg.shots else None
                char_refs = list((first.character_refs if first else []) or [])
                scene_ref = str((first.scene_ref if first else "") or "")
                prod_refs = list((first.product_refs if first else []) or [])
                missing_fields: list[str] = []
                meta_src = str((seg.meta or {}).get("source") or "").strip()
                is_v2_video_specs = meta_src == "v2_video_generation_specs"
                expects_product_ref = (
                    v2_video_spec_expects_product_reference(blueprint, assets, seg.segment_id)
                    if is_v2_video_specs
                    else True
                )
                product_asset_id_str = str((first.product_asset_id if first else "") or "").strip()
                has_product_bind = bool(prod_refs) or bool(product_asset_id_str)
                if not first:
                    missing_fields.append("shots")
                else:
                    if not str(first.action_description or "").strip():
                        missing_fields.append("action_description")
                    if float(first.duration_seconds or 0) <= 0:
                        missing_fields.append("duration_seconds")
                    if not char_refs:
                        missing_fields.append("character_refs")
                    if not scene_ref:
                        missing_fields.append("scene_ref")
                    if is_v2_video_specs:
                        if expects_product_ref and not has_product_bind:
                            missing_fields.append("product_refs")
                    else:
                        if not prod_refs:
                            missing_fields.append("product_refs")
                if is_v2_video_specs:
                    used_fallback_assets = False
                    asset_refs_complete = bool(char_refs and scene_ref) and (
                        not expects_product_ref or has_product_bind
                    )
                else:
                    used_fallback_assets = bool(char_refs or scene_ref or prod_refs)
                    asset_refs_complete = bool(char_refs and scene_ref and prod_refs)
                logger.info(
                    "[S4_SEGMENT_SHOT_FIELDS_BUILT] %s",
                    {
                        "project_id": body.project_id,
                        "segment_id": seg.segment_id,
                        "segment_name": seg.title,
                        "shot_count": len(seg.shots),
                        "first_shot_action_preview": str((first.action_description if first else "") or "")[:180],
                        "first_shot_duration": float((first.duration_seconds if first else 0) or 0),
                        "character_refs": char_refs,
                        "scene_ref": scene_ref,
                        "product_refs": prod_refs,
                        "used_fallback_assets": used_fallback_assets,
                        "missing_fields": missing_fields,
                    },
                )
                logger.info(
                    "[S4_SHOTS_BY_FRAMEWORK_BUILT] %s",
                    {
                        "project_id": body.project_id,
                        "segment_id": seg.segment_id,
                        "segment_function": str((seg.meta or {}).get("function_label") or seg.goal or seg.title or ""),
                        "shot_count": len(seg.shots),
                        "shot_actions_preview": [str(sh.action_description or "")[:120] for sh in seg.shots[:2]],
                        "asset_refs_complete": asset_refs_complete,
                    },
                )
        except (ShortDramaProviderError, ShortDramaInvalidModelOutputError) as e:
            # Recoverable model/validator issues: keep project out of terminal failed so user can retry.
            db.rollback()
            raise_short_drama_http(e)
        except Exception:
            logger.exception("Segment generation unexpected error project_id=%s", body.project_id)
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Segment generation failed",
            )

        logger.info("[S4_DB_REOPEN_FOR_WRITEBACK] project_id=%s", body.project_id)
        batch_ver = next_segment_batch_version(db, body.project_id)
        db.query(SegmentScriptRecord).filter(SegmentScriptRecord.project_id == body.project_id).delete(
            synchronize_session=False
        )
        record_ids: list[int] = []
        for seg in segments:
            asset_versions = {
                "characters": {str(c.id): c.source_asset_version for c in assets.characters if c.id is not None},
                "scenes": {str(s.id): s.source_asset_version for s in assets.scenes if s.id is not None},
                "products": {str(p.id): p.source_asset_version for p in assets.products if p.id is not None},
            }
            meta = dict(seg.meta or {})
            meta["must_show_asset_ids"] = must_show_asset_ids
            meta["asset_spec_versions"] = asset_versions
            meta["language_policy"] = language_policy
            row = SegmentScriptRecord(
                project_id=body.project_id,
                segment_id=seg.segment_id,
                script_json=_build_layered_script_payload(seg.model_copy(update={"meta": meta})),
                version=batch_ver,
            )
            _trace(
                "S4_SCRIPT_JSON_BEFORE_SAVE",
                {
                    "project_id": body.project_id,
                    "segment_id": seg.segment_id,
                    "script_json": row.script_json,
                },
            )
            db.add(row)
            db.flush()
            record_ids.append(row.id)

        mark_step_completed(project, STEP_4)
        update_last_active_step(project, STEP_4)
        orchestrator.advance_on_success(db, project, WorkflowStep.GENERATE_SEGMENTS)
        db.commit()
        final_status = project.status
        post_db = SessionLocal()
        try:
            mark_project_stage_succeeded(post_db, body.project_id, stage="s4_segments", status_after=final_status)
        finally:
            post_db.close()

        log_api_success(
            logger,
            "POST /segment/generate",
            project_id=body.project_id,
            segments_count=len(segments),
            record_ids_count=len(record_ids),
        )
        return GenerateSegmentsResponse(
            project_id=body.project_id,
            segments=segments,
            record_ids=record_ids,
        )
    except HTTPException as e:
        if lock_acquired:
            et = "storage_or_db_error" if e.status_code >= 500 else "request_conflict"
            if isinstance(e.detail, dict):
                et = str(e.detail.get("error_type") or et)
            fail_db = SessionLocal()
            try:
                mark_project_stage_failed(
                    fail_db,
                    body.project_id,
                    stage="s4_segments",
                    error_type_value=et,
                    message=str(e.detail),
                )
            except Exception:
                pass
            finally:
                fail_db.close()
        log_api_error(
            logger,
            "POST /segment/generate",
            str(e.detail),
            project_id=body.project_id,
            status_code=e.status_code,
        )
        raise


@router.patch("/{segment_id}/shots/{shot_id}", response_model=UpdateSegmentShotResponse)
async def update_segment_shot(
    segment_id: str,
    shot_id: str,
    body: UpdateSegmentShotRequest,
    db: Session = Depends(get_db),
):
    log_api_request(
        logger,
        "PATCH /segment/{segment_id}/shots/{shot_id}",
        project_id=body.project_id,
        segment_id=segment_id,
        shot_id=shot_id,
    )
    rec = (
        db.query(SegmentScriptRecord)
        .filter(
            SegmentScriptRecord.project_id == body.project_id,
            SegmentScriptRecord.segment_id == segment_id,
        )
        .first()
    )
    if not rec:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Segment {segment_id!r} not found")

    script = dict(rec.script_json) if isinstance(rec.script_json, dict) else {}
    shots = script.get("shots")
    if not isinstance(shots, list):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Segment has no editable shots")
    execution_shots = script.get("execution_shots") if isinstance(script.get("execution_shots"), list) else shots
    presentation_shots = script.get("presentation_shots") if isinstance(script.get("presentation_shots"), list) else [
        _presentation_shot_from_execution(s if isinstance(s, dict) else {}, shot_index=idx + 1)
        for idx, s in enumerate(execution_shots)
    ]

    target_index = -1
    for idx, raw in enumerate(execution_shots):
        shot = raw if isinstance(raw, dict) else {}
        sid = str(shot.get("shot_id") or f"shot_{idx + 1}")
        if sid == shot_id or str(idx + 1) == shot_id:
            target_index = idx
            break
    if target_index < 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Shot {shot_id!r} not found")

    if body.segment_title is not None:
        script["title"] = body.segment_title.strip()
    if body.segment_goal is not None:
        script["goal"] = body.segment_goal.strip()
    if body.duration_limit is not None:
        script["duration_limit"] = float(body.duration_limit or 0)

    shot = dict(execution_shots[target_index]) if isinstance(execution_shots[target_index], dict) else {}
    p_shot = (
        dict(presentation_shots[target_index])
        if target_index < len(presentation_shots) and isinstance(presentation_shots[target_index], dict)
        else _presentation_shot_from_execution(shot, shot_index=target_index + 1)
    )
    text_updates = {
        "action_description": body.action_description,
        "dialogue": body.spoken_text if body.spoken_text is not None else body.dialogue,
        "spoken_text": body.spoken_text if body.spoken_text is not None else body.dialogue,
        "voiceover": body.voiceover_text if body.voiceover_text is not None else body.voiceover,
        "voiceover_text": body.voiceover_text if body.voiceover_text is not None else body.voiceover,
        "subtitle_text": body.subtitle_text,
        "subtitle": body.subtitle_text,
        "emotion": body.emotion,
        "video_prompt": body.generation_prompt if body.generation_prompt is not None else body.video_prompt,
        "generation_prompt": body.generation_prompt if body.generation_prompt is not None else body.video_prompt,
        "manual_video_prompt": body.manual_video_prompt,
        "manual_scene_ref": body.manual_scene_ref,
    }
    for key, value in text_updates.items():
        if value is not None:
            shot[key] = str(value).strip()
    if body.duration_seconds is not None:
        shot["duration_seconds"] = float(body.duration_seconds or 0)
    if body.must_show is not None:
        shot["must_show"] = _clean_string_list(body.must_show)
    if body.must_avoid is not None:
        shot["must_avoid"] = _clean_string_list(body.must_avoid)
    if body.manual_character_refs is not None:
        shot["manual_character_refs"] = _clean_string_list(body.manual_character_refs)
    if body.manual_product_refs is not None:
        shot["manual_product_refs"] = _clean_string_list(body.manual_product_refs)
    if body.shot_role is not None:
        p_shot["shot_role"] = _safe_text(body.shot_role)
    if body.viewer_takeaway is not None:
        p_shot["viewer_takeaway"] = _safe_text(body.viewer_takeaway)
    if body.visual_direction is not None:
        p_shot["visual_direction"] = _safe_text(body.visual_direction)
    if body.character_direction is not None:
        p_shot["character_action"] = _safe_text(body.character_direction)
    if body.product_presence is not None:
        p_shot["product_presence"] = _safe_text(body.product_presence)
    if body.product_purpose is not None:
        p_shot["product_purpose"] = _safe_text(body.product_purpose)
    if body.scene_direction is not None:
        p_shot["scene_direction"] = _safe_text(body.scene_direction)
    if body.camera_direction is not None:
        p_shot["camera_direction"] = _safe_text(body.camera_direction)
    if body.dialogue_text is not None:
        p_shot["dialogue_text"] = _safe_text(body.dialogue_text)
    if body.voiceover_text is not None:
        p_shot["voiceover_text"] = _safe_text(body.voiceover_text)
    if body.subtitle_text_presentation is not None:
        p_shot["subtitle_text"] = _safe_text(body.subtitle_text_presentation)
    elif body.subtitle_text is not None:
        p_shot["subtitle_text"] = _safe_text(body.subtitle_text)
    if body.audio_intent is not None:
        p_shot["audio_intent"] = _safe_text(body.audio_intent)
    if body.character_refs is not None:
        p_shot["character_refs"] = _clean_string_list(body.character_refs)
    if body.character_asset_ids is not None:
        p_shot["character_asset_ids"] = _clean_asset_id_list(body.character_asset_ids, keep_last_only=True)
    if body.scene_refs is not None:
        p_shot["scene_refs"] = _clean_string_list(body.scene_refs)
    if body.scene_asset_id is not None:
        p_shot["scene_asset_id"] = _clean_asset_id(body.scene_asset_id)
    if body.product_refs is not None:
        p_shot["product_refs"] = _clean_string_list(body.product_refs)
    if body.product_asset_id is not None:
        p_shot["product_asset_id"] = _clean_asset_id(body.product_asset_id)
    if body.duration_sec is not None:
        p_shot["duration_sec"] = float(body.duration_sec or 0)
    # Runtime cleanup for legacy mixed pollution in asset id fields.
    p_shot["character_asset_ids"] = _clean_asset_id_list(
        [str(x) for x in (p_shot.get("character_asset_ids") or []) if str(x).strip()],
        keep_last_only=True,
    )
    p_shot["scene_asset_id"] = _clean_asset_id(_safe_text(p_shot.get("scene_asset_id")))
    p_shot["product_asset_id"] = _clean_asset_id(_safe_text(p_shot.get("product_asset_id")))
    p_shot["asset_refs"] = {
        "character_asset_ids": p_shot["character_asset_ids"],
        "scene_asset_id": p_shot["scene_asset_id"],
        "product_asset_id": p_shot["product_asset_id"],
    }
    shot.setdefault("shot_id", shot_id)
    shot["manual_updated_at"] = datetime.now(timezone.utc).isoformat()
    p_shot["shot_id"] = shot.get("shot_id") or p_shot.get("shot_id") or shot_id
    p_shot["shot_index"] = p_shot.get("shot_index") or (target_index + 1)
    merged_execution = _execution_shot_from_presentation(p_shot, shot)
    execution_shots[target_index] = merged_execution
    if target_index < len(presentation_shots):
        presentation_shots[target_index] = p_shot
    else:
        presentation_shots.append(p_shot)
    script["presentation_shots"] = presentation_shots
    script["execution_shots"] = execution_shots
    script["shots"] = execution_shots
    meta = dict(script.get("meta") or {})
    meta["needs_regeneration"] = True
    meta["dirty_segment_id"] = segment_id
    meta["dirty_shot_id"] = shot_id
    meta["manual_updated_at"] = shot["manual_updated_at"]
    meta["render_status"] = "dirty"
    script["meta"] = meta

    rec.script_json = script
    db.add(rec)
    db.commit()
    db.refresh(rec)

    log_api_success(
        logger,
        "PATCH /segment/{segment_id}/shots/{shot_id}",
        project_id=body.project_id,
        segment_id=segment_id,
        shot_id=shot_id,
        needs_regeneration=True,
    )
    return UpdateSegmentShotResponse(
        project_id=body.project_id,
        segment_id=segment_id,
        shot_id=shot_id,
        segment=script,
        shot=p_shot,
        needs_regeneration=True,
    )
