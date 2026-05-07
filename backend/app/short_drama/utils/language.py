from __future__ import annotations

from typing import Any


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


def normalize_target_market(value: Any) -> str:
    text = str(value or "").strip()
    if not text:
        return "North America"
    low = text.casefold()
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
    return text


def infer_video_language(workflow_language: str, target_market: Any = None) -> str:
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
    target_market = normalize_target_market(
        explicit_target_market
        if explicit_target_market is not None
        else (market_source if market_source is not None else workflow_source)
    )
    video_language = infer_video_language(workflow_language, target_market)
    return {
        "target_market": target_market,
        "workflow_language": workflow_language,
        "video_language": video_language,
    }


def language_prompt_rules(policy: dict[str, str] | None) -> str:
    p = policy or {}
    workflow_language = p.get("workflow_language") or "zh-CN"
    video_language = p.get("video_language") or workflow_language
    return (
        f"workflow_language: {workflow_language}. "
        "All planning fields, explanations, asset names, scene descriptions, and UI-facing text must use this language. "
        f"video_language: {video_language}. "
        "Only dialogue, voiceover, subtitles, screen text, and audience-facing video copy should use this language."
    )
