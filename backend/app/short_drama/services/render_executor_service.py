"""Segment video generation: RenderJob + SegmentScript script_json.video_render updates.

资产参考图（Gemini/Mock）由 asset_image_service 写入本地文件并更新 Character/Scene/ProductAsset.image_url，
不创建 short_drama_render_jobs 行；RenderJob 仅用于分段视频与成片合并。
"""

from __future__ import annotations

import os
import logging
import json
import tempfile
import time
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import httpx
from sqlalchemy.orm import Session

from ...config import settings
from ...database import SessionLocal
from ...utils.r2_storage import upload_file
from ..exceptions import ShortDramaInvalidSegmentVideoError, ShortDramaVideoInputError
from ..models import AssetEntity, AssetImage, RenderJob, SegmentScriptRecord, ShortDramaProject
from ..providers.railway_xai_video_proxy import RailwayXAIVideoProxyProvider
from ..providers.video_provider_config import effective_video_model_for_provider
from ..providers.seedance_video_provider import SeedanceVideoProvider
from ..providers.segment_video_types import SegmentVideoProvider
from ..providers.xai_video_provider import MockXAIVideoProvider, build_xai_video_provider
from ..schemas.segment import SegmentScriptSchema
from ..utils.enums import ProjectStatus, RenderJobStatus, RenderTargetType
from ..utils.segment_mp4_validate import validate_segment_mp4_path
from ..utils.video_prompt_builder import build_segment_video_plan
from ..utils.video_storage import (
    absolutize_media_url_for_provider,
)
from ..utils.xai_reference_image import (
    build_xai_ready_reference_image,
    local_path_from_xai_ready_public_url,
    resolve_xai_reference_public_url,
)
from .read_models import all_segment_scripts_have_video, list_asset_rows, list_segment_scripts
from .workflow_orchestrator import orchestrator
from .project_task_guard import current_stage, is_processing

logger = logging.getLogger(__name__)
_HARD_VIDEO_PROMPT_CHARS = 4096


def _trace(tag: str, payload: dict[str, Any]) -> None:
    logger.info("[AI_CHAIN_TRACE][%s] %s", tag, json.dumps(payload, ensure_ascii=False, default=str))


def _extract_raw_character_asset_ids(seg: SegmentScriptSchema) -> list[Any]:
    raw: list[Any] = []
    for shot in seg.shots or []:
        values = getattr(shot, "character_asset_ids", None) or []
        if isinstance(values, list):
            raw.extend(values)
        asset_refs = getattr(shot, "asset_refs", None) or {}
        if isinstance(asset_refs, dict):
            nested = asset_refs.get("character_asset_ids") or []
            if isinstance(nested, list):
                raw.extend(nested)
    return raw


def _clean_character_asset_ids(values: list[Any] | None) -> list[int]:
    out: list[int] = []
    seen: set[int] = set()
    for raw in values or []:
        text = str(raw or "").strip()
        if not text or not text.isdigit():
            continue
        asset_id = int(text)
        if asset_id in seen:
            continue
        seen.add(asset_id)
        out.append(asset_id)
    return out


def _resolve_character_assets_by_ids(
    db: Session,
    *,
    project_id: int,
    segment_id: str,
    raw_character_asset_ids: list[Any],
) -> dict[int, dict[str, str]]:
    clean_ids = _clean_character_asset_ids(raw_character_asset_ids)
    logger.info(
        "[VIDEO_CHARACTER_ASSET_RESOLVE_START] project_id=%s segment_id=%s raw_character_asset_ids=%s clean_character_asset_ids=%s",
        project_id,
        segment_id,
        list(raw_character_asset_ids or []),
        clean_ids,
    )
    for raw in raw_character_asset_ids or []:
        text = str(raw or "").strip()
        if text and not text.isdigit():
            logger.warning(
                "[VIDEO_CHARACTER_ASSET_RESOLVE_RESULT] project_id=%s segment_id=%s character_asset_id=%s found=%s asset_type=%s asset_name=%s image_url=%s reason=%s",
                project_id,
                segment_id,
                text,
                False,
                "",
                "",
                "",
                "invalid_id",
            )
    if not clean_ids:
        return {}

    assets = (
        db.query(AssetEntity)
        .filter(
            AssetEntity.project_id == project_id,
            AssetEntity.id.in_(clean_ids),
            AssetEntity.status == "active",
        )
        .all()
    )
    by_id = {int(row.id): row for row in assets}
    cross_project_assets = (
        db.query(AssetEntity)
        .filter(
            AssetEntity.id.in_(clean_ids),
            AssetEntity.project_id != project_id,
            AssetEntity.status == "active",
        )
        .all()
    )
    cross_project_ids = {int(row.id) for row in cross_project_assets}
    image_rows = (
        db.query(AssetImage)
        .filter(
            AssetImage.asset_id.in_(clean_ids),
            AssetImage.status == "active",
        )
        .order_by(AssetImage.id.desc())
        .all()
    )
    image_by_asset_id: dict[int, str] = {}
    for image in image_rows:
        aid = int(image.asset_id)
        if aid in image_by_asset_id:
            continue
        image_url = str(image.image_url or "").strip()
        if image_url:
            image_by_asset_id[aid] = image_url

    resolved: dict[int, dict[str, str]] = {}
    for asset_id in clean_ids:
        row = by_id.get(asset_id)
        if row is None:
            reason = "cross_project_blocked" if asset_id in cross_project_ids else "not_found"
            logger.warning(
                "[VIDEO_CHARACTER_ASSET_RESOLVE_RESULT] project_id=%s segment_id=%s character_asset_id=%s found=%s asset_type=%s asset_name=%s image_url=%s reason=%s",
                project_id,
                segment_id,
                asset_id,
                False,
                "",
                "",
                "",
                reason,
            )
            continue
        asset_type = str(row.asset_type or "").strip().lower()
        if asset_type != "character":
            logger.warning(
                "[VIDEO_CHARACTER_ASSET_RESOLVE_RESULT] project_id=%s segment_id=%s character_asset_id=%s found=%s asset_type=%s asset_name=%s image_url=%s reason=%s",
                project_id,
                segment_id,
                asset_id,
                False,
                asset_type,
                str(row.name or "").strip(),
                "",
                "wrong_asset_type",
            )
            continue
        image_url = str(image_by_asset_id.get(asset_id) or "").strip()
        if not image_url:
            logger.warning(
                "[VIDEO_CHARACTER_ASSET_RESOLVE_RESULT] project_id=%s segment_id=%s character_asset_id=%s found=%s asset_type=%s asset_name=%s image_url=%s reason=%s",
                project_id,
                segment_id,
                asset_id,
                False,
                asset_type,
                str(row.name or "").strip(),
                "",
                "empty_image_url",
            )
            continue
        resolved[asset_id] = {
            "name": str(row.name or "").strip(),
            "image_url": image_url,
            "asset_type": asset_type,
        }
        logger.info(
            "[VIDEO_CHARACTER_ASSET_RESOLVE_RESULT] project_id=%s segment_id=%s character_asset_id=%s found=%s asset_type=%s asset_name=%s image_url=%s reason=%s",
            project_id,
            segment_id,
            asset_id,
            True,
            asset_type,
            resolved[asset_id]["name"],
            image_url,
            "found",
        )
    return resolved


def download_video(video_url: str, *, project_id: int, segment_id: str) -> Path:
    """Download provider video URL to a local temp .mp4 path."""
    cmd_desc = f"download_video url={video_url}"
    logger.info("[SEGMENT_VIDEO_DOWNLOAD_START] project_id=%s segment_id=%s desc=%s", project_id, segment_id, cmd_desc)
    timeout = httpx.Timeout(connect=15.0, read=180.0, write=30.0, pool=10.0)
    fd, tmp_name = tempfile.mkstemp(suffix=".mp4")
    os.close(fd)
    out = Path(tmp_name)
    try:
        with httpx.Client(timeout=timeout, follow_redirects=True) as client:
            resp = client.get(video_url)
        if resp.status_code >= 400:
            raise RuntimeError(f"HTTP {resp.status_code}")
        out.write_bytes(resp.content)
        logger.info(
            "[SEGMENT_VIDEO_DOWNLOAD_SUCCESS] project_id=%s segment_id=%s source_video_url=%s local_path=%s bytes=%s",
            project_id,
            segment_id,
            video_url,
            str(out.resolve()),
            out.stat().st_size,
        )
        return out
    except Exception as e:
        logger.error(
            "[SEGMENT_VIDEO_DOWNLOAD_FAIL] project_id=%s segment_id=%s source_video_url=%s exception_class=%s err=%s",
            project_id,
            segment_id,
            video_url,
            type(e).__name__,
            str(e),
        )
        try:
            out.unlink(missing_ok=True)
        except OSError:
            pass
        raise


@dataclass
class SegmentVideoAttemptResult:
    segment_id: str
    ok: bool
    video_url: str | None = None
    render_job_id: int | None = None
    error_message: str | None = None


@dataclass
class VideoBatchResult:
    project_id: int
    segments_attempted: int = 0
    segments_succeeded: int = 0
    results: list[SegmentVideoAttemptResult] = field(default_factory=list)
    errors: list[dict[str, Any]] = field(default_factory=list)


