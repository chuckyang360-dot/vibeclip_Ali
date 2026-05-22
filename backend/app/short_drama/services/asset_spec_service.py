from __future__ import annotations

import hashlib
import logging
import json
import re
from typing import Any, Dict, Protocol

from ...config import settings
from ..exceptions import ShortDramaInvalidModelOutputError
from ..providers.xai_text_provider import XAITextProvider, get_xai_text_provider
from ..schemas.asset import AssetSpecsBundleSchema, CharacterAssetSchema, ProductAssetSchema, SceneAssetSchema
from ..schemas.product import ProductContextSchema
from ..schemas.story import StoryBlueprintSchema
from ..utils.ai_runtime_config import (
    STAGE_S3_ASSET_MANAGEMENT,
    apply_runtime_user_prompt_template,
    get_ai_runtime_config,
)
from ..utils.prompts import ASSET_SPEC_SYSTEM_PROMPT

logger = logging.getLogger(__name__)


def _reject_if_creative_blueprint_v2(blueprint: StoryBlueprintSchema, *, message: str, code: str) -> None:
    """Hard guard: S3 v2 must only use asset_generation_specs / build_v2_asset_specs_bundle."""
    from .asset_v2_materialize_service import is_creative_blueprint_v2_project

    if is_creative_blueprint_v2_project(blueprint):
        raise ShortDramaInvalidModelOutputError(
            message,
            code=code,
            missing_fields=["asset_generation_specs"],
        )


def _trace(tag: str, payload: dict[str, Any]) -> None:
    logger.info("[AI_CHAIN_TRACE][%s] %s", tag, json.dumps(payload, ensure_ascii=False, default=str))

_PLOT_STATE_TERMS = (
    "struggle",
    "conflict",
    "flashback",
    "energized",
    "workout",
    "failure",
    "comeback",
    "angry",
    "moment",
    "training",
    "using",
    "drinking",
    "fighting",
    "crying",
    "celebrating",
    "挣扎",
    "冲突",
    "闪回",
    "回忆",
    "训练",
    "使用",
    "喝",
    "愤怒",
    "失败",
    "逆袭",
    "情绪",
)

_LOCATION_RULES: tuple[tuple[str, str, str], ...] = (
    ("home gym", "家庭健身房", "Home Gym"),
    ("gym", "家庭健身房", "Home Gym"),
    ("office desk", "办公桌区域", "Office Desk"),
    ("office", "办公室", "Office"),
    ("kitchen", "厨房", "Kitchen"),
    ("park", "公园", "Outdoor Park"),
    ("bedroom", "卧室", "Bedroom"),
    ("living room", "客厅", "Living Room"),
    ("suburban kitchen", "郊区厨房", "Suburban Kitchen"),
    ("健身房", "家庭健身房", "Home Gym"),
    ("办公室", "办公室", "Office"),
    ("厨房", "厨房", "Kitchen"),
    ("公园", "公园", "Outdoor Park"),
    ("卧室", "卧室", "Bedroom"),
    ("客厅", "客厅", "Living Room"),
)

_PRODUCT_SCENE_TERMS = (
    "in gym",
    "in kitchen",
    "in office",
    "gym scene",
    "kitchen scene",
    "office scene",
    "advertising scene",
    "story scene",
    "with person",
    "with human",
    "being used",
    "使用场景",
    "健身房剧情",
    "厨房广告",
    "人物使用",
)

_MULTI_LOCATION_SPLIT_PATTERN = r"(?:\s+and\s+|\s+with\s+|/|、|，|,|和|与|及)"
_COMMUTE_LOCATION_CANDIDATES = (
    "地铁站台",
    "城市通勤街头",
    "通勤路上",
    "metro station",
    "subway platform",
    "urban commute street",
)

_CHARACTER_SINGLE_PERSON_REQUIRED = [
    "one single person only",
    "one character reference image",
    "single subject centered",
    "full body or half body portrait",
    "no multiple people",
    "no group photo",
    "no collage",
    "no grid",
    "no contact sheet",
    "no lineup",
    "no moodboard",
    "no character sheet with multiple variants",
]

_CHARACTER_GROUP_AMBIGUOUS_TERMS = (
    "diverse",
    "multiple ethnicities",
    "group",
    "diverse group",
    "多元族裔",
)


def _market_is_china(value: str | None) -> bool:
    v = str(value or "").strip().lower()
    return "china" in v or "中国" in v


def _market_is_japan(value: str | None) -> bool:
    v = str(value or "").strip().lower()
    return "japan" in v or "日本" in v


def _extract_market_constraints(
    blueprint: StoryBlueprintSchema,
    project_config: Dict[str, Any] | None,
    product: ProductContextSchema,
) -> Dict[str, Any]:
    req = blueprint.asset_requirements if isinstance(blueprint.asset_requirements, dict) else {}
    brief = blueprint.creative_brief if isinstance(blueprint.creative_brief, dict) else {}
    strategy = brief.get("creative_strategy") if isinstance(brief.get("creative_strategy"), dict) else {}
    project_constraints = brief.get("project_constraints") if isinstance(brief.get("project_constraints"), dict) else {}
    market_context = strategy.get("market_context") if isinstance(strategy.get("market_context"), dict) else {}
    visual_world = strategy.get("visual_world") if isinstance(strategy.get("visual_world"), dict) else {}
    market = req.get("market_constraints") if isinstance(req.get("market_constraints"), dict) else {}
    target_market = str(
        project_constraints.get("target_market")
        or market.get("target_market")
        or (project_config or {}).get("target_market")
        or ((blueprint.language_policy or {}).get("target_market"))
        or "North America"
    ).strip()
    target_audience = str(
        market.get("target_audience")
        or (project_config or {}).get("target_audience")
        or "、".join(product.target_users[:2])
        or "泛用户"
    ).strip()
    return {
        "target_market": target_market,
        "target_audience": target_audience,
        "constraints": market.get("constraints") if isinstance(market.get("constraints"), list) else [],
        "market_visual_constraints": market_context or (req.get("market_visual_constraints") if isinstance(req.get("market_visual_constraints"), dict) else {}),
        "visual_style_constraints": visual_world or (req.get("visual_style_constraints") if isinstance(req.get("visual_style_constraints"), dict) else (blueprint.visual_style_constraints or {})),
        "creative_brief_data": brief,
        "marketing_goal": str((project_config or {}).get("marketing_goal") or (blueprint.story_framework or {}).get("type") or "").strip(),
        "story_framework_type": str((blueprint.story_framework or {}).get("type") or "").strip(),
        "creative_brief": str((project_config or {}).get("creative_brief") or "").strip(),
    }


