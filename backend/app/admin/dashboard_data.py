from __future__ import annotations

import logging
from datetime import timedelta
from decimal import Decimal
from typing import Any

from sqlalchemy import case, func
from sqlalchemy.orm import Session

from ..models import ApiCallLog, PaymentOrder, User, UserCreditTransaction
from ..short_drama.models import AssetEntity, RenderJob, ShortDramaProject
from .timeutil import TZ_ADMIN, day_range_utc_sh, last_n_days_dates_sh, now_utc, today_range_utc_sh

logger = logging.getLogger(__name__)


def _dec_float(v: Any) -> float:
    if v is None:
        return 0.0
    if isinstance(v, Decimal):
        return float(v)
    return float(v)


def _money_decimal_str(v: Any) -> str:
    if v is None:
        return "0.00"
    d = v if isinstance(v, Decimal) else Decimal(str(v))
    return f"{d.quantize(Decimal('0.01'))}"


def build_dashboard(db: Session) -> dict[str, Any]:
    t0, t1 = today_range_utc_sh()
    now = now_utc()

    total_users = db.query(func.count(User.id)).scalar() or 0
    new_users_today = db.query(func.count(User.id)).filter(User.created_at >= t0, User.created_at < t1).scalar() or 0
    total_projects = db.query(func.count(ShortDramaProject.id)).scalar() or 0
    projects_today = (
        db.query(func.count(ShortDramaProject.id))
        .filter(ShortDramaProject.created_at >= t0, ShortDramaProject.created_at < t1)
        .scalar()
        or 0
    )
    assets_generated_today = (
        db.query(func.count(AssetEntity.id))
        .filter(AssetEntity.created_at >= t0, AssetEntity.created_at < t1)
        .scalar()
        or 0
    )

    videos_today = (
        db.query(func.count(RenderJob.id))
        .filter(
            RenderJob.created_at >= t0,
            RenderJob.created_at < t1,
            RenderJob.status.in_(("completed", "succeeded")),
            RenderJob.target_type.in_(("segment_video", "merged_video", "final", "segment")),
        )
        .scalar()
        or 0
    )

    api_calls_today = db.query(func.count(ApiCallLog.id)).filter(ApiCallLog.created_at >= t0, ApiCallLog.created_at < t1).scalar() or 0

    credits_consumed_today = (
        db.query(func.coalesce(func.sum(-UserCreditTransaction.amount), 0))
        .filter(
            UserCreditTransaction.amount < 0,
            UserCreditTransaction.created_at >= t0,
            UserCreditTransaction.created_at < t1,
        )
        .scalar()
        or 0
    )

    est_cost_today_row = (
        db.query(
            func.coalesce(func.sum(ApiCallLog.estimated_cost_usd), 0),
            func.coalesce(func.sum(ApiCallLog.estimated_cost_cny), 0),
        )
        .filter(ApiCallLog.created_at >= t0, ApiCallLog.created_at < t1)
        .one()
    )
    estimated_cost_today = _dec_float(est_cost_today_row[0]) + _dec_float(est_cost_today_row[1]) / 7.2

    failed_jobs_today = (
        db.query(func.count(RenderJob.id))
        .filter(
            RenderJob.created_at >= t0,
            RenderJob.created_at < t1,
            RenderJob.status.in_(("failed", "error")),
        )
        .scalar()
        or 0
    )

    dist_rows = (
        db.query(
            PaymentOrder.status,
            func.count(PaymentOrder.id),
            func.coalesce(func.sum(PaymentOrder.amount), 0),
        )
        .group_by(PaymentOrder.status)
        .all()
    )
    if not dist_rows:
        logger.info(
            "[ADMIN_PAYMENT_ORDER_STATUS_DISTRIBUTION] status=None count=0 sum_amount=0.00 (no payment_orders rows)"
        )
    for st, cnt, amt in dist_rows:
        logger.info(
            "[ADMIN_PAYMENT_ORDER_STATUS_DISTRIBUTION] status=%r count=%s sum_amount=%s",
            st,
            int(cnt or 0),
            _money_decimal_str(amt),
        )

    _paid_filter = PaymentOrder.status == "paid"
    total_revenue_raw = (
        db.query(func.coalesce(func.sum(PaymentOrder.amount), 0)).filter(_paid_filter).scalar()
    )
    today_revenue_raw = (
        db.query(func.coalesce(func.sum(PaymentOrder.amount), 0))
        .filter(
            _paid_filter,
            PaymentOrder.paid_at.isnot(None),
            PaymentOrder.paid_at >= t0,
            PaymentOrder.paid_at < t1,
        )
        .scalar()
    )
    paid_order_count = int(db.query(func.count(PaymentOrder.id)).filter(_paid_filter).scalar() or 0)
    today_paid_order_count = int(
        db.query(func.count(PaymentOrder.id))
        .filter(
            _paid_filter,
            PaymentOrder.paid_at.isnot(None),
            PaymentOrder.paid_at >= t0,
            PaymentOrder.paid_at < t1,
        )
        .scalar()
        or 0
    )
    logger.info(
        "[ADMIN_REVENUE_SUMMARY] paid_order_count=%s total_revenue=%s today_paid_order_count=%s today_revenue=%s",
        paid_order_count,
        _money_decimal_str(total_revenue_raw),
        today_paid_order_count,
        _money_decimal_str(today_revenue_raw),
    )

    # --- 7d trends ---
    user_growth_7d: list[dict[str, Any]] = []
    project_video_generation_7d: list[dict[str, Any]] = []
    api_calls_cost_7d: list[dict[str, Any]] = []
    for d in last_n_days_dates_sh(7):
        d0, d1 = day_range_utc_sh(d)
        nu = db.query(func.count(User.id)).filter(User.created_at >= d0, User.created_at < d1).scalar() or 0
        np = db.query(func.count(ShortDramaProject.id)).filter(
            ShortDramaProject.created_at >= d0, ShortDramaProject.created_at < d1
        ).scalar() or 0
        nv = (
            db.query(func.count(RenderJob.id))
            .filter(
                RenderJob.created_at >= d0,
                RenderJob.created_at < d1,
                RenderJob.status.in_(("completed", "succeeded")),
            )
            .scalar()
            or 0
        )
        calls = db.query(func.count(ApiCallLog.id)).filter(ApiCallLog.created_at >= d0, ApiCallLog.created_at < d1).scalar() or 0
        cost_row = (
            db.query(
                func.coalesce(func.sum(ApiCallLog.estimated_cost_usd), 0),
                func.coalesce(func.sum(ApiCallLog.estimated_cost_cny), 0),
            )
            .filter(ApiCallLog.created_at >= d0, ApiCallLog.created_at < d1)
            .one()
        )
        cost = _dec_float(cost_row[0]) + _dec_float(cost_row[1]) / 7.2
        user_growth_7d.append({"date": d.isoformat(), "count": int(nu)})
        project_video_generation_7d.append(
            {"date": d.isoformat(), "projects": int(np), "videos": int(nv)}
        )
        api_calls_cost_7d.append({"date": d.isoformat(), "calls": int(calls), "estimated_cost": cost})

    # --- provider stats (all time, capped sample) ---
    provider_rows = (
        db.query(
            ApiCallLog.provider,
            func.count(ApiCallLog.id),
            func.sum(case((ApiCallLog.status == "success", 1), else_=0)),
        )
        .group_by(ApiCallLog.provider)
        .all()
    )
    provider_stats: list[dict[str, Any]] = []
    for prov, calls, succ in provider_rows:
        c = int(calls or 0)
        s = int(succ or 0)
        fail = max(c - s, 0)
        provider_stats.append(
            {
                "provider": prov or "Other",
                "calls": c,
                "success_rate": (s / c) if c else 0.0,
                "failure_rate": (fail / c) if c else 0.0,
                "estimated_cost": 0.0,
            }
        )

    # --- abnormal tasks (recent) ---
    stuck_asset_threshold = now - timedelta(minutes=10)
    stuck_video_threshold = now - timedelta(minutes=30)
    abnormal_tasks: list[dict[str, Any]] = []

    failed_assets = (
        db.query(AssetEntity)
        .filter(AssetEntity.status.in_(("failed", "error")))
        .order_by(AssetEntity.updated_at.desc())
        .limit(15)
        .all()
    )
    for a in failed_assets:
        abnormal_tasks.append(
            {
                "kind": "asset",
                "id": a.id,
                "project_id": a.project_id,
                "status": a.status,
                "message": (a.extra_json or {}).get("error") if isinstance(a.extra_json, dict) else None,
                "updated_at": a.updated_at.isoformat() if a.updated_at else None,
            }
        )

    stuck_assets = (
        db.query(AssetEntity)
        .filter(
            AssetEntity.status.in_(("processing", "generating", "running")),
            AssetEntity.updated_at.isnot(None),
            AssetEntity.updated_at < stuck_asset_threshold,
        )
        .order_by(AssetEntity.updated_at.asc())
        .limit(10)
        .all()
    )
    for a in stuck_assets:
        abnormal_tasks.append(
            {
                "kind": "asset_stuck",
                "id": a.id,
                "project_id": a.project_id,
                "status": a.status,
                "message": "Stuck beyond threshold",
                "updated_at": a.updated_at.isoformat() if a.updated_at else None,
            }
        )

    failed_jobs = (
        db.query(RenderJob)
        .filter(RenderJob.status.in_(("failed", "error")))
        .order_by(RenderJob.updated_at.desc())
        .limit(15)
        .all()
    )
    for j in failed_jobs:
        abnormal_tasks.append(
            {
                "kind": "video_job",
                "id": j.id,
                "project_id": j.project_id,
                "status": j.status,
                "message": (j.error_message or "")[:500],
                "updated_at": j.updated_at.isoformat() if j.updated_at else None,
            }
        )

    stuck_jobs = (
        db.query(RenderJob)
        .filter(
            RenderJob.status.in_(("queued", "running", "pending", "processing", "polling")),
            RenderJob.updated_at.isnot(None),
            RenderJob.updated_at < stuck_video_threshold,
        )
        .order_by(RenderJob.updated_at.asc())
        .limit(10)
        .all()
    )
    for j in stuck_jobs:
        abnormal_tasks.append(
            {
                "kind": "video_job_stuck",
                "id": j.id,
                "project_id": j.project_id,
                "status": j.status,
                "message": "Stuck beyond threshold",
                "updated_at": j.updated_at.isoformat() if j.updated_at else None,
            }
        )

    failed_api = (
        db.query(ApiCallLog)
        .filter(ApiCallLog.status.in_(("failed", "timeout", "rate_limited")))
        .order_by(ApiCallLog.created_at.desc())
        .limit(10)
        .all()
    )
    for lg in failed_api:
        abnormal_tasks.append(
            {
                "kind": "api_call",
                "id": lg.id,
                "project_id": lg.project_id,
                "status": lg.status,
                "message": (lg.error_message or "")[:300],
                "updated_at": lg.created_at.isoformat() if lg.created_at else None,
            }
        )

    # --- top consuming users today ---
    burn_rows = (
        db.query(UserCreditTransaction.user_id, func.sum(UserCreditTransaction.amount))
        .filter(
            UserCreditTransaction.amount < 0,
            UserCreditTransaction.created_at >= t0,
            UserCreditTransaction.created_at < t1,
        )
        .group_by(UserCreditTransaction.user_id)
        .order_by(func.sum(UserCreditTransaction.amount).asc())
        .limit(10)
        .all()
    )
    top_consuming_users: list[dict[str, Any]] = []
    for uid, amt in burn_rows:
        u = db.query(User).filter(User.id == uid).first()
        top_consuming_users.append(
            {
                "user_id": uid,
                "email": u.email if u else None,
                "credits_consumed_today": int(-(amt or 0)),
            }
        )

    return {
        "total_revenue": _money_decimal_str(total_revenue_raw),
        "today_revenue": _money_decimal_str(today_revenue_raw),
        "total_users": int(total_users),
        "new_users_today": int(new_users_today),
        "total_projects": int(total_projects),
        "projects_today": int(projects_today),
        "assets_generated_today": int(assets_generated_today),
        "videos_generated_today": int(videos_today),
        "api_calls_today": int(api_calls_today),
        "credits_consumed_today": int(credits_consumed_today),
        "estimated_cost_today": float(estimated_cost_today),
        "failed_jobs_today": int(failed_jobs_today),
        "user_growth_7d": user_growth_7d,
        "project_video_generation_7d": project_video_generation_7d,
        "api_calls_cost_7d": api_calls_cost_7d,
        "provider_stats": provider_stats,
        "abnormal_tasks": abnormal_tasks[:40],
        "top_consuming_users": top_consuming_users,
        "timezone_note": str(TZ_ADMIN),
    }
