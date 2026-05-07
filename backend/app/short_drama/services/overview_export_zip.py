"""Build zip archives for Overview export (videos-only / full bundle)."""

from __future__ import annotations

import io
import json
import logging
import re
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy.orm import Session

from ..exceptions import ShortDramaVideoSaveError
from ..models import ShortDramaProject
from ..services.pipeline_video_state import build_pipeline_video_state
from ..services.read_models import latest_final_video_url, list_segment_scripts
from ..services.overview_export_markdown import build_script_markdown, build_storyboard_markdown
from ..utils.segment_slots import normalize_segment_script_dict_for_read
from ..utils.public_static_url import build_public_static_url
from ..utils.video_storage import (
    download_public_video_to_temp_mp4,
    is_short_drama_static_video_url,
    local_path_from_public_video_url,
)

logger = logging.getLogger(__name__)


def _safe_dir_name(name: str) -> str:
    s = re.sub(r'[/\\?%*:|"<>]', "_", (name or "").strip())
    s = re.sub(r"\s+", " ", s).strip()
    return s or "project"


def _segment_mp4_filename(index: int, script: dict, segment_id: str) -> str:
    title = (script.get("title") or "").strip() or str(segment_id)
    slug = re.sub(r"[^\w\u4e00-\u9fff\-]+", "-", title)
    slug = slug.strip("-")[:48] or "segment"
    return f"seg{index}-{slug}.mp4"


def _public_url_from_script(script: dict) -> str | None:
    vr = script.get("video_render") if isinstance(script.get("video_render"), dict) else {}
    u = (vr.get("video_url") or "").strip()
    return u or None


def _log_zip_video_collect(
    *,
    project_id: int,
    archive_name: str,
    source_url: str,
    resolved_local_path: str,
    exists: bool,
    strategy: str,
) -> None:
    logger.info(
        "[OVERVIEW_EXPORT_ZIP_VIDEO] project_id=%s archive_name=%s source_url=%s "
        "resolved_local_path=%s exists=%s strategy=%s",
        project_id,
        archive_name,
        source_url[:800],
        resolved_local_path[:800],
        exists,
        strategy,
    )


def _resolve_archive_video_path(
    public_url: str,
    temp_cleanup: list[Path],
    *,
    project_id: int,
    export_type: str,
    file_role: str,
    file_identifier: str,
    archive_name: str,
) -> Path:
    s = (public_url or "").strip()
    if not s:
        raise ValueError("empty video url")
    abs_url = build_public_static_url(s) if not (s.startswith("http://") or s.startswith("https://")) else s

    # Local static mounts must be read from disk only. HTTP loopback to the same app often returns
    # 503 under a single worker (export holds the worker while httpx tries to fetch /static/...).
    if is_short_drama_static_video_url(s) or is_short_drama_static_video_url(abs_url):
        try:
            p = local_path_from_public_video_url(abs_url)
        except (ShortDramaVideoSaveError, OSError, ValueError) as e:
            logger.warning(
                "[OVERVIEW_EXPORT_ZIP_COLLECT] project_id=%s export_type=%s file_role=%s "
                "identifier=%s source_kind=static_resolve_failed abs_url=%s err=%s",
                project_id,
                export_type,
                file_role,
                file_identifier,
                abs_url[:500],
                e,
            )
            _log_zip_video_collect(
                project_id=project_id,
                archive_name=archive_name,
                source_url=s,
                resolved_local_path="",
                exists=False,
                strategy="local_static",
            )
            raise
        rp = str(p.resolve())
        if p.is_file():
            _log_zip_video_collect(
                project_id=project_id,
                archive_name=archive_name,
                source_url=s,
                resolved_local_path=rp,
                exists=True,
                strategy="local_static",
            )
            return p
        logger.error(
            "[OVERVIEW_EXPORT_ZIP_COLLECT] project_id=%s export_type=%s file_role=%s identifier=%s "
            "source_kind=static_missing_on_disk expected_path=%s",
            project_id,
            export_type,
            file_role,
            file_identifier,
            rp[:500],
        )
        _log_zip_video_collect(
            project_id=project_id,
            archive_name=archive_name,
            source_url=s,
            resolved_local_path=rp,
            exists=False,
            strategy="local_static",
        )
        raise ShortDramaVideoSaveError(
            f"本地视频文件不存在（请确认生成目录未清理或重新合并/渲染）: {p}"
        )

    try:
        p = local_path_from_public_video_url(abs_url)
        if p.is_file():
            rp = str(p.resolve())
            _log_zip_video_collect(
                project_id=project_id,
                archive_name=archive_name,
                source_url=s,
                resolved_local_path=rp,
                exists=True,
                strategy="local_static",
            )
            return p
    except (ShortDramaVideoSaveError, OSError, ValueError) as e:
        logger.info(
            "[OVERVIEW_EXPORT_ZIP_COLLECT] project_id=%s export_type=%s file_role=%s identifier=%s "
            "source_kind=not_local_static url=%s err=%s",
            project_id,
            export_type,
            file_role,
            file_identifier,
            abs_url[:500],
            e,
        )

    tmp = download_public_video_to_temp_mp4(abs_url)
    temp_cleanup.append(tmp)
    tr = str(tmp.resolve())
    _log_zip_video_collect(
        project_id=project_id,
        archive_name=archive_name,
        source_url=s,
        resolved_local_path=tr,
        exists=tmp.is_file(),
        strategy="remote_http",
    )
    return tmp


