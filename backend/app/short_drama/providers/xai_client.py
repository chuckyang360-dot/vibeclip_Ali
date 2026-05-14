from __future__ import annotations

import json
import logging
import time
from typing import Any

import httpx

from ...admin.api_logger import safe_log_api_call
from ...config import settings
from ..exceptions import ShortDramaProviderError
from ..utils.flow_logging import (
    ai_log_extra_from_context,
    log_ai_error,
    log_ai_request,
    log_ai_response,
    summarize_xai_responses_json,
)

logger = logging.getLogger(__name__)


def effective_xai_base_url() -> str:
    base = settings.XAI_BASE_URL or settings.XAI_API_URL
    return base.rstrip("/")


_DEFAULT_XAI_TEXT_MODEL = "grok-4.20"


def effective_xai_text_model() -> str:
    """Single source of truth: XAI_TEXT_MODEL → XAI_MODEL → default (non-reasoning fast)."""
    return settings.XAI_TEXT_MODEL or settings.XAI_MODEL or _DEFAULT_XAI_TEXT_MODEL


def effective_xai_story_model() -> str:
    """S2 Story Planner: XAI_STORY_MODEL when set, else global text model."""
    m = settings.XAI_STORY_MODEL
    if m is not None and str(m).strip():
        return str(m).strip()
    return effective_xai_text_model()


def effective_xai_story_max_output_tokens() -> int:
    v = int(settings.XAI_STORY_MAX_OUTPUT_TOKENS or 16384)
    return max(1024, v)


def extract_responses_api_model(response_json: dict[str, Any]) -> str:
    """Best-effort model id returned by xAI (may differ from request alias)."""
    m = response_json.get("model")
    if isinstance(m, str) and m.strip():
        return m.strip()
    return ""


def _truncate(s: str, max_len: int = 500) -> str:
    s = s or ""
    if len(s) <= max_len:
        return s
    return s[:max_len] + "…"


def _redact_image_url(raw: str) -> dict[str, Any]:
    text = str(raw or "").strip()
    if not text:
        return {
            "image_url_type": "unknown",
            "image_url_preview": "",
            "image_size_chars": 0,
        }
    image_url_type = "data_url" if text.startswith("data:image/") else "remote_url"
    preview = f"{text[:40]}...<redacted>"
    if len(preview) > 120:
        preview = preview[:120]
    return {
        "image_url_type": image_url_type,
        "image_url_preview": preview,
        "image_size_chars": len(text),
    }


def _summarize_input_payload_for_log(input_items: list[dict[str, Any]]) -> dict[str, Any]:
    summary: list[dict[str, Any]] = []
    for item in input_items:
        role = str(item.get("role") or "")
        content = item.get("content")
        row: dict[str, Any] = {"role": role, "content_type": type(content).__name__}
        if isinstance(content, list):
            type_counts: dict[str, int] = {}
            image_preview: list[dict[str, Any]] = []
            text_lengths: list[int] = []
            for part in content:
                if not isinstance(part, dict):
                    continue
                ptype = str(part.get("type") or "")
                type_counts[ptype] = type_counts.get(ptype, 0) + 1
                if ptype == "input_image":
                    raw = str(part.get("image_url") or "")
                    image_preview.append(_redact_image_url(raw))
                elif ptype == "input_text":
                    text_lengths.append(len(str(part.get("text") or "")))
            row["content_len"] = len(content)
            row["content_type_counts"] = type_counts
            row["image_inputs"] = {
                "image_count": len(image_preview),
                "items": image_preview,
            }
            row["input_text_summary"] = {
                "count": len(text_lengths),
                "total_chars": sum(text_lengths),
                "max_chars": max(text_lengths) if text_lengths else 0,
            }
        summary.append(row)
    return {"input": summary}