def _apply_market_constraints_to_bundle(
    bundle: AssetSpecsBundleSchema,
    constraints: Dict[str, Any],
) -> AssetSpecsBundleSchema:
    target_market = str(constraints.get("target_market") or "").strip()
    target_audience = str(constraints.get("target_audience") or "").strip()
    market_lower = target_market.lower()
    is_china = _market_is_china(target_market)
    is_japan = _market_is_japan(target_market)
    is_sea = ("southeast asia" in market_lower) or ("东南亚" in target_market)
    market_visual = constraints.get("market_visual_constraints") if isinstance(constraints.get("market_visual_constraints"), dict) else {}
    style_visual = constraints.get("visual_style_constraints") if isinstance(constraints.get("visual_style_constraints"), dict) else {}
    style_desc = str(style_visual.get("description") or style_visual.get("asset_style") or style_visual.get("image_texture") or "").strip()
    style_negative = [str(x).strip() for x in (style_visual.get("negative") or style_visual.get("negative_constraints") or []) if str(x).strip()] if isinstance(style_visual, dict) else []
    market_desc = str(market_visual.get("description") or market_visual.get("character") or "").strip()
    market_negative = [str(x).strip() for x in (market_visual.get("negative") or market_visual.get("negative_constraints") or []) if str(x).strip()] if isinstance(market_visual, dict) else []
    characters: list[CharacterAssetSchema] = []
    for row in bundle.characters:
        extra_constraints: list[str] = []
        market_phrase = ""
        if is_japan:
            extra_constraints = [
                "日本都市青年 / 日本上班族 / 日本独居青年 / 东亚面孔",
                "适合日本市场广告语境",
                "服装、妆发、气质符合日本生活广告审美",
                "不要欧美商业模特外观",
                "不要欧美企业图库照片感",
            ]
            market_phrase = "日本都市青年或东亚面孔，日本生活广告审美"
        elif is_china:
            extra_constraints = [
                "中国或东亚都市青年",
                "适合中国市场语境",
                "不要欧美模特外观",
                "不要欧美企业图库照片感",
            ]
            market_phrase = "中国或东亚都市青年"
        elif is_sea:
            extra_constraints = [
                "东南亚城市青年",
                "适合东南亚市场语境",
                "不要欧美企业模特外观",
                "不要欧美图库照片感",
                "城市通勤休闲风格",
            ]
            market_phrase = "东南亚城市青年"
        elif "north america" in market_lower:
            extra_constraints = [
                "适合北美市场语境",
                "避免单一刻板族群设定",
            ]
            market_phrase = "适合北美市场语境"
        prompt = _resolve_asset_image_prompt(row.image_prompt, row.visual_prompt, row.description)
        meta = dict(row.meta or {})
        meta["market_constraint"] = {
            "target_market": target_market,
            "target_audience": target_audience,
            "character_constraints": extra_constraints,
        }
        characters.append(
            row.model_copy(
                update={
                    "description": _clean_ws(row.description or ""),
                    "business_profile": {
                        "role_position": row.role_type,
                        "market_context": market_visual,
                        "target_audience": target_audience,
                        "story_function": row.narrative_function or row.purpose,
                    },
                    "image_prompt": prompt or row.image_prompt,
                    "visual_prompt": prompt,
                    "technical_constraints": {
                        "style": style_visual,
                        "market": market_visual,
                        "negative_constraints": [*extra_constraints, *style_negative, *market_negative],
                    },
                    "meta": {
                        **meta,
                        "market_context": {
                            "target_market": target_market,
                            "target_audience": target_audience,
                        },
                        "market_visual_constraints": market_visual,
                        "visual_style_constraints": style_visual,
                    },
                }
            )
        )
    scenes: list[SceneAssetSchema] = []
    for row in bundle.scenes:
        primary_location = _first_location_token(
            str((row.meta or {}).get("location_identity") or (row.meta or {}).get("location") or row.scene_form or row.name)
        )
        scene_constraints: list[str] = []
        if is_japan:
            scene_constraints = [
                "日本城市生活广告语境",
                "东京/大阪通勤、小户型公寓、便利店、咖啡店、办公室",
                "不要欧美图库场景默认值",
            ]
            prompt = _resolve_asset_image_prompt(row.image_prompt, row.visual_prompt, row.description)
        elif is_china:
            scene_constraints = [
                "中国城市通勤语境",
                "地铁、办公室、咖啡店等本地生活场景",
                "不要欧美图库场景默认值",
            ]
            prompt = _resolve_asset_image_prompt(row.image_prompt, row.visual_prompt, row.description)
        elif is_sea:
            scene_constraints = [
                "东南亚城市通勤语境",
                "地铁站、街头、咖啡桌、办公桌",
                "不要空白房间或通用棚拍场景",
            ]
            prompt = _resolve_asset_image_prompt(row.image_prompt, row.visual_prompt, row.description)
        else:
            prompt = _resolve_asset_image_prompt(row.image_prompt, row.visual_prompt, row.description)
        meta = dict(row.meta or {})
        meta["market_constraint"] = {
            "target_market": target_market,
            "scene_constraints": scene_constraints,
        }
        scenes.append(
            row.model_copy(
                update={
                    "description": _clean_ws(row.description or ""),
                    "business_profile": {
                        "scene_position": row.scene_type,
                        "market_context": market_visual,
                        "location_type": row.scene_form,
                    },
                    "image_prompt": prompt or row.image_prompt,
                    "visual_prompt": prompt,
                    "technical_constraints": {
                        "style": style_visual,
                        "market": market_visual,
                        "disallowed_actions": ["不要写人物剧情动作", "不要写产品使用动作"],
                    },
                    "meta": {
                        **meta,
                        "market_context": {
                            "target_market": target_market,
                            "target_audience": target_audience,
                        },
                        "market_visual_constraints": market_visual,
                        "visual_style_constraints": style_visual,
                    },
                }
            )
        )
    products: list[ProductAssetSchema] = []
    for row in bundle.products:
        meta = dict(row.meta or {})
        immutable = list(dict.fromkeys([*(row.immutable_structure_constraints or []), *(_list_like(meta.get("immutable_structure_constraints"))), *(_list_like(meta.get("must_keep")))]))
        meta["market_constraint"] = {
            "target_market": target_market,
            "product_constraints": (
                ["保持日本市场品牌语境", "避免无关欧美广告默认值"]
                if is_japan
                else ["保持中国市场品牌语境", "避免默认海外广告话术"]
                if is_china
                else (
                    ["保持东南亚市场品牌语境", "避免误读为无关配件"]
                    if is_sea
                    else []
                )
            ),
        }
        products.append(
            row.model_copy(
                update={
                    "description": _clean_ws(row.description or ""),
                    "business_profile": {
                        "product_position": row.product_role,
                        "market_context": market_visual,
                    },
                    "image_prompt": _resolve_asset_image_prompt(row.image_prompt, row.visual_prompt, row.description),
                    "visual_prompt": _resolve_asset_image_prompt(row.image_prompt, row.visual_prompt, row.description),
                    "technical_constraints": {
                        "style": style_visual,
                        "market": market_visual,
                        "immutable_structure_constraints": immutable,
                        "negative_constraints": [*style_negative, *market_negative],
                    },
                    "immutable_structure_constraints": immutable,
                    "meta": {
                        **meta,
                        "market_context": {
                            "target_market": target_market,
                            "target_audience": target_audience,
                        },
                        "market_visual_constraints": market_visual,
                        "visual_style_constraints": style_visual,
                    },
                }
            )
        )
    return AssetSpecsBundleSchema(characters=characters, scenes=scenes, products=products)


def _clean_ws(text: str | None) -> str:
    return re.sub(r"\s+", " ", str(text or "")).strip(" ,;:，；：")


def _resolve_asset_image_prompt(*values: str | None) -> str:
    for value in values:
        text = _clean_ws(value)
        if text:
            return text
    return ""


def _list_like(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(x).strip() for x in value if str(x or "").strip()]
    if isinstance(value, str) and value.strip():
        return [x.strip() for x in re.split(r"[；;、,\n]", value) if x.strip()]
    return []


def _style_text(style_visual: Dict[str, Any]) -> str:
    return _clean_ws(
        str(
            style_visual.get("asset_style")
            or style_visual.get("description")
            or style_visual.get("image_texture")
            or style_visual.get("style_name")
            or ""
        )
    )


def _is_animation_style(style_visual: Dict[str, Any], project_config: Dict[str, Any] | None = None) -> bool:
    corpus = " ".join(
        [
            str((project_config or {}).get("visual_style") or ""),
            str(style_visual.get("display") or ""),
            str(style_visual.get("style_name") or ""),
            str(style_visual.get("description") or ""),
            str(style_visual.get("asset_style") or ""),
            str(style_visual.get("image_texture") or ""),
        ]
    ).lower()
    return any(token in corpus for token in ("animation", "anime", "动画"))


def _market_prompt_terms(market_visual: Dict[str, Any], target_market: str) -> list[str]:
    terms = [
        str(market_visual.get("description") or "").strip(),
        str(market_visual.get("character") or "").strip(),
        str(market_visual.get("scene") or "").strip(),
    ]
    if _market_is_japan(target_market):
        terms.extend(["日本都市生活语境", "日本广告审美", "通勤/独居/便利性等本地化生活细节"])
    return list(dict.fromkeys([x for x in terms if x]))


def _user_facing_constraints(items: list[str]) -> list[str]:
    blocked_prefixes = ("scene identity normalized", "removed plot/action term", "removed product scene/usage term")
    cleaned: list[str] = []
    for item in items:
        text = str(item or "").strip()
        if not text or any(text.lower().startswith(prefix) for prefix in blocked_prefixes):
            continue
        text = text.replace("stock photo", "图库").replace("stock", "图库")
        cleaned.append(text)
    return list(dict.fromkeys(cleaned))


def _character_prompt_blueprint(
    *,
    row: CharacterAssetSchema,
    target_market: str,
    target_audience: str,
    style_terms: str,
    animation_terms: list[str],
    market_terms: list[str],
    negative: list[str],
) -> str:
    prompt = row.visual_prompt or row.description or ""
    low_prompt = prompt.lower()
    if any(token in low_prompt for token in _CHARACTER_GROUP_AMBIGUOUS_TERMS):
        prompt = re.sub(r"\bdiverse group\b", "single character with natural urban appearance", prompt, flags=re.IGNORECASE)
        prompt = re.sub(r"\bdiverse\b", "single character with natural urban appearance", prompt, flags=re.IGNORECASE)
        prompt = re.sub(r"\bgroup\b", "single character with natural urban appearance", prompt, flags=re.IGNORECASE)
        prompt = re.sub(r"\bmultiple ethnicities\b", "single character with natural urban appearance", prompt, flags=re.IGNORECASE)
        prompt = prompt.replace("多元族裔", "单一人物，具有自然真实的都市年轻人特征")
    details = [
        prompt,
        "市场语境：" + "；".join(market_terms) if market_terms else "",
        f"视觉风格约束：{style_terms}" if style_terms else "",
        "禁止项：" + "、".join(list(dict.fromkeys(negative))) if negative else "",
    ]
    combined = _clean_ws("。".join([x for x in details if x]))
    missing = [rule for rule in _CHARACTER_SINGLE_PERSON_REQUIRED if rule.lower() not in combined.lower()]
    if missing:
        combined = _clean_ws(f"{combined}。{'；'.join(missing)}")
    return combined


