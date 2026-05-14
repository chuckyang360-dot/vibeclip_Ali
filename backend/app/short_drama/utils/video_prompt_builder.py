"""Build segment-level reference-to-video inputs from segment scripts + asset rows.

Current render granularity is segment-level: shots are summarized into one prompt
for each segment. Future shot-level rendering can add separate plan/job fields.
"""

from __future__ import annotations

import re
import logging
import json
from dataclasses import dataclass, field

from ..exceptions import ShortDramaVideoInputError
from ..models import CharacterAsset, ProductAsset, SceneAsset
from ..schemas.segment import SegmentScriptSchema


SAFE_VIDEO_PROMPT_CHARS = 3200
_HARD_XAI_VIDEO_PROMPT_CHARS = 4096
_MAX_REFS = 7
_REPETITIVE_PROMPT_PHRASES = (
    "Cinematic 9:16 vertical composition",
    "movie-grade lighting",
    "dynamic camera movement",
)
logger = logging.getLogger(__name__)
_SHOT_MAX_CHARS = 700
_SEGMENT_MAX_SHOTS = 3
_PRODUCT_SHOWCASE_MAX_CONSTRAINTS = 3
_FORBIDDEN_TOKENS = (
    "brand_raw",
    "conflict:",
    "conflict",
    "source_trace",
    "field_meta",
    "raw_",
    "{'display':",
    "'description':",
)
_PAIN_POINT_HINTS = (
    "掉落",
    "疲惫",
    "拥挤",
    "不便",
    "冲突",
    "痛点",
    "通勤",
    "低头走路",
)
_PRODUCT_SHOWCASE_HINTS = (
    "产品",
    "展示",
    "开箱",
    "打开",
    "演示",
    "特写",
    "showcase",
    "demo",
)
_RESULT_HINTS = (
    "结果",
    "反馈",
    "满意",
    "轻松",
    "放心",
    "笑",
    "结束",
)


def _trace(tag: str, payload: dict) -> None:
    logger.info("[AI_CHAIN_TRACE][%s] %s", tag, json.dumps(payload, ensure_ascii=False, default=str))


def _get_shot_value(shot, key: str, default=None):
    if isinstance(shot, dict):
        return shot.get(key, default)
    return getattr(shot, key, default)


@dataclass
class SegmentVideoPlan:
    segment_id: str
    segment_video_prompt: str
    render_granularity: str = "segment"
    future_shot_level_reserved: bool = True
    selected_reference_image_urls: list[str] = field(default_factory=list)
    duration_seconds: int = 6
    aspect_ratio: str = "9:16"
    resolution: str | None = "720p"
    execution_input: dict = field(default_factory=dict)
    prompt_budget: dict = field(default_factory=dict)


def _norm_name(s: str) -> str:
    return (s or "").strip().casefold()


