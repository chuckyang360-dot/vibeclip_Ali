"""Tests for short-drama video public URL normalization (pipeline / overview)."""

from __future__ import annotations

import os

import pytest

from app.short_drama.utils.video_storage import resolve_short_drama_video_public_url


def test_resolve_https_r2_url_passthrough(monkeypatch: pytest.MonkeyPatch) -> None:
    url = "https://pub-abc.r2.dev/short-drama/videos/1/final_1_123.mp4"
    monkeypatch.delenv("R2_PUBLIC_BASE_URL", raising=False)
    monkeypatch.delenv("R2_BUCKET_NAME", raising=False)
    assert resolve_short_drama_video_public_url(url) == url


def test_resolve_bare_r2_object_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("R2_PUBLIC_BASE_URL", "https://pub-abc.r2.dev")
    monkeypatch.delenv("R2_BUCKET_NAME", raising=False)
    key = "short-drama/videos/42/final_42_999.mp4"
    assert (
        resolve_short_drama_video_public_url(key)
        == "https://pub-abc.r2.dev/short-drama/videos/42/final_42_999.mp4"
    )


def test_resolve_static_video_path() -> None:
    path = "/static/short-drama-videos/3/seg.mp4"
    out = resolve_short_drama_video_public_url(path)
    assert out is not None
    assert out.endswith("/static/short-drama-videos/3/seg.mp4")
    assert out.startswith("http://") or out.startswith("https://")


def test_rewrite_misconfigured_api_host_to_r2(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("R2_PUBLIC_BASE_URL", "https://pub-abc.r2.dev")
    monkeypatch.setenv("SHORT_DRAMA_PUBLIC_BASE_URL", "https://api.vibeclip.cn")
    monkeypatch.delenv("R2_BUCKET_NAME", raising=False)
    wrong = "https://api.vibeclip.cn/short-drama/videos/2/final_2_1.mp4"
    assert (
        resolve_short_drama_video_public_url(wrong)
        == "https://pub-abc.r2.dev/short-drama/videos/2/final_2_1.mp4"
    )


def test_resolve_r2_video_url_presigns_when_bucket_configured(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("R2_BUCKET_NAME", "bucket-a")
    monkeypatch.setattr(
        "app.utils.r2_storage.build_presigned_get_url",
        lambda key: f"https://signed.example/{key}",
    )
    url = "https://pub-abc.r2.dev/short-drama/videos/1/segment_1.mp4"
    assert resolve_short_drama_video_public_url(url) == "https://signed.example/short-drama/videos/1/segment_1.mp4"


def test_resolve_bare_r2_key_presigns_when_bucket_configured(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("R2_BUCKET_NAME", "bucket-a")
    monkeypatch.setenv("R2_PUBLIC_BASE_URL", "https://pub-abc.r2.dev")
    monkeypatch.setattr(
        "app.utils.r2_storage.build_presigned_get_url",
        lambda key: f"https://signed.example/{key}",
    )
    assert (
        resolve_short_drama_video_public_url("short-drama/videos/1/segment_1.mp4")
        == "https://signed.example/short-drama/videos/1/segment_1.mp4"
    )
