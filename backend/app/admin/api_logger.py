from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any

from ..database import SessionLocal
from ..models import ApiCallLog

logger = logging.getLogger(__name__)


def _to_int(v: Any) -> int | None:
    try:
        if v is None:
            return None
        return int(v)
    except Exception:
        return None


def _safe_json_text(v: Any, limit: int = 3000) -> str | None:
    if v is None:
        return None
    if isinstance(v, str):
        text = v
    else:
        text = json.dumps(v, ensure_ascii=False, default=str)
    return text[:limit]


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def safe_log_api_call(
    *,
    user_id: int | None = None,
    project_id: int | None = None,
    business_type: str = "other",
    provider: str = "Other",
    model: str | None = None,
    status: str = "success",
    http_status: int | None = None,
    error_code: str | None = None,
    error_message: str | None = None,
    duration_ms: int | None = None,
    estimated_cost_usd: float | None = None,
    estimated_cost_cny: float | None = None,
    request_summary: Any | None = None,
    response_summary: Any | None = None,
    file_size: int | None = None,
    object_key: str | None = None,
    started_at: datetime | None = None,
    finished_at: datetime | None = None,
) -> None:
    """Best-effort API log insertion. Never raises."""
    db = SessionLocal()
    try:
        row = ApiCallLog(
            user_id=_to_int(user_id),
            project_id=_to_int(project_id),
            business_type=business_type or "other",
            provider=provider or "Other",
            model=(model or "")[:255] or None,
            status=(status or "success")[:50],
            http_status=_to_int(http_status),
            error_code=(error_code or "")[:128] or None,
            error_message=(error_message or "")[:3000] or None,
            duration_ms=_to_int(duration_ms),
            estimated_cost_usd=estimated_cost_usd,
            estimated_cost_cny=estimated_cost_cny,
            request_summary=_safe_json_text(request_summary),
            response_summary=_safe_json_text(response_summary),
            file_size=_to_int(file_size),
            object_key=(object_key or "")[:512] or None,
            started_at=started_at,
            finished_at=finished_at or _now_utc(),
        )
        db.add(row)
        db.commit()
    except Exception:
        db.rollback()
        logger.warning("[ADMIN_API_LOG_INSERT_FAILED]", exc_info=True)
    finally:
        db.close()
