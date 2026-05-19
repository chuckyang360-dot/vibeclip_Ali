"""User credits: balance, consumption, refunds, idempotency."""

from __future__ import annotations

import hashlib
import json
import logging
from dataclasses import dataclass
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import update
from sqlalchemy.orm import Session

from ..models import UserCreditAccount, UserCreditTransaction
from ..short_drama.models import ShortDramaProject

logger = logging.getLogger(__name__)

FREE_MONTHLY_GRANT = 100

CREDIT_COSTS: dict[str, int] = {
    "text_understanding": 3,
    "image_understanding": 5,
    "script_generation": 30,
    "image_asset_generation": 15,
    "segment_video_generation": 120,
    "hd_export": 20,
    "full_video_compose": 0,
}

CONSUME_TRANSACTION_TYPES: dict[str, str] = {
    "text_understanding": "text_understanding_consume",
    "image_understanding": "image_understanding_consume",
    "script_generation": "script_generation_consume",
    "image_asset_generation": "image_asset_generation_consume",
    "segment_video_generation": "segment_video_generation_consume",
    "hd_export": "hd_export_consume",
}

CONSUME_NOTE_ZH: dict[str, str] = {
    "text_understanding": "文本/链接理解",
    "image_understanding": "图片理解",
    "script_generation": "脚本生成与解析",
    "image_asset_generation": "图片资产生成",
    "segment_video_generation": "视频片段生成",
    "hd_export": "高清导出",
}


class InsufficientCreditsError(Exception):
    def __init__(self, *, required_credits: int, current_balance: int) -> None:
        self.required_credits = required_credits
        self.current_balance = current_balance
        super().__init__("insufficient credits")


def raise_insufficient_credits_http(required_credits: int, current_balance: int) -> None:
    raise HTTPException(
        status_code=status.HTTP_402_PAYMENT_REQUIRED,
        detail={
            "code": "INSUFFICIENT_CREDITS",
            "message": "您的积分不足，请充值",
            "required_credits": int(required_credits),
            "current_balance": int(current_balance),
        },
    )


def cost_for_code(cost_code: str, *, units: int = 1) -> int:
    unit = CREDIT_COSTS.get(cost_code, 0)
    if unit <= 0 or units <= 0:
        return 0
    return int(unit) * int(units)


def get_project_user_id(db: Session, project_id: int) -> int:
    row = db.query(ShortDramaProject.user_id).filter(ShortDramaProject.id == project_id).first()
    if not row or row[0] is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return int(row[0])


def get_or_create_credit_account(db: Session, user_id: int) -> UserCreditAccount:
    acc = db.query(UserCreditAccount).filter(UserCreditAccount.user_id == user_id).first()
    if acc is None:
        acc = UserCreditAccount(user_id=user_id, current_balance=0)
        db.add(acc)
        db.flush()
    return acc


def get_credit_balance(db: Session, user_id: int) -> int:
    acc = db.query(UserCreditAccount).filter(UserCreditAccount.user_id == user_id).first()
    return int(acc.current_balance or 0) if acc else 0


def _free_grant_already_issued(db: Session, user_id: int) -> bool:
    return (
        db.query(UserCreditTransaction.id)
        .filter(
            UserCreditTransaction.user_id == user_id,
            UserCreditTransaction.transaction_type == "free_monthly_grant",
        )
        .first()
        is not None
    )


def grant_free_starter_credits_if_needed(db: Session, user_id: int) -> bool:
    """One-time free 100 credits for new / legacy users without account."""
    if _free_grant_already_issued(db, user_id):
        get_or_create_credit_account(db, user_id)
        return False
    acc = get_or_create_credit_account(db, user_id)
    before = int(acc.current_balance or 0)
    after = before + FREE_MONTHLY_GRANT
    acc.current_balance = after
    acc.total_granted = int(acc.total_granted or 0) + FREE_MONTHLY_GRANT
    txn = UserCreditTransaction(
        user_id=user_id,
        transaction_type="free_monthly_grant",
        amount=FREE_MONTHLY_GRANT,
        balance_before=before,
        balance_after=after,
        related_object_type="free_starter",
        related_object_id=str(user_id),
        operator_type="system",
        note="免费版每月积分",
    )
    db.add(txn)
    db.flush()
    logger.info(
        "[CREDIT_FREE_GRANT] user_id=%s amount=%s balance_after=%s",
        user_id,
        FREE_MONTHLY_GRANT,
        after,
    )
    return True


def ensure_credit_balance(db: Session, user_id: int, required_credits: int) -> int:
    if required_credits <= 0:
        return get_credit_balance(db, user_id)
    grant_free_starter_credits_if_needed(db, user_id)
    balance = get_credit_balance(db, user_id)
    if balance < required_credits:
        raise InsufficientCreditsError(required_credits=required_credits, current_balance=balance)
    return balance


def ensure_project_credit_balance(db: Session, project_id: int, required_credits: int) -> int:
    user_id = get_project_user_id(db, project_id)
    return ensure_credit_balance(db, user_id, required_credits)


def _idempotency_already_charged(db: Session, user_id: int, idempotency_key: str) -> bool:
    return (
        db.query(UserCreditTransaction.id)
        .filter(
            UserCreditTransaction.user_id == user_id,
            UserCreditTransaction.related_object_type == "idempotency",
            UserCreditTransaction.related_object_id == idempotency_key,
        )
        .first()
        is not None
    )


@dataclass
class CreditDeductResult:
    charged: bool
    balance_after: int
    transaction_id: int | None


