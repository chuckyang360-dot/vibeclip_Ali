from __future__ import annotations

import json
import logging
from typing import Any

logger = logging.getLogger(__name__)


_TARGET_MARKET_TO_VIDEO_LANGUAGE = {
    "north america": "en-US",
    "japan": "ja-JP",
    "korea": "ko-KR",
    "thailand": "th-TH",
    "china": "zh-CN",
    "europe": "en-US",
    "southeast asia": "en-US",
}

_TARGET_MARKET_ALIASES = {
    "north america": "north america",
    "北美": "north america",
    "usa": "north america",
    "united states": "north america",
    "canada": "north america",
    "europe": "europe",
    "欧洲": "europe",
    "japan": "japan",
    "日本": "japan",
    "korea": "korea",
    "south korea": "korea",
    "韩国": "korea",
    "thailand": "thailand",
    "thai": "thailand",
    "泰国": "thailand",
    "southeast asia": "southeast asia",
    "东南亚": "southeast asia",
    "china": "china",
    "中国大陆": "china",
    "中国": "china",
    "global": "global",
    "全球": "global",
    "custom": "custom",
    "自定义": "custom",
}

_WESTERN_MARKET_TERMS = (
    "north america",
    "北美",
    "usa",
    "united states",
    "america",
    "美国",
    "欧美",
    "western market",
    "western",
    "english market",
    "tiktok english",
    "amazon",
)

_CHINESE_CONTEXT_TERMS = (
    "小红书",
    "xiaohongshu",
    "rednote",
    "抖音",
    "douyin",
    "中文",
    "中国",
    "国内",
)

_ENGLISH_LANGUAGE_TERMS = (
    "英文",
    "英语",
    "english",
    "en-us",
    "american english",
)

_CHINESE_LANGUAGE_TERMS = (
    "中文",
    "普通话",
    "汉语",
    "zh-cn",
    "小红书",
    "xiaohongshu",
    "rednote",
    "抖音",
    "douyin",
)


def _flatten_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        return " ".join(_flatten_text(v) for v in value.values())
    if isinstance(value, (list, tuple, set)):
        return " ".join(_flatten_text(v) for v in value)
    return str(value)


def infer_workflow_language(*values: Any) -> str:
    text = _flatten_text(values)
    return "zh-CN" if any("\u4e00" <= ch <= "\u9fff" for ch in text) else "en-US"


def _contains_any(text: str, terms: tuple[str, ...]) -> bool:
    low = text.casefold()
    return any(term.casefold() in low for term in terms)


def normalize_target_market(value: Any) -> str:
    text = str(value or "").strip()
    if not text:
        return "unspecified"
    low = text.casefold()
    if _contains_any(text, ("小红书", "xiaohongshu", "rednote")):
        return "小红书中文内容语境"
    if _contains_any(text, ("抖音", "douyin")):
        return "抖音中文内容语境"
    if _contains_any(text, _WESTERN_MARKET_TERMS):
        return "North America"
    for alias, normalized in _TARGET_MARKET_ALIASES.items():
        if alias in low:
            if normalized == "north america":
                return "North America"
            if normalized == "europe":
                return "Europe"
            if normalized == "japan":
                return "Japan"
            if normalized == "korea":
                return "Korea"
            if normalized == "thailand":
                return "Thailand"
            if normalized == "southeast asia":
                return "Southeast Asia"
            if normalized == "china":
                return "China"
            if normalized == "global":
                return "Global"
            if normalized == "custom":
                return "Custom"
    return "unspecified"


def infer_video_language(workflow_language: str, target_market: Any = None, source: Any = None) -> str:
    source_text = _flatten_text(source)
    if _contains_any(source_text, _ENGLISH_LANGUAGE_TERMS):
        return "en-US"
    if _contains_any(source_text, _CHINESE_LANGUAGE_TERMS):
        return "zh-CN"
    normalized_market = normalize_target_market(target_market).casefold()
    if normalized_market in _TARGET_MARKET_TO_VIDEO_LANGUAGE:
        return _TARGET_MARKET_TO_VIDEO_LANGUAGE[normalized_market]
    return workflow_language or "zh-CN"


def build_language_policy(
    *,
    workflow_source: Any,
    market_source: Any = None,
    explicit_target_market: Any = None,
) -> dict[str, str]:
    workflow_language = infer_workflow_language(workflow_source)
    source_market = normalize_target_market(market_source if market_source is not None else workflow_source)
    explicit_market = normalize_target_market(explicit_target_market)
    if explicit_market == "North America" and source_market not in {"North America", "unspecified"}:
        target_market = source_market
    elif str(explicit_target_market or "").strip():
        target_market = explicit_market
    else:
        target_market = source_market
    source_for_language = {
        "workflow_source": workflow_source,
        "market_source": market_source,
        "explicit_target_market": explicit_target_market,
    }
    video_language = infer_video_language(workflow_language, target_market, source_for_language)
    return {
        "target_market": target_market,
        "workflow_language": workflow_language,
        "video_language": video_language,
    }


def _project_value(project: Any, field: str) -> str:
    return str(getattr(project, field, "") or "").strip()


def resolve_project_language_policy(
    project: Any,
    inferred_policy: dict[str, str] | None,
    *,
    stage: str = "",
) -> dict[str, str]:
    inferred = inferred_policy or {}
    project_target_market = _project_value(project, "target_market")
    project_workflow_language = _project_value(project, "workflow_language")
    project_video_language = _project_value(project, "video_language")
    inferred_target_market = str(inferred.get("target_market") or "").strip()
    inferred_video_language = str(inferred.get("video_language") or "").strip()
    legacy_default_market = project_target_market.casefold() == "north america"
    legacy_default_video_language = project_video_language.casefold() == "en-us"
    resolved_workflow_language = project_workflow_language or inferred.get("workflow_language") or "zh-CN"
    resolved_video_language = (
        inferred_video_language
        if legacy_default_video_language and inferred_video_language
        else (project_video_language or inferred_video_language or resolved_workflow_language)
    )
    resolved_target_market = (
        inferred_target_market
        if legacy_default_market and inferred_target_market
        else (project_target_market or inferred_target_market or "unspecified")
    )
    resolved = {
        "target_market": resolved_target_market,
        "workflow_language": resolved_workflow_language,
        "video_language": resolved_video_language,
    }
    logger.info(
        "[LANGUAGE_POLICY_RESOLVED] %s",
        json.dumps(
            {
                "project_id": getattr(project, "id", None),
                "stage": stage,
                "inferred_workflow_language": inferred.get("workflow_language"),
                "project_workflow_language": project_workflow_language or None,
                "resolved_workflow_language": resolved_workflow_language,
                "inferred_video_language": inferred.get("video_language"),
                "project_video_language": project_video_language or None,
                "resolved_video_language": resolved_video_language,
                "inferred_target_market": inferred.get("target_market"),
                "project_target_market": project_target_market or None,
                "resolved_target_market": resolved_target_market,
            },
            ensure_ascii=False,
        ),
    )
    return resolved


def language_prompt_rules(policy: dict[str, str] | None) -> str:
    p = policy or {}
    workflow_language = p.get("workflow_language") or "zh-CN"
    video_language = p.get("video_language") or workflow_language
    return (
        f"workflow_language: {workflow_language}. "
        "All planning fields, explanations, asset names, scene descriptions, and UI-facing text must use this language. "
        f"video_language: {video_language}. "
        "Only dialogue, voiceover, subtitles, screen text, and audience-facing video copy should use this language. "
        "Treat language_policy as a lightweight language hint; if it conflicts with creative_brief or creative_intent_input, follow those source inputs."
    )
