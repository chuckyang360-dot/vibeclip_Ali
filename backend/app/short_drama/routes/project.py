import logging
import json
import time
from urllib.parse import parse_qs, urlparse

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy.sql import func

from ...database import get_db
from ...models import User
from ..models import (
    ShortDramaProject,
)
from ..schemas.project import (
    CreateShortDramaProjectRequest,
    CreateShortDramaProjectResponse,
    CreativeBriefGenerateResponse,
    CreativeIntentInput,
    CreativeIntentInputResponse,
    ProjectCoverAsset,
    ProjectEntryRedirectResponse,
    PipelineSummaryResponse,
    ProductInput,
    ProductInputResponse,
    ShortDramaProjectListResponse,
    ShortDramaProjectResponse,
    TouchProjectStepRequest,
)
from ..services.creative_brief_service import (
    creative_brief_service,
    get_s0_s1_state,
    normalize_creative_intent_input,
    normalize_product_input,
    update_s0_s1_state,
)
from ..services.project_state_service import (
    STEP_1,
    STEP_2,
    STEP_3,
    STEP_4,
    OVERVIEW,
    compute_overall_status,
    default_step_status,
    normalize_step_status,
    update_last_active_step,
)
from ..services.pipeline_video_state import (
    build_pipeline_video_state,
    preload_segment_render_jobs,
    segment_row_video_fields,
)
from ..services.read_models import (
    all_segment_scripts_have_video,
    latest_final_render_job,
    latest_final_video_url,
    list_asset_rows,
    list_pipeline_asset_rows,
    latest_product_context,
    latest_story_blueprint,
    list_segment_scripts,
)
from ..services.workflow_orchestrator import orchestrator
from ..services.project_task_guard import (
    can_retry,
    compute_project_effective_status,
    current_stage,
    error_message,
    error_type,
    failed_stage,
)
from ..utils.enums import ProjectStatus, RenderJobStatus
from ..utils.flow_logging import log_api_error, log_api_request, log_api_success
from ..utils.language import build_language_policy, normalize_target_market
from ..utils.public_static_url import build_public_static_url
from ..utils.segment_slots import normalize_segment_script_dict_for_read

logger = logging.getLogger(__name__)


def _trace(tag: str, payload: dict) -> None:
    logger.info("[AI_CHAIN_TRACE][%s] %s", tag, json.dumps(payload, ensure_ascii=False, default=str))


_ALLOWED_STORY_STYLES = {"light_conflict", "healing", "comedy", "suspense", "emotional"}


def _normalize_story_style(raw: object) -> str | None:
    if raw is None:
        return None
    if isinstance(raw, list):
        raw = raw[0] if raw else None
    text = str(raw or "").strip()
    if not text:
        return None
    if "," in text:
        text = text.split(",")[0].strip()
    if text == "conflict":
        text = "light_conflict"
    return text if text in _ALLOWED_STORY_STYLES else "light_conflict"


def _persist_recover_if_failed(db: Session, project: ShortDramaProject) -> None:
    """Legacy `failed` projects: infer retryable status from artifacts and persist."""
    if project.status != ProjectStatus.FAILED.value:
        return
    orchestrator.recover_failed_project_status(db, project)
    db.commit()
    db.refresh(project)


def _public_media_url(u: str | None) -> str | None:
    if u is None:
        return None
    s = str(u).strip()
    if not s:
        return None
    return build_public_static_url(s)


def _public_video_url(u: str | None) -> str | None:
    from ..utils.video_storage import resolve_short_drama_video_public_url

    return resolve_short_drama_video_public_url(u)


def _is_presigned_object_url(u: str | None) -> bool:
    if not u:
        return False
    query = parse_qs(urlparse(str(u)).query)
    keys = {k.lower() for k in query}
    return bool(
        {"x-amz-algorithm", "x-amz-signature", "x-amz-credential", "awsaccesskeyid", "signature"}
        & keys
    )


def _rewrite_final_video_url_from_segments(final_url: str | None, seg_payload: list[dict]) -> str | None:
    from ..utils.video_storage import rewrite_short_drama_r2_video_base, short_drama_r2_public_base_from_url

    if not final_url:
        return final_url
    if _is_presigned_object_url(final_url):
        return final_url
    for row in seg_payload:
        segment_url = str(row.get("video_url") or "")
        if _is_presigned_object_url(segment_url):
            continue
        base = short_drama_r2_public_base_from_url(segment_url)
        if base:
            rewritten = rewrite_short_drama_r2_video_base(final_url, base)
            if rewritten and rewritten != final_url:
                logger.warning(
                    "[FINAL_VIDEO_PUBLIC_BASE_REWRITTEN_FOR_PIPELINE] original_url=%s rewritten_url=%s canonical_base=%s",
                    final_url,
                    rewritten,
                    base,
                )
                return rewritten
            return final_url
    return final_url


