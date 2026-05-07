"""Local filesystem storage for generated segment/final videos."""

from __future__ import annotations

import logging
import os
import tempfile
import time
from pathlib import Path
from urllib.parse import unquote, urlparse

import httpx

from ..exceptions import ShortDramaVideoSaveError
from .public_static_url import build_public_static_url

logger = logging.getLogger(__name__)
_SHORT_DRAMA_STATIC_VIDEO_PREFIX = "/static/short-drama-videos/"
_SHORT_DRAMA_R2_VIDEO_PATH_MARKER = "/short-drama/videos/"


def short_drama_videos_root() -> Path:
    """backend/generated/short_drama_videos"""
    backend_dir = Path(__file__).resolve().parents[3]
    return backend_dir / "generated" / "short_drama_videos"


def ensure_video_project_dir(project_id: int) -> Path:
    d = short_drama_videos_root() / str(project_id)
    d.mkdir(parents=True, exist_ok=True)
    return d


def public_video_url_path(project_id: int, filename: str) -> str:
    return f"{_SHORT_DRAMA_STATIC_VIDEO_PREFIX}{project_id}/{filename}"


def save_segment_video_bytes(*, project_id: int, segment_id: str, data: bytes) -> str:
    ts = int(time.time() * 1000)
    safe_seg = "".join(c if c.isalnum() or c in "-_" else "_" for c in segment_id)[:120]
    fname = f"segment_{safe_seg}_{ts}.mp4"
    proj = ensure_video_project_dir(project_id)
    path = proj / fname
    try:
        path.write_bytes(data)
    except OSError as e:
        logger.error(
            "[SEGMENT_VIDEO_SAVE_FAIL] project_id=%s segment_id=%s absolute_file_path=%s exception_class=%s err=%s",
            project_id,
            segment_id,
            str(path.resolve()),
            type(e).__name__,
            str(e),
        )
        logger.exception("SHORT_DRAMA_VIDEO_SAVE_FAIL project_id=%s path=%s", project_id, path)
        raise ShortDramaVideoSaveError(f"Failed to save segment video: {e}") from e
    public = public_video_url_path(project_id, fname)
    abs_path = str(path.resolve())
    exists = path.is_file()
    fsize = path.stat().st_size if exists else 0
    logger.info(
        "[SEGMENT_VIDEO_SAVED] project_id=%s segment_id=%s absolute_file_path=%s public_video_url=%s "
        "file_exists=%s file_size=%s",
        project_id,
        segment_id,
        abs_path,
        public,
        exists,
        fsize,
    )
    return public


def save_final_video_bytes(*, project_id: int, data: bytes) -> str:
    ts = int(time.time() * 1000)
    fname = f"final_{project_id}_{ts}.mp4"
    proj = ensure_video_project_dir(project_id)
    path = proj / fname
    try:
        path.write_bytes(data)
    except OSError as e:
        logger.exception("SHORT_DRAMA_FINAL_SAVE_FAIL project_id=%s path=%s", project_id, path)
        raise ShortDramaVideoSaveError(f"Failed to save final video: {e}") from e
    return public_video_url_path(project_id, fname)


def local_path_from_public_video_url(public_url: str) -> Path:
    """Map /static/short-drama-videos/{project_id}/file.mp4 to filesystem path."""
    u = public_url.strip()
    if u.startswith("http://") or u.startswith("https://"):
        parsed = urlparse(u)
        u = unquote(parsed.path or "")
    else:
        u = unquote(u)
    if not u.startswith(_SHORT_DRAMA_STATIC_VIDEO_PREFIX):
        raise ShortDramaVideoSaveError(f"Not a short drama video URL: {public_url}")
    rel = u[len(_SHORT_DRAMA_STATIC_VIDEO_PREFIX) :].lstrip("/")
    root = short_drama_videos_root().resolve()
    path = (root / rel).resolve()
    try:
        path.relative_to(root)
    except ValueError as e:
        raise ShortDramaVideoSaveError(f"Invalid video path escape: {public_url}") from e
    return path


def is_short_drama_static_video_url(public_url: str) -> bool:
    u = (public_url or "").strip()
    if not u:
        return False
    if u.startswith("http://") or u.startswith("https://"):
        parsed = urlparse(u)
        u = unquote(parsed.path or "")
    else:
        u = unquote(u)
    return u.startswith(_SHORT_DRAMA_STATIC_VIDEO_PREFIX) and u.lower().endswith(".mp4")


def is_short_drama_r2_video_url(public_url: str) -> bool:
    u = (public_url or "").strip()
    if not u:
        return False
    if not (u.startswith("http://") or u.startswith("https://")):
        return False
    parsed = urlparse(u)
    path = parsed.path or ""
    return bool(parsed.netloc) and _SHORT_DRAMA_R2_VIDEO_PATH_MARKER in path and path.lower().endswith(".mp4")


def is_short_drama_video_url(public_url: str) -> bool:
    return is_short_drama_static_video_url(public_url) or is_short_drama_r2_video_url(public_url)


def download_public_video_to_temp_mp4(public_url: str) -> Path:
    timeout = httpx.Timeout(connect=15.0, read=180.0, write=30.0, pool=10.0)
    fd, tmp_name = tempfile.mkstemp(suffix=".mp4")
    os.close(fd)
    out = Path(tmp_name)
    try:
        with httpx.Client(timeout=timeout, follow_redirects=True) as client:
            resp = client.get(public_url)
        if resp.status_code >= 400:
            raise ShortDramaVideoSaveError(f"Failed to download video URL (HTTP {resp.status_code}): {public_url}")
        out.write_bytes(resp.content)
        return out
    except Exception as e:
        try:
            out.unlink(missing_ok=True)
        except OSError:
            pass
        if isinstance(e, ShortDramaVideoSaveError):
            raise
        raise ShortDramaVideoSaveError(f"Failed to download video URL: {public_url}; err={e}") from e


def absolutize_media_url_for_provider(relative_or_absolute: str) -> str:
    """xAI reference images must be public URLs; relative /static/... paths use configured public base."""
    s = (relative_or_absolute or "").strip()
    if not s:
        return s
    return build_public_static_url(s)
