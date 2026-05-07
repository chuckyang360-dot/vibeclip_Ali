from __future__ import annotations

import logging
import json
import re
from typing import Any, Dict, Protocol

from ...config import settings
from ..exceptions import ShortDramaInvalidModelOutputError
from ..providers.xai_text_provider import XAITextProvider, get_xai_text_provider
from ..schemas.product import ProductContextSchema
from ..schemas.story import SegmentPlanItemSchema, StoryBlueprintSchema
from ..utils.creative_brief import build_creative_brief
from ..utils.prompts import STORY_PLANNER_SYSTEM_PROMPT

logger = logging.getLogger(__name__)


def _trace(tag: str, payload: dict[str, Any]) -> None:
    logger.info("[AI_CHAIN_TRACE][%s] %s", tag, json.dumps(payload, ensure_ascii=False, default=str))


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
_SCRIPT_STRUCTURE_BY_GOAL = {
    "brand_seeding": "scene_pain_solution",
    "pain_point_conversion": "problem_solution_ad",
    "product_demo": "product_demo_ad",
    "trust_building": "aida",
    "comparison": "before_after_bridge",
    "promotion": "aida",
    "corporate_promo": "aida",
    "series_story": "story_drama",
}
_FRAMEWORK_FALLBACK_ZH = {
    "brand_seeding": "品牌种草型",
    "pain_point_conversion": "痛点转化型",
    "product_demo": "产品展示型",
    "trust_building": "信任背书型",
    "comparison": "对比测评型",
    "promotion": "活动促销型",
    "corporate_promo": "企业宣传型",
    "series_story": "系列短剧型",
}
_FRAMEWORK_DEFS = {
    "brand_seeding": {
        "name": "品牌种草型",
        "structure": ["生活场景", "情绪共鸣", "产品自然出现", "氛围强化", "记忆点"],
        "segment_names": ["生活场景", "情绪共鸣", "产品自然出现", "氛围强化", "记忆点收束"],
    },
    "pain_point_conversion": {
        "name": "痛点转化型",
        "structure": ["痛点暴露", "风险放大", "产品介入", "结果证明", "行动号召"],
        "segment_names": ["痛点暴露", "风险放大", "产品介入", "结果证明", "行动号召"],
    },
    "product_demo": {
        "name": "产品展示型",
        "structure": ["产品亮相", "功能细节", "使用场景", "效果展示", "购买理由"],
        "segment_names": ["产品亮相", "功能细节演示", "使用场景", "效果展示", "购买理由"],
    },
    "trust_building": {
        "name": "信任背书型",
        "structure": ["问题背景", "专业能力", "使用证据", "用户信任", "品牌记忆"],
        "segment_names": ["问题背景", "专业能力", "使用证据", "用户信任", "品牌记忆"],
    },
    "comparison": {
        "name": "对比测评型",
        "structure": ["普通方案", "问题暴露", "产品对比", "优势证明", "选择理由"],
        "segment_names": ["普通方案", "问题暴露", "产品对比", "优势证明", "选择理由"],
    },
    "promotion": {
        "name": "活动促销型",
        "structure": ["限时机会", "产品价值", "使用场景", "优惠理由", "CTA"],
        "segment_names": ["限时机会", "产品价值", "使用场景", "优惠理由", "CTA"],
    },
    "corporate_promo": {
        "name": "企业宣传型",
        "structure": ["行业问题", "企业能力", "真实场景", "结果价值", "品牌信任"],
        "segment_names": ["行业问题", "企业能力", "真实场景", "结果价值", "品牌信任"],
    },
    "series_story": {
        "name": "系列短剧型",
        "structure": ["人物设定", "世界观", "本集冲突", "产品/主题植入", "悬念钩子"],
        "segment_names": ["人物设定", "世界观", "本集冲突", "产品/主题植入", "悬念钩子"],
    },
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
_BRAND_SEEDING_REWRITE = {
    "hook": "生活方式切片开场，让产品在目标用户日常中自然入镜。",
    "conflict": "在城市节奏与个人表达之间寻找贴合自我的细节与质感。",
    "twist": "产品在真实使用场景中自然露出并增强整体氛围。",
    "resolution": "以光线与材质记忆点收束，强化品牌印象与轻种草心智。",
}


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
        marketing_goal = str(project_config.get("marketing_goal") or "brand_seeding")
        brief = str(project_config.get("creative_brief") or "").strip()
        conflict_text = f"信任与试错成本（叙事角度：{angle}）"
        if marketing_goal == "pain_point_conversion":
            conflict_text = f"高频痛点反复出现，必须快速验证解决方案（叙事角度：{angle}）"
        elif marketing_goal == "corporate_promo":
            conflict_text = f"品牌认知不足，需要通过企业实力建立信任（叙事角度：{angle}）"
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
                    goal="建立共鸣与悬念",
                    duration_seconds=12.0,
                    story_beat="hook",
                    summary="快节奏生活切片，抛出痛点",
                    product_exposure_mode="none_or_blurred",
                    source_selling_point=points[0] if points else "",
                    product_feature_to_show=(product.visual_features[0] if product.visual_features else ""),
                    target_user_trigger=users,
                    required_visual_elements=product.visual_features[:2],
                ),
                SegmentPlanItemSchema(
                    segment_id="seg_2",
                    goal="引入产品与体验",
                    duration_seconds=15.0,
                    story_beat="build",
                    summary="产品出现与试用，展示核心特征",
                    product_exposure_mode="hero_demo",
                    source_selling_point=points[1] if len(points) > 1 else (points[0] if points else ""),
                    product_feature_to_show=(product.visual_features[1] if len(product.visual_features) > 1 else ""),
                    target_user_trigger=users,
                    required_visual_elements=product.visual_features[:3],
                ),
                SegmentPlanItemSchema(
                    segment_id="seg_3",
                    goal="反转收尾与 CTA",
                    duration_seconds=18.0,
                    story_beat="resolution",
                    summary="结果验证 + 轻 CTA",
                    product_exposure_mode="logo_packshot",
                    source_selling_point=points[2] if len(points) > 2 else (points[-1] if points else ""),
                    product_feature_to_show=(product.visual_features[2] if len(product.visual_features) > 2 else ""),
                    target_user_trigger=users,
                    required_visual_elements=product.visual_features[:2],
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
        )
        return _normalize_blueprint_for_execution(bp, product, project_config)