def _script_with_public_video_url(script: dict, video_url_public: str | None) -> dict:
    if not video_url_public or not isinstance(script, dict):
        return script
    out = dict(script)
    vr = out.get("video_render")
    if isinstance(vr, dict):
        out["video_render"] = {**vr, "video_url": video_url_public}
    return out

router = APIRouter()


def _project_cover_asset(db: Session, project_id: int) -> ProjectCoverAsset:
    chars, scenes, products = list_pipeline_asset_rows(db, project_id)

    def _pick(rows: list, asset_type: str) -> ProjectCoverAsset | None:
        for row in rows:
            image_url = _public_media_url(getattr(row, "image_url", None))
            if image_url:
                return ProjectCoverAsset(
                    asset_type=asset_type,
                    name=getattr(row, "name", None),
                    image_url=image_url,
                    status="ready",
                )
        return None

    for candidate in (
        _pick(chars, "character"),
        _pick(products, "product"),
        _pick(scenes, "scene"),
    ):
        if candidate is not None:
            return candidate

    legacy_chars, legacy_scenes, legacy_products = list_asset_rows(db, project_id)
    for candidate in (
        _pick(legacy_chars, "character"),
        _pick(legacy_products, "product"),
        _pick(legacy_scenes, "scene"),
    ):
        if candidate is not None:
            return candidate

    return ProjectCoverAsset(asset_type=None, name=None, image_url=None, status="missing")


def _project_to_response(
    db: Session,
    p: ShortDramaProject,
    *,
    effective_status: str | None = None,
    suggested_status: str | None = None,
    status_recoverable: bool = False,
    has_final_video: bool | None = None,
    has_all_segment_videos: bool | None = None,
    segment_video_count: int | None = None,
    segment_video_total: int | None = None,
) -> ShortDramaProjectResponse:
    final_video = latest_final_video_url(db, p.id)
    step_status = {k: v for k, v in normalize_step_status(p.step_status).items() if isinstance(v, str)}
    s0_s1_state = get_s0_s1_state(p)
    workflow_mode = str(s0_s1_state.get("workflow_mode") or "").strip() or None
    inferred_policy = build_language_policy(
        workflow_source={
            "project_name": p.project_name,
            "creative_intent_input": s0_s1_state.get("creative_intent_input"),
            "creative_brief": s0_s1_state.get("creative_brief"),
        },
        explicit_target_market=p.target_market,
    )
    return ShortDramaProjectResponse(
        id=p.id,
        user_id=p.user_id,
        project_name=p.project_name,
        status=p.status,
        effective_status=effective_status,
        suggested_status=suggested_status,
        status_recoverable=status_recoverable,
        duration=p.duration,
        format=p.format,
        style=_normalize_story_style(p.style),
        visual_style=p.visual_style,
        aspect_ratio=p.aspect_ratio,
        target_market=normalize_target_market(p.target_market),
        marketing_goal=(p.marketing_goal or "brand_seeding"),
        target_audience=(p.target_audience or ""),
        brand_tone=(p.brand_tone or "natural"),
        creative_intent=(p.creative_intent or ""),
        creative_brief=(p.creative_brief or ""),
        workflow_language=(p.workflow_language or inferred_policy["workflow_language"]),
        video_language=(p.video_language or inferred_policy["video_language"]),
        last_active_step=p.last_active_step,
        step_status=step_status,
        overall_status=compute_overall_status(db, p, final_video_url=final_video),
        current_stage=current_stage(p) or None,
        failed_stage=failed_stage(p) or None,
        error_message=error_message(p) or None,
        error_type=error_type(p) or None,
        can_retry=can_retry(p),
        final_video_url=_public_video_url(final_video),
        has_final_video=has_final_video,
        has_all_segment_videos=has_all_segment_videos,
        segment_video_count=segment_video_count,
        segment_video_total=segment_video_total,
        cover_asset=_project_cover_asset(db, p.id),
        workflow_mode=workflow_mode,
        script_import=s0_s1_state.get("script_import") if isinstance(s0_s1_state.get("script_import"), dict) else None,
        creative_intent_input=s0_s1_state.get("creative_intent_input"),
        product_input=s0_s1_state.get("product_input"),
        product_understanding=s0_s1_state.get("product_understanding"),
        creative_brief_structured=s0_s1_state.get("creative_brief"),
        created_at=p.created_at,
        updated_at=p.updated_at,
    )


