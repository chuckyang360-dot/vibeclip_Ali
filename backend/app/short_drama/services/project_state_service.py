import logging
from typing import Any

from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..models import RenderJob, ShortDramaProject
from ..services.read_models import latest_final_video_url
from ..utils.enums import RenderTargetType

logger = logging.getLogger(__name__)

STEP_KEYS = ("step_1", "step_2", "step_3", "step_4")
STEP_1 = "step_1"
STEP_2 = "step_2"
STEP_3 = "step_3"
STEP_4 = "step_4"
OVERVIEW = "overview"

STEP_DOWNSTREAM: dict[str, tuple[str, ...]] = {
    STEP_1: (STEP_2, STEP_3, STEP_4),
    STEP_2: (STEP_3, STEP_4),
    STEP_3: (STEP_4,),
    STEP_4: (),
}


def default_step_status() -> dict[str, str]:
    return {
        STEP_1: "draft",
        STEP_2: "not_started",
        STEP_3: "not_started",
        STEP_4: "not_started",
    }


def normalize_step_status(raw: Any) -> dict[str, str]:
    base = default_step_status()
    if not isinstance(raw, dict):
        return base
    for k, v in raw.items():
        if isinstance(k, str) and k.startswith("_"):
            base[k] = v
    for k in STEP_KEYS:
        v = raw.get(k)
        if isinstance(v, str) and v.strip():
            base[k] = v.strip()
    return base


def mark_step_completed(project: ShortDramaProject, step: str) -> dict[str, str]:
    status_map = normalize_step_status(project.step_status)
    status_map[step] = "completed"
    project.step_status = status_map
    return status_map


def update_last_active_step(project: ShortDramaProject, step: str) -> None:
    project.last_active_step = step
    logger.info(
        "[PROJECT_LAST_ACTIVE_STEP_UPDATE] project_id=%s last_active_step=%s",
        project.id,
        step,
    )


def propagate_downstream_stale(
    project: ShortDramaProject,
    source_step: str,
) -> dict[str, str]:
    status_map = normalize_step_status(project.step_status)
    downstream = STEP_DOWNSTREAM.get(source_step, ())
    if not downstream:
        project.step_status = status_map
        return status_map

    logger.info(
        "[STEP_STATUS_PROPAGATION] project_id=%s source_step=%s downstream=%s",
        project.id,
        source_step,
        ",".join(downstream),
    )
    for step in downstream:
        status_map[step] = "stale"
        logger.info(
            "[STEP_STALE_MARKED] project_id=%s source_step=%s stale_step=%s",
            project.id,
            source_step,
            step,
        )
    project.step_status = status_map
    return status_map


def has_running_or_queued_step4_job(db: Session, project_id: int) -> bool:
    running = (
        db.query(RenderJob.id)
        .filter(
            RenderJob.project_id == project_id,
            RenderJob.status.in_(("queued", "running", "pending")),
            or_(
                RenderJob.target_type == RenderTargetType.SEGMENT.value,
                RenderJob.target_type == RenderTargetType.FINAL.value,
                RenderJob.target_type == RenderTargetType.SEGMENT_VIDEO.value,
                RenderJob.target_type == RenderTargetType.MERGED_VIDEO.value,
            ),
        )
        .first()
    )
    return running is not None


def compute_overall_status(
    db: Session,
    project: ShortDramaProject,
    *,
    final_video_url: str | None = None,
) -> str:
    final_url = final_video_url or latest_final_video_url(db, project.id)
    if final_url and str(project.status or "").strip() == "completed":
        return "completed"
    if has_running_or_queued_step4_job(db, project.id):
        return "generating"
    if any(v == "stale" for v in normalize_step_status(project.step_status).values()):
        return "stale"
    return "draft"