def _scene_prompt_blueprint(
    *,
    row: SceneAssetSchema,
    target_market: str,
    style_terms: str,
    market_terms: list[str],
    negative: list[str],
) -> str:
    prompt = row.visual_prompt or row.description or ""
    details = [
        prompt,
        f"视觉风格约束：{style_terms}" if style_terms else "",
        "市场语境：" + "；".join(market_terms) if market_terms else "",
        "禁止项：" + "、".join(list(dict.fromkeys([*negative, "禁止人物剧情动作进入场景资产"]))) if negative else "",
    ]
    return _clean_ws("。".join([x for x in details if x]))


def _product_prompt_blueprint(
    *,
    row: ProductAssetSchema,
    product: ProductContextSchema | None,
    style_terms: str,
    immutable: list[str],
    negative: list[str],
) -> str:
    name = row.name or (product.product_name if product else "主商品")
    features = product.visual_features if product else []
    details = [
        row.visual_prompt or row.description or f"产品：{name}",
        f"产品视觉特征：{'；'.join(features)}" if features else "",
        f"视觉风格约束：{style_terms}" if style_terms else "",
        f"不可改变结构：{'；'.join(immutable)}",
        "禁止项：" + "、".join(list(dict.fromkeys([*negative, *immutable]))) if negative or immutable else "",
    ]
    return _clean_ws("。".join([x for x in details if x]))


def _finalize_assets_with_creative_brief(
    bundle: AssetSpecsBundleSchema,
    constraints: Dict[str, Any],
    product: ProductContextSchema | None,
    project_config: Dict[str, Any] | None,
) -> AssetSpecsBundleSchema:
    market_visual = constraints.get("market_visual_constraints") if isinstance(constraints.get("market_visual_constraints"), dict) else {}
    style_visual = constraints.get("visual_style_constraints") if isinstance(constraints.get("visual_style_constraints"), dict) else {}
    target_market = str(constraints.get("target_market") or (project_config or {}).get("target_market") or "").strip()
    style_terms = _style_text(style_visual)
    animation_terms = [
        "非真人",
        "动画角色",
        "商业动画广告质感",
        "干净线条",
        "柔和色彩",
        "不要真人照片风格",
    ] if _is_animation_style(style_visual, project_config) else []
    market_terms = _market_prompt_terms(market_visual, target_market)
    product_name = product.product_name if product else ""
    product_visual = product.visual_features if product else []
    product_form = product.product_form if product else ""
    risk_notes = product.visual_risk_notes if product else []
    target_audience = str(constraints.get("target_audience") or (project_config or {}).get("target_audience") or "").strip()

    characters = []
    for row in bundle.characters:
        negative = _user_facing_constraints([*row.boundary_warnings, *animation_terms, *market_terms])
        prompt = _resolve_asset_image_prompt(row.image_prompt, row.visual_prompt, row.description)
        characters.append(
            row.model_copy(
                update={
                    "business_profile": row.business_profile
                    or {
                        "role_position": row.role_type,
                        "market_context": market_visual,
                        "relationship_to_product": "使用者",
                        "story_function": row.narrative_function or row.purpose or "",
                    },
                    "image_prompt": prompt or row.image_prompt,
                    "visual_prompt": prompt,
                    "technical_constraints": {
                        **(row.technical_constraints or {}),
                        "visual_style": style_visual,
                        "market_context": market_visual,
                        "negative_constraints": negative,
                    },
                    "meta": {
                        **(row.meta or {}),
                        "business_profile": row.business_profile,
                        "technical_constraints": {
                            **(row.technical_constraints or {}),
                            "visual_style": style_visual,
                            "market_context": market_visual,
                            "negative_constraints": negative,
                        },
                    },
                }
            )
        )

    scenes = []
    for row in bundle.scenes:
        negative = _user_facing_constraints([*row.boundary_warnings, *market_terms])
        scene_name = row.name
        prompt = _resolve_asset_image_prompt(row.image_prompt, row.visual_prompt, row.description)
        scenes.append(
            row.model_copy(
                update={
                    "name": scene_name,
                    "scene_form": scene_name,
                    "business_profile": row.business_profile
                    or {
                        "scene_position": row.scene_type,
                        "market_context": market_visual,
                        "location_type": scene_name,
                    },
                    "image_prompt": prompt or row.image_prompt,
                    "visual_prompt": prompt,
                    "technical_constraints": {
                        **(row.technical_constraints or {}),
                        "visual_style": style_visual,
                        "market_context": market_visual,
                        "disallowed_actions": ["不要写人物剧情动作", "不要写产品使用动作"],
                    },
                    "meta": {
                        **(row.meta or {}),
                        "business_profile": row.business_profile,
                        "technical_constraints": {
                            **(row.technical_constraints or {}),
                            "visual_style": style_visual,
                            "market_context": market_visual,
                            "disallowed_actions": ["不要写人物剧情动作", "不要写产品使用动作"],
                        },
                    },
                }
            )
        )

    products = []
    for row in bundle.products:
        immutable = list(
            dict.fromkeys(
                [
                    *(row.immutable_structure_constraints or []),
                    *_list_like((row.meta or {}).get("immutable_structure_constraints")),
                    *_list_like((row.meta or {}).get("must_keep")),
                    *_immutable_structure_constraints(row.name or product_name, product_form, product_visual, risk_notes),
                ]
            )
        )
        prompt = _resolve_asset_image_prompt(row.image_prompt, row.visual_prompt, row.description)
        products.append(
            row.model_copy(
                update={
                    "business_profile": row.business_profile
                    or {
                        "product_position": row.product_role or "主商品",
                        "market_context": market_visual,
                        "category": product.product_category if product else "",
                    },
                    "image_prompt": prompt or row.image_prompt,
                    "visual_prompt": prompt,
                    "technical_constraints": {
                        **(row.technical_constraints or {}),
                        "visual_style": style_visual,
                        "market_context": market_visual,
                        "immutable_structure_constraints": immutable,
                    },
                    "immutable_structure_constraints": immutable,
                    "meta": {
                        **(row.meta or {}),
                        "business_profile": row.business_profile,
                        "technical_constraints": {
                            **(row.technical_constraints or {}),
                            "visual_style": style_visual,
                            "market_context": market_visual,
                            "immutable_structure_constraints": immutable,
                        },
                        "immutable_structure_constraints": immutable,
                    },
                }
            )
        )
    return AssetSpecsBundleSchema(characters=characters, scenes=scenes, products=products)


def _strip_plot_terms(text: str | None) -> tuple[str, list[str]]:
    raw = _clean_ws(text)
    warnings: list[str] = []
    out = raw
    for term in _PLOT_STATE_TERMS:
        if re.search(rf"\b{re.escape(term)}\b", out, flags=re.IGNORECASE) or term in out:
            warnings.append(f"removed plot/action term: {term}")
            out = re.sub(rf"\b{re.escape(term)}\b", " ", out, flags=re.IGNORECASE)
            out = out.replace(term, " ")
    out = _clean_ws(out)
    return out, list(dict.fromkeys(warnings))


def _strip_product_scene_terms(text: str | None) -> tuple[str, list[str]]:
    out, warnings = _strip_plot_terms(text)
    for term in _PRODUCT_SCENE_TERMS:
        if term.lower() in out.lower():
            warnings.append(f"removed product scene/usage term: {term}")
            out = re.sub(re.escape(term), " ", out, flags=re.IGNORECASE)
    return _clean_ws(out), list(dict.fromkeys(warnings))


def _language_prefers_chinese(workflow_language: str | None) -> bool:
    return str(workflow_language or "").lower().startswith("zh")


def _scene_identity(
    name: str | None,
    description: str | None,
    visual_prompt: str | None,
    workflow_language: str | None,
) -> tuple[str, list[str]]:
    corpus = f"{name or ''} {description or ''} {visual_prompt or ''}".lower()
    warnings: list[str] = []
    prefers_zh = _language_prefers_chinese(workflow_language)
    for needle, zh_label, en_label in _LOCATION_RULES:
        if needle in corpus:
            label = zh_label if prefers_zh else en_label
            if _clean_ws(name) != label:
                warnings.append(f"scene identity normalized to reusable location: {label}")
            return label, warnings
    cleaned, term_warnings = _strip_plot_terms(name)
    warnings.extend(term_warnings)
    if not cleaned:
        cleaned = "Scene Location"
        warnings.append("scene name had no stable location after removing plot terms")
    return cleaned, warnings


def _asset_prompt_prefix(kind: str) -> str:
    if kind == "character":
        return "干净的人物设定参考图，纯白或透明背景，全身或半身，不包含剧情动作，不与产品互动"
    if kind == "scene":
        return "可复用的空场景背景参考图，无主角，无剧情动作，稳定且适合镜头使用的空间设定"
    return "仅产品本体参考图，干净棚拍质感，简单白底或透明背景，无人物，无剧情场景"


class AssetSpecProvider(Protocol):
    def build_specs(
        self,
        project_id: int,
        product: ProductContextSchema,
        blueprint: StoryBlueprintSchema,
        project_config: Dict[str, Any] | None = None,
    ) -> AssetSpecsBundleSchema: ...


