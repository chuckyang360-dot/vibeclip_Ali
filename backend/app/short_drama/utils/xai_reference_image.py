"""Lightweight JPEG copies of asset images for xAI video reference fetch (smaller / faster than full PNG)."""

from __future__ import annotations

import base64
import hashlib
import io
import logging
import os
from pathlib import Path
from urllib.parse import urlparse

import httpx

from ..exceptions import ShortDramaVideoProviderError
from .image_storage import short_drama_generated_root

logger = logging.getLogger(__name__)

PREFIX_ASSETS = "/static/short-drama-assets/"
PREFIX_XAI = "/static/short-drama-xai-assets/"

MAX_LONGEST_SIDE = 1024
JPEG_QUALITY_PRIMARY = 80
JPEG_QUALITY_FALLBACK = 70
MAX_BYTES_BEFORE_FALLBACK = 200 * 1024
_HTTP_TIMEOUT = httpx.Timeout(connect=15.0, read=60.0, write=30.0, pool=10.0)


def xai_ready_assets_root() -> Path:
    """backend/generated/short_drama_xai_assets"""
    backend_dir = Path(__file__).resolve().parents[3]
    return backend_dir / "generated" / "short_drama_xai_assets"


def ensure_xai_project_dir(project_id: int) -> Path:
    d = xai_ready_assets_root() / str(project_id)
    d.mkdir(parents=True, exist_ok=True)
    return d


def public_xai_ready_url_path(project_id: int, filename: str) -> str:
    return f"/static/short-drama-xai-assets/{project_id}/{filename}"


def local_path_from_asset_public_url(public_url: str) -> Path:
    """Map /static/short-drama-assets/... (or absolute URL with that path) to disk under generated/short_drama_assets."""
    u = (public_url or "").strip()
    if u.startswith("http://") or u.startswith("https://"):
        u = urlparse(u).path or ""
    if not u.startswith(PREFIX_ASSETS):
        raise ShortDramaVideoProviderError(
            f"xAI reference prep: source URL must be under {PREFIX_ASSETS}, got: {public_url!r}"
        )
    rel = u[len(PREFIX_ASSETS) :].lstrip("/")
    root = short_drama_generated_root().resolve()
    path = (root / rel).resolve()
    try:
        path.relative_to(root)
    except ValueError as e:
        raise ShortDramaVideoProviderError(f"xAI reference prep: invalid asset path escape: {public_url!r}") from e
    return path


def _r2_public_base() -> str:
    return (os.getenv("R2_PUBLIC_BASE_URL") or "").strip().rstrip("/")


def classify_reference_source(source_url: str) -> tuple[str, str]:
    """
    Return (source_kind, action):
    - static_path -> local_file
    - r2_url/external_url -> download_bytes
    - data_url -> download_bytes
    """
    s = (source_url or "").strip()
    if not s:
        return "empty", "invalid"
    if s.startswith("data:image/"):
        return "data_url", "download_bytes"
    if s.startswith("/static/short-drama-assets/"):
        return "static_path", "local_file"
    if s.startswith("http://") or s.startswith("https://"):
        parsed = urlparse(s)
        p = parsed.path or ""
        r2_base = _r2_public_base()
        if (r2_base and s.startswith(f"{r2_base}/")) or "/short-drama-assets/" in p:
            return "r2_url", "download_bytes"
        return "external_url", "download_bytes"
    return "invalid", "invalid"


def local_path_from_xai_ready_public_url(public_url: str) -> Path:
    """Map /static/short-drama-xai-assets/... to disk."""
    u = (public_url or "").strip()
    if u.startswith("http://") or u.startswith("https://"):
        u = urlparse(u).path or ""
    if not u.startswith(PREFIX_XAI):
        raise ShortDramaVideoProviderError(f"xAI reference prep: not an xai-ready path: {public_url!r}")
    rel = u[len(PREFIX_XAI) :].lstrip("/")
    root = xai_ready_assets_root().resolve()
    path = (root / rel).resolve()
    try:
        path.relative_to(root)
    except ValueError as e:
        raise ShortDramaVideoProviderError(f"xAI reference prep: invalid xai-ready path: {public_url!r}") from e
    return path


def _resize_longest_side(im, max_side: int):
    from PIL import Image

    w, h = im.size
    if max(w, h) <= max_side:
        return im
    if w >= h:
        nw = max_side
        nh = max(1, int(round(h * max_side / w)))
    else:
        nh = max_side
        nw = max(1, int(round(w * max_side / h)))
    return im.resize((nw, nh), Image.Resampling.LANCZOS)


