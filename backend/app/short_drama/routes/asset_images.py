from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ...database import SessionLocal, get_db
from ..exceptions import ShortDramaImageProviderError, ShortDramaImageSaveError
from ..http_errors import raise_short_drama_http
from ..models import CharacterAsset, ProductAsset, SceneAsset, ShortDramaProject
from ..schemas.asset import (
    AssetImageBatchResponse,
    GenerateAssetImagesRequest,
    RegenerateOneAssetImageRequest,
    RegenerateOneAssetImageResponse,
)
from ..services.project_state_service import STEP_3, mark_step_completed, propagate_downstream_stale, update_last_active_step
from ..services.asset_image_service import asset_image_service
from ..services.asset_library_service import asset_library_service
from ..services.workflow_orchestrator import ASSET_IMAGE_RENDER_ALLOWED_STATUSES, orchestrator
from ..services.project_task_guard import (
    acquire_project_task_lock,
    current_stage,
    finalize_s3_images_task,
    recover_stale_processing_status_if_possible,
)
from ..utils.credit_guards import (
    charge_batch_asset_images,
    charge_image_asset_credit,
    require_image_asset_credits,
)
from ...services.credit_service import count_assets_missing_images
from ..utils.enums import ProjectStatus, WorkflowStep

logger = logging.getLogger(__name__)

router = APIRouter()


def _detail_to_str(detail: Any) -> str:
    if isinstance(detail, str):
        return detail
    return str(detail)


def _asset_image_generate_preflight(
    db: Session, project_id: int
) -> tuple[ShortDramaProject | None, dict[str, int]]:
    proj = db.query(ShortDramaProject).filter(ShortDramaProject.id == project_id).first()
    if proj is None:
        return None, {}
    chars = db.query(CharacterAsset).filter(CharacterAsset.project_id == project_id).all()
    scenes = db.query(SceneAsset).filter(SceneAsset.project_id == project_id).all()
    prods = db.query(ProductAsset).filter(ProductAsset.project_id == project_id).all()

    def _filled_image_url_count(rows: list[Any]) -> int:
        return sum(1 for r in rows if (getattr(r, "image_url", None) or "").strip())

    return proj, {
        "character_count": len(chars),
        "scene_count": len(scenes),
        "product_count": len(prods),
        "image_url_filled": _filled_image_url_count(chars)
        + _filled_image_url_count(scenes)
        + _filled_image_url_count(prods),
    }


def _log_api_blocked_asset_images_generate(
    *,
    project_id: int,
    project_status: str,
    reason: str,
    detail: str,
    meta: dict[str, int],
    forbid_repeat: bool,
    prereq_insufficient: bool,
) -> None:
    logger.warning(
        "[API_BLOCKED] POST /assets/images/generate project_id=%s status=%s reason=%s detail=%s "
        "character_count=%s scene_count=%s product_count=%s image_url_filled=%s forbid_repeat=%s prereq_insufficient=%s",
        project_id,
        project_status,
        reason,
        detail,
        meta.get("character_count", 0),
        meta.get("scene_count", 0),
        meta.get("product_count", 0),
        meta.get("image_url_filled", 0),
        forbid_repeat,
        prereq_insufficient,
    )


def _to_response(r) -> AssetImageBatchResponse:
    return AssetImageBatchResponse(
        project_id=r.project_id,
        characters_attempted=r.characters_attempted,
        characters_succeeded=r.characters_succeeded,
        scenes_attempted=r.scenes_attempted,
        scenes_succeeded=r.scenes_succeeded,
        products_attempted=r.products_attempted,
        products_succeeded=r.products_succeeded,
        errors=r.errors,
    )