class MockAssetSpecProvider:
    def build_specs(
        self,
        project_id: int,
        product: ProductContextSchema,
        blueprint: StoryBlueprintSchema,
        project_config: Dict[str, Any] | None = None,
    ) -> AssetSpecsBundleSchema:
        pname = product.product_name
        feat = (
            product.core_selling_points[0]
            if product.core_selling_points
            else (product.key_functions[0] if product.key_functions else "核心卖点占位")
        )
        visual_hint = "、".join(product.visual_features[:3]) if product.visual_features else "标准外观"
        consistency_hint = "；".join(product.consistency_notes[:2]) if product.consistency_notes else "保持主体一致"
        visual_style = (project_config or {}).get("visual_style") or "cinematic"
        aspect_ratio = (project_config or {}).get("aspect_ratio") or "9:16"
        bundle = AssetSpecsBundleSchema(
            characters=[
                CharacterAssetSchema(
                    name="林晓",
                    role_type="main",
                    description="年轻上班族，注重效率与形象",
                    image_prompt=f"mock: 亚洲女性，25岁，休闲职场穿搭，自然光，{visual_style}，{aspect_ratio}",
                    visual_prompt=f"mock: 亚洲女性，25岁，休闲职场穿搭，自然光，{visual_style}，{aspect_ratio}",
                    image_url=None,
                    source_asset_version="mock-v1",
                    exposure_priority="primary",
                    narrative_function="hook",
                    purpose="hero",
                    meta={"provider": "mock"},
                ),
                CharacterAssetSchema(
                    name="店员阿杰",
                    role_type="supporting",
                    description="友善配角，推动试用",
                    image_prompt=f"mock: 亚洲男性店员，微笑，简洁背景，{visual_style}，{aspect_ratio}",
                    visual_prompt=f"mock: 亚洲男性店员，微笑，简洁背景，{visual_style}，{aspect_ratio}",
                    image_url=None,
                    source_asset_version="mock-v1",
                    exposure_priority="secondary",
                    narrative_function="conflict",
                    purpose="support",
                    meta={"provider": "mock"},
                ),
            ],
            scenes=[
                SceneAssetSchema(
                    name="地铁口清晨",
                    scene_type="hook",
                    scene_form="exterior",
                    description="人流、晨光、快节奏",
                    image_prompt=f"mock: 城市街景，浅景深，清新色调，{visual_style}，{aspect_ratio}",
                    visual_prompt=f"mock: 城市街景，浅景深，清新色调，{visual_style}，{aspect_ratio}",
                    image_url=None,
                    source_asset_version="mock-v1",
                    exposure_priority="secondary",
                    narrative_function="hook",
                    purpose="narrative",
                    meta={"provider": "mock", "segment_id": "seg_1"},
                ),
                SceneAssetSchema(
                    name="便利店陈列区",
                    scene_type="conflict",
                    scene_form="interior",
                    description="货架、手持镜头感",
                    image_prompt=f"mock: 暖色室内光，货架层次清晰，{visual_style}，{aspect_ratio}",
                    visual_prompt=f"mock: 暖色室内光，货架层次清晰，{visual_style}，{aspect_ratio}",
                    image_url=None,
                    source_asset_version="mock-v1",
                    exposure_priority="secondary",
                    narrative_function="conflict",
                    purpose="narrative",
                    meta={"provider": "mock", "segment_id": "seg_2"},
                ),
            ],
            products=[
                ProductAssetSchema(
                    name=pname,
                    product_role="hero",
                    description=feat,
                    image_prompt=(
                        f"mock: 产品 hero shot，{pname}，{visual_hint}，{consistency_hint}，"
                        f"MUST: {visual_hint}；DO NOT: {'；'.join(product.visual_risk_notes[:3])}，"
                        f"{visual_style}，{aspect_ratio}"
                    ),
                    visual_prompt=(
                        f"mock: 产品 hero shot，{pname}，{visual_hint}，{consistency_hint}，"
                        f"MUST: {visual_hint}；DO NOT: {'；'.join(product.visual_risk_notes[:3])}，"
                        f"{visual_style}，{aspect_ratio}"
                    ),
                    image_url=None,
                    source_asset_version="mock-v1",
                    exposure_priority="primary",
                    narrative_function="resolution",
                    purpose="hero",
                    meta={"provider": "mock", "premise": blueprint.premise},
                )
            ],
        )
        constraints = _extract_market_constraints(blueprint, project_config, product)
        normalized = _normalize_asset_bundle(
            bundle,
            workflow_language=(project_config or {}).get("workflow_language"),
            product_name=product.product_name,
            product=product,
            project_id=project_id,
            project_config=project_config,
        )
        return _apply_market_constraints_to_bundle(normalized, constraints)


class XAIAssetSpecProvider:
    def __init__(self, text_provider: XAITextProvider):
        self._text = text_provider

    def build_specs(
        self,
        project_id: int,
        product: ProductContextSchema,
        blueprint: StoryBlueprintSchema,
        project_config: Dict[str, Any] | None = None,
    ) -> AssetSpecsBundleSchema:
        logger.info(
            "ASSET_SPEC_GENERATION_STARTED %s",
            {"project_id": project_id, "stage": "ASSET_SPEC_GENERATION", "provider": "xai"},
        )
        try:
            prompt_payload = {
                "project_id": project_id,
                "product_context": product.model_dump(),
                "s1_context_for_assets": {
                    "visual_features": product.visual_features,
                    "product_form": product.product_form,
                    "consistency_notes": product.consistency_notes,
                    "usage_scenarios": product.usage_scenarios,
                    "user_pain_points": product.user_pain_points,
                    "immutable_structure_constraints": product.immutable_structure_constraints,
                    "visual_risk_notes": product.visual_risk_notes,
                },
                "creative_context": blueprint.creative_brief,
                "creative_intent": (project_config or {}).get("effective_creative_intent", ""),
                "story_blueprint": blueprint.model_dump(),
                "project_config": project_config or {},
                "language_policy": (project_config or {}).get("language_policy", {}),
                "language_prompt_rules": (project_config or {}).get("language_prompt_rules", ""),
                "s2_visual_requirements": blueprint.visual_requirements,
            }
            _trace(
                "S3_SPEC_INPUT_CONTEXT",
                {
                    "project_id": project_id,
                    "project_config": project_config or {},
                    "product_context": product.model_dump(),
                    "story_blueprint": blueprint.model_dump(),
                    "segment_plan": [x.model_dump() for x in blueprint.segment_plan],
                    "asset_requirements": blueprint.asset_requirements,
                    "visual_requirements": blueprint.visual_requirements,
                },
            )
            _trace(
                "S3_SPEC_PROMPT",
                {
                    "project_id": project_id,
                    "provider": "xai_text_provider",
                },
            )
            ai_cfg = get_ai_runtime_config(STAGE_S3_ASSET_MANAGEMENT)
            effective_system_prompt = ai_cfg.system_prompt or ASSET_SPEC_SYSTEM_PROMPT
            effective_payload = apply_runtime_user_prompt_template(
                user_payload=prompt_payload,
                template=ai_cfg.user_prompt_template,
                payload_placeholder="asset_payload",
                values={"project_id": project_id},
            )
            effective_model = (ai_cfg.model_id or "").strip() or None
            effective_provider = (ai_cfg.provider or "").strip().lower() or None
            _trace(
                "S3_SPEC_RUNTIME_CONFIG",
                {
                    "project_id": project_id,
                    "system_prompt": effective_system_prompt,
                    "user_payload": effective_payload,
                    "provider": "xai_text_provider",
                    "model": effective_model or "effective_xai_text_model",
                    "configured_provider": effective_provider,
                    "prompt_template_id": ai_cfg.prompt_template_id,
                    "prompt_version": ai_cfg.prompt_version,
                },
            )
            data = self._text.generate_structured_json(
                project_id=project_id,
                service_name="asset_spec",
                system_prompt=effective_system_prompt,
                user_payload=effective_payload,
                image_urls=None,
                expected_schema_name="AssetSpecsBundle",
                stage="ASSET_SPEC_GENERATION",
                model=effective_model,
                provider=effective_provider,
            )
            _trace("S3_SPEC_RAW_RESPONSE", {"project_id": project_id, "response": data})
            constraints = _extract_market_constraints(blueprint, project_config, product)
            bundle = _normalize_asset_bundle(
                _validate_asset_bundle(data),
                product_name=product.product_name,
                workflow_language=(project_config or {}).get("workflow_language"),
                product=product,
                project_id=project_id,
                project_config=project_config,
            )
            bundle = _apply_market_constraints_to_bundle(bundle, constraints)
            logger.info(
                "ASSET_SPEC_GENERATION_SUCCEEDED %s",
                {"project_id": project_id, "stage": "ASSET_SPEC_GENERATION", "provider": "xai"},
            )
            return bundle
        except Exception as e:
            logger.info(
                "ASSET_SPEC_GENERATION_FAILED %s",
                {
                    "project_id": project_id,
                    "stage": "ASSET_SPEC_GENERATION",
                    "provider": "xai",
                    "error_type": type(e).__name__,
                },
            )
            raise


