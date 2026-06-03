"""Seedance video provider: payload, factory selection, task create/poll (mocked HTTP)."""

from __future__ import annotations

import json
from typing import Any
from unittest.mock import MagicMock

import pytest

from app.config import settings
from app.short_drama.exceptions import ShortDramaVideoProviderError
from app.short_drama.providers.seedance_video_client import (
    SeedanceVideoClient,
    build_seedance_task_payload,
    extract_task_id,
    extract_task_error,
    extract_task_status,
    extract_video_url,
)
from app.short_drama.providers.seedance_video_provider import SeedanceVideoProvider
from app.short_drama.providers.xai_video_provider import (
    MockXAIVideoProvider,
    XAIVideoProvider,
    build_xai_video_provider,
)
from app.short_drama.utils.ai_runtime_config import AIRuntimeConfig, STAGE_S4_VIDEO_GENERATION


def _runtime(provider: str | None = None, model_id: str | None = None) -> AIRuntimeConfig:
    return AIRuntimeConfig(stage_key=STAGE_S4_VIDEO_GENERATION, provider=provider, model_id=model_id)


def test_build_seedance_task_payload_text_and_reference_images() -> None:
    payload = build_seedance_task_payload(
        model="doubao-seedance-2-0-260128",
        prompt="hello scene",
        reference_image_urls=[
            "https://cdn.example.com/a.jpg",
            "",
            "https://cdn.example.com/b.jpg",
        ],
        duration_seconds=7,
        ratio="9:16",
        generate_audio=True,
        watermark=False,
    )
    assert payload["model"] == "doubao-seedance-2-0-260128"
    assert payload["duration"] == 7
    assert payload["ratio"] == "9:16"
    assert payload["generate_audio"] is True
    assert payload["watermark"] is False
    content = payload["content"]
    assert content[0] == {"type": "text", "text": "hello scene"}
    assert len(content) == 3
    assert content[1]["type"] == "image_url"
    assert content[1]["role"] == "reference_image"
    assert content[1]["image_url"]["url"] == "https://cdn.example.com/a.jpg"
    assert content[2]["image_url"]["url"] == "https://cdn.example.com/b.jpg"


def test_build_seedance_task_payload_default_ratio(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "SEEDANCE_DEFAULT_RATIO", "9:16")
    payload = build_seedance_task_payload(
        model="doubao-seedance-2-0-260128",
        prompt="p",
        reference_image_urls=[],
        duration_seconds=5,
        ratio="",
        generate_audio=False,
        watermark=True,
    )
    assert payload["ratio"] == "9:16"


@pytest.mark.parametrize(
    "body,expected",
    [
        ({"id": "cgt-1"}, "cgt-1"),
        ({"task_id": "cgt-2"}, "cgt-2"),
        ({"data": {"id": "cgt-3"}}, "cgt-3"),
        ({"data": {"task_id": "cgt-4"}}, "cgt-4"),
        ({}, None),
    ],
)
def test_extract_task_id(body: dict[str, Any], expected: str | None) -> None:
    assert extract_task_id(body) == expected


@pytest.mark.parametrize(
    "body,expected",
    [
        ({"status": "running"}, "running"),
        ({"data": {"status": "succeeded"}}, "succeeded"),
    ],
)
def test_extract_task_status(body: dict[str, Any], expected: str) -> None:
    assert extract_task_status(body) == expected


def test_extract_task_error_prefers_structured_code_and_message() -> None:
    body = {
        "status": "failed",
        "error": {
            "code": "OutputVideoSensitiveContentDetected.PolicyViolation",
            "message": "The request failed because the output video may be related to copyright restrictions.",
        },
    }
    assert extract_task_error(body) == (
        "OutputVideoSensitiveContentDetected.PolicyViolation: "
        "The request failed because the output video may be related to copyright restrictions."
    )


@pytest.mark.parametrize(
    "body,expected",
    [
        ({"content": {"video_url": "https://v.example/out.mp4"}}, "https://v.example/out.mp4"),
        ({"content": {"video_url": {"url": "https://v.example/nested.mp4"}}}, "https://v.example/nested.mp4"),
        ({"data": {"video_url": "https://v.example/data.mp4"}}, "https://v.example/data.mp4"),
        ({"outputs": [{"url": "https://v.example/out0.mp4"}]}, "https://v.example/out0.mp4"),
    ],
)
def test_extract_video_url(body: dict[str, Any], expected: str) -> None:
    assert extract_video_url(body) == expected