@router.post("/generate", response_model=AssetImageBatchResponse)
async def generate_all_asset_images(
    body: GenerateAssetImagesRequest,
    db: Session = Depends(get_db),
):
    """同步执行整批出图并 commit；200 表示本请求内批次已结束且状态已落库（非「仅入队」）。

    单张失败记入 errors，不中断其它资产；若全部失败，项目状态回退为 asset_specs_generated 以便重试。
    """
    pid = body.project_id
    proj, meta = _asset_image_generate_preflight(db, pid)
    lock_acquired = False
    batch_result = None
    batch_finalize_error: tuple[str, str] | None = None
    if proj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    if proj.status == ProjectStatus.FAILED.value:
        orchestrator.recover_failed_project_status(db, proj)
        db.commit()
        db.refresh(proj)
    recover_stale_processing_status_if_possible(db, proj)
    proj = db.query(ShortDramaProject).filter(ShortDramaProject.id == pid).first()
    if proj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    st = proj.status or ""
    allowed = st in ASSET_IMAGE_RENDER_ALLOWED_STATUSES
    prereq_insufficient = st in ("created", "product_parsed", "story_generated")
    forbid_repeat = st in ("video_rendering", "video_segments_ready", "completed")

    try:
        runtime_now = dict((proj.step_status or {}).get("_runtime") or {})
        logger.info(
            "[STEP_ALLOWED_CHECK_BEFORE_LOCK] project_id=%s step=%s current_status=%s allowed_statuses=%s",
            pid,
            "render_assets",
            st,
            sorted(ASSET_IMAGE_RENDER_ALLOWED_STATUSES),
        )
        orchestrator.assert_step_allowed(db, proj, WorkflowStep.RENDER_ASSETS)
        acquire_project_task_lock(db, proj, stage="s3_images")
        lock_acquired = True
        pending_images = count_assets_missing_images(db, pid)
        require_image_asset_credits(db, pid, pending_images)
        import time

        batch_key = str(int(time.time() * 1000))
        batch_result = asset_image_service.generate_all_asset_images(db, pid)
        charge_batch_asset_images(
            db,
            pid,
            batch_key=batch_key,
            characters_succeeded=batch_result.characters_succeeded,
            scenes_succeeded=batch_result.scenes_succeeded,
            products_succeeded=batch_result.products_succeeded,
        )
        # Legacy image generation updates Character/Scene/ProductAsset.image_url;
        # sync them to unified asset library as Step3 data source.
        asset_library_service.sync_legacy_assets_for_project(db, pid)
        db.commit()
        return _to_response(batch_result)
    except HTTPException as he:
        if lock_acquired:
            et = "storage_or_db_error" if he.status_code >= 500 else "request_conflict"
            if isinstance(he.detail, dict):
                et = str(he.detail.get("error_type") or et)
            batch_finalize_error = (et, str(he.detail))
        if he.status_code == status.HTTP_409_CONFLICT:
            detail_s = _detail_to_str(he.detail)
            prev_status = str(runtime_now.get("previous_status") or "")
            stage_now = current_stage(proj)
            task_running = bool(runtime_now.get("task_running", False))
            if st == "failed":
                reason = "project_failed"
            elif not allowed:
                if prereq_insufficient:
                    reason = "prerequisite_insufficient"
                elif forbid_repeat:
                    reason = "pipeline_past_asset_images"
                else:
                    reason = "invalid_status_for_asset_render"
            else:
                reason = "conflict"
            _log_api_blocked_asset_images_generate(
                project_id=pid,
                project_status=st,
                reason=reason,
                detail=detail_s,
                meta=meta,
                forbid_repeat=forbid_repeat,
                prereq_insufficient=prereq_insufficient,
            )
            logger.warning(
                "[STEP_ASSERT_DENIED_CONTEXT] project_id=%s current_status=%s previous_status=%s current_stage=%s task_running=%s allowed_statuses=%s",
                pid,
                st,
                prev_status,
                stage_now,
                task_running,
                sorted(ASSET_IMAGE_RENDER_ALLOWED_STATUSES),
            )
        raise
    except (ShortDramaImageProviderError, ShortDramaImageSaveError) as e:
        if lock_acquired:
            et = "storage_or_db_error" if isinstance(e, ShortDramaImageSaveError) else "image_generation_failed"
            batch_finalize_error = (et, str(e))
        raise_short_drama_http(e)
    except Exception:
        logger.exception("Asset image generation unexpected error project_id=%s", pid)
        if lock_acquired:
            batch_finalize_error = (
                "asset_image_generation_failed",
                "资产图片生成失败，请稍后重试。",
            )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"error": "asset_image_generation_failed", "message": "资产图片生成失败，请稍后重试。"},
        )
    finally:
        if lock_acquired:
            fin_db = SessionLocal()
            try:
                if batch_finalize_error is not None:
                    finalize_s3_images_task(
                        fin_db,
                        pid,
                        error_type_value=batch_finalize_error[0],
                        message=batch_finalize_error[1],
                    )
                elif batch_result is not None:
                    total_attempts = (
                        batch_result.characters_attempted
                        + batch_result.scenes_attempted
                        + batch_result.products_attempted
                    )
                    total_succeeded = (
                        batch_result.characters_succeeded
                        + batch_result.scenes_succeeded
                        + batch_result.products_succeeded
                    )
                    finalize_s3_images_task(
                        fin_db,
                        pid,
                        total_attempts=total_attempts,
                        total_succeeded=total_succeeded,
                    )
            except Exception:
                logger.exception(
                    "finalize_s3_images_task failed project_id=%s",
                    pid,
                )
            finally:
                fin_db.close()


