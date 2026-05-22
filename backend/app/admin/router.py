from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import (
    AdminOperationLog,
    AIModelCatalog,
    AIPromptTemplate,
    AIStageConfig,
    ApiCallLog,
    PaymentOrder,
    User,
    UserCreditAccount,
    UserCreditTransaction,
)
from ..short_drama.models import AssetEntity, AssetImage, RenderJob, ShortDramaProject
from .credit_ops import admin_deduct_credits, admin_grant_credits
from .dashboard_data import build_dashboard
from .deps import require_admin_user
from .schemas import (
    AIModelCreateRequest,
    AIPromptDraftRequest,
    AIPromptPublishRequest,
    AIStageModelUpdateRequest,
    AIStagePromptPublishExistingRequest,
    CreditDeductRequest,
    CreditGrantRequest,
    ReasonRequest,
)
from .timeutil import TZ_ADMIN, day_range_utc_sh, last_n_days_dates_sh, today_range_utc_sh

router = APIRouter()


def _client_ip(request: Request) -> str | None:
    if request.client:
        return request.client.host
    return None


def _parse_date_range(date_from: str | None, date_to: str | None) -> tuple[Any, Any] | tuple[None, None]:
    from datetime import datetime, timezone

    start = end = None
    if date_from:
        try:
            start = datetime.fromisoformat(date_from.replace("Z", "+00:00"))
            if start.tzinfo is None:
                start = start.replace(tzinfo=timezone.utc)
        except ValueError:
            start = None
    if date_to:
        try:
            end = datetime.fromisoformat(date_to.replace("Z", "+00:00"))
            if end.tzinfo is None:
                end = end.replace(tzinfo=timezone.utc)
        except ValueError:
            end = None
    return start, end


def _project_last_error(db: Session, project_id: int) -> str | None:
    j = (
        db.query(RenderJob)
        .filter(RenderJob.project_id == project_id, RenderJob.status.in_(("failed", "error")))
        .order_by(RenderJob.updated_at.desc().nullslast(), RenderJob.id.desc())
        .first()
    )
    if j and j.error_message:
        return str(j.error_message)[:500]
    a = (
        db.query(AssetEntity)
        .filter(AssetEntity.project_id == project_id, AssetEntity.status.in_(("failed", "error")))
        .order_by(AssetEntity.updated_at.desc().nullslast())
        .first()
    )
    if a:
        ex = a.extra_json if isinstance(a.extra_json, dict) else {}
        err = ex.get("error") or ex.get("last_error")
        if err:
            return str(err)[:500]
    return None


def _asset_preview_url(db: Session, asset: AssetEntity) -> str | None:
    if asset.cover_image_id:
        img = db.query(AssetImage).filter(AssetImage.id == asset.cover_image_id).first()
        if img and img.image_url:
            return img.image_url
    img = (
        db.query(AssetImage)
        .filter(AssetImage.asset_id == asset.id)
        .order_by(AssetImage.is_cover.desc(), AssetImage.id.desc())
        .first()
    )
    return img.image_url if img else None


def _json_safe(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, default=str)


def _model_payload(row: AIModelCatalog | None) -> dict[str, Any] | None:
    if row is None:
        return None
    return {
        "id": row.id,
        "provider": row.provider,
        "model_id": row.model_id,
        "display_name": row.display_name,
        "capability": row.capability,
        "enabled": bool(row.enabled),
        "sort_order": int(row.sort_order or 0),
        "config_schema": row.config_schema or {},
        "default_config": row.default_config or {},
        "metadata_json": row.metadata_json or {},
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def _prompt_payload(row: AIPromptTemplate | None, *, include_body: bool = True) -> dict[str, Any] | None:
    if row is None:
        return None
    payload: dict[str, Any] = {
        "id": row.id,
        "stage_key": row.stage_key,
        "name": row.name,
        "version": int(row.version or 1),
        "status": row.status,
        "variables_schema": row.variables_schema or {},
        "metadata_json": row.metadata_json or {},
        "created_by": row.created_by,
        "updated_by": row.updated_by,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }
    if include_body:
        payload["system_prompt"] = row.system_prompt or ""
        payload["user_prompt_template"] = row.user_prompt_template or ""
    return payload


def _stage_config_payload(db: Session, row: AIStageConfig) -> dict[str, Any]:
    active_model = db.query(AIModelCatalog).filter(AIModelCatalog.id == row.active_model_id).first() if row.active_model_id else None
    fallback_model = db.query(AIModelCatalog).filter(AIModelCatalog.id == row.fallback_model_id).first() if row.fallback_model_id else None
    active_prompt = (
        db.query(AIPromptTemplate).filter(AIPromptTemplate.id == row.active_prompt_template_id).first()
        if row.active_prompt_template_id
        else None
    )
    capability = str((row.config_json or {}).get("capability") or (active_model.capability if active_model else "")).strip()
    candidate_models = (
        db.query(AIModelCatalog)
        .filter(AIModelCatalog.capability == capability, AIModelCatalog.enabled.is_(True))
        .order_by(AIModelCatalog.sort_order.asc(), AIModelCatalog.provider.asc(), AIModelCatalog.model_id.asc())
        .all()
        if capability
        else []
    )
    prompt_versions = (
        db.query(AIPromptTemplate)
        .filter(AIPromptTemplate.stage_key == row.stage_key)
        .order_by(AIPromptTemplate.version.desc(), AIPromptTemplate.id.desc())
        .limit(20)
        .all()
    )
    return {
        "stage_key": row.stage_key,
        "stage_name": row.stage_name,
        "enabled": bool(row.enabled),
        "capability": capability,
        "active_model": _model_payload(active_model),
        "fallback_model": _model_payload(fallback_model),
        "active_prompt": _prompt_payload(active_prompt),
        "candidate_models": [_model_payload(m) for m in candidate_models],
        "prompt_versions": [_prompt_payload(p, include_body=False) for p in prompt_versions],
        "config_json": row.config_json or {},
        "updated_by": row.updated_by,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


@router.get("/dashboard")
async def admin_dashboard(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_user),
):
    return build_dashboard(db)


@router.get("/ai-models/configs")
async def list_ai_stage_configs(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_user),
):
    rows = db.query(AIStageConfig).order_by(AIStageConfig.id.asc()).all()
    models = (
        db.query(AIModelCatalog)
        .order_by(AIModelCatalog.capability.asc(), AIModelCatalog.sort_order.asc(), AIModelCatalog.provider.asc())
        .all()
    )
    return {
        "items": [_stage_config_payload(db, r) for r in rows],
        "models": [_model_payload(m) for m in models],
    }


