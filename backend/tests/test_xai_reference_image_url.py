"""S5 xAI reference URL: use reachable R2 or static URL; never keep broken api/short-drama paths."""

from __future__ import annotations

from pathlib import Path

import pytest

from app.short_drama.utils import xai_reference_image as xri


@pytest.fixture
def xai_jpeg_file(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> tuple[int, str]:
    """Project 2 with one xai-ready JPEG on disk."""
    project_id = 2
    fname = "xai_ref_testdeadbeef.jpg"
    root = tmp_path / "short_drama_xai_assets" / str(project_id)
    root.mkdir(parents=True)
    (root / fname).write_bytes(b"\xff\xd8\xff\xe0\x00\x10JFIF")
    pub_rel = f"/static/short-drama-xai-assets/{project_id}/{fname}"

    def _xai_root() -> Path:
        return tmp_path / "short_drama_xai_assets"

    monkeypatch.setattr(xri, "xai_ready_assets_root", _xai_root)
    return project_id, pub_rel


def _patch_public_static_base(monkeypatch: pytest.MonkeyPatch, base: str) -> None:
    def _build(path: str) -> str:
        p = path if path.startswith("/") else f"/{path}"
        return f"{base.rstrip('/')}{p}"

    monkeypatch.setattr(
        "app.short_drama.utils.public_static_url.build_public_static_url",
        _build,
    )


def test_resolve_uses_r2_public_url_when_probe_ok(
    xai_jpeg_file: tuple[int, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    project_id, pub_rel = xai_jpeg_file
    r2_public = f"https://cdn.example.com/short-drama/{project_id}/xai_ref_testdeadbeef.jpg"

    _patch_public_static_base(monkeypatch, "https://api.vibeclip.cn")
    monkeypatch.setattr(
        "app.utils.r2_storage.upload_file",
        lambda _fp, key: f"https://cdn.example.com/{key}",
    )

    def _probe(url: str) -> tuple[bool, int, str]:
        if url == r2_public:
            return True, 200, "image/jpeg"
        return False, 404, "text/html"

    monkeypatch.setattr(xri, "probe_reference_image_url", _probe)

    final = xri.resolve_xai_reference_public_url(
        project_id=project_id,
        segment_id="seg-1",
        source_url="https://api.vibeclip.cn/static/short-drama-assets/2/a.png",
        xai_ready_relative_path=pub_rel,
    )
    assert final == r2_public


def test_resolve_falls_back_to_static_when_r2_url_404(
    xai_jpeg_file: tuple[int, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Misconfigured R2_PUBLIC_BASE_URL=api host must not be the final xAI reference URL."""
    project_id, pub_rel = xai_jpeg_file
    bad_r2 = f"https://api.vibeclip.cn/short-drama/{project_id}/xai_ref_testdeadbeef.jpg"
    static_url = (
        f"https://api.vibeclip.cn/static/short-drama-xai-assets/{project_id}/xai_ref_testdeadbeef.jpg"
    )

    _patch_public_static_base(monkeypatch, "https://api.vibeclip.cn")
    monkeypatch.setattr(
        "app.utils.r2_storage.upload_file",
        lambda _fp, key: f"https://api.vibeclip.cn/{key}",
    )

    def _probe(url: str) -> tuple[bool, int, str]:
        if url == bad_r2:
            return False, 404, "text/html"
        if url == static_url:
            return True, 200, "image/jpeg"
        return False, 404, "text/plain"

    monkeypatch.setattr(xri, "probe_reference_image_url", _probe)

    final = xri.resolve_xai_reference_public_url(
        project_id=project_id,
        segment_id="seg-1",
        source_url="https://api.vibeclip.cn/static/short-drama-assets/2/a.png",
        xai_ready_relative_path=pub_rel,
    )
    assert final == static_url
    assert final != bad_r2
    assert "/static/short-drama-xai-assets/" in final
