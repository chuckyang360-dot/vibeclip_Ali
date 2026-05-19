from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from ..models import ShortDramaProject
from ..models.render_job import RenderJob
from ..utils.enums import ProjectStatus, RenderTargetType
from .read_models import (
    all_segment_scripts_have_video,
    latest_final_video_url,
    latest_product_context,
    latest_story_blueprint,
    list_pipeline_asset_rows,
    list_segment_scripts,
)

logger = logging.getLogger(__name__)

_RUNTIME_KEY = "_runtime"
_RUNNING_LOCK_TIMEOUT_SECONDS = 10 * 60
_ACTIVE_RENDER_JOB_STATUSES = frozenset(
    {
        "queued",
        "pending",
        "running",
        "submitted",
        "polling",
        "processing",
    }
)


def _step_status(project: ShortDramaProject) -> dict[str, Any]:
    return dict(project.step_status or {})


def _runtime(project: ShortDramaProject) -> dict[str, Any]:
    st = _step_status(project)
    rt = st.get(_RUNTIME_KEY)
    return dict(rt) if isinstance(rt, dict) else {}


def _save_runtime(project: ShortDramaProject, runtime: dict[str, Any]) -> None:
    st = _step_status(project)
    st[_RUNTIME_KEY] = runtime
    project.step_status = st


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _utc_now_iso() -> str:
    return _utc_now().isoformat()


def _parse_datetime_iso(value: Any) -> datetime | None:
    if not isinstance(value, str):
        return None
    text = value.strip()
    if not text:
        return None
    try:
        dt = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _active_s4_render_jobs_count(db: Session, project_id: int) -> int:
    return (
        db.query(RenderJob)
        .filter(
            RenderJob.project_id == project_id,
            RenderJob.target_type.in_(
                (
                    RenderTargetType.SEGMENT.value,
                    RenderTargetType.SEGMENT_VIDEO.value,
                    RenderTargetType.FINAL.value,
                    RenderTargetType.MERGED_VIDEO.value,
                )
            ),
            RenderJob.status.in_(tuple(_ACTIVE_RENDER_JOB_STATUSES)),
        )
        .count()
    )


def _infer_status_from_artifacts(db: Session, project_id: int) -> tuple[str, str, dict[str, Any]]:
    final_video_url = latest_final_video_url(db, project_id)
    segs = list_segment_scripts(db, project_id)
    has_all_segment_videos = all_segment_scripts_have_video(db, project_id)
    chars, scenes, products = list_pipeline_asset_rows(db, project_id)
    asset_rows_total = len(chars) + len(scenes) + len(products)
    image_url_filled = (
        sum(1 for c in chars if str(getattr(c, "image_url", "") or "").strip())
        + sum(1 for s in scenes if str(getattr(s, "image_url", "") or "").strip())
        + sum(1 for p in products if str(getattr(p, "image_url", "") or "").strip())
    )
    story = latest_story_blueprint(db, project_id)
    product = latest_product_context(db, project_id)

    has_final_video = bool(final_video_url)
    segment_scripts_count = len(segs)
    has_story_blueprint = bool(story)
    has_product_context = bool(product)
    if has_final_video:
        recovered_status = "completed"
        reason = "final_video_exists"
    elif has_all_segment_videos:
        recovered_status = "video_segments_ready"
        reason = "all_segment_videos_exist"
    elif segment_scripts_count > 0:
        recovered_status = "segments_generated"
        reason = "segment_scripts_exist"
    elif asset_rows_total > 0 and image_url_filled == asset_rows_total:
        recovered_status = "assets_ready"
        reason = "all_asset_images_ready"
    elif asset_rows_total > 0:
        recovered_status = "asset_specs_generated"
        reason = "asset_specs_exist"
    elif has_story_blueprint:
        recovered_status = "story_generated"
        reason = "story_blueprint_exists"
    elif has_product_context:
        recovered_status = "product_parsed"
        reason = "product_context_exists"
    else:
        recovered_status = "created"
        reason = "no_artifacts_found"
    stats = {
        "asset_rows_total": asset_rows_total,
        "image_url_filled": image_url_filled,
        "segment_scripts_count": segment_scripts_count,
        "has_final_video": has_final_video,
        "has_all_segment_videos": has_all_segment_videos,
        "has_story_blueprint": has_story_blueprint,
        "has_product_context": has_product_context,
    }
    return recovered_status, reason, stats