@router.post("/ai-models/catalog")
async def create_ai_model_catalog_item(
    body: AIModelCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin_user),
):
    provider = body.provider.strip().lower()
    model_id = body.model_id.strip()
    capability = body.capability.strip().lower()
    existing = (
        db.query(AIModelCatalog)
        .filter(
            AIModelCatalog.provider == provider,
            AIModelCatalog.model_id == model_id,
            AIModelCatalog.capability == capability,
        )
        .first()
    )
    if existing is not None:
        raise HTTPException(status_code=409, detail="AI model already exists for this provider/capability")
    row = AIModelCatalog(
        provider=provider,
        model_id=model_id,
        display_name=body.display_name.strip(),
        capability=capability,
        enabled=body.enabled,
        sort_order=body.sort_order,
        config_schema=body.config_schema,
        default_config=body.default_config,
        metadata_json=body.metadata_json,
    )
    db.add(row)
    db.flush()
    db.add(
        AdminOperationLog(
            operator_admin_id=admin.id,
            operator_email=admin.email,
            action="create_ai_model",
            target_type="ai_model_catalog",
            target_id=str(row.id),
            before_data=None,
            after_data=_json_safe(_model_payload(row)),
            reason="create AI model catalog item",
            ip_address=_client_ip(request),
        )
    )
    db.commit()
    db.refresh(row)
    return {"success": True, "model": _model_payload(row)}


@router.put("/ai-models/configs/{stage_key}/model")
async def update_ai_stage_model(
    stage_key: str,
    body: AIStageModelUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin_user),
):
    stage = db.query(AIStageConfig).filter(AIStageConfig.stage_key == stage_key).first()
    if stage is None:
        raise HTTPException(status_code=404, detail="AI stage config not found")
    model = db.query(AIModelCatalog).filter(AIModelCatalog.id == body.model_catalog_id).first()
    if model is None or not model.enabled:
        raise HTTPException(status_code=400, detail="Selected AI model is not available")
    capability = str((stage.config_json or {}).get("capability") or "").strip()
    if capability and model.capability != capability:
        raise HTTPException(status_code=400, detail=f"Model capability must be {capability}")
    fallback = None
    if body.fallback_model_catalog_id is not None:
        fallback = db.query(AIModelCatalog).filter(AIModelCatalog.id == body.fallback_model_catalog_id).first()
        if fallback is None or not fallback.enabled:
            raise HTTPException(status_code=400, detail="Fallback AI model is not available")
        if capability and fallback.capability != capability:
            raise HTTPException(status_code=400, detail=f"Fallback capability must be {capability}")

    before = _stage_config_payload(db, stage)
    stage.active_model_id = model.id
    if fallback is not None:
        stage.fallback_model_id = fallback.id
    stage.updated_by = admin.id
    db.add(
        AdminOperationLog(
            operator_admin_id=admin.id,
            operator_email=admin.email,
            action="update_ai_stage_model",
            target_type="ai_stage_config",
            target_id=stage.stage_key,
            before_data=_json_safe(before),
            after_data=_json_safe({"active_model_id": model.id, "fallback_model_id": stage.fallback_model_id}),
            reason=body.reason,
            ip_address=_client_ip(request),
        )
    )
    db.commit()
    db.refresh(stage)
    return {"success": True, "config": _stage_config_payload(db, stage)}