def _project_to_lightweight_response(
    db: Session,
    p: ShortDramaProject,
    *,
    effective_status: str | None,
    suggested_status: str | None,
    status_recoverable: bool,
    task_running: bool,
    current_stage_value: str,
    has_final_video: bool,
    has_all_segment_videos: bool,
    segment_video_count: int,
    segment_video_total: int,
) -> ShortDramaProjectResponse:
    step_status = {k: v for k, v in normalize_step_status(p.step_status).items() if isinstance(v, str)}
    s0_s1_state = get_s0_s1_state(p)
    workflow_mode = str(s0_s1_state.get("workflow_mode") or "").strip() or None
    final_video = latest_final_video_url(db, p.id)
    return ShortDramaProjectResponse(
        id=p.id,
        user_id=p.user_id,
        project_name=p.project_name,
        status=p.status,
        effective_status=effective_status,
        suggested_status=suggested_status,
        status_recoverable=status_recoverable,
        duration=p.duration,
        format=p.format,
        style=_normalize_story_style(p.style),
        visual_style=p.visual_style,
        aspect_ratio=p.aspect_ratio,
        workflow_language=p.workflow_language,
        video_language=p.video_language,
        last_active_step=p.last_active_step,
        step_status=step_status,
        overall_status=compute_overall_status(db, p, final_video_url=final_video),
        task_running=task_running,
        current_stage=current_stage_value or None,
        failed_stage=failed_stage(p) or None,
        error_message=error_message(p) or None,
        error_type=error_type(p) or None,
        can_retry=can_retry(p),
        final_video_url=_public_video_url(final_video),
        has_final_video=has_final_video,
        has_all_segment_videos=has_all_segment_videos,
        segment_video_count=segment_video_count,
        segment_video_total=segment_video_total,
        cover_asset=ProjectCoverAsset(asset_type=None, name=None, image_url=None, status="missing"),
        workflow_mode=workflow_mode,
        script_import=s0_s1_state.get("script_import") if isinstance(s0_s1_state.get("script_import"), dict) else None,
        created_at=p.created_at,
        updated_at=p.updated_at,
    )


@router.post("", response_model=CreateShortDramaProjectResponse)
async def create_project(body: CreateShortDramaProjectRequest, db: Session = Depends(get_db)):
    log_api_request(
        logger,
        "POST /project",
        user_id=body.user_id,
        project_name=body.project_name,
    )
    try:
        _trace(
            "S0_USER_INPUT",
            {
                "project_id": None,
                "user_id": body.user_id,
                "project_name": body.project_name,
                "duration": body.duration,
                "content_format": body.format,
                "story_style": body.style,
                "visual_style": body.visual_style,
                "aspect_ratio": body.aspect_ratio,
                "language": {"workflow_language": body.workflow_language, "video_language": body.video_language},
                "target_platform": None,
                "target_market": body.target_market,
                "target_audience": body.target_audience,
                "marketing_goal": body.marketing_goal,
                "brand_tone": body.brand_tone,
                "creative_intent": body.creative_intent,
                "creative_brief": body.creative_brief,
            },
        )
        user = db.query(User).filter(User.id == body.user_id).first()
        if not user:
            log_api_error(logger, "POST /project", "User not found", user_id=body.user_id)
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        language_policy = build_language_policy(
            workflow_source=body.project_name,
            explicit_target_market=body.target_market,
        )
        project = ShortDramaProject(
            user_id=body.user_id,
            project_name=body.project_name,
            duration=body.duration,
            format=body.format,
            style=_normalize_story_style(body.style),
            visual_style=body.visual_style,
            aspect_ratio=body.aspect_ratio,
            target_market=normalize_target_market(body.target_market),
            marketing_goal=(body.marketing_goal or "brand_seeding"),
            target_audience=(body.target_audience or ""),
            brand_tone=(body.brand_tone or "natural"),
            creative_intent=(body.creative_intent or ""),
            creative_brief=(body.creative_brief or ""),
            workflow_language=body.workflow_language or language_policy["workflow_language"],
            video_language=body.video_language or language_policy["video_language"],
            last_active_step=STEP_1,
            step_status=default_step_status(),
        )
        db.add(project)
        db.commit()
        db.refresh(project)
        _trace(
            "S0_NORMALIZED",
            {
                "project_id": project.id,
                "story_style_normalized": _normalize_story_style(body.style),
                "target_market_normalized": normalize_target_market(body.target_market),
                "language_policy": language_policy,
                "persisted_fields": {
                    "project_name": project.project_name,
                    "duration": project.duration,
                    "content_format": project.format,
                    "story_style": project.style,
                    "visual_style": project.visual_style,
                    "aspect_ratio": project.aspect_ratio,
                    "target_market": project.target_market,
                    "target_audience": project.target_audience,
                    "marketing_goal": project.marketing_goal,
                    "brand_tone": project.brand_tone,
                    "creative_intent": project.creative_intent,
                    "creative_brief": project.creative_brief,
                    "workflow_language": project.workflow_language,
                    "video_language": project.video_language,
                },
            },
        )
        log_api_success(
            logger,
            "POST /project",
            project_id=project.id,
            user_id=body.user_id,
            status=project.status,
        )
        return CreateShortDramaProjectResponse(project=_project_to_response(db, project))
    except HTTPException:
        raise
    except Exception as e:
        log_api_error(logger, "POST /project", str(e), user_id=body.user_id)
        raise


