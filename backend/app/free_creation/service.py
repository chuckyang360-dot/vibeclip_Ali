from __future__ import annotations

import os
import re
import tempfile
import time
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urlparse
from uuid import uuid4

import httpx
from sqlalchemy.orm import Session

from ..config import settings
from ..database import SessionLocal
from ..short_drama.exceptions import ShortDramaFFmpegError, ShortDramaVideoProviderError
from ..short_drama.providers.seedance_video_client import (
    SeedanceVideoClient,
    effective_seedance_video_model,
    extract_last_frame_url,
    extract_task_error,
    extract_task_status,
    extract_video_url,
)
from ..short_drama.utils.public_static_url import build_public_static_url
from ..short_drama.utils.ffmpeg_merge import merge_mp4_files
from ..utils.r2_storage import build_presigned_get_url, upload_file
from ..ad_materials.templates import get_template, list_templates
from .models import FreeCreationAsset, FreeCreationProject, FreeCreationRenderJob, FreeCreationSegment
from .schemas import (
    CreateFreeCreationProjectRequest,
    CreateFreeCreationSegmentRequest,
    FreeCreationInputAsset,
    UpdateFreeCreationSegmentRequest,
)

logger = logging.getLogger(__name__)


IMAGE_ROLES = {"reference_image", "first_frame", "last_frame"}
FREE_CREATION_R2_KEY_MARKERS = (
    "free-creation/uploads/",
    "free-creation/videos/",
    "free-creation/images/",
    "free-creation/final-videos/",
)

ACTIVE_RENDER_STATUSES = {"queued", "running"}
TERMINAL_ERROR_STATUSES = {"failed", "cancelled"}


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _as_aware_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _render_timeout_seconds() -> float:
    return max(60.0, float(settings.SEEDANCE_TASK_TIMEOUT_SECONDS or 600.0))


def asset_role(asset_type: str) -> str:
    if asset_type == "video":
        return "reference_video"
    if asset_type == "audio":
        return "reference_audio"
    return "reference_image"


def _effective_segment_status(row: FreeCreationSegment) -> str:
    status = str(row.status or "idle").strip().lower()
    if status in ACTIVE_RENDER_STATUSES or status in TERMINAL_ERROR_STATUSES:
        return status
    if (row.video_url or "").strip():
        return "completed"
    return status or "idle"


def repair_segment_statuses_from_outputs(db: Session, *, project_id: int | None = None) -> int:
    query = db.query(FreeCreationSegment).filter(FreeCreationSegment.video_url != "")
    if project_id is not None:
        query = query.filter(FreeCreationSegment.project_id == project_id)
    rows = query.all()
    repaired = 0
    for row in rows:
        current = str(row.status or "").strip().lower()
        if current in ACTIVE_RENDER_STATUSES or current in TERMINAL_ERROR_STATUSES or current == "completed":
            continue
        row.status = "completed"
        row.error_message = ""
        repaired += 1
        logger.info(
            "[FREE_CREATION_SEGMENT_STATUS_REPAIRED] project_id=%s segment_id=%s previous_status=%s reason=has_video_url",
            row.project_id,
            row.id,
            current or "(empty)",
        )
    if repaired:
        db.commit()
    return repaired