@router.post("/ai-models/configs/{stage_key}/prompts/draft")
async def save_ai_prompt_draft(
    stage_key: str,
    body: AIPromptDraftRequest,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin_user),
):
    stage = db.query(AIStageConfig).filter(AIStageConfig.stage_key == stage_key).first()
    if stage is None:
        raise HTTPException(status_code=404, detail="AI stage config not found")
    latest_version = (
        db.query(func.coalesce(func.max(AIPromptTemplate.version), 0))
        .filter(AIPromptTemplate.stage_key == stage_key)
        .scalar()
        or 0
    )
    row = AIPromptTemplate(
        stage_key=stage_key,
        name=body.name.strip(),
        version=int(latest_version) + 1,
        status="draft",
        system_prompt=body.system_prompt,
        user_prompt_template=body.user_prompt_template,
        variables_schema=body.variables_schema,
        metadata_json=body.metadata_json,
        created_by=admin.id,
        updated_by=admin.id,
    )
    db.add(row)
    db.flush()
    db.add(
        AdminOperationLog(
            operator_admin_id=admin.id,
            operator_email=admin.email,
            action="save_ai_prompt_draft",
            target_type="ai_prompt_template",
            target_id=str(row.id),
            before_data=None,
            after_data=_json_safe(_prompt_payload(row)),
            reason=body.reason or "save AI prompt draft",
            ip_address=_client_ip(request),
        )
    )
    db.commit()
    db.refresh(row)
    return {"success": True, "prompt": _prompt_payload(row)}


@router.post("/ai-models/configs/{stage_key}/prompts/publish")
async def publish_new_ai_prompt(
    stage_key: str,
    body: AIPromptPublishRequest,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin_user),
):
    draft_response = await save_ai_prompt_draft(stage_key, body, request, db, admin)
    prompt_id = int(draft_response["prompt"]["id"])
    return await publish_existing_ai_prompt(
        stage_key,
        AIStagePromptPublishExistingRequest(prompt_template_id=prompt_id, reason=body.reason),
        request,
        db,
        admin,
    )


@router.put("/ai-models/configs/{stage_key}/prompts/active")
async def publish_existing_ai_prompt(
    stage_key: str,
    body: AIStagePromptPublishExistingRequest,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin_user),
):
    stage = db.query(AIStageConfig).filter(AIStageConfig.stage_key == stage_key).first()
    if stage is None:
        raise HTTPException(status_code=404, detail="AI stage config not found")
    prompt = (
        db.query(AIPromptTemplate)
        .filter(AIPromptTemplate.id == body.prompt_template_id, AIPromptTemplate.stage_key == stage_key)
        .first()
    )
    if prompt is None:
        raise HTTPException(status_code=404, detail="AI prompt template not found")
    before = _stage_config_payload(db, stage)
    previous_active = db.query(AIPromptTemplate).filter(
        AIPromptTemplate.stage_key == stage_key,
        AIPromptTemplate.status == "active",
        AIPromptTemplate.id != prompt.id,
    )
    for old in previous_active.all():
        old.status = "archived"
        old.updated_by = admin.id
    prompt.status = "active"
    prompt.updated_by = admin.id
    stage.active_prompt_template_id = prompt.id
    stage.updated_by = admin.id
    db.add(
        AdminOperationLog(
            operator_admin_id=admin.id,
            operator_email=admin.email,
            action="publish_ai_prompt",
            target_type="ai_stage_config",
            target_id=stage.stage_key,
            before_data=_json_safe(before),
            after_data=_json_safe({"active_prompt_template_id": prompt.id, "prompt_version": prompt.version}),
            reason=body.reason,
            ip_address=_client_ip(request),
        )
    )
    db.commit()
    db.refresh(stage)
    return {"success": True, "config": _stage_config_payload(db, stage)}


@router.get("/users")
async def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_user),
    search: str | None = None,
    status: str | None = Query(None, description="normal | disabled | risk"),
    subscription: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    sort: str = Query("created_at_desc"),
):
    del subscription  # reserved; no subscription column in v1
    q = db.query(User)
    if search:
        term = f"%{search.strip()}%"
        q = q.filter(or_(User.email.ilike(term), User.name.ilike(term), User.username.ilike(term)))
    if status:
        q = q.filter(User.account_status == status)
    if sort == "created_at_asc":
        q = q.order_by(User.created_at.asc().nullslast(), User.id.asc())
    elif sort == "email_asc":
        q = q.order_by(User.email.asc(), User.id.asc())
    else:
        q = q.order_by(User.created_at.desc().nullslast(), User.id.desc())

    total = q.count()
    rows = q.offset((page - 1) * page_size).limit(page_size).all()
    ids = [u.id for u in rows]

    p_counts: dict[int, int] = {}
    a_counts: dict[int, int] = {}
    v_counts: dict[int, int] = {}
    if ids:
        p_counts = dict(
            db.query(ShortDramaProject.user_id, func.count(ShortDramaProject.id))
            .filter(ShortDramaProject.user_id.in_(ids))
            .group_by(ShortDramaProject.user_id)
            .all()
        )
        a_counts = dict(
            db.query(ShortDramaProject.user_id, func.count(AssetEntity.id))
            .join(AssetEntity, AssetEntity.project_id == ShortDramaProject.id)
            .filter(ShortDramaProject.user_id.in_(ids))
            .group_by(ShortDramaProject.user_id)
            .all()
        )
        v_counts = dict(
            db.query(ShortDramaProject.user_id, func.count(RenderJob.id))
            .join(RenderJob, RenderJob.project_id == ShortDramaProject.id)
            .filter(ShortDramaProject.user_id.in_(ids))
            .group_by(ShortDramaProject.user_id)
            .all()
        )

    dates = last_n_days_dates_sh(7)
    api_cost_from = day_range_utc_sh(dates[0])[0]
    _, api_cost_to = today_range_utc_sh()

    api_cost_map: dict[int, float] = {i: 0.0 for i in ids}
    if ids:
        cost_rows = (
            db.query(
                ApiCallLog.user_id,
                func.coalesce(func.sum(ApiCallLog.estimated_cost_usd), 0),
                func.coalesce(func.sum(ApiCallLog.estimated_cost_cny), 0),
            )
            .filter(
                ApiCallLog.user_id.in_(ids),
                ApiCallLog.created_at >= api_cost_from,
                ApiCallLog.created_at < api_cost_to,
            )
            .group_by(ApiCallLog.user_id)
            .all()
        )
        for uid, usd, cny in cost_rows:
            if uid is None:
                continue
            api_cost_map[int(uid)] = float(usd or 0) + float(cny or 0) / 7.2

    bal_map: dict[int, int] = {}
    if ids:
        bals = db.query(UserCreditAccount.user_id, UserCreditAccount.current_balance).filter(
            UserCreditAccount.user_id.in_(ids)
        )
        bal_map = {int(r[0]): int(r[1] or 0) for r in bals}

    items = []
    for u in rows:
        items.append(
            {
                "user_id": u.id,
                "email": u.email,
                "username": u.username,
                "registered_at": u.created_at.isoformat() if u.created_at else None,
                "last_login": None,
                "status": getattr(u, "account_status", None) or "normal",
                "subscription": "free",
                "credit_balance": bal_map.get(u.id, 0),
                "projects_count": int(p_counts.get(u.id, 0)),
                "assets_count": int(a_counts.get(u.id, 0)),
                "videos_count": int(v_counts.get(u.id, 0)),
                "api_cost_7d": api_cost_map.get(u.id, 0.0),
            }
        )

    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/users/{user_id}")
