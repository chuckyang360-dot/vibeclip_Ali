from __future__ import annotations

import re
from typing import Any

from ..schemas.product import ProductContextSchema
from .language import infer_video_language


def _text(value: Any) -> str:
    return str(value or "").strip()


def _list(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(x).strip() for x in value if str(x or "").strip()]
    if isinstance(value, str) and value.strip():
        return [x.strip() for x in re.split(r"[；;、,\n]", value) if x.strip()]
    return []


_CONSTRAINT_MARKERS = ("不要", "禁止", "不可", "不能", "不得", "避免", "保持")


def _is_constraint_text(text: str) -> bool:
    value = _text(text)
    return any(marker in value for marker in _CONSTRAINT_MARKERS)


def _user_pain_points(product: ProductContextSchema) -> list[str]:
    candidates = [
        *getattr(product, "user_pain_points", []),
    ]
    pains = [x for x in candidates if x and not _is_constraint_text(x)]
    return list(dict.fromkeys(pains))[:4]


def _immutable_constraints(project_config: dict[str, Any], product: ProductContextSchema) -> list[str]:
    constraints = [
        *_list(project_config.get("immutable_structure_constraints")),
        *getattr(product, "immutable_structure_constraints", []),
        *product.consistency_notes,
        *[x for x in product.visual_risk_notes if _is_constraint_text(x)],
    ]
    return list(dict.fromkeys([x for x in constraints if x]))


def duration_seconds(raw: Any) -> int:
    m = re.search(r"\d+", _text(raw))
    return int(m.group(0)) if m else 45


def normalize_content_form(raw: Any) -> str:
    value = _text(raw).lower()
    aliases = {
        "single_ad": "single_ad",
        "single": "single_ad",
        "series": "series_short_video",
        "series_short_video": "series_short_video",
        "ugc_review": "ugc_review",
        "review": "ugc_review",
        "product_showcase": "product_showcase",
        "showcase": "product_showcase",
    }
    return aliases.get(value, "single_ad")


def normalize_narrative_style(raw: Any) -> str:
    value = _text(raw).lower()
    aliases = {
        "conflict": "light_conflict",
        "light_conflict": "light_conflict",
        "healing": "healing",
        "comedy": "light_comedy",
        "light_comedy": "light_comedy",
        "suspense": "suspense_twist",
        "suspense_twist": "suspense_twist",
        "emotional": "emotional_resonance",
        "emotional_resonance": "emotional_resonance",
    }
    return aliases.get(value, "light_conflict")


def normalize_visual_style(raw: Any) -> str:
    value = _text(raw).lower()
    if value in {"animation", "anime", "动画风格", "动画"}:
        return "animation"
    if value in {"three_d_render", "3d_render", "3d", "三维渲染", "3d渲染"}:
        return "three_d_render"
    if value in {"premium_ad", "高级广告", "premium"}:
        return "premium_ad"
    return "realistic_cinematic"


def segment_count_for_duration(duration_sec: int) -> int:
    if duration_sec <= 35:
        return 4
    if duration_sec <= 50:
        return 5
    return 6


CONTENT_FORM_MATRIX = {
    "single_ad": ["problem_solution_ad", "aida", "pas", "product_demo_ad", "brand_seeding_ad"],
    "series_short_video": ["episode_arc", "recurring_character_story", "serial_problem_solution"],
    "ugc_review": ["unboxing_review", "usage_review", "comparison_review"],
    "product_showcase": ["feature_demo", "benefit_demo", "scenario_demo"],
}

SCRIPT_TYPE_DISPLAY = {
    "problem_solution_ad": "问题解决型广告",
    "aida": "品牌种草型广告",
    "pas": "痛点解决型广告",
    "product_demo_ad": "产品演示型广告",
    "brand_seeding_ad": "品牌种草型广告",
    "episode_arc": "单集剧情型短视频",
    "recurring_character_story": "固定角色连续短剧",
    "serial_problem_solution": "连续问题解决短剧",
    "unboxing_review": "开箱测评型内容",
    "usage_review": "使用体验型内容",
    "comparison_review": "对比测评型内容",
    "feature_demo": "功能展示型内容",
    "benefit_demo": "利益点展示型内容",
    "scenario_demo": "场景演示型内容",
}