def expire_stale_render_jobs(db: Session, *, project_id: int | None = None) -> int:
    timeout_seconds = _render_timeout_seconds()
    cutoff = _utc_now().timestamp() - timeout_seconds
    query = db.query(FreeCreationRenderJob).filter(FreeCreationRenderJob.status.in_(ACTIVE_RENDER_STATUSES))
    if project_id is not None:
        query = query.filter(FreeCreationRenderJob.project_id == project_id)
    jobs = query.all()
    expired = 0
    for job in jobs:
        updated = _as_aware_utc(job.updated_at or job.created_at)
        if updated is None or updated.timestamp() > cutoff:
            continue
        message = f"生成任务超过 {int(timeout_seconds)} 秒未返回结果，已自动终止，请重试。"
        job.status = "failed"
        job.error_message = message
        if job.segment_id is not None:
            segment = db.get(FreeCreationSegment, int(job.segment_id))
            if segment is not None and str(segment.status or "").lower() in ACTIVE_RENDER_STATUSES:
                segment.status = "failed"
                segment.error_message = message
        elif str(job.target_type or "") == "final":
            project = db.get(FreeCreationProject, int(job.project_id))
            if project is not None and str(project.final_render_status or "").lower() in ACTIVE_RENDER_STATUSES:
                project.final_render_status = "failed"
                project.final_render_error = message
        expired += 1
        logger.warning(
            "[FREE_CREATION_RENDER_JOB_EXPIRED] job_id=%s project_id=%s segment_id=%s target_type=%s timeout_seconds=%s",
            job.id,
            job.project_id,
            job.segment_id,
            job.target_type,
            timeout_seconds,
        )
    if expired:
        db.commit()
    return expired


