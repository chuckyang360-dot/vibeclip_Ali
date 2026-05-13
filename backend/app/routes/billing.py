from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..auth.jwt_handler import get_current_user
from ..database import get_db
from ..models import PaymentOrder, User, UserCreditAccount, UserCreditTransaction
from ..services.alipay_client import (
    build_payment_return_url,
    create_page_pay_order,
    generate_out_trade_no,
    verify_notify,
)
from ..services.billing_fulfillment import (
    PLAN_MONTHLY_CREDITS,
    apply_paid_subscription_to_user,
    verify_total_amount,
)

logger = logging.getLogger(__name__)
router = APIRouter()


PLAN_PRICE: dict[str, dict[str, Decimal]] = {
    # TEMP: basic monthly price set to 1 CNY for Alipay production payment testing. Restore to 79 after verification.
    "basic": {"monthly": Decimal("1.00"), "yearly": Decimal("758.00")},
    "standard": {"monthly": Decimal("209.00"), "yearly": Decimal("2006.00")},
    "pro": {"monthly": Decimal("529.00"), "yearly": Decimal("5078.00")},
}


def _api_order_status(db_status: str) -> str:
    if db_status == "cancelled":
        return "closed"
    return db_status


def _amount_str(amount: Decimal | float) -> str:
    if isinstance(amount, Decimal):
        return f"{amount.quantize(Decimal('0.01'))}"
    return f"{Decimal(str(amount)).quantize(Decimal('0.01'))}"


class CreateAlipayOrderRequest(BaseModel):
    plan_code: Literal["basic", "standard", "pro"]
    period: Literal["monthly", "yearly"]


class CreateAlipayOrderResponse(BaseModel):
    order_id: int
    out_trade_no: str
    pay_url: str | None = None
    payment_form_html: str | None = None
    status: str


class OrderDetailResponse(BaseModel):
    order_id: int
    out_trade_no: str
    status: str
    plan_code: str
    period: str
    amount: str
    paid_at: datetime | None = None
    created_at: datetime | None = None


class CurrentSubscriptionOut(BaseModel):
    plan: str
    status: str
    billing_period: str | None = None
    renews_at: datetime | None = None
    monthly_credits: int | None = None


class CreditRecordOut(BaseModel):
    id: int
    transaction_type: str
    amount: int
    balance_after: int
    note: str | None = None
    created_at: datetime | None = None
    # Optional: subscription_grant linked payment_order (read-only, for UI)
    related_object_type: str | None = None
    related_object_id: str | None = None
    plan_code: str | None = None
    period: str | None = None
    out_trade_no: str | None = None


class PaymentOrderListItem(BaseModel):
    order_id: int
    out_trade_no: str
    status: str
    plan_code: str
    period: str
    amount: str
    paid_at: datetime | None = None
    created_at: datetime | None = None


class BillingMeResponse(BaseModel):
    current_subscription: CurrentSubscriptionOut
    current_credits_balance: int
    credit_records: list[CreditRecordOut]
    payment_orders: list[PaymentOrderListItem]


