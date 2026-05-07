"""Safe extraction of JSON objects from model output (fences, noise)."""

from __future__ import annotations

import json
import re
from typing import Any

from ..exceptions import ShortDramaInvalidModelOutputError

_FENCE_RE = re.compile(r"```(?:json)?\s*([\s\S]*?)```", re.IGNORECASE)


def strip_json_code_fences(text: str) -> str:
    text = (text or "").strip()
    m = _FENCE_RE.search(text)
    if m:
        return m.group(1).strip()
    return text


def parse_json_object(text: str) -> dict[str, Any]:
    """Parse a single JSON object from model text; raise ShortDramaInvalidModelOutputError on failure."""
    cleaned = strip_json_code_fences(text)
    if not cleaned:
        raise ShortDramaInvalidModelOutputError("Empty model output")
    try:
        val = json.loads(cleaned)
    except json.JSONDecodeError as e:
        raise ShortDramaInvalidModelOutputError(f"Invalid JSON: {e}") from e
    if not isinstance(val, dict):
        raise ShortDramaInvalidModelOutputError("Model output is not a JSON object")
    return val


def try_parse_json_object(text: str) -> dict[str, Any] | None:
    try:
        return parse_json_object(text)
    except ShortDramaInvalidModelOutputError:
        return None
