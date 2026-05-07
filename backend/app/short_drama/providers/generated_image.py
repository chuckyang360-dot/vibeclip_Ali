from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class GeneratedImage:
    """In-memory image bytes from any Short Drama image provider (caller persists via image_storage)."""

    data: bytes
    mime_type: str
    provider: str
    model: str
    meta: dict[str, Any] = field(default_factory=dict)