def _validate_asset_bundle(data: dict[str, Any]) -> AssetSpecsBundleSchema:
    for key in ("characters", "scenes", "products"):
        if key not in data or not isinstance(data[key], list):
            raise ShortDramaInvalidModelOutputError(f"Missing or invalid list: {key}")
    chars: list[CharacterAssetSchema] = []
    for row in data["characters"]:
        if not isinstance(row, dict) or not (row.get("name") or "").strip():
            raise ShortDramaInvalidModelOutputError("Invalid character row")
        m = row.get("meta_json")
        meta = m if isinstance(m, dict) else {}
        chars.append(
            CharacterAssetSchema(
                name=str(row["name"]).strip(),
                role_type=str(row.get("role_type") or "").strip(),
                description=(str(row.get("description")) if row.get("description") is not None else None),
                image_prompt=(
                    str(row.get("image_prompt"))
                    if row.get("image_prompt") is not None
                    else (
                        str(row.get("visual_prompt"))
                        if row.get("visual_prompt") is not None
                        else None
                    )
                ),
                visual_prompt=(str(row.get("visual_prompt")) if row.get("visual_prompt") is not None else None),
                image_url=None,
                source_asset_version=str(row.get("source_asset_version") or "legacy-1"),
                exposure_priority=str(row.get("exposure_priority") or "secondary"),
                narrative_function=(str(row.get("narrative_function")) if row.get("narrative_function") is not None else None),
                purpose=(str(row.get("purpose")) if row.get("purpose") is not None else None),
                asset_identity=str(row.get("asset_identity") or "").strip() or None,
                boundary_warnings=list(row.get("boundary_warnings") or []),
                meta={**meta, "provider": "xai"},
            )
        )
    scenes: list[SceneAssetSchema] = []
    for row in data["scenes"]:
        if not isinstance(row, dict) or not (row.get("name") or "").strip():
            raise ShortDramaInvalidModelOutputError("Invalid scene row")
        m = row.get("meta_json")
        meta = m if isinstance(m, dict) else {}
        scenes.append(
            SceneAssetSchema(
                name=str(row["name"]).strip(),
                scene_type=str(row.get("scene_type") or "").strip(),
                scene_form=(str(row.get("scene_form")) if row.get("scene_form") is not None else None),
                description=(str(row.get("description")) if row.get("description") is not None else None),
                image_prompt=(
                    str(row.get("image_prompt"))
                    if row.get("image_prompt") is not None
                    else (
                        str(row.get("visual_prompt"))
                        if row.get("visual_prompt") is not None
                        else None
                    )
                ),
                visual_prompt=(str(row.get("visual_prompt")) if row.get("visual_prompt") is not None else None),
                image_url=None,
                source_asset_version=str(row.get("source_asset_version") or "legacy-1"),
                exposure_priority=str(row.get("exposure_priority") or "secondary"),
                narrative_function=(str(row.get("narrative_function")) if row.get("narrative_function") is not None else None),
                purpose=(str(row.get("purpose")) if row.get("purpose") is not None else None),
                asset_identity=str(row.get("asset_identity") or "").strip() or None,
                boundary_warnings=list(row.get("boundary_warnings") or []),
                meta={**meta, "provider": "xai"},
            )
        )
    products: list[ProductAssetSchema] = []
    for row in data["products"]:
        if not isinstance(row, dict) or not (row.get("name") or "").strip():
            raise ShortDramaInvalidModelOutputError("Invalid product row")
        m = row.get("meta_json")
        meta = m if isinstance(m, dict) else {}
        products.append(
            ProductAssetSchema(
                name=str(row["name"]).strip(),
                product_role=(str(row.get("product_role")) if row.get("product_role") is not None else None),
                description=(str(row.get("description")) if row.get("description") is not None else None),
                image_prompt=(
                    str(row.get("image_prompt"))
                    if row.get("image_prompt") is not None
                    else (
                        str(row.get("visual_prompt"))
                        if row.get("visual_prompt") is not None
                        else None
                    )
                ),
                visual_prompt=(str(row.get("visual_prompt")) if row.get("visual_prompt") is not None else None),
                image_url=None,
                source_asset_version=str(row.get("source_asset_version") or "legacy-1"),
                exposure_priority=str(row.get("exposure_priority") or "secondary"),
                narrative_function=(str(row.get("narrative_function")) if row.get("narrative_function") is not None else None),
                purpose=(str(row.get("purpose")) if row.get("purpose") is not None else None),
                asset_identity=str(row.get("asset_identity") or "").strip() or None,
                boundary_warnings=list(row.get("boundary_warnings") or []),
                meta={**meta, "provider": "xai"},
            )
        )
    if not chars or not scenes or not products:
        raise ShortDramaInvalidModelOutputError("characters, scenes, and products must be non-empty")
    return AssetSpecsBundleSchema(characters=chars, scenes=scenes, products=products)


def _normalize_character_asset(row: CharacterAssetSchema) -> CharacterAssetSchema:
    name, name_warnings = _strip_plot_terms(row.name)
    desc, desc_warnings = _strip_plot_terms(row.description)
    prompt = _resolve_asset_image_prompt(row.image_prompt, row.visual_prompt, row.description)
    _, prompt_warnings = _strip_plot_terms(prompt)
    warnings = list(dict.fromkeys([*row.boundary_warnings, *name_warnings, *desc_warnings, *prompt_warnings]))
    meta = {
        **(row.meta or {}),
        "asset_boundary": "character_reference",
        "forbidden_in_asset": "plot action / emotion event / product interaction",
    }
    final_name = name or row.name or str((row.meta or {}).get("identity") or "").strip() or "Main Character"
    return row.model_copy(
        update={
            "name": final_name,
            "description": desc or row.description,
            "image_prompt": prompt or row.image_prompt,
            "visual_prompt": prompt,
            "asset_identity": row.asset_identity or final_name,
            "boundary_warnings": warnings,
            "meta": meta,
        }
    )


def _normalize_scene_asset(row: SceneAssetSchema, workflow_language: str | None) -> SceneAssetSchema:
    identity, identity_warnings = _scene_identity(
        row.name,
        row.description,
        row.visual_prompt,
        workflow_language,
    )
    desc, desc_warnings = _strip_plot_terms(row.description)
    prompt = _resolve_asset_image_prompt(row.image_prompt, row.visual_prompt, row.description)
    _, prompt_warnings = _strip_plot_terms(prompt)
    warnings = list(dict.fromkeys([*row.boundary_warnings, *identity_warnings, *desc_warnings, *prompt_warnings]))
    meta = {
        **(row.meta or {}),
        "asset_boundary": "empty_location",
        "location_identity": identity,
        "forbidden_in_asset": "emotion state / conflict / shot action / character-driven drama",
    }
    return row.model_copy(
        update={
            "name": identity,
            "description": desc or row.description or "",
            "image_prompt": prompt or row.image_prompt,
            "visual_prompt": prompt,
            "asset_identity": identity,
            "boundary_warnings": warnings,
            "meta": meta,
        }
    )


def _build_product_shape_guard(name: str, form: str, visual_features: list[str]) -> str:
    if not any(str(x or "").strip() for x in [name, form, *visual_features]):
        return ""
    return "保持产品主体形态、材质、颜色、比例和可见结构一致，不要改成其他品类或虚构不存在的部件。"


def _immutable_structure_constraints(name: str, form: str, visual_features: list[str], risk_notes: list[str] | None = None) -> list[str]:
    base = [str(x).strip() for x in (risk_notes or []) if str(x).strip()]
    if not base:
        base.extend(["不要改变产品主体结构", "不要虚构不存在的品牌标识", "不要把产品改成其他品类"])
    return list(dict.fromkeys(base))


def _workflow_prefers_chinese(workflow_language: str | None) -> bool:
    return str(workflow_language or "").strip().lower().startswith("zh")


def _looks_like_placeholder_display_text(text: str) -> bool:
    v = str(text or "").strip().lower()
    if not v:
        return True
    banned = [
        "main character",
        "scene location",
        "character_",
        "scene_",
        "product_",
        "product-only reference asset",
        "reusable empty location reference",
        "clean character reference",
        "empty reusable location background plate",
    ]
    return any(token in v for token in banned)


def _first_location_token(text: str) -> str:
    raw = _clean_ws(text)
    if not raw:
        return ""
    parts = [p.strip() for p in re.split(r"[;,/|，；、]+", raw) if p.strip()]
    return parts[0] if parts else raw


def _extract_location_candidates(*texts: str) -> list[str]:
    out: list[str] = []
    for text in texts:
        raw = _clean_ws(text)
        if not raw:
            continue
        pieces = [p.strip() for p in re.split(_MULTI_LOCATION_SPLIT_PATTERN, raw, flags=re.IGNORECASE) if p.strip()]
        for piece in (pieces or [raw]):
            v = _clean_ws(piece)
            if v and v not in out:
                out.append(v)
    return out


def _choose_primary_location(
    candidates: list[str],
    *,
    creative_brief: str,
    marketing_goal: str,
) -> str:
    if not candidates:
        return ""
    brief = str(creative_brief or "").lower()
    for c in candidates:
        if str(c).lower() in brief:
            return c
    if marketing_goal == "brand_seeding":
        for preferred in _COMMUTE_LOCATION_CANDIDATES:
            for c in candidates:
                if preferred.lower() in str(c).lower():
                    return c
    return candidates[0]