async def get_user_detail(
    user_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_user),
):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    acc = db.query(UserCreditAccount).filter(UserCreditAccount.user_id == u.id).first()
    if acc is None:
        # Lazy-create account for admin read scenarios.
        acc = UserCreditAccount(user_id=u.id)
        db.add(acc)
        db.commit()
        db.refresh(acc)
    credit_balance = int(acc.current_balance or 0)

    total_projects = db.query(func.count(ShortDramaProject.id)).filter(ShortDramaProject.user_id == u.id).scalar() or 0
    total_assets = (
        db.query(func.count(AssetEntity.id))
        .join(ShortDramaProject, ShortDramaProject.id == AssetEntity.project_id)
        .filter(ShortDramaProject.user_id == u.id)
        .scalar()
        or 0
    )
    total_videos = (
        db.query(func.count(RenderJob.id))
        .join(ShortDramaProject, ShortDramaProject.id == RenderJob.project_id)
        .filter(ShortDramaProject.user_id == u.id)
        .scalar()
        or 0
    )
    granted = (
        db.query(func.coalesce(func.sum(UserCreditTransaction.amount), 0))
        .filter(UserCreditTransaction.user_id == u.id, UserCreditTransaction.amount > 0)
        .scalar()
        or 0
    )
    consumed = (
        db.query(func.coalesce(func.sum(-UserCreditTransaction.amount), 0))
        .filter(UserCreditTransaction.user_id == u.id, UserCreditTransaction.amount < 0)
        .scalar()
        or 0
    )
    cost_row = (
        db.query(
            func.coalesce(func.sum(ApiCallLog.estimated_cost_usd), 0),
            func.coalesce(func.sum(ApiCallLog.estimated_cost_cny), 0),
        )
        .filter(ApiCallLog.user_id == u.id)
        .one()
    )
    estimated_api_cost = float(cost_row[0] or 0) + float(cost_row[1] or 0) / 7.2

    projects = (
        db.query(ShortDramaProject)
        .filter(ShortDramaProject.user_id == u.id)
        .order_by(ShortDramaProject.updated_at.desc().nullslast(), ShortDramaProject.id.desc())
        .limit(80)
        .all()
    )
    project_items = []
    for p in projects:
        project_items.append(
            {
                "project_id": p.id,
                "project_name": p.project_name,
                "status": p.status,
                "current_step": p.last_active_step,
                "created_at": p.created_at.isoformat() if p.created_at else None,
                "updated_at": p.updated_at.isoformat() if p.updated_at else None,
            }
        )

    txns = (
        db.query(UserCreditTransaction)
        .filter(UserCreditTransaction.user_id == u.id)
        .order_by(UserCreditTransaction.created_at.desc().nullslast(), UserCreditTransaction.id.desc())
        .limit(100)
        .all()
    )
    credit_transactions = [
        {
            "transaction_id": t.id,
            "type": t.transaction_type,
            "amount": t.amount,
            "balance_before": t.balance_before,
            "balance_after": t.balance_after,
            "note": t.note,
            "created_at": t.created_at.isoformat() if t.created_at else None,
        }
        for t in txns
    ]

    api_rows = (
        db.query(ApiCallLog)
        .filter(ApiCallLog.user_id == u.id)
        .order_by(ApiCallLog.created_at.desc().nullslast())
        .limit(50)
        .all()
    )
    api_usage = [
        {
            "api_call_id": lg.id,
            "provider": lg.provider,
            "model": lg.model,
            "business_type": lg.business_type,
            "status": lg.status,
            "estimated_cost_usd": float(lg.estimated_cost_usd) if lg.estimated_cost_usd is not None else None,
            "created_at": lg.created_at.isoformat() if lg.created_at else None,
        }
        for lg in api_rows
    ]

    ops = (
        db.query(AdminOperationLog)
        .filter(AdminOperationLog.target_type == "user", AdminOperationLog.target_id == str(u.id))
        .order_by(AdminOperationLog.created_at.desc().nullslast())
        .limit(50)
        .all()
    )
    admin_operation_history = [
        {
            "log_id": o.id,
            "operator": o.operator_email,
            "action": o.action,
            "reason": o.reason,
            "created_at": o.created_at.isoformat() if o.created_at else None,
        }
        for o in ops
    ]

    return {
        "basic_info": {
            "user_id": u.id,
            "email": u.email,
            "username": u.username,
            "registered_at": u.created_at.isoformat() if u.created_at else None,
            "last_login": None,
            "status": getattr(u, "account_status", None) or "normal",
            "subscription": "free",
            "credit_balance": credit_balance,
        },
        "metrics": {
            "total_projects": int(total_projects),
            "total_assets": int(total_assets),
            "total_videos": int(total_videos),
            "total_credits_granted": int(granted),
            "total_credits_consumed": int(consumed),
            "estimated_api_cost": estimated_api_cost,
        },
        "projects": project_items,
        "credit_transactions": credit_transactions,
        "api_usage": api_usage,
        "admin_operation_history": admin_operation_history,
    }


