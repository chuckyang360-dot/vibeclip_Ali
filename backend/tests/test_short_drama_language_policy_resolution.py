from __future__ import annotations

from types import SimpleNamespace

from app.short_drama.schemas.product import ProductContextSchema, ProductImageUnderstandingSchema, ProductRawInputSchema
from app.short_drama.services.product_context_builder import build_product_context_builder_payload
from app.short_drama.services.story_planner_service import (
    build_s2_compact_context,
    _compact_creative_context_for_story,
    _compact_product_for_story,
    _compact_project_config_for_story,
)
from app.short_drama.utils.creative_brief import build_creative_brief
from app.short_drama.utils.language import build_language_policy, language_prompt_rules, resolve_project_language_policy


def _project() -> SimpleNamespace:
    return SimpleNamespace(
        id=77,
        workflow_language="zh-CN",
        video_language="th-TH",
        target_market="Thailand",
    )


def test_s1_context_builder_payload_keeps_project_language_over_english_input() -> None:
    raw_input = ProductRawInputSchema(
        product_name_raw="English product",
        product_category_raw="Home",
        target_users_raw="office workers",
        selling_points_raw=["compact", "portable"],
    )
    inferred = build_language_policy(
        workflow_source=raw_input.model_dump(),
        market_source={"target_users_raw": raw_input.target_users_raw},
        explicit_target_market="North America",
    )
    language_policy = resolve_project_language_policy(_project(), inferred, stage="S1_parse_product")
    project_constraints = {
        "target_market": language_policy["target_market"],
        "workflow_language": language_policy["workflow_language"],
        "video_language": language_policy["video_language"],
        "language_policy": language_policy,
        "language_prompt_rules": language_prompt_rules(language_policy),
    }

    payload, _audit = build_product_context_builder_payload(
        project_id=77,
        raw_input=raw_input,
        image_understanding=ProductImageUnderstandingSchema(),
        project_constraints=project_constraints,
    )

    assert payload["language_policy"]["workflow_language"] == "zh-CN"
    assert payload["language_policy"]["video_language"] == "th-TH"
    assert payload["language_policy"]["target_market"] == "Thailand"
    assert payload["project_constraints"]["workflow_language"] == "zh-CN"
    assert payload["project_constraints"]["video_language"] == "th-TH"
    assert payload["project_constraints"]["target_market"] == "Thailand"
    assert "workflow_language: zh-CN" in payload["language_prompt_rules"]
    assert "video_language: th-TH" in payload["language_prompt_rules"]


def test_s2_payload_keeps_project_language_and_market_over_english_product_context() -> None:
    product = ProductContextSchema(
        product_name="English product",
        product_category="Home",
        product_summary="An English only summary.",
        core_selling_points=["compact"],
        target_users=["office workers"],
        usage_scenarios=["desk"],
        visual_features=["white plastic"],
    )
    inferred = build_language_policy(
        workflow_source={"product": product.model_dump(), "raw_inputs": {"product_name_raw": "English product"}},
        market_source={"target_users": product.target_users, "usage_scenarios": product.usage_scenarios},
        explicit_target_market="North America",
    )
    language_policy = resolve_project_language_policy(_project(), inferred, stage="S2_generate_story")
    project_config = {
        "project_id": 77,
        "duration": "45s",
        "format": "single_ad",
        "style": "light_conflict",
        "visual_style": "realistic_cinematic",
        "aspect_ratio": "9:16",
        "target_market": language_policy["target_market"],
        "workflow_language": language_policy["workflow_language"],
        "video_language": language_policy["video_language"],
        "language_policy": language_policy,
        "language_prompt_rules": language_prompt_rules(language_policy),
    }
    project_config["creative_brief_data"] = build_creative_brief(project_config, product)
    s2_payload = {
        "project_id": 77,
        "project_config": _compact_project_config_for_story(project_config),
        "language_policy": language_policy,
        "language_prompt_rules": project_config["language_prompt_rules"],
        "creative_context": _compact_creative_context_for_story(project_config),
        "creative_intent": "",
        "product": _compact_product_for_story(product),
    }

    assert s2_payload["language_policy"]["workflow_language"] == "zh-CN"
    assert s2_payload["language_policy"]["video_language"] == "th-TH"
    assert s2_payload["language_policy"]["target_market"] == "Thailand"
    assert "workflow_language: zh-CN" in s2_payload["language_prompt_rules"]
    assert "video_language: th-TH" in s2_payload["language_prompt_rules"]
    project_constraints = s2_payload["creative_context"]["project_constraints"]
    assert project_constraints["working_language"] == "zh-CN"
    assert project_constraints["video_language"] == "th-TH"
    assert project_constraints["target_market"] == "Thailand"


def test_s2_language_policy_prefers_xiaohongshu_chinese_context_over_legacy_defaults() -> None:
    creative_intent_input = {
        "intent_text": "做一个小红书中文种草短剧",
        "platform_hints": ["小红书"],
        "duration_hint": "30s",
        "aspect_ratio_hint": "9:16",
    }
    inferred = build_language_policy(
        workflow_source={
            "creative_brief": {"user_goal": "做一个小红书中文种草短剧"},
            "source_inputs": {"creative_intent_input": creative_intent_input},
        },
        market_source={"creative_intent_input": creative_intent_input},
        explicit_target_market="North America",
    )
    project = SimpleNamespace(
        id=88,
        workflow_language="",
        video_language="en-US",
        target_market="North America",
    )
    language_policy = resolve_project_language_policy(project, inferred, stage="S2_generate_story")
    project_config = {
        "project_id": 88,
        "language_policy": language_policy,
        "creative_brief_data": {"user_goal": "做一个小红书中文种草短剧"},
        "source_inputs": {"creative_intent_input": creative_intent_input},
    }
    s2_payload = build_s2_compact_context(project_id=88, project_config=project_config)

    assert language_policy["workflow_language"] == "zh-CN"
    assert language_policy["video_language"] == "zh-CN"
    assert language_policy["target_market"] == "小红书中文内容语境"
    assert s2_payload["language_policy"]["target_market"] == "小红书中文内容语境"
    assert s2_payload["language_policy"]["video_language"] == "zh-CN"


def test_s2_language_policy_allows_explicit_western_english_intent() -> None:
    creative_intent_input = {
        "intent_text": "TikTok 欧美英文短剧",
        "platform_hints": ["TikTok"],
        "duration_hint": "30s",
        "aspect_ratio_hint": "9:16",
    }
    policy = build_language_policy(
        workflow_source={"source_inputs": {"creative_intent_input": creative_intent_input}},
        market_source={"creative_intent_input": creative_intent_input},
        explicit_target_market=None,
    )

    assert policy["video_language"] == "en-US"
    assert policy["target_market"] == "North America"