@router.post("/alipay/create-order", response_model=CreateAlipayOrderResponse)
async def create_alipay_order(
    body: CreateAlipayOrderRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    logger.info(
        "[BILLING_CREATE_ORDER_START] user_id=%s plan=%s period=%s",
        current_user.id,
        body.plan_code,
        body.period,
    )
    try:
        amount = PLAN_PRICE[body.plan_code][body.period]
    except KeyError:
        raise HTTPException(status_code=400, detail="Invalid plan or period")

    out_trade_no = generate_out_trade_no(current_user.id)
    order = PaymentOrder(
        user_id=current_user.id,
        out_trade_no=out_trade_no,
        plan_code=body.plan_code,
        period=body.period,
        amount=amount,
        currency="CNY",
        payment_provider="alipay",
        status="pending",
        subject=f"VibeClip {body.plan_code} {body.period} subscription",
    )
    db.add(order)
    db.commit()
    db.refresh(order)

    try:
        pay_return = build_payment_return_url(out_trade_no)
        pay_info = create_page_pay_order(
            out_trade_no=out_trade_no,
            amount=str(amount),
            subject=order.subject,
            body=f"order_id={order.id}",
            return_url=pay_return,
        )
        logger.info(
            "[BILLING_CREATE_ORDER_SUCCESS] order_id=%s out_trade_no=%s amount=%s return_url_set=%s",
            order.id,
            order.out_trade_no,
            str(order.amount),
            bool(pay_return),
        )
        return CreateAlipayOrderResponse(
            order_id=order.id,
            out_trade_no=order.out_trade_no,
            pay_url=pay_info.get("pay_url"),
            payment_form_html=None,
            status=order.status,
        )
    except RuntimeError as exc:
        order.status = "failed"
        db.add(order)
        db.commit()
        msg = str(exc)
        if "not installed" in msg:
            detail = "支付宝 SDK 未安装"
        elif "incomplete" in msg.lower():
            detail = "支付宝支付暂未配置"
        else:
            detail = "创建支付宝订单失败"
        logger.exception(
            "[BILLING_CREATE_ORDER_FAILED] order_id=%s out_trade_no=%s detail=%s",
            order.id,
            order.out_trade_no,
            detail,
        )
        raise HTTPException(status_code=500, detail=detail) from exc
    except Exception:
        order.status = "failed"
        db.add(order)
        db.commit()
        logger.exception(
            "[BILLING_CREATE_ORDER_FAILED] order_id=%s out_trade_no=%s",
            order.id,
            order.out_trade_no,
        )
        raise HTTPException(status_code=500, detail="创建支付宝订单失败")


@router.post("/alipay/notify")
async def alipay_notify(request: Request, db: Session = Depends(get_db)):
    form = await request.form()
    payload = {k: str(v) for k, v in form.items()}
    out_trade_no = payload.get("out_trade_no")
    trade_status = payload.get("trade_status")
    trade_no = payload.get("trade_no")
    logger.info(
        "[ALIPAY_NOTIFY_RECEIVED] out_trade_no=%s trade_status=%s",
        out_trade_no,
        trade_status,
    )

    try:
        verified = verify_notify(payload)
    except Exception:
        logger.exception("[ALIPAY_NOTIFY_VERIFY_FAILED] handler_exception out_trade_no=%s", out_trade_no)
        return Response(content="fail", media_type="text/plain")
    if not verified:
        logger.warning("[ALIPAY_NOTIFY_VERIFY_FAILED] out_trade_no=%s", out_trade_no)
        return Response(content="fail", media_type="text/plain")
    logger.info("[ALIPAY_NOTIFY_VERIFY_SUCCESS] out_trade_no=%s", out_trade_no)

    order = db.query(PaymentOrder).filter(PaymentOrder.out_trade_no == out_trade_no).first()
    if not order:
        logger.warning("[BILLING_NOTIFY_ORDER_NOT_FOUND] out_trade_no=%s", out_trade_no)
        return Response(content="fail", media_type="text/plain")

    order.raw_notify = json.dumps(payload, ensure_ascii=False)

    if trade_status in {"TRADE_SUCCESS", "TRADE_FINISHED"}:
        if order.status == "paid":
            if trade_no and not order.alipay_trade_no:
                order.alipay_trade_no = trade_no
            db.add(order)
            db.commit()
            logger.info(
                "[ALIPAY_ORDER_PAID] idempotent_skip order_id=%s out_trade_no=%s",
                order.id,
                out_trade_no,
            )
            return Response(content="success", media_type="text/plain")

        if not verify_total_amount(payload.get("total_amount"), Decimal(str(order.amount))):
            logger.warning(
                "[ALIPAY_NOTIFY_VERIFY_FAILED] amount_mismatch order_id=%s expected=%s got=%s",
                order.id,
                order.amount,
                payload.get("total_amount"),
            )
            db.add(order)
            db.commit()
            return Response(content="fail", media_type="text/plain")

        if trade_no:
            order.alipay_trade_no = trade_no
        order.status = "paid"
        order.paid_at = datetime.now(timezone.utc)
        user = db.query(User).filter(User.id == order.user_id).first()
        if user:
            apply_paid_subscription_to_user(db, order=order, user=user)
            logger.info(
                "[ALIPAY_ORDER_PAID] order_id=%s user_id=%s plan=%s period=%s",
                order.id,
                user.id,
                order.plan_code,
                order.period,
            )
        else:
            logger.error("[ALIPAY_ORDER_PAID] user_missing order_id=%s user_id=%s", order.id, order.user_id)
    elif trade_status == "TRADE_CLOSED":
        if order.status == "pending":
            order.status = "cancelled"
            logger.info("[ALIPAY_NOTIFY_TRADE_CLOSED] order_id=%s", order.id)
    else:
        logger.info(
            "[BILLING_NOTIFY_TRADE_STATUS_IGNORED] order_id=%s trade_status=%s current_status=%s",
            order.id,
            trade_status,
            order.status,
        )

    db.add(order)
    db.commit()
    logger.info("[BILLING_ORDER_UPDATED] order_id=%s status=%s", order.id, order.status)
    return Response(content="success", media_type="text/plain")


def _order_to_detail(order: PaymentOrder) -> OrderDetailResponse:
    return OrderDetailResponse(
        order_id=order.id,
        out_trade_no=order.out_trade_no,
        status=_api_order_status(order.status),
        plan_code=order.plan_code,
        period=order.period,
        amount=_amount_str(order.amount),
        paid_at=order.paid_at,
        created_at=order.created_at,
    )


@router.get("/orders/{order_ref}", response_model=OrderDetailResponse)
async def get_order_by_ref(
    order_ref: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if order_ref.isdigit():
        order = db.query(PaymentOrder).filter(PaymentOrder.id == int(order_ref)).first()
    else:
        order = db.query(PaymentOrder).filter(PaymentOrder.out_trade_no == order_ref).first()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    if order.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    return _order_to_detail(order)


@router.get("/me", response_model=BillingMeResponse)
async def billing_me(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    logger.info("[BILLING_ME_LOADED] user_id=%s", current_user.id)

    acc = db.query(UserCreditAccount).filter(UserCreditAccount.user_id == current_user.id).first()
    balance = int(acc.current_balance or 0) if acc else 0

    sub_status = getattr(current_user, "subscription_status", None) or "inactive"
    plan = getattr(current_user, "subscription_plan", None)
    period = getattr(current_user, "subscription_period", None)
    renews = getattr(current_user, "subscription_current_period_end", None)

    if sub_status == "active" and plan in {"basic", "standard", "pro"}:
        api_plan = plan
        api_sub = "active"
        monthly = PLAN_MONTHLY_CREDITS.get(plan)
    else:
        api_plan = "free"
        api_sub = "not_subscribed" if sub_status == "inactive" else sub_status
        monthly = None

    txns = (
        db.query(UserCreditTransaction)
        .filter(UserCreditTransaction.user_id == current_user.id)
        .order_by(UserCreditTransaction.id.desc())
        .limit(50)
        .all()
    )
    credit_records: list[CreditRecordOut] = []
    for t in txns:
        plan_code: str | None = None
        period: str | None = None
        out_trade_no: str | None = None
        if (
            t.transaction_type == "subscription_grant"
            and (t.related_object_type or "") == "payment_order"
            and t.related_object_id
            and str(t.related_object_id).isdigit()
        ):
            po = (
                db.query(PaymentOrder)
                .filter(
                    PaymentOrder.id == int(t.related_object_id),
                    PaymentOrder.user_id == current_user.id,
                )
                .first()
            )
            if po:
                plan_code = po.plan_code
                period = po.period
                out_trade_no = po.out_trade_no
        credit_records.append(
            CreditRecordOut(
                id=t.id,
                transaction_type=t.transaction_type,
                amount=int(t.amount),
                balance_after=int(t.balance_after),
                note=t.note,
                created_at=t.created_at,
                related_object_type=t.related_object_type,
                related_object_id=t.related_object_id,
                plan_code=plan_code,
                period=period,
                out_trade_no=out_trade_no,
            )
        )

    orders = (
        db.query(PaymentOrder)
        .filter(PaymentOrder.user_id == current_user.id)
        .order_by(PaymentOrder.id.desc())
        .limit(50)
        .all()
    )
    payment_orders = [
        PaymentOrderListItem(
            order_id=o.id,
            out_trade_no=o.out_trade_no,
            status=_api_order_status(o.status),
            plan_code=o.plan_code,
            period=o.period,
            amount=_amount_str(o.amount),
            paid_at=o.paid_at,
            created_at=o.created_at,
        )
        for o in orders
    ]

    return BillingMeResponse(
        current_subscription=CurrentSubscriptionOut(
            plan=api_plan,
            status=api_sub,
            billing_period=period,
            renews_at=renews,
            monthly_credits=monthly,
        ),
        current_credits_balance=balance,
        credit_records=credit_records,
        payment_orders=payment_orders,
    )