def compute_project_effective_status(db: Session, project: ShortDramaProject) -> dict[str, Any]:
    runtime = _runtime(project)
    task_running = bool(runtime.get("task_running", False))
    current_status = str(project.status or "").strip()
    current_stage_value = str(runtime.get("current_stage") or "").strip()
    lock_acquired_at = runtime.get("lock_acquired_at")
    lock_dt = _parse_datetime_iso(lock_acquired_at)
    lock_age_seconds = int((_utc_now() - lock_dt).total_seconds()) if lock_dt else None
    active_render_jobs_count = _active_s4_render_jobs_count(db, project.id)
    suggested_status, suggested_reason, stats = _infer_status_from_artifacts(db, project.id)
    treat_running = False
    if task_running:
        if current_stage_value != "s4_video":
            treat_running = True
        elif active_render_jobs_count > 0:
            treat_running = True
        elif lock_dt is not None and lock_age_seconds is not None and lock_age_seconds < _RUNNING_LOCK_TIMEOUT_SECONDS:
            treat_running = True
    effective_status = "processing" if treat_running else suggested_status
    if current_status == "video_rendering" and active_render_jobs_count > 0:
        effective_status = "video_rendering"
    status_recoverable = bool(
        current_status in {"processing", "video_rendering"}
        and not treat_running
        and effective_status != "processing"
        and effective_status != current_status
    )
    return {
        "effective_status": effective_status,
        "suggested_status": suggested_status,
        "suggested_reason": suggested_reason,
        "status_recoverable": status_recoverable,
        "task_running": task_running,
        "current_stage": current_stage_value,
        "lock_acquired_at": lock_acquired_at,
        "lock_age_seconds": lock_age_seconds,
        "active_render_jobs_count": active_render_jobs_count,
        **stats,
    }


def current_stage(project: ShortDramaProject) -> str:
    return str(_runtime(project).get("current_stage") or "")


def failed_stage(project: ShortDramaProject) -> str:
    return str(_runtime(project).get("failed_stage") or "")


def error_message(project: ShortDramaProject) -> str:
    return str(_runtime(project).get("error_message") or "")


def error_type(project: ShortDramaProject) -> str:
    return str(_runtime(project).get("error_type") or "")


def can_retry(project: ShortDramaProject) -> bool:
    return bool(_runtime(project).get("can_retry", False))


def is_processing(project: ShortDramaProject) -> bool:
    rt = _runtime(project)
    return str(project.status or "").strip().lower() == "processing" or bool(rt.get("task_running", False))