def _zh_scene_name(primary_location: str, target_market: str) -> str:
    p = _clean_ws(primary_location)
    if not p:
        return "单一通勤场景"
    lower = p.lower()
    if "metro" in lower or "subway" in lower or "站台" in p or "地铁" in p:
        return "东南亚城市地铁站台" if ("southeast asia" in target_market.lower() or "东南亚" in target_market) else "城市地铁站台"
    if "street" in lower or "commute" in lower or "街头" in p or "通勤" in p:
        return "东南亚城市通勤街头" if ("southeast asia" in target_market.lower() or "东南亚" in target_market) else "城市通勤街头"
    if "cafe" in lower or "咖啡" in p:
        return "咖啡店靠窗座位"
    if "office" in lower or "办公" in p:
        return "办公桌场景"
    if "apartment" in lower or "公寓" in p:
        return "清晨公寓玄关"
    return p


def _to_text(value: Any) -> str:
    return str(value or "").strip()


def _to_list_text(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(x).strip() for x in value if str(x or "").strip()]


def _contains_any(text: str, needles: list[str]) -> bool:
    source = _to_text(text).lower()
    if not source:
        return False
    return any(n.lower() in source for n in needles)


def _resolve_plot_stage(corpus: str) -> str:
    if _contains_any(corpus, ["记忆点", "memory", "强化记忆", "记住"]):
        return "记忆点"
    if _contains_any(corpus, ["氛围强化", "穿搭", "质感", "lifestyle", "风格"]):
        return "氛围强化"
    if _contains_any(corpus, ["产品自然出现", "露出", "展示产品", "showcase", "product"]):
        return "产品自然出现"
    if _contains_any(corpus, ["情绪共鸣", "压力", "不便", "共鸣", "emotion"]):
        return "情绪共鸣"
    return "生活场景"


def _resolve_scene_form(location: str, story_usage: str) -> str:
    low = f"{_to_text(location)} {_to_text(story_usage)}".lower()
    if _contains_any(low, ["地铁", "通勤", "station", "subway", "metro", "commute"]):
        return "单地点通勤场景"
    if _contains_any(low, ["街头", "路口", "street", "crossroad"]):
        return "单地点街头场景"
    if _contains_any(low, ["公寓", "玄关", "咖啡", "室内", "apartment", "entry", "cafe", "indoor"]):
        return "单地点室内场景"
    if _contains_any(low, ["产品", "手机", "手持", "摆放"]):
        return "单地点产品使用场景"
    return "单地点生活方式场景"


def _infer_time_of_day(corpus: str, location: str, plot_stage: str) -> str:
    c = corpus.lower()
    if _contains_any(c, ["凌晨", "深夜", "night", "late night"]):
        return "深夜"
    if _contains_any(c, ["傍晚", "黄昏", "evening", "sunset"]):
        return "傍晚"
    if _contains_any(c, ["上午", "中午", "noon", "midday"]):
        return "上午"
    if _contains_any(c, ["早高峰", "通勤高峰", "rush hour"]):
        return "早高峰"
    if _contains_any(c, ["清晨", "早晨", "morning", "出门"]):
        return "清晨"
    loc = location.lower()
    if _contains_any(loc, ["玄关", "出门", "entry"]):
        return "清晨"
    if _contains_any(loc, ["地铁", "通勤走廊", "station", "subway", "metro"]):
        return "早高峰"
    if _contains_any(loc, ["街头", "路口", "street", "crossroad"]):
        return "傍晚" if plot_stage in {"记忆点", "氛围强化"} else "上午"
    if _contains_any(loc, ["咖啡", "cafe"]):
        return "上午"
    return "日间"


def _infer_lighting(location: str, time_of_day: str) -> str:
    loc = location.lower()
    if _contains_any(loc, ["公寓", "玄关", "apartment", "entry"]):
        return "清晨室内自然光，窗边柔光进入玄关区域" if "清晨" in time_of_day else "室内柔和自然光，局部窗边补光"
    if _contains_any(loc, ["地铁", "站台", "subway", "metro", "station"]):
        return "明亮城市日光与站台顶棚漫射光叠加，空间层次清晰"
    if _contains_any(loc, ["街头", "路口", "street", "crossroad"]):
        return "户外自然光覆盖街区，城市街头日光反射形成真实层次"
    if _contains_any(loc, ["咖啡", "cafe"]):
        return "室内暖光与靠窗自然光混合，人物肤色和产品边框更通透"
    return "自然环境光为主，辅以轻微空间漫反射"


def _infer_atmosphere(location: str, plot_stage: str) -> str:
    loc = location.lower()
    if _contains_any(loc, ["公寓", "玄关", "apartment", "entry"]):
        return "安静、干净、生活化，带有出门前的轻快节奏"
    if _contains_any(loc, ["地铁", "站台", "subway", "metro", "station"]):
        return "通勤、轻快、现代城市感，带有人流节奏"
    if _contains_any(loc, ["街头", "路口", "street", "crossroad"]):
        return "真实、街头、轻松，生活方式感明显"
    if _contains_any(loc, ["咖啡", "cafe"]):
        return "松弛、温暖，带有轻社交氛围"
    if plot_stage == "情绪共鸣":
        return "日常中带轻微节奏压力，便于建立共鸣"
    return "自然、日常、都市化"


def _infer_props(location: str) -> str:
    loc = location.lower()
    if _contains_any(loc, ["公寓", "玄关", "apartment", "entry"]):
        return "玄关柜、鞋架、钥匙、背包、手机"
    if _contains_any(loc, ["地铁", "站台", "subway", "metro", "station"]):
        return "导视牌、玻璃窗、扶手、电梯入口"
    if _contains_any(loc, ["街头", "路口", "street", "crossroad"]):
        return "摩托车、街边店铺、热带植物、交通标识"
    if _contains_any(loc, ["咖啡", "cafe"]):
        return "木桌、咖啡杯、窗边座位、笔记本"
    return "生活化基础道具与空间标识"


def _infer_story_usage(plot_stage: str, location: str, index: int) -> str:
    loc = location.lower()
    if _contains_any(loc, ["公寓", "玄关", "apartment", "entry"]):
        return "建立人物日常和场景起点，表现主角进入生活节奏"
    if _contains_any(loc, ["地铁", "站台", "subway", "metro", "station"]):
        return "表现主角在移动场景中的轻微不便或节奏压力，让产品自然露出"
    if _contains_any(loc, ["街头", "路口", "street", "crossroad"]):
        return "强化城市生活方式与穿搭风格，在步行镜头中形成产品记忆点"
    if _contains_any(loc, ["咖啡", "cafe"]):
        return "承接社交或短暂停留动作，表现产品在桌面或手部动作中的自然露出"
    fallback = [
        "建立人物日常和通勤状态",
        "表现主角使用手机时的轻微不便或节奏压力",
        "让产品在手持、放置或使用时自然露出",
        "强化产品材质、外观质感和生活方式关联",
        "形成产品与人物风格的关联",
    ]
    return fallback[min(index, len(fallback) - 1)] if plot_stage == "生活场景" else fallback[min(index + 1, len(fallback) - 1)]


def _compose_scene_description(
    *,
    location: str,
    time_of_day: str,
    lighting: str,
    atmosphere: str,
    props: str,
    story_usage: str,
) -> str:
    loc = location.lower()
    if _contains_any(loc, ["公寓", "玄关", "apartment", "entry"]):
        return (
            f"{time_of_day}的{location}，{lighting}，画面可见{props}，整体呈现{atmosphere}。"
            f"用于{story_usage}。"
        )
    if _contains_any(loc, ["地铁", "站台", "subway", "metro", "station"]):
        return (
            f"{time_of_day}的{location}，{lighting}，空间中包含{props}，整体氛围为{atmosphere}。"
            f"用于{story_usage}。"
        )
    if _contains_any(loc, ["街头", "路口", "street", "crossroad"]):
        return (
            f"{time_of_day}的{location}，{lighting}，路面与街边可见{props}，呈现{atmosphere}。"
            f"用于{story_usage}。"
        )
    if _contains_any(loc, ["咖啡", "cafe"]):
        return (
            f"{time_of_day}的{location}，{lighting}，场景中包含{props}，形成{atmosphere}。"
            f"用于{story_usage}。"
        )
    return f"{time_of_day}的{location}，{lighting}，画面中包含{props}，整体呈现{atmosphere}。用于{story_usage}。"


def _build_scene_display_name(location: str, time_of_day: str, target_market: str) -> str:
    loc = _to_text(location)
    market = _to_text(target_market)
    low = loc.lower()
    if _contains_any(low, ["地铁", "subway", "metro", "station"]):
        return f"{time_of_day}地铁站通勤走廊"
    if _contains_any(low, ["街头", "路口", "street", "crossroad"]):
        if _contains_any(market, ["东南亚", "southeast asia"]):
            return "东南亚街头通勤路口"
        return f"{time_of_day}{loc}"
    if _contains_any(low, ["公寓", "玄关", "apartment", "entry"]):
        return f"{time_of_day}公寓玄关出门区"
    return f"{time_of_day}{loc}"


