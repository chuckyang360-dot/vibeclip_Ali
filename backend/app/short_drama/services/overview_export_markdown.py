"""Markdown for Overview export (script / storyboard) — mirrors frontend field usage."""

from __future__ import annotations

import re
from typing import Any

from ..utils.segment_slots import normalize_segment_script_dict_for_read


def _safe_name(name: str) -> str:
    s = re.sub(r'[/\\?%*:|"<>]', "_", (name or "").strip())
    s = re.sub(r"\s+", " ", s).strip()
    return s or "project"


def _segment_plan_item(blueprint: dict | None, segment_id: str, index: int) -> dict | None:
    if not blueprint or not isinstance(blueprint, dict):
        return None
    plan = blueprint.get("segment_plan")
    if not isinstance(plan, list) or not plan:
        return None
    sid = (segment_id or "").strip()
    for p in plan:
        if isinstance(p, dict) and (p.get("segment_id") or "").strip() == sid:
            return p
    if 0 <= index < len(plan) and isinstance(plan[index], dict):
        return plan[index]
    return None


def _product_exposure(plan: dict | None) -> str | None:
    if not plan:
        return None
    m = (plan.get("product_exposure_mode") or "").strip()
    if m:
        return m
    s = (plan.get("summary") or "").strip()
    return s or None


def _fmt_duration_seconds(raw: Any) -> str:
    if raw is None or raw == "":
        return "—"
    try:
        f = float(raw)
        if f > 0 and f == int(f):
            return f"{int(f)}s"
        if f > 0:
            return f"{f}s"
    except (TypeError, ValueError):
        pass
    if isinstance(raw, str) and raw.strip():
        return raw.strip()
    return "—"


def _shot_desc(shot: dict, i: int) -> str:
    vd = (shot.get("visual_description") or "").strip()
    ad = (shot.get("action_description") or "").strip()
    if vd:
        return vd
    if ad:
        return ad
    return f"镜头 {i + 1}"


def build_script_markdown(
    *,
    project_name: str,
    project_row: Any,
    blueprint_json: dict | None,
    segment_rows: list[Any],
) -> str:
    name = _safe_name(project_name)
    lines: list[str] = [
        f"# {name} — 脚本",
        "",
        "## 项目信息",
        f"- **项目名**：{name}",
        f"- **格式**：{(getattr(project_row, 'format', None) or '—')}",
        f"- **风格**：{(getattr(project_row, 'style', None) or '—')}",
        f"- **视听风格**：{(getattr(project_row, 'visual_style', None) or '—')}",
        f"- **比例**：{(getattr(project_row, 'aspect_ratio', None) or '—')}",
        f"- **时长**：{(getattr(project_row, 'duration', None) or '—')}",
        "",
    ]

    bp = blueprint_json if isinstance(blueprint_json, dict) else None

    for idx, row in enumerate(segment_rows):
        raw = row.script_json if isinstance(getattr(row, "script_json", None), dict) else {}
        script = normalize_segment_script_dict_for_read(dict(raw))
        title = (script.get("title") or "").strip() or f"片段 {idx + 1}"
        goal = (script.get("goal") or "").strip() or "—"
        dl = script.get("duration_limit")
        dur = _fmt_duration_seconds(dl)
        plan = _segment_plan_item(bp, str(getattr(row, "segment_id", "") or ""), idx)
        exposure = _product_exposure(plan)

        label = f"S{idx + 1}"
        lines.append(f"## {label} — {title}")
        lines.append(f"- **标题**：{title}")
        lines.append(f"- **时长**：{dur}")
        lines.append(f"- **情绪 / 目标**：{goal}")
        if exposure:
            lines.append(f"- **产品露出**：{exposure}")
        lines.append("")

        shots = script.get("shots")
        if not isinstance(shots, list):
            shots = []
        if not shots:
            lines.append(f"### {label} · Shot 1")
            lines.append("- **镜头描述**：—")
            lines.append("")

        for si, raw in enumerate(shots):
            shot = raw if isinstance(raw, dict) else {}
            lines.append(f"### {label} · Shot {si + 1}")
            lines.append(f"- **镜头描述**：{_shot_desc(shot, si)}")
            sd = (shot.get("scene_description") or "").strip()
            if sd:
                lines.append(f"- **场景**：{sd}")
            subj = (shot.get("subject_description") or "").strip()
            if subj:
                lines.append(f"- **角色 / 主体**：{subj}")
            act = (shot.get("action_description") or "").strip()
            if act:
                lines.append(f"- **动作**：{act}")
            spoken = (shot.get("spoken_text") or shot.get("dialogue") or "").strip()
            voiceover = (shot.get("voiceover_text") or shot.get("voiceover") or shot.get("narration") or "").strip()
            subtitle = (shot.get("subtitle_text") or shot.get("subtitle") or "").strip()
            lines.append(f"- **角色口播**：{spoken or '无角色口播'}")
            lines.append(f"- **旁白/画外音**：{voiceover or '无旁白'}")
            lines.append(f"- **字幕文案**：{subtitle or '无字幕'}")
            em = (shot.get("emotion") or "").strip() or "—"
            lines.append(f"- **情绪**：{em}")
            lines.append(f"- **时长**：{_fmt_duration_seconds(shot.get('duration_seconds'))}")
            cd = (shot.get("camera_description") or "").strip()
            if cd:
                lines.append(f"- **镜头运动**：{cd}")
            ip = (shot.get("image_prompt") or "").strip()
            if ip:
                lines.append(f"- **出图提示**：{ip}")
            vp = (shot.get("video_prompt") or "").strip()
            if vp:
                lines.append(f"- **视频提示**：{vp}")
            lines.append("")

    return "\n".join(lines).rstrip() + "\n"


def build_storyboard_markdown(
    *,
    project_name: str,
    blueprint_json: dict | None,
    segment_rows: list[Any],
) -> str:
    name = _safe_name(project_name)
    lines: list[str] = [f"# {name} — 分镜", ""]
    bp = blueprint_json if isinstance(blueprint_json, dict) else None

    for idx, row in enumerate(segment_rows):
        raw = row.script_json if isinstance(getattr(row, "script_json", None), dict) else {}
        script = normalize_segment_script_dict_for_read(dict(raw))
        title = (script.get("title") or "").strip() or f"片段 {idx + 1}"
        plan = _segment_plan_item(bp, str(getattr(row, "segment_id", "") or ""), idx)
        exposure = _product_exposure(plan)
        label = f"S{idx + 1}"
        lines.append(f"## Segment {label} — {title}")
        lines.append("")

        shots = script.get("shots")
        if not isinstance(shots, list):
            shots = []
        if not shots:
            lines.append("### Shot 1")
            lines.append("- **镜头描述**：—")
            lines.append("")

        for si, raw in enumerate(shots):
            shot = raw if isinstance(raw, dict) else {}
            lines.append(f"### Shot {si + 1}")
            lines.append(f"- **镜头描述**：{_shot_desc(shot, si)}")
            sd = (shot.get("scene_description") or "").strip()
            if sd:
                lines.append(f"- **场景**：{sd}")
            subj = (shot.get("subject_description") or "").strip()
            if subj:
                lines.append(f"- **角色**：{subj}")
            if exposure:
                lines.append(f"- **产品露出**：{exposure}")
            lines.append(f"- **时长**：{_fmt_duration_seconds(shot.get('duration_seconds'))}")
            em = (shot.get("emotion") or "").strip() or "—"
            lines.append(f"- **情绪**：{em}")
            lines.append("")

    return "\n".join(lines).rstrip() + "\n"
