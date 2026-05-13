"""Subscription fulfillment after Alipay notify (credits + idempotency)."""
from __future__ import annotations

import calendar
import logging
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy.orm import Session

from ..models import PaymentOrder, User, UserCreditAccount, UserCreditTransaction

logger = logging.getLogger(__name__)

# Mirrors frontend SUBSCRIPTION_PLANS creditsPerMonth (do not change product entitlements here).
PLAN_MONTHLY_CREDITS: dict[str, int] = {
    "basic": 1000,
    "standard": 3000,
    "pro": 8000,
}


def _days_in_month(year: int, month: int) -> int:
    return calendar.monthrange(year, month)[1]


def add_calendar_months(utc: datetime, months: int) -> datetime:
    """Preserve day-of-month when possible (UTC)."""
    y = utc.year
    m = utc.month + months
    while m > 12:
        m -= 12
        y += 1
    while m < 1:
        m += 12
        y -= 1
    d = min(utc.day, _days_in_month(y, m))
    return utc.replace(year=y, month=m, day=d)


def subscription_period_end_utc(start: datetime, period: str) -> datetime:
    if period == "yearly":
        return add_calendar_months(start, 12)
    return add_calendar_months(start, 1)


def credits_to_grant_on_first_payment(plan_code: str, period: str) -> int:
    monthly = PLAN_MONTHLY_CREDITS.get(plan_code, 0)
    if monthly <= 0:
        return 0
    if period == "yearly":
        return monthly * 12
    return monthly


def _get_or_create_credit_account(db: Session, user_id: int) -> UserCreditAccount:
    acc = db.query(UserCreditAccount).filter(UserCreditAccount.user_id == user_id).first()
    if acc is None:
        acc = UserCreditAccount(user_id=user_id)
        db.add(acc)
        db.flush()
    return acc


def already_granted_for_payment_order(db: Session, order_id: int) -> bool:
    return (
        db.query(UserCreditTransaction)
        .filter(
            UserCreditTransaction.related_object_type == "payment_order",
            UserCreditTransaction.related_object_id == str(order_id),
            UserCreditTransaction.transaction_type == "subscription_grant",
        )
        .first()
        is not None
    )


def grant_subscription_credits_if_needed(db: Session, *, order: PaymentOrder, user: User) -> None:
    if already_granted_for_payment_order(db, order.id):
        return
    amount = credits_to_grant_on_first_payment(order.plan_code, order.period)
    if amount <= 0:
        logger.warning(
            "[SUBSCRIPTION_ACTIVATED] skip credits grant unknown plan plan_code=%s order_id=%s",
            order.plan_code,
            order.id,
        )
        return
    acc = _get_or_create_credit_account(db, user.id)
    before = int(acc.current_balance or 0)
    after = before + amount
    acc.current_balance = after
    acc.total_granted = int(acc.total_granted or 0) + amount
    txn = UserCreditTransaction(
        user_id=user.id,
        transaction_type="subscription_grant",
        amount=amount,
        balance_before=before,
        balance_after=after,
        related_object_type="payment_order",
        related_object_id=str(order.id),
        operator_type="system",
        note=f"Subscription {order.plan_code} {order.period} (order {order.out_trade_no})",
    )
    db.add(txn)
    db.flush()
    logger.info(
        "[SUBSCRIPTION_ACTIVATED] user_id=%s order_id=%s credits_granted=%s balance_after=%s",
        user.id,
        order.id,
        amount,
        after,
    )


def apply_paid_subscription_to_user(db: Session, *, order: PaymentOrder, user: User) -> None:
    now = datetime.now(timezone.utc)
    user.subscription_status = "active"
    user.subscription_plan = order.plan_code
    user.subscription_period = order.period
    user.subscription_started_at = now
    user.subscription_current_period_end = subscription_period_end_utc(now, order.period)
    db.add(user)
    grant_subscription_credits_if_needed(db, order=order, user=user)


def verify_total_amount(payload_total: str | None, order_amount: Decimal) -> bool:
    if not payload_total:
        return False
    try:
        received = Decimal(str(payload_total))
    except Exception:
        return False
    return received == order_amount
