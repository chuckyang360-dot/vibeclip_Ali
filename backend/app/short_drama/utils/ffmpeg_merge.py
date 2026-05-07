"""Minimal ffmpeg concat for segment MP4s."""

from __future__ import annotations

import logging
import subprocess
import tempfile
from pathlib import Path
import shutil

from ..exceptions import ShortDramaFFmpegError

logger = logging.getLogger(__name__)

FFMPEG_BIN = "ffmpeg"


def _run_ffmpeg_command(
    cmd: list[str],
    *,
    project_id: int | None,
    segment_id: str | None,
    timeout: int = 600,
) -> subprocess.CompletedProcess[str]:
    ffmpeg_path = shutil.which(FFMPEG_BIN)
    if ffmpeg_path:
        logger.info(
            "[FFMPEG_RUNTIME_READY] project_id=%s segment_id=%s ffmpeg_cmd=%s",
            project_id,
            segment_id,
            ffmpeg_path,
        )
    else:
        logger.error(
            "[FFMPEG_NOT_FOUND_IN_ENV] project_id=%s segment_id=%s ffmpeg_cmd=%s exception_class=%s err=%s",
            project_id,
            segment_id,
            FFMPEG_BIN,
            "FileNotFoundError",
            "ffmpeg not found in PATH",
        )
    cmd_str = " ".join(cmd)
    logger.info(
        "[FFMPEG_COMMAND_START] project_id=%s segment_id=%s ffmpeg_cmd=%s",
        project_id,
        segment_id,
        cmd_str,
    )
    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
    except FileNotFoundError as e:
        logger.error(
            "[FFMPEG_NOT_FOUND_IN_ENV] project_id=%s segment_id=%s ffmpeg_cmd=%s exception_class=%s err=%s",
            project_id,
            segment_id,
            cmd_str,
            type(e).__name__,
            str(e),
        )
        raise ShortDramaFFmpegError(f"ffmpeg not found in runtime environment; cmd={cmd_str}") from e
    except subprocess.TimeoutExpired as e:
        logger.error(
            "[FFMPEG_COMMAND_FAIL] project_id=%s segment_id=%s ffmpeg_cmd=%s returncode=%s stderr_preview=%s",
            project_id,
            segment_id,
            cmd_str,
            "timeout",
            str(e)[:500],
        )
        raise ShortDramaFFmpegError("ffmpeg merge timed out") from e

    if proc.returncode != 0:
        stderr = (proc.stderr or proc.stdout or "").strip()
        if len(stderr) > 500:
            stderr = stderr[:500] + "…"
        logger.error(
            "[FFMPEG_COMMAND_FAIL] project_id=%s segment_id=%s ffmpeg_cmd=%s returncode=%s stderr_preview=%s",
            project_id,
            segment_id,
            cmd_str,
            proc.returncode,
            stderr,
        )
    else:
        logger.info(
            "[FFMPEG_COMMAND_SUCCESS] project_id=%s segment_id=%s ffmpeg_cmd=%s",
            project_id,
            segment_id,
            cmd_str,
        )
    return proc


def merge_mp4_files(
    segment_paths: list[Path],
    output_path: Path,
    *,
    project_id: int | None = None,
    segment_id: str | None = "final_merge",
) -> None:
    if not segment_paths:
        raise ShortDramaFFmpegError("No segment files to merge")
    for p in segment_paths:
        if not p.is_file():
            raise ShortDramaFFmpegError(f"Missing segment file: {p}")

    output_path.parent.mkdir(parents=True, exist_ok=True)

    with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
        list_file = Path(f.name)
        for p in segment_paths:
            # concat demuxer requires safe escaped paths
            escaped = str(p.resolve()).replace("'", r"'\''")
            f.write(f"file '{escaped}'\n")

    try:
        proc = _run_ffmpeg_command(
            [
                FFMPEG_BIN,
                "-y",
                "-f",
                "concat",
                "-safe",
                "0",
                "-i",
                str(list_file),
                "-c",
                "copy",
                str(output_path),
            ],
            project_id=project_id,
            segment_id=segment_id,
            timeout=600,
        )
        if proc.returncode != 0:
            logger.warning("ffmpeg -c copy failed, retry re-encode. stderr=%s", proc.stderr[:2000])
            proc2 = _run_ffmpeg_command(
                [
                    FFMPEG_BIN,
                    "-y",
                    "-f",
                    "concat",
                    "-safe",
                    "0",
                    "-i",
                    str(list_file),
                    "-c:v",
                    "libx264",
                    "-pix_fmt",
                    "yuv420p",
                    "-c:a",
                    "aac",
                    "-movflags",
                    "+faststart",
                    str(output_path),
                ],
                project_id=project_id,
                segment_id=segment_id,
                timeout=600,
            )
            if proc2.returncode != 0:
                raise ShortDramaFFmpegError(
                    f"ffmpeg merge failed: {proc2.stderr[:2000] or proc.stderr[:2000]}"
                )
    finally:
        try:
            list_file.unlink(missing_ok=True)
        except OSError:
            pass
