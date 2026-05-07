"""Validate segment MP4 files on disk before marking render success or running final merge."""

from __future__ import annotations

import logging
import subprocess
from pathlib import Path

from ..exceptions import ShortDramaInvalidSegmentVideoError
from .ffmpeg_merge import FFMPEG_BIN

logger = logging.getLogger(__name__)

# Text placeholder from legacy mock; real MP4s are larger and contain ftyp.
MIN_SEGMENT_MP4_BYTES = 512


def validate_segment_mp4_path(path: Path, *, segment_id: str | None = None) -> None:
    """Raise ShortDramaInvalidSegmentVideoError if the file is not a usable MP4."""
    prefix = f"segment_id={segment_id!r}: " if segment_id else ""

    if not path.is_file():
        raise ShortDramaInvalidSegmentVideoError(f"{prefix}missing file: {path}")

    size = path.stat().st_size
    if size < MIN_SEGMENT_MP4_BYTES:
        raise ShortDramaInvalidSegmentVideoError(
            f"{prefix}invalid MP4 (too small: {size} bytes; need >= {MIN_SEGMENT_MP4_BYTES}) path={path}"
        )

    with path.open("rb") as f:
        head = f.read(65536)

    if head.startswith(b"MOCK_MP4") or b"MOCK_MP4_PLACEHOLDER" in head[:256]:
        raise ShortDramaInvalidSegmentVideoError(
            f"{prefix}invalid MP4 (legacy text placeholder, not a video file) path={path}"
        )

    if b"ftyp" not in head[:8192]:
        raise ShortDramaInvalidSegmentVideoError(
            f"{prefix}invalid MP4 (missing ftyp; not ISO BMFF) path={path}"
        )

    cmd = [
        FFMPEG_BIN,
        "-v",
        "error",
        "-i",
        str(path.resolve()),
        "-f",
        "null",
        "-",
    ]
    cmd_str = " ".join(cmd)
    logger.info(
        "[FFMPEG_COMMAND_START] project_id=%s segment_id=%s ffmpeg_cmd=%s",
        "",
        segment_id or "",
        cmd_str,
    )
    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=120,
        )
    except FileNotFoundError as e:
        logger.error(
            "[FFMPEG_NOT_FOUND_IN_ENV] project_id=%s segment_id=%s ffmpeg_cmd=%s exception_class=%s err=%s",
            "",
            segment_id or "",
            cmd_str,
            type(e).__name__,
            str(e),
        )
        raise ShortDramaInvalidSegmentVideoError(
            f"{prefix}ffmpeg not found in runtime environment; cmd={cmd_str}"
        ) from e
    except subprocess.TimeoutExpired as e:
        logger.error(
            "[FFMPEG_COMMAND_FAIL] project_id=%s segment_id=%s ffmpeg_cmd=%s returncode=%s stderr_preview=%s",
            "",
            segment_id or "",
            cmd_str,
            "timeout",
            str(e)[:500],
        )
        raise ShortDramaInvalidSegmentVideoError(
            f"{prefix}invalid or corrupt MP4 (demux timed out) path={path}"
        ) from e
    if proc.returncode == 0:
        logger.info(
            "[FFMPEG_COMMAND_SUCCESS] project_id=%s segment_id=%s ffmpeg_cmd=%s",
            "",
            segment_id or "",
            cmd_str,
        )
    if proc.returncode != 0:
        tail = (proc.stderr or proc.stdout or "").strip()
        if len(tail) > 800:
            tail = tail[:800] + "…"
        logger.error(
            "[FFMPEG_COMMAND_FAIL] project_id=%s segment_id=%s ffmpeg_cmd=%s returncode=%s stderr_preview=%s",
            "",
            segment_id or "",
            cmd_str,
            proc.returncode,
            tail[:500],
        )
        logger.warning(
            "SEGMENT_MP4_DEMUX_FAIL %spath=%s rc=%s stderr=%s",
            prefix,
            path,
            proc.returncode,
            tail[:500],
        )
        raise ShortDramaInvalidSegmentVideoError(
            f"{prefix}invalid or corrupt MP4 (demux failed, moov/truncated file?) path={path} detail={tail or f'exit {proc.returncode}'}"
        )
