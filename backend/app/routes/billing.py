from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import JSONResponse
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
from ..services.credit_service import grant_free_starter_credits_if_needed
from ..services.wechat_pay_client import (
    amount_yuan_to_fen,
    build_wechat_notify_url,
    create_native_pay_order,
    decrypt_notify_resource,
    generate_wechat_out_trade_no,
    list_wechat_pay_configuration_errors,
    parse_transaction_notify_payload,
    verify_notify_signature,
)

logger = logging.getLogger(__name__)
router = APIRouter()


PLAN_PRICE: dict[str, dict[str, Decimal]] = {
    "basic": {"monthly": Decimal("99.00"), "yearly": Decimal("950.00")},
    "standard": {"monthly": Decimal("259.00"), "yearly": Decimal("2486.00")},
    "pro": {"monthly": Decimal("599.00"), "yearly": Decimal("5750.00")},
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
    payment_provider: str | None = None
    alipay_trade_no: str | None = None
    wechat_transaction_id: str | None = None
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
    payment_provider: str
    alipay_trade_no: str | None = None
    wechat_transaction_id: str | None = None
    paid_at: datetime | None = None
    created_at: datetime | None = None


class BillingMeResponse(BaseModel):
    current_subscription: CurrentSubscriptionOut
    current_credits_balance: int
    credit_records: list[CreditRecordOut]
    payment_orders: list[PaymentOrderListItem]


class CreateWechatOrderRequest(BaseModel):
    plan_code: Literal["basic", "standard", "pro"]
    period: Literal["monthly", "yearly"]


class CreateWechatOrderResponse(BaseModel):
    order_id: int
    out_trade_no: str
    amount: str
    code_url: str
    status: str


def _wechat_config_http_detail() -> str | None:
    errs = list_wechat_pay_configuration_errors()
    if not errs:
        return None
    return "；".join(errs)


@router.post("/wechat/create-order", response_model=CreateWechatOrderResponse)
async def create_wechat_order(
    body: CreateWechatOrderRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    logger.info(
        "[WECHAT_CREATE_ORDER_START] user_id=%s plan=%s period=%s",
        current_user.id,
        body.plan_code,
        body.period,
    )
    cfg_err = _wechat_config_http_detail()
    if cfg_err:
        logger.warning("[WECHAT_CREATE_ORDER_FAILED] config user_id=%s detail=%s", current_user.id, cfg_err)
        raise HTTPException(status_code=400, detail=cfg_err)

    try:
        amount = PLAN_PRICE[body.plan_code][body.period]
    except KeyError:
        raise HTTPException(status_code=400, detail="Invalid plan or period")

    notify_url = build_wechat_notify_url()
    if not notify_url:
        raise HTTPException(status_code=400, detail="缺少支付回调地址")

    out_trade_no = generate_wechat_out_trade_no(current_user.id)
    description = f"VibeClip {body.plan_code} {body.period} subscription"
    order = PaymentOrder(
        user_id=current_user.id,
        out_trade_no=out_trade_no,
        plan_code=body.plan_code,
        period=body.period,
        amount=amount,
        currency="CNY",
        payment_provider="wechat",
        status="pending",
        subject=description,
    )
    db.add(order)
    db.commit()
    db.refresh(order)

    try:
        wx = create_native_pay_order(
            out_trade_no=out_trade_no,
            description=description,
            notify_url=notify_url,
            amount_yuan=amount,
        )
        logger.info(
            "[WECHAT_CREATE_ORDER_SUCCESS] order_id=%s out_trade_no=%s amount=%s",
            order.id,
            order.out_trade_no,
            str(order.amount),
        )
        return CreateWechatOrderResponse(
            order_id=order.id,
            out_trade_no=order.out_trade_no,
            amount=_amount_str(order.amount),
            code_url=wx["code_url"],
            status=order.status,
        )
    except RuntimeError as exc:
        order.status = "failed"
        db.add(order)
        db.commit()
        msg = str(exc)
        logger.exception(
            "[WECHAT_CREATE_ORDER_FAILED] order_id=%s out_trade_no=%s detail=%s",
            order.id,
            order.out_trade_no,
            msg[:500],
        )
        raise HTTPException(status_code=500, detail=msg or "创建微信支付订单失败") from exc
    except Exception:
        order.status = "failed"
        db.add(order)
        db.commit()
        logger.exception(
            "[WECHAT_CREATE_ORDER_FAILED] order_id=%s out_trade_no=%s",
            order.id,
            order.out_trade_no,
        )
        raise HTTPException(status_code=500, detail="创建微信支付订单失败")


def _wechat_notify_ok() -> JSONResponse:
    return JSONResponse(content={"code": "SUCCESS", "message": "成功"})


def _wechat_notify_fail(message: str) -> JSONResponse:
    return JSONResponse(status_code=200, content={"code": "FAIL", "message": message})


@router.post("/wechat/notify")
async def wechat_notify(request: Request, db: Session = Depends(get_db)):
    body_bytes = await request.body()
    body_str = body_bytes.decode("utf-8")
    logger.info("[WECHAT_NOTIFY_RECEIVED] body_len=%s", len(body_str))

    ts = (request.headers.get("Wechatpay-Timestamp") or request.headers.get("wechatpay-timestamp") or "").strip()
    nonce = (request.headers.get("Wechatpay-Nonce") or request.headers.get("wechatpay-nonce") or "").strip()
    sig = (request.headers.get("Wechatpay-Signature") or request.headers.get("wechatpay-signature") or "").strip()
    serial = (request.headers.get("Wechatpay-Serial") or request.headers.get("wechatpay-serial") or "").strip()

    if not ts or not nonce or not sig or not serial:
        logger.warning("[WECHAT_NOTIFY_VERIFY_FAILED] missing_headers")
        return _wechat_notify_fail("缺少签名头")

    if not verify_notify_signature(
        wechatpay_timestamp=ts,
        wechatpay_nonce=nonce,
        body_str=body_str,
        wechatpay_signature_b64=sig,
        wechatpay_serial=serial,
    ):
        logger.warning("[WECHAT_NOTIFY_VERIFY_FAILED] signature serial_prefix=%s", serial[:8])
        return _wechat_notify_fail("签名校验失败")

    logger.info("[WECHAT_NOTIFY_VERIFY_SUCCESS] serial_prefix=%s", serial[:8])

    try:
        payload = json.loads(body_str)
    except json.JSONDecodeError:
        return _wechat_notify_fail("请求体不是合法 JSON")

    resource = payload.get("resource")
    if not isinstance(resource, dict):
        return _wechat_notify_fail("缺少 resource")

    try:
        decrypted = decrypt_notify_resource(resource)
        parsed = parse_transaction_notify_payload(decrypted)
    except Exception:
        logger.exception("[WECHAT_NOTIFY_VERIFY_FAILED] decrypt")
        return _wechat_notify_fail("解密失败")

    out_trade_no = parsed["out_trade_no"]
    transaction_id = parsed["transaction_id"]
    trade_state = parsed["trade_state"]
    amount_total_fen = parsed["amount_total_fen"]

    order = db.query(PaymentOrder).filter(PaymentOrder.out_trade_no == out_trade_no).first()
    if not order:
        logger.warning("[WECHAT_NOTIFY_ORDER_NOT_FOUND] out_trade_no_prefix=%s", out_trade_no[:12])
        return _wechat_notify_fail("订单不存在")

    if (order.payment_provider or "") != "wechat":
        logger.warning("[WECHAT_NOTIFY_VERIFY_FAILED] provider_mismatch order_id=%s", order.id)
        return _wechat_notify_fail("订单支付方式不匹配")

    safe_summary = {
        "out_trade_no": out_trade_no,
        "transaction_id": transaction_id,
        "trade_state": trade_state,
        "amount_total_fen": amount_total_fen,
    }
    order.raw_notify = json.dumps(safe_summary, ensure_ascii=False)

    if trade_state != "SUCCESS":
        logger.info(
            "[WECHAT_NOTIFY_TRADE_STATE] order_id=%s trade_state=%s",
            order.id,
            trade_state,
        )
        db.add(order)
        db.commit()
        return _wechat_notify_ok()

    expected_fen = amount_yuan_to_fen(Decimal(str(order.amount)))
    if amount_total_fen is None or int(amount_total_fen) != int(expected_fen):
        logger.warning(
            "[WECHAT_NOTIFY_VERIFY_FAILED] amount_mismatch order_id=%s expected_fen=%s got=%s",
            order.id,
            expected_fen,
            amount_total_fen,
        )
        db.add(order)
        db.commit()
        return _wechat_notify_fail("金额不一致")

    if order.status == "paid":
        if transaction_id and not order.wechat_transaction_id:
            order.wechat_transaction_id = transaction_id
        db.add(order)
        db.commit()
        logger.info(
            "[WECHAT_ORDER_PAID] idempotent_skip order_id=%s out_trade_no=%s",
            order.id,
            out_trade_no,
        )
        return _wechat_notify_ok()

    if transaction_id:
        order.wechat_transaction_id = transaction_id
    order.status = "paid"
    order.paid_at = datetime.now(timezone.utc)
    user = db.query(User).filter(User.id == order.user_id).first()
    if user:
        apply_paid_subscription_to_user(db, order=order, user=user)
        logger.info(
            "[WECHAT_ORDER_PAID] order_id=%s user_id=%s plan=%s period=%s",
            order.id,
            user.id,
            order.plan_code,
            order.period,
        )
    else:
        logger.error("[WECHAT_ORDER_PAID] user_missing order_id=%s user_id=%s", order.id, order.user_id)

    db.add(order)
    db.commit()
    return _wechat_notify_ok()


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
        payment_provider=getattr(order, "payment_provider", None) or "alipay",
        alipay_trade_no=getattr(order, "alipay_trade_no", None),
        wechat_transaction_id=getattr(order, "wechat_transaction_id", None),
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

    grant_free_starter_credits_if_needed(db, current_user.id)
    db.commit()
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
            payment_provider=getattr(o, "payment_provider", None) or "alipay",
            alipay_trade_no=getattr(o, "alipay_trade_no", None),
            wechat_transaction_id=getattr(o, "wechat_transaction_id", None),
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