def extract_assistant_text(response_json: dict[str, Any]) -> str:
    """Parse xAI Responses API (and a few fallbacks) into assistant text."""
    parts: list[str] = []

    out = response_json.get("output")
    if isinstance(out, list):
        for item in out:
            if not isinstance(item, dict):
                continue
            if item.get("type") == "message" or item.get("role") == "assistant":
                content = item.get("content")
                if isinstance(content, str):
                    parts.append(content)
                elif isinstance(content, list):
                    for block in content:
                        if not isinstance(block, dict):
                            continue
                        btype = block.get("type")
                        if btype in ("output_text", "text", "input_text"):
                            t = block.get("text")
                            if isinstance(t, str):
                                parts.append(t)
                        elif "text" in block and isinstance(block["text"], str):
                            parts.append(block["text"])

    if parts:
        return "\n".join(parts).strip()

    # Some payloads may expose a top-level text field
    if isinstance(response_json.get("output_text"), str):
        return response_json["output_text"].strip()

    # Chat-completions style fallback
    choices = response_json.get("choices")
    if isinstance(choices, list) and choices:
        msg = choices[0].get("message") or {}
        c = msg.get("content")
        if isinstance(c, str):
            return c.strip()

    return ""


def summarize_output_message_content_types(response_json: dict[str, Any]) -> list[str]:
    """Return concise output message content type list for logging."""
    output = response_json.get("output")
    if not isinstance(output, list):
        return []
    out: list[str] = []
    for item in output:
        if not isinstance(item, dict):
            continue
        if item.get("type") != "message" and item.get("role") != "assistant":
            continue
        content = item.get("content")
        if isinstance(content, str):
            out.append("str")
            continue
        if isinstance(content, list):
            for block in content:
                if isinstance(block, dict):
                    out.append(str(block.get("type") or "dict"))
                else:
                    out.append(type(block).__name__)
    return out[:20]