@router.get("", response_model=ShortDramaProjectListResponse)
async def list_projects(user_id: int = Query(...), db: Session = Depends(get_db)):
    log_api_request(logger, "GET /project", user_id=user_id)
    rows = (
        db.query(ShortDramaProject)
        .filter(ShortDramaProject.user_id == user_id)
        .order_by(
            ShortDramaProject.updated_at.desc().nullslast(),
            ShortDramaProject.created_at.desc().nullslast(),
            ShortDramaProject.id.desc(),
        )
        .all()
    )
    projects = []
    for p in rows:
        effective_info = compute_project_effective_status(db, p)
        segs = list_segment_scripts(db, p.id)
        segment_video_total = len(segs)
        segment_video_count = 0
        for s in segs:
            script = s.script_json if isinstance(s.script_json, dict) else {}
            vr = script.get("video_render") if isinstance(script.get("video_render"), dict) else {}
            video_url = str(vr.get("video_url") or "").strip()
            if video_url:
                segment_video_count += 1
        has_final_video = bool(str(latest_final_video_url(db, p.id) or "").strip())
        has_all_segment_videos = bool(all_segment_scripts_have_video(db, p.id)) if segment_video_total > 0 else False
        projects.append(
            _project_to_response(
                db,
                p,
                effective_status=str(effective_info.get("effective_status") or ""),
                suggested_status=str(effective_info.get("suggested_status") or ""),
                status_recoverable=bool(effective_info.get("status_recoverable", False)),
                has_final_video=has_final_video,
                has_all_segment_videos=has_all_segment_videos,
                segment_video_count=segment_video_count,
                segment_video_total=segment_video_total,
            )
        )
    logger.info("[PROJECT_LIST_FETCH] user_id=%s total=%s", user_id, len(projects))
    log_api_success(logger, "GET /project", user_id=user_id, total=len(projects))
    return ShortDramaProjectListResponse(projects=projects)


