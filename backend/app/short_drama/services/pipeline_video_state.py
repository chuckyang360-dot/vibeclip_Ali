"""Derived video pipeline fields for GET /project/{id}/pipeline (no extra DB migrations)."""

from __future__ import annotations

from sqlalchemy.orm import Session

from ..models import RenderJob
from ..utils.enums import RenderJobStatus, RenderTargetType
from .read_models import all_segment_scripts_have_video, latest_final_render_job, latest_final_video_url, list_segment_scripts

_ACTIVE_RENDER_JOB_STATUSES = frozenset(
    {
        RenderJobStatus.QUEUED.value,
        RenderJobStatus.PENDING.value,
        RenderJobStatus.RUNNING.value,
        "submitted",
        "polling",
        "processing",
    }
)


def _active_render_jobs(db: Session, project_id: int) -> list[RenderJob]:
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
        .order_by(RenderJob.id.desc())
        .all()
    )


def build_pipeline_video_state(db: Session, project_id: int, project_status: str) -> dict:
    segs = list_segment_scripts(db, project_id)
    segment_count = len(segs)
    has_all_segment_videos = all_segment_scripts_have_video(db, project_id) if segment_count else False
    final_url = latest_final_video_url(db, project_id)
    has_final_video = bool((final_url or "").strip())
    final_job = latest_final_render_job(db, project_id)
    active_jobs = _active_render_jobs(db, project_id)
    has_active_render_job = bool(active_jobs)
    has_active_segment_render_job = any(
        job.target_type in (RenderTargetType.SEGMENT.value, RenderTargetType.SEGMENT_VIDEO.value)
        for job in active_jobs
    )
    has_active_final_render_job = any(
        job.target_type in (RenderTargetType.FINAL.value, RenderTargetType.MERGED_VIDEO.value)
        for job in active_jobs
    )

    final_render_error: str | None = None
    if final_job and (final_job.status or "").lower() == RenderJobStatus.FAILED.value:
        final_render_error = (final_job.error_message or "").strip() or None

    if not final_job:
        final_render_status = "none"
    elif final_job.status == RenderJobStatus.COMPLETED.value and has_final_video:
        final_render_status = "completed"
    elif final_job.status == RenderJobStatus.COMPLETED.value and not has_final_video:
        # Data inconsistency guard: completed final job must carry output_url.
        final_render_status = "failed"
        final_render_error = final_render_error or "final render completed without output_url"
    elif final_job.status == RenderJobStatus.FAILED.value:
        final_render_status = "failed"
    elif final_job.status in (RenderJobStatus.RUNNING.value, RenderJobStatus.QUEUED.value):
        final_render_status = "running"
    else:
        final_render_status = str(final_job.status or "unknown")

    # Coarse UI stage (segment vs final vs done)
    if project_status == "completed" and has_final_video:
        current_video_stage = "completed"
    elif final_render_status == "failed":
        current_video_stage = "final_failed"
    elif final_render_status == "running" or has_active_final_render_job:
        current_video_stage = "final_rendering"
    elif has_final_video:
        current_video_stage = "completed"
    elif has_all_segment_videos and project_status in (
        "video_segments_ready",
        "video_rendering",
    ):
        current_video_stage = "segments_complete_pending_final"
    elif project_status == "video_rendering" and has_active_segment_render_job:
        current_video_stage = "segment_rendering"
    elif project_status == "video_segments_ready":
        current_video_stage = "segments_complete_pending_final"
    else:
        current_video_stage = "idle"

    return {
        "current_video_stage": current_video_stage,
        "has_all_segment_videos": has_all_segment_videos,
        "has_final_video": has_final_video,
        "final_render_status": final_render_status,
        "final_render_error": final_render_error,
        "final_render_job_id": final_job.id if final_job else None,
        "segment_count": segment_count,
        "has_active_render_job": has_active_render_job,
        "video_render_task_running": has_active_render_job,
        "active_render_jobs_count": len(active_jobs),
    }


def preload_segment_render_jobs(
    db: Session, project_id: int
) -> tuple[dict[str, RenderJob], dict[int, RenderJob]]:
    rows = (
        db.query(RenderJob)
        .filter(
            RenderJob.project_id == project_id,
            RenderJob.target_type == RenderTargetType.SEGMENT.value,
        )
        .order_by(RenderJob.id.desc())
        .all()
    )
    by_segment_id: dict[str, RenderJob] = {}
    by_job_id: dict[int, RenderJob] = {}
    for row in rows:
        if isinstance(row.id, int):
            by_job_id[row.id] = row
        seg_id = str(row.target_id or "").strip()
        if seg_id and seg_id not in by_segment_id:
            by_segment_id[seg_id] = row
    return by_segment_id, by_job_id


def segment_row_video_fields(
    segment_id: str,
    script: dict,
    video_url: str | None,
    *,
    render_job_by_segment_id: dict[str, RenderJob],
    render_job_by_id: dict[int, RenderJob],
) -> dict:
    """Normalize per-segment video fields for pipeline payload."""
    vr = script.get("video_render") if isinstance(script.get("video_render"), dict) else {}
    jid = vr.get("render_job_id")
    job: RenderJob | None = None
    if isinstance(jid, int):
        job = render_job_by_id.get(jid)
    if job is None:
        job = render_job_by_segment_id.get(str(segment_id))
    st = (job.status if job else None) or None
    err = (job.error_message or "").strip() if job else None
    if job is not None:
        rstatus = st
    elif (video_url or "").strip():
        rstatus = RenderJobStatus.COMPLETED.value
    else:
        rstatus = None
    return {
        "render_status": rstatus,
        "render_job_id": job.id if job else None,
        "render_error": err or None,
    }