def recover_stale_processing_status_if_possible(db: Session, project: ShortDramaProject) -> str:
    status_now = str(project.status or "").strip().lower()
    if status_now != "processing":
        return "noop"

    rt = _runtime(project)
    task_running = bool(rt.get("task_running", False))
    stage_now = str(rt.get("current_stage") or "").strip()
    lock_acquired_at = rt.get("lock_acquired_at")
    lock_dt = _parse_datetime_iso(lock_acquired_at)
    lock_age_seconds = int((_utc_now() - lock_dt).total_seconds()) if lock_dt else None
    active_render_jobs_count = _active_s4_render_jobs_count(db, project.id) if stage_now == "s4_video" else 0
    logger.info(
        "[PROJECT_RUNNING_LOCK_CHECK] project_id=%s current_stage=%s task_running=%s lock_acquired_at=%s "
        "lock_age_seconds=%s active_render_jobs_count=%s old_status=%s",
        project.id,
        stage_now,
        task_running,
        lock_acquired_at or "",
        lock_age_seconds if lock_age_seconds is not None else -1,
        active_render_jobs_count,
        project.status,
    )
    if task_running:
        if stage_now != "s4_video":
            logger.info(
                "[PROJECT_STALE_PROCESSING_DETECTED] project_id=%s old_status=%s current_stage=%s task_running=%s reason=%s",
                project.id,
                project.status,
                stage_now,
                task_running,
                "active_runtime_lock_non_s4",
            )
            return "running"
        if active_render_jobs_count > 0:
            logger.info(
                "[PROJECT_RUNNING_LOCK_ACTIVE_JOB_FOUND] project_id=%s current_stage=%s task_running=%s "
                "active_render_jobs_count=%s old_status=%s",
                project.id,
                stage_now,
                task_running,
                active_render_jobs_count,
                project.status,
            )
            return "running"
        if lock_dt is not None and lock_age_seconds is not None and lock_age_seconds < _RUNNING_LOCK_TIMEOUT_SECONDS:
            return "running"
        logger.warning(
            "[PROJECT_RUNNING_LOCK_TIMEOUT_DETECTED] project_id=%s current_stage=%s task_running=%s lock_acquired_at=%s "
            "lock_age_seconds=%s active_render_jobs_count=%s old_status=%s reason=%s",
            project.id,
            stage_now,
            task_running,
            lock_acquired_at or "",
            lock_age_seconds if lock_age_seconds is not None else -1,
            active_render_jobs_count,
            project.status,
            "missing_or_expired_lock_without_active_job",
        )

    logger.warning(
        "[PROJECT_STALE_PROCESSING_DETECTED] project_id=%s old_status=%s current_stage=%s task_running=%s reason=%s",
        project.id,
        project.status,
        stage_now,
        task_running,
        "processing_without_running_lock",
    )

    recovered_status, reason, stats = _infer_status_from_artifacts(db, project.id)
    asset_rows_total = int(stats["asset_rows_total"])
    image_url_filled = int(stats["image_url_filled"])
    segment_scripts_count = int(stats["segment_scripts_count"])
    has_final_video = bool(stats["has_final_video"])
    has_all_segment_videos = bool(stats["has_all_segment_videos"])
    has_story_blueprint = bool(stats["has_story_blueprint"])
    has_product_context = bool(stats["has_product_context"])
    logger.info(
        "[PROJECT_STATUS_ARTIFACT_CHECK] project_id=%s old_status=%s asset_rows_total=%s image_url_filled=%s "
        "segment_scripts_count=%s has_final_video=%s has_all_segment_videos=%s suggested_status=%s reason=%s",
        project.id,
        project.status,
        asset_rows_total,
        image_url_filled,
        segment_scripts_count,
        has_final_video,
        has_all_segment_videos,
        recovered_status,
        reason,
    )

    rt.pop("task_running", None)
    rt.pop("current_stage", None)
    rt.pop("failed_stage", None)
    rt.pop("error_message", None)
    rt.pop("error_type", None)
    rt.pop("lock_acquired_at", None)
    rt["can_retry"] = False
    project.status = recovered_status
    _save_runtime(project, rt)
    db.add(project)
    db.commit()
    db.refresh(project)
    logger.info(
        "[PROJECT_STATUS_RECOVERED_FROM_ARTIFACTS] project_id=%s old_status=%s new_status=%s asset_rows_total=%s "
        "image_url_filled=%s segment_scripts_count=%s has_final_video=%s has_all_segment_videos=%s reason=%s",
        project.id,
        "processing",
        recovered_status,
        asset_rows_total,
        image_url_filled,
        segment_scripts_count,
        has_final_video,
        has_all_segment_videos,
        reason,
    )
    logger.info(
        "[PROJECT_RUNNING_LOCK_TIMEOUT_RECOVERED] project_id=%s current_stage=%s task_running=%s lock_acquired_at=%s "
        "lock_age_seconds=%s active_render_jobs_count=%s old_status=%s new_status=%s reason=%s",
        project.id,
        stage_now,
        task_running,
        lock_acquired_at or "",
        lock_age_seconds if lock_age_seconds is not None else -1,
        active_render_jobs_count,
        "processing",
        recovered_status,
        reason,
    )
    has_any_artifact = bool(
        has_final_video
        or segment_scripts_count > 0
        or has_all_segment_videos
        or asset_rows_total > 0
        or has_story_blueprint
        or has_product_context
    )
    if recovered_status == "created" and not has_any_artifact:
        logger.warning(
            "[PROJECT_STALE_PROCESSING_UNRECOVERABLE] project_id=%s old_status=%s recovered_status=%s reason=%s",
            project.id,
            "processing",
            recovered_status,
            reason,
        )
    return "recovered"


