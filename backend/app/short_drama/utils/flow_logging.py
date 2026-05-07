"""Structured Short Drama flow logs: API / orchestrator / AI (no prompts or full model bodies)."""

from __future__ import annotations

import logging
from typing import Any


def _safe_str(v: Any, max_len: int = 600) -> str:
    if v is None:
        return ""
    s = str(v).replace("\n", " ")
    if len(s) > max_len:
        return s[:max_len] + "…"
    return s


def _fmt_extra(**kwargs: Any) -> str:
    parts: list[str] = []
    for k, v in sorted(kwargs.items()):
        if v is None:
            continue
        parts.append(f"{k}={_safe_str(v, 400)}")
    return " ".join(parts)


def log_api_request(logger: logging.Logger, endpoint: str, **fields: Any) -> None:
    logger.info("[API_REQUEST] %s %s", endpoint, _fmt_extra(**fields))


def log_api_success(logger: logging.Logger, endpoint: str, **fields: Any) -> None:
    logger.info("[API_SUCCESS] %s %s", endpoint, _fmt_extra(**fields))


def log_api_error(logger: logging.Logger, endpoint: str, error: str, **fields: Any) -> None:
    logger.warning(
        "[API_ERROR] %s error=%s %s",
        endpoint,
        _safe_str(error, 900),
        _fmt_extra(**fields),
    )


def log_orchestrator(logger: logging.Logger, module: str, event: str, **fields: Any) -> None:
    logger.info("[ORCHESTRATOR][%s] %s %s", module, event, _fmt_extra(**fields))


# log_ai_request / log_ai_response：位置参数为 logger, provider, model；log_ai_error 另含 error。
# 将 log_context 展开进 **fields 前须去掉与位置参数同名的键（至少 provider、model）。
_AI_LOG_RESERVED_FOR_POSITIONAL = frozenset({"provider", "model"})


def ai_log_extra_from_context(log_context: dict[str, Any]) -> dict[str, Any]:
    """供 XAI/Gemini 等客户端把 log_context 并入 **fields 时使用，避免与 provider/model 位置参数冲突。"""
    return {k: v for k, v in log_context.items() if k not in _AI_LOG_RESERVED_FOR_POSITIONAL}


def log_ai_request(logger: logging.Logger, provider: str, model: str, **fields: Any) -> None:
    logger.info("[AI_REQUEST] provider=%s model=%s %s", provider, model, _fmt_extra(**fields))


def log_ai_response(logger: logging.Logger, provider: str, model: str, **fields: Any) -> None:
    logger.info("[AI_RESPONSE] provider=%s model=%s %s", provider, model, _fmt_extra(**fields))


def log_ai_error(logger: logging.Logger, provider: str, model: str, error: str, **fields: Any) -> None:
    logger.warning(
        "[AI_ERROR] provider=%s model=%s error=%s %s",
        provider,
        model,
        _safe_str(error, 800),
        _fmt_extra(**fields),
    )


def summarize_xai_responses_json(data: dict[str, Any]) -> str:
    keys = list(data.keys())[:20]
    rid = data.get("id")
    out = data.get("output")
    n_out = len(out) if isinstance(out, list) else None
    types: list[str] = []
    if isinstance(out, list):
        for item in out[:8]:
            if isinstance(item, dict) and item.get("type"):
                types.append(str(item.get("type")))
    bits = [f"keys={keys}", f"id={rid}", f"output_len={n_out}"]
    if types:
        bits.append(f"output_types={types}")
    return " ".join(str(b) for b in bits)


def summarize_gemini_generate_content_json(data: dict[str, Any]) -> str:
    cands = data.get("candidates")
    n = len(cands) if isinstance(cands, list) else 0
    keys = list(data.keys())[:15]
    return f"keys={keys} candidates_len={n}"
