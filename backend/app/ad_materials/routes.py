from __future__ import annotations

import os
import tempfile
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from ..auth.jwt_handler import get_current_user
from ..database import get_db
from ..models import User
from .models import AdMaterialTask
from .schemas import (
    AdMaterialTaskListResponse,
    AdMaterialTaskResponse,
    AdMaterialTemplateListResponse,
    AdMaterialUploadResponse,
    CreateAdMaterialTaskRequest,
)
from .service import ad_material_task_to_response, create_task_record, run_ad_material_task, upload_ad_material_file
from .templates import get_template, list_templates

router = APIRouter()

_MAX_UPLOAD_BYTES = int(os.getenv("AD_MATERIAL_UPLOAD_MAX_BYTES", str(1024 * 1024 * 1024)))
_IMAGE_MIME_PREFIXES = ("image/",)
_VIDEO_MIME_PREFIXES = ("video/",)
_AUDIO_MIME_PREFIXES = ("audio/",)


def _asset_type_from_mime(mime_type: str) -> str:
    mt = (mime_type or "").strip().lower()
    if mt.startswith(_IMAGE_MIME_PREFIXES):
        return "image"
    if mt.startswith(_VIDEO_MIME_PREFIXES):
        return "video"
    if mt.startswith(_AUDIO_MIME_PREFIXES):
        return "audio"
    raise HTTPException(status_code=400, detail="暂不支持该素材格式，请上传图片、视频或音频。")


@router.get("/templates", response_model=AdMaterialTemplateListResponse)
async def get_ad_material_templates():
    return {"templates": list_templates()}


@router.post("/uploads", response_model=AdMaterialUploadResponse)
async def upload_ad_material_asset(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
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
                if size > _MAX_UPLOAD_BYTES:
                    raise HTTPException(status_code=413, detail="素材文件过大，请压缩后再上传。")
                out.write(chunk)
        url, key = upload_ad_material_file(
            local_path=str(tmp_path.resolve()),
            user_id=int(current_user.id),
            file_name=file.filename or f"upload{ext}",
            asset_type=asset_type,
        )
        return {
            "url": url,
            "storage_key": key,
            "file_name": file.filename or "",
            "mime_type": mime_type,
            "file_size": size,
            "asset_type": asset_type,
        }
    finally:
        try:
            tmp_path.unlink(missing_ok=True)
        except OSError:
            pass


@router.post("/tasks", response_model=AdMaterialTaskResponse)
async def create_ad_material_task(
    body: CreateAdMaterialTaskRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    has_image = any(asset.type in {"image", "avatar"} for asset in body.assets)
    has_video = any(asset.type == "video" for asset in body.assets)
    image_count = sum(1 for asset in body.assets if asset.type in {"image", "avatar"})
    video_count = sum(1 for asset in body.assets if asset.type == "video")
    template = get_template(body.template_id)
    required_slot_types = [
        str(slot.get("type") or "").strip()
        for slot in (template.slots if template else [])
        if bool(slot.get("required"))
    ]
    if body.mode == "video_edit" and (not has_image or not has_video):
        raise HTTPException(status_code=400, detail="视频编辑需要同时上传参考视频和新商品图片。")
    if body.mode == "template":
        required_image_count = sum(1 for t in required_slot_types if t in {"image", "avatar"})
        required_video_count = sum(1 for t in required_slot_types if t == "video")
        if required_image_count and image_count < required_image_count:
            raise HTTPException(status_code=400, detail="请至少上传一张商品图片。")
        if required_video_count and video_count < required_video_count:
            raise HTTPException(status_code=400, detail="请上传模板所需的参考视频。")
        if not required_slot_types and not has_image:
            raise HTTPException(status_code=400, detail="请至少上传一张商品图片。")
    if body.mode == "product_video" and not body.assets and not body.prompt_text.strip():
        raise HTTPException(status_code=400, detail="请输入提示词，或上传参考素材。")
    row = create_task_record(db, body=body, user_id=int(current_user.id))
    background_tasks.add_task(run_ad_material_task, int(row.id))
    return ad_material_task_to_response(row)


@router.get("/tasks", response_model=AdMaterialTaskListResponse)
async def list_ad_material_tasks(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(AdMaterialTask)
        .filter(AdMaterialTask.user_id == int(current_user.id))
        .order_by(AdMaterialTask.id.desc())
        .limit(100)
        .all()
    )
    return {"tasks": [ad_material_task_to_response(row) for row in rows]}


@router.get("/tasks/{task_id}", response_model=AdMaterialTaskResponse)
async def get_ad_material_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = db.get(AdMaterialTask, task_id)
    if row is None or int(row.user_id or 0) != int(current_user.id):
        raise HTTPException(status_code=404, detail="任务不存在")
    return ad_material_task_to_response(row)
