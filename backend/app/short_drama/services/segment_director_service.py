from __future__ import annotations

import logging
import json
import re
from collections import OrderedDict
from typing import Any, Dict, Protocol

from ...config import settings
from ..exceptions import ShortDramaInvalidModelOutputError
from ..providers.xai_text_provider import XAITextProvider, get_xai_text_provider
from ..schemas.asset import AssetSpecsBundleSchema
from ..schemas.segment import SegmentScriptSchema, ShotSchema
from ..schemas.story import (
    AssetGenerationSpecSchema,
    DialogueOrVoiceoverItemSchema,
    SegmentPlanItemSchema,
    StoryBlueprintSchema,
    VideoGenerationSpecSchema,
)
from ..utils.prompts import SEGMENT_DIRECTOR_SYSTEM_PROMPT
from ..utils.segment_slots import (
    _DEFAULT_CAMERA_STILL,
    compose_image_prompt_from_slots,
    compose_video_prompt_from_slots,
    filled_slot_count,
    fill_one_missing_slot,
    log_slot_raw,
    missing_slot_field_names,
    validate_composed_prompt_text,
)

logger = logging.getLogger(__name__)
_PROVIDER_MAX_DURATION_SECONDS = 10.0


def _provider_safe_duration(value: Any, *, segment_id: str) -> float:
    duration = max(1.0, float(value or 0.0))
    if duration > _PROVIDER_MAX_DURATION_SECONDS:
        raise ShortDramaInvalidModelOutputError(
            (
                f"S2 segment {segment_id} duration {duration} exceeds provider maximum "
                f"{_PROVIDER_MAX_DURATION_SECONDS}; repair S2 by shortening or splitting this segment."
            ),
            segment_id=segment_id,
            code="s2_provider_duration_exceeded",
            missing_fields=["duration_seconds"],
        )
    return duration


def _reject_v2_for_legacy_s4_entrypoints(blueprint: StoryBlueprintSchema, *, entry: str) -> None:
    """Hard guard: creative_blueprint_v2 must use video_generation_specs materialization only."""
    from .asset_v2_materialize_service import is_creative_blueprint_v2_project

    if is_creative_blueprint_v2_project(blueprint):
        raise ShortDramaInvalidModelOutputError(
            f"{entry} is forbidden for creative_blueprint_v2; use materialize_segment_scripts_from_v2_video_generation_specs.",
            code="s4_v2_legacy_segment_path_forbidden",
            missing_fields=["video_generation_specs"],
        )


def _blueprint_visual_requirements_list(blueprint: StoryBlueprintSchema) -> list[str]:
    v = blueprint.visual_requirements
    if isinstance(v, list):
        return [str(x).strip() for x in v if str(x or "").strip()]
    if isinstance(v, str) and v.strip():
        return [v.strip()]
    return []


def _blueprint_selling_point_mapping_dict(blueprint: StoryBlueprintSchema) -> dict[str, str]:
    m = blueprint.product_selling_point_mapping
    if not isinstance(m, dict):
        return {}
    out: dict[str, str] = {}
    for k, v in m.items():
        out[str(k)] = str(v) if v is not None else ""
    return out


def _trace(tag: str, payload: dict[str, Any]) -> None:
    logger.info("[AI_CHAIN_TRACE][%s] %s", tag, json.dumps(payload, ensure_ascii=False, default=str))

def _first_character_ref(assets: AssetSpecsBundleSchema | None) -> str:
    if not assets or not assets.characters:
        return ""
    primary = next((x for x in assets.characters if str(x.role_type or "").lower() in {"main", "protagonist", "lead"}), None)
    pick = primary or assets.characters[0]
    return str(pick.id) if pick.id is not None else pick.name


def _first_scene_ref(assets: AssetSpecsBundleSchema | None) -> str:
    if not assets or not assets.scenes:
        return ""
    pick = assets.scenes[0]
    return str(pick.id) if pick.id is not None else pick.name


def _first_product_ref(assets: AssetSpecsBundleSchema | None) -> str:
    if not assets or not assets.products:
        return ""
    hero = next((x for x in assets.products if str(x.product_role or "").lower() in {"hero", "main", "primary"}), None)
    pick = hero or assets.products[0]
    return str(pick.id) if pick.id is not None else pick.name


CREATIVE_BLUEPRINT_V2_SCHEMA_VERSION = "creative_blueprint_v2"


def s2_video_specs_materialization_eligible(
    blueprint: StoryBlueprintSchema,
    *,
    force_segment_director: bool = False,
) -> tuple[bool, str]:
    if force_segment_director:
        return False, "force_segment_director"
    if str(blueprint.blueprint_schema_version or "").strip() != CREATIVE_BLUEPRINT_V2_SCHEMA_VERSION:
        return False, "not_creative_blueprint_v2"
    specs = list(blueprint.video_generation_specs or [])
    if not specs:
        return False, "video_generation_specs_empty"
    if not any(str(s.video_prompt or "").strip() for s in specs):
        return False, "all_video_prompts_empty"
    return True, ""


def _dialogue_line_text(item: DialogueOrVoiceoverItemSchema) -> str:
    speaker = str(item.speaker or "").strip()
    text = str(item.text or "").strip()
    if speaker and text:
        return f"{speaker}：{text}"
    return text


def _segment_title_from_plan(plan_row: SegmentPlanItemSchema | None, *, segment_id: str) -> str:
    if not plan_row:
        return segment_id
    return (
        str(plan_row.segment_title or "").strip()
        or str(plan_row.title or "").strip()
        or str(plan_row.stage_name or "").strip()
        or segment_id
    )


def _truncate_visual_action_fallback(video_prompt: str, *, limit: int = 280) -> str:
    s = re.sub(r"\s+", " ", str(video_prompt or "")).strip()
    if not s:
        return ""
    return s[:limit]


def _pad_min_composed_prompt(text: str, *, floor: int = 30) -> str:
    t = re.sub(r"\s+", " ", str(text or "")).strip()
    if len(t) >= floor:
        return t
    pad = " Vertical 9:16 commercial framing with readable contrast and clear subject motion."
    return (t + pad).strip()


def _workflow_lang_is_zh_cn(workflow_language: str) -> bool:
    wl = (workflow_language or "").strip().lower()
    return wl.startswith("zh") or "hans" in wl or ("cn" in wl and "zh" in wl)


def _looks_like_ascii_english_primary(text: str) -> bool:
    t = (text or "").strip()
    if len(t) < 10:
        return False
    if re.search(r"[\u3040-\u30ff\u4e00-\u9fff\uac00-\ud7af]", t):
        return False
    letters = len(re.findall(r"[A-Za-z]", t))
    non_space = len(re.sub(r"\s+", "", t))
    if non_space < 8:
        return False
    return letters / max(non_space, 1) >= 0.45


def _reference_includes_product_kind(
    reference_asset_keys: list[str],
    ag_by_key: dict[str, AssetGenerationSpecSchema],
) -> bool:
    for rk in reference_asset_keys or []:
        ag = ag_by_key.get(str(rk or "").strip())
        if ag and str(ag.asset_kind or "").strip().lower() == "product":
            return True
    return False


def _scene_display_name_for_bind(bind: dict[str, Any], assets: AssetSpecsBundleSchema) -> str:
    sr = str(bind.get("scene_ref") or "").strip()
    if sr.isdigit():
        for s in assets.scenes:
            if str(s.id) == sr:
                return str(s.name or "").strip() or sr
    for s in assets.scenes:
        if _norm_lower(s.name) == _norm_lower(sr):
            return str(s.name or "").strip()
    return sr or ""


def _selling_point_for_segment(blueprint: StoryBlueprintSchema, segment_id: str) -> str:
    m = blueprint.product_selling_point_mapping
    if isinstance(m, dict):
        v = m.get(segment_id)
        if v is None:
            v = m.get(str(segment_id))
        if v:
            return str(v).strip()
    return ""


def _first_non_empty_plan_text(plan_row: SegmentPlanItemSchema | None, *attrs: str) -> str:
    if not plan_row:
        return ""
    for a in attrs:
        t = str(getattr(plan_row, a, "") or "").strip()
        if t:
            return t
    return ""


def _must_show_zh_phrase(must_show: list[str]) -> str:
    parts = [str(x).strip() for x in (must_show or []) if str(x).strip()]
    if not parts:
        return ""
    return f"本段重点呈现：{'、'.join(parts[:8])}。"


def _spoken_voiceover_subtitle_for_ref(blueprint: StoryBlueprintSchema, dref: str) -> tuple[str, str, str, str]:
    """(spoken_text, dialogue, voiceover_text, subtitle_text) for ShotSchema; no English prompt fallback."""
    ref = str(dref or "").strip()
    if not ref:
        return "", "", "", ""
    it = next((x for x in (blueprint.dialogue_or_voiceover or []) if str(x.ref_id or "").strip() == ref), None)
    if not it:
        return "", "", "", ""
    mode = str(it.mode or "voiceover").strip().lower()
    line = _dialogue_line_text(it)
    plain = str(it.text or "").strip()
    spk = str(it.speaker or "").strip()
    if mode == "silent":
        return "", "", "", ""
    if mode in ("subtitle_only", "subtitle", "caption", "onscreen_text", "on_screen_text", "screen_text"):
        body = line or plain
        return "", "", "", body
    if mode == "dialogue":
        body = line if line else (f"{spk}：{plain}" if spk and plain else plain)
        return body, body, "", ""
    if mode in ("voiceover", "narration"):
        body = line if line else (f"{spk}：{plain}" if spk and plain else plain)
        return "", "", body, ""
    body = line or plain
    return "", "", body, ""


def _build_s2_presentation_strings(
    *,
    blueprint: StoryBlueprintSchema,
    plan_row: SegmentPlanItemSchema | None,
    segment_title: str,
    segment_id: str,
    must_show: list[str],
    bind: dict[str, Any],
    assets: AssetSpecsBundleSchema,
    visual_action_raw: str,
    workflow_language: str,
) -> tuple[str, str, str, str, str]:
    """Returns (viewer_takeaway, visual_direction, character_action, scene_direction, product_purpose)."""
    wf_zh = _workflow_lang_is_zh_cn(workflow_language)
    va_raw = (visual_action_raw or "").strip()

    if not wf_zh:
        summary_any = _first_non_empty_plan_text(plan_row, "summary", "segment_goal", "goal", "key_message")
        sg = _first_non_empty_plan_text(plan_row, "segment_goal", "goal", "story_beat") or segment_title
        viewer = summary_any or f"Understand the beat for «{segment_title}»."
        screen = (
            f"Visual direction for «{segment_title}»"
            + (f", emphasizing {sg}." if sg else ".")
        )
        character = va_raw or sg or viewer
        scene_dir = (
            str(bind.get("scene_description") or "").strip()
            or "Keep spatial and lighting continuity with the selected scene asset."
        )
        sell = _selling_point_for_segment(blueprint, segment_id)
        product_purpose = sell or ("Not specified" if not must_show else ", ".join(str(x) for x in must_show[:6]))
        if not product_purpose.strip():
            product_purpose = "Not specified"
        return viewer, screen, character, scene_dir, product_purpose

    summary_pick = _first_non_empty_plan_text(plan_row, "summary", "segment_goal", "goal", "key_message")
    if wf_zh and summary_pick and _looks_like_ascii_english_primary(summary_pick):
        summary_pick = ""

    segment_goal = _first_non_empty_plan_text(plan_row, "segment_goal", "goal", "story_beat") or segment_title
    if wf_zh and segment_goal and _looks_like_ascii_english_primary(segment_goal):
        segment_goal = segment_title

    viewer = summary_pick
    if not viewer:
        ms_line = _must_show_zh_phrase(must_show)
        if ms_line:
            viewer = ms_line
    if not viewer:
        viewer = f"本段展示「{segment_title}」，让观众理解核心信息。"
    if wf_zh and viewer and _looks_like_ascii_english_primary(viewer):
        viewer = f"本段展示「{segment_title}」，让观众理解核心信息。"

    scene_name = _scene_display_name_for_bind(bind, assets)
    sum_hint = summary_pick or _first_non_empty_plan_text(plan_row, "segment_goal", "goal") or ""
    if wf_zh and sum_hint and _looks_like_ascii_english_primary(sum_hint):
        sum_hint = ""
    screen = f"围绕「{segment_title}」展开画面"
    if sum_hint:
        screen += f"，突出{sum_hint}"
    screen += "。"
    if scene_name and not scene_name.isdigit():
        screen = f"在「{scene_name}」中呈现镜头节奏；{screen}"

    va = (visual_action_raw or "").strip()
    if va and not (wf_zh and _looks_like_ascii_english_primary(va)):
        character = va
    else:
        character = f"主角完成与「{segment_title}」相关的动作，表现{segment_goal}。"

    scene_dir = str(bind.get("scene_description") or "").strip()
    if not scene_dir or (wf_zh and _looks_like_ascii_english_primary(scene_dir)):
        tail = f"场景：「{scene_name}」。" if scene_name else ""
        scene_dir = f"使用对应场景资产，保持空间与光线一致。{tail}".strip()

    sell = _selling_point_for_segment(blueprint, segment_id)
    product_purpose = sell
    if not product_purpose.strip():
        zh_parts = [str(x).strip() for x in must_show if str(x).strip() and not _looks_like_ascii_english_primary(str(x))]
        if zh_parts:
            product_purpose = f"与产品相关的展示重点：{'、'.join(zh_parts[:6])}。"
    if not product_purpose.strip():
        product_purpose = "未指定"
    if wf_zh and product_purpose != "未指定" and _looks_like_ascii_english_primary(product_purpose):
        product_purpose = "未指定"

    return viewer, screen, character, scene_dir, product_purpose


def _norm_lower(s: str) -> str:
    return str(s or "").strip().lower()


def _character_display_hint(blueprint: StoryBlueprintSchema, linked_key: str) -> str:
    for c in blueprint.characters or []:
        if str(c.character_key or "").strip() == linked_key:
            return str(c.display_name or "").strip() or str(c.description or "").strip()[:120]
    return ""


def _scene_display_hint(blueprint: StoryBlueprintSchema, linked_key: str) -> str:
    for s in blueprint.scenes or []:
        if str(s.scene_key or "").strip() == linked_key:
            return str(s.display_name or "").strip() or str(s.description or "").strip()[:160]
    return ""


def _product_display_hint(blueprint: StoryBlueprintSchema, linked_key: str) -> str:
    for p in blueprint.product_assets or []:
        if str(p.product_asset_key or "").strip() == linked_key:
            return str(p.display_name or p.product_name or "").strip() or str(p.description or "").strip()[:160]
    return ""


def _find_character_asset_row(assets: AssetSpecsBundleSchema, hint: str) -> Any:
    hint_l = _norm_lower(hint)
    for c in assets.characters:
        nm = _norm_lower(c.name)
        if hint_l and nm == hint_l:
            return c
    for c in assets.characters:
        nm = _norm_lower(c.name)
        if hint_l and (hint_l in nm or nm in hint_l):
            return c
    return None


def _find_scene_asset_row(assets: AssetSpecsBundleSchema, hint: str) -> Any:
    hint_l = _norm_lower(hint)
    for s in assets.scenes:
        nm = _norm_lower(s.name)
        if hint_l and nm == hint_l:
            return s
    for s in assets.scenes:
        nm = _norm_lower(s.name)
        if hint_l and (hint_l in nm or nm in hint_l):
            return s
    return None


def _find_product_asset_row(assets: AssetSpecsBundleSchema, hint: str) -> Any:
    hint_l = _norm_lower(hint)
    for p in assets.products:
        nm = _norm_lower(p.name)
        if hint_l and nm == hint_l:
            return p
    for p in assets.products:
        nm = _norm_lower(p.name)
        if hint_l and (hint_l in nm or nm in hint_l):
            return p
    return None


def _bind_reference_asset_keys_for_s4(
    project_id: int,
    reference_asset_keys: list[str],
    ag_by_key: dict[str, AssetGenerationSpecSchema],
    blueprint: StoryBlueprintSchema,
    assets: AssetSpecsBundleSchema,
) -> dict[str, Any]:
    character_refs: list[str] = []
    character_asset_ids: list[str] = []
    product_refs: list[str] = []
    scene_ref = ""
    scene_asset_id = ""
    product_asset_id = ""

    def _warn(ref_key: str) -> None:
        logger.warning("[S4_ASSET_REF_BIND_WARNING] project_id=%s reference_asset_key=%s", project_id, ref_key)

    for rk in reference_asset_keys or []:
        key = str(rk or "").strip()
        if not key:
            continue
        ag = ag_by_key.get(key)
        if not ag:
            _warn(key)
            continue
        kind = str(ag.asset_kind or "").strip().lower()
        lk = str(ag.linked_entity_key or "").strip()
        disp = str(ag.display_name or "").strip()

        if kind == "character":
            hint = _character_display_hint(blueprint, lk) or disp
            row = _find_character_asset_row(assets, hint)
            if row is None and len(assets.characters) == 1:
                row = assets.characters[0]
            if row is not None and row.id is not None:
                sid = str(row.id)
                if sid not in character_asset_ids:
                    character_asset_ids.append(sid)
                if sid not in character_refs:
                    character_refs.append(sid)
            else:
                _warn(key)
        elif kind == "scene":
            hint = _scene_display_hint(blueprint, lk) or disp
            row = _find_scene_asset_row(assets, hint)
            if row is None and len(assets.scenes) == 1:
                row = assets.scenes[0]
            if row is not None:
                if row.id is not None:
                    scene_ref = str(row.id)
                    scene_asset_id = str(row.id)
                else:
                    scene_ref = str(row.name or "").strip()
            else:
                _warn(key)
        elif kind == "product":
            hint = _product_display_hint(blueprint, lk) or disp
            row = _find_product_asset_row(assets, hint)
            if row is None and len(assets.products) == 1:
                row = assets.products[0]
            if row is not None and row.id is not None:
                pid = str(row.id)
                if pid not in product_refs:
                    product_refs.append(pid)
                if not product_asset_id:
                    product_asset_id = pid
            else:
                _warn(key)
        else:
            _warn(key)

    if not character_refs:
        fr = _first_character_ref(assets)
        if fr:
            character_refs = [fr]
            if fr.isdigit() and fr not in character_asset_ids:
                character_asset_ids.append(fr)
    if not scene_ref:
        sr = _first_scene_ref(assets)
        if sr:
            scene_ref = sr
            if sr.isdigit():
                scene_asset_id = sr

    scene_description = ""
    if scene_ref.isdigit():
        for s in assets.scenes:
            if str(s.id) == scene_ref:
                scene_description = str(s.description or s.name or "").strip() or str(s.name or "")
                break
    else:
        for s in assets.scenes:
            if _norm_lower(s.name) == _norm_lower(scene_ref):
                scene_description = str(s.description or s.name or "").strip() or str(s.name or "")
                break
    if not scene_description.strip():
        scene_description = (
            str(assets.scenes[0].description or assets.scenes[0].name or "").strip()
            if assets.scenes
            else "Commercial location continuity."
        )

    subject_description = ""
    if character_refs:
        cref = character_refs[0]
        for c in assets.characters:
            if c.id is not None and str(c.id) == cref:
                subject_description = str(c.description or c.name or "").strip() or str(c.name or "")
                break
            if c.id is None and cref == str(c.name or "").strip():
                subject_description = str(c.description or c.name or "").strip() or str(c.name or "")
                break
    if not subject_description.strip():
        subject_description = (
            str(assets.characters[0].description or assets.characters[0].name or "").strip()
            if assets.characters
            else "Lead subject in frame with clear silhouette."
        )

    return {
        "character_refs": character_refs,
        "character_asset_ids": character_asset_ids,
        "scene_ref": scene_ref,
        "scene_asset_id": scene_asset_id,
        "product_refs": product_refs,
        "product_asset_id": product_asset_id,
        "scene_description": scene_description or "Location and blocking continuity for the segment.",
        "subject_description": subject_description or "Subject blocking and wardrobe continuity for the segment.",
    }


def materialize_segment_scripts_from_s2_video_specs(
    project_id: int,
    blueprint: StoryBlueprintSchema,
    assets: AssetSpecsBundleSchema,
    *,
    workflow_language: str = "",
) -> list[SegmentScriptSchema]:
    specs = list(blueprint.video_generation_specs or [])
    wf_lang = workflow_language or str((blueprint.language_policy or {}).get("workflow_language") or "")
    ag_by_key = {
        str(a.asset_key or "").strip(): a
        for a in (blueprint.asset_generation_specs or [])
        if str(a.asset_key or "").strip()
    }
    buckets: OrderedDict[str, list[VideoGenerationSpecSchema]] = OrderedDict()
    for sp in specs:
        sid = str(sp.segment_id or "").strip() or "seg_1"
        buckets.setdefault(sid, []).append(sp)

    segments_out: list[SegmentScriptSchema] = []
    for segment_id, seg_specs in buckets.items():
        plan_row = next(
            (p for p in (blueprint.segment_plan or []) if str(p.segment_id or "").strip() == segment_id),
            None,
        )
        title = _segment_title_from_plan(plan_row, segment_id=segment_id)
        duration_limit = 0.0
        if plan_row is not None:
            duration_limit = float(plan_row.duration_sec or plan_row.duration_seconds or 0.0)
        if duration_limit <= 0:
            duration_limit = max(float(s.duration_sec or 0.0) for s in seg_specs) or 6.0
        duration_limit = _provider_safe_duration(duration_limit, segment_id=segment_id)

        function_label = ""
        if plan_row is not None:
            function_label = str(plan_row.stage_name or plan_row.goal or plan_row.segment_goal or "").strip()

        shots: list[ShotSchema] = []
        default_per = duration_limit / max(1, len(seg_specs))
        for shot_i, spec in enumerate(seg_specs):
            vp = str(spec.video_prompt or "").strip()
            va_exec = str(spec.visual_action or "").strip() or _truncate_visual_action_fallback(vp)
            if not va_exec.strip():
                va_exec = _pad_min_composed_prompt(vp)[:280]

            dref = str(spec.dialogue_or_voiceover_ref or "").strip()
            spoken_t, dialogue_t, vtext, subtxt = _spoken_voiceover_subtitle_for_ref(blueprint, dref)

            bind = _bind_reference_asset_keys_for_s4(
                project_id, list(spec.reference_asset_keys or []), ag_by_key, blueprint, assets
            )

            d_sec = float(spec.duration_sec or 0.0)
            if d_sec <= 0:
                d_sec = default_per
            d_sec = _provider_safe_duration(d_sec, segment_id=segment_id)
            if d_sec > duration_limit:
                raise ShortDramaInvalidModelOutputError(
                    (
                        f"S2 video_generation_specs segment {segment_id} duration {d_sec} exceeds segment "
                        f"duration {duration_limit}; repair S2 so durations are coherent."
                    ),
                    segment_id=segment_id,
                    code="s2_segment_duration_mismatch",
                    missing_fields=["video_generation_specs.duration_sec"],
                )

            shot_id = str(spec.shot_id or "").strip() or str(spec.spec_key or "").strip() or f"{segment_id}_shot_{shot_i + 1}"

            raw_spec = spec.model_dump()
            has_product_ref = _reference_includes_product_kind(list(spec.reference_asset_keys or []), ag_by_key)
            source_visual = {
                "s2_video_generation_spec": raw_spec,
                "segment_script_source": "s2_video_generation_specs",
                "reference_asset_keys": list(spec.reference_asset_keys or []),
                "dialogue_or_voiceover_ref": dref,
                "dialogue_or_voiceover_text": vtext or spoken_t or subtxt,
                "aspect_ratio": str(spec.aspect_ratio or ""),
                "s2_ui_product_presence": "explicit" if has_product_ref else "none",
            }

            scene_description = str(bind.get("scene_description") or "").strip()
            subject_description = str(bind.get("subject_description") or "").strip()
            camera_description = str(spec.camera or "").strip() or _DEFAULT_CAMERA_STILL
            audio_notes = str(spec.audio_notes or "").strip()

            ms = list(spec.must_show or []) if spec.must_show is not None else []
            ma = list(spec.must_avoid or []) if spec.must_avoid is not None else []

            pres_v, pres_scr, pres_char, pres_scene, pres_prod = _build_s2_presentation_strings(
                blueprint=blueprint,
                plan_row=plan_row,
                segment_title=title,
                segment_id=segment_id,
                must_show=ms,
                bind=bind,
                assets=assets,
                visual_action_raw=str(spec.visual_action or "").strip(),
                workflow_language=wf_lang,
            )
            sell_line = _selling_point_for_segment(blueprint, segment_id)
            if wf_lang and sell_line and _looks_like_ascii_english_primary(sell_line):
                sell_line = ""

            shots.append(
                ShotSchema(
                    shot_id=shot_id,
                    shot_title=str(spec.spec_key or shot_id),
                    shot_role=str(spec.spec_key or ""),
                    shot_type="s2_video_spec",
                    scene_ref=str(bind.get("scene_ref") or ""),
                    scene_id=str(bind.get("scene_ref") or ""),
                    character_refs=list(bind.get("character_refs") or []),
                    character_ids=list(bind.get("character_refs") or []),
                    character_asset_ids=[str(x) for x in (bind.get("character_asset_ids") or []) if str(x).strip()],
                    product_refs=list(bind.get("product_refs") or []),
                    product_ids=list(bind.get("product_refs") or []),
                    scene_asset_id=str(bind.get("scene_asset_id") or ""),
                    product_asset_id=str(bind.get("product_asset_id") or ""),
                    visual_action=va_exec,
                    action_description=va_exec,
                    scene_description=scene_description,
                    subject_description=subject_description,
                    camera_description=camera_description,
                    camera=str(spec.camera or "").strip(),
                    image_prompt=_pad_min_composed_prompt(vp),
                    video_prompt=vp,
                    generation_prompt=vp,
                    duration_seconds=d_sec,
                    duration_sec=d_sec,
                    spoken_text=spoken_t,
                    dialogue=dialogue_t,
                    voiceover_text=vtext,
                    voiceover=vtext or None,
                    narration=vtext or "",
                    subtitle_text=subtxt,
                    subtitle=subtxt,
                    must_show=ms,
                    must_avoid=ma,
                    required_assets=[
                        *(bind.get("character_refs") or []),
                        str(bind.get("scene_ref") or ""),
                        *(bind.get("product_refs") or []),
                    ],
                    source_segment_id=segment_id,
                    source_visual_constraints=source_visual,
                    audio_intent=audio_notes or "",
                    presentation_viewer_takeaway=pres_v,
                    presentation_visual_direction=pres_scr,
                    presentation_character_action=pres_char,
                    presentation_scene_direction=pres_scene,
                    presentation_product_purpose=pres_prod,
                    source_selling_point=sell_line,
                )
            )

        segments_out.append(
            SegmentScriptSchema(
                segment_id=segment_id,
                title=title,
                duration_limit=duration_limit,
                goal=str(plan_row.goal or plan_row.segment_goal or "") if plan_row is not None else "",
                shots=shots,
                meta={
                    "source": "s2_video_generation_specs",
                    "function_label": function_label or title,
                },
            )
        )

    shot_total = sum(len(s.shots) for s in segments_out)
    logger.info(
        "[S4_SEGMENT_SCRIPT_MATERIALIZED] project_id=%s segment_count=%s shot_count=%s",
        project_id,
        len(segments_out),
        shot_total,
    )
    return segments_out


def _default_shot_count(segment_duration: float) -> int:
    if segment_duration >= 14:
        return 4
    if segment_duration >= 8:
        return 3
    return 2


def _framework_functions(framework_type: str, count: int) -> list[str]:
    table = {
        "brand_seeding": ["生活场景+情绪共鸣", "产品自然出现+使用细节", "氛围强化+记忆点"],
        "scene_pain_solution": ["生活场景", "情绪共鸣", "产品自然出现", "氛围强化", "记忆点"],
        "problem_solution_ad": ["痛点暴露", "风险放大", "产品介入", "结果证明", "行动号召"],
        "product_demo_ad": ["产品亮相", "功能细节", "使用场景", "效果展示", "购买理由"],
        "story_drama": ["人物设定", "本集冲突", "产品/主题植入", "关系推进", "悬念钩子"],
        "twist_reveal": ["反常开场", "误导信息", "反转揭示", "产品证明", "记忆点收束"],
        "aida": ["注意", "兴趣", "欲望", "行动"],
        "pas": ["问题", "放大", "解决"],
        "before_after_bridge": ["之前状态", "问题对比", "桥接方案", "之后结果", "选择理由"],
        "ugc_review": ["真实开场", "体验过程", "细节评价", "结果反馈", "推荐理由"],
        "unboxing_review": ["开箱亮相", "外观细节", "上手体验", "使用感受", "购买理由"],
        "pain_point_conversion": ["痛点暴露", "产品介入", "结果证明+行动号召"],
        "product_demo": ["产品亮相", "功能细节", "使用场景+购买理由"],
        "trust_building": ["信任场景", "证据/背书", "可信结果"],
        "corporate_promo": ["行业场景/问题", "企业能力", "价值结果/品牌信任"],
        "comparison": ["旧方式/竞品不便", "产品对比优势", "选择理由/结果强化"],
        "promotion": ["活动利益点", "使用场景/产品价值", "限时行动号召"],
        "series_story": ["本集情境", "人物推进", "悬念/下一集钩子"],
    }
    base = table.get(framework_type, ["开场", "推进", "收束"])
    if count <= len(base):
        return base[:count]
    out = [*base]
    while len(out) < count:
        out.insert(-1, f"{base[min(1, len(base)-1)]}·扩展{len(out)-1}")
    return out[:count]


def _creative_strategy(blueprint: StoryBlueprintSchema) -> dict[str, Any]:
    brief = blueprint.creative_brief if isinstance(blueprint.creative_brief, dict) else {}
    strategy = brief.get("creative_strategy") if isinstance(brief.get("creative_strategy"), dict) else {}
    return strategy


def _brief_list(strategy: dict[str, Any], key: str) -> list[str]:
    value = strategy.get(key)
    return [str(x).strip() for x in value if str(x).strip()] if isinstance(value, list) else []


def _shot_role(index: int, total: int) -> str:
    if index == 0:
        return "建立场景/动作/冲突"
    if index == 1:
        return "产品进入或细节展示"
    if total >= 4 and index == 2:
        return "功能使用或情绪反馈"
    return "结果/转场/记忆点"

def _camera_for_role(role: str) -> tuple[str, str]:
    if role == "建立场景/动作/冲突":
        return "中景", "轻微手持"
    if role == "产品进入或细节展示":
        return "近景/特写", "缓慢推近"
    if role == "功能使用或情绪反馈":
        return "近景", "固定或轻微跟随"
    return "中近景", "缓慢拉开"


_BANNED_INTERNAL_ACTION_TERMS = (
    "本段核心信息",
    "表现兴趣",
    "表现欲望",
    "表现注意",
    "突出人物与产品关系",
    "展示核心信息",
    "核心信息：",
    "function_label",
)


def _has_internal_action_terms(text: str) -> bool:
    return any(term in str(text or "") for term in _BANNED_INTERNAL_ACTION_TERMS)


def _similarity_key(text: str) -> str:
    return re.sub(r"[\W_]+", "", str(text or "").lower())


def _actions_too_similar(a: str, b: str) -> bool:
    ka = _similarity_key(a)
    kb = _similarity_key(b)
    if not ka or not kb:
        return False
    if ka == kb:
        return True
    shorter, longer = sorted((ka, kb), key=len)
    return len(shorter) >= 12 and shorter in longer


def _prompt_summary(text: str, max_len: int = 180) -> str:
    cleaned = re.sub(r"\s+", " ", str(text or "")).strip()
    return cleaned[:max_len]


def _safe_short_text(value: Any, *, max_len: int = 160) -> str:
    text = re.sub(r"\s+", " ", str(value or "")).strip()
    return text[:max_len]


def _trim_story_blueprint_for_segment_director(blueprint: StoryBlueprintSchema) -> dict[str, Any]:
    return {
        "title": blueprint.title,
        "premise": blueprint.premise,
        "hook": blueprint.hook,
        "core_conflict": blueprint.core_conflict,
        "twist": blueprint.twist,
        "resolution": blueprint.resolution,
        "visual_requirements": _blueprint_visual_requirements_list(blueprint)[:12],
        "must_show_elements": list(blueprint.must_show_elements or [])[:12],
        "must_avoid_elements": list(blueprint.must_avoid_elements or [])[:12],
        "segment_plan": [
            {
                "segment_id": item.segment_id,
                "stage_name": item.stage_name,
                "segment_title": item.segment_title,
                "segment_goal": item.segment_goal,
                "duration_sec": item.duration_sec,
                "product_exposure": item.product_exposure,
                "emotional_state": item.emotional_state,
                "key_message": item.key_message,
                "required_assets": list(item.required_assets or [])[:8],
            }
            for item in (blueprint.segment_plan or [])
        ],
    }


def _trim_asset_specs_for_segment_director(assets: AssetSpecsBundleSchema) -> dict[str, Any]:
    def _asset_rows(rows: list[Any], *, kind: str) -> list[dict[str, Any]]:
        out: list[dict[str, Any]] = []
        for row in rows:
            image_url = str(getattr(row, "image_url", "") or "").strip()
            thumb = ""
            meta = getattr(row, "meta", None)
            if isinstance(meta, dict):
                thumb = str(meta.get("thumbnail_url") or "").strip()
            out.append(
                {
                    "id": getattr(row, "id", None),
                    "type": kind,
                    "name": str(getattr(row, "name", "") or "").strip(),
                    "role": str(
                        getattr(row, "role_type", "")
                        or getattr(row, "scene_type", "")
                        or getattr(row, "product_role", "")
                        or ""
                    ).strip(),
                    "description": _safe_short_text(getattr(row, "description", "") or getattr(row, "visual_prompt", "")),
                    "image_url": image_url or thumb or None,
                    "thumbnail_url": thumb or None,
                }
            )
        return out

    return {
        "characters": _asset_rows(list(assets.characters or []), kind="character"),
        "scenes": _asset_rows(list(assets.scenes or []), kind="scene"),
        "products": _asset_rows(list(assets.products or []), kind="product"),
    }


def _normalize_ref_token(text: str) -> str:
    return re.sub(r"[\W_]+", "", str(text or "").lower())


def _build_product_ref_pool(assets: AssetSpecsBundleSchema) -> list[tuple[str, str]]:
    pool: list[tuple[str, str]] = []
    for p in assets.products:
        pid = str(p.id) if p.id is not None else str(p.name or "").strip()
        name = str(p.name or "").strip()
        if pid:
            pool.append((pid, _normalize_ref_token(pid)))
        if name:
            pool.append((pid, _normalize_ref_token(name)))
    return [(ref, token) for ref, token in pool if ref and token]


def _extract_product_keywords(blueprint: StoryBlueprintSchema, assets: AssetSpecsBundleSchema) -> list[str]:
    keywords = ["手机", "iphone", "产品", "手机壳"]
    for p in assets.products:
        n = str(p.name or "").strip()
        if n:
            keywords.append(n)
    if isinstance(blueprint.creative_brief, dict):
        facts = blueprint.creative_brief.get("product_facts")
        if isinstance(facts, dict):
            for key in ("name", "category"):
                v = str(facts.get(key) or "").strip()
                if v:
                    keywords.append(v)
    # keep stable order while deduplicating
    deduped: list[str] = []
    seen: set[str] = set()
    for kw in keywords:
        norm = kw.lower()
        if not norm or norm in seen:
            continue
        seen.add(norm)
        deduped.append(kw)
    return deduped


def _shot_requires_product_ref(action_text: str, keywords: list[str]) -> bool:
    low = str(action_text or "").lower()
    return any(str(kw or "").lower() in low for kw in keywords if kw)


def _is_bare_iphone_pain_shot(action_text: str) -> bool:
    low = str(action_text or "").lower()
    has_iphone = ("iphone" in low) or ("手机" in low)
    has_bare = ("裸机" in low) or ("不带壳" in low) or ("无壳" in low)
    has_pain = any(k in low for k in ("划痕", "摔", "磕", "风险", "痛点", "scratch", "drop", "crack"))
    return has_iphone and (has_bare or has_pain)


def _infer_product_refs_from_action(
    action_text: str,
    assets: AssetSpecsBundleSchema,
    ref_pool: list[tuple[str, str]],
) -> list[str]:
    action_norm = _normalize_ref_token(action_text)
    if not action_norm:
        return []
    matched: list[str] = []
    for ref, token in ref_pool:
        if token and token in action_norm:
            matched.append(ref)
    if matched:
        return list(dict.fromkeys(matched))
    # If there is only one S3 product asset, it is a deterministic mapping.
    if len(assets.products) == 1:
        p = assets.products[0]
        return [str(p.id) if p.id is not None else str(p.name or "").strip()]
    return []


def _asset_prompt_summaries(assets: AssetSpecsBundleSchema | None) -> dict[str, str]:
    if not assets:
        return {"character": "", "scene": "", "product_constraints": ""}
    char = assets.characters[0] if assets.characters else None
    scene = assets.scenes[0] if assets.scenes else None
    product = assets.products[0] if assets.products else None
    product_constraints: list[str] = []
    if product:
        product_constraints = [
            *getattr(product, "immutable_structure_constraints", []),
            *(
                (product.meta or {}).get("immutable_structure_constraints")
                if isinstance((product.meta or {}).get("immutable_structure_constraints"), list)
                else []
            ),
        ]
    return {
        "character": _prompt_summary((char.visual_prompt if char else "") or (char.description if char else "")),
        "scene": _prompt_summary((scene.visual_prompt if scene else "") or (scene.description if scene else "")),
        "product_constraints": "；".join(dict.fromkeys([str(x).strip() for x in product_constraints if str(x).strip()])),
    }


def _compose_generation_prompt(
    *,
    visual_action: str,
    style_instruction: str,
    market_detail: str,
    framing: str,
    movement: str,
    asset_summaries: dict[str, str],
) -> str:
    return " ".join(
        part
        for part in [
            f"画面动作：{visual_action}",
            f"视觉风格：{style_instruction}" if style_instruction else "",
            f"市场本地化：{market_detail}" if market_detail else "",
            f"镜头语言：{framing}，{movement}。" if framing or movement else "",
            f"场景资产参考：{asset_summaries.get('scene')}" if asset_summaries.get("scene") else "",
            f"角色资产参考：{asset_summaries.get('character')}" if asset_summaries.get("character") else "",
            f"产品不可变结构：{asset_summaries.get('product_constraints')}" if asset_summaries.get("product_constraints") else "",
        ]
        if part
    ).strip()


def _subtitle_for_shot(role: str, action: str, video_language: str) -> str:
    return ""


def _mood_for_shot(role: str, action: str, segment_emotion: str) -> str:
    shot_text = f"{role} {action}"
    if any(term in shot_text for term in ("滑", "慌乱", "迟疑", "冲突")):
        return "生活化小困扰、短暂慌乱、轻微紧张"
    if any(term in shot_text for term in ("特写", "进入", "结构", "细节", "材质", "部件")):
        return "好奇、专注、结构清晰"
    if any(term in shot_text for term in ("稳定", "支撑", "安心", "放松")):
        return "安心、稳定、放松"
    if any(term in shot_text for term in ("记忆", "收束", "出门", "行动")):
        return "满足、轻松、有购买理由"
    if "困扰" in str(segment_emotion or ""):
        return "生活化小困扰、轻微紧张"
    return segment_emotion or "自然、生活化"


def enrich_shot_via_slot_pipeline(
    shot: ShotSchema,
    seg: SegmentScriptSchema,
    assets: AssetSpecsBundleSchema,
    blueprint: StoryBlueprintSchema,
    *,
    project_id: int,
) -> ShotSchema:
    """Structured slots → optional single-slot fill → compose image/video prompts."""
    log_slot_raw(project_id=project_id, segment_id=seg.segment_id, shot_id=shot.shot_id, shot=shot)

    missing_before = missing_slot_field_names(shot)
    cur = shot
    if len(missing_before) == 1:
        field = missing_before[0]
        cur = fill_one_missing_slot(cur, seg, assets, blueprint, field)
        missing_after_names = missing_slot_field_names(cur)
        logger.info(
            "SEGMENT_SLOT_FILLED project_id=%s segment_id=%s shot_id=%s missing_before=%s missing_after=%s filled_fields=%s",
            project_id,
            seg.segment_id,
            shot.shot_id,
            ",".join(missing_before),
            ",".join(missing_after_names),
            field,
        )
    else:
        missing_after_names = missing_slot_field_names(cur)

    fc = filled_slot_count(cur)
    mf = missing_slot_field_names(cur)
    if fc < 3 or len(mf) >= 2:
        logger.warning(
            "SEGMENT_SLOT_VALIDATION_FAILED project_id=%s segment_id=%s shot_id=%s missing_fields=%s",
            project_id,
            seg.segment_id,
            shot.shot_id,
            ",".join(mf),
        )
        raise ShortDramaInvalidModelOutputError(
            "Shot slot validation failed: at least 3 of 4 structured description fields must be non-empty "
            f"(segment={seg.segment_id}, shot={shot.shot_id})",
            segment_id=seg.segment_id,
            shot_id=shot.shot_id,
            missing_fields=mf,
            code="slot_validation_failed",
        )

    image_prompt = compose_image_prompt_from_slots(cur)
    video_prompt = compose_video_prompt_from_slots(cur)
    logger.info(
        "SEGMENT_PROMPT_COMPOSED project_id=%s segment_id=%s shot_id=%s image_prompt_len=%s video_prompt_len=%s image_preview=%s video_preview=%s",
        project_id,
        seg.segment_id,
        shot.shot_id,
        len(image_prompt),
        len(video_prompt),
        _prompt_summary(image_prompt, 120),
        _prompt_summary(video_prompt, 120),
    )
    validate_composed_prompt_text(
        image_prompt, field="image_prompt", shot_id=cur.shot_id, segment_id=seg.segment_id
    )
    validate_composed_prompt_text(
        video_prompt, field="video_prompt", shot_id=cur.shot_id, segment_id=seg.segment_id
    )

    source_segment = next((x for x in blueprint.segment_plan if x.segment_id == seg.segment_id), None)
    selling_point = (
        cur.source_selling_point
        or (source_segment.source_selling_point if source_segment else "")
        or (_blueprint_selling_point_mapping_dict(blueprint).get(seg.segment_id, ""))
    )
    vreq = _blueprint_visual_requirements_list(blueprint)
    source_visual_constraints = {
        **(cur.source_visual_constraints or {}),
        "s2_visual_requirements": vreq,
        "s2_required_visual_elements": source_segment.required_visual_elements if source_segment else [],
        "market_visual_constraints": blueprint.market_visual_constraints,
        "visual_style_constraints": blueprint.visual_style_constraints,
    }
    must_show = list(
        dict.fromkeys(
            [
                *(cur.must_show or []),
                selling_point,
                *(source_segment.required_visual_elements if source_segment else []),
                *blueprint.must_show_elements,
            ]
        )
    )
    must_avoid = list(dict.fromkeys([*(cur.must_avoid or []), *blueprint.must_avoid_elements]))
    executable_prompt = " ".join(
        x
        for x in [
            video_prompt,
            f"MUST SHOW: {'; '.join([m for m in must_show if m])}." if must_show else "",
            f"DO NOT SHOW: {'; '.join([m for m in must_avoid if m])}." if must_avoid else "",
            f"VISUAL CONSTRAINTS: {'; '.join(vreq[:8])}." if vreq else "",
            f"MARKET VISUAL CONSTRAINTS: {blueprint.market_visual_constraints}." if blueprint.market_visual_constraints else "",
            f"STYLE CONSTRAINTS: {blueprint.visual_style_constraints}." if blueprint.visual_style_constraints else "",
        ]
        if x
    ).strip()
    return cur.model_copy(
        update={
            "image_prompt": image_prompt,
            "video_prompt": executable_prompt,
            "generation_prompt": cur.generation_prompt or executable_prompt,
            "negative_prompt": cur.negative_prompt or "；".join([m for m in must_avoid if m]),
            "source_segment_id": cur.source_segment_id or seg.segment_id,
            "source_selling_point": selling_point,
            "source_visual_constraints": source_visual_constraints,
            "must_show": [x for x in must_show if x],
            "must_avoid": [x for x in must_avoid if x],
        }
    )


def _enrich_shot_prompts(
    shot: ShotSchema,
    seg: SegmentScriptSchema,
    assets: AssetSpecsBundleSchema,
    blueprint: StoryBlueprintSchema,
    *,
    project_id: int = 0,
) -> ShotSchema:
    """Back-compat name for tests; delegates to slot pipeline."""
    return enrich_shot_via_slot_pipeline(shot, seg, assets, blueprint, project_id=project_id)


def validate_shot_prompt_quality(
    image_prompt: str,
    video_prompt: str,
    *,
    shot_id: str,
    segment_id: str,
) -> None:
    """Validate final composed prompts (length / vague / filler), not keyword dimensions."""
    validate_composed_prompt_text(image_prompt, field="image_prompt", shot_id=shot_id, segment_id=segment_id)
    validate_composed_prompt_text(video_prompt, field="video_prompt", shot_id=shot_id, segment_id=segment_id)


class SegmentDirectorProvider(Protocol):
    def direct(
        self,
        project_id: int,
        blueprint: StoryBlueprintSchema,
        assets: AssetSpecsBundleSchema,
        project_config: Dict[str, Any],
    ) -> list[SegmentScriptSchema]: ...


class MockSegmentDirectorProvider:
    def direct(
        self,
        project_id: int,
        blueprint: StoryBlueprintSchema,
        assets: AssetSpecsBundleSchema,
        project_config: Dict[str, Any],
    ) -> list[SegmentScriptSchema]:
        char0 = assets.characters[0].name if assets.characters else "主角"
        scene0 = assets.scenes[0].name if assets.scenes else "场景A"
        prod = assets.products[0].name if assets.products else "产品"
        ar = project_config.get("aspect_ratio") or "9:16"
        visual_style = project_config.get("visual_style") or "cinematic"
        s1_constraints = project_config.get("s1_visual_constraints") or {}
        vf = [str(x) for x in s1_constraints.get("visual_features", []) if x]
        consistency = [str(x) for x in s1_constraints.get("consistency_notes", []) if x]
        risks = [str(x) for x in s1_constraints.get("visual_risk_notes", []) if x]
        mapping = _blueprint_selling_point_mapping_dict(blueprint)
        plan = list(blueprint.segment_plan or [])
        seg_1_duration = _provider_safe_duration(
            (plan[0].duration_seconds if len(plan) > 0 else 6.0) or 6.0,
            segment_id="seg_1",
        )
        seg_2_duration = _provider_safe_duration(
            (plan[1].duration_seconds if len(plan) > 1 else 8.0) or 8.0,
            segment_id="seg_2",
        )
        seg_3_duration = _provider_safe_duration(
            (plan[2].duration_seconds if len(plan) > 2 else 7.0) or 7.0,
            segment_id="seg_3",
        )
        return [
            SegmentScriptSchema(
                segment_id="seg_1",
                title="Hook",
                duration_limit=seg_1_duration,
                goal=(plan[0].goal if len(plan) > 0 else "") or "共鸣开场",
                shots=[
                    ShotSchema(
                        shot_id="s1_01",
                        shot_type="establishing",
                        scene_ref=scene0,
                        character_refs=[char0],
                        visual_description=f"竖屏 {ar}，{visual_style}，手持跟拍",
                        scene_description=f"Busy city street in morning light near commuter foot traffic",
                        subject_description=f"{char0} as the lead talent in everyday wardrobe",
                        action_description="Walking quickly with urgency through the crowd toward work",
                        camera_description=f"Handheld vertical {ar} with shallow depth and natural sunlight",
                        dialogue="又要迟到了…",
                        narration="",
                        emotion="窘迫",
                        duration_seconds=seg_1_duration,
                        image_prompt="",
                        video_prompt="",
                        product_refs=[prod],
                        must_show=[blueprint.hook, mapping.get("seg_1", ""), *vf[:2]],
                        must_avoid=risks,
                        source_segment_id="seg_1",
                        source_selling_point=mapping.get("seg_1", ""),
                        source_visual_constraints={
                            "visual_features": vf,
                            "consistency_notes": consistency,
                            "visual_risk_notes": risks,
                            "aspect_ratio": ar,
                            "visual_style": visual_style,
                        },
                    )
                ],
                meta={"provider": "mock", "segment": "hook"},
            ),
            SegmentScriptSchema(
                segment_id="seg_2",
                title="Conflict / Build",
                duration_limit=seg_2_duration,
                goal=(plan[1].goal if len(plan) > 1 else "") or "产品引入",
                shots=[
                    ShotSchema(
                        shot_id="s2_01",
                        shot_type="insert",
                        scene_ref=scene0,
                        character_refs=[char0],
                        visual_description=f"产品入画，{visual_style}，{ar}",
                        scene_description="Retail-leaning interior with clean surfaces and readable labels",
                        subject_description=f"{char0} presenting {prod} as the focal hero object",
                        action_description="Unboxing and trying the product with curious hand choreography",
                        camera_description="Soft rim light, slow push-in, vertical commercial macro-friendly framing",
                        dialogue=f"试试 {prod}。",
                        narration="",
                        emotion="好奇",
                        duration_seconds=8.0,
                        image_prompt="",
                        video_prompt="",
                        product_refs=[prod],
                        must_show=[mapping.get("seg_2", ""), *vf, *consistency],
                        must_avoid=risks,
                        source_segment_id="seg_2",
                        source_selling_point=mapping.get("seg_2", ""),
                        source_visual_constraints={
                            "visual_features": vf,
                            "consistency_notes": consistency,
                            "visual_risk_notes": risks,
                            "aspect_ratio": ar,
                            "visual_style": visual_style,
                        },
                    )
                ],
                meta={"provider": "mock", "segment": "build"},
            ),
            SegmentScriptSchema(
                segment_id="seg_3",
                title="Twist / Resolution",
                duration_limit=seg_3_duration,
                goal=(plan[2].goal if len(plan) > 2 else "") or "收尾与 CTA",
                shots=[
                    ShotSchema(
                        shot_id="s3_01",
                        shot_type="reaction",
                        scene_ref=scene0,
                        character_refs=[char0],
                        visual_description="表情放松",
                        scene_description="Quiet office nook with warm practicals and soft background separation",
                        subject_description=f"{char0} relaxed after resolving the earlier tension",
                        action_description="Nods with a satisfied smile toward an implied payoff",
                        camera_description="Portrait close-up with bokeh, gentle pull-back beat for resolution",
                        dialogue="原来这么简单。",
                        narration=blueprint.title or f"了解 {prod}",
                        emotion="满足",
                        duration_seconds=7.0,
                        image_prompt="",
                        video_prompt="",
                        product_refs=[prod],
                        must_show=[mapping.get("seg_3", ""), *blueprint.must_show_elements],
                        must_avoid=risks,
                        source_segment_id="seg_3",
                        source_selling_point=mapping.get("seg_3", ""),
                        source_visual_constraints={
                            "visual_features": vf,
                            "consistency_notes": consistency,
                            "visual_risk_notes": risks,
                            "aspect_ratio": ar,
                            "visual_style": visual_style,
                        },
                    )
                ],
                meta={"provider": "mock", "segment": "resolution"},
            ),
        ]


class XAISegmentDirectorProvider:
    def __init__(self, text_provider: XAITextProvider):
        self._text = text_provider

    def direct(
        self,
        project_id: int,
        blueprint: StoryBlueprintSchema,
        assets: AssetSpecsBundleSchema,
        project_config: Dict[str, Any],
    ) -> list[SegmentScriptSchema]:
        logger.info(
            "SEGMENT_GENERATION_STARTED %s",
            {"project_id": project_id, "stage": "SEGMENT_GENERATION", "provider": "xai"},
        )
        try:
            s2_execution_blueprint = {
                "hook": blueprint.hook,
                "core_conflict": blueprint.core_conflict,
                "twist": blueprint.twist,
                "resolution": blueprint.resolution,
                "segment_plan": [s.model_dump() for s in blueprint.segment_plan],
                "scene_goals": blueprint.scene_goals,
                "product_selling_point_mapping": blueprint.product_selling_point_mapping,
                "visual_requirements": _blueprint_visual_requirements_list(blueprint),
                "must_show_elements": blueprint.must_show_elements,
                "must_avoid_elements": blueprint.must_avoid_elements,
            }
            segments: list[SegmentScriptSchema] = []
            last_quality_error: ShortDramaInvalidModelOutputError | None = None
            for attempt in range(2):
                prompt_payload = {
                    "project_id": project_id,
                    "project_config": project_config,
                    "language_policy": project_config.get("language_policy", {}),
                    "language_prompt_rules": project_config.get("language_prompt_rules", ""),
                    "creative_context": blueprint.creative_brief,
                    "creative_intent": project_config.get("effective_creative_intent", ""),
                    "story_blueprint": _trim_story_blueprint_for_segment_director(blueprint),
                    "s2_execution_blueprint": s2_execution_blueprint,
                    "asset_specs": _trim_asset_specs_for_segment_director(assets),
                    "quality_retry": attempt > 0,
                }
                _trace(
                    "S4_DIRECTOR_INPUT_CONTEXT",
                    {
                        "project_id": project_id,
                        "project_config": project_config,
                        "product_context": (project_config or {}).get("s1_visual_constraints", {}),
                        "story_blueprint": blueprint.model_dump(),
                        "segment_script": [x.model_dump() for x in blueprint.segment_plan],
                        "assets_available": {
                            "characters": len(assets.characters),
                            "scenes": len(assets.scenes),
                            "products": len(assets.products),
                        },
                        "character_assets": [x.model_dump() for x in assets.characters],
                        "scene_assets": [x.model_dump() for x in assets.scenes],
                        "product_assets": [x.model_dump() for x in assets.products],
                    },
                )
                _trace(
                    "S4_DIRECTOR_PROMPT",
                    {
                        "project_id": project_id,
                        "system_prompt": SEGMENT_DIRECTOR_SYSTEM_PROMPT,
                        "user_payload": prompt_payload,
                        "provider": "xai_text_provider",
                        "model": "effective_xai_text_model",
                        "attempt": attempt + 1,
                    },
                )
                data = self._text.generate_structured_json(
                    project_id=project_id,
                    service_name="segment_director",
                    system_prompt=SEGMENT_DIRECTOR_SYSTEM_PROMPT,
                    user_payload=prompt_payload,
                    image_urls=None,
                    expected_schema_name="SegmentScriptsBundle",
                    stage="SEGMENT_GENERATION",
                    max_output_tokens=max(1024, int(settings.SHORT_DRAMA_SEGMENT_DIRECTOR_MAX_OUTPUT_TOKENS)),
                )
                _trace("S4_DIRECTOR_RAW_RESPONSE", {"project_id": project_id, "response": data, "attempt": attempt + 1})
                try:
                    segments = _validate_segments(
                        data, project_id=project_id, assets=assets, blueprint=blueprint
                    )
                    break
                except ShortDramaInvalidModelOutputError as e:
                    last_quality_error = e
                    if attempt == 1:
                        raise
                    logger.info(
                        "SEGMENT_GENERATION_RETRY %s",
                        {"project_id": project_id, "stage": "SEGMENT_GENERATION", "reason": str(e)},
                    )
            else:
                raise last_quality_error or ShortDramaInvalidModelOutputError("Segment generation failed quality checks")
            logger.info(
                "SEGMENT_GENERATION_SUCCEEDED %s",
                {"project_id": project_id, "stage": "SEGMENT_GENERATION", "provider": "xai"},
            )
            return segments
        except Exception as e:
            logger.info(
                "SEGMENT_GENERATION_FAILED %s",
                {
                    "project_id": project_id,
                    "stage": "SEGMENT_GENERATION",
                    "provider": "xai",
                    "error_type": type(e).__name__,
                },
            )
            raise


def _validate_segments(
    data: dict[str, Any],
    *,
    project_id: int,
    assets: AssetSpecsBundleSchema,
    blueprint: StoryBlueprintSchema,
) -> list[SegmentScriptSchema]:
    raw_list = data.get("segments")
    if not isinstance(raw_list, list):
        raise ShortDramaInvalidModelOutputError("Missing segments array")
    expected_count = len(blueprint.segment_plan or []) or len(raw_list)
    if len(raw_list) != expected_count:
        raise ShortDramaInvalidModelOutputError(f"Expected {expected_count} segments, got {len(raw_list)}")
    product_keywords = _extract_product_keywords(blueprint, assets)
    product_ref_pool = _build_product_ref_pool(assets)
    out: list[SegmentScriptSchema] = []
    for i, row in enumerate(raw_list):
        if not isinstance(row, dict):
            raise ShortDramaInvalidModelOutputError("Invalid segment row")
        seg = SegmentScriptSchema.model_validate(row)
        expected_segment_id = f"seg_{i + 1}"
        if seg.segment_id != expected_segment_id:
            seg = seg.model_copy(update={"segment_id": expected_segment_id})
        if len(seg.shots) < 2:
            raise ShortDramaInvalidModelOutputError(f"segment {seg.segment_id} must include at least 2 shots")
        source_plan = next((x for x in blueprint.segment_plan if x.segment_id == seg.segment_id), None)
        segment_limit = _provider_safe_duration(
            seg.duration_limit or (source_plan.duration_seconds if source_plan else 6.0) or 6.0,
            segment_id=seg.segment_id,
        )
        enriched_shots: list[ShotSchema] = []
        seen_actions: list[str] = []
        for sh in seg.shots:
            if not sh.duration_seconds or sh.duration_seconds > segment_limit:
                sh = sh.model_copy(update={"duration_seconds": segment_limit})
            action0 = (sh.visual_action or sh.action_description or "").strip()
            if len(action0) < 8 or _has_internal_action_terms(action0):
                vp0 = (sh.video_prompt or sh.generation_prompt or "").strip()
                fb0 = _truncate_visual_action_fallback(vp0) if len(vp0.strip()) >= 8 else ""
                if not fb0:
                    fb0 = (
                        "Vertical 9:16 commercial framing with deliberate subject motion "
                        "and readable contrast across the shot."
                    )
                sh = sh.model_copy(
                    update={
                        "visual_action": fb0,
                        "action_description": (sh.action_description or "").strip() or fb0,
                    }
                )
            sh2 = enrich_shot_via_slot_pipeline(
                sh, seg, assets, blueprint, project_id=project_id
            )
            action = (sh2.visual_action or sh2.action_description or "").strip()
            if len(action) < 8 or _has_internal_action_terms(action):
                vp1 = (sh2.video_prompt or sh2.generation_prompt or "").strip()
                fb1 = (
                    _truncate_visual_action_fallback(vp1)
                    if len(vp1.strip()) >= 8
                    else _pad_min_composed_prompt(vp1)[:280]
                )
                if not (fb1 or "").strip():
                    fb1 = (
                        "Vertical 9:16 commercial framing with deliberate subject motion "
                        "and readable contrast across the shot."
                    )
                logger.info(
                    "[S4_VISUAL_ACTION_FALLBACK_POST_ENRICH] project_id=%s segment_id=%s shot_id=%s",
                    project_id,
                    seg.segment_id,
                    sh2.shot_id,
                )
                sh2 = sh2.model_copy(
                    update={
                        "visual_action": fb1,
                        "action_description": (sh2.action_description or "").strip() or fb1,
                    }
                )
                action = (sh2.visual_action or sh2.action_description or "").strip()
            product_refs = list(sh2.product_refs or [])
            if _shot_requires_product_ref(action, product_keywords) and not product_refs:
                if _is_bare_iphone_pain_shot(action):
                    sh2 = sh2.model_copy(
                        update={
                            "source_visual_constraints": {
                                **(sh2.source_visual_constraints or {}),
                                "problem_object": "裸机 iPhone",
                                "prop_refs": ["裸机 iPhone"],
                            }
                        }
                    )
                else:
                    inferred_refs = _infer_product_refs_from_action(action, assets, product_ref_pool)
                    if inferred_refs:
                        sh2 = sh2.model_copy(
                            update={
                                "product_refs": inferred_refs,
                                "product_ids": inferred_refs,
                                "required_assets": [
                                    x
                                    for x in [*(sh2.character_refs or []), sh2.scene_ref, *inferred_refs]
                                    if x
                                ],
                            }
                        )
                    else:
                        raise ShortDramaInvalidModelOutputError(
                            f"segment {seg.segment_id} shot {sh2.shot_id} missing product_refs",
                            segment_id=seg.segment_id,
                            shot_id=sh2.shot_id,
                            missing_fields=["product_refs"],
                            code="missing_refs",
                        )
            if any(_actions_too_similar(action, prev) for prev in seen_actions):
                logger.warning(
                    "[S4_VISUAL_ACTION_SIMILAR_SHOTS] project_id=%s segment_id=%s shot_id=%s",
                    project_id,
                    seg.segment_id,
                    sh2.shot_id,
                )
            seen_actions.append(action)
            try:
                validate_shot_prompt_quality(
                    sh2.image_prompt,
                    sh2.video_prompt,
                    shot_id=sh2.shot_id,
                    segment_id=seg.segment_id,
                )
            except ShortDramaInvalidModelOutputError as qe:
                logger.warning(
                    "[S4_SHOT_PROMPT_QUALITY_WARNING] project_id=%s segment_id=%s shot_id=%s detail=%s",
                    project_id,
                    seg.segment_id,
                    sh2.shot_id,
                    str(qe),
                )
            enriched_shots.append(sh2)
        out.append(seg.model_copy(update={"duration_limit": segment_limit, "shots": enriched_shots}))
    return out


class SegmentDirectorService:
    def __init__(self, provider: SegmentDirectorProvider | None = None):
        self._provider = provider or MockSegmentDirectorProvider()

    def generate(
        self,
        project_id: int,
        blueprint: StoryBlueprintSchema,
        assets: AssetSpecsBundleSchema,
        project_config: Dict[str, Any],
    ) -> list[SegmentScriptSchema]:
        _reject_v2_for_legacy_s4_entrypoints(blueprint, entry="segment_director_service.generate")
        segments = self._provider.direct(project_id, blueprint, assets, project_config)
        if isinstance(self._provider, MockSegmentDirectorProvider):
            out: list[SegmentScriptSchema] = []
            for seg in segments:
                shots2 = [
                    enrich_shot_via_slot_pipeline(sh, seg, assets, blueprint, project_id=project_id)
                    for sh in seg.shots
                ]
                out.append(seg.model_copy(update={"shots": shots2}))
            return out
        return segments


def _build_segment_director_service() -> SegmentDirectorService:
    if settings.SHORT_DRAMA_USE_MOCK_TEXT_PROVIDER:
        return SegmentDirectorService(MockSegmentDirectorProvider())
    return SegmentDirectorService(XAISegmentDirectorProvider(get_xai_text_provider()))


segment_director_service = _build_segment_director_service()


def segments_from_story_shot_plan(
    blueprint: StoryBlueprintSchema,
    assets: AssetSpecsBundleSchema | None = None,
    project_config: Dict[str, Any] | None = None,
    *,
    force_from_shot_plan: bool = False,
) -> list[SegmentScriptSchema] | None:
    _reject_v2_for_legacy_s4_entrypoints(blueprint, entry="segments_from_story_shot_plan")
    shot_plan = blueprint.shot_plan if isinstance(blueprint.shot_plan, dict) else {}
    if (not force_from_shot_plan) and blueprint.creative_brief and blueprint.segment_plan:
        # New projects must use the segment director provider so the model authors shots.
        # This helper is kept only for legacy shot_plan compatibility.
        return None
    segments_raw = shot_plan.get("segments") if isinstance(shot_plan.get("segments"), list) else []
    if not segments_raw:
        return None
    cfg = project_config or {}
    framework = blueprint.story_framework if isinstance(blueprint.story_framework, dict) else {}
    strategy = _creative_strategy(blueprint)
    stages = _brief_list(strategy, "structure_stages")
    stage_names = _brief_list(strategy, "stage_display_names") or stages
    visual_world = strategy.get("visual_world") if isinstance(strategy.get("visual_world"), dict) else {}
    market_context = strategy.get("market_context") if isinstance(strategy.get("market_context"), dict) else {}
    target_market = str((blueprint.creative_brief or {}).get("project_constraints", {}).get("target_market") or cfg.get("target_market") or "").strip() if isinstance(blueprint.creative_brief, dict) else str(cfg.get("target_market") or "").strip()
    video_language = str((blueprint.creative_brief or {}).get("project_constraints", {}).get("video_language") or cfg.get("video_language") or cfg.get("workflow_language") or "").strip() if isinstance(blueprint.creative_brief, dict) else str(cfg.get("video_language") or cfg.get("workflow_language") or "").strip()
    product_facts = blueprint.creative_brief.get("product_facts") if isinstance(blueprint.creative_brief, dict) and isinstance(blueprint.creative_brief.get("product_facts"), dict) else {}
    product_name = str(product_facts.get("name") or _first_product_ref(assets) or "产品").strip()
    visual_features = [str(x).strip() for x in (product_facts.get("product_visual_features") or []) if str(x).strip()] if isinstance(product_facts.get("product_visual_features"), list) else []
    asset_summaries = _asset_prompt_summaries(assets)
    framework_type = str(framework.get("type") or "brand_seeding").strip()
    segment_count = max(1, min(8, len(segments_raw)))
    segment_functions = stage_names[:segment_count] if len(stage_names) >= segment_count else _framework_functions(framework_type, segment_count)
    out: list[SegmentScriptSchema] = []
    for idx in range(segment_count):
        row = segments_raw[idx] if idx < len(segments_raw) and isinstance(segments_raw[idx], dict) else {}
        if not isinstance(row, dict):
            row = {}
        segment_id = f"seg_{idx+1}"
        shots_raw = row.get("shots") if isinstance(row.get("shots"), list) else []
        function_label = segment_functions[idx] if idx < len(segment_functions) else f"片段功能{idx+1}"
        fallback_action = str(row.get("action") or row.get("goal") or row.get("function") or function_label).strip()
        fallback_duration = float(row.get("duration") or 0)
        if fallback_duration <= 0:
            fallback_duration = 6.0
        shot_count = _default_shot_count(fallback_duration)
        per_shot_duration = round(max(1.0, fallback_duration / shot_count), 1)
        fallback_scene_ref = _first_scene_ref(assets)
        fallback_character_ref = _first_character_ref(assets)
        fallback_product_ref = _first_product_ref(assets)
        product_exposure = str(row.get("product_exposure") or "").strip()
        segment_emotion = str(row.get("emotional_state") or function_label or "").strip()
        product_allowed = product_exposure != "无"
        shots = []
        for j, shot in enumerate(shots_raw):
            if not isinstance(shot, dict):
                continue
            role = _shot_role(j, max(2, len(shots_raw)))
            raw_character_refs = [str(x) for x in (shot.get("character_refs") or []) if str(x).strip()]
            raw_scene_ref = str(shot.get("scene_ref") or shot.get("scene") or "").strip()
            raw_product_refs = [str(x) for x in (shot.get("product_refs") or shot.get("products") or []) if str(x).strip()]
            character_refs = raw_character_refs or ([fallback_character_ref] if fallback_character_ref else [])
            scene_ref = raw_scene_ref or fallback_scene_ref
            product_refs = raw_product_refs or ([fallback_product_ref] if fallback_product_ref and product_allowed else [])
            action = str(shot.get("visual_action") or shot.get("action") or shot.get("action_description") or "").strip()
            if not action or _has_internal_action_terms(action):
                return None
            duration_seconds = float(shot.get("duration") or shot.get("duration_seconds") or fallback_duration or 0)
            if duration_seconds <= 0:
                duration_seconds = fallback_duration
            framing, movement = _camera_for_role(role)
            style_instruction = str(visual_world.get("description") or "")
            market_detail = str(market_context.get("description") or "")
            generation_prompt = str(shot.get("generation_prompt") or "").strip() or _compose_generation_prompt(
                visual_action=action,
                style_instruction=style_instruction,
                market_detail=market_detail,
                framing=str(shot.get("camera_framing") or shot.get("framing") or framing),
                movement=str(shot.get("camera_movement") or movement),
                asset_summaries=asset_summaries,
            )
            video_prompt_value = str(shot.get("video_prompt") or "").strip() or generation_prompt
            dialogue = str(shot.get("spoken_text") or shot.get("dialogue") or "").strip()
            voiceover = str(shot.get("voiceover_text") or shot.get("voiceover") or shot.get("narration") or "").strip()
            subtitle = str(shot.get("subtitle_text") or shot.get("subtitle") or "").strip() or _subtitle_for_shot(role, action, video_language)
            mood = _mood_for_shot(role, action, str(shot.get("mood") or shot.get("emotion") or segment_emotion))
            required_assets = [*character_refs, scene_ref, *product_refs]
            shots.append(
                ShotSchema(
                    shot_id=str(shot.get("id") or f"{segment_id}_shot_{j+1}"),
                    shot_title=str(shot.get("shot_title") or role),
                    shot_role=role,
                    shot_type="storyboard",
                    scene_ref=scene_ref,
                    scene_id=scene_ref,
                    character_refs=character_refs,
                    character_ids=character_refs,
                    visual_description=action,
                    visual_action=action,
                    action_description=action,
                    camera=str(shot.get("camera") or "生活广告镜头"),
                    camera_movement=str(shot.get("camera_movement") or movement),
                    framing=str(shot.get("camera_framing") or shot.get("framing") or framing),
                    camera_framing=str(shot.get("camera_framing") or shot.get("framing") or framing),
                    camera_description=f"{framing}，{movement}，保持画面清楚可读",
                    dialogue=dialogue,
                    spoken_text=dialogue,
                    voiceover=voiceover or None,
                    voiceover_text=voiceover,
                    subtitle=subtitle,
                    subtitle_text=subtitle,
                    narration=voiceover,
                    emotion=mood,
                    mood=mood,
                    duration_seconds=duration_seconds,
                    duration_sec=duration_seconds,
                    product_refs=product_refs,
                    product_ids=product_refs,
                    required_assets=[x for x in required_assets if x],
                    visual_style_instruction=style_instruction,
                    market_localization_detail=market_detail,
                    generation_prompt=generation_prompt,
                    video_prompt=video_prompt_value,
                    negative_prompt=str(shot.get("negative_prompt") or "；".join([*(visual_world.get("negative") or []), *(market_context.get("negative") or [])])),
                    must_show=[str(x) for x in (shot.get("must_show") or []) if str(x).strip()],
                    must_avoid=[str(x) for x in (shot.get("must_avoid") or []) if str(x).strip()],
                    source_segment_id=segment_id,
                )
            )
        if not shots:
            return None
        distinct_shots: list[ShotSchema] = []
        for j, sh in enumerate(shots[:4]):
            role = sh.shot_role or _shot_role(j, len(shots))
            action = sh.visual_action or sh.action_description or ""
            if _has_internal_action_terms(action) or any(_actions_too_similar(action, prev.visual_action or prev.action_description) for prev in distinct_shots):
                return None
            framing, movement = _camera_for_role(role)
            style_instruction = sh.visual_style_instruction or str(visual_world.get("description") or "")
            market_detail = sh.market_localization_detail or str(market_context.get("description") or "")
            subtitle = sh.subtitle_text or sh.subtitle or _subtitle_for_shot(role, action, video_language)
            mood = _mood_for_shot(role, action, sh.mood or sh.emotion or segment_emotion)
            product_refs = list(sh.product_refs or [])
            product_ids = list(sh.product_ids or product_refs)
            if not product_allowed:
                product_refs = []
                product_ids = []
            composed_gp = _compose_generation_prompt(
                visual_action=action,
                style_instruction=style_instruction,
                market_detail=market_detail,
                framing=sh.camera_framing or sh.framing or framing,
                movement=sh.camera_movement or movement,
                asset_summaries=asset_summaries,
            )
            vp_final = str(sh.video_prompt or "").strip() or composed_gp
            distinct_shots.append(
                sh.model_copy(
                    update={
                        "shot_role": role,
                        "shot_title": sh.shot_title or role,
                        "visual_action": action,
                        "action_description": action,
                        "visual_description": action,
                        "subtitle": subtitle,
                        "subtitle_text": subtitle,
                        "emotion": mood,
                        "mood": mood,
                        "product_refs": product_refs,
                        "product_ids": product_ids,
                        "required_assets": [x for x in [*(sh.character_refs or []), sh.scene_ref, *(product_refs or [])] if x],
                        "camera_framing": sh.camera_framing or sh.framing or framing,
                        "framing": sh.framing or sh.camera_framing or framing,
                        "camera_movement": sh.camera_movement or movement,
                        "visual_style_instruction": style_instruction,
                        "market_localization_detail": market_detail,
                        "generation_prompt": composed_gp,
                        "video_prompt": vp_final,
                        "negative_prompt": sh.negative_prompt
                        or "；".join([*(visual_world.get("negative") or []), *(market_context.get("negative") or [])]),
                    }
                )
            )
        shots = distinct_shots
        out.append(
            SegmentScriptSchema(
                segment_id=segment_id,
                title=str(row.get("name") or function_label or f"Segment {idx+1}"),
                duration_limit=_provider_safe_duration(fallback_duration, segment_id=segment_id),
                goal=str(row.get("goal") or function_label),
                shots=shots,
                meta={
                    "source": "story_blueprint.shot_plan",
                    "function_label": function_label,
                    "short_label": function_label.split("+")[0][:8],
                    "framework_type": framework_type,
                },
            )
        )
    return out or None
