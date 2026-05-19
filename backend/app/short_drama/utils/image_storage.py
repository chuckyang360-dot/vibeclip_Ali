from __future__ import annotations

import logging
import os
import time
from pathlib import Path

from ...utils.r2_storage import upload_file
from ..exceptions import ShortDramaImageSaveError
from ..providers.generated_image import GeneratedImage

logger = logging.getLogger(__name__)


def short_drama_generated_root() -> Path:
    """backend/generated/short_drama_assets (relative to backend package root)."""
    # app/short_drama/utils/image_storage.py -> parents[3] = backend/
    backend_dir = Path(__file__).resolve().parents[3]
    return backend_dir / "generated" / "short_drama_assets"


def ensure_project_dir(project_id: int) -> Path:
    d = short_drama_generated_root() / str(project_id)
    d.mkdir(parents=True, exist_ok=True)
    return d


def public_url_path(project_id: int, filename: str) -> str:
    """Path served via StaticFiles mount /static/short-drama-assets."""
    return f"/static/short-drama-assets/{project_id}/{filename}"


def persist_generated_image_url(
    gen: GeneratedImage,
    *,
    project_id: int,
    asset_type: str,
    asset_id: int,
) -> str:
    """Return remote URL from provider when present; otherwise write bytes to storage."""
    remote = str(gen.remote_url or "").strip()
    if remote:
        return remote
    ext = mime_to_ext(gen.mime_type)
    return save_image_bytes(
        project_id=project_id,
        asset_type=asset_type,
        asset_id=asset_id,
        data=gen.data,
        ext=ext,
    )


def save_image_bytes(
    *,
    project_id: int,
    asset_type: str,
    asset_id: int,
    data: bytes,
    ext: str,
) -> str:
    """Write file and return public URL (prefer R2 when configured)."""
    ext = ext.lstrip(".") or "png"
    ts = int(time.time() * 1000)
    fname = f"{asset_type}_{asset_id}_{ts}.{ext}"
    proj = ensure_project_dir(project_id)
    path = proj / fname
    try:
        path.write_bytes(data)
    except OSError as e:
        logger.exception("SHORT_DRAMA_IMAGE_SAVE_FAIL project_id=%s path=%s", project_id, path)
        raise ShortDramaImageSaveError(f"Failed to save image: {e}") from e
    r2_bucket = (os.getenv("R2_BUCKET_NAME") or "").strip()
    r2_base = (os.getenv("R2_PUBLIC_BASE_URL") or "").strip()
    if r2_bucket and r2_base:
        key = f"short-drama-assets/{project_id}/{fname}"
        try:
            r2_url = upload_file(str(path.resolve()), key)
            logger.info(
                "[SHORT_DRAMA_ASSET_R2_UPLOAD_SUCCESS] project_id=%s key=%s url=%s",
                project_id,
                key,
                r2_url,
            )
            return r2_url
        except Exception as e:  # noqa: BLE001 - keep local fallback for dev resilience.
            logger.exception(
                "[SHORT_DRAMA_ASSET_R2_UPLOAD_FAIL] project_id=%s key=%s err=%s",
                project_id,
                key,
                str(e),
            )
            raise ShortDramaImageSaveError(f"Failed to upload asset image to R2: {e}") from e
    return public_url_path(project_id, fname)


def mime_to_ext(mime: str) -> str:
    m = (mime or "").lower()
    if "png" in m:
        return "png"
    if "jpeg" in m or "jpg" in m:
        return "jpg"
    if "webp" in m:
        return "webp"
    return "png"