class RenderExecutorService:
    def __init__(self, provider: SegmentVideoProvider | None = None):
        self._provider = provider if provider is not None else build_xai_video_provider()
        logger.info("[VIDEO_PROVIDER] Using provider: %s", self._provider.__class__.__name__)

    def _max_workers(self) -> int:
        return max(1, int(settings.SHORT_DRAMA_VIDEO_MAX_CONCURRENT))

    def _provider_label(self) -> str:
        if isinstance(self._provider, MockXAIVideoProvider):
            return "mock"
        if isinstance(self._provider, SeedanceVideoProvider):
            return "seedance"
        if isinstance(self._provider, RailwayXAIVideoProxyProvider):
            return "railway_xai_proxy"
        return "xai"

    def _video_model_name(self) -> str:
        return effective_video_model_for_provider(self._provider_label())

    def _utc_now_iso(self) -> str:
        return datetime.now(timezone.utc).isoformat()

    def _is_s4_video_task_locked(self, project: ShortDramaProject) -> bool:
        return is_processing(project) and current_stage(project) == "s4_video"

    def _job_meta(self, job: RenderJob) -> dict[str, Any]:
        return dict(job.meta_json or {})

    def _set_job_status(
        self,
        db: Session,
        job: RenderJob,
        *,
        status: str,
        progress: int | None = None,
        error: str | None = None,
        video_url: str | None = None,
        request_id: str | None = None,
    ) -> None:
        meta = self._job_meta(job)
        meta["status"] = status
        if progress is not None:
            meta["progress"] = max(0, min(100, int(progress)))
        if request_id is not None:
            meta["request_id"] = request_id
        if status == RenderJobStatus.RUNNING.value and not meta.get("started_at"):
            meta["started_at"] = self._utc_now_iso()
        if status in (RenderJobStatus.COMPLETED.value, RenderJobStatus.FAILED.value):
            meta["completed_at"] = self._utc_now_iso()
        if error:
            meta["error"] = error
        if video_url:
            meta["video_url"] = video_url

        job.status = status
        job.meta_json = meta
        if request_id is not None:
            job.provider_request_id = request_id
        if error:
            job.error_message = error[:4000]
        if video_url:
            job.output_url = video_url
        db.add(job)
        db.commit()
        logger.info(
            "[RENDER_JOB_STATUS_UPDATE] project_id=%s segment_id=%s render_job_id=%s status=%s progress=%s",
            job.project_id,
            job.target_id,
            job.id,
            status,
            meta.get("progress", 0),
        )

    def _process_segment_core(
        self,
        db: Session,
        project_id: int,
        rec: SegmentScriptRecord,
        *,
        chars: list,
        scenes: list,
        products: list,
        project_ar: str | None,
        existing_job_id: int | None = None,
    ) -> SegmentVideoAttemptResult:
        segment_id = rec.segment_id
        job: RenderJob | None = None
        trace: dict[str, Any] = {
            "reference_prepare_ok": False,
            "reference_check_ok": False,
            "duration_check_ok": False,
            "generation_start_ok": False,
            "poll_completed": False,
            "download_ok": False,
            "save_ok": False,
            "writeback_ok": False,
            "final_video_url": "",
            "request_id": "",
            "final_error": "",
        }
        try:
            seg = SegmentScriptSchema.model_validate(rec.script_json)
            rec_script_json_snapshot = dict(rec.script_json) if isinstance(rec.script_json, dict) else {}
            raw_character_asset_ids = _extract_raw_character_asset_ids(seg)
            resolved_character_assets = _resolve_character_assets_by_ids(
                db,
                project_id=project_id,
                segment_id=segment_id,
                raw_character_asset_ids=raw_character_asset_ids,
            )
            plan = build_segment_video_plan(
                seg,
                characters=chars,
                scenes=scenes,
                products=products,
                project_aspect_ratio=project_ar,
                resolved_character_assets=resolved_character_assets,
                project_id=project_id,
            )
            logger.info("[S4_EXECUTION_INPUT] project_id=%s input=%s", project_id, plan.execution_input)
            logger.info(
                "[VIDEO_RENDER_ASSET_REFS] project_id=%s segment_id=%s character_asset_ids=%s character_names=%s reference_image_urls=%s scene_asset_id=%s product_asset_id=%s",
                project_id,
                segment_id,
                list(plan.execution_input.get("character_asset_ids") or []),
                list(plan.execution_input.get("character_names") or []),
                plan.selected_reference_image_urls,
                str(plan.execution_input.get("scene_asset_id") or ""),
                str(plan.execution_input.get("product_asset_id") or ""),
            )
            if list(plan.execution_input.get("character_asset_ids") or []) and not list(plan.execution_input.get("character_names") or []):
                logger.warning(
                    "[VIDEO_CHARACTER_REFERENCE_MISSING] project_id=%s segment_id=%s character_asset_ids=%s reason=%s",
                    project_id,
                    segment_id,
                    list(plan.execution_input.get("character_asset_ids") or []),
                    "resolved_empty_before_provider",
                )
            logger.info(
                "[SEGMENT_REFERENCE_SOURCE_URLS] project_id=%s segment_id=%s urls=%s",
                project_id,
                segment_id,
                plan.selected_reference_image_urls,
            )
            if existing_job_id is not None:
                job = db.query(RenderJob).filter(RenderJob.id == existing_job_id).first()
                if not job:
                    raise ShortDramaVideoInputError(f"Render job {existing_job_id} not found")
                job.provider = self._provider_label()
                job.model = self._video_model_name()
                self._set_job_status(
                    db,
                    job,
                    status=RenderJobStatus.RUNNING.value,
                    progress=10,
                )
                logger.info(
                    "[RENDER_JOB_STARTED] project_id=%s segment_id=%s render_job_id=%s",
                    project_id,
                    segment_id,
                    job.id,
                )
            abs_refs = [absolutize_media_url_for_provider(u) for u in plan.selected_reference_image_urls]
            ref_for_api: list[str] = []
            for src_abs in abs_refs:
                logger.info(
                    "[XAI_REFERENCE_IMAGE_PREPARE_START] project_id=%s segment_id=%s source_url=%s",
                    project_id,
                    segment_id,
                    src_abs,
                )
                try:
                    pub_rel = build_xai_ready_reference_image(project_id, src_abs)
                except Exception as e:
                    logger.error(
                        "[XAI_REFERENCE_IMAGE_PREPARE_FAIL] project_id=%s segment_id=%s source_url=%s exception_class=%s err=%s",
                        project_id,
                        segment_id,
                        src_abs,
                        type(e).__name__,
                        str(e),
                    )
                    raise
                final_u = resolve_xai_reference_public_url(
                    project_id=project_id,
                    segment_id=segment_id,
                    source_url=src_abs,
                    xai_ready_relative_path=pub_rel,
                )
                xai_local = local_path_from_xai_ready_public_url(pub_rel)
                xai_ok = xai_local.is_file()
                xai_sz = xai_local.stat().st_size if xai_ok else 0
                ref_for_api.append(final_u)
                logger.info(
                    "[XAI_REFERENCE_IMAGE_PREPARE_DONE] project_id=%s segment_id=%s source_url=%s "
                    "output_public_url=%s output_absolute_path=%s file_exists=%s file_size=%s",
                    project_id,
                    segment_id,
                    src_abs,
                    pub_rel,
                    str(xai_local.resolve()),
                    xai_ok,
                    xai_sz,
                )
            trace["reference_prepare_ok"] = True
            logger.info(
                "[XAI_REFERENCE_IMAGE_FINAL_URLS] project_id=%s segment_id=%s urls=%s",
                project_id,
                segment_id,
                ref_for_api,
            )

            payload = {
                "render_granularity": plan.render_granularity,
                "future_shot_level_reserved": plan.future_shot_level_reserved,
                "prompt_preview": plan.segment_video_prompt[:500],
                "reference_image_count": len(ref_for_api),
                "duration_seconds": plan.duration_seconds,
                "aspect_ratio": plan.aspect_ratio,
                "resolution": plan.resolution,
                "prompt_budget": plan.prompt_budget,
                "execution_input": plan.execution_input,
            }
            if existing_job_id is not None:
                assert job is not None
                job.input_payload_json = payload
                self._set_job_status(db, job, status=RenderJobStatus.RUNNING.value, progress=20)
            else:
                job = RenderJob(
                    project_id=project_id,
                    target_type=RenderTargetType.SEGMENT.value,
                    target_id=segment_id,
                    provider=self._provider_label(),
                    model=self._video_model_name(),
                    status=RenderJobStatus.QUEUED.value,
                    input_payload_json=payload,
                )
                db.add(job)
                db.commit()
                db.refresh(job)

            model_name = self._video_model_name()
            final_prompt = plan.segment_video_prompt or ""
            final_prompt_len = len(final_prompt)
            logger.info("[VIDEO_PROMPT] %s", final_prompt)
            if final_prompt_len > _HARD_VIDEO_PROMPT_CHARS:
                raise ShortDramaVideoInputError(
                    f"segment {segment_id} video prompt exceeds {_HARD_VIDEO_PROMPT_CHARS} chars"
                )
            shot_count = len(seg.shots or [])
            segment_title = str(getattr(seg, "title", "") or "")
            execution_input = plan.execution_input or {}
            logger.info(
                "[S5_VIDEO_PROMPT_COMPACT] project_id=%s segment_id=%s segment_title=%s shot_count=%s "
                "original_prompt_len=%s final_prompt_len=%s included_product_refs=%s included_character_refs=%s "
                "included_scene_refs=%s truncated=%s prompt_preview=%s",
                project_id,
                segment_id,
                segment_title,
                shot_count,
                int((plan.prompt_budget or {}).get("before_chars", final_prompt_len)),
                final_prompt_len,
                bool((plan.prompt_budget or {}).get("included_product_refs", False)),
                bool((plan.prompt_budget or {}).get("included_character_refs", False)),
                bool((plan.prompt_budget or {}).get("included_scene_refs", False)),
                bool((plan.prompt_budget or {}).get("truncated", False)),
                final_prompt[:200],
            )
            for shot in seg.shots:
                dialogue_text = str(getattr(shot, "spoken_text", "") or getattr(shot, "dialogue", "") or "").strip()
                voiceover_text = str(
                    getattr(shot, "voiceover_text", "")
                    or getattr(shot, "voiceover", "")
                    or getattr(shot, "narration", "")
                    or ""
                ).strip()
                if not dialogue_text and not voiceover_text:
                    continue
                logger.info(
                    "[S4_XAI_VIDEO_PAYLOAD_SPOKEN_CHECK] project_id=%s segment_id=%s shot_id=%s contains_dialogue=%s dialogue_preview=%s contains_voiceover=%s voiceover_preview=%s prompt_chars=%s provider=%s model=%s",
                    project_id,
                    segment_id,
                    str(getattr(shot, "shot_id", "") or ""),
                    bool(dialogue_text and dialogue_text in final_prompt),
                    dialogue_text[:40],
                    bool(voiceover_text and voiceover_text in final_prompt),
                    voiceover_text[:40],
                    final_prompt_len,
                    self._provider_label(),
                    model_name,
                )

            # Release DB connection before long external API calls.
            logger.info(
                "[S4_DB_RELEASE_BEFORE_EXTERNAL_CALL] project_id=%s segment_id=%s action=%s",
                project_id,
                segment_id,
                "submit_reference_segment_video",
            )
            db.close()
            _trace(
                "S4_FINAL_VIDEO_PROMPT_BEFORE_SUBMIT",
                {
                    "project_id": project_id,
                    "segment_id": segment_id,
                    "final_prompt": plan.segment_video_prompt,
                    "prompt_source": "ai_shot_video_prompt",
                    "reference_image_urls": ref_for_api,
                    "provider": self._provider_label(),
                    "model": model_name,
                },
            )
            rid = self._provider.submit_reference_segment_video(
                prompt=plan.segment_video_prompt,
                reference_image_urls=ref_for_api,
                duration_seconds=plan.duration_seconds,
                aspect_ratio=plan.aspect_ratio,
                resolution=plan.resolution,
                project_id=project_id,
                segment_id=segment_id,
            )
            trace["reference_check_ok"] = True
            trace["duration_check_ok"] = True
            trace["generation_start_ok"] = True
            trace["request_id"] = rid
            self._set_job_status(db, job, status=RenderJobStatus.RUNNING.value, progress=45, request_id=rid)

            # Release DB connection while waiting provider completion.
            logger.info(
                "[S4_DB_RELEASE_BEFORE_EXTERNAL_CALL] project_id=%s segment_id=%s action=%s request_id=%s",
                project_id,
                segment_id,
                "complete_segment_video",
                rid,
            )
            db.close()
            result = self._provider.complete_segment_video(
                request_id=rid,
                project_id=project_id,
                segment_id=segment_id,
                duration_seconds=plan.duration_seconds,
            )
            trace["poll_completed"] = True
            self._set_job_status(db, job, status=RenderJobStatus.RUNNING.value, progress=70)
            provider_video_url = (result.provider_video_url or "").strip()
            meta = dict(result.provider_metadata or {})
            storage = str(meta.get("storage") or "").strip().lower()
            use_proxy_r2_url = storage == "r2" and bool(provider_video_url)

            if use_proxy_r2_url:
                url = provider_video_url
                trace["download_ok"] = True
                trace["save_ok"] = True
                trace["final_video_url"] = url
                self._set_job_status(db, job, status=RenderJobStatus.RUNNING.value, progress=90)
                logger.info(
                    "[SEGMENT_VIDEO_SAVED] project_id=%s segment_id=%s absolute_file_path=%s public_video_url=%s "
                    "file_exists=%s file_size=%s storage=r2 skip_download=true skip_r2_upload=true",
                    project_id,
                    segment_id,
                    "",
                    url,
                    False,
                    0,
                )
            else:
                trace["download_ok"] = True
                if provider_video_url:
                    disk_path = download_video(
                        provider_video_url, project_id=project_id, segment_id=segment_id
                    )
                else:
                    fd, tmp_name = tempfile.mkstemp(suffix=".mp4")
                    os.close(fd)
                    disk_path = Path(tmp_name)
                    disk_path.write_bytes(result.video_bytes)
                    logger.info(
                        "[SEGMENT_VIDEO_DOWNLOAD_SUCCESS] project_id=%s segment_id=%s source_video_url=%s local_path=%s bytes=%s",
                        project_id,
                        segment_id,
                        "",
                        str(disk_path.resolve()),
                        disk_path.stat().st_size,
                    )
                ts = int(time.time() * 1000)
                safe_seg = "".join(c if c.isalnum() or c in "-_" else "_" for c in segment_id)[:120]
                r2_key = f"short-drama/videos/{project_id}/segment_{safe_seg}_{ts}.mp4"
                url = upload_file(str(disk_path.resolve()), r2_key)
                trace["save_ok"] = True
                trace["final_video_url"] = url
                self._set_job_status(db, job, status=RenderJobStatus.RUNNING.value, progress=90)
                logger.info(
                    "[SEGMENT_VIDEO_SAVED] project_id=%s segment_id=%s absolute_file_path=%s public_video_url=%s file_exists=%s file_size=%s",
                    project_id,
                    segment_id,
                    str(disk_path.resolve()),
                    url,
                    disk_path.is_file(),
                    disk_path.stat().st_size if disk_path.is_file() else 0,
                )
                try:
                    validate_segment_mp4_path(disk_path, segment_id=segment_id)
                except ShortDramaInvalidSegmentVideoError:
                    try:
                        disk_path.unlink(missing_ok=True)
                    except OSError:
                        pass
                    raise
            job_meta = self._job_meta(job)
            job_meta.update(meta)
            job.meta_json = job_meta
            if meta.get("model"):
                job.model = str(meta.get("model"))

            base = dict(rec_script_json_snapshot)
            base["video_render"] = {
                "video_url": url,
                "render_job_id": job.id,
                "provider": meta.get("provider", self._provider_label()),
                "model": job.model,
                "provider_request_id": rid,
                "meta": meta,
            }
            abs_path = ""
            file_exists = False
            if "disk_path" in locals():
                abs_path = str(disk_path.resolve())
                file_exists = disk_path.is_file()
            logger.info(
                "[SEGMENT_VIDEO_WRITEBACK] project_id=%s segment_id=%s video_url=%s absolute_file_path=%s "
                "file_exists=%s",
                project_id,
                segment_id,
                url,
                abs_path,
                file_exists,
            )
            try:
                rec.script_json = base
                db.add(job)
                db.add(rec)
                db.commit()
                trace["writeback_ok"] = True
                self._set_job_status(
                    db,
                    job,
                    status=RenderJobStatus.COMPLETED.value,
                    progress=100,
                    video_url=url,
                )
                logger.info(
                    "[RENDER_JOB_COMPLETED] project_id=%s segment_id=%s render_job_id=%s video_url=%s",
                    project_id,
                    segment_id,
                    job.id,
                    url,
                )
            except Exception as e:
                logger.error(
                    "[SEGMENT_VIDEO_WRITEBACK_FAIL] project_id=%s segment_id=%s video_url=%s exception_class=%s err=%s",
                    project_id,
                    segment_id,
                    url,
                    type(e).__name__,
                    str(e),
                )
                raise
            return SegmentVideoAttemptResult(
                segment_id=segment_id,
                ok=True,
                video_url=url,
                render_job_id=job.id,
            )
            
        except Exception as e:
            err_msg = str(e)
            trace["final_error"] = err_msg
            jid = getattr(job, "id", None) if job is not None else None
            try:
                db.rollback()
            except Exception:
                pass
            if jid:
                try:
                    fj = db.query(RenderJob).filter(RenderJob.id == jid).first()
                    if fj:
                        self._set_job_status(
                            db,
                            fj,
                            status=RenderJobStatus.FAILED.value,
                            progress=100,
                            error=err_msg,
                        )
                        logger.error(
                            "[RENDER_JOB_FAILED] project_id=%s segment_id=%s render_job_id=%s error=%s",
                            project_id,
                            segment_id,
                            jid,
                            err_msg,
                        )
                except Exception:
                    logger.exception(
                        "RENDER_JOB_FAIL_PERSIST project_id=%s segment_id=%s render_job_id=%s",
                        project_id,
                        segment_id,
                        jid,
                    )
            logger.warning(
                "SEGMENT_VIDEO_FAIL project_id=%s segment_id=%s render_job_id=%s provider=%s model=%s "
                "request_id=%s err=%s",
                project_id,
                segment_id,
                jid,
                self._provider_label(),
                self._video_model_name(),
                getattr(job, "provider_request_id", None) if job else None,
                err_msg,
            )
            return SegmentVideoAttemptResult(
                segment_id=segment_id,
                ok=False,
                render_job_id=jid,
                error_message=err_msg,
            )
        finally:
            try:
                if "disk_path" in locals():
                    disk_path.unlink(missing_ok=True)
            except OSError:
                pass
            logger.info(
                "[SEGMENT_VIDEO_TRACE_SUMMARY] project_id=%s segment_id=%s reference_prepare_ok=%s "
                "reference_check_ok=%s duration_check_ok=%s generation_start_ok=%s poll_completed=%s "
                "download_ok=%s save_ok=%s writeback_ok=%s final_video_url=%s request_id=%s final_error=%s",
                project_id,
                segment_id,
                trace["reference_prepare_ok"],
                trace["reference_check_ok"],
                trace["duration_check_ok"],
                trace["generation_start_ok"],
                trace["poll_completed"],
                trace["download_ok"],
                trace["save_ok"],
                trace["writeback_ok"],
                trace["final_video_url"],
                trace["request_id"],
                trace["final_error"],
            )

    def enqueue_single_segment_video(self, db: Session, project_id: int, segment_id: str) -> RenderJob:
        project = orchestrator.get_project(db, project_id)
        orchestrator.recover_failed_project_status(db, project)
        st = str(project.status or "")
        if not self._is_s4_video_task_locked(project) and st in ("assets_ready", "segments_generated"):
            orchestrator.begin_video_render(db, project)
            db.commit()
        elif not self._is_s4_video_task_locked(project) and st == ProjectStatus.VIDEO_SEGMENTS_READY.value:
            project.status = ProjectStatus.VIDEO_RENDERING.value
            db.add(project)
            db.commit()

        rec = (
            db.query(SegmentScriptRecord)
            .filter(
                SegmentScriptRecord.project_id == project_id,
                SegmentScriptRecord.segment_id == segment_id,
            )
            .first()
        )
        if not rec:
            raise ShortDramaVideoInputError(f"Segment {segment_id!r} not found for project {project_id}")

        job = RenderJob(
            project_id=project_id,
            target_type=RenderTargetType.SEGMENT.value,
            target_id=segment_id,
            provider=self._provider_label(),
            model=self._video_model_name(),
            status=RenderJobStatus.QUEUED.value,
            input_payload_json={"project_id": project_id, "segment_id": segment_id},
            meta_json={"progress": 0, "status": RenderJobStatus.QUEUED.value, "created_at": self._utc_now_iso()},
        )
        db.add(job)
        db.commit()
        db.refresh(job)
        logger.info(
            "[RENDER_JOB_CREATED] project_id=%s segment_id=%s render_job_id=%s status=%s",
            project_id,
            segment_id,
            job.id,
            job.status,
        )
        return job

    def run_single_segment_video_job(self, project_id: int, segment_id: str, render_job_id: int) -> None:
        final_status = RenderJobStatus.FAILED.value
        final_video_url = ""
        final_error = ""
        db = SessionLocal()
        try:
            rec = (
                db.query(SegmentScriptRecord)
                .filter(
                    SegmentScriptRecord.project_id == project_id,
                    SegmentScriptRecord.segment_id == segment_id,
                )
                .first()
            )
            if not rec:
                raise ShortDramaVideoInputError(f"Segment {segment_id!r} not found for project {project_id}")
            chars, scenes, products = list_asset_rows(db, project_id)
            project = orchestrator.get_project(db, project_id)
            result = self._process_segment_core(
                db,
                project_id,
                rec,
                chars=chars,
                scenes=scenes,
                products=products,
                project_ar=project.aspect_ratio,
                existing_job_id=render_job_id,
            )
            if result.ok:
                proj2 = orchestrator.get_project(db, project_id)
                orchestrator.mark_video_segments_ready_if_complete(
                    db,
                    proj2,
                    all_segment_videos_present=all_segment_scripts_have_video(db, project_id),
                )
                db.commit()
                final_status = RenderJobStatus.COMPLETED.value
                final_video_url = result.video_url or ""
            else:
                final_status = RenderJobStatus.FAILED.value
                final_error = result.error_message or "segment render failed"
                job_failed = db.query(RenderJob).filter(RenderJob.id == render_job_id).first()
                if job_failed and str(job_failed.status or "").lower() not in (
                    RenderJobStatus.FAILED.value,
                    RenderJobStatus.COMPLETED.value,
                ):
                    self._set_job_status(
                        db,
                        job_failed,
                        status=RenderJobStatus.FAILED.value,
                        progress=100,
                        error=final_error,
                    )
                    logger.error(
                        "[RENDER_JOB_FAILED] project_id=%s segment_id=%s render_job_id=%s error=%s",
                        project_id,
                        segment_id,
                        render_job_id,
                        final_error,
                    )
        except Exception as e:
            final_error = str(e)
            try:
                db.rollback()
            except Exception:
                pass
            job = db.query(RenderJob).filter(RenderJob.id == render_job_id).first()
            if job:
                self._set_job_status(
                    db,
                    job,
                    status=RenderJobStatus.FAILED.value,
                    progress=100,
                    error=final_error,
                )
                logger.error(
                    "[RENDER_JOB_FAILED] project_id=%s segment_id=%s render_job_id=%s error=%s",
                    project_id,
                    segment_id,
                    render_job_id,
                    final_error,
                )
        finally:
            logger.info(
                "[RENDER_JOB_TRACE_SUMMARY] project_id=%s segment_id=%s render_job_id=%s final_status=%s video_url=%s error=%s",
                project_id,
                segment_id,
                render_job_id,
                final_status,
                final_video_url,
                final_error,
            )
            db.close()

    def _thread_process_segment(
        self,
        project_id: int,
        record_id: int,
    ) -> SegmentVideoAttemptResult:
        db = SessionLocal()
        try:
            rec = db.query(SegmentScriptRecord).filter(SegmentScriptRecord.id == record_id).first()
            if not rec:
                return SegmentVideoAttemptResult(segment_id="?", ok=False, error_message="record not found")
            chars, scenes, products = list_asset_rows(db, project_id)
            proj = db.query(ShortDramaProject).filter(ShortDramaProject.id == project_id).first()
            project_ar = proj.aspect_ratio if proj else None
            return self._process_segment_core(
                db,
                project_id,
                rec,
                chars=chars,
                scenes=scenes,
                products=products,
                project_ar=project_ar,
            )
        finally:
            db.close()

    def generate_segment_videos(self, db: Session, project_id: int) -> VideoBatchResult:
        project = orchestrator.get_project(db, project_id)
        records = list_segment_scripts(db, project_id)
        if not records:
            raise ShortDramaVideoInputError("No segment scripts for project")

        if not self._is_s4_video_task_locked(project):
            orchestrator.begin_video_render(db, project)
            db.commit()

        chars, scenes, products = list_asset_rows(db, project_id)
        project_ar = project.aspect_ratio
        out = VideoBatchResult(project_id=project_id)
        workers = self._max_workers()

        if workers <= 1:
            for rec in records:
                out.segments_attempted += 1
                r = self._process_segment_core(
                    db,
                    project_id,
                    rec,
                    chars=chars,
                    scenes=scenes,
                    products=products,
                    project_ar=project_ar,
                )
                out.results.append(r)
                if r.ok:
                    out.segments_succeeded += 1
                else:
                    out.errors.append(
                        {
                            "segment_id": r.segment_id,
                            "render_job_id": r.render_job_id,
                            "error": r.error_message,
                        }
                    )
        else:
            out.segments_attempted = len(records)
            with ThreadPoolExecutor(max_workers=min(workers, len(records))) as pool:
                futs = {
                    pool.submit(self._thread_process_segment, project_id, rec.id): rec.segment_id
                    for rec in records
                }
                for fut in as_completed(futs):
                    r = fut.result()
                    out.results.append(r)
                    if r.ok:
                        out.segments_succeeded += 1
                    else:
                        out.errors.append(
                            {
                                "segment_id": r.segment_id,
                                "render_job_id": r.render_job_id,
                                "error": r.error_message,
                            }
                        )

        project2 = orchestrator.get_project(db, project_id)
        n = len(records)
        all_segments_succeeded = n > 0 and out.segments_succeeded == n
        orchestrator.complete_segment_video_batch(
            db,
            project2,
            had_attempts=out.segments_attempted > 0,
            any_success=out.segments_succeeded > 0,
            all_failed=out.segments_attempted > 0 and out.segments_succeeded == 0,
            all_segments_succeeded=all_segments_succeeded,
        )
        db.commit()
        return out

    def generate_single_segment_video(
        self,
        db: Session,
        project_id: int,
        segment_id: str,
    ) -> SegmentVideoAttemptResult:
        project = orchestrator.get_project(db, project_id)
        orchestrator.recover_failed_project_status(db, project)
        st = project.status
        if not self._is_s4_video_task_locked(project) and st in ("assets_ready", "segments_generated"):
            orchestrator.begin_video_render(db, project)
            db.commit()
        elif not self._is_s4_video_task_locked(project) and st == ProjectStatus.VIDEO_SEGMENTS_READY.value:
            # Regenerating one segment after all were ready: re-enter segment-rendering phase for honest UI.
            project.status = ProjectStatus.VIDEO_RENDERING.value
            db.add(project)
            db.commit()

        rec = (
            db.query(SegmentScriptRecord)
            .filter(
                SegmentScriptRecord.project_id == project_id,
                SegmentScriptRecord.segment_id == segment_id,
            )
            .first()
        )
        if not rec:
            raise ShortDramaVideoInputError(f"Segment {segment_id!r} not found for project {project_id}")

        chars, scenes, products = list_asset_rows(db, project_id)
        project = orchestrator.get_project(db, project_id)
        result = self._process_segment_core(
            db,
            project_id,
            rec,
            chars=chars,
            scenes=scenes,
            products=products,
            project_ar=project.aspect_ratio,
        )
        if result.ok:
            proj2 = orchestrator.get_project(db, project_id)
            orchestrator.mark_video_segments_ready_if_complete(
                db,
                proj2,
                all_segment_videos_present=all_segment_scripts_have_video(db, project_id),
            )
            db.commit()
        return result


render_executor_service = RenderExecutorService()