def _write_zip(
    *,
    project_id: int,
    export_type: str,
    root_folder: str,
    final_public_url: str | None,
    segment_rows: list[Any],
    project_row: Any,
    blueprint_json: dict | None,
    include_docs: bool,
) -> bytes:
    temp_cleanup: list[Path] = []
    files_collected_count = 0
    try:
        seg_with_url = sum(
            1
            for row in segment_rows
            if _public_url_from_script(
                normalize_segment_script_dict_for_read(
                    dict(row.script_json if isinstance(getattr(row, "script_json", None), dict) else {})
                )
            )
        )
        logger.info(
            "[OVERVIEW_EXPORT_ZIP_START] project_id=%s export_type=%s include_docs=%s "
            "has_final=%s segment_rows=%s segments_with_video_url=%s",
            project_id,
            export_type,
            include_docs,
            bool(final_public_url and str(final_public_url).strip()),
            len(segment_rows),
            seg_with_url,
        )
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
            # final
            if final_public_url and str(final_public_url).strip():
                arc = f"{root_folder}/final/{_safe_dir_name(project_row.project_name)}-final.mp4"
                fp = _resolve_archive_video_path(
                    str(final_public_url),
                    temp_cleanup,
                    project_id=project_id,
                    export_type=export_type,
                    file_role="final",
                    file_identifier="final",
                    archive_name=arc,
                )
                zf.write(fp, arcname=arc)
                files_collected_count += 1

            # segments
            for idx, row in enumerate(segment_rows, start=1):
                raw_script = row.script_json if isinstance(getattr(row, "script_json", None), dict) else {}
                script = normalize_segment_script_dict_for_read(dict(raw_script))
                vu = _public_url_from_script(script)
                if not vu:
                    continue
                arc = f"{root_folder}/segments/{_segment_mp4_filename(idx, script, str(row.segment_id))}"
                sp = _resolve_archive_video_path(
                    vu,
                    temp_cleanup,
                    project_id=project_id,
                    export_type=export_type,
                    file_role="segment",
                    file_identifier=str(row.segment_id),
                    archive_name=arc,
                )
                zf.write(sp, arcname=arc)
                files_collected_count += 1

            if include_docs:
                pname = _safe_dir_name(project_row.project_name)
                script_md = build_script_markdown(
                    project_name=project_row.project_name,
                    project_row=project_row,
                    blueprint_json=blueprint_json,
                    segment_rows=segment_rows,
                )
                sb_md = build_storyboard_markdown(
                    project_name=project_row.project_name,
                    blueprint_json=blueprint_json,
                    segment_rows=segment_rows,
                )
                zf.writestr(f"{root_folder}/docs/{pname}-script.md", script_md.encode("utf-8"))
                zf.writestr(f"{root_folder}/docs/{pname}-storyboard.md", sb_md.encode("utf-8"))

                meta = {
                    "project_id": project_row.id,
                    "project_name": project_row.project_name,
                    "exported_at": datetime.now(timezone.utc).isoformat(),
                    "final_video_url": build_public_static_url(final_public_url) if final_public_url else None,
                    "segment_count": len(segment_rows),
                }
                zf.writestr(
                    f"{root_folder}/meta/metadata.json",
                    json.dumps(meta, ensure_ascii=False, indent=2).encode("utf-8"),
                )

        out = buf.getvalue()
        logger.info(
            "[OVERVIEW_EXPORT_ZIP_DONE] project_id=%s export_type=%s include_docs=%s "
            "files_collected_count=%s zip_bytes=%s",
            project_id,
            export_type,
            include_docs,
            files_collected_count,
            len(out),
        )
        return out
    finally:
        for p in temp_cleanup:
            try:
                p.unlink(missing_ok=True)
            except OSError:
                pass


def build_videos_zip_bytes(db: Session, project_id: int) -> tuple[bytes, str]:
    project = db.query(ShortDramaProject).filter(ShortDramaProject.id == project_id).first()
    if not project:
        raise ValueError("project not found")
    vs = build_pipeline_video_state(db, project_id, project.status or "")
    if not vs.get("has_all_segment_videos") or not vs.get("has_final_video"):
        raise ValueError("incomplete_videos_pack")

    segs = list_segment_scripts(db, project_id)
    final_u = latest_final_video_url(db, project_id)
    root = f"{_safe_dir_name(project.project_name)}-videos"
    data = _write_zip(
        project_id=project_id,
        export_type="video_bundle",
        root_folder=root,
        final_public_url=final_u,
        segment_rows=segs,
        project_row=project,
        blueprint_json=None,
        include_docs=False,
    )
    fname = f"{_safe_dir_name(project.project_name)}-videos.zip"
    return data, fname


def build_all_zip_bytes(db: Session, project_id: int, blueprint_json: dict | None) -> tuple[bytes, str]:
    project = db.query(ShortDramaProject).filter(ShortDramaProject.id == project_id).first()
    if not project:
        raise ValueError("project not found")
    vs = build_pipeline_video_state(db, project_id, project.status or "")
    if not vs.get("has_all_segment_videos") or not vs.get("has_final_video"):
        raise ValueError("incomplete_videos_all")

    segs = list_segment_scripts(db, project_id)
    final_u = latest_final_video_url(db, project_id)
    root = f"{_safe_dir_name(project.project_name)}-export"
    data = _write_zip(
        project_id=project_id,
        export_type="export_all",
        root_folder=root,
        final_public_url=final_u,
        segment_rows=segs,
        project_row=project,
        blueprint_json=blueprint_json,
        include_docs=True,
    )
    fname = f"{_safe_dir_name(project.project_name)}-export.zip"
    return data, fname