class XAIClient:
    """Thin synchronous HTTP client for POST /v1/responses."""

    def __init__(
        self,
        *,
        api_key: str | None = None,
        base_url: str | None = None,
        timeout_seconds: float | None = None,
    ):
        self._api_key = api_key if api_key is not None else settings.XAI_API_KEY
        self._base_url = (base_url or effective_xai_base_url()).rstrip("/")
        self._timeout = float(
            timeout_seconds
            if timeout_seconds is not None
            else settings.SHORT_DRAMA_XAI_TEXT_TIMEOUT_SECONDS
        )

    def post_responses(
        self,
        *,
        model: str,
        system_prompt: str,
        user_content: list[dict[str, Any]],
        store: bool = False,
        max_output_tokens: int = 8192,
        log_context: dict[str, Any],
    ) -> tuple[dict[str, Any], str, int]:
        """
        Returns (response_json, request_id, latency_ms).
        """
        if not self._api_key:
            raise ShortDramaProviderError("XAI_API_KEY is not configured")

        url = f"{self._base_url}/responses"
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }

        user_message: dict[str, Any] = {"role": "user", "content": user_content}
        input_items: list[dict[str, Any]] = [user_message]

        body: dict[str, Any] = {
            "model": model,
            "input": input_items,
            "instructions": system_prompt,
            "store": store,
            "max_output_tokens": max_output_tokens,
        }

        prov = str(log_context.get("provider") or "grok")
        ukind = "parts"
        ulen = len(json.dumps(user_content, ensure_ascii=False))
        extra_ctx = ai_log_extra_from_context(log_context)
        input_summary = _summarize_input_payload_for_log(input_items)
        logger.info(
            "[XAI_PAYLOAD_SHAPE] provider=%s model=%s summary=%s",
            prov,
            model,
            json.dumps(input_summary, ensure_ascii=False),
        )
        log_ai_request(
            logger,
            provider=prov,
            model=model,
            **extra_ctx,
            timeout_seconds=self._timeout,
            system_prompt_len=len(system_prompt),
            user_content_kind=ukind,
            user_content_len=ulen,
            max_output_tokens=max_output_tokens,
        )

        t0 = time.perf_counter()
        last_err: Exception | None = None
        max_retries = max(0, int(settings.XAI_MAX_RETRIES))

        for attempt in range(max_retries + 1):
            try:
                with httpx.Client(timeout=self._timeout) as client:
                    resp = client.post(url, headers=headers, json=body)
                latency_ms = int((time.perf_counter() - t0) * 1000)
                req_id = resp.headers.get("x-request-id") or resp.headers.get("request-id")

                log_payload = {
                    **log_context,
                    "http_status": resp.status_code,
                    "latency_ms": latency_ms,
                    "attempt": attempt,
                    "request_id": req_id,
                    "model": model,
                    "system_prompt_len": len(system_prompt),
                    "user_content_kind": ukind,
                    "user_content_len": ulen,
                }
                if resp.status_code != 200:
                    snippet = _truncate(resp.text, 800)
                    safe_log_api_call(
                        user_id=log_context.get("user_id"),
                        project_id=log_context.get("project_id"),
                        business_type=str(log_context.get("business_type") or "other"),
                        provider="xAI",
                        model=model,
                        status="failed",
                        http_status=resp.status_code,
                        error_message=snippet,
                        duration_ms=latency_ms,
                        request_summary=input_summary,
                    )
                    log_ai_error(
                        logger,
                        provider=prov,
                        model=model,
                        error=f"HTTP {resp.status_code}",
                        **extra_ctx,
                        attempt=attempt,
                        body_snippet=snippet[:400],
                        payload_shape=input_summary,
                    )
                    raise ShortDramaProviderError(
                        f"xAI Responses API HTTP {resp.status_code}: {_truncate(resp.text, 400)}"
                    )

                try:
                    data = resp.json()
                except Exception as e:
                    log_ai_error(
                        logger,
                        provider=prov,
                        model=model,
                        error=f"invalid_json: {e}",
                        **extra_ctx,
                        attempt=attempt,
                    )
                    raise ShortDramaProviderError(f"xAI response body is not valid JSON: {e}") from e
                summary = summarize_xai_responses_json(data)
                log_ai_response(
                    logger,
                    provider=prov,
                    model=model,
                    **extra_ctx,
                    latency_ms=latency_ms,
                    attempt=attempt,
                    http_request_id=req_id,
                    response_id=str(data.get("id") or ""),
                    summary=summary,
                )
                safe_log_api_call(
                    user_id=log_context.get("user_id"),
                    project_id=log_context.get("project_id"),
                    business_type=str(log_context.get("business_type") or "other"),
                    provider="xAI",
                    model=model,
                    status="success",
                    http_status=resp.status_code,
                    duration_ms=latency_ms,
                    request_summary=input_summary,
                    response_summary=summary,
                )
                return data, str(data.get("id") or req_id or ""), latency_ms

            except ShortDramaProviderError:
                raise
            except httpx.TimeoutException as e:
                last_err = e
                latency_ms = int((time.perf_counter() - t0) * 1000)
                safe_log_api_call(
                    user_id=log_context.get("user_id"),
                    project_id=log_context.get("project_id"),
                    business_type=str(log_context.get("business_type") or "other"),
                    provider="xAI",
                    model=model,
                    status="timeout",
                    duration_ms=latency_ms,
                    error_message="timeout",
                    request_summary=input_summary,
                )
                log_ai_error(
                    logger,
                    provider=prov,
                    model=model,
                    error="timeout",
                    **extra_ctx,
                    latency_ms=latency_ms,
                    attempt=attempt,
                )
            except httpx.RequestError as e:
                last_err = e
                latency_ms = int((time.perf_counter() - t0) * 1000)
                safe_log_api_call(
                    user_id=log_context.get("user_id"),
                    project_id=log_context.get("project_id"),
                    business_type=str(log_context.get("business_type") or "other"),
                    provider="xAI",
                    model=model,
                    status="failed",
                    duration_ms=latency_ms,
                    error_message=f"network: {e}",
                    request_summary=input_summary,
                )
                log_ai_error(
                    logger,
                    provider=prov,
                    model=model,
                    error=f"network: {e}",
                    **extra_ctx,
                    latency_ms=latency_ms,
                    attempt=attempt,
                )

            if attempt >= max_retries:
                break
            t0 = time.perf_counter()

        log_ai_error(
            logger,
            provider=prov,
            model=model,
            error=f"exhausted_retries: {last_err}",
            **extra_ctx,
        )
        if isinstance(last_err, httpx.TimeoutException):
            raise ShortDramaProviderError("short_drama_provider_timeout")
        raise ShortDramaProviderError(f"xAI request failed after retries: {last_err}")