def _write_jpeg_with_size_cap(im, out_path: Path) -> None:
    buf = io.BytesIO()
    im.save(buf, format="JPEG", quality=JPEG_QUALITY_PRIMARY, optimize=True)
    data = buf.getvalue()
    if len(data) > MAX_BYTES_BEFORE_FALLBACK:
        buf = io.BytesIO()
        im.save(buf, format="JPEG", quality=JPEG_QUALITY_FALLBACK, optimize=True)
        data = buf.getvalue()
    out_path.write_bytes(data)


def _load_image_from_bytes(raw: bytes, source_url: str):
    try:
        from PIL import Image
    except ImportError as e:
        raise ShortDramaVideoProviderError(
            "xAI reference prep: Pillow (PIL) is required. Install with: pip install Pillow"
        ) from e
    try:
        with Image.open(io.BytesIO(raw)) as im:
            return im.convert("RGB")
    except Exception as e:
        raise ShortDramaVideoProviderError(
            f"xAI reference prep: invalid image bytes from {source_url!r}: {e}"
        ) from e


def _load_source_image(normalized: str, source_kind: str):
    if source_kind == "static_path":
        src_path = local_path_from_asset_public_url(normalized)
        if not src_path.is_file():
            raise ShortDramaVideoProviderError(
                f"xAI reference prep: source asset file not found: {src_path} (from {normalized!r})"
            )
        try:
            from PIL import Image
        except ImportError as e:
            raise ShortDramaVideoProviderError(
                "xAI reference prep: Pillow (PIL) is required. Install with: pip install Pillow"
            ) from e
        try:
            with Image.open(src_path) as im:
                return im.convert("RGB")
        except Exception as e:
            raise ShortDramaVideoProviderError(
                f"xAI reference prep: failed to process local image {src_path}: {e}"
            ) from e

    if source_kind in {"r2_url", "external_url"}:
        try:
            with httpx.Client(timeout=_HTTP_TIMEOUT, follow_redirects=True) as client:
                resp = client.get(normalized)
            if resp.status_code >= 400:
                raise ShortDramaVideoProviderError(
                    f"xAI reference prep: failed to download image (HTTP {resp.status_code}): {normalized!r}"
                )
            return _load_image_from_bytes(resp.content, normalized)
        except ShortDramaVideoProviderError:
            raise
        except Exception as e:
            raise ShortDramaVideoProviderError(
                f"xAI reference prep: download image failed from {normalized!r}: {e}"
            ) from e

    if source_kind == "data_url":
        try:
            _, payload = normalized.split(",", 1)
            raw = base64.b64decode(payload, validate=False)
        except Exception as e:
            raise ShortDramaVideoProviderError(f"xAI reference prep: invalid data URL: {e}") from e
        return _load_image_from_bytes(raw, "data_url")

    raise ShortDramaVideoProviderError(f"xAI reference prep: unsupported source URL: {normalized!r}")


def build_xai_ready_reference_image(project_id: int, source_public_url: str) -> str:
    """
    Build a small RGB JPEG under /static/short-drama-xai-assets/<project_id>/xai_ref_<hash>.jpg
    Returns the **relative** public path (for absolutize_media_url_for_provider).
    """
    normalized = (source_public_url or "").strip()
    source_kind, action = classify_reference_source(normalized)
    if source_kind in {"empty", "invalid"}:
        logger.error(
            "[S4_REFERENCE_IMAGE_PREP] source_url_preview=%s source_kind=%s action=%s success=%s error=%s",
            normalized[:180],
            source_kind,
            action,
            False,
            "invalid_or_empty_source_url",
        )
        raise ShortDramaVideoProviderError(f"xAI reference prep: unsupported source URL: {normalized!r}")

    key = hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:24]
    fname = f"xai_ref_{key}.jpg"
    out_dir = ensure_xai_project_dir(project_id)
    out_path = out_dir / fname
    public_rel = public_xai_ready_url_path(project_id, fname)

    if out_path.is_file():
        logger.info(
            "[S4_REFERENCE_IMAGE_PREP] source_url_preview=%s source_kind=%s action=%s success=%s error=%s",
            normalized[:180],
            source_kind,
            "cached_local_file",
            True,
            "",
        )
        return public_rel

    try:
        im = _load_source_image(normalized, source_kind)
        im = _resize_longest_side(im, MAX_LONGEST_SIDE)
        _write_jpeg_with_size_cap(im, out_path)
        logger.info(
            "[S4_REFERENCE_IMAGE_PREP] source_url_preview=%s source_kind=%s action=%s success=%s error=%s",
            normalized[:180],
            source_kind,
            action,
            True,
            "",
        )
    except ShortDramaVideoProviderError:
        logger.error(
            "[S4_REFERENCE_IMAGE_PREP] source_url_preview=%s source_kind=%s action=%s success=%s error=%s",
            normalized[:180],
            source_kind,
            action,
            False,
            "provider_error",
        )
        raise
    except Exception as e:
        logger.exception("xAI reference prep: unexpected error source=%s", normalized)
        logger.error(
            "[S4_REFERENCE_IMAGE_PREP] source_url_preview=%s source_kind=%s action=%s success=%s error=%s",
            normalized[:180],
            source_kind,
            action,
            False,
            str(e)[:240],
        )
        raise ShortDramaVideoProviderError(f"xAI reference prep: failed to process image {normalized!r}: {e}") from e

    return public_rel


