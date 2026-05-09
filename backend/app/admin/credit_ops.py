from __future__ import annotations

import json
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from ..models import AdminOperationLog, User, UserCreditAccount, UserCreditTransaction


def _get_or_create_account(db: Session, user_id: int) -> UserCreditAccount:
    acc = db.query(UserCreditAccount).filter(UserCreditAccount.user_id == user_id).first()
    if acc is None:
        acc = UserCreditAccount(user_id=user_id)
        db.add(acc)
        db.flush()
    return acc


def admin_grant_credits(
    db: Session,
    *,
    target_user: User,
    admin: User,
    amount: int,
    reason: str,
    ip_address: str | None,
) -> int:
    if amount <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="amount must be positive")
    acc = _get_or_create_account(db, target_user.id)
    before = int(acc.current_balance or 0)
    after = before + amount
    acc.current_balance = after
    acc.total_granted = int(acc.total_granted or 0) + amount

    txn = UserCreditTransaction(
        user_id=target_user.id,
        transaction_type="admin_grant",
        amount=amount,
        balance_before=before,
        balance_after=after,
        operator_type="admin",
        operator_admin_id=admin.id,
        note=reason,
    )
    db.add(txn)
    db.flush()

    op = AdminOperationLog(
        operator_admin_id=admin.id,
        operator_email=admin.email,
        action="grant_credits",
        target_type="user",
        target_id=str(target_user.id),
        before_data=json.dumps({"credit_balance": before}, ensure_ascii=False),
        after_data=json.dumps({"credit_balance": after, "grant_amount": amount}, ensure_ascii=False),
        reason=reason,
        ip_address=ip_address,
    )
    db.add(op)
    return after


def admin_deduct_credits(
    db: Session,
    *,
    target_user: User,
    admin: User,
    amount: int,
    reason: str,
    ip_address: str | None,
) -> int:
    if amount <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="amount must be positive")
    acc = db.query(UserCreditAccount).filter(UserCreditAccount.user_id == target_user.id).first()
    before = int(acc.current_balance or 0) if acc else 0
    if before < amount:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Insufficient credit balance",
        )
    after = before - amount
    if acc is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Insufficient credit balance")
    acc.current_balance = after
    acc.total_consumed = int(acc.total_consumed or 0) + amount

    txn = UserCreditTransaction(
        user_id=target_user.id,
        transaction_type="admin_deduct",
        amount=-amount,
        balance_before=before,
        balance_after=after,
        operator_type="admin",
        operator_admin_id=admin.id,
        note=reason,
    )
    db.add(txn)
    db.flush()

    op = AdminOperationLog(
        operator_admin_id=admin.id,
        operator_email=admin.email,
        action="deduct_credits",
        target_type="user",
        target_id=str(target_user.id),
        before_data=json.dumps({"credit_balance": before}, ensure_ascii=False),
        after_data=json.dumps({"credit_balance": after, "deduct_amount": amount}, ensure_ascii=False),
        reason=reason,
        ip_address=ip_address,
    )
    db.add(op)
    return after


def serialize_account(acc: UserCreditAccount | None) -> dict[str, Any]:
    if acc is None:
        return {
            "current_balance": 0,
            "total_granted": 0,
            "total_consumed": 0,
            "total_refunded": 0,
        }
    return {
        "current_balance": int(acc.current_balance or 0),
        "total_granted": int(acc.total_granted or 0),
        "total_consumed": int(acc.total_consumed or 0),
        "total_refunded": int(acc.total_refunded or 0),
    }