STRUCTURE_MATRIX = {
    "aida": ["注意", "兴趣", "欲望", "行动"],
    "pas": ["问题", "放大", "解决", "行动"],
    "problem_solution_ad": ["生活困扰", "影响放大", "产品介入", "结果证明"],
    "product_demo_ad": ["产品亮相", "功能细节", "使用场景", "购买理由"],
    "brand_seeding_ad": ["生活场景", "轻微困扰", "产品自然出现", "记忆点"],
    "episode_arc": ["人物状态", "本集问题", "产品/主题介入", "情绪推进", "收束钩子"],
    "recurring_character_story": ["固定角色", "日常困扰", "习惯动作", "产品记忆", "下集期待"],
    "serial_problem_solution": ["连续问题", "本集挑战", "解决尝试", "结果反馈", "下一问题"],
    "unboxing_review": ["开箱亮相", "外观细节", "上手体验", "真实评价"],
    "usage_review": ["使用前", "使用过程", "细节体验", "结果反馈"],
    "comparison_review": ["旧方案", "对比点", "产品优势", "选择理由"],
    "feature_demo": ["功能亮相", "结构细节", "操作演示", "结果展示"],
    "benefit_demo": ["用户需求", "核心利益", "场景证明", "购买理由"],
    "scenario_demo": ["真实场景", "使用动作", "结果变化", "记忆点"],
}

EMOTION_MATRIX = {
    "light_conflict": ["小困扰", "好奇", "安心", "满足"],
    "healing": ["平静", "被理解", "被陪伴", "放松"],
    "light_comedy": ["尴尬", "反差", "解决", "轻松"],
    "suspense_twist": ["疑问", "紧张", "反转", "释放"],
    "emotional_resonance": ["压抑", "共鸣", "理解", "行动"],
}

VISUAL_WORLD_MATRIX = {
    "realistic_cinematic": {
        "display": "写实电影感",
        "description": "真人广告片、自然光、真实材质、生活化摄影",
        "asset_style": "真人广告片质感，真实材质，生活化摄影",
        "negative": ["不要动漫风", "不要插画感", "不要过度棚拍感"],
    },
    "animation": {
        "display": "动画风格",
        "description": "非真人、动画角色、干净线条、柔和色彩、商业动画广告质感",
        "asset_style": "商业动画广告质感，非真人摄影，干净线条，柔和色彩",
        "negative": ["不要真人照片风格", "不要写实摄影皮肤", "不要欧美商业模特照片感"],
    },
    "three_d_render": {
        "display": "3D 渲染风格",
        "description": "3D 产品/角色、材质高光、结构清晰",
        "asset_style": "3D 广告渲染质感，材质高光清晰，结构准确",
        "negative": ["不要平面插画感", "不要结构模糊", "不要低质塑料感"],
    },
    "premium_ad": {
        "display": "高级商业广告感",
        "description": "精致布光、慢镜头、高级商业广告质感",
        "asset_style": "高级商业广告质感，精致布光，干净构图",
        "negative": ["不要廉价电商白底感", "不要杂乱背景", "不要过度夸张表演"],
    },
}

MARKET_MATRIX = {
    "Japan": {
        "display": "日本市场",
        "description": "日本都市生活语境，克制表达，通勤/独居/便利性，角色和场景符合日本广告审美",
        "character": "符合日本都市生活广告语境的人物，克制自然，通勤或独居生活状态",
        "scene": "日本都市通勤、居家、咖啡店、街头、便利店等生活场景",
        "negative": ["不要默认欧美商业模特", "不要欧美图库广告场景"],
    },
    "North America": {
        "display": "北美市场",
        "description": "直接表达功能收益，多元角色，开放生活场景",
        "character": "多元化角色，表达直接自然，强调功能收益",
        "scene": "开放式居家、街区、办公室、户外移动生活场景",
        "negative": ["不要单一刻板族群设定", "不要与北美生活语境冲突"],
    },
    "Southeast Asia": {
        "display": "东南亚市场",
        "description": "城市/户外/移动生活，电商促销和实用性表达",
        "character": "东南亚城市年轻用户，移动生活和实用消费语境",
        "scene": "城市街头、户外移动、咖啡店、电商生活场景",
        "negative": ["不要欧美图库场景默认值", "不要脱离热带/移动生活语境"],
    },
}


def _market_key(raw: Any) -> str:
    value = _text(raw)
    lower = value.lower()
    if "japan" in lower or "日本" in value:
        return "Japan"
    if "southeast asia" in lower or "东南亚" in value:
        return "Southeast Asia"
    return "North America"


def _choose_script_type(content_form: str, product: ProductContextSchema) -> str:
    candidates = CONTENT_FORM_MATRIX.get(content_form, CONTENT_FORM_MATRIX["single_ad"])
    category = f"{product.product_category} {product.product_form}".lower()
    if content_form == "single_ad":
        if any(x in category for x in ("case", "壳", "配件", "accessory", "hardware")):
            return "aida"
        return candidates[0]
    return candidates[0]


def _fit_stages(base: list[str], count: int) -> list[str]:
    if count <= len(base):
        return base[:count]
    additions = ["细节证明", "使用反馈", "品牌记忆", "购买理由"]
    out = [*base]
    for item in additions:
        if len(out) >= count:
            break
        if item not in out:
            out.insert(max(1, len(out) - 1), item)
    while len(out) < count:
        out.insert(max(1, len(out) - 1), f"推进{len(out)}")
    return out[:count]


