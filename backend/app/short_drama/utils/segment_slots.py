"""Structured shot slots: validate, optional single-slot fill, compose prompts (category-agnostic)."""

from __future__ import annotations

import logging
import re
from copy import deepcopy
from typing import Any

from ..exceptions import ShortDramaInvalidModelOutputError
from ..schemas.asset import AssetSpecsBundleSchema
from ..schemas.segment import SegmentScriptSchema, ShotSchema
from ..schemas.story import StoryBlueprintSchema, SegmentPlanItemSchema

logger = logging.getLogger(__name__)

SLOT_FIELD_NAMES = (
    "scene_description",
    "subject_description",
    "action_description",
    "camera_description",
)

_MIN_COMPOSED_LEN = 30

_BANNED_EXACT_PROMPTS = frozenset(
    {
        "nice",
        "good",
        "beautiful",
        "something",
        "cinematic shot",
        "show product",
        "make it cool",
    }
)

_VAGUE_ONLY_TOKENS = frozenset(
    {
        "a",
        "an",
        "the",
        "and",
        "or",
        "to",
        "of",
        "in",
        "on",
        "for",
        "nice",
        "good",
        "beautiful",
        "something",
        "show",
        "make",
        "it",
        "cool",
        "shot",
        "cinematic",
        "product",
        "very",
        "just",
        "some",
        "thing",
    }
)

_DEFAULT_CAMERA_STILL = (
    "Cinematic 9:16 vertical commercial framing, soft key light, clean readable contrast, "
    "shallow depth of field where appropriate."
)

def _slot_text(shot: ShotSchema, field: str) -> str:
    if field == "action_description":
        return (shot.action_description or "").strip()
    return (getattr(shot, field, None) or "").strip()


def slot_nonempty(text: str) -> bool:
    return len((text or "").strip()) >= 2


def missing_slot_field_names(shot: ShotSchema) -> list[str]:
    return [k for k in SLOT_FIELD_NAMES if not slot_nonempty(_slot_text(shot, k))]


def filled_slot_count(shot: ShotSchema) -> int:
    return sum(1 for k in SLOT_FIELD_NAMES if slot_nonempty(_slot_text(shot, k)))


def _prompt_alnum_tokens(prompt: str) -> list[str]:
    return re.findall(r"[a-z0-9]+", prompt.lower())


def _is_vague_only_prompt(prompt: str) -> bool:
    toks = _prompt_alnum_tokens(prompt)
    if not toks:
        return True
    return all(t in _VAGUE_ONLY_TOKENS for t in toks)


def _find_scene_asset(shot: ShotSchema, assets: AssetSpecsBundleSchema):
    ref = (shot.scene_ref or "").strip().lower()
    if assets.scenes:
        for s in assets.scenes:
            n = (s.name or "").strip().lower()
            if ref and (n == ref or ref in n or n in ref):
                return s
        if not ref:
            return assets.scenes[0]
    return None


def _segment_plan_row(seg: SegmentScriptSchema, blueprint: StoryBlueprintSchema) -> SegmentPlanItemSchema | None:
    for row in blueprint.segment_plan or []:
        if (row.segment_id or "").strip() == (seg.segment_id or "").strip():
            return row
    return None


def _clean_prose(s: str) -> str:
    t = (s or "").strip()
    if len(t) < 2:
        return ""
    return t.replace(";", ",").replace("  ", " ").strip()


def _fill_scene_from_assets(
    shot: ShotSchema, seg: SegmentScriptSchema, assets: AssetSpecsBundleSchema, blueprint: StoryBlueprintSchema
) -> str:
    sa = _find_scene_asset(shot, assets)
    if sa:
        vn = (sa.name or "the location").strip()
        vp = _clean_prose((sa.visual_prompt or sa.description or "").strip()).rstrip(".")
        st = (sa.scene_type or "").strip()
        if vp and len(vp) > 8:
            return f"{vn}: {vp}"
        if st:
            return f"{vn} ({st})"
        return f"Setting: {vn}."
    plan = _segment_plan_row(seg, blueprint)
    if plan:
        ssum = _clean_prose((plan.summary or "").strip())
        if ssum and len(ssum) > 12:
            return ssum[:280]
    pr = _clean_prose((blueprint.premise or "").strip())
    if pr and len(pr) > 12:
        return pr[:280]
    return "Readable environment with clear geography and production design."


