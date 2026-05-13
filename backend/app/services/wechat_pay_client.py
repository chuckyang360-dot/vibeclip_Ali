"""WeChat Pay API v3 — Native (QR) order creation and notify helpers."""
from __future__ import annotations

import base64
import json
import logging
import random
import string
import time
import uuid
from decimal import Decimal, ROUND_HALF_UP
from typing import Any

import httpx
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.serialization import load_pem_private_key

from ..config import settings

logger = logging.getLogger(__name__)

WECHAT_NATIVE_PATH = "/v3/pay/transactions/native"
WECHAT_CERTIFICATES_PATH = "/v3/certificates"
WECHAT_PAY_HOST = "https://api.mch.weixin.qq.com"

_cert_cache: dict[str, Any] = {"expires_at": 0.0, "serial_to_pubkey_pem": {}}


def normalize_wechat_private_key(raw: str) -> str:
    s = (raw or "").strip().replace("\\n", "\n")
    if "BEGIN" in s and "END" in s:
        return s
    body = s.strip()
    return f"-----BEGIN PRIVATE KEY-----\n{body}\n-----END PRIVATE KEY-----\n"


def build_wechat_notify_url() -> str | None:
    u = (settings.WECHAT_PAY_NOTIFY_URL or "").strip()
    if u:
        return u
    base = (settings.BACKEND_PUBLIC_BASE_URL or "").strip().rstrip("/")
    if base:
        return f"{base}/api/billing/wechat/notify"
    return None


def generate_wechat_out_trade_no(user_id: int) -> str:
    return f"WX{user_id}{int(time.time())}{uuid.uuid4().hex[:8].upper()}"


def _required_config_errors() -> list[str]:
    errs: list[str] = []
    if not settings.WECHAT_PAY_ENABLED:
        errs.append("WECHAT_PAY_ENABLED 未开启")
    if not (settings.WECHAT_PAY_APPID or "").strip():
        errs.append("缺少 WECHAT_PAY_APPID")
    if not (settings.WECHAT_PAY_MCHID or "").strip():
        errs.append("缺少 WECHAT_PAY_MCHID")
    key = (settings.WECHAT_PAY_API_V3_KEY or "").strip()
    if not key:
        errs.append("缺少 WECHAT_PAY_API_V3_KEY")
    elif len(key) != 32:
        errs.append("WECHAT_PAY_API_V3_KEY 长度必须为 32 字符")
    if not (settings.WECHAT_PAY_MCH_SERIAL_NO or "").strip():
        errs.append("缺少 WECHAT_PAY_MCH_SERIAL_NO")
    raw_pk = settings.WECHAT_PAY_PRIVATE_KEY
    if not (raw_pk or "").strip():
        errs.append("缺少 WECHAT_PAY_PRIVATE_KEY")
    else:
        try:
            normalize_wechat_private_key(str(raw_pk))
            load_pem_private_key(
                normalize_wechat_private_key(str(raw_pk)).encode("utf-8"),
                password=None,
            )
        except Exception:
            errs.append("WECHAT_PAY_PRIVATE_KEY 无法解析为 PEM 私钥")
    if not build_wechat_notify_url():
        errs.append("缺少支付回调地址：请配置 WECHAT_PAY_NOTIFY_URL 或 BACKEND_PUBLIC_BASE_URL")
    return errs


def list_wechat_pay_configuration_errors() -> list[str]:
    return _required_config_errors()


def assert_wechat_pay_configured() -> None:
    errs = _required_config_errors()
    if errs:
        raise RuntimeError("微信支付配置不完整：" + "；".join(errs))


def _load_merchant_private_key():
    pem = normalize_wechat_private_key(str(settings.WECHAT_PAY_PRIVATE_KEY or ""))
    return load_pem_private_key(pem.encode("utf-8"), password=None)


def _random_nonce() -> str:
    return "".join(random.choices(string.ascii_letters + string.digits, k=32))


