"""Railway text proxy per-stage timeout (S2 story generation vs short requests)."""

from __future__ import annotations

import pytest

from app.config import settings
from app.short_drama.providers.railway_text_proxy import effective_railway_text_proxy_timeout_seconds


def test_story_generation_stage_uses_long_timeout(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "AI_PROXY_TIMEOUT_SECONDS", 120)
    monkeypatch.setattr(settings, "STORY_GENERATION_PROXY_TIMEOUT_SECONDS", 240)
    assert (
        effective_railway_text_proxy_timeout_seconds(
            service_name="story_planner",
            stage="STORY_GENERATION",
        )
        == 240
    )


def test_story_generation_repair_and_json_repair_stages_use_long_timeout(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "AI_PROXY_TIMEOUT_SECONDS", 120)
    monkeypatch.setattr(settings, "STORY_GENERATION_PROXY_TIMEOUT_SECONDS", 180)
    assert (
        effective_railway_text_proxy_timeout_seconds(
            service_name="story_planner_repair",
            stage="STORY_GENERATION_REPAIR",
        )
        == 180
    )
    assert (
        effective_railway_text_proxy_timeout_seconds(
            service_name="story_planner",
            stage="STORY_GENERATION_json_repair_1",
        )
        == 180
    )


def test_short_text_stage_keeps_default_proxy_timeout(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "AI_PROXY_TIMEOUT_SECONDS", 120)
    monkeypatch.setattr(settings, "STORY_GENERATION_PROXY_TIMEOUT_SECONDS", 240)
    assert (
        effective_railway_text_proxy_timeout_seconds(
            service_name="creative_brief",
            stage="CREATIVE_BRIEF_GENERATION",
        )
        == 120
    )


def test_story_timeout_falls_back_to_short_drama_xai_text_timeout(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "AI_PROXY_TIMEOUT_SECONDS", 120)
    monkeypatch.setattr(settings, "STORY_GENERATION_PROXY_TIMEOUT_SECONDS", 0)
    monkeypatch.setattr(settings, "SHORT_DRAMA_XAI_TEXT_TIMEOUT_SECONDS", 180)
    assert (
        effective_railway_text_proxy_timeout_seconds(
            service_name="story_planner",
            stage="STORY_GENERATION",
        )
        == 180
    )
