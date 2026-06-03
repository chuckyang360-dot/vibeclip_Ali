from __future__ import annotations

import logging
import os
import tempfile
import time
from pathlib import Path
from typing import Any
from uuid import uuid4

import httpx
from sqlalchemy.orm import Session

from ..config import settings
from ..database import SessionLocal
from ..short_drama.exceptions import ShortDramaVideoProviderError
from ..short_drama.providers.seedance_video_client import (
    SeedanceVideoClient,
    effective_seedance_video_model,
    extract_last_frame_url,
    extract_task_error,
    extract_task_status,
    extract_video_url,
)
from ..utils.r2_storage import upload_file
from .models import AdMaterialTask
from .schemas import CreateAdMaterialTaskRequest
from .templates import get_template

logger = logging.getLogger(__name__)

_IMAGE_ROLES = {"reference_image", "first_frame", "last_frame"}


def ad_material_task_to_response(row: AdMaterialTask) -> dict[str, Any]:
    return {
        "id": row.id,
        "user_id": row.user_id,
        "template_id": row.template_id,
        "mode": row.mode,
        "title": row.title,
        "status": row.status,
        "error_message": row.error_message,
        "provider_task_id": row.provider_task_id,
        "provider_video_url": row.provider_video_url,
        "video_url": row.video_url,
        "last_frame_url": row.last_frame_url,
        "prompt": row.prompt,
        "input_assets": row.input_assets_json or [],
        "parameters": row.parameters_json or {},
        "model": row.model,
        "ratio": row.ratio,
        "resolution": row.resolution,
        "duration": row.duration,
        "generate_audio": row.generate_audio,
        "watermark": row.watermark,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def _replace_vars(template: str, values: dict[str, str]) -> str:
    out = template
    for key, value in values.items():
        out = out.replace("{{" + key + "}}", value)
    return out


def build_prompt(body: CreateAdMaterialTaskRequest) -> str:
    raw_prompt = (body.prompt_text or "").strip()
    if body.mode == "product_video" and raw_prompt:
        return raw_prompt

    product_name = (body.product_name or "商品").strip()
    selling_points = (body.selling_points or "突出商品质感、核心卖点和使用场景").strip()
    channel = (body.channel or "电商投流").strip()
    style = (body.style or "").strip()
    edit_instruction = (body.edit_instruction or "").strip()
    tpl = get_template(body.template_id)

    values = {
        "product_name": product_name,
        "selling_points": selling_points,
        "channel": channel,
        "style": style or "清晰、自然、有质感",
        "edit_instruction": edit_instruction,
    }

    if body.mode == "video_edit" or body.template_id == "product-replace-edit":
        base = (
            "严格编辑视频1，将视频1中的原商品替换成图片1中的商品“{{product_name}}”，"
            "动作、人物、环境、光线和运镜保持不变。{{edit_instruction}} "
            "整体画面真实自然，商品细节清晰，避免生成无关文字、Logo、水印和字幕。"
        )
        return _replace_vars(base, values)

    if body.template_id == "viral-ad-cuts":
        base = (
            "参考图片1中的商品“{{product_name}}”，生成一条适合{{channel}}的电商投流短视频。"
            "镜头1：商品在干净明亮的场景中快速出现，镜头平稳推近，突出第一眼吸引力。"
            "镜头2：快速切换商品细节，突出卖点：{{selling_points}}。"
            "镜头3：商品被自然拿起或摆放到使用场景中，画面节奏轻快。"
            "镜头4：商品居中定格，画面中部出现简洁卖点文字，文字内容使用常用字。"
            "整体风格{{style}}，画面高清，动作连贯，避免无关Logo、水印和乱码字幕。"
        )
        return _replace_vars(base, values)

    if body.template_id == "virtual-host-demo":
        base = (
            "图片1中的虚拟达人在明亮自然的室内场景中，向镜头介绍图片2中的商品“{{product_name}}”。"
            "达人面带自然笑容，先展示商品包装，再展示商品细节，并用亲切自然的语气介绍："
            "“{{selling_points}}”。人物居中，完整展示头部和上半身，商品始终清晰可见。"
            "整体风格{{style}}，画面无字幕，避免无关Logo和水印。"
        )
        return _replace_vars(base, values)

    if tpl:
        base = (
            "参考图片1中的商品“{{product_name}}”，生成一条适合{{channel}}的商品展示视频。"
            "镜头1：商品置于干净明亮的场景中，镜头缓慢推近，突出整体外观。"
            "镜头2：切换到商品细节近景，展示材质、包装和核心质感。"
            "镜头3：围绕卖点“{{selling_points}}”进行视觉表达，画面简洁高级。"
            "镜头4：商品居中定格，形成适合主图视频的结束画面。"
            "整体风格{{style}}，高清、自然、无多余杂物，避免生成无关文字、Logo、水印和字幕。"
        )
        return _replace_vars(base, values)

    base = (
        "参考图片1中的商品“{{product_name}}”，生成一条电商商品短视频。"
        "突出卖点：{{selling_points}}。适合{{channel}}，整体风格{{style}}，"
        "镜头运动平稳，商品细节清晰，避免无关Logo、水印和字幕。"
    )
    return _replace_vars(base, values)


def build_seedance_payload(body: CreateAdMaterialTaskRequest, prompt: str) -> dict[str, Any]:
    content: list[dict[str, Any]] = [{"type": "text", "text": prompt}]
    for asset in body.assets:
        url = (asset.url or "").strip()
        if not url:
            continue
        if asset.type in {"image", "avatar"} or asset.role in _IMAGE_ROLES:
            content.append({"type": "image_url", "image_url": {"url": url}, "role": asset.role})
        elif asset.type == "video":
            content.append({"type": "video_url", "video_url": {"url": url}, "role": "reference_video"})
        elif asset.type == "audio":
            content.append({"type": "audio_url", "audio_url": {"url": url}, "role": "reference_audio"})

    model = (body.model or "").strip() or effective_seedance_video_model()
    payload: dict[str, Any] = {
        "model": model,
        "content": content,
        "generate_audio": bool(body.generate_audio),
        "ratio": (body.ratio or "9:16").strip(),
        "duration": int(body.duration),
        "watermark": bool(body.watermark),
        "resolution": (body.resolution or "720p").strip(),
        "return_last_frame": bool(body.return_last_frame),
    }
    return payload


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
        try:
            path.unlink(missing_ok=True)
        except OSError:
            pass
        raise


def _upload_remote_to_r2(*, url: str, key: str, suffix: str) -> str:
    tmp = _download_to_temp(url, suffix)
    try:
        return upload_file(str(tmp.resolve()), key)
    finally:
        try:
            tmp.unlink(missing_ok=True)
        except OSError:
            pass


def upload_ad_material_file(*, local_path: str, user_id: int | None, file_name: str, asset_type: str) -> tuple[str, str]:
    safe_user = str(user_id or "anonymous")
    ext = Path(file_name or "").suffix.lower()
    if not ext:
        ext = ".mp4" if asset_type == "video" else ".mp3" if asset_type == "audio" else ".png"
    key = f"ad-materials/uploads/{safe_user}/{uuid4().hex}{ext}"
    return upload_file(local_path, key), key


def create_task_record(db: Session, *, body: CreateAdMaterialTaskRequest, user_id: int | None) -> AdMaterialTask:
    prompt = build_prompt(body)
    payload = build_seedance_payload(body, prompt)
    title = (body.title or body.product_name or "投流素材").strip()
    row = AdMaterialTask(
        user_id=user_id,
        template_id=body.template_id or "",
        mode=body.mode,
        title=title,
        status="queued",
        prompt=prompt,
        request_json=payload,
        input_assets_json=[asset.model_dump() for asset in body.assets],
        parameters_json={
            "prompt_text": body.prompt_text,
            "channel": body.channel,
            "product_name": body.product_name,
            "selling_points": body.selling_points,
            "style": body.style,
            "return_last_frame": body.return_last_frame,
        },
        model=str(payload.get("model") or ""),
        ratio=str(payload.get("ratio") or "9:16"),
        resolution=str(payload.get("resolution") or "720p"),
        duration=int(payload.get("duration") or 8),
        generate_audio=bool(payload.get("generate_audio")),
        watermark=bool(payload.get("watermark")),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def run_ad_material_task(task_id: int) -> None:
    db = SessionLocal()
    client = SeedanceVideoClient()
    try:
        row = db.get(AdMaterialTask, task_id)
        if row is None:
            return
        row.status = "running"
        row.error_message = ""
        db.commit()
        payload = dict(row.request_json or {})
        provider_task_id = client.create_generation_task(
            payload=payload,
            log_context={"task_id": row.id, "user_id": row.user_id, "mode": row.mode},
        )
        row.provider_task_id = provider_task_id
        db.commit()

        deadline = time.monotonic() + float(settings.SEEDANCE_TASK_TIMEOUT_SECONDS)
        interval = max(1.0, float(settings.SEEDANCE_TASK_POLL_INTERVAL_SECONDS))
        final: dict[str, Any] | None = None
        while time.monotonic() < deadline:
            data = client.get_video_task(task_id=provider_task_id)
            status = extract_task_status(data)
            row.response_json = data
            db.add(row)
            db.commit()
            if status in {"succeeded", "success", "completed"}:
                final = data
                break
            if status in {"failed", "cancelled", "expired", "error"}:
                row.status = "failed" if status != "expired" else "expired"
                row.error_message = extract_task_error(data) or status
                db.commit()
                return
            time.sleep(interval)

        if final is None:
            row.status = "expired"
            row.error_message = "Seedance task polling timed out"
            db.commit()
            return

        video_url = extract_video_url(final)
        if not video_url:
            row.status = "failed"
            row.error_message = "Seedance task succeeded but video_url is missing"
            db.commit()
            return

        safe_user = str(row.user_id or "anonymous")
        video_key = f"ad-materials/videos/{safe_user}/{row.id}/result.mp4"
        final_video_url = _upload_remote_to_r2(url=video_url, key=video_key, suffix=".mp4")
        row.provider_video_url = video_url
        row.video_url = final_video_url
        row.video_storage_key = video_key

        last_frame = extract_last_frame_url(final)
        if last_frame:
            frame_key = f"ad-materials/images/{safe_user}/{row.id}/last_frame.png"
            try:
                row.last_frame_url = _upload_remote_to_r2(url=last_frame, key=frame_key, suffix=".png")
                row.last_frame_storage_key = frame_key
            except Exception as e:
                logger.exception("[AD_MATERIAL_LAST_FRAME_UPLOAD_FAILED] task_id=%s err=%s", row.id, e)

        row.status = "succeeded"
        row.error_message = ""
        db.commit()
    except Exception as e:
        logger.exception("[AD_MATERIAL_TASK_FAILED] task_id=%s", task_id)
        row = db.get(AdMaterialTask, task_id)
        if row is not None:
            row.status = "failed"
            row.error_message = str(e)[:2000]
            db.commit()
    finally:
        db.close()