def acquire_project_task_lock(db: Session, project: ShortDramaProject, *, stage: str) -> None:
    rt_before = _runtime(project)
    old_status = project.status
    logger.info(
        "[PROJECT_TASK_LOCK_STATE] project_id=%s status=%s current_stage=%s task_running=%s",
        project.id,
        project.status,
        str(rt_before.get("current_stage") or ""),
        bool(rt_before.get("task_running", False)),
    )
    logger.info(
        "[PROJECT_TASK_LOCK_CHECK] project_id=%s user_id=%s stage=%s status=%s",
        project.id,
        project.user_id,
        stage,
        project.status,
    )
    running_other = (
        db.query(ShortDramaProject)
        .filter(
            ShortDramaProject.user_id == project.user_id,
            ShortDramaProject.id != project.id,
            ShortDramaProject.status == "processing",
        )
        .first()
    )
    if running_other is not None:
        logger.warning(
            "[PROJECT_TASK_LOCK_REJECTED] project_id=%s user_id=%s stage=%s reason=user_has_running_project running_project_id=%s",
            project.id,
            project.user_id,
            stage,
            running_other.id,
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "detail": "You already have a project processing. Please wait for it to finish.",
                "running_project_id": running_other.id,
            },
        )
    if is_processing(project):
        logger.warning(
            "[PROJECT_TASK_LOCK_REJECTED] project_id=%s user_id=%s stage=%s reason=project_already_processing current_stage=%s",
            project.id,
            project.user_id,
            stage,
            current_stage(project),
        )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "detail": "Project is currently processing. Please wait or retry after it finishes.",
                "current_stage": current_stage(project),
                "status": project.status,
            },
        )

    rt = _runtime(project)
    rt.update(
        {
            "task_running": True,
            "current_stage": stage,
            "lock_acquired_at": _utc_now_iso(),
            "previous_status": old_status,
            "failed_stage": "",
            "error_message": "",
            "error_type": "",
            "can_retry": False,
        }
    )
    project.status = "processing"
    _save_runtime(project, rt)
    db.add(project)
    db.commit()
    db.refresh(project)
    logger.info(
        "[PROJECT_TASK_LOCK_ACQUIRED] project_id=%s user_id=%s stage=%s old_status=%s new_status=%s previous_status=%s "
        "current_stage=%s lock_acquired_at=%s",
        project.id,
        project.user_id,
        stage,
        old_status,
        project.status,
        old_status,
        str(_runtime(project).get("current_stage") or ""),
        str(_runtime(project).get("lock_acquired_at") or ""),
    )
    logger.info(
        "[PROJECT_STAGE_STARTED] project_id=%s stage=%s old_status=%s new_status=%s",
        project.id,
        stage,
        old_status,
        project.status,
    )