@router.post("/generate/characters", response_model=AssetImageBatchResponse)
async def generate_character_images_only(
    body: GenerateAssetImagesRequest,
    db: Session = Depends(get_db),
):
    try:
        from ..services.read_models import list_asset_rows

        chars, _, _ = list_asset_rows(db, body.project_id)
        pending = sum(1 for c in chars if not str(c.image_url or "").strip())
        require_image_asset_credits(db, body.project_id, pending)
        import time

        batch_key = str(int(time.time() * 1000))
        result = asset_image_service.generate_character_images(db, body.project_id)
        charge_batch_asset_images(
            db,
            body.project_id,
            batch_key=batch_key,
            characters_succeeded=result.characters_succeeded,
            scenes_succeeded=0,
            products_succeeded=0,
        )
        return _to_response(result)
    except (ShortDramaImageProviderError, ShortDramaImageSaveError) as e:
        raise_short_drama_http(e)
    except Exception:
        logger.exception("Character asset image generation unexpected error project_id=%s", body.project_id)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"error": "asset_image_generation_failed", "message": "资产图片生成失败，请稍后重试。"},
        )


@router.post("/generate/scenes", response_model=AssetImageBatchResponse)
async def generate_scene_images_only(
    body: GenerateAssetImagesRequest,
    db: Session = Depends(get_db),
):
    try:
        from ..services.read_models import list_asset_rows
        import time

        _, scenes, _ = list_asset_rows(db, body.project_id)
        pending = sum(1 for s in scenes if not str(s.image_url or "").strip())
        require_image_asset_credits(db, body.project_id, pending)
        batch_key = str(int(time.time() * 1000))
        result = asset_image_service.generate_scene_images(db, body.project_id)
        charge_batch_asset_images(
            db,
            body.project_id,
            batch_key=batch_key,
            characters_succeeded=0,
            scenes_succeeded=result.scenes_succeeded,
            products_succeeded=0,
        )
        return _to_response(result)
    except (ShortDramaImageProviderError, ShortDramaImageSaveError) as e:
        raise_short_drama_http(e)
    except Exception:
        logger.exception("Scene asset image generation unexpected error project_id=%s", body.project_id)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"error": "asset_image_generation_failed", "message": "资产图片生成失败，请稍后重试。"},
        )


@router.post("/generate/products", response_model=AssetImageBatchResponse)
async def generate_product_images_only(
    body: GenerateAssetImagesRequest,
    db: Session = Depends(get_db),
):
    try:
        from ..services.read_models import list_asset_rows
        import time

        _, _, products = list_asset_rows(db, body.project_id)
        pending = sum(1 for p in products if not str(p.image_url or "").strip())
        require_image_asset_credits(db, body.project_id, pending)
        batch_key = str(int(time.time() * 1000))
        result = asset_image_service.generate_product_images(db, body.project_id)
        charge_batch_asset_images(
            db,
            body.project_id,
            batch_key=batch_key,
            characters_succeeded=0,
            scenes_succeeded=0,
            products_succeeded=result.products_succeeded,
        )
        return _to_response(result)
    except (ShortDramaImageProviderError, ShortDramaImageSaveError) as e:
        raise_short_drama_http(e)
    except Exception:
        logger.exception("Product asset image generation unexpected error project_id=%s", body.project_id)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"error": "asset_image_generation_failed", "message": "资产图片生成失败，请稍后重试。"},
        )


@router.post("/regenerate-one", response_model=RegenerateOneAssetImageResponse)
async def regenerate_one_asset_image(
    body: RegenerateOneAssetImageRequest,
    db: Session = Depends(get_db),
):
    try:
        import time

        require_image_asset_credits(db, body.project_id, 1)
        attempt_id = str(int(time.time() * 1000))
        image_url = asset_image_service.regenerate_one_asset_image(
            db,
            project_id=body.project_id,
            asset_type=body.asset_type,
            asset_id=body.asset_id,
        )
        charge_image_asset_credit(
            db,
            project_id=body.project_id,
            asset_id=body.asset_id,
            attempt_id=attempt_id,
        )
        project = db.query(ShortDramaProject).filter(ShortDramaProject.id == body.project_id).first()
        if project is None:
            raise HTTPException(status_code=404, detail="Project not found")
        mark_step_completed(project, STEP_3)
        propagate_downstream_stale(project, STEP_3)
        update_last_active_step(project, STEP_3)
        db.add(project)
        db.commit()
        return RegenerateOneAssetImageResponse(
            project_id=body.project_id,
            asset_type=body.asset_type,
            asset_id=body.asset_id,
            image_url=image_url,
            stale_marked_step_4=True,
        )
    except (ShortDramaImageProviderError, ShortDramaImageSaveError) as e:
        raise_short_drama_http(e)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        logger.exception("Single asset image regeneration unexpected error project_id=%s", body.project_id)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"error": "asset_image_generation_failed", "message": "资产图片生成失败，请稍后重试。"},
        )