def _fill_subject_from_assets(shot: ShotSchema, assets: AssetSpecsBundleSchema) -> str:
    refs = {r.strip().lower() for r in shot.character_refs if r and str(r).strip()}
    chosen = None
    for c in assets.characters:
        cn = (c.name or "").strip().lower()
        if refs and cn not in refs and not any(r in cn or cn in r for r in refs if r):
            continue
        chosen = c
        break
    if chosen is None and assets.characters:
        chosen = assets.characters[0]
    if chosen is None and assets.products:
        pn = (assets.products[0].name or "product").strip()
        pd = _clean_prose((assets.products[0].description or assets.products[0].visual_prompt or "").strip())
        if pd:
            return f"{pn} — {pd[:200]}"
        return f"Primary subject: {pn}."
    if chosen is None:
        return "Primary on-screen subject clearly featured in frame."
    name = (chosen.name or "lead").strip()
    role = (chosen.role_type or "lead").strip()
    desc = _clean_prose((chosen.description or chosen.visual_prompt or "").strip())
    if desc and len(desc) > 6:
        return f"{name} ({role}): {desc[:220]}"
    return f"{name}, {role}, as the main subject."


def _fill_action_from_shot(shot: ShotSchema) -> str:
    ad = _clean_prose((shot.action_description or "").strip())
    if ad and len(ad) > 3:
        return ad[:320]
    vd = _clean_prose((shot.visual_description or "").strip())
    if vd and len(vd) > 5:
        return vd[:320]
    dlg = _clean_prose((shot.spoken_text or shot.dialogue or shot.voiceover_text or shot.narration or "").strip())
    if dlg and len(dlg) > 5:
        return f"Beat driven by line delivery: {dlg[:200]}"
    return "Natural, readable motion that advances the beat."


def fill_one_missing_slot(
    shot: ShotSchema,
    seg: SegmentScriptSchema,
    assets: AssetSpecsBundleSchema,
    blueprint: StoryBlueprintSchema,
    field: str,
) -> ShotSchema:
    if field == "scene_description":
        val = _fill_scene_from_assets(shot, seg, assets, blueprint)
        return shot.model_copy(update={"scene_description": val})
    if field == "subject_description":
        val = _fill_subject_from_assets(shot, assets)
        return shot.model_copy(update={"subject_description": val})
    if field == "action_description":
        val = _fill_action_from_shot(shot)
        return shot.model_copy(update={"action_description": val})
    if field == "camera_description":
        return shot.model_copy(update={"camera_description": _DEFAULT_CAMERA_STILL})
    return shot


def compose_image_prompt_from_slots(shot: ShotSchema) -> str:
    sc = _slot_text(shot, "scene_description")
    su = _slot_text(shot, "subject_description")
    ac = _slot_text(shot, "action_description")
    ca = _slot_text(shot, "camera_description")
    parts = [
        "Static keyframe for vertical short drama.",
        f"Scene: {sc}",
        f"Subject: {su}",
        f"Pose / moment: {ac}",
        f"Look: {ca}",
    ]
    return " ".join(p for p in parts if p and not p.endswith(": "))


def compose_video_prompt_from_slots(shot: ShotSchema) -> str:
    sc = _slot_text(shot, "scene_description")
    su = _slot_text(shot, "subject_description")
    ac = _slot_text(shot, "action_description")
    ca = _slot_text(shot, "camera_description")
    parts = [
        "Motion and pacing for vertical commercial short drama.",
        f"Environment continuity: {sc}",
        f"Subject focus: {su}",
        f"Action over time: {ac}",
        f"Camera / movement / rhythm: {ca}",
    ]
    return " ".join(p for p in parts if p and not p.endswith(": "))