def _build_authorization(*, method: str, url_path: str, body: str) -> str:
    mchid = (settings.WECHAT_PAY_MCHID or "").strip()
    serial = (settings.WECHAT_PAY_MCH_SERIAL_NO or "").strip()
    ts = str(int(time.time()))
    nonce = _random_nonce()
    sign_message = f"{method.upper()}\n{url_path}\n{ts}\n{nonce}\n{body}\n"
    pk = _load_merchant_private_key()
    sig = pk.sign(sign_message.encode("utf-8"), padding.PKCS1v15(), hashes.SHA256())
    sig_b64 = base64.b64encode(sig).decode("ascii")
    return (
        f'WECHATPAY2-SHA256-RSA2048 mchid="{mchid}",'
        f'nonce_str="{nonce}",timestamp="{ts}",serial_no="{serial}",'
        f'signature="{sig_b64}"'
    )


def _api_v3_key_bytes() -> bytes:
    return (settings.WECHAT_PAY_API_V3_KEY or "").strip().encode("utf-8")


def aes_gcm_decrypt(*, ciphertext_b64: str, nonce: str, associated_data: str) -> bytes:
    key = _api_v3_key_bytes()
    if len(key) != 32:
        raise ValueError("API v3 key must be 32 bytes")
    aes = AESGCM(key)
    raw = base64.b64decode(ciphertext_b64)
    return aes.decrypt(nonce.encode("utf-8"), raw, associated_data.encode("utf-8"))


def _refresh_platform_certificates_if_needed() -> dict[str, str]:
    now = time.time()
    if _cert_cache["serial_to_pubkey_pem"] and now < float(_cert_cache["expires_at"]):
        return _cert_cache["serial_to_pubkey_pem"]  # type: ignore[return-value]

    mchid = (settings.WECHAT_PAY_MCHID or "").strip()
    auth = _build_authorization(method="GET", url_path=WECHAT_CERTIFICATES_PATH, body="")
    url = f"{WECHAT_PAY_HOST}{WECHAT_CERTIFICATES_PATH}"
    with httpx.Client(timeout=30.0) as client:
        r = client.get(
            url,
            headers={
                "Accept": "application/json",
                "Authorization": auth,
                "User-Agent": "VibeClip-Backend-WeChatPay/1.0",
            },
        )
    r.raise_for_status()
    data = r.json()
    serial_map: dict[str, str] = {}
    for item in data.get("data") or []:
        sn = str(item.get("serial_no") or "")
        enc = item.get("encrypt_certificate") or {}
        if not sn or not isinstance(enc, dict):
            continue
        try:
            plain = aes_gcm_decrypt(
                ciphertext_b64=str(enc.get("ciphertext") or ""),
                nonce=str(enc.get("nonce") or ""),
                associated_data=str(enc.get("associated_data") or "certificate"),
            )
        except Exception:
            logger.exception("[WECHAT_CERT_DECRYPT_FAILED] serial_no=%s", sn[:16])
            continue
        cert = x509.load_pem_x509_certificate(plain)
        pub = cert.public_key().public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        )
        serial_map[sn] = pub.decode("ascii")
    if not serial_map:
        raise RuntimeError("未能获取微信平台证书公钥")
    _cert_cache["serial_to_pubkey_pem"] = serial_map
    _cert_cache["expires_at"] = now + 6 * 3600
    logger.info("[WECHAT_PLATFORM_CERTS_LOADED] count=%s mchid_tail=%s", len(serial_map), mchid[-4:] if mchid else "")
    return serial_map


def verify_notify_signature(
    *,
    wechatpay_timestamp: str,
    wechatpay_nonce: str,
    body_str: str,
    wechatpay_signature_b64: str,
    wechatpay_serial: str,
) -> bool:
    try:
        serial_map = _refresh_platform_certificates_if_needed()
    except Exception:
        logger.exception("[WECHAT_NOTIFY_VERIFY_FAILED] cert_fetch")
        return False
    pem = serial_map.get(wechatpay_serial)
    if not pem:
        logger.warning("[WECHAT_NOTIFY_VERIFY_FAILED] unknown_serial serial_prefix=%s", wechatpay_serial[:8])
        return False
    message = f"{wechatpay_timestamp}\n{wechatpay_nonce}\n{body_str}\n"
    try:
        pub = serialization.load_pem_public_key(pem.encode("utf-8"))
        sig = base64.b64decode(wechatpay_signature_b64)
        pub.verify(sig, message.encode("utf-8"), padding.PKCS1v15(), hashes.SHA256())
        return True
    except Exception:
        logger.exception("[WECHAT_NOTIFY_VERIFY_FAILED] rsa_verify serial_prefix=%s", wechatpay_serial[:8])
        return False


