from __future__ import annotations

import logging
import os
import subprocess
import tempfile
import time
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from ...database import get_db
from ...utils.r2_storage import build_presigned_get_url, upload_file
from ..exceptions import ShortDramaInvalidModelOutputError, ShortDramaProviderError
from ..models import ReferenceVideoAnalysis
from ..providers.railway_video_understanding_proxy import analyze_reference_video_via_railway_proxy
from ..schemas.reference_video import (
    AnalyzeReferenceVideoResponse,
    ReferenceVideoListResponse,
    ReferenceVideoResponse,
)
from ..utils.reference_video_prompts import (
    REFERENCE_VIDEO_UNDERSTANDING_SYSTEM_PROMPT,
    build_reference_video_understanding_payload,
)
from ..utils.ai_runtime_config import (
    STAGE_REFERENCE_VIDEO_UNDERSTANDING,
    apply_runtime_user_prompt_template,
    get_ai_runtime_config,
)

logger = logging.getLogger(__name__)
router = APIRouter()

SUPPORTED_VIDEO_MIME_TYPES = {
    "video/mp4",
    "video/mpeg",
    "video/quicktime",
    "video/avi",
    "video/x-flv",
    "video/mpg",
    "video/webm",
    "video/wmv",
    "video/3gpp",
}
MAX_REFERENCE_VIDEO_BYTES = int(os.getenv("REFERENCE_VIDEO_MAX_BYTES", str(1024 * 1024 * 1024)))


def _safe_ext(filename: str, mime_type: str) -> str:
    ext = Path(filename or "").suffix.lower()
    if ext and len(ext) <= 12:
        return ext
    return {
        "video/mp4": ".mp4",
        "video/quicktime": ".mov",
        "video/webm": ".webm",
        "video/x-flv": ".flv",
        "video/3gpp": ".3gp",
    }.get(mime_type, ".mp4")


def _probe_duration_seconds(path: str) -> int | None:
    try:
        out = subprocess.check_output(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                path,
            ],
            stderr=subprocess.STDOUT,
            timeout=10,
        )
        raw = out.decode("utf-8", errors="ignore").strip()
        if not raw:
            return None
        return max(0, int(float(raw)))
    except Exception:
        return None


def _extract_generated_prompt(analysis_json: dict) -> str:
    vp = analysis_json.get("video_prompt")
    if isinstance(vp, dict):
        full = vp.get("full_prompt")
        if isinstance(full, str) and full.strip():
            return full.strip()
    return ""