@router.get("/{project_id}", response_model=ShortDramaProjectResponse)
async def get_project(project_id: int, db: Session = Depends(get_db)):
    project = db.query(ShortDramaProject).filter(ShortDramaProject.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    _persist_recover_if_failed(db, project)
    return _project_to_response(db, project)


@router.patch("/{project_id}/creative-intent", response_model=CreativeIntentInputResponse)
async def save_creative_intent(project_id: int, body: CreativeIntentInput, db: Session = Depends(get_db)):
    project = db.query(ShortDramaProject).filter(ShortDramaProject.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    data = normalize_creative_intent_input(body.model_dump())
    update_s0_s1_state(project, {"creative_intent_input": data})
    project.creative_intent = data["intent_text"]
    update_last_active_step(project, STEP_1)
    db.add(project)
    db.commit()
    return CreativeIntentInputResponse(project_id=project_id, creative_intent_input=data)


@router.patch("/{project_id}/product-input", response_model=ProductInputResponse)
async def save_product_input(project_id: int, body: ProductInput, db: Session = Depends(get_db)):
    project = db.query(ShortDramaProject).filter(ShortDramaProject.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    data = normalize_product_input(body.model_dump())
    current = normalize_product_input(get_s0_s1_state(project).get("product_input"))
    if data == current:
        logger.info("[S1_PRODUCT_INPUT_IDEMPOTENT] project_id=%s unchanged=true", project_id)
        return ProductInputResponse(project_id=project_id, product_input=data)
    update_s0_s1_state(project, {"product_input": data})
    update_last_active_step(project, STEP_1)
    db.add(project)
    db.commit()
    return ProductInputResponse(project_id=project_id, product_input=data)


@router.post("/{project_id}/creative-brief/generate", response_model=CreativeBriefGenerateResponse)
async def generate_creative_brief(project_id: int, db: Session = Depends(get_db)):
    import time

    from ..utils.credit_guards import charge_text_understanding, require_text_understanding_credits

    attempt_key = f"brief_{int(time.time() * 1000)}"
    try:
        require_text_understanding_credits(db, project_id)
        result = creative_brief_service.generate_for_project(db, project_id)
        charge_text_understanding(db, project_id, attempt_key=attempt_key)
        db.commit()
        return result
    except HTTPException as e:
        project = db.query(ShortDramaProject).filter(ShortDramaProject.id == project_id).first()
        if project:
            update_s0_s1_state(
                project,
                {
                    "creative_brief_status": "failed",
                    "creative_brief_error": str(e.detail),
                },
            )
            db.add(project)
            db.commit()
        raise
    except Exception as e:
        logger.exception("[CREATIVE_BRIEF_GENERATE_ERROR] project_id=%s error=%s", project_id, str(e))
        project = db.query(ShortDramaProject).filter(ShortDramaProject.id == project_id).first()
        if project:
            update_s0_s1_state(
                project,
                {
                    "creative_brief_status": "failed",
                    "creative_brief_error": "AI 创作理解生成失败，请稍后重试。",
                },
            )
            db.add(project)
            db.commit()
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="AI 创作理解生成失败，请稍后重试。")


@router.get("/{project_id}/entry", response_model=ProjectEntryRedirectResponse)
async def get_project_entry(project_id: int, db: Session = Depends(get_db)):
    project = db.query(ShortDramaProject).filter(ShortDramaProject.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    _persist_recover_if_failed(db, project)
    project_view = _project_to_response(db, project)

    step_to_path = {
        STEP_1: f"/short-drama/projects/{project_id}/step-1",
        STEP_2: f"/short-drama/projects/{project_id}/step-2",
        STEP_3: f"/short-drama/projects/{project_id}/step-3",
        STEP_4: f"/short-drama/projects/{project_id}/step-4",
        OVERVIEW: f"/short-drama/projects/{project_id}/overview",
    }

    if project_view.final_video_url and str(project.status or "").strip() == "completed":
        redirect_to = step_to_path[OVERVIEW]
        reason = "completed_overview"
    elif project.last_active_step in step_to_path:
        redirect_to = step_to_path[str(project.last_active_step)]
        reason = "last_active_step"
    else:
        redirect_to = step_to_path[STEP_1]
        reason = "default_step_1"

    logger.info(
        "[PROJECT_ENTRY_REDIRECT] project_id=%s reason=%s redirect_to=%s",
        project_id,
        reason,
        redirect_to,
    )
    return ProjectEntryRedirectResponse(project_id=project_id, redirect_to=redirect_to, reason=reason)


@router.post("/{project_id}/touch-step", response_model=ShortDramaProjectResponse)
async def touch_project_step(
    project_id: int,
    body: TouchProjectStepRequest,
    db: Session = Depends(get_db),
):
    project = db.query(ShortDramaProject).filter(ShortDramaProject.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    update_last_active_step(project, body.step)
    project.updated_at = func.now()
    db.add(project)
    db.commit()
    db.refresh(project)
    if body.save_intent == "before_exit":
        logger.info("[PROJECT_SAVE_BEFORE_EXIT] project_id=%s step=%s", project_id, body.step)
    elif body.save_intent == "save_draft":
        logger.info("[PROJECT_SAVE_DRAFT_REDIRECT] project_id=%s step=%s", project_id, body.step)
    return _project_to_response(db, project)


@router.get("/{project_id}/pipeline", response_model=PipelineSummaryResponse)
async def get_pipeline(project_id: int, lightweight: bool = Query(default=False), db: Session = Depends(get_db)):
    started_at = time.perf_counter()
    if lightweight:
        logger.debug("[PIPELINE_LIGHTWEIGHT_REQUEST] project_id=%s", project_id)
    else:
        log_api_request(logger, "GET /project/{id}/pipeline", project_id=project_id)
    try:
        project = db.query(ShortDramaProject).filter(ShortDramaProject.id == project_id).first()
        if not project:
            log_api_error(logger, "GET /project/{id}/pipeline", "Project not found", project_id=project_id)
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

        _persist_recover_if_failed(db, project)

        pc = latest_product_context(db, project_id)
        sb = latest_story_blueprint(db, project_id)
        s0_s1_state = get_s0_s1_state(project)
        chars, scenes, products = list_pipeline_asset_rows(db, project_id)
        segs = list_segment_scripts(db, project_id)
        asset_counts = {
            "characters": len(chars),
            "scenes": len(scenes),
            "products": len(products),
        }
        asset_generation_specs_count = 0
        if sb and isinstance(sb.blueprint_json, dict):
            specs = sb.blueprint_json.get("asset_generation_specs")
            if isinstance(specs, list):
                asset_generation_specs_count = len(specs)
        has_asset_generation_specs = asset_generation_specs_count > 0

        def char_row(c) -> dict:
            return {
                "id": c.id,
                "name": c.name,
                "role_type": c.role_type,
                "description": c.description,
                "visual_prompt": c.visual_prompt,
                "image_url": _public_media_url(c.image_url),
                "visual_anchor_image_id": c.visual_anchor_image_id,
                "source_asset_version": c.source_asset_version,
                "exposure_priority": c.exposure_priority,
                "narrative_function": c.narrative_function,
                "purpose": c.purpose,
                "meta": c.meta_json or {},
            }

        def scene_row(s) -> dict:
            return {
                "id": s.id,
                "name": s.name,
                "scene_type": s.scene_type,
                "scene_form": s.scene_form,
                "description": s.description,
                "visual_prompt": s.visual_prompt,
                "image_url": _public_media_url(s.image_url),
                "visual_anchor_image_id": s.visual_anchor_image_id,
                "source_asset_version": s.source_asset_version,
                "exposure_priority": s.exposure_priority,
                "narrative_function": s.narrative_function,
                "purpose": s.purpose,
                "meta": s.meta_json or {},
            }

        def prod_row(p) -> dict:
            return {
                "id": p.id,
                "name": p.name,
                "product_role": p.product_role,
                "description": p.description,
                "visual_prompt": p.visual_prompt,
                "image_url": _public_media_url(p.image_url),
                "visual_anchor_image_id": p.visual_anchor_image_id,
                "source_asset_version": p.source_asset_version,
                "exposure_priority": p.exposure_priority,
                "narrative_function": p.narrative_function,
                "purpose": p.purpose,
                "meta": p.meta_json or {},
            }

        video_state = build_pipeline_video_state(db, project_id, project.status)
        render_job_by_segment_id, render_job_by_id = preload_segment_render_jobs(db, project_id)

        seg_payload = []
        for s in segs:
            script = s.script_json if isinstance(s.script_json, dict) else {}
            script = normalize_segment_script_dict_for_read(script)
            vr = script.get("video_render") or {}
            vu = vr.get("video_url")
            vu_pub = _public_video_url(str(vu) if vu else None)
            script_out = _script_with_public_video_url(script, vu_pub)
            vr_out = script_out.get("video_render") or {}
            row_extras = segment_row_video_fields(
                s.segment_id,
                script,
                str(vu) if vu else None,
                render_job_by_segment_id=render_job_by_segment_id,
                render_job_by_id=render_job_by_id,
            )
            seg_payload.append(
                {
                    "id": s.id,
                    "segment_id": s.segment_id,
                    "version": s.version,
                    "script": script_out,
                    "video_url": vu_pub,
                    "video_render": vr_out,
                    "created_at": s.created_at.isoformat() if s.created_at else None,
                    **row_extras,
                }
            )

        final_raw = latest_final_video_url(db, project_id)
        final_u = _public_video_url(final_raw)
        final_u = _rewrite_final_video_url_from_segments(final_u, seg_payload)
        final_job = latest_final_render_job(db, project_id)
        if not lightweight:
            logger.info(
                "[S5_FINAL_VIDEO_PIPELINE_MAPPED] project_id=%s job_id=%s status=%s "
                "video_url_present=%s source_field=output_url final_video_url=%s",
                project_id,
                final_job.id if final_job else None,
                (final_job.status if final_job else None) or "",
                bool(final_u),
                (final_u or "")[:500],
            )
            if final_job and (final_job.status or "").lower() == RenderJobStatus.COMPLETED.value and not final_u:
                logger.error(
                    "[S5_FINAL_VIDEO_RESULT_MISSING_URL] project_id=%s job_id=%s status=%s video_url_present=false",
                    project_id,
                    final_job.id,
                    final_job.status,
                )
            elif final_u:
                logger.info(
                    "[S5_FINAL_VIDEO_RESULT_SAVED] project_id=%s job_id=%s video_url_present=true",
                    project_id,
                    final_job.id if final_job else None,
                )
        segment_video_map = {
            str(item.get("segment_id")): str(item.get("video_url") or "")
            for item in seg_payload
        }
        if lightweight:
            logger.debug(
                "[PIPELINE_SEGMENT_VIDEO_URLS] project_id=%s segment_video_urls=%s final_video_url=%s",
                project_id,
                segment_video_map,
                final_u or "",
            )
        else:
            logger.info(
                "[PIPELINE_SEGMENT_VIDEO_URLS] project_id=%s segment_video_urls=%s final_video_url=%s",
                project_id,
                segment_video_map,
                final_u or "",
            )

        def _nonempty_url(u: str | None) -> bool:
            return bool((u or "").strip())

        image_url_filled = (
            sum(1 for c in chars if _nonempty_url(c.image_url))
            + sum(1 for s in scenes if _nonempty_url(s.image_url))
            + sum(1 for p in products if _nonempty_url(p.image_url))
        )
        asset_rows_total = len(chars) + len(scenes) + len(products)
        has_all_segment_videos = bool(video_state.get("has_all_segment_videos"))
        has_final_video = bool(final_u)
        has_story_blueprint = sb is not None
        has_product_context = pc is not None
        segment_scripts_count = len(segs)
        effective_info = compute_project_effective_status(db, project)
        effective_status = str(effective_info.get("effective_status") or "")
        suggested_status = str(effective_info.get("suggested_status") or "")
        status_recoverable = bool(effective_info.get("status_recoverable", False))
        current_status = str(project.status or "").strip()
        has_active_render_job = bool(video_state.get("has_active_render_job"))
        task_running = bool(effective_info.get("task_running", False))
        video_render_task_running = has_active_render_job
        current_stage = str(effective_info.get("current_stage") or "").strip()
        log_status = logger.debug if lightweight else logger.info
        log_status(
            "[PROJECT_EFFECTIVE_STATUS] project_id=%s raw_status=%s effective_status=%s task_running=%s "
            "current_stage=%s has_active_render_job=%s asset_rows_total=%s image_url_filled=%s "
            "segment_scripts_count=%s has_all_segment_videos=%s has_final_video=%s status_recoverable=%s",
            project_id,
            current_status,
            effective_status,
            task_running,
            current_stage,
            has_active_render_job,
            asset_rows_total,
            image_url_filled,
            segment_scripts_count,
            has_all_segment_videos,
            has_final_video,
            status_recoverable,
        )
        log_status(
            "[PROJECT_STATUS_ARTIFACT_CHECK] project_id=%s current_status=%s suggested_status=%s status_recoverable=%s "
            "asset_rows_total=%s image_url_filled=%s segment_scripts_count=%s has_final_video=%s "
            "has_all_segment_videos=%s",
            project_id,
            current_status,
            suggested_status,
            status_recoverable,
            asset_rows_total,
            image_url_filled,
            segment_scripts_count,
            has_final_video,
            has_all_segment_videos,
        )

        if not lightweight:
            log_api_success(
                logger,
                "GET /project/{id}/pipeline",
                project_id=project_id,
                status=project.status,
                has_product_context=has_product_context,
                has_story_blueprint=has_story_blueprint,
                asset_counts={
                    "characters": len(chars),
                    "scenes": len(scenes),
                    "products": len(products),
                },
                image_url_filled=image_url_filled,
                asset_rows_total=asset_rows_total,
                segment_scripts_count=segment_scripts_count,
                has_final_video=has_final_video,
                final_video_url=final_u or "",
            )
        log_status(
            "[PIPELINE_VIDEO_STATE] project_id=%s has_all_segment_videos=%s has_final_video=%s "
            "final_render_status=%s project_status=%s current_video_stage=%s has_active_render_job=%s",
            project_id,
            video_state.get("has_all_segment_videos"),
            video_state.get("has_final_video"),
            video_state.get("final_render_status"),
            project.status,
            video_state.get("current_video_stage"),
            has_active_render_job,
        )

        if lightweight:
            minimal_segment_statuses = [
                {
                    "id": item.get("id"),
                    "segment_id": item.get("segment_id"),
                    "version": item.get("version"),
                    "script": {},
                    "video_url": item.get("video_url"),
                    "video_render": {
                        "video_url": item.get("video_url"),
                        "render_job_id": item.get("render_job_id"),
                        "status": item.get("render_status"),
                        "error": item.get("render_error"),
                    },
                    "render_status": item.get("render_status"),
                    "render_job_id": item.get("render_job_id"),
                    "render_error": item.get("render_error"),
                    "created_at": item.get("created_at"),
                }
                for item in seg_payload
            ]
            response = PipelineSummaryResponse(
                project=_project_to_lightweight_response(
                    db,
                    project,
                    effective_status=effective_status,
                    suggested_status=suggested_status,
                    status_recoverable=status_recoverable,
                    task_running=task_running,
                    current_stage_value=current_stage,
                    has_final_video=has_final_video,
                    has_all_segment_videos=has_all_segment_videos,
                    segment_video_count=sum(1 for item in seg_payload if str(item.get("video_url") or "").strip()),
                    segment_video_total=len(seg_payload),
                ),
                lightweight=True,
                has_product_context=pc is not None,
                has_story_blueprint=sb is not None,
                has_asset_generation_specs=has_asset_generation_specs,
                asset_generation_specs_count=asset_generation_specs_count,
                asset_counts=asset_counts,
                image_url_filled=image_url_filled,
                asset_rows_total=asset_rows_total,
                segment_scripts_count=len(segs),
                final_video_url=final_u,
                current_video_stage=video_state.get("current_video_stage"),
                has_all_segment_videos=bool(video_state.get("has_all_segment_videos")),
                has_final_video=bool(video_state.get("has_final_video")),
                final_render_status=video_state.get("final_render_status"),
                final_render_error=video_state.get("final_render_error"),
                final_render_job_id=video_state.get("final_render_job_id"),
                has_active_render_job=has_active_render_job,
                video_render_task_running=video_render_task_running,
                segment_render_statuses=minimal_segment_statuses,
                segment_scripts=minimal_segment_statuses,
                workflow_mode=str(s0_s1_state.get("workflow_mode") or "").strip() or None,
                script_import=s0_s1_state.get("script_import") if isinstance(s0_s1_state.get("script_import"), dict) else None,
            )
            elapsed_ms = int((time.perf_counter() - started_at) * 1000)
            logger.debug(
                "[PIPELINE_LIGHTWEIGHT_QUERY_DURATION] project_id=%s elapsed_ms=%s active_render=%s segment_videos=%s/%s",
                project_id,
                elapsed_ms,
                has_active_render_job,
                response.project.segment_video_count,
                response.project.segment_video_total,
            )
            return response

        response = PipelineSummaryResponse(
            project=_project_to_response(
                db,
                project,
                effective_status=effective_status,
                suggested_status=suggested_status,
                status_recoverable=status_recoverable,
                has_final_video=has_final_video,
                has_all_segment_videos=has_all_segment_videos,
                segment_video_count=sum(1 for item in seg_payload if str(item.get("video_url") or "").strip()),
                segment_video_total=len(seg_payload),
            ),
            lightweight=False,
            has_product_context=pc is not None,
            has_story_blueprint=sb is not None,
            has_asset_generation_specs=has_asset_generation_specs,
            asset_generation_specs_count=asset_generation_specs_count,
            asset_counts=asset_counts,
            segment_scripts_count=len(segs),
            workflow_mode=str(s0_s1_state.get("workflow_mode") or "").strip() or None,
            script_import=s0_s1_state.get("script_import") if isinstance(s0_s1_state.get("script_import"), dict) else None,
            product_context=(
                {
                    "id": pc.id,
                    "version": pc.version,
                    "raw_inputs": pc.raw_inputs_json,
                    "image_understanding": pc.image_understanding_json,
                    "normalized": pc.normalized_context_json,
                    "parse_status": pc.parse_status,
                    "created_at": pc.created_at.isoformat() if pc.created_at else None,
                }
                if pc
                else None
            ),
            creative_intent_input=s0_s1_state.get("creative_intent_input"),
            product_input=s0_s1_state.get("product_input"),
            product_understanding=s0_s1_state.get("product_understanding"),
            creative_brief=s0_s1_state.get("creative_brief"),
            story_blueprint=(
                {
                    "id": sb.id,
                    "version": sb.version,
                    "approved": sb.approved,
                    "blueprint": sb.blueprint_json,
                    "created_at": sb.created_at.isoformat() if sb.created_at else None,
                }
                if sb
                else None
            ),
            assets={
                "characters": [char_row(c) for c in chars],
                "scenes": [scene_row(s) for s in scenes],
                "products": [prod_row(p) for p in products],
            },
            segment_scripts=seg_payload,
            final_video_url=final_u,
            current_video_stage=video_state.get("current_video_stage"),
            has_all_segment_videos=bool(video_state.get("has_all_segment_videos")),
            has_final_video=bool(video_state.get("has_final_video")),
            final_render_status=video_state.get("final_render_status"),
            final_render_error=video_state.get("final_render_error"),
            final_render_job_id=video_state.get("final_render_job_id"),
            has_active_render_job=has_active_render_job,
            video_render_task_running=video_render_task_running,
            segment_render_statuses=[
                {
                    "segment_id": item.get("segment_id"),
                    "video_url": item.get("video_url"),
                    "render_status": item.get("render_status"),
                    "render_job_id": item.get("render_job_id"),
                    "render_error": item.get("render_error"),
                }
                for item in seg_payload
            ],
            image_url_filled=image_url_filled,
            asset_rows_total=asset_rows_total,
        )
        elapsed_ms = int((time.perf_counter() - started_at) * 1000)
        logger.info("[PIPELINE_QUERY_DURATION] project_id=%s elapsed_ms=%s", project_id, elapsed_ms)
        return response
    except HTTPException:
        raise
    except Exception as e:
        elapsed_ms = int((time.perf_counter() - started_at) * 1000)
        logger.exception("[PIPELINE_QUERY_ERROR] project_id=%s elapsed_ms=%s error=%s", project_id, elapsed_ms, str(e))
        log_api_error(logger, "GET /project/{id}/pipeline", str(e), project_id=project_id)
        raise
