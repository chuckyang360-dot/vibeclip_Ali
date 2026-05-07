from __future__ import annotations

import json
import logging
import time
from typing import Any

from ..exceptions import ShortDramaInvalidModelOutputError, ShortDramaProviderError
from ..utils.flow_logging import log_ai_error, log_ai_response
from ..utils.json_parser import try_parse_json_object
from ..utils.prompts import JSON_REPAIR_SYSTEM_PROMPT
from .xai_client import (
    XAIClient,
    effective_xai_text_model,
    extract_assistant_text,
    summarize_output_message_content_types,
)

logger = logging.getLogger(__name__)


def _trace(tag: str, payload: dict[str, Any]) -> None:
    logger.info("[AI_CHAIN_TRACE][%s] %s", tag, json.dumps(payload, ensure_ascii=False, default=str))


def _preview(text: str, *, max_len: int = 500) -> str:
    cleaned = str(text or "").replace("\n", " ").strip()
    if len(cleaned) <= max_len:
        return cleaned
    return cleaned[:max_len] + "…"


def _build_user_content_parts(user_text: str, image_urls: list[str] | None) -> list[dict[str, Any]]:
    parts: list[dict[str, Any]] = []
    for u in image_urls or []:
        if not u or not str(u).strip():
            continue
        parts.append({"type": "input_image", "image_url": str(u).strip()})
    parts.append({"type": "input_text", "text": user_text})
    return parts