def deduct_credits(
    db: Session,
    *,
    user_id: int,
    amount: int,
    transaction_type: str,
    note: str,
    idempotency_key: str,
    project_id: int | None = None,
    cost_code: str | None = None,
) -> CreditDeductResult:
    if amount <= 0:
        bal = get_credit_balance(db, user_id)
        return CreditDeductResult(charged=False, balance_after=bal, transaction_id=None)

    if _idempotency_already_charged(db, user_id, idempotency_key):
        bal = get_credit_balance(db, user_id)
        return CreditDeductResult(charged=False, balance_after=bal, transaction_id=None)

    get_or_create_credit_account(db, user_id)
    stmt = (
        update(UserCreditAccount)
        .where(
            UserCreditAccount.user_id == user_id,
            UserCreditAccount.current_balance >= amount,
        )
        .values(
            current_balance=UserCreditAccount.current_balance - amount,
            total_consumed=UserCreditAccount.total_consumed + amount,
        )
    )
    result = db.execute(stmt)
    if (result.rowcount or 0) < 1:
        bal = get_credit_balance(db, user_id)
        raise InsufficientCreditsError(required_credits=amount, current_balance=bal)

    acc = db.query(UserCreditAccount).filter(UserCreditAccount.user_id == user_id).first()
    after = int(acc.current_balance or 0) if acc else 0
    before = after + amount
    txn = UserCreditTransaction(
        user_id=user_id,
        transaction_type=transaction_type,
        amount=-amount,
        balance_before=before,
        balance_after=after,
        related_object_type="idempotency",
        related_object_id=idempotency_key,
        project_id=project_id,
        operator_type="system",
        note=note,
    )
    db.add(txn)
    db.flush()
    logger.info(
        "[CREDIT_DEDUCT] user_id=%s project_id=%s type=%s amount=%s cost_code=%s key=%s balance_after=%s",
        user_id,
        project_id,
        transaction_type,
        amount,
        cost_code or "",
        idempotency_key[:120],
        after,
    )
    return CreditDeductResult(charged=True, balance_after=after, transaction_id=txn.id)


def refund_credits(
    db: Session,
    *,
    user_id: int,
    amount: int,
    idempotency_key: str,
    note: str,
    project_id: int | None = None,
) -> bool:
    if amount <= 0:
        return False
    refund_key = f"refund:{idempotency_key}"
    if _idempotency_already_charged(db, user_id, refund_key):
        return False
    acc = get_or_create_credit_account(db, user_id)
    before = int(acc.current_balance or 0)
    after = before + amount
    acc.current_balance = after
    acc.total_refunded = int(acc.total_refunded or 0) + amount
    txn = UserCreditTransaction(
        user_id=user_id,
        transaction_type="refund",
        amount=amount,
        balance_before=before,
        balance_after=after,
        related_object_type="idempotency",
        related_object_id=refund_key,
        project_id=project_id,
        operator_type="system",
        note=note,
    )
    db.add(txn)
    db.flush()
    return True


def charge_project(
    db: Session,
    *,
    project_id: int,
    cost_code: str,
    units: int = 1,
    idempotency_key: str,
    extra_note: str = "",
) -> CreditDeductResult:
    amount = cost_for_code(cost_code, units=units)
    if amount <= 0:
        user_id = get_project_user_id(db, project_id)
        bal = get_credit_balance(db, user_id)
        return CreditDeductResult(charged=False, balance_after=bal, transaction_id=None)
    user_id = get_project_user_id(db, project_id)
    txn_type = CONSUME_TRANSACTION_TYPES.get(cost_code, f"{cost_code}_consume")
    base_note = CONSUME_NOTE_ZH.get(cost_code, cost_code)
    note = f"{base_note}{extra_note}" if extra_note else base_note
    return deduct_credits(
        db,
        user_id=user_id,
        amount=amount,
        transaction_type=txn_type,
        note=note,
        idempotency_key=idempotency_key,
        project_id=project_id,
        cost_code=cost_code,
    )


def require_project_credits(db: Session, project_id: int, cost_code: str, *, units: int = 1) -> None:
    amount = cost_for_code(cost_code, units=units)
    if amount <= 0:
        return
    try:
        ensure_project_credit_balance(db, project_id, amount)
    except InsufficientCreditsError as e:
        raise_insufficient_credits_http(e.required_credits, e.current_balance)


def stable_hash_payload(payload: Any) -> str:
    raw = json.dumps(payload, sort_keys=True, ensure_ascii=False, default=str)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:24]


def s1_product_parse_required_credits(*, has_text: bool, image_count: int) -> int:
    total = 0
    if has_text:
        total += cost_for_code("text_understanding")
    if image_count > 0:
        total += cost_for_code("image_understanding", units=image_count)
    return total


def count_assets_missing_images(db: Session, project_id: int) -> int:
    from ..short_drama.services.read_models import list_asset_rows

    chars, scenes, products = list_asset_rows(db, project_id)
    missing = 0
    for row in (*chars, *scenes, *products):
        if not str(getattr(row, "image_url", None) or "").strip():
            missing += 1
    return missing


def count_segments_pending_video(db: Session, project_id: int) -> int:
    from ..short_drama.services.read_models import list_segment_scripts

    pending = 0
    for rec in list_segment_scripts(db, project_id):
        script = rec.script_json if isinstance(rec.script_json, dict) else {}
        vr = script.get("video_render") if isinstance(script.get("video_render"), dict) else {}
        url = str((vr or {}).get("video_url") or "").strip()
        if not url:
            pending += 1
    return pending