@router.post("/users/{user_id}/credits/grant")
async def grant_user_credits(
    user_id: int,
    body: CreditGrantRequest,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin_user),
):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    try:
        after = admin_grant_credits(
            db,
            target_user=u,
            admin=admin,
            amount=body.amount,
            reason=body.reason,
            ip_address=_client_ip(request),
        )
        db.commit()
    except Exception:
        db.rollback()
        raise
    return {"credit_balance": after, "success": True}


@router.post("/users/{user_id}/credits/deduct")
async def deduct_user_credits(
    user_id: int,
    body: CreditDeductRequest,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin_user),
):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    try:
        after = admin_deduct_credits(
            db,
            target_user=u,
            admin=admin,
            amount=body.amount,
            reason=body.reason,
            ip_address=_client_ip(request),
        )
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise
    return {"credit_balance": after, "success": True}


@router.post("/users/{user_id}/disable")
async def disable_user(
    user_id: int,
    body: ReasonRequest,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin_user),
):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    before = {"status": getattr(u, "account_status", None), "is_active": u.is_active}
    u.account_status = "disabled"
    u.is_active = False
    db.add(
        AdminOperationLog(
            operator_admin_id=admin.id,
            operator_email=admin.email,
            action="disable_user",
            target_type="user",
            target_id=str(u.id),
            before_data=json.dumps(before, default=str),
            after_data=json.dumps({"status": "disabled", "is_active": False}, default=str),
            reason=body.reason,
            ip_address=_client_ip(request),
        )
    )
    db.commit()
    return {"success": True}


@router.post("/users/{user_id}/restore")
async def restore_user(
    user_id: int,
    body: ReasonRequest,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin_user),
):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    before = {"status": getattr(u, "account_status", None), "is_active": u.is_active}
    u.account_status = "normal"
    u.is_active = True
    db.add(
        AdminOperationLog(
            operator_admin_id=admin.id,
            operator_email=admin.email,
            action="restore_user",
            target_type="user",
            target_id=str(u.id),
            before_data=json.dumps(before, default=str),
            after_data=json.dumps({"status": "normal", "is_active": True}, default=str),
            reason=body.reason,
            ip_address=_client_ip(request),
        )
    )
    db.commit()
    return {"success": True}


@router.get("/projects")
async def list_projects(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_user),
    search: str | None = None,
    status: str | None = None,
    current_step: str | None = None,
    user_id: int | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    sort: str = Query("updated_at_desc"),
):
    q = db.query(ShortDramaProject).join(User, User.id == ShortDramaProject.user_id)
    if search:
        term = f"%{search.strip()}%"
        q = q.filter(ShortDramaProject.project_name.ilike(term))
    if status:
        q = q.filter(ShortDramaProject.status == status)
    if current_step:
        q = q.filter(ShortDramaProject.last_active_step == current_step)
    if user_id is not None:
        q = q.filter(ShortDramaProject.user_id == user_id)
    if sort == "created_at_desc":
        q = q.order_by(ShortDramaProject.created_at.desc().nullslast(), ShortDramaProject.id.desc())
    else:
        q = q.order_by(ShortDramaProject.updated_at.desc().nullslast(), ShortDramaProject.id.desc())

    total = q.count()
    rows = q.offset((page - 1) * page_size).limit(page_size).all()
    items = []
    for p in rows:
        owner = db.query(User).filter(User.id == p.user_id).first()
        assets_count = db.query(func.count(AssetEntity.id)).filter(AssetEntity.project_id == p.id).scalar() or 0
        videos_count = db.query(func.count(RenderJob.id)).filter(RenderJob.project_id == p.id).scalar() or 0
        credits_used = (
            db.query(func.coalesce(func.sum(-UserCreditTransaction.amount), 0))
            .filter(UserCreditTransaction.project_id == p.id, UserCreditTransaction.amount < 0)
            .scalar()
            or 0
        )
        api_calls = db.query(func.count(ApiCallLog.id)).filter(ApiCallLog.project_id == p.id).scalar() or 0
        items.append(
            {
                "project_id": p.id,
                "project_name": p.project_name,
                "user": {"user_id": p.user_id, "email": owner.email if owner else None},
                "current_step": p.last_active_step,
                "status": p.status,
                "assets_count": int(assets_count),
                "videos_count": int(videos_count),
                "credits_used": int(credits_used),
                "api_calls": int(api_calls),
                "last_error": _project_last_error(db, p.id),
                "created_at": p.created_at.isoformat() if p.created_at else None,
                "updated_at": p.updated_at.isoformat() if p.updated_at else None,
            }
        )
    return {"items": items, "total": total, "page": page, "page_size": page_size}


