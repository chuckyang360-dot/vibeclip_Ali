from __future__ import annotations

import logging
import time
import uuid
from typing import Any
from urllib.parse import urlencode

from ..config import settings

logger = logging.getLogger(__name__)

try:
    from alipay import AliPay  # type: ignore
except Exception:  # pragma: no cover
    AliPay = None  # type: ignore


def _normalize_pem(value: str | None) -> str | None:
    if not value:
        return None
    return value.replace("\\n", "\n").strip()


def _build_client() -> Any:
    if AliPay is None:
        raise RuntimeError("python-alipay-sdk is not installed")
    app_id = settings.ALIPAY_APP_ID
    private_key = _normalize_pem(settings.ALIPAY_PRIVATE_KEY)
    public_key = _normalize_pem(settings.ALIPAY_PUBLIC_KEY)
    if not app_id or not private_key or not public_key:
        raise RuntimeError("Alipay config is incomplete")
    return AliPay(
        appid=app_id,
        app_notify_url=settings.ALIPAY_NOTIFY_URL,
        app_private_key_string=private_key,
        alipay_public_key_string=public_key,
        sign_type=(settings.ALIPAY_SIGN_TYPE or "RSA2"),
        debug=bool("sandbox" in (settings.ALIPAY_GATEWAY or "").lower()),
    )


def generate_out_trade_no(user_id: int) -> str:
    return f"VC{user_id}{int(time.time())}{uuid.uuid4().hex[:8].upper()}"


def build_payment_return_url(out_trade_no: str) -> str | None:
    """Browser return after Alipay pay: {frontend}/billing/result?out_trade_no=..."""
    base = (settings.FRONTEND_URL or settings.FRONTEND_ORIGIN or "").strip().rstrip("/")
    if base:
        return f"{base}/billing/result?{urlencode({'out_trade_no': out_trade_no})}"
    legacy = (settings.ALIPAY_RETURN_URL or "").strip()
    if not legacy:
        return None
    if "/billing/result" in legacy:
        sep = "&" if "?" in legacy else "?"
        return f"{legacy}{sep}{urlencode({'out_trade_no': out_trade_no})}"
    legacy_base = legacy.split("?")[0].rstrip("/")
    return f"{legacy_base}/billing/result?{urlencode({'out_trade_no': out_trade_no})}"


def resolve_alipay_notify_url() -> str | None:
    """Async notify URL; prefer explicit ALIPAY_NOTIFY_URL, else BACKEND_PUBLIC_BASE_URL + path."""
    u = (settings.ALIPAY_NOTIFY_URL or "").strip()
    if u:
        return u
    base = (settings.BACKEND_PUBLIC_BASE_URL or "").strip().rstrip("/")
    if base:
        return f"{base}/api/billing/alipay/notify"
    return None


def create_page_pay_order(
    *,
    out_trade_no: str,
    amount: str,
    subject: str,
    body: str,
    return_url: str | None = None,
) -> dict[str, str]:
    alipay_client = _build_client()
    notify_url = resolve_alipay_notify_url() or settings.ALIPAY_NOTIFY_URL
    order_string = alipay_client.api_alipay_trade_page_pay(
        out_trade_no=out_trade_no,
        total_amount=amount,
        subject=subject,
        body=body,
        return_url=return_url or settings.ALIPAY_RETURN_URL,
        notify_url=notify_url,
    )
    gateway = (settings.ALIPAY_GATEWAY or "https://openapi.alipay.com/gateway.do").rstrip("?")
    pay_url = f"{gateway}?{order_string}"
    return {"pay_url": pay_url}


def verify_notify(data: dict[str, Any]) -> bool:
    """Return False on missing sign, bad signature, or any client/SDK/config error (never raises)."""
    try:
        try:
            alipay_client = _build_client()
        except Exception:
            logger.exception("[ALIPAY_NOTIFY_VERIFY_FAILED] client_init")
            return False
        sign = str(data.get("sign") or "")
        if not sign:
            return False
        payload = dict(data)
        payload.pop("sign", None)
        payload.pop("sign_type", None)
        try:
            return bool(alipay_client.verify(payload, sign))
        except Exception:
            logger.exception("[ALIPAY_NOTIFY_VERIFY_FAILED] verify_error")
            return False
    except Exception:
        logger.exception("[ALIPAY_NOTIFY_VERIFY_FAILED] unexpected")
        return False


def build_return_url_with_order_id(order_id: int) -> str | None:
    base = settings.ALIPAY_RETURN_URL
    if not base:
        return None
    sep = "&" if "?" in base else "?"
    return f"{base}{sep}{urlencode({'order_id': order_id})}"
