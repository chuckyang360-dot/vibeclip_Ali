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
from ..models import PaymentOrder, User
from ..services.alipay_client import (
    build_return_url_with_order_id,
    create_page_pay_order,
    generate_out_trade_no,
    verify_notify,
)

logger = logging.getLogger(__name__)
router = APIRouter()


PLAN_PRICE: dict[str, dict[str, Decimal]] = {
    "basic": {"monthly": Decimal("79.00"), "yearly": Decimal("758.00")},
    "standard": {"monthly": Decimal("209.00"), "yearly": Decimal("2006.00")},
    "pro": {"monthly": Decimal("529.00"), "yearly": Decimal("5078.00")},
}


class CreateAlipayOrderRequest(BaseModel):
    plan_code: Literal["basic", "standard", "pro"]
    period: Literal["monthly", "yearly"]


class CreateAlipayOrderResponse(BaseModel):
    order_id: int
    out_trade_no: str
    pay_url: str | None = None
    payment_form_html: str | None = None
    status: str


class BillingOrderResponse(BaseModel):
    order_id: int
    out_trade_no: str
    status: str
    plan_code: str
    period: str
    amount: float
    paid_at: datetime | None


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
        pay_info = create_page_pay_order(
            out_trade_no=out_trade_no,
            amount=str(amount),
            subject=order.subject,
            body=f"order_id={order.id}",
            return_url=build_return_url_with_order_id(order.id),
        )
        logger.info(
            "[BILLING_CREATE_ORDER_SUCCESS] order_id=%s out_trade_no=%s amount=%s",
            order.id,
            order.out_trade_no,
            str(order.amount),
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
    logger.info(
        "[BILLING_NOTIFY_RECEIVED] out_trade_no=%s trade_status=%s",
        out_trade_no,
        trade_status,
    )

    try:
        verified = verify_notify(payload)
    except Exception:
        logger.exception("[BILLING_NOTIFY_HANDLER_ERROR]")
        return Response(content="fail", media_type="text/plain")
    if not verified:
        logger.warning("[BILLING_NOTIFY_VERIFY_FAILED] out_trade_no=%s", out_trade_no)
        return Response(content="fail", media_type="text/plain")
    logger.info("[BILLING_NOTIFY_VERIFY_SUCCESS] out_trade_no=%s", out_trade_no)

    order = db.query(PaymentOrder).filter(PaymentOrder.out_trade_no == out_trade_no).first()
    if not order:
        logger.warning("[BILLING_NOTIFY_ORDER_NOT_FOUND] out_trade_no=%s", out_trade_no)
        return Response(content="fail", media_type="text/plain")

    logger.info("[BILLING_NOTIFY_TRADE_STATUS] order_id=%s trade_status=%s", order.id, trade_status)
    order.raw_notify = json.dumps(payload, ensure_ascii=False)
    if trade_status in {"TRADE_SUCCESS", "TRADE_FINISHED"}:
        order.status = "paid"
        order.paid_at = datetime.now(timezone.utc)
        user = db.query(User).filter(User.id == order.user_id).first()
        if user:
            user.subscription_status = "active"
            user.subscription_plan = order.plan_code
            db.add(user)
            logger.info(
                "[BILLING_SUBSCRIPTION_UPDATED] user_id=%s status=%s plan=%s",
                user.id,
                user.subscription_status,
                user.subscription_plan,
            )
    elif trade_status in {"TRADE_CLOSED"}:
        order.status = "cancelled"
    else:
        order.status = "failed"

    db.add(order)
    db.commit()
    logger.info("[BILLING_ORDER_UPDATED] order_id=%s status=%s", order.id, order.status)
    return Response(content="success", media_type="text/plain")


@router.get("/orders/{order_id}", response_model=BillingOrderResponse)
async def get_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    order = db.query(PaymentOrder).filter(PaymentOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    if order.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    return BillingOrderResponse(
        order_id=order.id,
        out_trade_no=order.out_trade_no,
        status=order.status,
        plan_code=order.plan_code,
        period=order.period,
        amount=float(order.amount),
        paid_at=order.paid_at,
    )