class XAIStoryPlannerProvider:
    def __init__(self, text_provider: XAITextProvider):
        self._text = text_provider

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
            s2_payload = {
                "project_id": project_id,
                "project_config": project_config,
                "language_policy": project_config.get("language_policy", {}),
                "language_prompt_rules": project_config.get("language_prompt_rules", ""),
                "creative_context": project_config.get("creative_brief_data", {}),
                "creative_intent": project_config.get("effective_creative_intent", ""),
                "product_context": product.model_dump(),
                "s1_context_for_story": {
                    "product_name": product.product_name,
                    "product_summary": product.product_summary,
                    "core_selling_points": product.core_selling_points,
                    "target_users": product.target_users,
                    "usage_scenarios": product.usage_scenarios,
                    "emotional_value": product.emotional_value,
                    "suitable_story_angles": product.suitable_story_angles,
                    "user_pain_points": product.user_pain_points,
                    "immutable_structure_constraints": product.immutable_structure_constraints,
                },
            }
            _trace(
                "S2_INPUT_CONTEXT",
                {
                    "project_id": project_id,
                    "project_config": project_config,
                    "language_policy": project_config.get("language_policy", {}),
                    "creative_context": project_config.get("creative_brief_data", {}),
                    "creative_intent": project_config.get("effective_creative_intent", ""),
                    "product_context": product.model_dump(),
                    "s1_context_for_story": s2_payload.get("s1_context_for_story"),
                },
            )
            logger.info(
                "[S2_PROMPT] %s",
                json.dumps(
                    {
                        "system_prompt": STORY_PLANNER_SYSTEM_PROMPT,
                        "user_payload": s2_payload,
                    },
                    ensure_ascii=False,
                ),
            )
            _trace(
                "S2_PROMPT",
                {
                    "project_id": project_id,
                    "system_prompt": STORY_PLANNER_SYSTEM_PROMPT,
                    "user_payload": s2_payload,
                    "provider": "xai_text_provider",
                    "model": "effective_xai_text_model",
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
            )
            logger.info("[S2_RESPONSE] %s", json.dumps(data, ensure_ascii=False))
            _trace("S2_SCHEMA_VALIDATED", {"project_id": project_id, "schema": data})
            blueprint = StoryBlueprintSchema.model_validate(data)
            before_normalize = blueprint.model_dump()
            _trace("S2_BEFORE_NORMALIZE", {"project_id": project_id, "blueprint": before_normalize})
            blueprint = _normalize_blueprint_for_execution(blueprint, product, project_config)
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
    """S2 segments are story paragraphs, not shots; count follows duration and ad form."""
    form = str(project_config.get("content_form") or project_config.get("format") or "").strip().lower()
    style = str(project_config.get("narrative_style") or project_config.get("style") or "").strip().lower()
    product_type = " ".join([product.product_category, product.product_form]).lower()
    if total <= 35:
        low, high = 3, 5
    elif total <= 50:
        low, high = 5, 7
    else:
        low, high = 6, 8
    count = low
    if form in {"series", "story", "story_drama"} or style in {"suspense", "emotional", "comedy"}:
        count += 1
    if any(token in product_type for token in ("software", "saas", "app", "课程", "服务")):
        count += 1
    if str(project_config.get("marketing_goal") or "") in {"product_demo", "comparison", "corporate_promo"}:
        count += 1
    return max(low, min(high, count))


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


def _sanitize_brand_seeding_text(text: str, fallback: str) -> str:
    candidate = (text or "").strip()
    if not candidate:
        return fallback
    if _contains_terms(candidate, _BRAND_SEEDING_BANNED_TERMS):
        return fallback
    return candidate


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


def _framework_for_goal(marketing_goal: str, workflow_language: str, product: ProductContextSchema, creative_brief: str) -> Dict[str, Any]:
    goal = marketing_goal if marketing_goal in _FRAMEWORK_DEFS else "brand_seeding"
    spec = _FRAMEWORK_DEFS[goal]
    script_type = _SCRIPT_STRUCTURE_BY_GOAL.get(goal, "scene_pain_solution")
    name = spec["name"]
    if workflow_language.startswith("en"):
        name = script_type.replace("_", " ").title()
    reason_zh = f"基于项目营销目标“{_FRAMEWORK_FALLBACK_ZH.get(goal, '品牌种草型')}”、产品语境“{product.product_name}”与时长节奏，选择 {script_type} 结构。"
    reason = reason_zh if workflow_language.startswith("zh") else (
        f"Framework follows {script_type} and product context of {product.product_name}, aligned with creative brief."
    )
    return {
        "type": script_type,
        "marketing_goal": goal,
        "name": name,
        "structure": list(spec["structure"]),
        "reason": reason if creative_brief else reason.replace("与创意说明", "与项目目标"),
        "segment_names": list(spec["segment_names"]),
    }


def _safe_segment_placeholder(stage_name: str) -> dict[str, str]:
    label = stage_name or "段落"
    return {
        "title": f"待补充：{label}",
        "goal": "待补充",
        "summary": "",
        "transition": "待补充",
    }


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


def _normalize_blueprint_for_execution(
    blueprint: StoryBlueprintSchema,
    product: ProductContextSchema,
    project_config: Dict[str, Any],
) -> StoryBlueprintSchema:
    """Fill execution-critical S2 fields so S3 consumes explicit structure, not loose prose."""
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
    if not stages and not explicit_creative_context and legacy_marketing_goal in _FRAMEWORK_DEFS:
        stages = [str(x).strip() for x in _FRAMEWORK_DEFS[legacy_marketing_goal].get("structure", []) if str(x).strip()]
    if not stages:
        stages = [str(x.stage_name or x.story_beat or x.segment_title or f"段落{idx + 1}").strip() for idx, x in enumerate(blueprint.segment_plan or [])]
    stages = [x for x in stages if x]
    if not stages:
        raise ShortDramaInvalidModelOutputError("S2 provider must output story structure or segment_plan")
    stage_names = stages
    total = float(project_constraints.get("duration_sec") or _duration_budget_seconds(project_config.get("duration")))
    requested_segment_count = len(blueprint.segment_plan or [])
    desired_segment_count = _segment_count_for_project(total, project_config, product)
    minimum_provider_safe_count = max(1, int((total + 9.999) // 10))
    segment_count = max(requested_segment_count, len(stages), desired_segment_count, minimum_provider_safe_count)
    segment_count = max(1, min(8, segment_count))
    durations = _segment_durations(total, segment_count)
    points = [p for p in product.core_selling_points if p]
    visual_features = [v for v in product.visual_features if v]
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
    if (not script_type or not script_type_display or not structure_reason_for_user) and explicit_creative_context:
        raise ShortDramaInvalidModelOutputError("S2 provider must output script type and structure reason")
    if not script_type:
        script_type = marketing_goal if not explicit_creative_context else "story_drama"
    if not script_type_display:
        script_type_display = "短视频广告"
    if not structure_reason_for_user:
        structure_reason_for_user = "基于已有剧本字段整理为可执行结构。"
    framework = {
        "type": script_type,
        "marketing_goal": marketing_goal,
        "name": script_type_display,
        "structure": stages,
        "reason": structure_reason_for_user,
        "segment_names": stage_names,
    }
    defaults = tuple(stage_names)
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
                    "minimum_provider_safe_count": minimum_provider_safe_count,
                    "action": "keep_ai_segment_plan",
                },
                ensure_ascii=False,
                default=str,
            ),
        )
    if not plan:
        raise ShortDramaInvalidModelOutputError("S2 segment_plan is empty")
    is_brand_seeding = marketing_goal == "brand_seeding"
    next_plan: list[SegmentPlanItemSchema] = []
    mapping = dict(blueprint.product_selling_point_mapping or {})
    for idx, item in enumerate(plan):
        sid = f"seg_{idx + 1}"
        stage_default = defaults[min(idx, len(defaults) - 1)] if defaults else f"段落{idx + 1}"
        fallback_goal = framework["structure"][min(idx, len(framework["structure"]) - 1)]
        selling_point = (
            item.source_selling_point
            or mapping.get(sid)
            or (points[idx] if idx < len(points) else (points[-1] if points else ""))
        )
        summary = item.summary or ""
        if idx == 0 and blueprint.hook and blueprint.hook not in summary:
            summary = f"{blueprint.hook}；{summary}".strip("；")
        if is_brand_seeding:
            summary = _sanitize_brand_seeding_text(summary, fallback_goal)
        req_visual = list(dict.fromkeys([*item.required_visual_elements, *visual_features[:3]]))
        story_beat = stage_default
        goal = item.segment_goal or item.goal or ""
        if is_brand_seeding:
            story_beat = _sanitize_brand_seeding_text(story_beat, stage_default)
            goal = _sanitize_brand_seeding_text(goal, fallback_goal)
        asset_req = list(item.required_assets or item.expected_assets or [])
        placeholder = _safe_segment_placeholder(story_beat)
        raw_duration = float(item.duration_seconds or item.duration_sec or durations[idx] or 0.0)
        if raw_duration <= 0:
            raw_duration = float(durations[idx] or 6.0)
        normalized_duration = raw_duration
        if normalized_duration > 10.0:
            logger.warning(
                "[S2_SEGMENT_DURATION_CLAMPED] project_id=%s segment_id=%s requested_duration=%s provider_max_duration=%s",
                project_config.get("project_id"),
                sid,
                raw_duration,
                10.0,
            )
            normalized_duration = 10.0
        next_plan.append(
            item.model_copy(
                update={
                    "segment_id": sid,
                    "stage_name": story_beat,
                    "title": item.title or placeholder["title"],
                    "segment_title": item.segment_title or item.title or placeholder["title"],
                    "segment_goal": goal or placeholder["goal"],
                    "duration_seconds": normalized_duration,
                    "duration_sec": normalized_duration,
                    "story_beat": story_beat,
                    "segment_role": item.segment_role or story_beat or fallback_goal,
                    "goal": goal or placeholder["goal"],
                    "summary": summary,
                    "emotional_state": item.emotional_state or "",
                    "product_exposure": item.product_exposure or item.product_exposure_mode or "",
                    "source_selling_point": selling_point,
                    "key_message": item.key_message or selling_point or (points[0] if points else product.product_summary),
                    "product_feature_to_show": item.product_feature_to_show or (visual_features[idx] if idx < len(visual_features) else ""),
                    "target_user_trigger": item.target_user_trigger or "、".join(product.target_users[:2]),
                    "required_visual_elements": req_visual,
                    "expected_assets": item.expected_assets or asset_req or req_visual[:4],
                    "required_assets": item.required_assets or asset_req or req_visual[:4],
                    "transition_to_next": item.transition_to_next or placeholder["transition"],
                }
            )
        )
        mapping[sid] = selling_point
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
    scene_goals = dict(blueprint.scene_goals or {})
    for item in next_plan:
        scene_goals[item.segment_id] = scene_goals.get(item.segment_id) or item.goal or item.summary
    visual_requirements = list(
        dict.fromkeys(
            [
                *blueprint.visual_requirements,
                *visual_features,
                *(product.consistency_notes or []),
                str(project_config.get("visual_style") or "").strip(),
                f"composition aspect ratio {project_config.get('aspect_ratio') or '9:16'}",
            ]
        )
    )
    video_language = str((project_config.get("video_language") or workflow_language)).strip() or workflow_language
    target_audience = str((project_config.get("target_audience") or "")).strip()
    market_visual = creative_brief_data.get("market_context") if isinstance(creative_brief_data.get("market_context"), dict) else _market_visual_constraints(target_market, target_audience or "、".join(product.target_users[:2]))
    style_visual = creative_brief_data.get("visual_constraints") if isinstance(creative_brief_data.get("visual_constraints"), dict) else _visual_style_constraints(project_config.get("visual_style"), target_market)
    language_policy = {
        "workflow_language": workflow_language,
        "video_language": video_language,
        "target_market": target_market,
    }
    brand_tone = str((project_config.get("brand_tone") or "natural")).strip() or "natural"
    marketing_strategy = dict(blueprint.marketing_strategy or {})
    marketing_strategy.setdefault("target_audience", target_audience or "、".join(product.target_users[:2]))
    marketing_strategy.setdefault(
        "core_pain_point",
        blueprint.core_pain or (blueprint.core_conflict or "").strip(),
    )
    marketing_strategy.setdefault("emotional_trigger", blueprint.emotional_trigger or "")
    marketing_strategy.setdefault("product_promise", blueprint.product_promise or "")
    marketing_strategy.setdefault("conversion_goal", blueprint.conversion_goal or "")
    marketing_strategy.setdefault("cta", "")

    story_structure = dict(blueprint.story_structure or {})
    emotional_arc = story_structure.get("emotional_arc") or blueprint.meta.get("emotional_curve") or []
    hook_text = blueprint.hook
    conflict_text = blueprint.core_conflict
    twist_text = blueprint.twist
    resolution_text = blueprint.resolution
    if is_brand_seeding:
        hook_text = _sanitize_brand_seeding_text(hook_text, _BRAND_SEEDING_REWRITE["hook"])
        conflict_text = _sanitize_brand_seeding_text(conflict_text, _BRAND_SEEDING_REWRITE["conflict"])
        twist_text = _sanitize_brand_seeding_text(twist_text, _BRAND_SEEDING_REWRITE["twist"])
        resolution_text = _sanitize_brand_seeding_text(resolution_text, _BRAND_SEEDING_REWRITE["resolution"])
    story_structure.update(
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
    story_framework = {
        "type": framework["type"],
        "marketing_goal": framework["marketing_goal"],
        "name": (blueprint.story_framework or {}).get("name") or framework["name"],
        "structure": (blueprint.story_framework or {}).get("structure") or framework["structure"],
        "reason": (blueprint.story_framework or {}).get("reason")
        or framework["reason"],
        "display": structure_type_display,
    }

    asset_requirements = _asset_requirements_with_market_constraints(
        dict(blueprint.asset_requirements or {}),
        product,
        framework,
        project_config,
        language_policy,
        target_audience,
        brand_tone,
        creative_brief,
    )
    shot_plan = dict(blueprint.shot_plan or {})
    fw_structure = story_framework.get("structure") or framework["structure"]
    shot_segments: list[Dict[str, Any]] = []
    for idx, item in enumerate(next_plan):
        sid = item.segment_id
        raw_steps = [fw_structure[min(idx, len(fw_structure) - 1)]]
        if idx == len(next_plan) - 1 and len(fw_structure) >= 2:
            raw_steps.append(fw_structure[-1])
        function_text = " → ".join(dict.fromkeys([s for s in raw_steps if s]))
        goal_text = item.goal or item.summary
        action_text = item.summary or goal_text
        if is_brand_seeding:
            function_text = _sanitize_brand_seeding_text(function_text, item.story_beat or stage_default)
            goal_text = _sanitize_brand_seeding_text(goal_text, framework["structure"][min(idx, len(framework["structure"]) - 1)])
            action_text = _sanitize_brand_seeding_text(action_text, goal_text)
        shot_segments.append(
            {
                "id": sid,
                "name": item.story_beat or stage_default,
                "function": function_text,
                "goal": goal_text,
                "action": action_text,
                "duration": item.duration_seconds,
                "segment_role": item.segment_role,
                "product_exposure": item.product_exposure or item.product_exposure_mode,
                "expected_assets": item.expected_assets,
                "transition_to_next": item.transition_to_next,
                "market_visual_constraints": market_visual,
                "visual_style_constraints": style_visual,
                "creative_brief": creative_brief_data,
                "shots": [],
            }
        )
    shot_plan["segments"] = shot_segments
    _log_framework_alignment(project_config, story_framework, shot_segments)
    spoken_strategy = dict(blueprint.spoken_strategy or {})
    spoken_strategy.setdefault("default_dialogue_mode", "spoken")
    spoken_strategy.setdefault("subtitle_allowed", True)
    spoken_strategy.setdefault("voiceover_allowed", True)
    spoken_strategy.setdefault("dialogue_language", video_language)
    return blueprint.model_copy(
        update={
            "format": blueprint.format or str(project_config.get("format") or ""),
            "style": story_style,
            "script_title": blueprint.script_title or blueprint.title,
            "title": blueprint.title or blueprint.script_title,
            "target_audience": target_audience or "、".join(product.target_users[:2]),
            "core_pain": str(marketing_strategy.get("core_pain_point") or ""),
            "emotional_trigger": str(marketing_strategy.get("emotional_trigger") or ""),
            "product_promise": str(marketing_strategy.get("product_promise") or ""),
            "conversion_goal": str(marketing_strategy.get("conversion_goal") or ""),
            "script_structure_type": framework["type"],
            "script_type_display": script_type_display,
            "structure_type_display": structure_type_display,
            "structure_reason": structure_reason_for_user,
            "structure_reason_for_user": structure_reason_for_user,
            "segment_plan": next_plan,
            "scene_goals": scene_goals,
            "product_selling_point_mapping": mapping,
            "target_user_expression": blueprint.target_user_expression or "、".join(product.target_users[:3]),
            "visual_requirements": [x for x in visual_requirements if x],
            "must_show_elements": list(dict.fromkeys([*blueprint.must_show_elements, product.product_name, *points])),
            "must_avoid_elements": list(dict.fromkeys([*blueprint.must_avoid_elements, *product.visual_risk_notes])),
            "language_policy": language_policy,
            "marketing_strategy": marketing_strategy,
            "story_structure": story_structure,
            "hook": hook_text,
            "core_conflict": conflict_text,
            "twist": twist_text,
            "resolution": resolution_text,
            "story_framework": story_framework,
            "asset_requirements": asset_requirements,
            "shot_plan": shot_plan,
            "spoken_strategy": spoken_strategy,
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


def _build_story_planner_service() -> StoryPlannerService:
    if settings.SHORT_DRAMA_USE_MOCK_TEXT_PROVIDER:
        return StoryPlannerService(MockStoryPlannerProvider())
    return StoryPlannerService(XAIStoryPlannerProvider(get_xai_text_provider()))


story_planner_service = _build_story_planner_service()