def amount_yuan_to_fen(amount: Decimal) -> int:
    q = amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return int((q * 100).to_integral_value(rounding=ROUND_HALF_UP))


def create_native_pay_order(
    *,
    out_trade_no: str,
    description: str,
    notify_url: str,
    amount_fen: int | None = None,
    amount_yuan: Decimal | None = None,
) -> dict[str, str]:
    """
    POST /v3/pay/transactions/native
    Returns dict with code_url and out_trade_no.
    """
    assert_wechat_pay_configured()
    if amount_fen is None:
        if amount_yuan is None:
            raise ValueError("amount_fen or amount_yuan required")
        amount_fen = amount_yuan_to_fen(amount_yuan)
    if amount_fen <= 0:
        raise ValueError("invalid amount")

    appid = (settings.WECHAT_PAY_APPID or "").strip()
    mchid = (settings.WECHAT_PAY_MCHID or "").strip()
    body_obj = {
        "appid": appid,
        "mchid": mchid,
        "description": description,
        "out_trade_no": out_trade_no,
        "notify_url": notify_url,
        "amount": {"total": int(amount_fen), "currency": "CNY"},
    }
    body = json.dumps(body_obj, separators=(",", ":"), ensure_ascii=False)
    auth = _build_authorization(method="POST", url_path=WECHAT_NATIVE_PATH, body=body)
    url = f"{WECHAT_PAY_HOST}{WECHAT_NATIVE_PATH}"
    with httpx.Client(timeout=30.0) as client:
        r = client.post(
            url,
            content=body.encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json",
                "Authorization": auth,
                "User-Agent": "VibeClip-Backend-WeChatPay/1.0",
            },
        )
    if r.status_code >= 400:
        try:
            err_j = r.json()
            code = err_j.get("code")
            msg = err_j.get("message")
            hint = f"{code or r.status_code}: {msg or r.text[:200]}"
        except Exception:
            hint = r.text[:200] if r.text else str(r.status_code)
        raise RuntimeError(f"微信下单失败：{hint}")
    j = r.json()
    code_url = j.get("code_url")
    if not code_url:
        raise RuntimeError("微信下单失败：响应缺少 code_url")
    return {"code_url": str(code_url), "out_trade_no": out_trade_no}


def decrypt_notify_resource(resource: dict[str, Any]) -> dict[str, Any]:
    """Decrypt resource.ciphertext from payment notify (API v3)."""
    algo = str(resource.get("algorithm") or "")
    if algo != "AEAD_AES_256_GCM":
        raise ValueError(f"unsupported algorithm: {algo}")
    plain = aes_gcm_decrypt(
        ciphertext_b64=str(resource.get("ciphertext") or ""),
        nonce=str(resource.get("nonce") or ""),
        associated_data=str(resource.get("associated_data") or ""),
    )
    return json.loads(plain.decode("utf-8"))


def parse_transaction_notify_payload(decrypted: dict[str, Any]) -> dict[str, Any]:
    out_trade_no = str(decrypted.get("out_trade_no") or "")
    transaction_id = str(decrypted.get("transaction_id") or "")
    trade_state = str(decrypted.get("trade_state") or "")
    amount = decrypted.get("amount") or {}
    total = amount.get("total")
    if total is None:
        total = amount.get("payer_total")
    return {
        "out_trade_no": out_trade_no,
        "transaction_id": transaction_id,
        "trade_state": trade_state,
        "amount_total_fen": int(total) if total is not None else None,
    }
