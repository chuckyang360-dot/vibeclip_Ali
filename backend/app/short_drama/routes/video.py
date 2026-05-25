import logging
import os
import socket
import re

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from ...database import SessionLocal, get_db
from ..models import RenderJob, SegmentScriptRecord
from ..exceptions import (
    ShortDramaFFmpegError,
    ShortDramaMergeError,
    ShortDramaVideoInputError,
    ShortDramaVideoProviderError,
    ShortDramaVideoSaveError,
)
from ..http_errors import raise_short_drama_http
from ..schemas.video import (
    MergeVideoResponse,
    RenderJobStatusResponse,
    SingleSegmentVideoResponse,
    VideoBatchSummaryResponse,
    VideoProjectRequest,
)
from ..services.merge_service import merge_service
from ..services.project_state_service import OVERVIEW, STEP_4, update_last_active_step
from ..services.workflow_orchestrator import orchestrator
from ..services.project_task_guard import (
    acquire_project_task_lock,
    mark_project_stage_failed,
    mark_project_stage_succeeded,
    recover_stale_processing_status_if_possible,
)
from ..services.read_models import list_segment_scripts
from ..services.render_executor_service import render_executor_service
from ..utils.enums import RenderTargetType, WorkflowStep
from ..utils.credit_guards import require_segment_video_credits
from ...services.credit_service import count_segments_pending_video
from ..utils.flow_logging import log_api_error, log_api_request, log_api_success
from ..utils.video_storage import resolve_short_drama_video_public_url

logger = logging.getLogger(__name__)

router = APIRouter()


def _clean_asset_ids(values: list[str]) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for raw in values:
        value = str(raw or "").strip()
        if not value or not re.fullmatch(r"\d+", value) or value in seen:
            continue
        seen.add(value)
        out.append(value)
    return out