def resolve_scene_fields(
    scene: SceneAssetSchema,
    project_context: Dict[str, Any] | None,
    story_context: Dict[str, Any] | None,
    index: int,
) -> Dict[str, str]:
    project = project_context or {}
    story = story_context or {}
    meta = scene.meta or {}
    segment_plan = story.get("segment_plan") if isinstance(story.get("segment_plan"), list) else []
    segment = segment_plan[index] if index < len(segment_plan) and isinstance(segment_plan[index], dict) else {}
    selected_primary_location = _to_text(meta.get("selected_primary_location"))
    location = (
        selected_primary_location
        or _to_text(meta.get("location_identity"))
        or _to_text(meta.get("location"))
        or _to_text(scene.scene_form)
        or _to_text(scene.name)
    )
    location = _first_location_token(location) or "城市通勤空间"

    framework = story.get("story_framework") if isinstance(story.get("story_framework"), dict) else {}
    corpus = " ".join(
        [
            _to_text(scene.name),
            _to_text(scene.description),
            _to_text(meta.get("story_usage")),
            _to_text(segment.get("goal")),
            _to_text(segment.get("summary")),
            _to_text(segment.get("story_beat")),
            _to_text(framework.get("type")),
            _to_text(project.get("creative_brief")),
        ]
    )
    plot_stage = _resolve_plot_stage(corpus)
    story_usage = _to_text(meta.get("story_usage")) or _infer_story_usage(plot_stage, location, index)
    scene_form = _resolve_scene_form(location, story_usage)
    time_of_day = _infer_time_of_day(corpus, location, plot_stage)
    lighting = _to_text(meta.get("lighting")) or _infer_lighting(location, time_of_day)
    atmosphere = _to_text(meta.get("atmosphere")) or _infer_atmosphere(location, plot_stage)
    props_list = _to_list_text(meta.get("props"))
    props = "、".join(props_list) if props_list else _infer_props(location)
    display_name = _build_scene_display_name(location, time_of_day, _to_text(project.get("target_market")))
    display_description = _compose_scene_description(
        location=location,
        time_of_day=time_of_day,
        lighting=lighting,
        atmosphere=atmosphere,
        props=props,
        story_usage=story_usage,
    )
    structure_summary = f"{scene_form}，用于{story_usage}。"
    return {
        "display_name": display_name,
        "display_description": display_description,
        "location": location,
        "time_of_day": time_of_day,
        "lighting": lighting,
        "atmosphere": atmosphere,
        "props": props,
        "story_usage": story_usage,
        "scene_form": scene_form,
        "plot_stage": plot_stage,
        "structure_summary": structure_summary,
        "description_hash": hashlib.md5(display_description.encode("utf-8")).hexdigest(),
        "used_generic_template": "false",
    }


def _normalize_product_asset(
    row: ProductAssetSchema,
    product_name: str | None = None,
    product: ProductContextSchema | None = None,
) -> ProductAssetSchema:
    fallback_name = _clean_ws(product_name) or row.name
    name, name_warnings = _strip_product_scene_terms(row.name or fallback_name)
    desc, desc_warnings = _strip_product_scene_terms(row.description)
    prompt = _resolve_asset_image_prompt(row.image_prompt, row.visual_prompt, row.description)
    _, prompt_warnings = _strip_product_scene_terms(prompt)
    p_name = _clean_ws((product.product_name if product else "") or name or fallback_name)
    p_form = _clean_ws((product.product_form if product else "") or str((row.meta or {}).get("form") or ""))
    p_summary = _clean_ws((product.product_summary if product else ""))
    p_features = list(
        dict.fromkeys([*(product.visual_features if product else []), *((row.meta or {}).get("visual_features") or [])])
    )
    shape_guard = _build_product_shape_guard(p_name, p_form, [str(x) for x in p_features if str(x).strip()])
    immutable_constraints = list(
        dict.fromkeys(
            [
                *(row.immutable_structure_constraints or []),
                *_list_like((row.meta or {}).get("immutable_structure_constraints")),
                *_immutable_structure_constraints(
                    p_name,
                    p_form,
                    [str(x) for x in p_features if str(x).strip()],
                    product.visual_risk_notes if product else [],
                ),
            ]
        )
    )
    warnings = list(dict.fromkeys([*row.boundary_warnings, *name_warnings, *desc_warnings, *prompt_warnings]))
    meta = {
        **(row.meta or {}),
        "asset_boundary": "product_only",
        "forbidden_in_asset": "human usage / scene story / plot interaction",
        "immutable_structure_constraints": immutable_constraints,
    }
    return row.model_copy(
        update={
            "name": p_name or name or fallback_name,
            "description": desc or row.description or p_summary or "",
            "image_prompt": prompt or row.image_prompt,
            "visual_prompt": prompt,
            "asset_identity": p_name or name or fallback_name,
            "boundary_warnings": warnings,
            "immutable_structure_constraints": immutable_constraints,
            "meta": meta,
        }
    )


def _normalize_asset_bundle(
    bundle: AssetSpecsBundleSchema,
    product_name: str | None = None,
    workflow_language: str | None = None,
    product: ProductContextSchema | None = None,
    project_id: int | None = None,
    project_config: Dict[str, Any] | None = None,
) -> AssetSpecsBundleSchema:
    chars = [_normalize_character_asset(c) for c in bundle.characters]

    scenes_by_identity: dict[str, SceneAssetSchema] = {}
    original_locations: list[str] = []
    selected_locations: list[str] = []
    for scene in bundle.scenes:
        raw_name = _clean_ws(scene.name)
        raw_location = _clean_ws(str((scene.meta or {}).get("location") or scene.scene_form or ""))
        raw_desc = _clean_ws(scene.description)
        detected_locations = _extract_location_candidates(raw_name, raw_location, raw_desc)
        selected_primary = _choose_primary_location(
            detected_locations,
            creative_brief=str((project_config or {}).get("creative_brief") or ""),
            marketing_goal=str((project_config or {}).get("marketing_goal") or ""),
        )
        if not selected_primary:
            selected_primary = _first_location_token(raw_location or raw_name or raw_desc)
        market = str((project_config or {}).get("target_market") or "")
        final_scene_name = _zh_scene_name(selected_primary, market) if _workflow_prefers_chinese(workflow_language) else selected_primary
        normalized_input = scene.model_copy(
            update={
                "name": final_scene_name or scene.name,
                "scene_form": selected_primary or scene.scene_form,
                "description": _clean_ws(scene.description or f"单一地点场景：{final_scene_name or selected_primary}"),
                "meta": {
                    **(scene.meta or {}),
                    "original_scene_name": raw_name,
                    "original_location_text": raw_location,
                    "detected_locations": detected_locations,
                    "selected_primary_location": selected_primary,
                    "was_split_or_reduced": len(detected_locations) > 1,
                },
            }
        )
        normalized = _normalize_scene_asset(normalized_input, workflow_language)
        original_locations.append(
            _clean_ws(str((scene.meta or {}).get("location") or scene.scene_form or scene.name or ""))
        )
        selected_locations.append(normalized.name)
        if project_id is not None:
            logger.info(
                "[S3_SCENE_PRIMARY_LOCATION_SELECTED] %s",
                {
                    "project_id": project_id,
                    "original_scene_name": raw_name,
                    "original_location_text": raw_location,
                    "detected_locations": detected_locations,
                    "selected_primary_location": selected_primary,
                    "final_scene_name": normalized.name,
                    "was_split_or_reduced": len(detected_locations) > 1,
                    "prompt_preview": (normalized.visual_prompt or "")[:260],
                },
            )
        key = _clean_ws(normalized.asset_identity or normalized.name).casefold()
        if key in scenes_by_identity:
            prev = scenes_by_identity[key]
            existing_sources = (prev.meta or {}).get("deduped_from", [])
            if not isinstance(existing_sources, list):
                existing_sources = []
            merged_warnings = list(dict.fromkeys([*prev.boundary_warnings, *normalized.boundary_warnings, "deduped duplicate scene by location identity"]))
            scenes_by_identity[key] = prev.model_copy(
                update={
                    "boundary_warnings": merged_warnings,
                    "meta": {**(prev.meta or {}), "deduped_from": [*existing_sources, normalized.name]},
                }
            )
            continue
        scenes_by_identity[key] = normalized

    scenes = list(scenes_by_identity.values())
    if project_id is not None:
        logger.info(
            "[S3_SCENE_SINGLE_LOCATION_NORMALIZED] %s",
            {
                "project_id": project_id,
                "original_locations": [x for x in original_locations if x],
                "selected_primary_location": selected_locations[0] if selected_locations else "",
                "split_count": len(scenes),
                "final_scene_names": [s.name for s in scenes],
                "prompt_preview": (scenes[0].visual_prompt or "")[:260] if scenes else "",
            },
        )

    products = [_normalize_product_asset(p, product_name=product_name, product=product) for p in bundle.products]
    return AssetSpecsBundleSchema(characters=chars, scenes=scenes, products=products)