@router.post("", response_model=ReferenceVideoResponse)
async def upload_reference_video(
    file: UploadFile = File(...),
    user_id: int | None = Form(default=None),
    db: Session = Depends(get_db),
):
    mime_type = (file.content_type or "").strip().lower()
    if mime_type not in SUPPORTED_VIDEO_MIME_TYPES:
        raise HTTPException(status_code=400, detail="暂不支持该视频格式，请上传 MP4、MOV、WebM 等常见视频格式。")

    ext = _safe_ext(file.filename or "", mime_type)
    fd, tmp_name = tempfile.mkstemp(suffix=ext)
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
                if size > MAX_REFERENCE_VIDEO_BYTES:
                    raise HTTPException(status_code=413, detail="视频文件过大，请压缩后再上传。")
                out.write(chunk)

        duration = _probe_duration_seconds(str(tmp_path))
        video_uuid = uuid4().hex
        key = f"short-drama/reference-videos/{video_uuid}/original{ext}"
        public_url = upload_file(str(tmp_path), key)
        record = ReferenceVideoAnalysis(
            user_id=user_id,
            original_filename=file.filename or f"reference{ext}",
            mime_type=mime_type,
            file_size=size,
            duration_seconds=duration,
            storage_provider="r2",
            storage_key=key,
            public_url=public_url,
            analysis_status="uploaded",
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        logger.info(
            "[REFERENCE_VIDEO_UPLOADED] video_id=%s user_id=%s mime_type=%s file_size=%s duration_seconds=%s r2_key=%s",
            record.id,
            user_id,
            mime_type,
            size,
            duration,
            key,
        )
        return record
    finally:
        try:
            tmp_path.unlink(missing_ok=True)
        except OSError:
            pass


@router.get("/{video_id}", response_model=ReferenceVideoResponse)
async def get_reference_video(video_id: int, db: Session = Depends(get_db)):
    record = db.get(ReferenceVideoAnalysis, video_id)
    if record is None:
        raise HTTPException(status_code=404, detail="视频不存在")
    return record


@router.get("", response_model=ReferenceVideoListResponse)
async def list_reference_videos(user_id: int, db: Session = Depends(get_db)):
    rows = (
        db.query(ReferenceVideoAnalysis)
        .filter(ReferenceVideoAnalysis.user_id == user_id)
        .order_by(
            ReferenceVideoAnalysis.updated_at.desc().nullslast(),
            ReferenceVideoAnalysis.created_at.desc().nullslast(),
            ReferenceVideoAnalysis.id.desc(),
        )
        .limit(200)
        .all()
    )
    return ReferenceVideoListResponse(user_id=user_id, videos=rows)


@router.delete("/{video_id}")
async def delete_reference_video(video_id: int, user_id: int | None = None, db: Session = Depends(get_db)):
    record = db.get(ReferenceVideoAnalysis, video_id)
    if record is None:
        raise HTTPException(status_code=404, detail="视频不存在")
    if user_id is not None and record.user_id is not None and int(record.user_id) != int(user_id):
        raise HTTPException(status_code=403, detail="无权删除该视频解析")
    db.delete(record)
    db.commit()
    return {"ok": True, "video_id": video_id}


@router.post("/{video_id}/analyze", response_model=AnalyzeReferenceVideoResponse)
async def analyze_reference_video(video_id: int, db: Session = Depends(get_db)):
    record = db.get(ReferenceVideoAnalysis, video_id)
    if record is None:
        raise HTTPException(status_code=404, detail="视频不存在")
    if record.analysis_status == "success" and record.analysis_json:
        return {"video": record}

    record.analysis_status = "processing"
    record.error_message = ""
    db.commit()
    db.refresh(record)

    started = time.monotonic()
    analysis_video_url = record.public_url
    if record.storage_key:
        try:
            analysis_video_url = build_presigned_get_url(record.storage_key)
        except Exception:
            logger.exception("[REFERENCE_VIDEO_PRESIGNED_URL_FAILED] video_id=%s storage_key=%s", record.id, record.storage_key)
            analysis_video_url = record.public_url

    payload = build_reference_video_understanding_payload(analysis_video_url)
    ai_cfg = get_ai_runtime_config(STAGE_REFERENCE_VIDEO_UNDERSTANDING)
    effective_system_prompt = ai_cfg.system_prompt or REFERENCE_VIDEO_UNDERSTANDING_SYSTEM_PROMPT
    effective_payload = apply_runtime_user_prompt_template(
        user_payload=payload,
        template=ai_cfg.user_prompt_template,
        payload_placeholder="reference_video_payload",
        values={
            "video_url": analysis_video_url,
            "mime_type": record.mime_type,
            "video_id": record.id,
        },
    )
    try:
        analysis_json = analyze_reference_video_via_railway_proxy(
            video_id=record.id,
            video_url=analysis_video_url,
            mime_type=record.mime_type,
            system_prompt=effective_system_prompt,
            user_payload=effective_payload,
            provider=ai_cfg.provider,
            model=ai_cfg.model_id,
        )
        record.analysis_json = analysis_json
        record.generated_prompt = _extract_generated_prompt(analysis_json)
        record.analysis_status = "success"
        record.error_message = ""
        db.commit()
        db.refresh(record)
        logger.info(
            "[REFERENCE_VIDEO_ANALYZED] video_id=%s elapsed_seconds=%.3f prompt_chars=%s",
            record.id,
            time.monotonic() - started,
            len(record.generated_prompt or ""),
        )
        return {"video": record}
    except (ShortDramaProviderError, ShortDramaInvalidModelOutputError) as e:
        record.analysis_status = "failed"
        record.error_message = str(e)[:1000]
        db.commit()
        logger.exception("[REFERENCE_VIDEO_ANALYSIS_FAILED] video_id=%s", record.id)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="视频解析服务暂时不可用，请稍后重试。",
        ) from e
    except Exception as e:
        record.analysis_status = "failed"
        record.error_message = str(e)[:1000]
        db.commit()
        logger.exception("[REFERENCE_VIDEO_ANALYSIS_UNEXPECTED] video_id=%s", record.id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="视频解析失败，请稍后重试。",
        ) from e