def _step_progress_for_project(p: ShortDramaProject) -> list[dict[str, Any]]:
    st = p.step_status if isinstance(p.step_status, dict) else {}
    rt = st.get("_runtime") if isinstance(st.get("_runtime"), dict) else {}

    def step_meta(key: str) -> tuple[str, str | None]:
        msg = None
        if isinstance(rt, dict):
            slot = rt.get(key)
            if isinstance(slot, dict):
                msg = slot.get("error_message") or slot.get("message")
        return (st.get(key) or "unknown"), msg

    defs = [
        ("S0", "step_0", "Project Settings"),
        ("S1", "step_1", "Product Understanding"),
        ("S2", "step_2", "Strategy & Script"),
        ("S3", "step_3", "Assets"),
        ("S4", "step_4", "Video Generation"),
    ]
    out = []
    for step_code, key, label in defs:
        if key == "step_0":
            stat = "completed" if p.id else "unknown"
            err = None
            updated = p.created_at.isoformat() if p.created_at else None
        else:
            stat, err = step_meta(key)
            updated = p.updated_at.isoformat() if p.updated_at else None
        out.append(
            {
                "step": step_code,
                "label": label,
                "status": stat,
                "updated_at": updated,
                "error_message": err,
            }
        )
    return out


@router.get("/projects/{project_id}")
async def get_project_detail(
    project_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_user),
):
    p = db.query(ShortDramaProject).filter(ShortDramaProject.id == project_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    owner = db.query(User).filter(User.id == p.user_id).first()
    credits_used = (
        db.query(func.coalesce(func.sum(-UserCreditTransaction.amount), 0))
        .filter(UserCreditTransaction.project_id == p.id, UserCreditTransaction.amount < 0)
        .scalar()
        or 0
    )
    cost_row = (
        db.query(
            func.coalesce(func.sum(ApiCallLog.estimated_cost_usd), 0),
            func.coalesce(func.sum(ApiCallLog.estimated_cost_cny), 0),
        )
        .filter(ApiCallLog.project_id == p.id)
        .one()
    )
    api_cost = float(cost_row[0] or 0) + float(cost_row[1] or 0) / 7.2

    assets = (
        db.query(AssetEntity).filter(AssetEntity.project_id == p.id).order_by(AssetEntity.id.asc()).limit(200).all()
    )
    asset_items = []
    for a in assets:
        asset_items.append(
            {
                "asset_id": a.id,
                "type": a.asset_type,
                "preview_url": _asset_preview_url(db, a),
                "status": a.status,
                "prompt": (a.base_prompt or "")[:2000],
                "credits_used": 0,
                "created_at": a.created_at.isoformat() if a.created_at else None,
            }
        )

    jobs = (
        db.query(RenderJob)
        .filter(RenderJob.project_id == p.id)
        .order_by(RenderJob.created_at.desc().nullslast(), RenderJob.id.desc())
        .limit(200)
        .all()
    )
    video_items = []
    for j in jobs:
        meta = j.meta_json if isinstance(j.meta_json, dict) else {}
        duration = meta.get("duration_sec") or meta.get("duration")
        video_items.append(
            {
                "video_id": j.id,
                "type": j.target_type,
                "preview_url": j.output_url,
                "video_url": j.output_url,
                "status": j.status,
                "duration": duration,
                "credits_used": 0,
                "api_cost": None,
                "error": j.error_message,
                "created_at": j.created_at.isoformat() if j.created_at else None,
            }
        )

    api_logs = (
        db.query(ApiCallLog)
        .filter(ApiCallLog.project_id == p.id)
        .order_by(ApiCallLog.created_at.desc().nullslast())
        .limit(80)
        .all()
    )
    api_log_items = [
        {
            "api_call_id": lg.id,
            "provider": lg.provider,
            "model": lg.model,
            "business_type": lg.business_type,
            "status": lg.status,
            "created_at": lg.created_at.isoformat() if lg.created_at else None,
        }
        for lg in api_logs
    ]

    errors: list[dict[str, Any]] = []
    for j in jobs:
        if j.status in ("failed", "error") and j.error_message:
            errors.append(
                {
                    "source": "render_job",
                    "id": j.id,
                    "message": str(j.error_message)[:2000],
                    "created_at": j.created_at.isoformat() if j.created_at else None,
                }
            )
    for a in assets:
        if a.status in ("failed", "error"):
            ex = a.extra_json if isinstance(a.extra_json, dict) else {}
            errors.append(
                {
                    "source": "asset",
                    "id": a.id,
                    "message": str(ex.get("error") or ex.get("last_error") or a.status),
                    "created_at": a.updated_at.isoformat() if a.updated_at else None,
                }
            )

    return {
        "basic_info": {
            "project_name": p.project_name,
            "project_id": p.id,
            "user_email": owner.email if owner else None,
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "updated_at": p.updated_at.isoformat() if p.updated_at else None,
            "current_step": p.last_active_step,
            "status": p.status,
            "credits_used": int(credits_used),
            "api_cost": api_cost,
        },
        "step_progress": _step_progress_for_project(p),
        "overview": {
            "pipeline_status": p.status,
            "last_active_step": p.last_active_step,
            "step_status": p.step_status,
        },
        "assets": asset_items,
        "videos": video_items,
        "api_logs": api_log_items,
        "errors": errors[:80],
    }


@router.get("/api-logs")
async def list_api_logs(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_user),
    provider: str | None = None,
    business_type: str | None = None,
    status: str | None = None,
    user_id: int | None = None,
    project_id: int | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    date_from: str | None = None,
    date_to: str | None = None,
):
    q = db.query(ApiCallLog)
    if provider:
        q = q.filter(ApiCallLog.provider == provider)
    if business_type:
        q = q.filter(ApiCallLog.business_type == business_type)
    if status:
        q = q.filter(ApiCallLog.status == status)
    if user_id is not None:
        q = q.filter(ApiCallLog.user_id == user_id)
    if project_id is not None:
        q = q.filter(ApiCallLog.project_id == project_id)
    df, dt = _parse_date_range(date_from, date_to)
    if df is not None:
        q = q.filter(ApiCallLog.created_at >= df)
    if dt is not None:
        q = q.filter(ApiCallLog.created_at <= dt)
    q = q.order_by(ApiCallLog.created_at.desc().nullslast(), ApiCallLog.id.desc())
    total = q.count()
    rows = q.offset((page - 1) * page_size).limit(page_size).all()
    items = []
    for lg in rows:
        u = db.query(User).filter(User.id == lg.user_id).first() if lg.user_id else None
        pr = (
            db.query(ShortDramaProject).filter(ShortDramaProject.id == lg.project_id).first()
            if lg.project_id
            else None
        )
        est = None
        if lg.estimated_cost_usd is not None or lg.estimated_cost_cny is not None:
            est = float(lg.estimated_cost_usd or 0) + float(lg.estimated_cost_cny or 0) / 7.2
        items.append(
            {
                "api_call_id": lg.id,
                "provider": lg.provider,
                "model": lg.model,
                "business_type": lg.business_type,
                "user": {"user_id": lg.user_id, "email": u.email if u else None},
                "project": {"project_id": lg.project_id, "name": pr.project_name if pr else None},
                "status": lg.status,
                "http_status": lg.http_status,
                "duration": lg.duration_ms,
                "estimated_cost": est,
                "error_message": lg.error_message,
                "created_at": lg.created_at.isoformat() if lg.created_at else None,
            }
        )
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/api-logs/{log_id}")
async def get_api_log_detail(
    log_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_user),
):
    lg = db.query(ApiCallLog).filter(ApiCallLog.id == log_id).first()
    if not lg:
        raise HTTPException(status_code=404, detail="Log not found")
    u = db.query(User).filter(User.id == lg.user_id).first() if lg.user_id else None
    pr = (
        db.query(ShortDramaProject).filter(ShortDramaProject.id == lg.project_id).first()
        if lg.project_id
        else None
    )
    rel_txn = None
    if lg.id:
        t = (
            db.query(UserCreditTransaction)
            .filter(UserCreditTransaction.api_call_log_id == lg.id)
            .order_by(UserCreditTransaction.id.desc())
            .first()
        )
        if t:
            rel_txn = {"transaction_id": t.id, "amount": t.amount, "type": t.transaction_type}
    est_usd = float(lg.estimated_cost_usd) if lg.estimated_cost_usd is not None else None
    est_cny = float(lg.estimated_cost_cny) if lg.estimated_cost_cny is not None else None
    return {
        "request_summary": lg.request_summary,
        "response_summary": lg.response_summary,
        "error_detail": {"code": lg.error_code, "message": lg.error_message},
        "related_user": {"user_id": lg.user_id, "email": u.email if u else None},
        "related_project": {"project_id": lg.project_id, "name": pr.project_name if pr else None},
        "related_credit_transaction": rel_txn,
        "timing": {
            "started_at": lg.started_at.isoformat() if lg.started_at else None,
            "finished_at": lg.finished_at.isoformat() if lg.finished_at else None,
            "duration_ms": lg.duration_ms,
            "created_at": lg.created_at.isoformat() if lg.created_at else None,
        },
        "estimated_cost": {"usd": est_usd, "cny": est_cny},
    }