def validate_composed_prompt_text(text: str, *, field: str, shot_id: str, segment_id: str) -> None:
    s = (text or "").strip()
    if not s:
        raise ShortDramaInvalidModelOutputError(
            f"Composed {field} is empty (segment={segment_id}, shot={shot_id})",
            segment_id=segment_id,
            shot_id=shot_id,
            missing_fields=[],
            code="composed_empty",
        )
    if len(s) < _MIN_COMPOSED_LEN:
        raise ShortDramaInvalidModelOutputError(
            f"Composed {field} too short (segment={segment_id}, shot={shot_id})",
            segment_id=segment_id,
            shot_id=shot_id,
            missing_fields=[],
            code="composed_short",
        )
    low = s.lower()
    if low in _BANNED_EXACT_PROMPTS:
        raise ShortDramaInvalidModelOutputError(
            f"Composed {field} is banned generic text (segment={segment_id}, shot={shot_id})",
            segment_id=segment_id,
            shot_id=shot_id,
            missing_fields=[],
            code="composed_banned",
        )
    if _is_vague_only_prompt(s):
        raise ShortDramaInvalidModelOutputError(
            f"Composed {field} is only vague tokens (segment={segment_id}, shot={shot_id})",
            segment_id=segment_id,
            shot_id=shot_id,
            missing_fields=[],
            code="composed_vague",
        )
    banned_fragments = (
        "show something nice",
        "something nice",
        "make it cool",
        "good cinematic shot",
        "本段核心信息",
        "表现兴趣",
        "表现欲望",
        "表现注意",
        "突出人物与产品关系",
        "展示核心信息",
        "核心信息：",
        "function_label",
    )
    if any(b in low for b in banned_fragments):
        raise ShortDramaInvalidModelOutputError(
            f"Composed {field} contains filler phrasing (segment={segment_id}, shot={shot_id})",
            segment_id=segment_id,
            shot_id=shot_id,
            missing_fields=[],
            code="composed_filler",
        )


def _legacy_infer_slots_from_prompts(
    shot: dict[str, Any],
    *,
    image_prompt: str,
    video_prompt: str,
) -> dict[str, Any]:
    """Best-effort display-only inference when new slot fields are absent."""
    ip = (image_prompt or "").strip()
    vp = (video_prompt or "").strip()
    blob = f"{ip} {vp}".strip()
    out = dict(shot)

    if not slot_nonempty(str(out.get("scene_description") or "")):
        vd = _clean_prose(str(out.get("visual_description") or ""))
        if len(vd) >= 8:
            out["scene_description"] = vd[:320]
        elif ip:
            chunks = [c.strip() for c in ip.split(",") if c.strip()]
            out["scene_description"] = (chunks[0] if chunks else ip)[:320]

    if not slot_nonempty(str(out.get("subject_description") or "")):
        refs = out.get("character_refs")
        if isinstance(refs, list) and refs:
            names = [str(x).strip() for x in refs if str(x).strip()]
            if names:
                out["subject_description"] = ", ".join(names)[:320]
        elif ip and len(ip) > 40:
            chunks = [c.strip() for c in ip.split(",") if c.strip()]
            out["subject_description"] = (chunks[1] if len(chunks) > 1 else ip[-200:])[:320]

    if not slot_nonempty(str(out.get("action_description") or "")):
        ad = _clean_prose(str(out.get("visual_description") or ""))
        if len(ad) >= 8:
            out["action_description"] = ad[:320]
        elif vp:
            out["action_description"] = vp[:320]

    if not slot_nonempty(str(out.get("camera_description") or "")):
        low = blob.lower()
        tail = ip[-min(160, len(ip)) :] if ip else ""
        if any(k in low for k in ("9:16", "close-up", "close up", "wide", "handheld", "tracking", "dolly", "push")):
            out["camera_description"] = tail or "Framing and lens language inferred from legacy prompts."
        else:
            out["camera_description"] = (
                "Framing and lens language inferred from legacy image/video prompts (not authoritatively split)."
            )
    return out


def normalize_shot_dict_for_read(sh: dict[str, Any]) -> dict[str, Any]:
    """Merge inferred slots for API responses; does not mutate stored JSON on disk."""
    if not isinstance(sh, dict):
        return sh
    out = deepcopy(sh)
    ip = str(out.get("image_prompt") or "")
    vp = str(out.get("video_prompt") or "")

    has_new = any(slot_nonempty(str(out.get(k) or "")) for k in ("scene_description", "subject_description", "camera_description"))
    if has_new:
        return out

    return _legacy_infer_slots_from_prompts(out, image_prompt=ip, video_prompt=vp)


def normalize_segment_script_dict_for_read(script: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(script, dict):
        return script
    out = deepcopy(script)
    shots = out.get("shots")
    if not isinstance(shots, list):
        return out
    out["shots"] = [normalize_shot_dict_for_read(s) if isinstance(s, dict) else s for s in shots]
    return out


def log_slot_raw(
    *,
    project_id: int,
    segment_id: str,
    shot_id: str,
    shot: ShotSchema,
) -> None:
    logger.info(
        "SEGMENT_SLOT_RAW project_id=%s segment_id=%s shot_id=%s scene_description=%s subject_description=%s action_description=%s camera_description=%s",
        project_id,
        segment_id,
        shot_id,
        _slot_text(shot, "scene_description"),
        _slot_text(shot, "subject_description"),
        _slot_text(shot, "action_description"),
        _slot_text(shot, "camera_description"),
    )