def _exposure_curve(count: int) -> list[str]:
    base = ["轻露出", "明确展示", "场景使用", "强转化"]
    if count <= len(base):
        return base[:count]
    return ["轻露出", "明确展示", *["场景使用"] * (count - 3), "强转化"]


def _asset_requirements(stages: list[str], product: ProductContextSchema) -> list[dict[str, Any]]:
    assets = []
    for idx, stage in enumerate(stages):
        required = ["主角", "核心生活场景"]
        if idx >= 1:
            required.append(product.product_name or "主商品")
        assets.append({"stage_name": stage, "required_assets": required})
    return assets


def _stage_display_reason(script_type_display: str, stages: list[str], product_name: str) -> str:
    flow = " → ".join(stages)
    return (
        f"选择“{script_type_display}”，因为当前内容需要在短时间内完成从注意到兴趣、从场景到购买理由的转化。"
        f"结构节奏为“{flow}”，先让用户进入真实使用情境，再让{product_name or '产品'}自然出现并形成记忆点。"
    )


def legacy_creative_intent_summary(project_config: dict[str, Any]) -> str:
    parts = [
        f"营销目标：{_text(project_config.get('marketing_goal'))}" if _text(project_config.get("marketing_goal")) else "",
        f"目标受众：{_text(project_config.get('target_audience'))}" if _text(project_config.get("target_audience")) else "",
        f"品牌调性：{_text(project_config.get('brand_tone'))}" if _text(project_config.get("brand_tone")) else "",
        f"补充说明：{_text(project_config.get('creative_brief'))}" if _text(project_config.get("creative_brief")) else "",
    ]
    return "；".join([x for x in parts if x])


def build_creative_brief(project_config: dict[str, Any], product: ProductContextSchema) -> dict[str, Any]:
    duration_sec = duration_seconds(project_config.get("duration_sec") or project_config.get("duration"))
    content_form = normalize_content_form(project_config.get("content_form") or project_config.get("format"))
    narrative_style = normalize_narrative_style(project_config.get("narrative_style") or project_config.get("style"))
    visual_style = normalize_visual_style(project_config.get("visual_style"))
    market_key = _market_key(project_config.get("target_market"))
    visual_world = VISUAL_WORLD_MATRIX[visual_style]
    market_context = MARKET_MATRIX[market_key]
    immutable = _immutable_constraints(project_config, product)
    product_visual = product.visual_features or product.consistency_notes
    creative_intent = _text(project_config.get("creative_intent"))
    legacy_intent = legacy_creative_intent_summary(project_config)
    project_settings = {
        "duration_sec": duration_sec,
        "content_form": content_form,
        "narrative_style": narrative_style,
        "visual_style": visual_style,
        "aspect_ratio": _text(project_config.get("aspect_ratio")) or "9:16",
        "target_market": market_key,
        "working_language": _text(project_config.get("working_language") or project_config.get("workflow_language")) or "zh-CN",
    }
    project_settings["video_language"] = _text(project_config.get("video_language")) or infer_video_language(
        project_settings["working_language"],
        market_key,
    )
    product_context = {
        "category": product.product_category,
        "name": product.product_name,
        "summary": product.product_summary,
        "core_selling_points": product.core_selling_points,
        "user_pain_points": _user_pain_points(product),
        "usage_scenarios": product.usage_scenarios,
        "purchase_reasons": product.emotional_value or product.core_selling_points,
        "immutable_structure_constraints": [*immutable, *product.immutable_structure_constraints],
        "product_visual_features": product_visual,
    }
    return {
        "context_type": "creative_context",
        "project_settings": project_settings,
        "creative_intent": creative_intent,
        "legacy_creative_intent_summary": legacy_intent,
        "effective_creative_intent": creative_intent or legacy_intent,
        "product_context": product_context,
        "language_policy": project_config.get("language_policy") or {
            "workflow_language": project_settings["working_language"],
            "video_language": project_settings["video_language"],
            "target_market": market_key,
        },
        "visual_constraints": visual_world,
        "market_context": market_context,
        # Backward-compatible aliases for existing readers. These are context only;
        # S2 is responsible for authoring script_type, stages, emotion, and exposure plans.
        "project_constraints": project_settings,
        "product_facts": product_context,
        "creative_strategy": {
            "market_context": market_context,
            "visual_world": visual_world,
        },
    }


def creative_strategy(brief: dict[str, Any]) -> dict[str, Any]:
    value = brief.get("creative_strategy") if isinstance(brief, dict) else {}
    return value if isinstance(value, dict) else {}

