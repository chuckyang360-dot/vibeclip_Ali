from __future__ import annotations

import base64
import logging
import time
from typing import Any

import httpx

from ...config import settings
from ..exceptions import ShortDramaImageProviderError
from ..utils.flow_logging import (
    ai_log_extra_from_context,
    log_ai_error,
    log_ai_request,
    log_ai_response,
    summarize_gemini_generate_content_json,
)

logger = logging.getLogger(__name__)

# Single default for Short Drama image generation (fast / high-throughput family).
_DEFAULT_GEMINI_IMAGE_MODEL = "gemini-2.5-flash-image"


def effective_gemini_base_url() -> str:
    base = settings.GEMINI_BASE_URL or settings.GEMINI_API_URL
    return base.rstrip("/")


def effective_gemini_image_model() -> str:
    """Single source of truth for Short Drama Gemini image model name."""
    m = (settings.GEMINI_IMAGE_MODEL or "").strip()
    return m or _DEFAULT_GEMINI_IMAGE_MODEL


def extract_first_image_from_generate_content(data: dict[str, Any]) -> tuple[bytes, str]:
    for cand in data.get("candidates") or []:
        if not isinstance(cand, dict):
            continue
        content = cand.get("content") or {}
        for part in content.get("parts") or []:
            if not isinstance(part, dict):
                continue
            inline = part.get("inlineData") or part.get("inline_data")
            if not isinstance(inline, dict):
                continue
            b64 = inline.get("data")
            if not b64:
                continue
            mime = inline.get("mimeType") or inline.get("mime_type") or "image/png"
            try:
                raw = base64.b64decode(b64, validate=False)
            except Exception as e:
                raise ShortDramaImageProviderError(f"Invalid base64 image data: {e}") from e
            if not raw:
                raise ShortDramaImageProviderError("Empty image bytes from Gemini")
            return raw, str(mime)
    raise ShortDramaImageProviderError("No image part in Gemini generateContent response")


class GeminiImageClient:
    """HTTP client for Gemini generateContent (IMAGE modality); no ORM."""

    def __init__(
        self,
        *,
        api_key: str | None = None,
        base_url: str | None = None,
        timeout_seconds: float | None = None,
    ):
        self._api_key = (api_key if api_key is not None else settings.GEMINI_API_KEY) or ""
        self._base_url = (base_url or effective_gemini_base_url()).rstrip("/")
        self._timeout = float(
            timeout_seconds if timeout_seconds is not None else settings.GEMINI_TIMEOUT_SECONDS
        )

    def generate_image_from_text(
        self,
        *,
        prompt: str,
        model: str | None = None,
        log_context: dict[str, Any],
    ) -> tuple[bytes, str]:
        if not self._api_key.strip():
            raise ShortDramaImageProviderError("GEMINI_API_KEY is not configured", category="auth")

        m = model or effective_gemini_image_model()
        endpoint = f"{self._base_url}/models/{m}:generateContent"
        body = {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {
                "responseModalities": ["TEXT", "IMAGE"],
                "temperature": 0.9,
            },
        }

        extra_ctx = ai_log_extra_from_context(log_context)
        log_ai_request(
            logger,
            provider="gemini_image",
            model=m,
            **extra_ctx,
            phase="generateContent",
            prompt_len=len(prompt or ""),
        )

        t0 = time.perf_counter()
        last_err: Exception | None = None
        max_retries = max(0, int(settings.GEMINI_MAX_RETRIES))

        for attempt in range(max_retries + 1):
            try:
                with httpx.Client(timeout=self._timeout) as client:
                    resp = client.post(endpoint, params={"key": self._api_key.strip()}, json=body)
                latency_ms = int((time.perf_counter() - t0) * 1000)

                if resp.status_code == 429:
                    log_ai_error(
                        logger,
                        provider="gemini_image",
                        model=m,
                        error="HTTP 429 quota",
                        **extra_ctx,
                        attempt=attempt,
                        body_snippet=resp.text[:400],
                    )
                    raise ShortDramaImageProviderError(
                        f"Gemini rate limit or quota (HTTP 429): {resp.text[:500]}"
                    )

                if resp.status_code != 200:
                    log_ai_error(
                        logger,
                        provider="gemini_image",
                        model=m,
                        error=f"HTTP {resp.status_code}",
                        **extra_ctx,
                        attempt=attempt,
                        body_snippet=resp.text[:400],
                    )
                    raise ShortDramaImageProviderError(
                        f"Gemini generateContent HTTP {resp.status_code}: {resp.text[:500]}"
                    )

                data = resp.json()
                try:
                    raw, mime = extract_first_image_from_generate_content(data)
                except ShortDramaImageProviderError as e:
                    log_ai_error(
                        logger,
                        provider="gemini_image",
                        model=m,
                        error=str(e),
                        **extra_ctx,
                        attempt=attempt,
                        summary=summarize_gemini_generate_content_json(data),
                    )
                    raise

                log_ai_response(
                    logger,
                    provider="gemini_image",
                    model=m,
                    **extra_ctx,
                    attempt=attempt,
                    latency_ms=latency_ms,
                    image_bytes=len(raw),
                    mime=mime,
                    summary=summarize_gemini_generate_content_json(data),
                )
                return raw, mime

            except ShortDramaImageProviderError:
                raise
            except httpx.TimeoutException as e:
                last_err = e
                log_ai_error(
                    logger,
                    provider="gemini_image",
                    model=m,
                    error="timeout",
                    **extra_ctx,
                    attempt=attempt,
                )
            except httpx.RequestError as e:
                last_err = e
                log_ai_error(
                    logger,
                    provider="gemini_image",
                    model=m,
                    error=f"network: {e}",
                    **extra_ctx,
                    attempt=attempt,
                )

            if attempt >= max_retries:
                break
            t0 = time.perf_counter()

        log_ai_error(
            logger,
            provider="gemini_image",
            model=m,
            error=f"exhausted_retries: {last_err}",
            **extra_ctx,
        )
        raise ShortDramaImageProviderError(f"Gemini image request failed after retries: {last_err}")
