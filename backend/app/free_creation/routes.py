from __future__ import annotations

import os
import tempfile
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from ..auth.jwt_handler import get_current_user
from ..database import get_db
from ..models import User
from .models import FreeCreationProject, FreeCreationRenderJob, FreeCreationSegment
from .schemas import (
    CreateFreeCreationProjectRequest,
    CreateFreeCreationSegmentRequest,
    FreeCreationProjectResponse,
    FreeCreationRenderJobResponse,
    FreeCreationSegmentResponse,
    FreeCreationUploadResponse,
    GenerateFreeCreationSegmentResponse,
    MergeFreeCreationProjectResponse,
    UpdateFreeCreationSegmentRequest,
)
from .service import (
    asset_to_response,
    create_project,
    create_segment,
    enqueue_merge,
    enqueue_segment_generation,
    project_to_response,
    run_merge_job,
    run_segment_generation_job,
    segment_to_response,
    update_segment,
    upload_asset_file,
)

router = APIRouter()

MAX_UPLOAD_BYTES = int(os.getenv("FREE_CREATION_UPLOAD_MAX_BYTES", str(1024 * 1024 * 1024)))


def _asset_type_from_mime(mime_type: str) -> str:
    mt = (mime_type or "").strip().lower()
    if mt.startswith("image/"):
        return "image"
    if mt.startswith("video/"):
        return "video"
    if mt.startswith("audio/"):
        return "audio"
    raise HTTPException(status_code=400, detail="暂不支持该素材格式，请上传图片、视频或音频。")


def _get_project(db: Session, project_id: int, user_id: int) -> FreeCreationProject:
    row = db.query(FreeCreationProject).filter(FreeCreationProject.id == project_id).first()
    if row is None or int(row.user_id or 0) != int(user_id):
        raise HTTPException(status_code=404, detail="自由创作项目不存在")
    return row


def _get_segment(db: Session, segment_id: int, user_id: int) -> FreeCreationSegment:
    row = db.query(FreeCreationSegment).filter(FreeCreationSegment.id == segment_id).first()
    if row is None or int(row.user_id or 0) != int(user_id):
        raise HTTPException(status_code=404, detail="自由创作片段不存在")
    return row