@router.post("/generate", response_model=VideoBatchSummaryResponse)
async def generate_all_segment_videos(body: VideoProjectRequest, db: Session = Depends(get_db)):
    log_api_request(logger, "POST /videos/generate", project_id=body.project_id)
    lock_acquired = False
    def _fail_after_lock(error_type_value: str, message: str) -> None:
        if not lock_acquired:
            return
        fail_db = SessionLocal()
        try:
            mark_project_stage_failed(
                fail_db,
                body.project_id,
                stage="s4_video",
                error_type_value=error_type_value,
                message=message,
            )
        except Exception:
            pass
        finally:
            fail_db.close()
    try:
        project = orchestrator.get_project(db, body.project_id)
        recover_stale_processing_status_if_possible(db, project)
        project = orchestrator.get_project(db, body.project_id)
        runtime_now = dict((project.step_status or {}).get("_runtime") or {})
        logger.info(
            "[S4_EFFECTIVE_STATUS_CHECK] project_id=%s raw_status=%s task_running=%s current_stage=%s",
            body.project_id,
            project.status,
            bool(runtime_now.get("task_running", False)),
            str(runtime_now.get("current_stage") or ""),
        )
        logger.info(
            "[STEP_ALLOWED_CHECK_BEFORE_LOCK] project_id=%s step=%s current_status=%s allowed_statuses=%s all_segments=%s",
            body.project_id,
            "s4_video",
            project.status,
            [
                "assets_ready",
                "segments_generated",
                "video_rendering",
                "video_segments_ready",
                "completed",
            ],
            True,
        )
        orchestrator.assert_step_allowed(db, project, WorkflowStep.RENDER_VIDEO)
        acquire_project_task_lock(db, project, stage="s4_video")
        lock_acquired = True
        segment_rows = list_segment_scripts(db, body.project_id)
        pending_segments = count_segments_pending_video(db, body.project_id)
        charge_segments = pending_segments if pending_segments > 0 else len(segment_rows)
        require_segment_video_credits(db, body.project_id, max(charge_segments, 1))
        logger.info("[VIDEO_ROUTE_AFTER_LOCK] route=%s method=%s project_id=%s", "/videos/generate", "POST", body.project_id)
        update_last_active_step(project, STEP_4)
        db.add(project)
        db.commit()
        logger.info("[VIDEO_ROUTE_BEFORE_EXECUTOR] route=%s method=%s project_id=%s", "/videos/generate", "POST", body.project_id)
        r = render_executor_service.generate_segment_videos(db, body.project_id)
        logger.info("[VIDEO_ROUTE_EXECUTOR_RETURNED] route=%s method=%s project_id=%s", "/videos/generate", "POST", body.project_id)
        post_db = SessionLocal()
        try:
            mark_project_stage_succeeded(post_db, body.project_id, stage="s4_video", status_after="video_rendering")
        finally:
            post_db.close()
        log_api_success(
            logger,
            "POST /videos/generate",
            project_id=r.project_id,
            segments_attempted=r.segments_attempted,
            segments_succeeded=r.segments_succeeded,
            errors_count=len(r.errors),
        )
        return VideoBatchSummaryResponse(
            project_id=r.project_id,
            segments_attempted=r.segments_attempted,
            segments_succeeded=r.segments_succeeded,
            errors=r.errors,
        )
    except ShortDramaVideoInputError as e:
        _fail_after_lock("video_input_error", str(e))
        log_api_error(logger, "POST /videos/generate", str(e), project_id=body.project_id)
        raise_short_drama_http(e)
    except (ShortDramaVideoProviderError, ShortDramaVideoSaveError) as e:
        _fail_after_lock("video_provider_or_save_error", str(e))
        log_api_error(logger, "POST /videos/generate", str(e), project_id=body.project_id)
        raise_short_drama_http(e)
    except HTTPException as e:
        et = "storage_or_db_error" if e.status_code >= 500 else "request_conflict"
        if isinstance(e.detail, dict):
            et = str(e.detail.get("error_type") or et)
        _fail_after_lock(et, str(e.detail))
        if lock_acquired:
            logger.error(
                "[VIDEO_ROUTE_EXCEPTION_AFTER_LOCK] route=%s method=%s project_id=%s error_type=%s message=%s",
                "/videos/generate",
                "POST",
                body.project_id,
                et,
                str(e.detail),
            )
        log_api_error(
            logger,
            "POST /videos/generate",
            str(e.detail),
            project_id=body.project_id,
            status_code=e.status_code,
        )
        raise
    except Exception as e:
        _fail_after_lock("unexpected_exception", str(e))
        if lock_acquired:
            logger.exception(
                "[VIDEO_ROUTE_EXCEPTION_AFTER_LOCK] route=%s method=%s project_id=%s error_type=%s message=%s",
                "/videos/generate",
                "POST",
                body.project_id,
                "unexpected_exception",
                str(e),
            )
        raise


