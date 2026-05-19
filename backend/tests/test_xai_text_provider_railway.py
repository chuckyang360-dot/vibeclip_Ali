"""XAITextProvider routes through Railway when AI_PROVIDER=railway_proxy."""

from __future__ import annotations

import json

import pytest

from app.config import settings
from app.short_drama.providers.xai_text_provider import XAITextProvider


def test_structured_json_railway_proxy_no_xai_client(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "AI_PROVIDER", "railway_proxy")
    monkeypatch.setattr(settings, "AI_PROXY_BASE_URL", "https://proxy.test")
    monkeypatch.setattr(settings, "AI_PROXY_TOKEN", "tok")
    monkeypatch.setattr(settings, "AI_PROXY_TIMEOUT_SECONDS", 60)

    payload_obj = {"hello": "012345678901234567890"}
    want_text = json.dumps(payload_obj)

    seen: list[dict] = []

    def fake_railway(**kwargs):
        seen.append(kwargs)
        return want_text

    monkeypatch.setattr(
        "app.short_drama.providers.xai_text_provider.railway_chat_completion_raw_text",
        fake_railway,
    )

    class BoomClient:
        def post_responses(self, **kwargs):
            raise AssertionError("ECS must not call xAI when AI_PROVIDER=railway_proxy")

    prov = XAITextProvider(client=BoomClient())  # type: ignore[arg-type]
    out = prov.generate_structured_json(
        project_id=42,
        service_name="creative_brief",
        system_prompt="SYS",
        user_payload={"u": 1},
        image_urls=None,
        expected_schema_name="CreativeBrief",
        stage="CREATIVE_BRIEF_GENERATION",
        max_output_tokens=2048,
        model="grok-4.20",
    )
    assert out == payload_obj
    assert seen[0]["service_name"] == "creative_brief"
    assert seen[0]["stage"] == "CREATIVE_BRIEF_GENERATION"
    assert seen[0]["image_urls"] is None


def test_structured_json_direct_xai_calls_client(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "AI_PROVIDER", "direct_xai")

    class FakeClient:
        def post_responses(self, **kwargs):
            return (
                {"output": [{"type": "message", "role": "assistant", "content": want_text}]},
                "req-1",
                10,
            )

    want_text = json.dumps({"hello": "012345678901234567890"})
    prov = XAITextProvider(client=FakeClient())  # type: ignore[arg-type]
    out = prov.generate_structured_json(
        project_id=1,
        service_name="creative_brief",
        system_prompt="SYS",
        user_payload={"u": 1},
        image_urls=None,
        expected_schema_name="CreativeBrief",
        stage="CREATIVE_BRIEF_GENERATION",
        model="grok-4.20",
    )
    assert out == {"hello": "012345678901234567890"}