@router.post("/projects", response_model=FreeCreationProjectResponse)
async def create_free_creation_project(
    body: CreateFreeCreationProjectRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = create_project(db, body=body, user_id=int(current_user.id))
    return project_to_response(db, row)


@router.get("/projects", response_model=list[FreeCreationProjectResponse])
async def list_free_creation_projects(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(FreeCreationProject)
        .filter(FreeCreationProject.user_id == int(current_user.id))
        .order_by(
            FreeCreationProject.updated_at.desc().nullslast(),
            FreeCreationProject.created_at.desc().nullslast(),
            FreeCreationProject.id.desc(),
        )
        .all()
    )
    return [project_to_response(db, row) for row in rows]


@router.get("/projects/{project_id}", response_model=FreeCreationProjectResponse)
async def get_free_creation_project(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = _get_project(db, project_id, int(current_user.id))
    return project_to_response(db, row)


@router.post("/projects/{project_id}/uploads", response_model=FreeCreationUploadResponse)
async def upload_free_creation_asset(
    project_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = _get_project(db, project_id, int(current_user.id))
    mime_type = (file.content_type or "").strip().lower()
    asset_type = _asset_type_from_mime(mime_type)
    ext = Path(file.filename or "").suffix
    fd, tmp_name = tempfile.mkstemp(suffix=ext or "")
    os.close(fd)
    tmp_path = Path(tmp_name)
    size = 0
    try:
        with tmp_path.open("wb") as out:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                size += len(chunk)
                if size > MAX_UPLOAD_BYTES:
                    raise HTTPException(status_code=413, detail="素材文件过大，请压缩后再上传。")
                out.write(chunk)
        try:
            row = upload_asset_file(
                db,
                project=project,
                local_path=str(tmp_path.resolve()),
                file_name=file.filename or f"upload{ext}",
                mime_type=mime_type,
                asset_type_value=asset_type,
                file_size=size,
            )
        except RuntimeError as exc:
            message = str(exc)
            if "R2_" in message:
                raise HTTPException(
                    status_code=500,
                    detail={
                        "error": "free_creation_storage_not_configured",
                        "message": "自由创作素材上传需要配置 R2/OSS 公网存储，请先配置 R2_BUCKET_NAME、R2_PUBLIC_BASE_URL 等环境变量。",
                    },
                ) from exc
            raise
        data = asset_to_response(row)
        return {
            "id": data["id"],
            "project_id": data["project_id"],
            "url": data["url"],
            "preview_url": data["preview_url"],
            "storage_key": data["storage_key"],
            "file_name": data["file_name"],
            "mime_type": data["mime_type"],
            "file_size": data["file_size"],
            "asset_type": data["type"],
            "role": data["role"],
            "label": data["label"],
        }
    finally:
        tmp_path.unlink(missing_ok=True)


@router.post("/projects/{project_id}/segments", response_model=FreeCreationSegmentResponse)
async def create_free_creation_segment(
    project_id: int,
    body: CreateFreeCreationSegmentRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = _get_project(db, project_id, int(current_user.id))
    row = create_segment(db, project=project, body=body)
    return segment_to_response(row)


@router.patch("/segments/{segment_id}", response_model=FreeCreationSegmentResponse)
async def update_free_creation_segment(
    segment_id: int,
    body: UpdateFreeCreationSegmentRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = _get_segment(db, segment_id, int(current_user.id))
    return segment_to_response(update_segment(db, segment=row, body=body))


@router.post("/segments/{segment_id}/generate", response_model=GenerateFreeCreationSegmentResponse)
async def generate_free_creation_segment(
    segment_id: int,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = _get_segment(db, segment_id, int(current_user.id))
    if not (row.prompt or "").strip():
        raise HTTPException(status_code=400, detail="请输入片段 prompt 后再生成。")
    job = enqueue_segment_generation(db, segment=row)
    background_tasks.add_task(run_segment_generation_job, int(job.id))
    return {
        "project_id": int(row.project_id),
        "segment_id": int(row.id),
        "render_job_id": int(job.id),
        "status": job.status,
        "ok": True,
    }


@router.get("/render-jobs/{job_id}", response_model=FreeCreationRenderJobResponse)
async def get_free_creation_render_job(
    job_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    job = db.query(FreeCreationRenderJob).filter(FreeCreationRenderJob.id == job_id).first()
    if job is None:
        raise HTTPException(status_code=404, detail="任务不存在")
    project = _get_project(db, int(job.project_id), int(current_user.id))
    return {
        "id": int(job.id),
        "project_id": int(project.id),
        "segment_id": int(job.segment_id) if job.segment_id is not None else None,
        "target_type": job.target_type or "",
        "status": job.status or "",
        "progress": int(job.progress or 0),
        "provider_task_id": job.provider_task_id or "",
        "output_url": job.output_url or "",
        "error_message": job.error_message or "",
    }


@router.post("/projects/{project_id}/merge", response_model=MergeFreeCreationProjectResponse)
async def merge_free_creation_project(
    project_id: int,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = _get_project(db, project_id, int(current_user.id))
    segments = (
        db.query(FreeCreationSegment)
        .filter(FreeCreationSegment.project_id == project.id)
        .order_by(FreeCreationSegment.segment_index.asc(), FreeCreationSegment.id.asc())
        .all()
    )
    if not segments or any(not (s.video_url or "").strip() for s in segments):
        raise HTTPException(status_code=400, detail="所有片段视频生成完成后才能合成。")
    job = enqueue_merge(db, project=project)
    background_tasks.add_task(run_merge_job, int(job.id))
    return {
        "project_id": int(project.id),
        "render_job_id": int(job.id),
        "status": job.status,
        "final_video_url": project.final_video_url or None,
    }