class AssetSpecService:
    def __init__(self, provider: AssetSpecProvider | None = None):
        self._provider = provider or MockAssetSpecProvider()

    def generate(
        self,
        project_id: int,
        product: ProductContextSchema,
        blueprint: StoryBlueprintSchema,
        project_config: Dict[str, Any] | None = None,
    ) -> AssetSpecsBundleSchema:
        _reject_if_creative_blueprint_v2(
            blueprint,
            message="creative_blueprint_v2 must not use asset_spec_service.generate; use S3 v2 asset_generation_specs path.",
            code="s3_v2_legacy_asset_spec_generate_forbidden",
        )
        config = project_config or {}
        bundle = self._provider.build_specs(project_id, product, blueprint, config)
        constraints = _extract_market_constraints(blueprint, config, product)
        market = str(constraints.get("target_market") or "")
        market_lower = market.lower()
        is_sea = ("southeast asia" in market_lower) or ("东南亚" in market)
        is_china = _market_is_china(market)
        logger.info(
            "[S3_ASSET_MARKET_CONSTRAINT] %s",
            {
                "project_id": project_id,
                "target_market": constraints.get("target_market"),
                "target_audience": constraints.get("target_audience"),
                "character_constraints": (
                    ["Southeast Asian urban young adult", "avoid Western corporate model appearance"]
                    if is_sea
                    else (
                        [
                            "Chinese / East Asian appearance",
                            "Chinese urban young adult persona",
                            "avoid Western model appearance",
                        ]
                        if is_china
                        else []
                    )
                ),
                "scene_constraints": (
                    ["Southeast Asian urban commute street", "metro/subway station, cafe table, office desk"]
                    if is_sea
                    else (["Chinese city commuting context", "metro/office/cafe local setting"] if is_china else [])
                ),
                "product_constraints": (
                    ["keep Southeast Asian market brand context", "avoid unrelated accessory interpretation"]
                    if is_sea
                    else (["keep Chinese market brand context", "avoid overseas default ad wording"] if is_china else [])
                ),
            },
        )
        return _finalize_assets_with_creative_brief(bundle, constraints, product, config)


def _build_asset_spec_service() -> AssetSpecService:
    if settings.SHORT_DRAMA_USE_MOCK_TEXT_PROVIDER:
        return AssetSpecService(MockAssetSpecProvider())
    return AssetSpecService(XAIAssetSpecProvider(get_xai_text_provider()))


asset_spec_service = _build_asset_spec_service()


def inspect_asset_requirements_source(blueprint: StoryBlueprintSchema) -> Dict[str, Any]:
    req = blueprint.asset_requirements if isinstance(blueprint.asset_requirements, dict) else {}
    if not req:
        return {"usable": False, "reason": "missing_asset_requirements"}
    chars_raw = req.get("characters")
    scenes_raw = req.get("scenes")
    products_raw = req.get("products")
    if not isinstance(chars_raw, list) or not isinstance(scenes_raw, list) or not isinstance(products_raw, list):
        return {"usable": False, "reason": "invalid_asset_requirements_structure"}
    if not chars_raw and not scenes_raw and not products_raw:
        return {"usable": False, "reason": "empty_asset_requirements_lists"}
    return {"usable": True, "reason": None}


def asset_bundle_from_story_requirements(
    blueprint: StoryBlueprintSchema,
    product: ProductContextSchema | None = None,
    project_config: Dict[str, Any] | None = None,
) -> AssetSpecsBundleSchema | None:
    _reject_if_creative_blueprint_v2(
        blueprint,
        message="creative_blueprint_v2 must not use asset_bundle_from_story_requirements; use asset_generation_specs.",
        code="s3_v2_legacy_asset_bundle_forbidden",
    )
    req = blueprint.asset_requirements if isinstance(blueprint.asset_requirements, dict) else {}
    chars_raw = req.get("characters") if isinstance(req.get("characters"), list) else []
    scenes_raw = req.get("scenes") if isinstance(req.get("scenes"), list) else []
    products_raw = req.get("products") if isinstance(req.get("products"), list) else []
    if not chars_raw and not scenes_raw and not products_raw:
        pid = (project_config or {}).get("project_id")
        logger.warning("[S3_ASSET_SPEC_MISSING] project_id=%s missing_field=asset_requirements", pid)
        raise ShortDramaInvalidModelOutputError(
            "S2 blueprint has no usable asset_requirements (characters/scenes/products); regenerate S2.",
            code="s3_asset_spec_missing",
            missing_fields=["asset_requirements"],
        )

    def _as_list(v: Any) -> list[str]:
        return [str(x).strip() for x in (v or []) if str(x).strip()] if isinstance(v, list) else []

    chars = [
        CharacterAssetSchema(
            name=str((row or {}).get("name") or (row or {}).get("identity") or "").strip(),
            role_type=str((row or {}).get("role") or "main").strip(),
            description="；".join(
                x
                for x in [
                    str((row or {}).get("identity") or "").strip(),
                    str((row or {}).get("appearance") or "").strip(),
                    str((row or {}).get("costume") or "").strip(),
                    str((row or {}).get("base_expression") or "").strip(),
                ]
                if x
            ),
            image_prompt=str((row or {}).get("image_prompt") or (row or {}).get("visual_prompt") or (row or {}).get("appearance") or "").strip(),
            visual_prompt=str((row or {}).get("visual_prompt") or (row or {}).get("image_prompt") or (row or {}).get("appearance") or "").strip(),
            boundary_warnings=[*_as_list((row or {}).get("must_avoid"))],
            meta={
                "must_keep": _as_list((row or {}).get("must_keep")),
                "appearance": str((row or {}).get("appearance") or "").strip(),
                "costume": str((row or {}).get("costume") or "").strip(),
                "base_expression": str((row or {}).get("base_expression") or "").strip(),
                "voice_profile": str((row or {}).get("voice_profile") or "").strip(),
                "structure_summary": str((row or {}).get("structure_summary") or "").strip(),
            },
        )
        for idx, row in enumerate(chars_raw)
        if isinstance(row, dict)
    ]
    scenes = [
        SceneAssetSchema(
            name=str((row or {}).get("name") or (row or {}).get("location") or "").strip(),
            scene_type="",
            scene_form=str((row or {}).get("location") or "").strip(),
            description="；".join(
                x
                for x in [
                    str((row or {}).get("location") or "").strip(),
                    str((row or {}).get("lighting") or "").strip(),
                    str((row or {}).get("atmosphere") or "").strip(),
                ]
                if x
            ),
            image_prompt=str((row or {}).get("image_prompt") or (row or {}).get("visual_prompt") or "").strip()
            or "；".join(_as_list((row or {}).get("props"))),
            visual_prompt=str((row or {}).get("visual_prompt") or (row or {}).get("image_prompt") or "").strip()
            or "；".join(_as_list((row or {}).get("props"))),
            boundary_warnings=[*_as_list((row or {}).get("must_avoid"))],
            meta={
                "must_keep": _as_list((row or {}).get("must_keep")),
                "location": str((row or {}).get("location") or "").strip(),
                "lighting": str((row or {}).get("lighting") or "").strip(),
                "atmosphere": str((row or {}).get("atmosphere") or "").strip(),
                "props": _as_list((row or {}).get("props")),
                "structure_summary": str((row or {}).get("structure_summary") or "").strip(),
            },
        )
        for idx, row in enumerate(scenes_raw)
        if isinstance(row, dict)
    ]
    products = [
        ProductAssetSchema(
            name=str((row or {}).get("name") or (product.product_name if product else "") or "").strip(),
            product_role=str((row or {}).get("product_role") or "hero").strip(),
            description="；".join(
                x
                for x in [
                    str((row or {}).get("form") or "").strip(),
                    str((row or {}).get("color") or "").strip(),
                    str((row or {}).get("material") or "").strip(),
                ]
                if x
            ),
            image_prompt=str((row or {}).get("image_prompt") or (row or {}).get("visual_prompt") or "").strip()
            or "；".join(_as_list((row or {}).get("visual_features"))),
            visual_prompt=str((row or {}).get("visual_prompt") or (row or {}).get("image_prompt") or "").strip()
            or "；".join(_as_list((row or {}).get("visual_features"))),
            boundary_warnings=[*_as_list((row or {}).get("must_avoid"))],
            meta={
                "must_keep": _as_list((row or {}).get("must_keep")),
                "form": str((row or {}).get("form") or "").strip(),
                "color": str((row or {}).get("color") or "").strip(),
                "material": str((row or {}).get("material") or "").strip(),
                "visual_features": _as_list((row or {}).get("visual_features")),
                "structure_summary": str((row or {}).get("structure_summary") or "").strip(),
            },
        )
        for idx, row in enumerate(products_raw)
        if isinstance(row, dict)
    ]
    workflow_language = (project_config or {}).get("workflow_language")
    normalized = _normalize_asset_bundle(
        AssetSpecsBundleSchema(characters=chars, scenes=scenes, products=products),
        product_name=(product.product_name if product else None),
        workflow_language=workflow_language,
        product=product,
        project_config=project_config,
    )
    constraints = _extract_market_constraints(blueprint, project_config, product or ProductContextSchema())
    constrained = _apply_market_constraints_to_bundle(
        normalized,
        constraints,
    )
    return _finalize_assets_with_creative_brief(constrained, constraints, product, project_config)