def mark_project_stage_succeeded(
    db: Session,
    project_id: int,
    *,
    stage: str,
    status_after: str | None = None,
    success_status: str | None = None,
) -> None:
    project = db.query(ShortDramaProject).filter(ShortDramaProject.id == project_id).first()
    if project is None:
        return
    resolved_success_status = str(success_status or status_after or "").strip()
    if not resolved_success_status:
        raise ValueError("mark_project_stage_succeeded requires status_after or success_status")
    previous_status = project.status
    rt = _runtime(project)
    rt.pop("task_running", None)
    rt.pop("current_stage", None)
    rt.pop("failed_stage", None)
    rt.pop("error_message", None)
    rt.pop("error_type", None)
    rt.pop("lock_acquired_at", None)
    rt["can_retry"] = False
    rt["last_succeeded_stage"] = stage
    project.status = resolved_success_status
    _save_runtime(project, rt)
    db.add(project)
    db.commit()
    logger.info(
        "[PROJECT_STAGE_SUCCEEDED] project_id=%s stage=%s previous_status=%s success_status=%s runtime_cleared=true",
        project_id,
        stage,
        previous_status,
        resolved_success_status,
    )


def _resolve_failed_status(
    *,
    stage: str,
    recoverable_status: str,
    failed_status: str | None,
) -> str:
    explicit = (failed_status or "").strip()
    if explicit:
        return explicit
    if stage == "s2_story" and recoverable_status:
        return recoverable_status
    if stage == "s3_images":
        return recoverable_status or ProjectStatus.ASSET_SPECS_GENERATED.value
    return ProjectStatus.FAILED.value


def mark_project_stage_failed(
    db: Session,
    project_id: int,
    *,
    stage: str,
    error_type_value: str,
    message: str,
    failed_status: str | None = None,
) -> None:
    project = db.query(ShortDramaProject).filter(ShortDramaProject.id == project_id).first()
    if project is None:
        return
    previous_status = project.status
    rt = _runtime(project)
    recoverable_status = str(rt.get("previous_status") or "").strip()
    next_status = _resolve_failed_status(
        stage=stage,
        recoverable_status=recoverable_status,
        failed_status=failed_status,
    )
    rt.update(
        {
            "task_running": False,
            "current_stage": "",
            "lock_acquired_at": "",
            "failed_stage": stage,
            "error_message": (message or "")[:240],
            "error_type": (error_type_value or "unknown_error")[:80],
            "can_retry": True,
        }
    )
    project.status = next_status
    _save_runtime(project, rt)
    db.add(project)
    db.commit()
    logger.error(
        "[PROJECT_STAGE_FAILED] project_id=%s stage=%s error_type=%s previous_status=%s failed_status=%s "
        "can_retry=%s runtime_cleared=true error_message=%s",
        project_id,
        stage,
        error_type_value,
        previous_status,
        project.status,
        True,
        (message or "")[:240],
    )


def finalize_s3_images_task(
    db: Session,
    project_id: int,
    *,
    total_attempts: int = 0,
    total_succeeded: int = 0,
    error_type_value: str | None = None,
    message: str | None = None,
) -> None:
    """Release s3_images task lock and set project status after batch image generation ends."""
    if error_type_value:
        mark_project_stage_failed(
            db,
            project_id,
            stage="s3_images",
            error_type_value=error_type_value,
            message=message or "S3 image generation failed.",
            failed_status=ProjectStatus.ASSET_SPECS_GENERATED.value,
        )
        return
    if total_attempts > 0 and total_succeeded == 0:
        mark_project_stage_failed(
            db,
            project_id,
            stage="s3_images",
            error_type_value="image_generation_failed",
            message=message or "Image generation failed for all assets. Please retry.",
            failed_status=ProjectStatus.ASSET_SPECS_GENERATED.value,
        )
        return
    latest = db.query(ShortDramaProject).filter(ShortDramaProject.id == project_id).first()
    success_status = ProjectStatus.ASSETS_READY.value
    if latest is not None and str(latest.status or "").strip():
        st = str(latest.status).strip()
        if st not in ("processing", ProjectStatus.ASSETS_RENDERING.value):
            success_status = st
    mark_project_stage_succeeded(
        db,
        project_id,
        stage="s3_images",
        success_status=success_status,
    )
