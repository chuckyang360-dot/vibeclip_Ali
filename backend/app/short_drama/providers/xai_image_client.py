from __future__ import annotations

import base64
from typing import Any

import httpx

from ...config import settings
from ..exceptions import ShortDramaImageProviderError
from .xai_client import effective_xai_base_url

_DEFAULT_XAI_IMAGE_MODEL = "grok-imagine-image"


def effective_xai_image_model() -> str:
    m = (settings.SHORT_DRAMA_XAI_IMAGE_MODEL or "").strip()
    return m or _DEFAULT_XAI_IMAGE_MODEL


def _map_http_to_category(status_code: int, body_snippet: str) -> str:
    if status_code in (401, 403):
        return "auth"
    if status_code == 429:
        return "rate_limit"
    if status_code == 402:
        return "quota"
    low = body_snippet.lower()
    if "quota" in low or "insufficient" in low or "billing" in low or "credit" in low:
        return "quota"
    if "rate" in low and "limit" in low:
        return "rate_limit"
    return "provider"


class XaiImageClient:
    """POST /v1/images/generations (OpenAI-compatible) + download temporary URLs."""

    def __init__(
        self,
        *,
        api_key: str | None = None,
        base_url: str | None = None,
        timeout_seconds: float | None = None,
    ):
        self._api_key = (api_key if api_key is not None else settings.XAI_API_KEY) or ""
        self._base_url = (base_url or effective_xai_base_url()).rstrip("/")
        self._timeout = float(
            timeout_seconds if timeout_seconds is not None else settings.XAI_TIMEOUT_SECONDS
        )

    def create_image_from_text(
        self,
        *,
        prompt: str,
        model: str | None = None,
        response_format: str | None = None,
        aspect_ratio: str | None = None,
        resolution: str | None = None,
    ) -> tuple[str | None, str | None, bytes | None]:
        """
        Returns (image_url_or_none, b64_json_or_none, raw_bytes_or_none).
        For response_format=url: first field set; for b64_json: second + third after decode.
        """
        if not self._api_key.strip():
            raise ShortDramaImageProviderError(
                "XAI_API_KEY is not configured",
                category="auth",
            )

        m = model or effective_xai_image_model()
        fmt = (response_format or settings.SHORT_DRAMA_IMAGE_RETURN_FORMAT or "url").strip().lower()
        ar = (aspect_ratio or settings.SHORT_DRAMA_IMAGE_ASPECT_RATIO or "").strip() or None
        res = (resolution or settings.SHORT_DRAMA_IMAGE_RESOLUTION or "").strip() or None

        body: dict[str, Any] = {
            "model": m,
            "prompt": prompt,
            "n": 1,
            "response_format": fmt,
        }
        if ar:
            body["aspect_ratio"] = ar
        if res:
            body["resolution"] = res

        url = f"{self._base_url}/images/generations"
        headers = {
            "Authorization": f"Bearer {self._api_key.strip()}",
            "Content-Type": "application/json",
        }

        with httpx.Client(timeout=self._timeout) as client:
            resp = client.post(url, headers=headers, json=body)

        snippet = (resp.text or "")[:600]
        if resp.status_code == 401 or resp.status_code == 403:
            raise ShortDramaImageProviderError(
                f"xAI image auth failed HTTP {resp.status_code}: {snippet}",
                category="auth",
            )
        if resp.status_code == 429:
            raise ShortDramaImageProviderError(
                f"xAI image rate limited HTTP 429: {snippet}",
                category="rate_limit",
            )
        if resp.status_code == 402:
            raise ShortDramaImageProviderError(
                f"xAI image quota/billing HTTP 402: {snippet}",
                category="quota",
            )
        if resp.status_code != 200:
            cat = _map_http_to_category(resp.status_code, snippet)
            raise ShortDramaImageProviderError(
                f"xAI image generation HTTP {resp.status_code}: {snippet}",
                category=cat,
            )

        try:
            data = resp.json()
        except Exception as e:
            raise ShortDramaImageProviderError(
                f"xAI response invalid (not JSON): {e}; body={snippet}",
                category="xai_response_invalid",
            ) from e

        items = data.get("data")
        if not isinstance(items, list) or not items:
            raise ShortDramaImageProviderError(
                f"xAI response invalid: missing data[]; keys={list(data.keys())[:20]}",
                category="xai_response_invalid",
            )

        first = items[0]
        if not isinstance(first, dict):
            raise ShortDramaImageProviderError(
                "xAI response invalid: data[0] is not an object",
                category="xai_response_invalid",
            )

        if fmt == "b64_json":
            b64 = first.get("b64_json")
            if not isinstance(b64, str) or not b64.strip():
                raise ShortDramaImageProviderError(
                    "xAI response invalid: missing b64_json",
                    category="xai_response_invalid",
                )
            try:
                raw = base64.b64decode(b64, validate=False)
            except Exception as e:
                raise ShortDramaImageProviderError(
                    f"xAI response invalid: bad b64_json: {e}",
                    category="xai_response_invalid",
                ) from e
            if not raw:
                raise ShortDramaImageProviderError(
                    "xAI response invalid: empty image bytes from b64_json",
                    category="xai_response_invalid",
                )
            return None, b64, raw

        u = first.get("url")
        if not isinstance(u, str) or not u.strip():
            raise ShortDramaImageProviderError(
                "xAI response invalid: missing url in data[0]",
                category="xai_response_invalid",
            )
        return u.strip(), None, None

    def download_url(self, image_url: str) -> tuple[bytes, str]:
        """Fetch bytes from temporary CDN URL; returns (data, mime_type)."""
        try:
            with httpx.Client(timeout=self._timeout, follow_redirects=True) as client:
                r = client.get(image_url)
        except httpx.RequestError as e:
            raise ShortDramaImageProviderError(
                f"download failed: network error fetching image url: {e}",
                category="download_failed",
            ) from e

        if r.status_code != 200:
            raise ShortDramaImageProviderError(
                f"download failed: HTTP {r.status_code} for image url",
                category="download_failed",
            )

        mime = "image/png"
        ct = r.headers.get("content-type")
        if ct and "image/" in ct.lower():
            mime = ct.split(";")[0].strip()

        data = r.content
        if not data:
            raise ShortDramaImageProviderError(
                "download failed: empty response body",
                category="download_failed",
            )
        return data, mime