@router.post("/generate/{segment_id}", response_model=SingleSegmentVideoResponse)
async def generate_one_segment_video(
    segment_id: str,
    body: VideoProjectRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    rec = (
        db.query(SegmentScriptRecord)
        .filter(
            SegmentScriptRecord.project_id == body.project_id,
            SegmentScriptRecord.segment_id == segment_id,
        )
        .first()
    )
    execution_shots = []
    if rec and isinstance(rec.script_json, dict):
        execution_shots = rec.script_json.get("execution_shots") or rec.script_json.get("shots") or []
    character_asset_ids = _clean_asset_ids(
        [
            str(v).strip()
            for shot in execution_shots
            if isinstance(shot, dict)
            for v in (
                (shot.get("character_asset_ids") or [])
                if isinstance((shot.get("character_asset_ids") or []), list)
                else []
            )
            if str(v).strip()
        ]
    )
    character_names = sorted(
        {
            str(v).strip()
            for shot in execution_shots
            if isinstance(shot, dict)
            for v in (
                (shot.get("manual_character_refs") or shot.get("character_refs") or [])
                if isinstance((shot.get("manual_character_refs") or shot.get("character_refs") or []), list)
                else []
            )
            if str(v).strip()
        }
    )
    scene_asset_id = ""
    product_asset_id = ""
    for shot in execution_shots:
        if not isinstance(shot, dict):
            continue
        scene_raw = str((shot.get("scene_asset_id") or "")).strip()
        if not scene_asset_id and re.fullmatch(r"\d+", scene_raw):
            scene_asset_id = scene_raw
        product_raw = str((shot.get("product_asset_id") or "")).strip()
        if not product_asset_id and re.fullmatch(r"\d+", product_raw):
            product_asset_id = product_raw
        products_raw = shot.get("product_refs") or []
        if not product_asset_id and isinstance(products_raw, list):
            first = next((str(x).strip() for x in products_raw if re.fullmatch(r"\d+", str(x).strip())), "")
            if first:
                product_asset_id = first
        if scene_asset_id and product_asset_id:
            break
    logger.info(
        "[VIDEO_SEGMENT_REGENERATE_PAYLOAD] project_id=%s segment_id=%s character_asset_ids=%s character_names=%s scene_asset_id=%s product_asset_id=%s",
        body.project_id,
        segment_id,
        character_asset_ids,
        character_names,
        scene_asset_id,
        product_asset_id,
    )
    logger.info(
        "[SEGMENT_GENERATE_REQUEST] project_id=%s segment_id=%s request_url=%s base_url_from_request=%s hostname=%s cwd=%s",
        body.project_id,
        segment_id,
        str(request.url),
        str(request.base_url),
        socket.gethostname(),
        os.getcwd(),
    )
    log_api_request(
        logger,
        "POST /videos/generate/{segment_id}",
        project_id=body.project_id,
        segment_id=segment_id,
    )
    lock_acquired = False
    def _fail_after_lock(error_type_value: str, message: str) -> None:
        if not lock_acquired:
            return
        fail_db = SessionLocal()
        try:
            mark_project_stage_failed(
                fail_db,
                body.project_id,
                stage="s4_video",
                error_type_value=error_type_value,
                message=message,
            )
        except Exception:
            pass
        finally:
            fail_db.close()
    try:
        project = orchestrator.get_project(db, body.project_id)
        recover_stale_processing_status_if_possible(db, project)
        project = orchestrator.get_project(db, body.project_id)
        runtime_now = dict((project.step_status or {}).get("_runtime") or {})
        logger.info(
            "[S4_EFFECTIVE_STATUS_CHECK] project_id=%s raw_status=%s task_running=%s current_stage=%s segment_id=%s",
            body.project_id,
            project.status,
            bool(runtime_now.get("task_running", False)),
            str(runtime_now.get("current_stage") or ""),
            segment_id,
        )
        logger.info(
            "[STEP_ALLOWED_CHECK_BEFORE_LOCK] project_id=%s step=%s current_status=%s allowed_statuses=%s segment_id=%s",
            body.project_id,
            "s4_video",
            project.status,
            [
                "assets_ready",
                "segments_generated",
                "video_rendering",
                "video_segments_ready",
                "completed",
            ],
            segment_id,
        )
        orchestrator.assert_step_allowed(db, project, WorkflowStep.RENDER_VIDEO)
        acquire_project_task_lock(db, project, stage="s4_video")
        lock_acquired = True
        require_segment_video_credits(db, body.project_id, 1)
        logger.info(
            "[VIDEO_ROUTE_AFTER_LOCK] route=%s method=%s project_id=%s segment_id=%s",
            "/videos/generate/{segment_id}",
            "POST",
            body.project_id,
            segment_id,
        )
        update_last_active_step(project, STEP_4)
        db.add(project)
        db.commit()
        logger.info(
            "[VIDEO_ROUTE_BEFORE_EXECUTOR] route=%s method=%s project_id=%s segment_id=%s",
            "/videos/generate/{segment_id}",
            "POST",
            body.project_id,
            segment_id,
        )
        job = render_executor_service.enqueue_single_segment_video(db, body.project_id, segment_id)
        background_tasks.add_task(
            render_executor_service.run_single_segment_video_job,
            body.project_id,
            segment_id,
            job.id,
        )
        post_db = SessionLocal()
        try:
            mark_project_stage_succeeded(post_db, body.project_id, stage="s4_video", status_after="video_rendering")
        finally:
            post_db.close()
        logger.info(
            "[VIDEO_ROUTE_EXECUTOR_RETURNED] route=%s method=%s project_id=%s segment_id=%s",
            "/videos/generate/{segment_id}",
            "POST",
            body.project_id,
            segment_id,
        )
        log_api_success(
            logger,
            "POST /videos/generate/{segment_id}",
            project_id=body.project_id,
            segment_id=segment_id,
            ok=True,
            render_job_id=job.id,
            status=job.status,
        )
        return SingleSegmentVideoResponse(
            project_id=body.project_id,
            segment_id=segment_id,
            ok=True,
            status=job.status,
            progress=0,
            video_url=None,
            render_job_id=job.id,
            error=None,
        )
    except ShortDramaVideoInputError as e:
        _fail_after_lock("video_input_error", str(e))
        log_api_error(
            logger,
            "POST /videos/generate/{segment_id}",
            str(e),
            project_id=body.project_id,
            segment_id=segment_id,
        )
        raise_short_drama_http(e)
    except (ShortDramaVideoProviderError, ShortDramaVideoSaveError) as e:
        _fail_after_lock("video_provider_or_save_error", str(e))
        log_api_error(
            logger,
            "POST /videos/generate/{segment_id}",
            str(e),
            project_id=body.project_id,
            segment_id=segment_id,
        )
        raise_short_drama_http(e)
    except HTTPException as e:
        et = "storage_or_db_error" if e.status_code >= 500 else "request_conflict"
        if isinstance(e.detail, dict):
            et = str(e.detail.get("error_type") or et)
        _fail_after_lock(et, str(e.detail))
        if lock_acquired:
            logger.error(
                "[VIDEO_ROUTE_EXCEPTION_AFTER_LOCK] route=%s method=%s project_id=%s segment_id=%s error_type=%s message=%s",
                "/videos/generate/{segment_id}",
                "POST",
                body.project_id,
                segment_id,
                et,
                str(e.detail),
            )
        log_api_error(
            logger,
            "POST /videos/generate/{segment_id}",
            str(e.detail),
            project_id=body.project_id,
            segment_id=segment_id,
            status_code=e.status_code,
        )
        raise
    except Exception as e:
        _fail_after_lock("unexpected_exception", str(e))
        if lock_acquired:
            logger.exception(
                "[VIDEO_ROUTE_EXCEPTION_AFTER_LOCK] route=%s method=%s project_id=%s segment_id=%s error_type=%s message=%s",
                "/videos/generate/{segment_id}",
                "POST",
                body.project_id,
                segment_id,
                "unexpected_exception",
                str(e),
            )
        raise


@router.get("/render-jobs/{job_id}", response_model=RenderJobStatusResponse)
async def get_render_job_status(job_id: int, db: Session = Depends(get_db)):
    job = db.query(RenderJob).filter(RenderJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail=f"Render job {job_id} not found")
    if job.target_type != RenderTargetType.SEGMENT.value:
        raise HTTPException(status_code=400, detail=f"Render job {job_id} is not a segment video job")
    meta = dict(job.meta_json or {})
    status = str(job.status or meta.get("status") or "pending")
    progress_raw = meta.get("progress", 0)
    try:
        progress = max(0, min(100, int(progress_raw)))
    except (TypeError, ValueError):
        progress = 0
    return RenderJobStatusResponse(
        job_id=job.id,
        project_id=job.project_id,
        segment_id=str(job.target_id),
        status=status,
        progress=progress,
        video_url=resolve_short_drama_video_public_url(job.output_url),
        error=job.error_message,
        request_id=job.provider_request_id,
    )


@router.post("/merge", response_model=MergeVideoResponse)
async def merge_final_video(body: VideoProjectRequest, db: Session = Depends(get_db)):
    log_api_request(logger, "POST /videos/merge", project_id=body.project_id)
    try:
        url = merge_service.merge_project_video(db, body.project_id)
        project = orchestrator.get_project(db, body.project_id)
        update_last_active_step(project, OVERVIEW)
        db.add(project)
        db.commit()
        log_api_success(
            logger,
            "POST /videos/merge",
            project_id=body.project_id,
            final_video_url=url or "",
        )
        return MergeVideoResponse(project_id=body.project_id, final_video_url=url)
    except ShortDramaMergeError as e:
        log_api_error(logger, "POST /videos/merge", str(e), project_id=body.project_id)
        raise_short_drama_http(e)
    except ShortDramaFFmpegError as e:
        log_api_error(logger, "POST /videos/merge", str(e), project_id=body.project_id)
        raise_short_drama_http(e)
    except HTTPException as e:
        log_api_error(
            logger,
            "POST /videos/merge",
            str(e.detail),
            project_id=body.project_id,
            status_code=e.status_code,
        )
        raise
