"""Overview export: zip bundles (videos / full)."""

import logging

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from ...database import get_db
from ..exceptions import ShortDramaVideoSaveError
from ..models import ShortDramaProject
from ..services.overview_export_zip import build_all_zip_bytes, build_videos_zip_bytes
from ..services.read_models import latest_story_blueprint

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/{project_id}/export/videos")
async def export_videos_zip(project_id: int, db: Session = Depends(get_db)):
    logger.info("OVERVIEW_EXPORT_VIDEOS_START project_id=%s export_type=video_bundle", project_id)
    project = db.query(ShortDramaProject).filter(ShortDramaProject.id == project_id).first()
    if not project:
        logger.warning("OVERVIEW_EXPORT_VIDEOS_FAILED project_id=%s reason=not_found", project_id)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    try:
        data, filename = build_videos_zip_bytes(db, project_id)
    except ValueError as e:
        if str(e) == "incomplete_videos_pack":
            logger.info(
                "OVERVIEW_EXPORT_VIDEOS_FAILED project_id=%s reason=incomplete_videos",
                project_id,
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="仍有片段未生成，暂不可导出视频包",
            ) from e
        if str(e) == "project not found":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found") from e
        logger.exception("OVERVIEW_EXPORT_VIDEOS_FAILED project_id=%s err=%s", project_id, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="导出失败，请稍后重试",
        ) from e
    except ShortDramaVideoSaveError as e:
        logger.exception(
            "OVERVIEW_EXPORT_VIDEOS_FAILED project_id=%s export_type=video_bundle err_class=%s err=%s",
            project_id,
            type(e).__name__,
            e,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e) or "导出失败，请稍后重试",
        ) from e
    except Exception as e:
        logger.exception("OVERVIEW_EXPORT_VIDEOS_FAILED project_id=%s err=%s", project_id, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="导出失败，请稍后重试",
        ) from e

    logger.info(
        "OVERVIEW_EXPORT_VIDEOS_SUCCESS project_id=%s export_type=video_bundle filename=%s bytes=%s",
        project_id,
        filename,
        len(data),
    )
    return Response(
        content=data,
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )


@router.get("/{project_id}/export/all")
async def export_all_zip(project_id: int, db: Session = Depends(get_db)):
    logger.info("OVERVIEW_EXPORT_ALL_START project_id=%s export_type=export_all", project_id)
    project = db.query(ShortDramaProject).filter(ShortDramaProject.id == project_id).first()
    if not project:
        logger.warning("OVERVIEW_EXPORT_ALL_FAILED project_id=%s reason=not_found", project_id)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    sb = latest_story_blueprint(db, project_id)
    blueprint_json = sb.blueprint_json if sb and isinstance(sb.blueprint_json, dict) else None

    try:
        data, filename = build_all_zip_bytes(db, project_id, blueprint_json)
    except ValueError as e:
        if str(e) == "incomplete_videos_all":
            logger.info(
                "OVERVIEW_EXPORT_ALL_FAILED project_id=%s reason=incomplete_videos",
                project_id,
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="当前视频尚未全部生成，暂不可一键导出",
            ) from e
        if str(e) == "project not found":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found") from e
        logger.exception("OVERVIEW_EXPORT_ALL_FAILED project_id=%s err=%s", project_id, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="导出失败，请稍后重试",
        ) from e
    except ShortDramaVideoSaveError as e:
        logger.exception(
            "OVERVIEW_EXPORT_ALL_FAILED project_id=%s export_type=export_all err_class=%s err=%s",
            project_id,
            type(e).__name__,
            e,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e) or "导出失败，请稍后重试",
        ) from e
    except Exception as e:
        logger.exception("OVERVIEW_EXPORT_ALL_FAILED project_id=%s err=%s", project_id, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="导出失败，请稍后重试",
        ) from e

    logger.info(
        "OVERVIEW_EXPORT_ALL_SUCCESS project_id=%s export_type=export_all filename=%s bytes=%s",
        project_id,
        filename,
        len(data),
    )
    return Response(
        content=data,
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )
