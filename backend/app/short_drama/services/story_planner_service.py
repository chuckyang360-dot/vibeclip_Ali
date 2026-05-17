from __future__ import annotations

import logging
import json
import re
from typing import Any, Dict, Protocol

from ...config import settings
from ..exceptions import ShortDramaInvalidModelOutputError
from ..providers.xai_client import effective_xai_story_max_output_tokens, effective_xai_story_model
from ..providers.xai_text_provider import XAITextProvider, get_xai_text_provider
from ..schemas.product import ProductContextSchema
from ..schemas.story import (
    SegmentPlanItemSchema,
    StoryBlueprintSchema,
    default_creative_blueprint_v2_attachment,
    parse_story_blueprint_json,
)
from ..utils.creative_brief import build_creative_brief
from ..utils.prompts import STORY_PLANNER_REPAIR_SYSTEM_PROMPT, STORY_PLANNER_SYSTEM_PROMPT

logger = logging.getLogger(__name__)

CREATIVE_BLUEPRINT_V2_SCHEMA = "creative_blueprint_v2"
PROVIDER_MAX_VIDEO_DURATION_SECONDS = 10.0
_S2_PAYLOAD_MAX_CHARS = 200_000
_S2_STRING_MAX_CHARS = 5_000
_S2_IMAGE_DATA_KEY_MARKERS = (
    "image_url",
    "image_urls",
    "url",
    "data_url",
    "base64",
    "file_data",
    "raw_image",
)


def _trace(tag: str, payload: dict[str, Any]) -> None:
    logger.info("[AI_CHAIN_TRACE][%s] %s", tag, json.dumps(payload, ensure_ascii=False, default=str))


def _visual_requirements_as_str_list(v: Any) -> list[str]:
    """Normalize only for duration/aspect hints; Grok may emit list or string."""
    if isinstance(v, list):
        return list(dict.fromkeys([str(x).strip() for x in v if str(x or "").strip()]))
    if isinstance(v, str) and v.strip():
        return [v.strip()]
    return []


_STORY_PROJECT_KEYS = (
    "project_id",
    "duration",
    "format",
    "style",
    "visual_style",
    "aspect_ratio",
    "target_market",
    "marketing_goal",
    "target_audience",
    "brand_tone",
    "creative_intent",
    "creative_brief",
    "workflow_language",
    "video_language",
    "content_form",
    "narrative_style",
)


def _compact_project_config_for_story(project_config: Dict[str, Any]) -> Dict[str, Any]:
    out: Dict[str, Any] = {}
    for k in _STORY_PROJECT_KEYS:
        if k in project_config and project_config[k] is not None and project_config[k] != "":
            out[k] = project_config[k]
    return out


def _compact_creative_context_for_story(project_config: Dict[str, Any]) -> Dict[str, Any]:
    cbd = project_config.get("creative_brief_data")
    if not isinstance(cbd, dict):
        return {}
    if "ai_interpretation" in cbd or "source_inputs" in cbd:
        return {
            "creative_brief": cbd,
            "source_inputs": project_config.get("source_inputs") or cbd.get("source_inputs") or {},
        }
    keep: Dict[str, Any] = {}
    pc = cbd.get("project_constraints")
    if isinstance(pc, dict):
        slim_pc = dict(pc)
        raw_language_policy = project_config.get("language_policy")
        language_policy = raw_language_policy if isinstance(raw_language_policy, dict) else {}
        target_market = language_policy.get("target_market") or project_config.get("target_market")
        if target_market:
            slim_pc["target_market"] = target_market
        keep["project_constraints"] = slim_pc
    pf = cbd.get("product_facts")
    if isinstance(pf, dict):
        slim = {kk: pf[kk] for kk in ("name", "product_visual_features", "category", "brand") if kk in pf}
        if slim:
            keep["product_facts"] = slim
    return keep


_PRODUCT_STORY_FIELDS = (
    "product_name",
    "product_category",
    "product_summary",
    "core_selling_points",
    "target_users",
    "usage_scenarios",
    "visual_features",
    "user_pain_points",
    "immutable_structure_constraints",
    "product_form",
    "key_functions",
)


def _compact_product_for_story(product: ProductContextSchema) -> Dict[str, Any]:
    d = product.model_dump()
    return {k: d[k] for k in _PRODUCT_STORY_FIELDS if k in d}


def _as_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _as_list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _clip_s2_text(value: Any, max_chars: int = _S2_STRING_MAX_CHARS) -> str:
    text = str(value or "").strip()
    if len(text) <= max_chars:
        return text
    return text[: max_chars - 15] + "...[truncated]"


def _s2_string_has_image_data(value: str) -> bool:
    low = value.lower()
    return "data:image" in low or "base64," in low


def _s2_key_is_image_data(key: str) -> bool:
    low = str(key or "").lower()
    return any(marker in low for marker in _S2_IMAGE_DATA_KEY_MARKERS)


def _sanitize_s2_payload(value: Any, *, key: str = "") -> Any:
    if isinstance(value, dict):
        return {str(k): _sanitize_s2_payload(v, key=str(k)) for k, v in value.items()}
    if isinstance(value, list):
        return [_sanitize_s2_payload(item, key=key) for item in value]
    if isinstance(value, str):
        if _s2_string_has_image_data(value):
            return "[omitted_base64_image_data]"
        if _s2_key_is_image_data(key) and len(value) > 512:
            return "[omitted_image_data]"
        if len(value) > _S2_STRING_MAX_CHARS:
            return _clip_s2_text(value)
        return value
    return value


def _compact_creative_brief_for_s2(creative_brief: Any) -> dict[str, Any]:
    brief = dict(creative_brief) if isinstance(creative_brief, dict) else {}
    brief.pop("source_inputs", None)
    return _sanitize_s2_payload(brief)


def _compact_product_understanding_for_s2(product_understanding: Any, creative_brief: dict[str, Any]) -> dict[str, Any]:
    src = product_understanding if isinstance(product_understanding, dict) else {}
    if not src:
        src = _as_dict(creative_brief.get("product_understanding"))
    out: dict[str, Any] = {}
    for key in (
        "product_summary",
        "visual_identity",
        "use_contexts",
        "likely_selling_angles",
        "avoid_notes",
        "uncertainties",
        "what_it_is",
        "key_visual_features",
        "likely_use_situations",
    ):
        if key in src:
            out[key] = src[key]
    return _sanitize_s2_payload(out)


def _build_source_summary_for_s2(source_inputs: Any) -> dict[str, Any]:
    source = _as_dict(source_inputs)
    product_input = _as_dict(source.get("product_input"))
    images = _as_list(product_input.get("product_images"))
    return {
        "has_product_images": bool(images),
        "product_image_count": len(images),
        "product_note": _clip_s2_text(product_input.get("product_note")),
        "product_url_present": bool(str(product_input.get("product_url") or "").strip()),
    }


def build_s2_compact_context(
    *,
    project_id: int,
    project_config: Dict[str, Any],
) -> dict[str, Any]:
    source_inputs = _as_dict(project_config.get("source_inputs"))
    creative_intent_input = _as_dict(source_inputs.get("creative_intent_input"))
    creative_brief = _compact_creative_brief_for_s2(project_config.get("creative_brief_data") or {})
    product_understanding = _compact_product_understanding_for_s2(
        source_inputs.get("product_understanding"),
        creative_brief,
    )
    payload = {
        "project_id": project_id,
        "language_policy": project_config.get("language_policy") or {},
        "creative_brief": creative_brief,
        "creative_intent_input_summary": {
            "intent_text": _clip_s2_text(creative_intent_input.get("intent_text")),
            "platform_hints": [str(x).strip() for x in _as_list(creative_intent_input.get("platform_hints")) if str(x).strip()],
            "duration_hint": str(creative_intent_input.get("duration_hint") or "").strip(),
            "aspect_ratio_hint": str(creative_intent_input.get("aspect_ratio_hint") or "").strip(),
        },
        "product_understanding": product_understanding,
        "source_summary": _build_source_summary_for_s2(source_inputs),
    }
    return _sanitize_s2_payload(payload)


def _inspect_s2_payload(payload: dict[str, Any]) -> tuple[str, bool, bool]:
    payload_json = json.dumps(payload, ensure_ascii=False, default=str)
    low = payload_json.lower()
    return payload_json, "data:image" in low, "base64," in low


def _validate_s2_payload_for_provider(project_id: int, payload: dict[str, Any]) -> int:
    payload_json, has_data_url, has_base64_marker = _inspect_s2_payload(payload)
    source_summary_chars = len(json.dumps(payload.get("source_summary") or {}, ensure_ascii=False, default=str))
    creative_brief_chars = len(json.dumps(payload.get("creative_brief") or {}, ensure_ascii=False, default=str))
    logger.info(
        "[S2_INPUT_CONTEXT_SANITIZED] project_id=%s user_payload_chars=%s has_data_url=%s has_base64_marker=%s payload_keys=%s creative_brief_chars=%s source_summary_chars=%s",
        project_id,
        len(payload_json),
        has_data_url,
        has_base64_marker,
        list(payload.keys()),
        creative_brief_chars,
        source_summary_chars,
    )
    logger.info(
        "[S2_USE_CREATIVE_BRIEF] project_id=%s has_creative_brief=%s creative_brief_keys=%s creative_brief_chars=%s final_payload_chars=%s has_data_url=%s has_base64_marker=%s",
        project_id,
        bool(payload.get("creative_brief")),
        list(_as_dict(payload.get("creative_brief")).keys()),
        creative_brief_chars,
        len(payload_json),
        has_data_url,
        has_base64_marker,
    )
    if has_data_url or has_base64_marker:
        raise ShortDramaInvalidModelOutputError(
            "S2 payload still contains image data after sanitization",
            code="s2_payload_contains_image_data",
        )
    if len(payload_json) > _S2_PAYLOAD_MAX_CHARS:
        raise ShortDramaInvalidModelOutputError(
            "S2 payload too large after sanitization",
            code="s2_payload_too_large",
        )
    return len(payload_json)


_S2_SUSPICIOUS_IMAGE_KEY_MARKERS = (
    "image_analysis",
    "raw_image_analysis",
    "vision_analysis",
    "ocr",
    "image_understanding",
    "image_caption",
    "visual_description",
    "image_parse_result",
    "per_image_notes",
    "extracted_from_images",
    "raw_inputs",
    "image_understanding_json",
    "normalized_context",
    "debug",
    "trace",
    "field_meta",
    "source_trace",
)


def _s2_value_char_len(value: Any) -> int:
    if value is None:
        return 0
    if isinstance(value, str):
        return len(value)
    if isinstance(value, (list, dict)):
        return len(json.dumps(value, ensure_ascii=False))
    return len(str(value))


def _s2_collect_suspicious_image_fields(obj: Any, prefix: str = "") -> list[tuple[str, int]]:
    hits: list[tuple[str, int]] = []
    if isinstance(obj, dict):
        for key, value in obj.items():
            path = f"{prefix}.{key}" if prefix else str(key)
            key_low = str(key).lower()
            if any(marker in key_low for marker in _S2_SUSPICIOUS_IMAGE_KEY_MARKERS):
                hits.append((path, _s2_value_char_len(value)))
            hits.extend(_s2_collect_suspicious_image_fields(value, path))
    elif isinstance(obj, list):
        for idx, item in enumerate(obj):
            hits.extend(_s2_collect_suspicious_image_fields(item, f"{prefix}[{idx}]"))
    return hits


def _s2_count_image_urls(obj: Any) -> int:
    count = 0
    if isinstance(obj, str):
        text = obj.strip().lower()
        if text.startswith(("http://", "https://", "data:image")):
            return 1
        return 0
    if isinstance(obj, dict):
        return sum(_s2_count_image_urls(v) for v in obj.values())
    if isinstance(obj, list):
        return sum(_s2_count_image_urls(v) for v in obj)
    return 0


def _s2_has_key_named(obj: Any, key_name: str) -> bool:
    if isinstance(obj, dict):
        if key_name in obj:
            return True
        return any(_s2_has_key_named(v, key_name) for v in obj.values())
    if isinstance(obj, list):
        return any(_s2_has_key_named(v, key_name) for v in obj)
    return False


def _log_s2_payload_audit(project_id: int, user_payload: Dict[str, Any]) -> None:
    payload_json = json.dumps(user_payload, ensure_ascii=False)
    product = user_payload.get("product") if isinstance(user_payload.get("product"), dict) else {}
    creative_context = (
        user_payload.get("creative_context") if isinstance(user_payload.get("creative_context"), dict) else {}
    )
    suspicious = _s2_collect_suspicious_image_fields(user_payload)
    suspicious_paths = [path for path, _ in suspicious]
    suspicious_chars = {path: chars for path, chars in suspicious}
    logger.info(
        "[S2_PAYLOAD_AUDIT] %s",
        json.dumps(
            {
                "project_id": project_id,
                "top_keys": list(user_payload.keys()),
                "user_payload_chars": len(payload_json),
                "product_keys": list(product.keys()),
                "creative_context_keys": list(creative_context.keys()),
                "suspicious_image_text_fields": suspicious_paths,
                "suspicious_image_text_chars": suspicious_chars,
                "image_url_count": _s2_count_image_urls(user_payload),
                "has_raw_image_analysis": _s2_has_key_named(user_payload, "raw_image_analysis"),
            },
            ensure_ascii=False,
        ),
    )


_S2_FIELD_AUDIT_PRODUCT_FIELDS = (
    "product_name",
    "product_category",
    "product_summary",
    "visual_features",
    "core_selling_points",
    "key_functions",
    "usage_scenarios",
    "target_users",
    "user_pain_points",
    "immutable_structure_constraints",
    "product_form",
)

_S2_FIELD_AUDIT_CREATIVE_CONTEXT_FIELDS = (
    "product_facts",
    "project_constraints",
)

_S2_SUSPICIOUS_CREATIVE_KEYWORDS = (
    "剧情",
    "故事",
    "剧本",
    "镜头",
    "转化",
    "钩子",
    "冲突",
    "情绪弧",
    "cta",
    "场景",
    "角色",
)


def _s2_audit_clip_value(value: Any, max_chars: int = 800, max_items: int = 10) -> Any:
    if isinstance(value, str):
        return value if len(value) <= max_chars else value[: max_chars - 3] + "..."
    if isinstance(value, list):
        clipped = [_s2_audit_clip_value(item, max_chars=max_chars, max_items=max_items) for item in value[:max_items]]
        text = json.dumps(clipped, ensure_ascii=False, default=str)
        if len(text) <= max_chars:
            return clipped
        return text[: max_chars - 3] + "..."
    if isinstance(value, dict):
        clipped_dict = {
            str(k): _s2_audit_clip_value(v, max_chars=max_chars, max_items=max_items)
            for k, v in value.items()
        }
        text = json.dumps(clipped_dict, ensure_ascii=False, default=str)
        if len(text) <= max_chars:
            return clipped_dict
        return text[: max_chars - 3] + "..."
    return value


def _s2_field_char_count(value: Any) -> int:
    if value is None:
        return 0
    if isinstance(value, str):
        return len(value)
    return len(json.dumps(value, ensure_ascii=False, default=str))


def _s2_collect_suspicious_creative_fields(fields: dict[str, Any]) -> list[str]:
    hits: list[str] = []
    for path, value in fields.items():
        text = json.dumps(value, ensure_ascii=False, default=str) if not isinstance(value, str) else value
        low = text.lower()
        if any(keyword.lower() in low for keyword in _S2_SUSPICIOUS_CREATIVE_KEYWORDS):
            hits.append(path)
    return hits


def _log_s2_payload_field_audit(project_id: int, user_payload: Dict[str, Any]) -> None:
    product = user_payload.get("product") if isinstance(user_payload.get("product"), dict) else {}
    creative_context = (
        user_payload.get("creative_context") if isinstance(user_payload.get("creative_context"), dict) else {}
    )
    watched_fields: dict[str, Any] = {
        **{f"product.{field}": product.get(field) for field in _S2_FIELD_AUDIT_PRODUCT_FIELDS},
        **{
            f"creative_context.{field}": creative_context.get(field)
            for field in _S2_FIELD_AUDIT_CREATIVE_CONTEXT_FIELDS
        },
    }
    logger.info(
        "[S2_PAYLOAD_FIELD_AUDIT] %s",
        json.dumps(
            {
                "project_id": project_id,
                "user_payload_chars": len(json.dumps(user_payload, ensure_ascii=False, default=str)),
                "product": {
                    field: _s2_audit_clip_value(product.get(field))
                    for field in _S2_FIELD_AUDIT_PRODUCT_FIELDS
                },
                "creative_context": {
                    field: _s2_audit_clip_value(creative_context.get(field))
                    for field in _S2_FIELD_AUDIT_CREATIVE_CONTEXT_FIELDS
                },
                "field_char_counts": {
                    path: _s2_field_char_count(value)
                    for path, value in watched_fields.items()
                },
                "suspicious_creative_fields": _s2_collect_suspicious_creative_fields(watched_fields),
            },
            ensure_ascii=False,
        ),
    )


def _collect_non_empty_overwrites(before: dict[str, Any], after: dict[str, Any]) -> list[dict[str, Any]]:
    overwrites: list[dict[str, Any]] = []
    for key, before_v in before.items():
        after_v = after.get(key)
        if before_v != after_v and before_v not in (None, "", [], {}) and after_v not in (None, "", [], {}):
            overwrites.append(
                {
                    "field_path": key,
                    "before": before_v,
                    "after": after_v,
                    "reason": "_normalize_blueprint_for_execution",
                }
            )
    return overwrites
_SCRIPT_STRUCTURE_TYPES = {
    "product_demo_ad",
    "problem_solution_ad",
    "ugc_review",
    "story_drama",
    "before_after_bridge",
    "pas",
    "aida",
    "unboxing_review",
    "scene_pain_solution",
    "twist_reveal",
}
_BRAND_SEEDING_BANNED_TERMS = (
    "摔坏",
    "易损",
    "保护焦虑",
    "风险放大",
    "立即购买",
    "强冲突",
    "解决痛点",
    "购买欲",
    "抢购",
    "强 CTA",
    "强CTA",
    "损坏",
    "焦虑",
    "痛点",
)
_FRAMEWORK_ALIGNMENT_ALERT_TERMS = ("摔坏", "风险", "立即购买", "痛点", "焦虑", "损坏")
_STORY_STYLE_ALIASES = {"conflict": "light_conflict"}
_ALLOWED_STORY_STYLES = {"light_conflict", "healing", "comedy", "suspense", "emotional"}
class StoryPlannerProvider(Protocol):
    def plan(
        self,
        project_id: int,
        product: ProductContextSchema,
        project_config: Dict[str, Any],
    ) -> StoryBlueprintSchema: ...


class MockStoryPlannerProvider:
    def plan(
        self,
        project_id: int,
        product: ProductContextSchema,
        project_config: Dict[str, Any],
    ) -> StoryBlueprintSchema:
        pname = product.product_name
        style = project_config.get("style") or "生活流"
        duration = project_config.get("duration") or "45s"
        fmt = project_config.get("format") or "single_ad"
        summary = (product.product_summary or "").strip()
        users = "、".join([u for u in product.target_users if u][:2]) or "泛用户"
        angle = (product.suitable_story_angles[0] if product.suitable_story_angles else "场景代入型")
        emotion = (product.emotional_value[0] if product.emotional_value else "获得感")
        points = [p for p in product.core_selling_points if p][:3]
        if not points:
            points = ["示例卖点A", "示例卖点B", "示例卖点C"]
        marketing_goal = str(project_config.get("marketing_goal") or "brand_seeding")
        brief = str(project_config.get("creative_brief") or "").strip()
        conflict_text = f"信任与试错成本（叙事角度：{angle}）"
        if marketing_goal == "pain_point_conversion":
            conflict_text = f"高频痛点反复出现，必须快速验证解决方案（叙事角度：{angle}）"
        elif marketing_goal == "corporate_promo":
            conflict_text = f"品牌认知不足，需要通过企业实力建立信任（叙事角度：{angle}）"
        v2_layers: Dict[str, Any] = dict(default_creative_blueprint_v2_attachment(product_name=pname))
        v2_layers["video_generation_specs"] = [
            {
                "spec_key": "vid_seg_1",
                "segment_id": "seg_1",
                "shot_id": "seg_1_shot_1",
                "video_prompt": (
                    "Single continuous vertical 9:16 segment: commuter morning hook in one flowing beat from "
                    "establishing lifestyle tension through natural blocking to a clear emotional turn."
                ),
                "reference_asset_keys": ["asset_char_main", "asset_scene_main", "asset_prod_main"],
                "duration_sec": 8.0,
                "aspect_ratio": "9:16",
                "camera": "handheld medium",
                "visual_action": "establish commuter tension and morning routine beat",
                "audio_notes": "ambient city morning; light foley",
                "dialogue_or_voiceover_ref": "dov_1",
                "must_show": [pname],
                "must_avoid": ["medical claims", "before/after skin", "guaranteed results"],
            },
            {
                "spec_key": "vid_seg_2",
                "segment_id": "seg_2",
                "shot_id": "seg_2_shot_1",
                "video_prompt": (
                    "Full segment two vertical 9:16: one continuous product-in-context trial beat with smooth "
                    "handheld rhythm, natural gestures, and clear readable hero SKU without splitting into per-cut specs."
                ),
                "reference_asset_keys": ["asset_char_main", "asset_scene_main", "asset_prod_main"],
                "duration_sec": 8.0,
                "aspect_ratio": "9:16",
                "camera": "handheld close and medium",
                "visual_action": "demo handling and feature read; steady reveal",
                "audio_notes": "",
                "dialogue_or_voiceover_ref": "",
                "must_show": [pname],
                "must_avoid": ["medical claims", "before/after skin", "guaranteed results"],
            },
            {
                "spec_key": "vid_seg_3",
                "segment_id": "seg_3",
                "shot_id": "seg_3_shot_1",
                "video_prompt": (
                    "Full segment three vertical 9:16: payoff and soft CTA in one uninterrupted beat with warm "
                    "lighting, calm pacing, and a clear packshot integrated into the segment arc."
                ),
                "reference_asset_keys": ["asset_char_main", "asset_scene_main", "asset_prod_main"],
                "duration_sec": 8.0,
                "aspect_ratio": "9:16",
                "camera": "slow push toward label",
                "visual_action": "resolution calm; product rest moment",
                "audio_notes": "",
                "dialogue_or_voiceover_ref": "dov_2",
                "must_show": [pname],
                "must_avoid": ["medical claims", "before/after skin", "guaranteed results"],
            },
        ]
        bp = StoryBlueprintSchema(
            title=f"{pname} · 都市轻喜剧短片",
            script_title=f"{pname} · 都市轻喜剧短片",
            format=fmt,
            style=style,
            script_structure_type="story_drama",
            script_type_display="剧情种草型广告",
            structure_type_display="开场 → 体验 → 收束",
            structure_reason_for_user="根据测试环境的产品上下文生成三段式样例结构。",
            premise=f"{summary or f'主角在真实日常压力中遇到与 {pname} 相关的选择。'}（目标用户：{users}）",
            hook="强共鸣开场：尴尬/赶时间/社交压力",
            core_conflict=conflict_text,
            twist="产品以自然方式破局",
            resolution=f"情绪落地（{emotion}） + 品牌正向记忆点",
            segment_plan=[
                SegmentPlanItemSchema(
                    segment_id="seg_1",
                    stage_name="开场",
                    title="第一段：建立共鸣",
                    segment_title="第一段：建立共鸣",
                    segment_goal="建立共鸣与悬念",
                    goal="建立共鸣与悬念",
                    duration_seconds=12.0,
                    story_beat="hook",
                    summary="快节奏生活切片，抛出痛点",
                    transition_to_next="自然过渡到产品体验段。",
                    product_exposure_mode="none_or_blurred",
                    source_selling_point=points[0],
                    key_message=points[0],
                    product_feature_to_show=(product.visual_features[0] if product.visual_features else "外观质感"),
                    target_user_trigger=users,
                    required_visual_elements=list(product.visual_features[:2]) if product.visual_features else ["视觉锚点A"],
                    required_assets=["char_ref", "scene_ref"],
                ),
                SegmentPlanItemSchema(
                    segment_id="seg_2",
                    stage_name="体验",
                    title="第二段：产品体验",
                    segment_title="第二段：产品体验",
                    segment_goal="引入产品与体验",
                    goal="引入产品与体验",
                    duration_seconds=15.0,
                    story_beat="build",
                    summary="产品出现与试用，展示核心特征",
                    transition_to_next="过渡到结果收束段。",
                    product_exposure_mode="hero_demo",
                    source_selling_point=points[1],
                    key_message=points[1],
                    product_feature_to_show=(product.visual_features[1] if len(product.visual_features) > 1 else "功能细节"),
                    target_user_trigger=users,
                    required_visual_elements=list(product.visual_features[:3]) if product.visual_features else ["视觉锚点B"],
                    required_assets=["char_ref", "scene_ref", "product_ref"],
                ),
                SegmentPlanItemSchema(
                    segment_id="seg_3",
                    stage_name="收束",
                    title="第三段：反转收尾",
                    segment_title="第三段：反转收尾",
                    segment_goal="反转收尾与 CTA",
                    goal="反转收尾与 CTA",
                    duration_seconds=18.0,
                    story_beat="resolution",
                    summary="结果验证 + 轻 CTA",
                    transition_to_next="全片结束。",
                    product_exposure_mode="logo_packshot",
                    source_selling_point=points[2],
                    key_message=points[2],
                    product_feature_to_show=(product.visual_features[2] if len(product.visual_features) > 2 else "记忆点外观"),
                    target_user_trigger=users,
                    required_visual_elements=list(product.visual_features[:2]) if product.visual_features else ["视觉锚点C"],
                    required_assets=["char_ref", "scene_ref", "product_ref"],
                ),
            ],
            scene_goals={"seg_1": "建立痛点", "seg_2": "展示产品卖点", "seg_3": "结果证明"},
            product_selling_point_mapping={
                sid: points[i] if i < len(points) else (points[-1] if points else "")
                for i, sid in enumerate(("seg_1", "seg_2", "seg_3"))
            },
            target_user_expression=users,
            visual_requirements=[*product.visual_features[:4], project_config.get("visual_style") or ""],
            story_framework={
                "type": "story_drama",
                "name": "剧情种草型广告",
                "structure": ["开场", "体验", "收束"],
                "reason": "Mock provider test fixture.",
            },
            dialogue_tone=style,
            must_show_elements=[pname, *points[:3]],
            must_avoid_elements=product.visual_risk_notes[:6],
            meta={"provider": "mock", "duration_hint": duration, "marketing_goal": marketing_goal, "creative_brief": brief},
            shot_plan={
                "segments": [
                    {
                        "id": "seg_1",
                        "name": "开场",
                        "shots": [
                            {
                                "id": "seg_1_shot_1",
                                "video_prompt": "Vertical 9:16 cinematic segment one establishing slice-of-life pacing.",
                            }
                        ],
                    },
                    {
                        "id": "seg_2",
                        "name": "体验",
                        "shots": [
                            {
                                "id": "seg_2_shot_1",
                                "video_prompt": "Vertical 9:16 product demo beat with natural handheld motion.",
                            }
                        ],
                    },
                    {
                        "id": "seg_3",
                        "name": "收束",
                        "shots": [
                            {
                                "id": "seg_3_shot_1",
                                "video_prompt": "Vertical 9:16 payoff beat with soft lighting and clear packshot room.",
                            }
                        ],
                    },
                ]
            },
            asset_requirements={
                "characters": [{"name": "MockLead", "role": "main", "image_prompt": "clean portrait"}],
                "scenes": [{"name": "MockScene", "location": "studio", "image_prompt": "empty set"}],
                "products": [{"name": pname, "product_role": "hero", "image_prompt": "product hero"}],
            },
            **v2_layers,
        )
        return _normalize_blueprint_for_execution(bp, product, project_config)


class XAIStoryPlannerProvider:
    def __init__(self, text_provider: XAITextProvider):
        self._text = text_provider

    def _repair_provider_duration_error(
        self,
        *,
        project_id: int,
        product: ProductContextSchema,
        project_config: Dict[str, Any],
        original_blueprint_data: Dict[str, Any],
        validation_error: ShortDramaInvalidModelOutputError,
        repair_attempt: int = 1,
    ) -> StoryBlueprintSchema:
        error_payload = {
            "reason": getattr(validation_error, "reason", None) or "provider_duration_exceeded",
            "segment_id": getattr(validation_error, "segment_id", None),
            "duration_seconds": getattr(validation_error, "duration_seconds", None),
            "provider_max_duration_seconds": (
                getattr(validation_error, "provider_max_duration_seconds", None)
                or PROVIDER_MAX_VIDEO_DURATION_SECONDS
            ),
            "missing_fields": getattr(validation_error, "missing_fields", []),
            "message": str(validation_error),
            "action": "shorten or split this segment so every executable duration is within provider limit",
            "output": "complete valid JSON",
        }
        logger.info(
            "[S2_BLUEPRINT_REPAIR_START] %s",
            json.dumps(
                {
                    "project_id": project_id,
                    "repair_attempt": repair_attempt,
                    "reason": error_payload["reason"],
                },
                ensure_ascii=False,
                default=str,
            ),
        )
        repair_payload = {
            "project_id": project_id,
            "validation_error": error_payload,
            "provider_constraints": {
                "provider_max_duration_seconds": PROVIDER_MAX_VIDEO_DURATION_SECONDS,
                "do_not_hardcode_segment_count_from_total_duration": True,
            },
            "original_blueprint": original_blueprint_data,
        }
        try:
            repaired_data = self._text.generate_structured_json(
                project_id=project_id,
                service_name="story_planner_repair",
                system_prompt=STORY_PLANNER_REPAIR_SYSTEM_PROMPT,
                user_payload=repair_payload,
                image_urls=None,
                expected_schema_name="StoryBlueprint",
                stage="STORY_GENERATION_REPAIR",
                model=effective_xai_story_model(),
                max_output_tokens=effective_xai_story_max_output_tokens(),
            )
            repaired_blueprint = parse_story_blueprint_json(repaired_data)
            repaired_blueprint = _normalize_blueprint_for_execution(repaired_blueprint, product, project_config)
            logger.info(
                "[S2_BLUEPRINT_REPAIR_SUCCESS] %s",
                json.dumps(
                    {
                        "project_id": project_id,
                        "repair_attempt": repair_attempt,
                        "video_generation_specs_count": len(repaired_blueprint.video_generation_specs or []),
                    },
                    ensure_ascii=False,
                    default=str,
                ),
            )
            return repaired_blueprint
        except Exception as repair_error:
            logger.warning(
                "[S2_BLUEPRINT_REPAIR_FAILED] %s",
                json.dumps(
                    {
                        "project_id": project_id,
                        "repair_attempt": repair_attempt,
                        "error": str(repair_error),
                    },
                    ensure_ascii=False,
                    default=str,
                ),
            )
            raise

    def plan(
        self,
        project_id: int,
        product: ProductContextSchema,
        project_config: Dict[str, Any],
    ) -> StoryBlueprintSchema:
        logger.info(
            "STORY_GENERATION_STARTED %s",
            {"project_id": project_id, "stage": "STORY_GENERATION", "provider": "xai"},
        )
        try:
            s2_payload = build_s2_compact_context(project_id=project_id, project_config=project_config)
            _log_s2_payload_audit(project_id, s2_payload)
            _log_s2_payload_field_audit(project_id, s2_payload)
            _trace(
                "S2_INPUT_CONTEXT",
                {
                    "project_id": project_id,
                    "user_payload_keys": list(s2_payload.keys()),
                    "user_payload_chars": len(json.dumps(s2_payload, ensure_ascii=False)),
                    "language_policy": s2_payload.get("language_policy"),
                },
            )
            sp_len = len(STORY_PLANNER_SYSTEM_PROMPT)
            up_chars = _validate_s2_payload_for_provider(project_id, s2_payload)
            logger.info(
                "[S2_PROMPT] %s",
                json.dumps(
                    {
                        "system_prompt_len": sp_len,
                        "user_payload_chars": up_chars,
                        "user_payload_keys": list(s2_payload.keys()),
                    },
                    ensure_ascii=False,
                ),
            )
            _trace(
                "S2_PROMPT",
                {
                    "project_id": project_id,
                    "system_prompt_len": sp_len,
                    "user_payload_chars": up_chars,
                    "provider": "xai_text_provider",
                    "model": effective_xai_story_model(),
                },
            )
            data = self._text.generate_structured_json(
                project_id=project_id,
                service_name="story_planner",
                system_prompt=STORY_PLANNER_SYSTEM_PROMPT,
                user_payload=s2_payload,
                image_urls=None,
                expected_schema_name="StoryBlueprint",
                stage="STORY_GENERATION",
                model=effective_xai_story_model(),
                max_output_tokens=effective_xai_story_max_output_tokens(),
            )
            logger.info("[S2_RESPONSE] %s", json.dumps(data, ensure_ascii=False))
            _trace("S2_SCHEMA_VALIDATED", {"project_id": project_id, "schema": data})
            blueprint = parse_story_blueprint_json(data)
            before_normalize = blueprint.model_dump()
            _trace("S2_BEFORE_NORMALIZE", {"project_id": project_id, "blueprint": before_normalize})
            try:
                blueprint = _normalize_blueprint_for_execution(blueprint, product, project_config)
            except ShortDramaInvalidModelOutputError as e:
                if not _is_provider_duration_error(e):
                    raise
                blueprint = self._repair_provider_duration_error(
                    project_id=project_id,
                    product=product,
                    project_config=project_config,
                    original_blueprint_data=data,
                    validation_error=e,
                    repair_attempt=1,
                )
            after_normalize = blueprint.model_dump()
            _trace("S2_AFTER_NORMALIZE", {"project_id": project_id, "blueprint": after_normalize})
            overwrites = _collect_non_empty_overwrites(before_normalize, after_normalize)
            if overwrites:
                _trace("S2_NORMALIZE_OVERWRITE", {"project_id": project_id, "overwrites": overwrites})
            _warn_workflow_language_mismatch(
                project_id=project_id,
                blueprint=blueprint,
                workflow_language=str(project_config.get("workflow_language") or "zh-CN"),
            )
            _validate_story_content_quality(blueprint, product)
            logger.info(
                "STORY_GENERATION_SUCCEEDED %s",
                {"project_id": project_id, "stage": "STORY_GENERATION", "provider": "xai"},
            )
            return blueprint
        except Exception as e:
            logger.info(
                "STORY_GENERATION_FAILED %s",
                {
                    "project_id": project_id,
                    "stage": "STORY_GENERATION",
                    "provider": "xai",
                    "error_type": type(e).__name__,
                },
            )
            raise


class StoryPlannerService:
    def __init__(self, provider: StoryPlannerProvider | None = None):
        self._provider = provider or MockStoryPlannerProvider()

    def generate(
        self,
        project_id: int,
        product: ProductContextSchema,
        project_config: Dict[str, Any],
    ) -> StoryBlueprintSchema:
        blueprint = _normalize_blueprint_for_execution(
            self._provider.plan(project_id, product, project_config),
            product,
            project_config,
        )
        _warn_workflow_language_mismatch(
            project_id=project_id,
            blueprint=blueprint,
            workflow_language=str(project_config.get("workflow_language") or "zh-CN"),
        )
        return blueprint


def _duration_budget_seconds(raw: Any) -> float:
    text = str(raw or "").strip()
    m = re.search(r"\d+(?:\.\d+)?", text)
    if not m:
        return 45.0
    try:
        return max(9.0, float(m.group(0)))
    except ValueError:
        return 45.0


def _segment_count_for_project(total: float, project_config: Dict[str, Any], product: ProductContextSchema) -> int:
    """Deprecated: S2 decides story paragraph count from the creative brief."""
    return 0


def _segment_durations(total: float, count: int) -> list[float]:
    total_value = max(1.0, float(total or 0.0))
    segment_count = max(1, int(count or 1))
    durations: list[float] = []
    remaining = total_value
    for idx in range(segment_count):
        slots_left = segment_count - idx - 1
        min_rest = slots_left * 1.0
        max_rest = slots_left * 10.0
        ideal = remaining / (slots_left + 1)
        low = max(1.0, remaining - max_rest)
        high = min(10.0, remaining - min_rest)
        value = min(max(ideal, low), high)
        durations.append(value)
        remaining -= value
    rounded = [round(v, 1) for v in durations]
    delta = round(total_value - sum(rounded), 1)
    if rounded:
        adjusted_last = round(min(10.0, max(1.0, rounded[-1] + delta)), 1)
        rounded[-1] = adjusted_last
    return rounded


def _contains_terms(text: str, terms: tuple[str, ...]) -> bool:
    blob = str(text or "")
    return any(term in blob for term in terms)


def _log_s2_duration_validate_failed(
    *,
    project_id: Any,
    reason: str,
    segment_id: str,
    duration_seconds: float,
    provider_max_duration_seconds: float = PROVIDER_MAX_VIDEO_DURATION_SECONDS,
) -> None:
    logger.warning(
        "[S2_BLUEPRINT_VALIDATE_FAILED] %s",
        json.dumps(
            {
                "project_id": project_id,
                "reason": reason,
                "segment_id": segment_id,
                "duration_seconds": duration_seconds,
                "provider_max_duration_seconds": provider_max_duration_seconds,
            },
            ensure_ascii=False,
            default=str,
        ),
    )


def _duration_exceeded_error(
    *,
    project_id: Any,
    segment_id: str,
    duration_seconds: float,
    field: str,
    provider_max_duration_seconds: float = PROVIDER_MAX_VIDEO_DURATION_SECONDS,
) -> ShortDramaInvalidModelOutputError:
    reason = f"{field}_provider_max_exceeded"
    _log_s2_duration_validate_failed(
        project_id=project_id,
        reason=reason,
        segment_id=segment_id,
        duration_seconds=duration_seconds,
        provider_max_duration_seconds=provider_max_duration_seconds,
    )
    return ShortDramaInvalidModelOutputError(
        (
            f"S2 segment {segment_id} {field} {duration_seconds} exceeds provider maximum "
            f"{provider_max_duration_seconds}; shorten segment or split; regenerate S2."
        ),
        segment_id=segment_id,
        code="s2_provider_duration_exceeded",
        missing_fields=[field],
        reason=reason,
        duration_seconds=duration_seconds,
        provider_max_duration_seconds=provider_max_duration_seconds,
    )


def _is_provider_duration_error(exc: Exception) -> bool:
    return (
        isinstance(exc, ShortDramaInvalidModelOutputError)
        and getattr(exc, "code", None) == "s2_provider_duration_exceeded"
    )


def _looks_english_like_text(value: Any) -> bool:
    text = str(value or "").strip()
    if not text:
        return False
    letters = re.findall(r"[A-Za-z]", text)
    if len(letters) < 6:
        return False
    zh_chars = re.findall(r"[\u4e00-\u9fff]", text)
    return len(letters) >= max(6, len(zh_chars) * 2)


def _collect_workflow_language_mismatch_fields(blueprint: StoryBlueprintSchema, workflow_language: str) -> list[str]:
    if not str(workflow_language or "").strip().lower().startswith("zh"):
        return []
    mismatches: list[str] = []
    top_fields = (
        "title",
        "premise",
        "script_type_display",
        "structure_type_display",
        "structure_reason_for_user",
    )
    for field in top_fields:
        if _looks_english_like_text(getattr(blueprint, field, "")):
            mismatches.append(field)
    for idx, item in enumerate(blueprint.segment_plan or []):
        field_map = {
            "stage_name": item.stage_name,
            "segment_title": item.segment_title or item.title,
            "segment_goal": item.segment_goal or item.goal,
            "summary": item.summary,
        }
        for key, value in field_map.items():
            if _looks_english_like_text(value):
                mismatches.append(f"segment_plan[{idx}].{key}")
    return mismatches


def _warn_workflow_language_mismatch(project_id: int, blueprint: StoryBlueprintSchema, workflow_language: str) -> None:
    mismatches = _collect_workflow_language_mismatch_fields(blueprint, workflow_language)
    if not mismatches:
        return
    logger.warning(
        "[S2_WORKFLOW_LANGUAGE_MISMATCH] %s",
        {
            "project_id": project_id,
            "workflow_language": workflow_language,
            "fields": mismatches,
        },
    )


_VALID_V2_ASSET_KINDS = frozenset({"character", "scene", "product"})


def _validate_creative_blueprint_v2(blueprint: StoryBlueprintSchema, *, project_id: Any = None) -> None:
    """P1: full Creative Blueprint v2 must be present after S2 normalize (no backend autofill)."""
    if blueprint.blueprint_schema_version != CREATIVE_BLUEPRINT_V2_SCHEMA:
        return

    def _fail(msg: str, *, missing_fields: list[str]) -> None:
        logger.warning(
            "[AI_BLUEPRINT_VALIDATE_FAILED] project_id=%s missing_field=%s",
            project_id,
            ",".join(missing_fields),
        )
        raise ShortDramaInvalidModelOutputError(
            msg,
            code="creative_blueprint_v2_incomplete",
            missing_fields=missing_fields,
        )

    ov = blueprint.story_overview
    if ov is None or not (str(ov.title or "").strip() or str(ov.premise or "").strip()):
        _fail(
            "S2 creative_blueprint_v2 requires story_overview with title or premise.",
            missing_fields=["story_overview"],
        )
    if not blueprint.characters:
        _fail("S2 creative_blueprint_v2 requires characters[].", missing_fields=["characters"])
    for c in blueprint.characters:
        if not str(c.character_key or "").strip() or not str(c.display_name or "").strip():
            _fail(
                "S2 creative_blueprint_v2 characters[] requires character_key and display_name.",
                missing_fields=["characters.character_key"],
            )
    if not blueprint.scenes:
        _fail("S2 creative_blueprint_v2 requires scenes[].", missing_fields=["scenes"])
    if not blueprint.product_assets:
        _fail("S2 creative_blueprint_v2 requires product_assets[].", missing_fields=["product_assets"])
    if not blueprint.asset_generation_specs:
        _fail(
            "S2 creative_blueprint_v2 requires asset_generation_specs[].",
            missing_fields=["asset_generation_specs"],
        )
    if not blueprint.video_generation_specs:
        _fail(
            "S2 creative_blueprint_v2 requires video_generation_specs[].",
            missing_fields=["video_generation_specs"],
        )
    if not blueprint.dialogue_or_voiceover:
        _fail(
            "S2 creative_blueprint_v2 requires dialogue_or_voiceover[].",
            missing_fields=["dialogue_or_voiceover"],
        )
    if blueprint.subtitle_strategy is None:
        _fail("S2 creative_blueprint_v2 requires subtitle_strategy.", missing_fields=["subtitle_strategy"])
    if not blueprint.continuity_rules:
        _fail("S2 creative_blueprint_v2 requires continuity_rules[].", missing_fields=["continuity_rules"])
    if not blueprint.execution_notes:
        _fail("S2 creative_blueprint_v2 requires execution_notes[].", missing_fields=["execution_notes"])

    for cr in blueprint.continuity_rules or []:
        if str(getattr(cr, "severity", "") or "").strip().lower() == "medium":
            logger.warning(
                "[CONTINUITY_RULE_SEVERITY_MEDIUM] rule_key=%s applies_to=%s",
                getattr(cr, "rule_key", ""),
                getattr(cr, "applies_to", ""),
            )

    char_keys = {str(c.character_key).strip() for c in blueprint.characters if str(c.character_key or "").strip()}
    scene_keys = {str(s.scene_key).strip() for s in blueprint.scenes if str(s.scene_key or "").strip()}
    prod_keys = {str(p.product_asset_key).strip() for p in blueprint.product_assets if str(p.product_asset_key or "").strip()}
    asset_keys: set[str] = set()
    kinds: set[str] = set()
    seen_asset_keys: set[str] = set()
    for spec in blueprint.asset_generation_specs:
        ak = str(spec.asset_key or "").strip()
        if not ak:
            _fail(
                "S2 asset_generation_specs each require asset_key.",
                missing_fields=["asset_generation_specs.asset_key"],
            )
        if ak in seen_asset_keys:
            _fail(
                f"S2 asset_generation_specs duplicate asset_key {ak!r}.",
                missing_fields=["asset_generation_specs.asset_key"],
            )
        seen_asset_keys.add(ak)
        asset_keys.add(ak)

        kind = str(spec.asset_kind or "").strip()
        if kind not in _VALID_V2_ASSET_KINDS:
            _fail(
                f"S2 asset_generation_specs[{ak}] invalid asset_kind {kind!r} (expected character|scene|product).",
                missing_fields=["asset_generation_specs.asset_kind"],
            )
        kinds.add(kind)

        disp = str(spec.display_name or "").strip()
        img = str(spec.image_prompt or "").strip()
        desc = str(getattr(spec, "description", "") or "").strip()
        if not (img or desc or disp):
            _fail(
                f"S2 asset_generation_specs[{ak}] requires at least one of image_prompt, description, display_name.",
                missing_fields=["asset_generation_specs.display_or_prompt"],
            )

        lk = str(spec.linked_entity_key or "").strip()
        if spec.asset_kind == "character" and lk not in char_keys:
            _fail(
                f"S2 asset_generation_specs linked_entity_key {lk!r} must match characters[].character_key.",
                missing_fields=["asset_generation_specs.linked_entity_key"],
            )
        if spec.asset_kind == "scene" and lk not in scene_keys:
            _fail(
                f"S2 asset_generation_specs linked_entity_key {lk!r} must match scenes[].scene_key.",
                missing_fields=["asset_generation_specs.linked_entity_key"],
            )
        if spec.asset_kind == "product" and lk not in prod_keys:
            _fail(
                f"S2 asset_generation_specs linked_entity_key {lk!r} must match product_assets[].product_asset_key.",
                missing_fields=["asset_generation_specs.linked_entity_key"],
            )

    if not {"character", "scene", "product"}.issubset(kinds):
        _fail(
            "S2 asset_generation_specs must include at least one character, one scene, and one product spec.",
            missing_fields=["asset_generation_specs.asset_kind"],
        )

    seg_ids = {str(x.segment_id or "").strip() for x in blueprint.segment_plan if str(x.segment_id or "").strip()}
    vid_rows = list(blueprint.video_generation_specs or [])
    video_spec_segment_ids: list[str] = []
    for vidx, vs in enumerate(vid_rows):
        sid = str(vs.segment_id or "").strip()
        if not sid:
            _fail(
                f"S2 video_generation_specs[{vidx}] requires segment_id.",
                missing_fields=["video_generation_specs.segment_id"],
            )
        video_spec_segment_ids.append(sid)
    if len(video_spec_segment_ids) != len(set(video_spec_segment_ids)):
        _fail(
            "S2 video_generation_specs must not repeat segment_id; at most one row per segment.",
            missing_fields=["video_generation_specs.segment_id"],
        )
    spec_id_set = set(video_spec_segment_ids)
    if spec_id_set != seg_ids:
        missing = sorted(seg_ids - spec_id_set)
        extra = sorted(spec_id_set - seg_ids)
        detail_parts: list[str] = []
        if missing:
            detail_parts.append(f"missing segment_id coverage for {missing!r}")
        if extra:
            detail_parts.append(f"unknown segment_id {extra!r}")
        _fail(
            "S2 video_generation_specs segment_id set must exactly match segment_plan segment_id set "
            f"({'; '.join(detail_parts)}).",
            missing_fields=["video_generation_specs.segment_id"],
        )

    for vidx, vs in enumerate(vid_rows):
        if not str(vs.video_prompt or "").strip():
            _fail(
                f"S2 video_generation_specs[{vidx}] requires video_prompt.",
                missing_fields=["video_generation_specs.video_prompt"],
            )
        if float(vs.duration_sec or 0.0) <= 0:
            _fail(
                f"S2 video_generation_specs[{vidx}] requires duration_sec > 0.",
                missing_fields=["video_generation_specs.duration_sec"],
            )
        duration_value = float(vs.duration_sec or 0.0)
        if duration_value > PROVIDER_MAX_VIDEO_DURATION_SECONDS:
            raise _duration_exceeded_error(
                project_id=project_id,
                segment_id=str(vs.segment_id or "").strip() or f"video_generation_specs[{vidx}]",
                duration_seconds=duration_value,
                field="video_generation_specs.duration_sec",
            )
        for rk in vs.reference_asset_keys or []:
            rks = str(rk).strip()
            if rks and rks not in asset_keys:
                _fail(
                    "S2 video_generation_specs reference_asset_keys must exist in asset_generation_specs.asset_key "
                    f"(missing {rks!r}).",
                    missing_fields=["video_generation_specs.reference_asset_keys"],
                )


def _warn_brand_seeding_risk_terms(*, project_id: Any, field: str, text: str) -> None:
    if not text or not _contains_terms(str(text), _BRAND_SEEDING_BANNED_TERMS):
        return
    logger.warning(
        "[S2_BRAND_SEEDING_RISK_TERM_WARNING] project_id=%s field=%s",
        project_id,
        f"brand_seeding_risk_terms:{field}",
    )


def _validate_executable_shot_plan(
    shot_plan: Any,
    *,
    segment_plan_len: int,
    project_id: Any,
) -> None:
    if not isinstance(shot_plan, dict):
        logger.warning(
            "[AI_BLUEPRINT_VALIDATE_FAILED] project_id=%s missing_field=%s",
            project_id,
            "shot_plan",
        )
        raise ShortDramaInvalidModelOutputError(
            "S2 blueprint must include a shot_plan object; regenerate S2 or complete the blueprint.",
            code="ai_blueprint_validate_failed",
            missing_fields=["shot_plan"],
        )
    segments = shot_plan.get("segments")
    if not isinstance(segments, list) or len(segments) == 0:
        logger.warning(
            "[AI_BLUEPRINT_VALIDATE_FAILED] project_id=%s missing_field=%s",
            project_id,
            "shot_plan.segments",
        )
        raise ShortDramaInvalidModelOutputError(
            "S2 shot_plan.segments is missing or empty; regenerate S2 or add segments with shots.",
            code="ai_blueprint_validate_failed",
            missing_fields=["shot_plan.segments"],
        )
    if len(segments) != segment_plan_len:
        logger.warning(
            "[AI_BLUEPRINT_VALIDATE_FAILED] project_id=%s missing_field=%s",
            project_id,
            "shot_plan.segments.length_mismatch",
        )
        raise ShortDramaInvalidModelOutputError(
            "S2 shot_plan segment count must match segment_plan length; regenerate S2.",
            code="ai_blueprint_validate_failed",
            missing_fields=["shot_plan.segments.length_mismatch"],
        )
    for idx, seg in enumerate(segments):
        sid = str((seg or {}).get("id") or f"seg_{idx + 1}") if isinstance(seg, dict) else f"seg_{idx + 1}"
        if not isinstance(seg, dict):
            logger.warning(
                "[AI_BLUEPRINT_VALIDATE_FAILED] project_id=%s segment_id=%s missing_field=%s",
                project_id,
                sid,
                "shot_plan.segments[i]",
            )
            raise ShortDramaInvalidModelOutputError(
                f"S2 shot_plan segment {idx} is invalid; regenerate S2.",
                segment_id=sid,
                code="ai_blueprint_validate_failed",
                missing_fields=["shot_plan.segments[i]"],
            )
        shots = seg.get("shots")
        if not isinstance(shots, list) or len(shots) == 0:
            logger.warning(
                "[AI_BLUEPRINT_VALIDATE_FAILED] project_id=%s segment_id=%s missing_field=%s",
                project_id,
                sid,
                "shots",
            )
            raise ShortDramaInvalidModelOutputError(
                f"S2 shot_plan segment {sid!r} has no shots; regenerate S2 or add shots.",
                segment_id=sid,
                code="ai_blueprint_validate_failed",
                missing_fields=["shots"],
            )


def _normalize_story_style(raw: Any) -> str:
    value: Any = raw
    if isinstance(value, list):
        value = value[0] if value else ""
    text = str(value or "").strip()
    if "," in text:
        text = text.split(",")[0].strip()
    text = _STORY_STYLE_ALIASES.get(text, text)
    return text if text in _ALLOWED_STORY_STYLES else "light_conflict"


def _market_is_china(target_market: str) -> bool:
    v = str(target_market or "").strip().lower()
    return "china" in v or "中国" in v


def _market_is_japan(target_market: str) -> bool:
    v = str(target_market or "").strip().lower()
    return "japan" in v or "日本" in v


def _market_visual_constraints(target_market: str, target_audience: str) -> Dict[str, Any]:
    """legacy-only: used by _normalize_blueprint_legacy_for_execution / legacy asset_requirements merge; never for creative_blueprint_v2."""
    base = {
        "target_market": target_market or "North America",
        "target_audience": target_audience,
        "character_default": "符合目标市场广告语境的人物",
        "scene_default": "符合目标市场的生活广告场景",
        "performance": "自然、生活化、避免模板化商业模特表演",
        "negative_constraints": ["不要与目标市场审美冲突"],
    }
    if _market_is_japan(target_market):
        base.update(
            {
                "character_default": "日本都市青年 / 日本上班族 / 日本独居青年 / 东亚面孔",
                "wardrobe_grooming": "服装、妆发、气质符合日本生活广告审美",
                "scene_default": "日本城市通勤、公寓、便利店、咖啡店、办公室等生活广告场景",
                "performance": "克制、礼貌、自然、生活化，避免夸张戏剧表演",
                "negative_constraints": [
                    "不要默认欧美商业模特感角色",
                    "不要欧美图库广告场景",
                    "不要与日本市场生活广告审美冲突",
                ],
            }
        )
    elif _market_is_china(target_market):
        base.update(
            {
                "character_default": "中国/东亚都市年轻人外观",
                "scene_default": "中国城市通勤、办公室、咖啡店等生活广告场景",
                "negative_constraints": ["不要欧美商务模特感", "不要欧美图库场景感"],
            }
        )
    return base


def _visual_style_constraints(visual_style: Any, target_market: str) -> Dict[str, Any]:
    """legacy-only: used by legacy S2 normalize; never for creative_blueprint_v2."""
    name = str(visual_style or "").strip() or "写实电影感"
    lowered = name.lower()
    if name in {"写实电影感", "cinematic"} or "real" in lowered or "cinematic" in lowered:
        return {
            "style_name": "写实电影感" if name == "cinematic" else name,
            "image_texture": "真人广告片质感，真实材质，非卡通，非插画",
            "camera_language": "自然镜头语言，适当使用中景、近景、特写，保持生活化摄影",
            "lighting": "自然光或柔和商业广告光，避免强烈棚拍感",
            "color_palette": "低饱和、干净、现代、适合目标市场的生活广告色调",
            "performance_style": "克制、自然、生活化表演，避免夸张戏剧表演",
            "negative_constraints": [
                "不要动漫风",
                "不要欧美大片夸张光效",
                "不要过度磨皮",
                "不要夸张表演",
                "不要与目标市场审美冲突",
            ],
            "target_market": target_market,
        }
    return {
        "style_name": name,
        "image_texture": f"{name}视觉质感",
        "camera_language": "与项目视觉风格一致的镜头语言",
        "lighting": "符合广告片质感的自然光或柔和布光",
        "color_palette": "匹配目标市场审美的统一色调",
        "performance_style": "自然、生活化表演",
        "negative_constraints": ["不要与目标市场审美冲突"],
        "target_market": target_market,
    }


def _asset_requirements_with_market_constraints(
    asset_requirements: Dict[str, Any],
    product: ProductContextSchema,
    framework: Dict[str, Any],
    project_config: Dict[str, Any],
    language_policy: Dict[str, str],
    target_audience: str,
    brand_tone: str,
    creative_brief: str,
) -> Dict[str, Any]:
    """legacy-only: merged into legacy-normalized blueprints; never invoked for creative_blueprint_v2."""
    req = dict(asset_requirements or {})
    req.setdefault("characters", [])
    req.setdefault("scenes", [])
    req.setdefault("products", [])
    target_market = language_policy.get("target_market") or str(project_config.get("target_market") or "North America")
    workflow_language = language_policy.get("workflow_language") or "zh-CN"
    video_language = language_policy.get("video_language") or workflow_language
    audience_text = target_audience or "、".join(product.target_users[:2]) or "都市年轻人"
    market_visual = _market_visual_constraints(target_market, audience_text)
    style_visual = _visual_style_constraints(project_config.get("visual_style"), target_market)
    market_constraints: Dict[str, Any] = {
        "target_market": target_market,
        "target_audience": audience_text,
        "workflow_language": workflow_language,
        "video_language": video_language,
        "brand_tone": brand_tone,
        "creative_brief": creative_brief,
        "marketing_goal": framework.get("type"),
        "story_style": _normalize_story_style(project_config.get("style")),
        "constraints": [],
    }
    if _market_is_japan(target_market):
        market_constraints["constraints"] = [
            "日本市场语境",
            "日本都市青年 / 日本上班族 / 日本独居青年 / 东亚面孔",
            "服装、妆发、气质、表演方式符合日本生活广告审美",
            "禁止默认欧美商业模特感角色，除非剧本明确要求",
        ]
    elif _market_is_china(target_market):
        market_constraints["constraints"] = [
            "中国市场语境",
            "东亚/中国都市人群外观",
            "避免欧美商务模特风格，除非用户明确要求",
            "中国城市通勤/地铁/办公室/咖啡店等场景",
        ]
    req["market_constraints"] = market_constraints
    req["market_visual_constraints"] = market_visual
    req["visual_style_constraints"] = style_visual
    return req


def _diagnostic_dimensions(framework_type: str) -> list[str]:
    mapping = {
        "brand_seeding": ["生活方式感", "产品自然露出", "品牌记忆点", "过度销售检测", "痛点转化词污染检测"],
        "pain_point_conversion": ["痛点明确度", "风险具体性", "产品介入时机", "结果证明清晰度", "CTA明确度"],
        "product_demo": ["产品视觉露出", "核心功能镜头化", "使用场景清晰度", "细节卖点表达"],
        "corporate_promo": ["行业问题清晰度", "企业能力可信度", "场景专业度", "品牌信任建立"],
    }
    return mapping.get(framework_type, ["叙事节奏", "结构完整性", "表达一致性"])


def _log_framework_alignment(
    project_config: Dict[str, Any],
    story_framework: Dict[str, Any],
    shot_segments: list[Dict[str, Any]],
) -> None:
    marketing_goal = str((project_config.get("marketing_goal") or "brand_seeding")).strip() or "brand_seeding"
    framework_type = str(story_framework.get("type") or "").strip()
    section_labels = [str(x).strip() for x in (story_framework.get("structure") or []) if str(x).strip()]
    segment_names = [str((seg or {}).get("name") or "").strip() for seg in shot_segments]
    warning_if_mismatch = None
    if framework_type == "brand_seeding":
        content_blob = " ".join([*section_labels, *segment_names])
        if _contains_terms(content_blob, _FRAMEWORK_ALIGNMENT_ALERT_TERMS):
            warning_if_mismatch = (
                "brand_seeding framework contains legacy pain-point keywords in sections/segments"
            )
    logger.info(
        "[S2_FRAMEWORK_CONTENT_ALIGNMENT] %s",
        {
            "project_id": project_config.get("project_id"),
            "marketing_goal": marketing_goal,
            "framework_type": framework_type,
            "section_labels": section_labels,
            "segment_names": segment_names,
            "warning_if_mismatch": warning_if_mismatch,
        },
    )


def _validate_story_content_quality(blueprint: StoryBlueprintSchema, product: ProductContextSchema) -> None:
    product_name = str(product.product_name or "").strip()
    for segment in blueprint.segment_plan or []:
        stage = str(segment.stage_name or segment.story_beat or "").strip()
        title = str(segment.segment_title or segment.title or "").strip()
        goal = str(segment.segment_goal or segment.goal or "").strip()
        transition = str(segment.transition_to_next or "").strip()
        if "完成“" in goal and "阶段" in goal and "任务" in goal:
            raise ShortDramaInvalidModelOutputError("S2 segment_goal is too templated")
        if transition == "承接下一段产品/情绪推进":
            raise ShortDramaInvalidModelOutputError("S2 transition_to_next is too templated")
        if product_name and stage and title == f"{stage}：{product_name}":
            raise ShortDramaInvalidModelOutputError("S2 segment_title is too templated")


def _validate_segment_plan_row(
    *,
    idx: int,
    item: SegmentPlanItemSchema,
    sid: str,
    project_id: Any,
    is_brand_seeding: bool,
) -> None:
    row_label = str(getattr(item, "segment_id", None) or "").strip() or f"row_{idx + 1}"
    if not str(getattr(item, "segment_id", None) or "").strip():
        logger.warning(
            "[AI_BLUEPRINT_VALIDATE_FAILED] project_id=%s segment_id=%s missing_field=%s",
            project_id,
            row_label,
            "segment_id",
        )
        raise ShortDramaInvalidModelOutputError(
            f"S2 segment row {idx + 1} missing segment_id; regenerate S2.",
            segment_id=None,
            code="ai_blueprint_validate_failed",
            missing_fields=["segment_id"],
        )

    title = str(item.segment_title or item.title or item.stage_name or "").strip()
    if not title:
        logger.warning(
            "[AI_BLUEPRINT_VALIDATE_FAILED] project_id=%s segment_id=%s missing_field=%s",
            project_id,
            sid,
            "segment_title",
        )
        raise ShortDramaInvalidModelOutputError(
            f"S2 segment {sid} missing segment_title/title/stage_name; regenerate S2.",
            segment_id=sid,
            code="ai_blueprint_validate_failed",
            missing_fields=["segment_title"],
        )
    goal = str(item.segment_goal or item.goal or item.key_message or "").strip()
    if not goal:
        logger.warning(
            "[AI_BLUEPRINT_VALIDATE_FAILED] project_id=%s segment_id=%s missing_field=%s",
            project_id,
            sid,
            "segment_goal",
        )
        raise ShortDramaInvalidModelOutputError(
            f"S2 segment {sid} missing segment_goal/goal/key_message; regenerate S2.",
            segment_id=sid,
            code="ai_blueprint_validate_failed",
            missing_fields=["segment_goal"],
        )
    narrative = str(item.summary or item.story_beat or "").strip()
    if not narrative:
        logger.warning(
            "[AI_BLUEPRINT_VALIDATE_FAILED] project_id=%s segment_id=%s missing_field=%s",
            project_id,
            sid,
            "summary",
        )
        raise ShortDramaInvalidModelOutputError(
            f"S2 segment {sid} missing summary/story_beat; regenerate S2.",
            segment_id=sid,
            code="ai_blueprint_validate_failed",
            missing_fields=["summary"],
        )
    raw_duration = float(item.duration_seconds or item.duration_sec or 0.0)
    if raw_duration <= 0:
        logger.warning(
            "[AI_BLUEPRINT_VALIDATE_FAILED] project_id=%s segment_id=%s missing_field=%s",
            project_id,
            sid,
            "duration_seconds",
        )
        raise ShortDramaInvalidModelOutputError(
            f"S2 segment {sid} missing positive duration_seconds/duration_sec; regenerate S2.",
            segment_id=sid,
            code="ai_blueprint_validate_failed",
            missing_fields=["duration_seconds"],
        )
    asset_lists = [
        *(item.required_assets or []),
        *(item.expected_assets or []),
        *(item.required_visual_elements or []),
    ]
    if not any(str(x or "").strip() for x in asset_lists):
        logger.warning(
            "[AI_BLUEPRINT_VALIDATE_FAILED] project_id=%s segment_id=%s missing_field=%s",
            project_id,
            sid,
            "required_assets",
        )
        raise ShortDramaInvalidModelOutputError(
            f"S2 segment {sid} missing required_assets/expected_assets/required_visual_elements; regenerate S2.",
            segment_id=sid,
            code="ai_blueprint_validate_failed",
            missing_fields=["required_assets"],
        )
    if is_brand_seeding:
        beat_text = str(item.stage_name or item.story_beat or item.summary or "").strip()
        _warn_brand_seeding_risk_terms(project_id=project_id, field="summary", text=narrative)
        _warn_brand_seeding_risk_terms(project_id=project_id, field="goal", text=goal)
        _warn_brand_seeding_risk_terms(project_id=project_id, field="story_beat", text=beat_text)


def _normalize_blueprint_v2_for_execution(
    blueprint: StoryBlueprintSchema,
    product: ProductContextSchema,
    project_config: Dict[str, Any],
) -> StoryBlueprintSchema:
    """creative_blueprint_v2: engineering validation + segment timing; preserve Grok creative fields verbatim."""
    pid = project_config.get("project_id")

    def _value_type(v: Any) -> str:
        if v is None:
            return "null"
        if isinstance(v, dict):
            return "dict"
        if isinstance(v, list):
            return "list"
        if isinstance(v, str):
            return "str"
        return type(v).__name__

    for fp in (
        "story_framework",
        "market_visual_constraints",
        "visual_style_constraints",
        "story_structure",
        "marketing_strategy",
        "spoken_strategy",
        "asset_requirements",
        "scene_goals",
        "product_selling_point_mapping",
        "visual_requirements",
        "must_show_elements",
        "must_avoid_elements",
        "dialogue_tone",
        "target_user_expression",
    ):
        logger.warning(
            "[S2_V2_NORMALIZE_CREATIVE_FIELD_PRESERVED] %s",
            json.dumps(
                {
                    "project_id": pid,
                    "field_path": fp,
                    "value_type": _value_type(getattr(blueprint, fp, None)),
                    "reason": "creative_blueprint_v2_preserve_ai_output",
                },
                ensure_ascii=False,
                default=str,
            ),
        )

    explicit_creative_context = isinstance(project_config.get("creative_brief_data"), dict)
    creative_brief_data = (
        project_config.get("creative_brief_data")
        if explicit_creative_context
        else build_creative_brief(project_config, product)
    )
    project_constraints = creative_brief_data.get("project_constraints") if isinstance(creative_brief_data.get("project_constraints"), dict) else {}
    total = float(project_constraints.get("duration_sec") or _duration_budget_seconds(project_config.get("duration")))

    plan = list(blueprint.segment_plan or [])
    if not plan:
        raise ShortDramaInvalidModelOutputError("S2 segment_plan is empty")

    workflow_language = str((project_config.get("workflow_language") or "zh-CN")).strip() or "zh-CN"
    legacy_marketing_goal = str((project_config.get("marketing_goal") or "brand_seeding")).strip() or "brand_seeding"
    marketing_goal = legacy_marketing_goal
    is_brand_seeding = marketing_goal == "brand_seeding"
    target_market = str((project_config.get("target_market") or project_constraints.get("target_market") or "North America")).strip() or "North America"

    script_type = str(blueprint.script_structure_type or "").strip()
    script_type_display = str(blueprint.script_type_display or "").strip()
    structure_reason_for_user = str(blueprint.structure_reason_for_user or blueprint.structure_reason or "").strip()

    if not script_type or not script_type_display or not structure_reason_for_user:
        logger.warning(
            "[AI_BLUEPRINT_VALIDATE_FAILED] project_id=%s missing_field=%s",
            pid,
            "script_type_or_display_or_reason",
        )
        if explicit_creative_context:
            raise ShortDramaInvalidModelOutputError(
                "S2 provider must output script_structure_type, script_type_display, and structure_reason_for_user.",
                code="ai_blueprint_validate_failed",
                missing_fields=["script_structure_type"],
            )
        raise ShortDramaInvalidModelOutputError(
            "S2 must output script_structure_type, script_type_display, and structure_reason_for_user; regenerate S2.",
            code="ai_blueprint_validate_failed",
            missing_fields=["script_type_display"],
        )

    _validate_executable_shot_plan(blueprint.shot_plan, segment_plan_len=len(plan), project_id=pid)

    next_plan: list[SegmentPlanItemSchema] = []
    for idx, item in enumerate(plan):
        raw_sid = str(item.segment_id or "").strip()
        if not raw_sid:
            logger.warning(
                "[AI_BLUEPRINT_VALIDATE_FAILED] project_id=%s segment_id=%s missing_field=%s",
                pid,
                f"row_{idx + 1}",
                "segment_id",
            )
            raise ShortDramaInvalidModelOutputError(
                f"S2 segment row {idx + 1} missing segment_id; regenerate S2.",
                segment_id=None,
                code="ai_blueprint_validate_failed",
                missing_fields=["segment_id"],
            )
        sid = raw_sid
        _validate_segment_plan_row(
            idx=idx,
            item=item,
            sid=sid,
            project_id=pid,
            is_brand_seeding=is_brand_seeding,
        )
        raw_duration = float(item.duration_seconds or item.duration_sec or 0.0)
        if raw_duration > PROVIDER_MAX_VIDEO_DURATION_SECONDS:
            raise _duration_exceeded_error(
                project_id=pid,
                segment_id=sid,
                duration_seconds=raw_duration,
                field="duration_seconds",
            )
        normalized_duration = raw_duration
        next_plan.append(
            item.model_copy(
                update={
                    "segment_id": sid,
                    "duration_seconds": normalized_duration,
                    "duration_sec": normalized_duration,
                }
            )
        )

    seg_ids = [x.segment_id for x in next_plan]
    if len(seg_ids) != len(set(seg_ids)):
        logger.warning(
            "[AI_BLUEPRINT_VALIDATE_FAILED] project_id=%s missing_field=%s",
            pid,
            "segment_id_uniqueness",
        )
        raise ShortDramaInvalidModelOutputError(
            "S2 segment_id values must be unique; regenerate S2.",
            code="ai_blueprint_validate_failed",
            missing_fields=["segment_id"],
        )

    requested_segment_count = len(plan)
    actual_total_duration = round(sum(float(x.duration_seconds or 0.0) for x in next_plan), 1)
    max_segment_duration = round(max((float(x.duration_seconds or 0.0) for x in next_plan), default=0.0), 1)
    desired_segment_count = _segment_count_for_project(total, project_config, product)
    logger.info(
        "[S2_SEGMENT_DURATION_SUMMARY] project_id=%s target_total_duration=%s actual_total_duration=%s segment_count=%s max_segment_duration=%s requested_segment_count=%s desired_segment_count=%s",
        project_config.get("project_id"),
        round(total, 1),
        actual_total_duration,
        len(next_plan),
        max_segment_duration,
        requested_segment_count,
        desired_segment_count,
    )
    if total > 0 and actual_total_duration < (0.8 * total):
        logger.warning(
            "[S2_SEGMENT_DURATION_UNDER_TARGET] project_id=%s target_total_duration=%s actual_total_duration=%s segment_count=%s max_segment_duration=%s",
            project_config.get("project_id"),
            round(total, 1),
            actual_total_duration,
            len(next_plan),
            max_segment_duration,
        )

    lp_in: Dict[str, str] = dict(blueprint.language_policy) if isinstance(blueprint.language_policy, dict) else {}
    video_language = str(
        (project_config.get("video_language") or lp_in.get("video_language") or lp_in.get("workflow_language") or workflow_language)
    ).strip() or workflow_language
    language_policy = {
        "workflow_language": str(lp_in.get("workflow_language") or workflow_language).strip() or workflow_language,
        "video_language": video_language,
        "target_market": str(lp_in.get("target_market") or target_market).strip() or target_market,
    }

    brand_tone = str((project_config.get("brand_tone") or "natural")).strip() or "natural"
    creative_brief = str((project_config.get("creative_brief") or "")).strip()
    hook_text = str(blueprint.hook or "")
    conflict_text = str(blueprint.core_conflict or "")
    twist_text = str(blueprint.twist or "")
    resolution_text = str(blueprint.resolution or "")
    if is_brand_seeding:
        _warn_brand_seeding_risk_terms(project_id=pid, field="hook", text=hook_text)
        _warn_brand_seeding_risk_terms(project_id=pid, field="core_conflict", text=conflict_text)
        _warn_brand_seeding_risk_terms(project_id=pid, field="twist", text=twist_text)
        _warn_brand_seeding_risk_terms(project_id=pid, field="resolution", text=resolution_text)

    meta_out = dict(blueprint.meta or {})
    if pid is not None:
        meta_out.setdefault("project_id", pid)
    # normalize_execution is diagnostic-only; S3/S4 must not treat it as creative input.
    meta_out.setdefault("schema_version", CREATIVE_BLUEPRINT_V2_SCHEMA)
    nest_prev = meta_out.get("normalize_execution") if isinstance(meta_out.get("normalize_execution"), dict) else {}
    nest = dict(nest_prev)
    nest.update(
        {
            "marketing_goal": marketing_goal,
            "target_audience": blueprint.target_audience,
            "brand_tone": brand_tone,
            "creative_brief": creative_brief,
            "story_style": _normalize_story_style(project_config.get("style")),
            "diagnostic_dimensions": _diagnostic_dimensions(script_type),
        }
    )
    meta_out["normalize_execution"] = nest

    upd: Dict[str, Any] = {
        "blueprint_schema_version": CREATIVE_BLUEPRINT_V2_SCHEMA,
        "segment_plan": next_plan,
        "language_policy": language_policy,
        "meta": meta_out,
    }
    return blueprint.model_copy(update=upd)


def _normalize_blueprint_for_execution(
    blueprint: StoryBlueprintSchema,
    product: ProductContextSchema,
    project_config: Dict[str, Any],
) -> StoryBlueprintSchema:
    ver = str(getattr(blueprint, "blueprint_schema_version", None) or "").strip()
    if ver == CREATIVE_BLUEPRINT_V2_SCHEMA:
        normalized = _normalize_blueprint_v2_for_execution(blueprint, product, project_config)
        _validate_creative_blueprint_v2(normalized, project_id=project_config.get("project_id"))
        return normalized
    logger.warning(
        "[S2_LEGACY_NORMALIZE_PATH] %s",
        json.dumps(
            {
                "project_id": project_config.get("project_id"),
                "incoming_blueprint_schema_version": ver or None,
            },
            ensure_ascii=False,
            default=str,
        ),
    )
    return _normalize_blueprint_legacy_for_execution(blueprint, product, project_config)


def _normalize_blueprint_legacy_for_execution(
    blueprint: StoryBlueprintSchema,
    product: ProductContextSchema,
    project_config: Dict[str, Any],
) -> StoryBlueprintSchema:
    """legacy-only: pre-v2 blueprints; rewrites segment_plan and injects market/style constraints — never for creative_blueprint_v2."""
    explicit_creative_context = isinstance(project_config.get("creative_brief_data"), dict)
    creative_brief_data = (
        project_config.get("creative_brief_data")
        if explicit_creative_context
        else build_creative_brief(project_config, product)
    )
    project_constraints = creative_brief_data.get("project_constraints") if isinstance(creative_brief_data.get("project_constraints"), dict) else {}
    model_structure = blueprint.story_framework if isinstance(blueprint.story_framework, dict) else {}
    legacy_marketing_goal = str((project_config.get("marketing_goal") or "brand_seeding")).strip() or "brand_seeding"
    stages = [str(x).strip() for x in (model_structure.get("structure") or []) if str(x).strip()]
    if not stages:
        stages = [
            str(x.segment_title or x.title or x.stage_name or x.story_beat or "").strip()
            for x in (blueprint.segment_plan or [])
        ]
    stages = [x for x in stages if x]
    if not stages:
        logger.warning(
            "[AI_BLUEPRINT_VALIDATE_FAILED] project_id=%s missing_field=%s",
            project_config.get("project_id"),
            "story_framework.structure",
        )
        raise ShortDramaInvalidModelOutputError(
            "S2 must provide story_framework.structure or segment titles on segment_plan; regenerate S2.",
            code="ai_blueprint_validate_failed",
            missing_fields=["story_framework.structure"],
        )
    stage_names = stages
    total = float(project_constraints.get("duration_sec") or _duration_budget_seconds(project_config.get("duration")))
    requested_segment_count = len(blueprint.segment_plan or [])
    desired_segment_count = 0
    segment_count = max(requested_segment_count, len(stages), 1)
    segment_count = max(1, min(8, segment_count))
    plan = list(blueprint.segment_plan or [])
    workflow_language = str((project_config.get("workflow_language") or "zh-CN")).strip() or "zh-CN"
    marketing_goal = legacy_marketing_goal
    creative_brief = str((project_config.get("creative_brief") or "")).strip()
    target_market = str((project_config.get("target_market") or project_constraints.get("target_market") or "North America")).strip() or "North America"
    story_style = _normalize_story_style(project_config.get("style"))
    script_type = str(blueprint.script_structure_type or model_structure.get("type") or "").strip()
    script_type_display = str(blueprint.script_type_display or model_structure.get("name") or "").strip()
    structure_type_display = str(blueprint.structure_type_display or model_structure.get("display") or " → ".join(stage_names)).strip()
    structure_reason_for_user = str(
        blueprint.structure_reason_for_user or blueprint.structure_reason or model_structure.get("reason") or ""
    ).strip()
    if not script_type or not script_type_display or not structure_reason_for_user:
        logger.warning(
            "[AI_BLUEPRINT_VALIDATE_FAILED] project_id=%s missing_field=%s",
            project_config.get("project_id"),
            "script_type_or_display_or_reason",
        )
        if explicit_creative_context:
            raise ShortDramaInvalidModelOutputError(
                "S2 provider must output script_structure_type, script_type_display, and structure_reason_for_user.",
                code="ai_blueprint_validate_failed",
                missing_fields=["script_structure_type"],
            )
        raise ShortDramaInvalidModelOutputError(
            "S2 must output script_structure_type, script_type_display, and structure_reason_for_user; regenerate S2.",
            code="ai_blueprint_validate_failed",
            missing_fields=["script_type_display"],
        )
    framework = {
        "type": script_type,
        "marketing_goal": marketing_goal,
        "name": script_type_display,
        "structure": stages,
        "reason": structure_reason_for_user,
        "segment_names": stage_names,
    }
    if len(plan) != segment_count and explicit_creative_context:
        logger.warning(
            "[AI_CHAIN_TRACE][S2_SEGMENT_STRUCTURE_LENGTH_MISMATCH] %s",
            json.dumps(
                {
                    "project_id": project_config.get("project_id"),
                    "segment_plan_len": len(plan),
                    "computed_segment_count": segment_count,
                    "requested_segment_count": requested_segment_count,
                    "story_framework_structure_len": len(stages),
                    "desired_segment_count": desired_segment_count,
                    "action": "keep_ai_segment_plan",
                },
                ensure_ascii=False,
                default=str,
            ),
        )
    if not plan:
        raise ShortDramaInvalidModelOutputError("S2 segment_plan is empty")
    is_brand_seeding = marketing_goal == "brand_seeding"
    pid = project_config.get("project_id")
    _validate_executable_shot_plan(blueprint.shot_plan, segment_plan_len=len(plan), project_id=pid)
    shot_plan = dict(blueprint.shot_plan or {}) if isinstance(blueprint.shot_plan, dict) else {}

    next_plan: list[SegmentPlanItemSchema] = []
    mapping: dict[str, str] = (
        dict(blueprint.product_selling_point_mapping)
        if isinstance(blueprint.product_selling_point_mapping, dict)
        else {}
    )
    for idx, item in enumerate(plan):
        sid = f"seg_{idx + 1}"
        _validate_segment_plan_row(
            idx=idx,
            item=item,
            sid=sid,
            project_id=pid,
            is_brand_seeding=is_brand_seeding,
        )
        story_beat = str(
            item.stage_name or item.story_beat or item.segment_title or item.title or item.summary or ""
        ).strip()
        summary = str(item.summary or item.story_beat or "").strip()
        goal = str(item.segment_goal or item.goal or item.key_message or "").strip()
        selling_point = str(item.source_selling_point or mapping.get(sid, "")).strip()
        raw_duration = float(item.duration_seconds or item.duration_sec or 0.0)
        normalized_duration = raw_duration
        if normalized_duration > PROVIDER_MAX_VIDEO_DURATION_SECONDS:
            raise _duration_exceeded_error(
                project_id=pid,
                segment_id=sid,
                duration_seconds=raw_duration,
                field="duration_seconds",
            )
        req_visual = list(dict.fromkeys([x for x in (item.required_visual_elements or []) if str(x or "").strip()]))
        req_assets = list(item.required_assets or [])
        exp_assets = list(item.expected_assets or [])
        next_plan.append(
            item.model_copy(
                update={
                    "segment_id": sid,
                    "stage_name": story_beat,
                    "title": str(item.title or item.segment_title or item.stage_name or "").strip(),
                    "segment_title": str(item.segment_title or item.title or item.stage_name or "").strip(),
                    "segment_goal": goal,
                    "duration_seconds": normalized_duration,
                    "duration_sec": normalized_duration,
                    "story_beat": story_beat,
                    "segment_role": str(item.segment_role or "").strip(),
                    "goal": goal,
                    "summary": summary,
                    "emotional_state": str(item.emotional_state or "").strip(),
                    "product_exposure": str(item.product_exposure or item.product_exposure_mode or "").strip(),
                    "source_selling_point": selling_point,
                    "key_message": str(item.key_message or "").strip(),
                    "product_feature_to_show": str(item.product_feature_to_show or "").strip(),
                    "target_user_trigger": str(item.target_user_trigger or "").strip(),
                    "required_visual_elements": req_visual,
                    "expected_assets": exp_assets,
                    "required_assets": req_assets,
                    "transition_to_next": str(item.transition_to_next or "").strip(),
                }
            )
        )
        mapping[sid] = selling_point
    seg_ids = [x.segment_id for x in next_plan]
    if len(seg_ids) != len(set(seg_ids)):
        logger.warning(
            "[AI_BLUEPRINT_VALIDATE_FAILED] project_id=%s missing_field=%s",
            pid,
            "segment_id_uniqueness",
        )
        raise ShortDramaInvalidModelOutputError(
            "S2 segment_id values must be unique after normalization; regenerate S2.",
            code="ai_blueprint_validate_failed",
            missing_fields=["segment_id"],
        )
    actual_total_duration = round(sum(float(x.duration_seconds or 0.0) for x in next_plan), 1)
    max_segment_duration = round(max((float(x.duration_seconds or 0.0) for x in next_plan), default=0.0), 1)
    logger.info(
        "[S2_SEGMENT_DURATION_SUMMARY] project_id=%s target_total_duration=%s actual_total_duration=%s segment_count=%s max_segment_duration=%s requested_segment_count=%s desired_segment_count=%s",
        project_config.get("project_id"),
        round(total, 1),
        actual_total_duration,
        len(next_plan),
        max_segment_duration,
        requested_segment_count,
        desired_segment_count,
    )
    if total > 0 and actual_total_duration < (0.8 * total):
        logger.warning(
            "[S2_SEGMENT_DURATION_UNDER_TARGET] project_id=%s target_total_duration=%s actual_total_duration=%s segment_count=%s max_segment_duration=%s",
            project_config.get("project_id"),
            round(total, 1),
            actual_total_duration,
            len(next_plan),
            max_segment_duration,
        )
    if not next_plan:
        raise ShortDramaInvalidModelOutputError("S2 segment_plan has no executable segment")
    aspect_ratio = str(project_config.get("aspect_ratio") or "").strip()
    scene_goals_out: Any = (
        dict(blueprint.scene_goals) if isinstance(blueprint.scene_goals, dict) else blueprint.scene_goals
    )
    visual_lines = _visual_requirements_as_str_list(blueprint.visual_requirements)
    if aspect_ratio and not explicit_creative_context:
        visual_lines = [*visual_lines, f"composition aspect ratio {aspect_ratio}"]
    visual_requirements_out: Any = [x for x in visual_lines if x]
    video_language = str((project_config.get("video_language") or workflow_language)).strip() or workflow_language
    target_audience = str((project_config.get("target_audience") or blueprint.target_audience or "")).strip()
    audience_for_market = target_audience
    market_visual = (
        creative_brief_data.get("market_context")
        if isinstance(creative_brief_data.get("market_context"), dict)
        else _market_visual_constraints(target_market, audience_for_market)
    )
    style_visual = (
        creative_brief_data.get("visual_constraints")
        if isinstance(creative_brief_data.get("visual_constraints"), dict)
        else _visual_style_constraints(project_config.get("visual_style"), target_market)
    )
    language_policy = {
        "workflow_language": workflow_language,
        "video_language": video_language,
        "target_market": target_market,
    }
    brand_tone = str((project_config.get("brand_tone") or "natural")).strip() or "natural"
    ms_raw = blueprint.marketing_strategy
    marketing_strategy_out: Any = dict(ms_raw) if isinstance(ms_raw, dict) else ms_raw

    hook_text = str(blueprint.hook or "")
    conflict_text = str(blueprint.core_conflict or "")
    twist_text = str(blueprint.twist or "")
    resolution_text = str(blueprint.resolution or "")
    if is_brand_seeding:
        _warn_brand_seeding_risk_terms(project_id=pid, field="hook", text=hook_text)
        _warn_brand_seeding_risk_terms(project_id=pid, field="core_conflict", text=conflict_text)
        _warn_brand_seeding_risk_terms(project_id=pid, field="twist", text=twist_text)
        _warn_brand_seeding_risk_terms(project_id=pid, field="resolution", text=resolution_text)

    ss_raw = blueprint.story_structure
    if isinstance(ss_raw, dict):
        story_structure_out: Any = dict(ss_raw)
        emotional_arc = story_structure_out.get("emotional_arc") or blueprint.meta.get("emotional_curve") or []
        story_structure_out.update(
            {
                "title": blueprint.title,
                "premise": blueprint.premise,
                "hook": hook_text,
                "conflict": conflict_text,
                "twist": twist_text,
                "resolution": resolution_text,
                "emotional_arc": emotional_arc,
            }
        )
    else:
        story_structure_out = ss_raw

    sf_src = blueprint.story_framework if isinstance(blueprint.story_framework, dict) else {}
    story_framework = {
        "type": framework["type"],
        "marketing_goal": framework["marketing_goal"],
        "name": sf_src.get("name") or framework["name"],
        "structure": sf_src.get("structure") or framework["structure"],
        "reason": sf_src.get("reason") or framework["reason"],
        "display": structure_type_display,
    }

    if isinstance(blueprint.asset_requirements, dict):
        asset_requirements_out: Any = _asset_requirements_with_market_constraints(
            dict(blueprint.asset_requirements),
            product,
            framework,
            project_config,
            language_policy,
            target_audience,
            brand_tone,
            creative_brief,
        )
    else:
        asset_requirements_out = blueprint.asset_requirements

    shot_plan_segments = shot_plan.get("segments") if isinstance(shot_plan.get("segments"), list) else []
    _log_framework_alignment(project_config, story_framework, shot_plan_segments)
    sp_raw = blueprint.spoken_strategy
    spoken_strategy_out: Any = dict(sp_raw) if isinstance(sp_raw, dict) else sp_raw
    normalized = blueprint.model_copy(
        update={
            "format": blueprint.format or str(project_config.get("format") or ""),
            "style": story_style,
            "script_title": blueprint.script_title or blueprint.title,
            "title": blueprint.title or blueprint.script_title,
            "target_audience": target_audience,
            "core_pain": str(blueprint.core_pain or ""),
            "emotional_trigger": str(blueprint.emotional_trigger or ""),
            "product_promise": str(blueprint.product_promise or ""),
            "conversion_goal": str(blueprint.conversion_goal or ""),
            "script_structure_type": framework["type"],
            "script_type_display": script_type_display,
            "structure_type_display": structure_type_display,
            "structure_reason": structure_reason_for_user,
            "structure_reason_for_user": structure_reason_for_user,
            "segment_plan": next_plan,
            "scene_goals": scene_goals_out,
            "product_selling_point_mapping": mapping,
            "target_user_expression": str(blueprint.target_user_expression or "").strip(),
            "visual_requirements": visual_requirements_out,
            "must_show_elements": list(dict.fromkeys([x for x in blueprint.must_show_elements if str(x or "").strip()])),
            "must_avoid_elements": list(dict.fromkeys([x for x in blueprint.must_avoid_elements if str(x or "").strip()])),
            "language_policy": language_policy,
            "marketing_strategy": marketing_strategy_out,
            "story_structure": story_structure_out,
            "hook": hook_text,
            "core_conflict": conflict_text,
            "twist": twist_text,
            "resolution": resolution_text,
            "story_framework": story_framework,
            "asset_requirements": asset_requirements_out,
            "shot_plan": shot_plan,
            "spoken_strategy": spoken_strategy_out,
            "creative_brief": creative_brief_data,
            "market_visual_constraints": market_visual,
            "visual_style_constraints": style_visual,
            "meta": {
                **(blueprint.meta or {}),
                "marketing_goal": marketing_goal,
                "target_audience": target_audience,
                "brand_tone": brand_tone,
                "creative_brief": creative_brief,
                "story_style": story_style,
                "priority_order": [
                    "marketing_goal",
                    "story_style",
                    "visual_style",
                    "target_market/target_audience",
                    "creative_brief",
                ],
                "diagnostic_dimensions": _diagnostic_dimensions(framework["type"]),
            },
        }
    )
    return normalized


def _build_story_planner_service() -> StoryPlannerService:
    if settings.SHORT_DRAMA_USE_MOCK_TEXT_PROVIDER:
        return StoryPlannerService(MockStoryPlannerProvider())
    return StoryPlannerService(XAIStoryPlannerProvider(get_xai_text_provider()))


story_planner_service = _build_story_planner_service()