def segment_to_response(row: FreeCreationSegment) -> dict[str, Any]:
    status = _effective_segment_status(row)
    return {
        "id": int(row.id),
        "project_id": int(row.project_id),
        "segment_index": int(row.segment_index or 1),
        "title": row.title or "",
        "prompt": row.prompt or "",
        "model": row.model or "",
        "ratio": row.ratio or "9:16",
        "resolution": row.resolution or "720p",
        "duration": int(row.duration or 5),
        "generate_audio": bool(row.generate_audio),
        "watermark": bool(row.watermark),
        "input_assets": [
            _with_preview_url(asset)
            for asset in list(row.input_assets_json or [])
            if isinstance(asset, dict)
        ],
        "status": status,
        "error_message": row.error_message or "",
        "provider_task_id": row.provider_task_id or "",
        "video_url": row.video_url or "",
        "video_preview_url": browser_ready_asset_url(row.video_url, storage_key=row.video_storage_key),
        "last_frame_url": row.last_frame_url or "",
        "last_frame_preview_url": browser_ready_asset_url(row.last_frame_url, storage_key=row.last_frame_storage_key),
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


def asset_to_response(row: FreeCreationAsset) -> dict[str, Any]:
    return {
        "id": int(row.id),
        "project_id": int(row.project_id),
        "type": row.asset_type,
        "url": row.url or "",
        "preview_url": browser_ready_asset_url(row.url, storage_key=row.storage_key),
        "storage_key": row.storage_key or "",
        "file_name": row.file_name or "",
        "mime_type": row.mime_type or "",
        "file_size": int(row.file_size or 0),
        "role": row.role or asset_role(row.asset_type or ""),
        "label": row.label or "",
        "created_at": row.created_at,
    }


def project_to_response(db: Session, row: FreeCreationProject) -> dict[str, Any]:
    expire_stale_render_jobs(db, project_id=int(row.id))
    repair_segment_statuses_from_outputs(db, project_id=int(row.id))
    assets = (
        db.query(FreeCreationAsset)
        .filter(FreeCreationAsset.project_id == row.id)
        .order_by(FreeCreationAsset.id.asc())
        .all()
    )
    segments = (
        db.query(FreeCreationSegment)
        .filter(FreeCreationSegment.project_id == row.id)
        .order_by(FreeCreationSegment.segment_index.asc(), FreeCreationSegment.id.asc())
        .all()
    )
    final_video_url = (row.final_video_url or "").strip() or _template_preview_for_project(row)
    return {
        "id": int(row.id),
        "user_id": int(row.user_id),
        "project_name": row.project_name or "",
        "status": row.status or "created",
        "final_video_url": final_video_url,
        "final_video_preview_url": browser_ready_asset_url(final_video_url, storage_key=row.final_video_storage_key),
        "final_render_status": row.final_render_status or ("completed" if final_video_url else "idle"),
        "final_render_error": row.final_render_error or "",
        "settings": dict(row.settings_json or {}),
        "assets": [asset_to_response(a) for a in assets],
        "segments": [segment_to_response(s) for s in segments],
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


def cancel_segment_generation(db: Session, *, segment: FreeCreationSegment) -> FreeCreationSegment:
    status = str(segment.status or "").lower()
    if status not in ACTIVE_RENDER_STATUSES:
        return segment
    message = "已手动终止生成，可调整后重试。"
    jobs = (
        db.query(FreeCreationRenderJob)
        .filter(
            FreeCreationRenderJob.segment_id == segment.id,
            FreeCreationRenderJob.target_type == "segment",
            FreeCreationRenderJob.status.in_(ACTIVE_RENDER_STATUSES),
        )
        .order_by(FreeCreationRenderJob.id.desc())
        .all()
    )
    for job in jobs:
        job.status = "cancelled"
        job.error_message = message
    segment.status = "cancelled"
    segment.error_message = message
    db.add(segment)
    db.commit()
    db.refresh(segment)
    logger.info(
        "[FREE_CREATION_SEGMENT_GENERATION_CANCELLED] project_id=%s segment_id=%s active_job_count=%s",
        segment.project_id,
        segment.id,
        len(jobs),
    )
    return segment


def normalize_model(raw: str | None) -> str:
    value = (raw or "").strip()
    if value == "Seedance 2.0":
        return "doubao-seedance-2-0-260128"
    if value == "Seedance 2.0 Fast":
        return "doubao-seedance-2-0-fast-260128"
    return value or effective_seedance_video_model()


def normalize_duration(raw: int | None) -> int:
    try:
        value = int(raw or 5)
    except (TypeError, ValueError):
        value = 5
    return max(1, min(value, 30))


def normalize_assets(assets: list[FreeCreationInputAsset] | None) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for idx, asset in enumerate(assets or [], start=1):
        url = str(asset.url or "").strip()
        if not url:
            continue
        asset_type = str(asset.type or "image").strip().lower()
        role = str(asset.role or asset_role(asset_type)).strip()
        label = str(asset.label or f"@素材{idx}").strip()
        out.append(
            {
                "type": asset_type,
                "url": url,
                "preview_url": str(asset.preview_url or ""),
                "storage_key": str(asset.storage_key or ""),
                "file_name": str(asset.file_name or ""),
                "mime_type": str(asset.mime_type or ""),
                "file_size": int(asset.file_size or 0),
                "role": role,
                "label": label,
            }
        )
    return out


def _free_creation_r2_key_from_url(url: str | None) -> str | None:
    s = str(url or "").strip()
    if not s:
        return None
    normalized = s.lstrip("/")
    for marker in FREE_CREATION_R2_KEY_MARKERS:
        if normalized.startswith(marker):
            return normalized
    if not (s.startswith("http://") or s.startswith("https://")):
        return None
    path = unquote(urlparse(s).path or "").lstrip("/")
    for marker in FREE_CREATION_R2_KEY_MARKERS:
        marker_index = path.find(marker)
        if marker_index >= 0:
            return path[marker_index:]
    return None


def provider_ready_asset_url(url: str | None, *, storage_key: str | None = None) -> str:
    key = str(storage_key or "").strip() or _free_creation_r2_key_from_url(url)
    if key and (os.getenv("R2_BUCKET_NAME") or "").strip():
        try:
            return build_presigned_get_url(key)
        except Exception:
            logger.exception("[FREE_CREATION_ASSET_PRESIGN_FAILED] key=%s", key[:240])
    s = str(url or "").strip()
    if not s:
        return s
    return build_public_static_url(s)


def _asset_label_is_referenced(prompt: str, label: str) -> bool:
    value = str(label or "").strip()
    if not value:
        return False
    pattern = re.escape(value)
    if value[-1:].isdigit():
        pattern = f"{pattern}(?!\\d)"
    return re.search(pattern, prompt) is not None


def _assets_referenced_by_prompt(prompt: str, assets: list[dict[str, Any]]) -> list[dict[str, Any]]:
    text = str(prompt or "")
    if not text:
        return assets
    referenced: list[dict[str, Any]] = []
    for asset in assets:
        if not isinstance(asset, dict):
            continue
        if _asset_label_is_referenced(text, str(asset.get("label") or "")):
            referenced.append(asset)
    return referenced or assets


def downloadable_free_creation_url(url: str | None, *, storage_key: str | None = None) -> str:
    return provider_ready_asset_url(url, storage_key=storage_key)


def browser_ready_asset_url(url: str | None, *, storage_key: str | None = None) -> str:
    key = str(storage_key or "").strip() or _free_creation_r2_key_from_url(url)
    if key and (os.getenv("R2_BUCKET_NAME") or "").strip():
        try:
            return build_presigned_get_url(key)
        except Exception:
            logger.exception("[FREE_CREATION_ASSET_PREVIEW_PRESIGN_FAILED] key=%s", key[:240])
    return str(url or "").strip()


def _template_slot_preview_url(storage_key: str | None) -> str:
    raw = str(storage_key or "").strip()
    if not raw.startswith("template://"):
        return ""
    rest = raw[len("template://"):]
    template_id, _, slot_key = rest.partition("/")
    tpl = get_template(template_id)
    if not tpl:
        return ""
    for slot in tpl.slots:
        if str(slot.get("key") or "") != slot_key:
            continue
        preview = str(slot.get("preview_url") or "").strip()
        if preview:
            return preview
        if str(slot.get("type") or "").strip() == "video":
            return str(tpl.preview_video_url or "").strip()
    return ""


def _template_preview_for_project(row: FreeCreationProject) -> str:
    settings = dict(row.settings_json or {})
    template_id = str(settings.get("template_id") or "").strip()
    if template_id:
        tpl = get_template(template_id)
        if tpl and tpl.preview_video_url:
            return str(tpl.preview_video_url).strip()
    name = str(row.project_name or "").strip()
    for tpl in list_templates():
        if str(tpl.name or "").strip() == name and tpl.preview_video_url:
            return str(tpl.preview_video_url).strip()
    return ""


def _with_preview_url(asset: dict[str, Any]) -> dict[str, Any]:
    preview_url = str(asset.get("preview_url") or "").strip()
    return {
        **asset,
        "preview_url": preview_url or _template_slot_preview_url(asset.get("storage_key")) or browser_ready_asset_url(
            asset.get("url"),
            storage_key=asset.get("storage_key"),
        ),
    }


def build_seedance_payload(segment: FreeCreationSegment) -> dict[str, Any]:
    prompt = (segment.prompt or "").strip()
    content: list[dict[str, Any]] = [{"type": "text", "text": prompt}]
    input_assets = [asset for asset in list(segment.input_assets_json or []) if isinstance(asset, dict)]
    for asset in _assets_referenced_by_prompt(prompt, input_assets):
        if not isinstance(asset, dict):
            continue
        url = provider_ready_asset_url(
            asset.get("url"),
            storage_key=asset.get("storage_key"),
        )
        asset_type = str(asset.get("type") or "").strip().lower()
        role = str(asset.get("role") or asset_role(asset_type)).strip()
        if not url:
            continue
        if asset_type in {"image", "avatar"} or role in IMAGE_ROLES:
            content.append({"type": "image_url", "image_url": {"url": url}, "role": role})
        elif asset_type == "video":
            content.append({"type": "video_url", "video_url": {"url": url}, "role": role or "reference_video"})
        elif asset_type == "audio":
            content.append({"type": "audio_url", "audio_url": {"url": url}, "role": role or "reference_audio"})
    return {
        "model": normalize_model(segment.model),
        "content": content,
        "generate_audio": bool(segment.generate_audio),
        "ratio": (segment.ratio or "9:16").strip(),
        "duration": int(segment.duration or 5),
        "watermark": bool(segment.watermark),
        "resolution": (segment.resolution or "720p").strip(),
        "return_last_frame": True,
    }


def create_project(db: Session, *, body: CreateFreeCreationProjectRequest, user_id: int) -> FreeCreationProject:
    title = (body.title or body.prompt or "自由创作项目").strip()[:48]
    template_id = str(body.template_id or "").strip()
    template_preview_video_url = str(body.template_preview_video_url or "").strip()
    row = FreeCreationProject(
        user_id=user_id,
        project_name=title or "自由创作项目",
        status="completed" if template_preview_video_url else "created",
        final_video_url=template_preview_video_url,
        final_render_status="completed" if template_preview_video_url else "idle",
        settings_json={
            "workflow_mode": "free_creation",
            "template_id": template_id,
            "template_preview_video_url": template_preview_video_url,
            "model": normalize_model(body.model),
            "ratio": body.ratio or "9:16",
            "resolution": body.resolution or "720p",
            "duration": normalize_duration(body.duration),
            "generate_audio": bool(body.generate_audio),
        },
    )
    db.add(row)
    db.flush()
    seg = FreeCreationSegment(
        project_id=row.id,
        user_id=user_id,
        segment_index=1,
        title="片段 1",
        prompt=body.prompt.strip(),
        model=normalize_model(body.model),
        ratio=(body.ratio or "9:16").strip(),
        resolution=(body.resolution or "720p").strip(),
        duration=normalize_duration(body.duration),
        generate_audio=bool(body.generate_audio),
        watermark=bool(body.watermark),
        input_assets_json=normalize_assets(body.assets),
        status="idle",
    )
    db.add(seg)
    db.commit()
    db.refresh(row)
    return row


def create_segment(db: Session, *, project: FreeCreationProject, body: CreateFreeCreationSegmentRequest) -> FreeCreationSegment:
    last = (
        db.query(FreeCreationSegment)
        .filter(FreeCreationSegment.project_id == project.id)
        .order_by(FreeCreationSegment.segment_index.desc(), FreeCreationSegment.id.desc())
        .first()
    )
    next_index = int(last.segment_index or 0) + 1 if last else 1
    row = FreeCreationSegment(
        project_id=project.id,
        user_id=project.user_id,
        segment_index=next_index,
        title=(body.title or f"片段 {next_index}").strip(),
        prompt=(body.prompt or "").strip(),
        model=normalize_model(body.model),
        ratio=(body.ratio or "9:16").strip(),
        resolution=(body.resolution or "720p").strip(),
        duration=normalize_duration(body.duration),
        generate_audio=bool(body.generate_audio),
        watermark=bool(body.watermark),
        input_assets_json=normalize_assets(body.assets),
        status="idle",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def update_segment(db: Session, *, segment: FreeCreationSegment, body: UpdateFreeCreationSegmentRequest) -> FreeCreationSegment:
    if body.title is not None:
        segment.title = body.title.strip()
    if body.prompt is not None:
        segment.prompt = body.prompt.strip()
    if body.assets is not None:
        segment.input_assets_json = normalize_assets(body.assets)
    if body.model is not None:
        segment.model = normalize_model(body.model)
    if body.ratio is not None:
        segment.ratio = body.ratio.strip() or "9:16"
    if body.resolution is not None:
        segment.resolution = body.resolution.strip() or "720p"
    if body.duration is not None:
        segment.duration = normalize_duration(body.duration)
    if body.generate_audio is not None:
        segment.generate_audio = bool(body.generate_audio)
    if body.watermark is not None:
        segment.watermark = bool(body.watermark)
    if segment.status in {"failed", "succeeded", "completed"}:
        segment.status = "idle"
        segment.error_message = ""
    db.add(segment)
    db.commit()
    db.refresh(segment)
    return segment


def upload_asset_file(
    db: Session,
    *,
    project: FreeCreationProject,
    local_path: str,
    file_name: str,
    mime_type: str,
    asset_type_value: str,
    file_size: int,
) -> FreeCreationAsset:
    ext = Path(file_name or "").suffix.lower()
    if not ext:
        ext = ".mp4" if asset_type_value == "video" else ".mp3" if asset_type_value == "audio" else ".png"
    key = f"free-creation/uploads/{project.user_id}/{project.id}/{uuid4().hex}{ext}"
    url = upload_file(local_path, key)
    role = asset_role(asset_type_value)
    label_prefix = "视频" if asset_type_value == "video" else "音频" if asset_type_value == "audio" else "图片"
    count = (
        db.query(FreeCreationAsset)
        .filter(FreeCreationAsset.project_id == project.id, FreeCreationAsset.asset_type == asset_type_value)
        .count()
    )
    row = FreeCreationAsset(
        project_id=project.id,
        user_id=project.user_id,
        asset_type=asset_type_value,
        url=url,
        storage_key=key,
        file_name=file_name or "",
        mime_type=mime_type or "",
        file_size=int(file_size or 0),
        role=role,
        label=f"@{label_prefix}{count + 1}",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def enqueue_segment_generation(db: Session, *, segment: FreeCreationSegment) -> FreeCreationRenderJob:
    payload = build_seedance_payload(segment)
    segment.status = "queued"
    segment.error_message = ""
    segment.request_json = payload
    job = FreeCreationRenderJob(
        project_id=segment.project_id,
        segment_id=segment.id,
        target_type="segment",
        status="queued",
        progress=0,
        request_json=payload,
    )
    db.add(segment)
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def _download_to_temp(url: str, suffix: str) -> Path:
    timeout = httpx.Timeout(connect=20.0, read=240.0, write=30.0, pool=10.0)
    fd, tmp_name = tempfile.mkstemp(suffix=suffix)
    os.close(fd)
    path = Path(tmp_name)
    try:
        with httpx.Client(timeout=timeout, follow_redirects=True) as client:
            resp = client.get(url)
        if resp.status_code >= 400:
            raise ShortDramaVideoProviderError(f"download HTTP {resp.status_code}: {url}")
        path.write_bytes(resp.content)
        return path
    except Exception:
        path.unlink(missing_ok=True)
        raise


def _upload_remote_to_r2(*, url: str, key: str, suffix: str) -> str:
    tmp = _download_to_temp(url, suffix)
    try:
        return upload_file(str(tmp.resolve()), key)
    finally:
        tmp.unlink(missing_ok=True)


def run_segment_generation_job(job_id: int) -> None:
    db = SessionLocal()
    client = SeedanceVideoClient()
    try:
        job = db.get(FreeCreationRenderJob, job_id)
        if job is None or job.segment_id is None:
            return
        segment = db.get(FreeCreationSegment, int(job.segment_id))
        if segment is None:
            return
        job.status = "running"
        job.progress = 5
        segment.status = "running"
        db.commit()
        payload = dict(job.request_json or build_seedance_payload(segment))
        logger.info(
            "[FREE_CREATION_SEGMENT_GENERATION_START] job_id=%s project_id=%s segment_id=%s model=%s content_count=%s prompt_chars=%s",
            job_id,
            segment.project_id,
            segment.id,
            payload.get("model"),
            len(payload.get("content") or []),
            len(segment.prompt or ""),
        )
        provider_task_id = client.create_generation_task(
            payload=payload,
            log_context={"workflow": "free_creation", "project_id": segment.project_id, "segment_id": segment.id},
        )
        db.refresh(job)
        db.refresh(segment)
        if str(job.status or "").lower() == "cancelled" or str(segment.status or "").lower() == "cancelled":
            logger.info(
                "[FREE_CREATION_SEGMENT_GENERATION_CANCELLED_BEFORE_POLL] job_id=%s project_id=%s segment_id=%s task_id=%s",
                job_id,
                segment.project_id,
                segment.id,
                provider_task_id,
            )
            return
        job.provider_task_id = provider_task_id
        segment.provider_task_id = provider_task_id
        db.commit()

        deadline = time.monotonic() + float(settings.SEEDANCE_TASK_TIMEOUT_SECONDS)
        interval = max(1.0, float(settings.SEEDANCE_TASK_POLL_INTERVAL_SECONDS))
        final: dict[str, Any] | None = None
        while time.monotonic() < deadline:
            db.refresh(job)
            db.refresh(segment)
            if str(job.status or "").lower() == "cancelled" or str(segment.status or "").lower() == "cancelled":
                logger.info(
                    "[FREE_CREATION_SEGMENT_GENERATION_CANCELLED_DURING_POLL] job_id=%s project_id=%s segment_id=%s task_id=%s",
                    job_id,
                    segment.project_id,
                    segment.id,
                    provider_task_id,
                )
                return
            data = client.get_video_task(task_id=provider_task_id)
            status = extract_task_status(data)
            job.response_json = data
            segment.response_json = data
            job.progress = min(90, max(10, int(job.progress or 10) + 8))
            db.commit()
            logger.info(
                "[FREE_CREATION_SEGMENT_GENERATION_POLL] job_id=%s project_id=%s segment_id=%s task_id=%s status=%s progress=%s",
                job_id,
                segment.project_id,
                segment.id,
                provider_task_id,
                status or "(empty)",
                job.progress,
            )
            if status in {"succeeded", "success", "completed"}:
                final = data
                break
            if status in {"failed", "cancelled", "expired", "error"}:
                err = extract_task_error(data) or status
                job.status = "failed"
                job.error_message = err
                segment.status = "failed"
                segment.error_message = err
                db.commit()
                logger.error(
                    "[FREE_CREATION_SEGMENT_GENERATION_PROVIDER_FAILED] job_id=%s project_id=%s segment_id=%s task_id=%s status=%s error=%s",
                    job_id,
                    segment.project_id,
                    segment.id,
                    provider_task_id,
                    status,
                    err,
                )
                return
            time.sleep(interval)

        if final is None:
            job.status = "failed"
            job.error_message = "Seedance task polling timed out"
            segment.status = "failed"
            segment.error_message = job.error_message
            db.commit()
            logger.error(
                "[FREE_CREATION_SEGMENT_GENERATION_TIMEOUT] job_id=%s project_id=%s segment_id=%s task_id=%s timeout_seconds=%s",
                job_id,
                segment.project_id,
                segment.id,
                provider_task_id,
                settings.SEEDANCE_TASK_TIMEOUT_SECONDS,
            )
            return
        video_url = extract_video_url(final)
        if not video_url:
            job.status = "failed"
            job.error_message = "Seedance task succeeded but video_url is missing"
            segment.status = "failed"
            segment.error_message = job.error_message
            db.commit()
            logger.error(
                "[FREE_CREATION_SEGMENT_GENERATION_MISSING_VIDEO_URL] job_id=%s project_id=%s segment_id=%s task_id=%s response_keys=%s",
                job_id,
                segment.project_id,
                segment.id,
                provider_task_id,
                list(final.keys()) if isinstance(final, dict) else [],
            )
            return

        db.refresh(job)
        db.refresh(segment)
        if str(job.status or "").lower() == "cancelled" or str(segment.status or "").lower() == "cancelled":
            logger.info(
                "[FREE_CREATION_SEGMENT_GENERATION_CANCELLED_BEFORE_SAVE] job_id=%s project_id=%s segment_id=%s task_id=%s",
                job_id,
                segment.project_id,
                segment.id,
                provider_task_id,
            )
            return
        video_key = f"free-creation/videos/{segment.user_id}/{segment.project_id}/{segment.id}/result.mp4"
        final_video_url = _upload_remote_to_r2(url=video_url, key=video_key, suffix=".mp4")
        segment.provider_video_url = video_url
        segment.video_url = final_video_url
        segment.video_storage_key = video_key
        segment.status = "completed"
        segment.error_message = ""
        job.output_url = final_video_url
        job.status = "completed"
        job.progress = 100

        last_frame = extract_last_frame_url(final)
        if last_frame:
            frame_key = f"free-creation/images/{segment.user_id}/{segment.project_id}/{segment.id}/last_frame.png"
            try:
                segment.last_frame_url = _upload_remote_to_r2(url=last_frame, key=frame_key, suffix=".png")
                segment.last_frame_storage_key = frame_key
            except Exception:
                logger.exception(
                    "[FREE_CREATION_LAST_FRAME_UPLOAD_FAILED] job_id=%s project_id=%s segment_id=%s task_id=%s",
                    job_id,
                    segment.project_id,
                    segment.id,
                    provider_task_id,
                )
        project = db.get(FreeCreationProject, int(segment.project_id))
        if project:
            project.status = "video_generating"
            db.add(project)
        db.commit()
        logger.info(
            "[FREE_CREATION_SEGMENT_GENERATION_COMPLETED] job_id=%s project_id=%s segment_id=%s task_id=%s output_url=%s",
            job_id,
            segment.project_id,
            segment.id,
            provider_task_id,
            final_video_url,
        )
    except Exception as exc:
        logger.exception("[FREE_CREATION_SEGMENT_GENERATION_FAILED] job_id=%s", job_id)
        job = db.get(FreeCreationRenderJob, job_id)
        if job is not None:
            job.status = "failed"
            job.error_message = str(exc)[:2000]
            if job.segment_id is not None:
                segment = db.get(FreeCreationSegment, int(job.segment_id))
                if segment is not None:
                    segment.status = "failed"
                    segment.error_message = job.error_message
            db.commit()
    finally:
        db.close()


def enqueue_merge(db: Session, *, project: FreeCreationProject) -> FreeCreationRenderJob:
    job = FreeCreationRenderJob(
        project_id=project.id,
        segment_id=None,
        target_type="final",
        status="queued",
        progress=0,
    )
    project.final_render_status = "queued"
    project.final_render_error = ""
    db.add(job)
    db.add(project)
    db.commit()
    db.refresh(job)
    return job


def run_merge_job(job_id: int) -> None:
    db = SessionLocal()
    temp_paths: list[Path] = []
    output: Path | None = None
    try:
        job = db.get(FreeCreationRenderJob, job_id)
        if job is None:
            return
        project = db.get(FreeCreationProject, int(job.project_id))
        if project is None:
            return
        job.status = "running"
        job.progress = 10
        project.final_render_status = "running"
        db.commit()
        segments = (
            db.query(FreeCreationSegment)
            .filter(FreeCreationSegment.project_id == project.id)
            .order_by(FreeCreationSegment.segment_index.asc(), FreeCreationSegment.id.asc())
            .all()
        )
        ready = [s for s in segments if (s.video_url or "").strip()]
        if len(ready) != len(segments) or not ready:
            raise ShortDramaFFmpegError("所有片段视频生成完成后才能合成。")
        for s in ready:
            temp_paths.append(
                _download_to_temp(
                    downloadable_free_creation_url(str(s.video_url), storage_key=s.video_storage_key),
                    ".mp4",
                )
            )
        fd, out_name = tempfile.mkstemp(suffix=".mp4")
        os.close(fd)
        output = Path(out_name)
        merge_mp4_files(temp_paths, output, project_id=int(project.id), segment_id="free_creation_final")
        key = f"free-creation/final-videos/{project.user_id}/{project.id}/final.mp4"
        final_url = upload_file(str(output.resolve()), key)
        project.final_video_url = final_url
        project.final_video_storage_key = key
        project.final_render_status = "completed"
        project.final_render_error = ""
        project.status = "completed"
        job.output_url = final_url
        job.status = "completed"
        job.progress = 100
        db.commit()
    except Exception as exc:
        job = db.get(FreeCreationRenderJob, job_id)
        if job is not None:
            job.status = "failed"
            job.error_message = str(exc)[:2000]
            project = db.get(FreeCreationProject, int(job.project_id))
            if project is not None:
                project.final_render_status = "failed"
                project.final_render_error = job.error_message
            db.commit()
        logger.exception("[FREE_CREATION_MERGE_FAILED] job_id=%s", job_id)
    finally:
        for p in temp_paths:
            p.unlink(missing_ok=True)
        if output is not None:
            output.unlink(missing_ok=True)
        db.close()