_REF_PROBE_CONNECT = 10.0
_REF_PROBE_READ = 30.0
_REF_PROBE_WRITE = 30.0
_REF_PROBE_POOL = 5.0


def probe_reference_image_url(url: str) -> tuple[bool, int, str]:
    """
    GET url; return (accessible, status_code, content_type).
    accessible is True only for HTTP 200 with content-type image/*.
    """
    u = (url or "").strip()
    if not u:
        return False, 0, ""
    timeout = httpx.Timeout(
        connect=_REF_PROBE_CONNECT,
        read=_REF_PROBE_READ,
        write=_REF_PROBE_WRITE,
        pool=_REF_PROBE_POOL,
    )
    try:
        with httpx.Client(
            timeout=timeout,
            http2=False,
            verify=True,
            follow_redirects=True,
        ) as client:
            with client.stream("GET", u) as resp:
                status = int(resp.status_code)
                ct = (resp.headers.get("content-type") or "").split(";")[0].strip().lower()
                for _ in resp.iter_bytes(chunk_size=65536):
                    break
    except Exception:
        return False, 0, ""
    ok = status == 200 and ct.startswith("image/")
    return ok, status, ct


def resolve_xai_reference_public_url(
    *,
    project_id: int,
    segment_id: int | str,
    source_url: str,
    xai_ready_relative_path: str,
) -> str:
    """
    Upload xAI-ready JPEG to R2 when configured, then pick the first publicly reachable URL:
    R2 public URL (if upload succeeded and GET probe passes), else static mount URL.
    """
    from ...utils.r2_storage import upload_file
    from .public_static_url import build_public_static_url

    static_url = build_public_static_url(xai_ready_relative_path)
    xai_local = local_path_from_xai_ready_public_url(xai_ready_relative_path)
    uploaded_key: str | None = None
    uploaded_public_url: str | None = None

    if xai_local.is_file():
        uploaded_key = f"short-drama/{project_id}/{xai_local.name}"
        logger.info(
            "[R2_UPLOAD_START] project_id=%s segment_id=%s file_path=%s key=%s",
            project_id,
            segment_id,
            str(xai_local.resolve()),
            uploaded_key,
        )
        try:
            uploaded_public_url = upload_file(str(xai_local.resolve()), uploaded_key)
            logger.info(
                "[R2_UPLOAD_SUCCESS] project_id=%s segment_id=%s key=%s url=%s",
                project_id,
                segment_id,
                uploaded_key,
                uploaded_public_url,
            )
        except Exception as e:
            logger.warning(
                "[R2_UPLOAD_FAIL] project_id=%s segment_id=%s file_path=%s key=%s exception_class=%s err=%s",
                project_id,
                segment_id,
                str(xai_local.resolve()),
                uploaded_key,
                type(e).__name__,
                str(e),
            )

    candidates: list[str] = []
    if uploaded_public_url:
        candidates.append(uploaded_public_url)
    if static_url not in candidates:
        candidates.append(static_url)

    final_reference_url: str | None = None
    reference_check_status_code = 0
    reference_check_content_type = ""

    for cand in candidates:
        ok, status, ct = probe_reference_image_url(cand)
        logger.info(
            "[XAI_REFERENCE_URL_CANDIDATE] project_id=%s segment_id=%s source_url=%s "
            "uploaded_key=%s uploaded_public_url=%s candidate_url=%s "
            "reference_check_status_code=%s reference_check_content_type=%s accessible=%s",
            project_id,
            segment_id,
            source_url,
            uploaded_key,
            uploaded_public_url,
            cand,
            status,
            ct,
            ok,
        )
        if ok:
            final_reference_url = cand
            reference_check_status_code = status
            reference_check_content_type = ct
            break

    if not final_reference_url:
        raise ShortDramaVideoProviderError(
            f"xAI reference image has no publicly reachable URL "
            f"(project_id={project_id}, segment_id={segment_id}, source_url={source_url!r})"
        )

    logger.info(
        "[XAI_REFERENCE_URL_RESOLVED] project_id=%s segment_id=%s source_url=%s "
        "uploaded_key=%s uploaded_public_url=%s final_reference_url=%s "
        "reference_check_status_code=%s reference_check_content_type=%s",
        project_id,
        segment_id,
        source_url,
        uploaded_key,
        uploaded_public_url,
        final_reference_url,
        reference_check_status_code,
        reference_check_content_type,
    )
    return final_reference_url