def test_build_provider_seedance(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.short_drama.utils.ai_runtime_config.get_ai_runtime_config", lambda stage: _runtime())
    monkeypatch.setenv("VIDEO_PROVIDER", "seedance")
    monkeypatch.setenv("ARK_API_KEY", "test-ark-key")
    monkeypatch.setenv("SHORT_DRAMA_USE_MOCK_VIDEO_PROVIDER", "true")
    monkeypatch.setattr(settings, "ARK_API_KEY", "test-ark-key")
    provider = build_xai_video_provider()
    assert isinstance(provider, SeedanceVideoProvider)


def test_build_provider_seedance_requires_ark_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.short_drama.utils.ai_runtime_config.get_ai_runtime_config", lambda stage: _runtime())
    monkeypatch.setenv("VIDEO_PROVIDER", "seedance")
    monkeypatch.delenv("ARK_API_KEY", raising=False)
    monkeypatch.setattr(settings, "ARK_API_KEY", None)
    with pytest.raises(ShortDramaVideoProviderError, match="ARK_API_KEY is required"):
        build_xai_video_provider()


def test_build_provider_xai_when_explicit(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.short_drama.utils.ai_runtime_config.get_ai_runtime_config", lambda stage: _runtime())
    monkeypatch.setenv("VIDEO_PROVIDER", "xai")
    monkeypatch.setenv("XAI_API_KEY", "xai-test")
    monkeypatch.setenv("SHORT_DRAMA_USE_MOCK_VIDEO_PROVIDER", "true")
    monkeypatch.setattr(settings, "XAI_API_KEY", "xai-test")
    provider = build_xai_video_provider()
    assert isinstance(provider, XAIVideoProvider)


def test_build_provider_mock(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("VIDEO_PROVIDER", "mock")
    provider = build_xai_video_provider()
    assert isinstance(provider, MockXAIVideoProvider)


def test_create_task_and_poll_success(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.short_drama.providers.seedance_video_client.validate_reference_image_urls_for_xai",
        lambda **kwargs: None,
    )
    client = SeedanceVideoClient(api_key="k", base_url="https://ark.example/api/v3")

    create_resp = MagicMock()
    create_resp.status_code = 200
    create_resp.json.return_value = {"id": "task-abc"}

    poll_running = MagicMock()
    poll_running.status_code = 200
    poll_running.json.return_value = {"status": "running"}

    poll_done = MagicMock()
    poll_done.status_code = 200
    poll_done.json.return_value = {
        "status": "succeeded",
        "content": {"video_url": "https://cdn.volces.com/video.mp4"},
    }

    download_resp = MagicMock()
    download_resp.status_code = 200
    download_resp.content = b"\x00\x00\x00\x20ftypmp42"

    calls: list[tuple[str, str]] = []

    def fake_request(method: str, path: str, *, json_body: dict[str, Any] | None = None) -> MagicMock:
        calls.append((method, path))
        if method == "POST":
            return create_resp
        if path.endswith("/task-abc") and len(calls) == 2:
            return poll_running
        if path.endswith("/task-abc"):
            return poll_done
        raise AssertionError(f"unexpected request {method} {path}")

    http_client = MagicMock()
    http_client.post.return_value = create_resp
    http_client.get.side_effect = [poll_running, poll_done, download_resp]
    client._http_client = http_client  # noqa: SLF001

    monkeypatch.setattr(client, "_request", fake_request)
    monkeypatch.setattr(settings, "SEEDANCE_TASK_POLL_INTERVAL_SECONDS", 0.01)
    monkeypatch.setattr(settings, "SEEDANCE_TASK_TIMEOUT_SECONDS", 5.0)

    task_id = client.create_video_task(
        model="doubao-seedance-2-0-260128",
        prompt="test prompt",
        reference_image_urls=["https://img.example/ref.jpg"],
        duration_seconds=8,
        ratio="9:16",
        generate_audio=True,
        watermark=False,
        project_id=1,
        segment_id="seg-1",
    )
    assert task_id == "task-abc"

    final = client.poll_video_task(task_id=task_id, project_id=1, segment_id="seg-1")
    assert extract_video_url(final) == "https://cdn.volces.com/video.mp4"

    data = client.download_video_bytes(
        video_url="https://cdn.volces.com/video.mp4",
        project_id=1,
        segment_id="seg-1",
        task_id=task_id,
    )
    assert data.startswith(b"\x00\x00\x00\x20")


def test_poll_failed_raises(monkeypatch: pytest.MonkeyPatch) -> None:
    client = SeedanceVideoClient(api_key="k", base_url="https://ark.example/api/v3")
    fail_resp = MagicMock()
    fail_resp.status_code = 200
    fail_resp.json.return_value = {"status": "failed", "error": {"message": "content policy"}}

    monkeypatch.setattr(client, "_request", lambda *a, **k: fail_resp)
    monkeypatch.setattr(settings, "SEEDANCE_TASK_POLL_INTERVAL_SECONDS", 0.01)
    monkeypatch.setattr(settings, "SEEDANCE_TASK_TIMEOUT_SECONDS", 2.0)

    with pytest.raises(ShortDramaVideoProviderError, match="content policy"):
        client.poll_video_task(task_id="task-fail", project_id=1, segment_id="seg-1")


def test_poll_timeout_raises(monkeypatch: pytest.MonkeyPatch) -> None:
    client = SeedanceVideoClient(api_key="k", base_url="https://ark.example/api/v3")
    running_resp = MagicMock()
    running_resp.status_code = 200
    running_resp.json.return_value = {"status": "running"}

    monkeypatch.setattr(client, "_request", lambda *a, **k: running_resp)
    monkeypatch.setattr(settings, "SEEDANCE_TASK_POLL_INTERVAL_SECONDS", 0.01)
    monkeypatch.setattr(settings, "SEEDANCE_TASK_TIMEOUT_SECONDS", 0.05)

    with pytest.raises(ShortDramaVideoProviderError, match="poll exceeded"):
        client.poll_video_task(task_id="task-slow", project_id=1, segment_id="seg-1")


def test_seedance_provider_submit_and_complete(monkeypatch: pytest.MonkeyPatch) -> None:
    mock_client = MagicMock(spec=SeedanceVideoClient)
    mock_client.create_video_task.return_value = "task-xyz"
    mock_client.poll_video_task.return_value = {
        "status": "succeeded",
        "content": {"video_url": "https://cdn.example/final.mp4"},
    }
    mock_client.download_video_bytes.return_value = b"mp4-bytes"

    provider = SeedanceVideoProvider(client=mock_client)
    monkeypatch.setattr(
        "app.short_drama.providers.seedance_video_provider.get_ai_runtime_config",
        lambda stage: _runtime("seedance", "doubao-seedance-2-0-260128"),
    )
    monkeypatch.setattr(settings, "SEEDANCE_GENERATE_AUDIO", True)
    monkeypatch.setattr(settings, "SEEDANCE_WATERMARK", False)

    rid = provider.submit_reference_segment_video(
        prompt="p",
        reference_image_urls=["https://img.example/r.jpg"],
        duration_seconds=6,
        aspect_ratio="9:16",
        resolution=None,
        project_id=2,
        segment_id="s1",
    )
    assert rid == "task-xyz"

    result = provider.complete_segment_video(
        request_id=rid,
        project_id=2,
        segment_id="s1",
        duration_seconds=6,
    )
    assert result.video_bytes == b"mp4-bytes"
    assert result.provider_video_url == "https://cdn.example/final.mp4"
    assert result.provider_metadata["provider"] == "seedance"

    mock_client.create_video_task.assert_called_once()
    kwargs = mock_client.create_video_task.call_args.kwargs
    assert kwargs["model"] == "doubao-seedance-2-0-260128"
    assert kwargs["duration_seconds"] == 6
    assert kwargs["ratio"] == "9:16"


def test_create_task_http_error(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.short_drama.providers.seedance_video_client.validate_reference_image_urls_for_xai",
        lambda **kwargs: None,
    )
    client = SeedanceVideoClient(api_key="k", base_url="https://ark.example/api/v3")
    err_resp = MagicMock()
    err_resp.status_code = 400
    err_resp.text = json.dumps({"error": "bad request"})
    monkeypatch.setattr(client, "_request", lambda *a, **k: err_resp)

    with pytest.raises(ShortDramaVideoProviderError, match="HTTP 400"):
        client.create_video_task(
            model="doubao-seedance-2-0-260128",
            prompt="p",
            reference_image_urls=[],
            duration_seconds=5,
            ratio="9:16",
            generate_audio=True,
            watermark=False,
            project_id=1,
            segment_id="seg-1",
        )