class XAITextProvider:
    """Calls xAI Responses API and returns a parsed JSON object (no DB)."""

    def __init__(self, client: XAIClient | None = None):
        self._client = client or XAIClient()

    def generate_structured_json(
        self,
        *,
        project_id: int,
        service_name: str,
        system_prompt: str,
        user_payload: dict[str, Any],
        image_urls: list[str] | None = None,
        expected_schema_name: str,
        stage: str,
        max_output_tokens: int = 8192,
    ) -> dict[str, Any]:
        model = effective_xai_text_model()
        user_text = json.dumps(user_payload, ensure_ascii=False)
        user_content = _build_user_content_parts(user_text, image_urls)

        t0 = time.perf_counter()
        try:
            raw, request_id, _latency = self._client.post_responses(
                model=model,
                system_prompt=system_prompt,
                user_content=user_content,
                store=False,
                max_output_tokens=max_output_tokens,
                log_context={
                    "project_id": project_id,
                    "service_name": service_name,
                    "stage": stage,
                    "provider": "grok",
                    "model": model,
                },
            )
            text = extract_assistant_text(raw)
            if stage == "STORY_GENERATION":
                _trace(
                    "S2_RAW_RESPONSE",
                    {
                        "project_id": project_id,
                        "service_name": service_name,
                        "request_id": request_id,
                        "raw_response": raw,
                        "assistant_text": text,
                    },
                )
            extracted_text_len = len(text or "")
            response_status = raw.get("status")
            response_incomplete_details = raw.get("incomplete_details")
            output_content_types = summarize_output_message_content_types(raw)
            logger.info(
                "[STRUCTURED_OUTPUT_EXTRACTED] project_id=%s service_name=%s stage=%s extracted_text_len=%s extracted_text_preview=%s response_status=%s response_incomplete_details=%s output_message_content_types=%s",
                project_id,
                service_name,
                stage,
                extracted_text_len,
                _preview(text),
                response_status,
                response_incomplete_details,
                output_content_types,
            )
            if response_incomplete_details:
                logger.warning(
                    "[STRUCTURED_OUTPUT_INCOMPLETE] project_id=%s service_name=%s stage=%s incomplete_details=%s",
                    project_id,
                    service_name,
                    stage,
                    response_incomplete_details,
                )
                reason = ""
                if isinstance(response_incomplete_details, dict):
                    reason = str(response_incomplete_details.get("reason") or "").strip().lower()
                if reason == "max_output_tokens":
                    logger.warning(
                        "[STRUCTURED_OUTPUT_MAX_TOKENS_EXHAUSTED] project_id=%s service_name=%s stage=%s reason=%s",
                        project_id,
                        service_name,
                        stage,
                        reason,
                    )
            duration_ms = int((time.perf_counter() - t0) * 1000)
            if _is_empty_or_too_short_structured_text(text):
                logger.warning(
                    "[STRUCTURED_OUTPUT_EMPTY_OR_TOO_SHORT] project_id=%s service_name=%s stage=%s extracted_text_len=%s extracted_text_preview=%s",
                    project_id,
                    service_name,
                    stage,
                    extracted_text_len,
                    _preview(text),
                )
                raise ShortDramaInvalidModelOutputError("structured output empty or too short")
            data = self._parse_with_optional_repair(
                text=text,
                project_id=project_id,
                service_name=service_name,
                stage=stage,
                model=model,
                request_id=request_id,
                duration_ms=duration_ms,
                expected_schema_name=expected_schema_name,
            )
            log_ai_response(
                logger,
                "grok",
                model,
                project_id=project_id,
                stage=stage,
                service_name=service_name,
                phase="structured_json_ready",
                top_keys=list(data.keys())[:24],
                duration_ms=int((time.perf_counter() - t0) * 1000),
                request_id=request_id,
            )
            return data
        except ShortDramaProviderError:
            raise
        except ShortDramaInvalidModelOutputError as e:
            duration_ms = int((time.perf_counter() - t0) * 1000)
            log_ai_error(
                logger,
                "grok",
                model,
                str(e),
                project_id=project_id,
                stage=stage,
                service_name=service_name,
                duration_ms=duration_ms,
                error_type=type(e).__name__,
            )
            raise

    def _parse_with_optional_repair(
        self,
        *,
        text: str,
        project_id: int,
        service_name: str,
        stage: str,
        model: str,
        request_id: str,
        duration_ms: int,
        expected_schema_name: str,
    ) -> dict[str, Any]:
        """Original output + up to 2 repair passes (3 model outputs total for JSON text)."""
        if _is_empty_or_too_short_structured_text(text):
            logger.warning(
                "[STRUCTURED_OUTPUT_EMPTY_OR_TOO_SHORT] project_id=%s service_name=%s stage=%s extracted_text_len=%s extracted_text_preview=%s",
                project_id,
                service_name,
                stage,
                len(text or ""),
                _preview(text),
            )
            raise ShortDramaInvalidModelOutputError("structured output empty or too short")
        parsed = try_parse_json_object(text)
        if parsed is not None and parsed.get("error") != "unrecoverable":
            if stage == "STORY_GENERATION":
                _trace(
                    "S2_JSON_REPAIR_SKIPPED",
                    {"project_id": project_id, "service_name": service_name, "reason": "json_parse_success"},
                )
            return parsed

        current = text
        for repair_attempt in (1, 2):
            repair_user = _truncate_for_repair(current)
            if stage == "STORY_GENERATION":
                _trace(
                    "S2_JSON_REPAIR_PROMPT",
                    {
                        "project_id": project_id,
                        "service_name": service_name,
                        "repair_attempt": repair_attempt,
                        "system_prompt": JSON_REPAIR_SYSTEM_PROMPT,
                        "user_payload": repair_user,
                    },
                )
            repair_content = [{"type": "input_text", "text": repair_user}]
            raw2, req2, _ = self._client.post_responses(
                model=model,
                system_prompt=JSON_REPAIR_SYSTEM_PROMPT,
                user_content=repair_content,
                store=False,
                max_output_tokens=4096,
                log_context={
                    "project_id": project_id,
                    "service_name": service_name,
                    "stage": f"{stage}_json_repair_{repair_attempt}",
                    "provider": "grok",
                    "model": model,
                    "repair_attempt": repair_attempt,
                    "schema_name": expected_schema_name,
                },
            )
            text2 = extract_assistant_text(raw2)
            if stage == "STORY_GENERATION":
                _trace(
                    "S2_JSON_REPAIR_RESPONSE",
                    {
                        "project_id": project_id,
                        "service_name": service_name,
                        "repair_attempt": repair_attempt,
                        "request_id": req2,
                        "raw_response": raw2,
                        "assistant_text": text2,
                    },
                )
            current = text2
            parsed = try_parse_json_object(text2)
            if parsed is not None:
                if parsed.get("error") == "unrecoverable":
                    continue
                return parsed

        raise ShortDramaInvalidModelOutputError(
            f"JSON repair exhausted after 2 attempts for {service_name} (schema={expected_schema_name})"
        )


def _truncate_for_repair(text: str, max_chars: int = 24000) -> str:
    text = text.strip()
    if len(text) <= max_chars:
        return text
    return text[:max_chars] + "\n…(truncated)…"


def _is_empty_or_too_short_structured_text(text: str | None) -> bool:
    cleaned = (text or "").strip()
    if not cleaned:
        return True
    if cleaned in {"{}", "[]"}:
        return True
    return len(cleaned) < 20


_xai_text_provider_singleton: XAITextProvider | None = None


def get_xai_text_provider() -> XAITextProvider:
    global _xai_text_provider_singleton
    if _xai_text_provider_singleton is None:
        _xai_text_provider_singleton = XAITextProvider()
    return _xai_text_provider_singleton