def _dedupe_preserve(urls: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for u in urls:
        u = (u or "").strip()
        if not u or u in seen:
            continue
        seen.add(u)
        out.append(u)
    return out


def _clean_asset_ids(values: list[str]) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for raw in values:
        value = str(raw or "").strip()
        if not value or not value.isdigit() or value in seen:
            continue
        seen.add(value)
        out.append(value)
    return out


def _clean_asset_ids_int(values: list[str]) -> list[int]:
    out: list[int] = []
    seen: set[int] = set()
    for raw in values:
        value = str(raw or "").strip()
        if not value or not value.isdigit():
            continue
        n = int(value)
        if n in seen:
            continue
        seen.add(n)
        out.append(n)
    return out


def _shot_character_asset_ids(shot) -> list[str]:
    raw: list[str] = []
    for key in ("character_asset_ids",):
        values = _get_shot_value(shot, key, []) or []
        if isinstance(values, list):
            raw.extend(str(x) for x in values)
    asset_refs = _get_shot_value(shot, "asset_refs", {}) or {}
    if isinstance(asset_refs, dict):
        values = asset_refs.get("character_asset_ids") or []
        if isinstance(values, list):
            raw.extend(str(x) for x in values)
    return _clean_asset_ids(raw)


def _shot_scene_asset_id(shot) -> str:
    candidates: list[str] = []
    for key in ("scene_asset_id", "scene_id"):
        value = str(_get_shot_value(shot, key, "") or "").strip()
        if value:
            candidates.append(value)
    asset_refs = _get_shot_value(shot, "asset_refs", {}) or {}
    if isinstance(asset_refs, dict):
        value = str(asset_refs.get("scene_asset_id") or "").strip()
        if value:
            candidates.append(value)
    for value in candidates:
        if value.isdigit():
            return value
    return ""


def _shot_product_asset_id(shot) -> str:
    candidates: list[str] = []
    value = str(_get_shot_value(shot, "product_asset_id", "") or "").strip()
    if value:
        candidates.append(value)
    asset_refs = _get_shot_value(shot, "asset_refs", {}) or {}
    if isinstance(asset_refs, dict):
        value = str(asset_refs.get("product_asset_id") or "").strip()
        if value:
            candidates.append(value)
    for value in candidates:
        if value.isdigit():
            return value
    return ""


def _compact_text(text: str, max_chars: int) -> str:
    text = re.sub(r"\s+", " ", (text or "").strip())
    if len(text) <= max_chars:
        return text
    cut = text[:max_chars].rstrip()
    boundary = max(cut.rfind("."), cut.rfind(";"), cut.rfind("，"), cut.rfind("。"))
    if boundary > max_chars * 0.65:
        cut = cut[: boundary + 1].rstrip()
    return cut.rstrip(" ,;，；") + "..."


def _drop_repetitive_boilerplate(text: str) -> str:
    out = text
    for phrase in _REPETITIVE_PROMPT_PHRASES:
        out = re.sub(re.escape(phrase), "", out, flags=re.IGNORECASE)
    out = re.sub(r"\s*[,;，；]\s*[,;，；]+\s*", ", ", out)
    return re.sub(r"\s+", " ", out).strip(" ,;，；")


def _dedupe_text_items(items: list[str], *, max_items: int) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for raw in items:
        item = re.sub(r"\s+", " ", str(raw or "").strip())
        if not item:
            continue
        key = item.casefold()
        if key in seen:
            continue
        seen.add(key)
        out.append(item)
        if len(out) >= max_items:
            break
    return out


def _sanitize_prompt_text(text: str) -> str:
    out = str(text or "")
    for token in _FORBIDDEN_TOKENS:
        out = out.replace(token, "")
    # Drop JSON-like / dict-like inline objects that pollute shot instructions.
    out = re.sub(r"\{[^{}]*:[^{}]*\}", " ", out)
    out = re.sub(r"\[[^\[\]]*\{[^\]]*\}[^\[\]]*\]", " ", out)
    out = re.sub(r"\s+", " ", out).strip()
    return out


def _is_probable_product_constraint(text: str) -> bool:
    t = str(text or "").casefold()
    if not t:
        return False
    markers = ("隔间", "结构", "材质", "皮革", "monogram", "mcm", "logo", "尺寸", "拉链", "双折")
    return any(m in t for m in markers)


def _shot_category(shot) -> str:
    merged = " ".join(
        [
            str(_get_shot_value(shot, "shot_role", "") or ""),
            str(_get_shot_value(shot, "shot_title", "") or ""),
            str(_get_shot_value(shot, "visual_action", "") or _get_shot_value(shot, "action_description", "") or ""),
        ]
    ).casefold()
    if any(k.casefold() in merged for k in _PRODUCT_SHOWCASE_HINTS):
        return "product_showcase"
    if any(k.casefold() in merged for k in _RESULT_HINTS):
        return "result_feedback"
    if any(k.casefold() in merged for k in _PAIN_POINT_HINTS):
        return "pain_point"
    return "neutral"


def _shot_has_explicit_product_action(shot, product_refs: list[str]) -> bool:
    merged = " ".join(
        [
            str(_get_shot_value(shot, "visual_action", "") or _get_shot_value(shot, "action_description", "") or ""),
            str(_get_shot_value(shot, "shot_title", "") or ""),
        ]
    ).casefold()
    if any(k.casefold() in merged for k in ("产品", "钱包", "展示", "打开", "拿起", "使用", "特写")):
        return True
    return any(str(p or "").strip().casefold() in merged for p in product_refs if str(p or "").strip())


def _safe_join(label: str, value: str) -> str:
    val = _sanitize_prompt_text(value)
    if not val:
        return ""
    return f"{label}: {val}."


def _filter_shot_list_values(values: list[str], *, include_product_constraints: bool, max_items: int) -> list[str]:
    cleaned = [_sanitize_prompt_text(v) for v in values if str(v or "").strip()]
    deduped = _dedupe_text_items(cleaned, max_items=max_items * 2)
    if include_product_constraints:
        constrained = [x for x in deduped if _is_probable_product_constraint(x)]
        base = [x for x in deduped if x not in constrained]
        return base[:max_items] + constrained[:_PRODUCT_SHOWCASE_MAX_CONSTRAINTS]
    return [x for x in deduped if not _is_probable_product_constraint(x)][:max_items]


def _build_compact_shot_prompt(shot) -> tuple[str, dict]:
    visual_action = _sanitize_prompt_text(
        str(_get_shot_value(shot, "visual_action", "") or _get_shot_value(shot, "action_description", "") or "")
    )
    scene_ref = _sanitize_prompt_text(_effective_scene_ref(shot))
    character_refs = _filter_shot_list_values(_effective_character_refs(shot), include_product_constraints=False, max_items=3)
    product_refs_all = _filter_shot_list_values(_effective_product_refs(shot), include_product_constraints=False, max_items=2)
    camera_framing = _sanitize_prompt_text(
        str(_get_shot_value(shot, "camera_framing", "") or _get_shot_value(shot, "framing", "") or "")
    )
    camera_movement = _sanitize_prompt_text(str(_get_shot_value(shot, "camera_movement", "") or ""))
    mood = _sanitize_prompt_text(str(_get_shot_value(shot, "mood", "") or _get_shot_value(shot, "emotion", "") or ""))
    style_instruction = _sanitize_prompt_text(str(_get_shot_value(shot, "visual_style_instruction", "") or ""))
    market_detail = _sanitize_prompt_text(str(_get_shot_value(shot, "market_localization_detail", "") or ""))
    dialogue_text = _sanitize_prompt_text(
        str(_get_shot_value(shot, "dialogue_text", "") or _get_shot_value(shot, "spoken_text", "") or _get_shot_value(shot, "dialogue", "") or "")
    )
    voiceover_text = _sanitize_prompt_text(
        str(_get_shot_value(shot, "voiceover_text", "") or _get_shot_value(shot, "voiceover", "") or _get_shot_value(shot, "narration", "") or "")
    )
    subtitle_text = _sanitize_prompt_text(
        str(_get_shot_value(shot, "subtitle_text", "") or _get_shot_value(shot, "subtitle", "") or "")
    )
    audio_intent = _sanitize_prompt_text(str(_get_shot_value(shot, "audio_intent", "") or ""))
    audio_required = bool(_get_shot_value(shot, "audio_required", False) or dialogue_text or voiceover_text)
    subtitle_required = bool(_get_shot_value(shot, "subtitle_required", False) or subtitle_text)
    shot_category = _shot_category(shot)
    explicit_product = _shot_has_explicit_product_action(shot, product_refs_all)
    include_product_refs = shot_category == "product_showcase" or explicit_product or shot_category == "result_feedback"
    product_refs = product_refs_all if include_product_refs else []

    # must_show / must_avoid are kept shot-scoped only, filtered by role.
    raw_must_show = [str(x) for x in (_get_shot_value(shot, "must_show", []) or [])]
    raw_must_avoid = [str(x) for x in (_get_shot_value(shot, "must_avoid", []) or [])]
    must_show = _filter_shot_list_values(
        raw_must_show,
        include_product_constraints=shot_category == "product_showcase",
        max_items=3,
    )
    must_avoid = _filter_shot_list_values(
        raw_must_avoid,
        include_product_constraints=shot_category == "product_showcase",
        max_items=3,
    )

    parts = [
        _safe_join("Visual action", visual_action),
        _safe_join("Scene", scene_ref),
        _safe_join("Characters", ", ".join(character_refs)),
    ]
    if product_refs:
        parts.append(_safe_join("Product refs", ", ".join(product_refs)))
    parts.extend(
        [
            _safe_join("Camera framing", camera_framing),
            _safe_join("Camera movement", camera_movement),
            _safe_join("Mood", mood),
            _safe_join("Visual style", style_instruction),
            _safe_join("Market localization", market_detail),
        ]
    )
    if must_show:
        parts.append(_safe_join("Must show", "; ".join(must_show)))
    if must_avoid:
        parts.append(_safe_join("Must avoid", "; ".join(must_avoid)))
    if dialogue_text:
        parts.append(_safe_join("Dialogue", dialogue_text))
    if voiceover_text:
        parts.append(_safe_join("Voiceover", voiceover_text))
    if subtitle_text:
        parts.append(_safe_join("Subtitle", subtitle_text))
    if audio_intent:
        parts.append(_safe_join("Audio intent", audio_intent))
    parts.append(_safe_join("Audio required", "yes" if audio_required else "no"))
    parts.append(_safe_join("Subtitle required", "yes" if subtitle_required else "no"))
    compact = re.sub(r"\s+", " ", " ".join(p for p in parts if p)).strip()
    compact = _drop_repetitive_boilerplate(compact)
    if len(compact) > _SHOT_MAX_CHARS:
        compact = _compact_text(compact, _SHOT_MAX_CHARS)
    return compact, {
        "included_product_refs": bool(product_refs),
        "included_character_refs": bool(character_refs),
        "included_scene_refs": bool(scene_ref),
        "must_show": must_show,
        "must_avoid": must_avoid,
    }


def _effective_character_refs(shot) -> list[str]:
    manual = _dedupe_text_items([str(x) for x in (_get_shot_value(shot, "manual_character_refs", []) or [])], max_items=8)
    if manual:
        return manual
    return _dedupe_text_items([str(x) for x in (_get_shot_value(shot, "character_refs", []) or [])], max_items=8)


def _effective_scene_ref(shot) -> str:
    manual = str(_get_shot_value(shot, "manual_scene_ref", "") or "").strip()
    if manual:
        return manual
    return str(_get_shot_value(shot, "scene_ref", "") or "").strip()


def _effective_product_refs(shot) -> list[str]:
    manual = _dedupe_text_items([str(x) for x in (_get_shot_value(shot, "manual_product_refs", []) or [])], max_items=5)
    if manual:
        return manual
    return _dedupe_text_items([str(x) for x in (_get_shot_value(shot, "product_refs", []) or [])], max_items=5)


def _manual_refs_used(segment: SegmentScriptSchema) -> bool:
    return any(
        bool(
            _get_shot_value(s, "manual_character_refs", [])
            or str(_get_shot_value(s, "manual_scene_ref", "") or "").strip()
            or _get_shot_value(s, "manual_product_refs", [])
        )
        for s in segment.shots
    )


def _summarize_visual_constraints(segment: SegmentScriptSchema) -> list[str]:
    vals: list[str] = []
    for shot in segment.shots:
        sc = _get_shot_value(shot, "source_visual_constraints", {}) or {}
        if not isinstance(sc, dict):
            continue
        for key in ("visual_style", "aspect_ratio", "market_visual_constraints", "visual_style_constraints"):
            v = sc.get(key)
            if isinstance(v, str) and v.strip():
                vals.append(f"{key}: {v.strip()}")
            elif isinstance(v, dict) and v:
                vals.append(f"{key}: {v}")
        for key in ("visual_features", "consistency_notes", "visual_risk_notes", "s2_required_visual_elements"):
            v = sc.get(key)
            if isinstance(v, list):
                vals.extend(str(x) for x in v[:2] if x)
    return _dedupe_text_items(vals, max_items=2)


def _segment_v2_video_prompt_pass_through(segment: SegmentScriptSchema) -> bool:
    meta = segment.meta if isinstance(segment.meta, dict) else {}
    if meta.get("video_prompt_v2_pass_through"):
        return True
    for shot in segment.shots or []:
        sc = _get_shot_value(shot, "source_visual_constraints", {}) or {}
        if isinstance(sc, dict) and sc.get("video_prompt_v2_pass_through"):
            return True
    return False


def _v2_pass_through_segment_prompt(
    segment: SegmentScriptSchema,
    *,
    project_id: int | None = None,
) -> tuple[str, dict]:
    shots = list(segment.shots or [])
    if len(shots) != 1:
        raise ShortDramaVideoInputError(
            f"v2 video_generation_specs segment {segment.segment_id!r} must materialize to exactly one shot "
            f"(found {len(shots)}); regenerate S2 with one spec per segment."
        )
    shot = shots[0]
    text = str(_get_shot_value(shot, "video_prompt", "") or "").strip()
    if not text:
        raise ShortDramaVideoInputError(
            f"Segment {segment.segment_id!r} missing video_prompt for v2 pass-through render."
        )
    if len(text) > _HARD_XAI_VIDEO_PROMPT_CHARS:
        raise ShortDramaVideoInputError(
            f"Segment {segment.segment_id!r} video_prompt length {len(text)} exceeds provider limit "
            f"{_HARD_XAI_VIDEO_PROMPT_CHARS}; shorten S2 video_prompt (automatic truncation is disabled for v2)."
        )
    budget = {
        "before_chars": len(text),
        "after_chars": len(text),
        "truncated": False,
        "dropped_sections": [],
        "final_prompt_preview": text[:500],
        "shot_count": 1,
        "included_product_refs": False,
        "included_character_refs": False,
        "included_scene_refs": False,
        "safe_video_prompt_chars": SAFE_VIDEO_PROMPT_CHARS,
        "hard_video_prompt_chars": _HARD_XAI_VIDEO_PROMPT_CHARS,
        "v2_pass_through": True,
    }
    return text, budget


def _budgeted_segment_prompt(
    segment: SegmentScriptSchema,
    *,
    aspect_ratio: str,
    project_id: int | None = None,
) -> tuple[str, dict]:
    dropped_sections: list[str] = []
    shot_parts: list[str] = []
    shot_details: list[dict] = []
    original_shots = list(segment.shots or [])
    if len(original_shots) > _SEGMENT_MAX_SHOTS:
        dropped_sections.append("segment_shot_count_trimmed")
    selected_shots = original_shots[:_SEGMENT_MAX_SHOTS]
    for shot in selected_shots:
        shot_id = str(_get_shot_value(shot, "shot_id", "") or "")
        manual = str(_get_shot_value(shot, "manual_video_prompt", "") or "").strip()
        vp = manual or str(_get_shot_value(shot, "video_prompt", "") or "").strip()
        if not vp:
            logger.warning(
                "[S4_VIDEO_PROMPT_MISSING] project_id=%s segment_id=%s missing_field=video_prompt",
                project_id,
                segment.segment_id,
            )
            raise ShortDramaVideoInputError(
                f"Segment {segment.segment_id!r} shot {shot_id!r} missing video_prompt; regenerate S4 segment script or set manual_video_prompt."
            )
        shot_prompt = _compact_text(_sanitize_prompt_text(vp), _SHOT_MAX_CHARS)
        if not shot_prompt:
            logger.warning(
                "[S4_VIDEO_PROMPT_MISSING] project_id=%s segment_id=%s missing_field=video_prompt",
                project_id,
                segment.segment_id,
            )
            raise ShortDramaVideoInputError(
                f"Segment {segment.segment_id!r} shot {shot_id!r} video_prompt empty after sanitize; fix input."
            )
        shot_parts.append(f"Shot {shot_id}: {shot_prompt}".strip())
        shot_details.append(
            {
                "included_product_refs": False,
                "included_character_refs": False,
                "included_scene_refs": False,
                "must_show": [],
                "must_avoid": [],
            }
        )

    text = re.sub(r"\s+", " ", " ".join(shot_parts)).strip()
    before_chars = len(text)
    if not text:
        raise ShortDramaVideoInputError(
            f"Segment {segment.segment_id!r} has empty video_prompt (and no usable shot fallback)"
        )
    truncated = len(text) > SAFE_VIDEO_PROMPT_CHARS
    if truncated:
        dropped_sections.append("safe_budget_trim")
        text = _compact_text(text, SAFE_VIDEO_PROMPT_CHARS)
    text = _sanitize_prompt_text(text)
    if len(text) > _HARD_XAI_VIDEO_PROMPT_CHARS:
        dropped_sections.append("xai_hard_limit_trim")
        text = _compact_text(text, SAFE_VIDEO_PROMPT_CHARS)
    if len(text) > _HARD_XAI_VIDEO_PROMPT_CHARS:
        raise ShortDramaVideoInputError(
            f"Segment {segment.segment_id!r} video_prompt still exceeds xAI hard limit {_HARD_XAI_VIDEO_PROMPT_CHARS}"
        )
    included_product_refs = any(d.get("included_product_refs") for d in shot_details)
    included_character_refs = any(d.get("included_character_refs") for d in shot_details)
    included_scene_refs = any(d.get("included_scene_refs") for d in shot_details)
    budget = {
        "before_chars": before_chars,
        "after_chars": len(text),
        "truncated": truncated or bool(dropped_sections),
        "dropped_sections": list(dict.fromkeys(dropped_sections)),
        "final_prompt_preview": text[:500],
        "shot_count": len(selected_shots),
        "included_product_refs": included_product_refs,
        "included_character_refs": included_character_refs,
        "included_scene_refs": included_scene_refs,
        "safe_video_prompt_chars": SAFE_VIDEO_PROMPT_CHARS,
        "hard_video_prompt_chars": _HARD_XAI_VIDEO_PROMPT_CHARS,
    }
    return text, budget


def _duration_for_segment(segment: SegmentScriptSchema) -> int:
    limit = float(segment.duration_limit or 0.0)
    if limit > 0:
        d = int(round(limit))
    else:
        total = sum(float(_get_shot_value(s, "duration_seconds", 0.0) or 0.0) for s in segment.shots)
        d = int(round(total)) if total > 0 else 6
    if d < 1:
        d = 1
    if d > 10:
        logger.warning(
            "[S4_SEGMENT_DURATION_CLAMPED] segment_id=%s requested_segment_duration=%s provider_max_duration=%s note=%s",
            segment.segment_id,
            d,
            10,
            "single-segment cap only; full project duration should be achieved by multiple segments + merge",
        )
        d = 10
    return min(10, d)


def _char_by_name(chars: list[CharacterAsset]) -> dict[str, CharacterAsset]:
    return {_norm_name(c.name): c for c in chars}


def _char_by_id(chars: list[CharacterAsset]) -> dict[str, CharacterAsset]:
    return {str(c.id): c for c in chars if getattr(c, "id", None) is not None}


def _scene_by_name(scenes: list[SceneAsset]) -> dict[str, SceneAsset]:
    return {_norm_name(s.name): s for s in scenes}


def _scene_by_id(scenes: list[SceneAsset]) -> dict[str, SceneAsset]:
    return {str(s.id): s for s in scenes if getattr(s, "id", None) is not None}


def _product_by_name(products: list[ProductAsset]) -> dict[str, ProductAsset]:
    return {_norm_name(p.name): p for p in products}


def _product_by_id(products: list[ProductAsset]) -> dict[str, ProductAsset]:
    return {str(p.id): p for p in products if getattr(p, "id", None) is not None}


def build_segment_video_plan(
    segment: SegmentScriptSchema,
    *,
    characters: list[CharacterAsset],
    scenes: list[SceneAsset],
    products: list[ProductAsset],
    project_aspect_ratio: str | None,
    resolved_character_assets: dict[int, dict[str, str]] | None = None,
    project_id: int | None = None,
) -> SegmentVideoPlan:
    ar = (project_aspect_ratio or "9:16").strip()
    if ":" not in ar:
        ar = "9:16"
    if _segment_v2_video_prompt_pass_through(segment):
        prompt, budget = _v2_pass_through_segment_prompt(segment, project_id=project_id)
    else:
        prompt, budget = _budgeted_segment_prompt(segment, aspect_ratio=ar, project_id=project_id)
    execution_shots = [s.model_dump() if hasattr(s, "model_dump") else dict(s) for s in (segment.shots or [])]
    _trace(
        "S4_VIDEO_BUILDER_INPUT",
        {
            "segment_id": segment.segment_id,
            "execution_shots": execution_shots,
            "asset_refs": {
                "character_refs": list(dict.fromkeys([r for s in segment.shots for r in _effective_character_refs(s)])),
                "scene_refs": list(dict.fromkeys([_effective_scene_ref(s) for s in segment.shots if _effective_scene_ref(s)])),
                "product_refs": list(dict.fromkeys([r for s in segment.shots for r in _effective_product_refs(s)])),
            },
            "visual_action": [str(_get_shot_value(s, "visual_action", "") or _get_shot_value(s, "action_description", "")) for s in segment.shots],
            "shot_video_prompt": [str(_get_shot_value(s, "video_prompt", "") or "") for s in segment.shots],
            "segment_video_prompt": "",
        },
    )
    duration = _duration_for_segment(segment)
    logger.info(
        "[S4_VIDEO_PROMPT_BUDGET] segment_id=%s before_chars=%s after_chars=%s truncated=%s dropped_sections=%s final_prompt_preview=%s",
        segment.segment_id,
        budget["before_chars"],
        budget["after_chars"],
        budget["truncated"],
        budget["dropped_sections"],
        budget["final_prompt_preview"],
    )

    cmap = _char_by_name(characters)
    smap = _scene_by_name(scenes)
    smap_id = _scene_by_id(scenes)
    pmap = _product_by_name(products)
    pmap_id = _product_by_id(products)

    character_ref_urls: list[str] = []
    scene_ref_urls: list[str] = []
    product_ref_urls: list[str] = []
    selected_character_names: list[str] = []
    requested_product_refs: list[str] = []
    character_asset_ids = list(dict.fromkeys([asset_id for s in segment.shots for asset_id in _shot_character_asset_ids(s)]))
    clean_character_asset_ids = _clean_asset_ids_int(character_asset_ids)
    resolved_character_assets = resolved_character_assets or {}
    scene_asset_id = next((sid for s in segment.shots for sid in [_shot_scene_asset_id(s)] if sid), "")
    product_asset_id = next((pid for s in segment.shots for pid in [_shot_product_asset_id(s)] if pid), "")

    for shot in segment.shots:
        # If explicit character asset ids exist, do id-only strict lookup and never fallback to names.
        if clean_character_asset_ids:
            for asset_id in clean_character_asset_ids:
                resolved = resolved_character_assets.get(asset_id)
                if resolved and str(resolved.get("image_url") or "").strip():
                    character_ref_urls.append(str(resolved.get("image_url") or "").strip())
                    selected_character_names.append(str(resolved.get("name") or "").strip())
        else:
            for cref in _effective_character_refs(shot):
                raw = str(cref).strip()
                if not raw:
                    continue
                row = cmap.get(_norm_name(raw))
                if row and row.image_url:
                    character_ref_urls.append(row.image_url)
                    selected_character_names.append(str(row.name or "").strip())
        if scene_asset_id:
            row = smap_id.get(scene_asset_id)
            if row and row.image_url:
                scene_ref_urls.append(row.image_url)
        else:
            sref = _norm_name(str(_effective_scene_ref(shot)))
            if sref:
                row = smap.get(sref)
                if row and row.image_url:
                    scene_ref_urls.append(row.image_url)
        if product_asset_id:
            row = pmap_id.get(product_asset_id)
            if row and row.image_url:
                product_ref_urls.append(row.image_url)
        else:
            for pref in _effective_product_refs(shot):
                requested_product_refs.append(pref)
                raw = str(pref).strip()
                row = pmap.get(_norm_name(raw))
                if row and row.image_url:
                    product_ref_urls.append(row.image_url)

    if not requested_product_refs and not product_asset_id:
        if not _segment_v2_video_prompt_pass_through(segment):
            for p in sorted(products, key=lambda x: x.id):
                if p.image_url:
                    product_ref_urls.append(p.image_url)

    ref_urls = _dedupe_preserve(character_ref_urls + scene_ref_urls + product_ref_urls)
    selected_character_names = _dedupe_preserve(selected_character_names)
    if not ref_urls:
        raise ShortDramaVideoInputError(
            f"Segment {segment.segment_id!r} has no reference images "
            "(character/scene/product image_url required for reference-to-video)"
        )
    if len(ref_urls) > _MAX_REFS:
        ref_urls = ref_urls[:_MAX_REFS]
    manual_video_prompt_used = any(str(_get_shot_value(s, "manual_video_prompt", "") or "").strip() for s in segment.shots)
    manual_refs_used = _manual_refs_used(segment)
    prompt_source = "v2_video_generation_specs" if _segment_v2_video_prompt_pass_through(segment) else "ai_shot_video_prompt"
    _trace(
        "S4_VIDEO_BUILDER_OUTPUT",
        {
            "segment_id": segment.segment_id,
            "segment_video_prompt": prompt,
            "prompt_source": prompt_source,
            "used_fields": (
                ["video_prompt_v2_pass_through"]
                if _segment_v2_video_prompt_pass_through(segment)
                else ["visual_action", "scene_ref", "character_refs", "product_refs", "must_show", "must_avoid"]
            ),
            "discarded_fields": budget.get("dropped_sections", []),
            "final_prompt_length": len(prompt),
        },
    )
    logger.info(
        "[S4_MANUAL_OVERRIDE_APPLIED] segment_id=%s shot_id=%s manual_video_prompt_used=%s manual_refs_used=%s final_prompt_chars=%s",
        segment.segment_id,
        ",".join(
            [
                str(_get_shot_value(s, "shot_id", "") or "")
                for s in segment.shots
                if str(_get_shot_value(s, "manual_video_prompt", "") or "").strip()
                or (_get_shot_value(s, "manual_character_refs", []) or [])
                or str(_get_shot_value(s, "manual_scene_ref", "") or "").strip()
                or (_get_shot_value(s, "manual_product_refs", []) or [])
            ]
        )
        or "",
        manual_video_prompt_used,
        manual_refs_used,
        len(prompt),
    )

    return SegmentVideoPlan(
        segment_id=segment.segment_id,
        segment_video_prompt=prompt,
        selected_reference_image_urls=ref_urls,
        duration_seconds=duration,
        aspect_ratio=ar,
        resolution="720p",
        prompt_budget=budget,
        execution_input={
            "segment_id": segment.segment_id,
            "shot_ids": [str(_get_shot_value(s, "shot_id", "") or "") for s in segment.shots],
            "video_prompt": prompt,
            "duration_limit": duration,
            "manual_video_prompt_used": manual_video_prompt_used,
            "manual_refs_used": manual_refs_used,
            "character_refs": list(dict.fromkeys([r for s in segment.shots for r in _effective_character_refs(s)])),
            "character_asset_ids": character_asset_ids,
            "character_names": selected_character_names,
            "scene_ref": list(dict.fromkeys([_effective_scene_ref(s) for s in segment.shots if _effective_scene_ref(s)])),
            "scene_asset_id": scene_asset_id,
            "product_refs": list(dict.fromkeys([r for s in segment.shots for r in _effective_product_refs(s)])),
            "product_asset_id": product_asset_id,
            "must_show": list(
                dict.fromkeys([r for s in segment.shots for r in (_get_shot_value(s, "must_show", []) or [])])
            ),
            "must_avoid": list(
                dict.fromkeys([r for s in segment.shots for r in (_get_shot_value(s, "must_avoid", []) or [])])
            ),
            "source_selling_point": list(
                dict.fromkeys(
                    [
                        str(_get_shot_value(s, "source_selling_point", "") or "")
                        for s in segment.shots
                        if str(_get_shot_value(s, "source_selling_point", "") or "")
                    ]
                )
            ),
            "source_visual_constraints": [
                _get_shot_value(s, "source_visual_constraints", {})
                for s in segment.shots
                if _get_shot_value(s, "source_visual_constraints", {})
            ],
            "dialogue_texts": [
                str(
                    _get_shot_value(s, "dialogue_text", "")
                    or _get_shot_value(s, "spoken_text", "")
                    or _get_shot_value(s, "dialogue", "")
                    or ""
                ).strip()
                for s in segment.shots
                if str(
                    _get_shot_value(s, "dialogue_text", "")
                    or _get_shot_value(s, "spoken_text", "")
                    or _get_shot_value(s, "dialogue", "")
                    or ""
                ).strip()
            ],
            "voiceover_texts": [
                str(
                    _get_shot_value(s, "voiceover_text", "")
                    or _get_shot_value(s, "voiceover", "")
                    or _get_shot_value(s, "narration", "")
                    or ""
                ).strip()
                for s in segment.shots
                if str(
                    _get_shot_value(s, "voiceover_text", "")
                    or _get_shot_value(s, "voiceover", "")
                    or _get_shot_value(s, "narration", "")
                    or ""
                ).strip()
            ],
            "subtitle_texts": [
                str(_get_shot_value(s, "subtitle_text", "") or _get_shot_value(s, "subtitle", "") or "").strip()
                for s in segment.shots
                if str(_get_shot_value(s, "subtitle_text", "") or _get_shot_value(s, "subtitle", "") or "").strip()
            ],
            "audio_required": any(
                bool(
                    _get_shot_value(s, "audio_required", False)
                    or str(_get_shot_value(s, "dialogue_text", "") or _get_shot_value(s, "spoken_text", "") or _get_shot_value(s, "dialogue", "") or "").strip()
                    or str(_get_shot_value(s, "voiceover_text", "") or _get_shot_value(s, "voiceover", "") or _get_shot_value(s, "narration", "") or "").strip()
                )
                for s in segment.shots
            ),
            "subtitle_required": any(
                bool(
                    _get_shot_value(s, "subtitle_required", False)
                    or str(_get_shot_value(s, "subtitle_text", "") or _get_shot_value(s, "subtitle", "") or "").strip()
                )
                for s in segment.shots
            ),
            "audio_status": "pending_tts_or_dubbing",
            "aspect_ratio": ar,
            "reference_image_urls": ref_urls,
            "prompt_budget": budget,
        },
    )