@router.get("/credits/accounts")
async def list_credit_accounts(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_user),
    search: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    q = db.query(UserCreditAccount).join(User, User.id == UserCreditAccount.user_id)
    if search:
        term = f"%{search.strip()}%"
        q = q.filter(or_(User.email.ilike(term), User.username.ilike(term)))
    q = q.order_by(UserCreditAccount.updated_at.desc().nullslast(), UserCreditAccount.id.desc())
    total = q.count()
    rows = q.offset((page - 1) * page_size).limit(page_size).all()
    items = []
    for acc in rows:
        u = db.query(User).filter(User.id == acc.user_id).first()
        items.append(
            {
                "user": {"user_id": acc.user_id, "username": u.username if u else None},
                "email": u.email if u else None,
                "current_balance": int(acc.current_balance or 0),
                "total_granted": int(acc.total_granted or 0),
                "total_consumed": int(acc.total_consumed or 0),
                "total_refunded": int(acc.total_refunded or 0),
                "updated_at": acc.updated_at.isoformat() if acc.updated_at else None,
            }
        )
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/credits/transactions")
async def list_credit_transactions(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_user),
    user_id: int | None = None,
    transaction_type: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    q = db.query(UserCreditTransaction)
    if user_id is not None:
        q = q.filter(UserCreditTransaction.user_id == user_id)
    if transaction_type:
        q = q.filter(UserCreditTransaction.transaction_type == transaction_type)
    df, dt = _parse_date_range(date_from, date_to)
    if df is not None:
        q = q.filter(UserCreditTransaction.created_at >= df)
    if dt is not None:
        q = q.filter(UserCreditTransaction.created_at <= dt)
    q = q.order_by(UserCreditTransaction.created_at.desc().nullslast(), UserCreditTransaction.id.desc())
    total = q.count()
    rows = q.offset((page - 1) * page_size).limit(page_size).all()
    items = []
    for t in rows:
        u = db.query(User).filter(User.id == t.user_id).first()
        op = db.query(User).filter(User.id == t.operator_admin_id).first() if t.operator_admin_id else None
        rel = None
        if t.project_id or t.asset_id or t.related_object_type:
            rel = {
                "project_id": t.project_id,
                "asset_id": t.asset_id,
                "related_object_type": t.related_object_type,
                "related_object_id": t.related_object_id,
            }
        subscription_order = None
        if (
            t.transaction_type == "subscription_grant"
            and (t.related_object_type or "") == "payment_order"
            and t.related_object_id
            and str(t.related_object_id).isdigit()
        ):
            po = db.query(PaymentOrder).filter(PaymentOrder.id == int(t.related_object_id)).first()
            if po:
                subscription_order = {
                    "plan_code": po.plan_code,
                    "period": po.period,
                    "out_trade_no": po.out_trade_no,
                    "payment_provider": po.payment_provider or "alipay",
                }
        items.append(
            {
                "transaction_id": t.id,
                "user": {"user_id": t.user_id, "email": u.email if u else None},
                "type": t.transaction_type,
                "amount": t.amount,
                "balance_before": t.balance_before,
                "balance_after": t.balance_after,
                "related_object": rel,
                "subscription_order": subscription_order,
                "operator": {"type": t.operator_type, "admin_email": op.email if op else None},
                "note": t.note,
                "created_at": t.created_at.isoformat() if t.created_at else None,
            }
        )
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/operation-logs")
async def list_operation_logs(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_user),
    operator: str | None = None,
    action: str | None = None,
    target_type: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    q = db.query(AdminOperationLog)
    if operator:
        q = q.filter(AdminOperationLog.operator_email.ilike(f"%{operator.strip()}%"))
    if action:
        q = q.filter(AdminOperationLog.action == action)
    if target_type:
        q = q.filter(AdminOperationLog.target_type == target_type)
    df, dt = _parse_date_range(date_from, date_to)
    if df is not None:
        q = q.filter(AdminOperationLog.created_at >= df)
    if dt is not None:
        q = q.filter(AdminOperationLog.created_at <= dt)
    q = q.order_by(AdminOperationLog.created_at.desc().nullslast(), AdminOperationLog.id.desc())
    total = q.count()
    rows = q.offset((page - 1) * page_size).limit(page_size).all()
    items = []
    for o in rows:
        items.append(
            {
                "log_id": o.id,
                "operator": o.operator_email,
                "action": o.action,
                "target_type": o.target_type,
                "target_id": o.target_id,
                "before": o.before_data,
                "after": o.after_data,
                "reason": o.reason,
                "ip": o.ip_address,
                "created_at": o.created_at.isoformat() if o.created_at else None,
            }
        )
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/settings")
async def admin_settings(_: User = Depends(require_admin_user)):
    return {
        "credit_rules": {
            "text_understanding_cost": 3,
            "image_understanding_cost": 5,
            "script_generation_cost": 30,
            "asset_generation_cost": 15,
            "video_generation_cost": 120,
            "hd_export_cost": 20,
            "full_video_compose_cost": 0,
            "refund_policy": "Refund on provider/system failure",
            "manual_adjustment_requires_reason": True,
        },
        "api_providers": [
            {"id": "xAI", "label": "xAI"},
            {"id": "Gemini", "label": "Gemini"},
            {"id": "Cloudflare R2", "label": "Cloudflare R2"},
            {"id": "Other", "label": "Other"},
        ],
        "admin_roles": [
            {"role": "admin", "description": "Standard administrator"},
            {"role": "super_admin", "description": "Full administrative access"},
            {"role": "user", "description": "No admin access"},
        ],
        "timezone": str(TZ_ADMIN),
    }
