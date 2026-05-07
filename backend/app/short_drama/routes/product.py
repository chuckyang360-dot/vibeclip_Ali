import logging
import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import ValidationError
from sqlalchemy.orm import Session

from ...database import SessionLocal, get_db
from ..exceptions import ShortDramaInvalidModelOutputError, ShortDramaProviderError
from ..http_errors import raise_short_drama_http
from ..models import ProductContextRecord
from ..schemas.product import (
    ParseProductRequest,
    ParseProductResponse,
    ProductContextSchema,
    ProductImageUnderstandingSchema,
    UpdateProductContextRequest,
    UpdateProductContextResponse,
)
from ..services.product_parser_service import product_parser_service
from ..services.project_state_service import (
    STEP_1,
    mark_step_completed,
    propagate_downstream_stale,
    update_last_active_step,
)
from ..services.read_models import latest_product_context, next_product_context_version
from ..services.workflow_orchestrator import orchestrator
from ..services.project_task_guard import (
    acquire_project_task_lock,
    mark_project_stage_failed,
    mark_project_stage_succeeded,
    recover_stale_processing_status_if_possible,
)
from ..utils.enums import WorkflowStep
from ..utils.flow_logging import log_api_error, log_api_request, log_api_success
from ..utils.language import build_language_policy, language_prompt_rules

logger = logging.getLogger(__name__)


def _trace(tag: str, payload: dict) -> None:
    logger.info("[AI_CHAIN_TRACE][%s] %s", tag, json.dumps(payload, ensure_ascii=False, default=str))

router = APIRouter()

_PRODUCT_CONTEXT_FIELDS = [
    "product_name",
    "product_category",
    "product_summary",
    "core_selling_points",
    "target_users",
    "usage_scenarios",
    "visual_features",
    "product_form",
    "key_functions",
    "emotional_value",
    "suitable_story_angles",
    "user_pain_points",
    "visual_risk_notes",
    "consistency_notes",
    "immutable_structure_constraints",
    "extracted_from_images",
    "parse_confidence",
    "source_trace",
]


def _redact_image_url(raw: object) -> dict[str, object]:
    text = str(raw or "").strip()
    if not text:
        return {
            "image_url_type": "unknown",
            "image_preview": "",
            "image_size_chars": 0,
        }
    image_url_type = "data_url" if text.startswith("data:image/") else "remote_url"
    return {
        "image_url_type": image_url_type,
        "image_preview": f"{text[:40]}...<redacted>",
        "image_size_chars": len(text),
    }


def _sanitize_parse_input_for_log(raw_input: dict[str, object]) -> dict[str, object]:
    sanitized = dict(raw_input)
    image_rows = raw_input.get("product_images")
    if isinstance(image_rows, list):
        sanitized_images: list[dict[str, object]] = []
        for row in image_rows:
            item = row if isinstance(row, dict) else {}
            sanitized_images.append(
                {
                    "image_order": item.get("image_order"),
                    "is_main_image": bool(item.get("is_main_image")),
                    **_redact_image_url(item.get("image_url")),
                }
            )
        sanitized["product_images"] = {
            "image_count": len(image_rows),
            "items": sanitized_images,
        }
    return sanitized


def _merge_context_by_mode(
    mode: str,
    prev: ProductContextSchema | None,
    nxt: ProductContextSchema,
) -> tuple[ProductContextSchema, list[str], list[str]]:
    if mode != "preserve_user_edited" or prev is None:
        return nxt, list(_PRODUCT_CONTEXT_FIELDS), []
    prev_data = prev.model_dump()
    next_data = nxt.model_dump()
    field_meta = dict(prev_data.get("field_meta") or {})
    updated_fields: list[str] = []
    preserved_fields: list[str] = []
    for field in _PRODUCT_CONTEXT_FIELDS:
        meta = field_meta.get(field) if isinstance(field_meta.get(field), dict) else {}
        edited = bool(meta.get("edited_by_user"))
        if edited:
            next_data[field] = prev_data.get(field)
            preserved_fields.append(field)
        else:
            updated_fields.append(field)
    next_data["field_meta"] = field_meta
    return ProductContextSchema.model_validate(next_data), updated_fields, preserved_fields


@router.post("/parse", response_model=ParseProductResponse)
async def parse_product(body: ParseProductRequest, db: Session = Depends(get_db)):
    log_api_request(logger, "POST /product/parse", project_id=body.project_id)
    safe_input = _sanitize_parse_input_for_log(body.input.model_dump())
    _trace(
        "S1_USER_INPUT",
        {
            "project_id": body.project_id,
            "reparse_mode": body.reparse_mode,
            "input": body.input.model_dump(),
            "input_sanitized_for_log": safe_input,
            "uploaded_image_count": len(body.input.product_images or []),
        },
    )
    logger.info(
        "[S1_PARSE_REQUEST] project_id=%s reparse_mode=%s input=%s",
        body.project_id,
        body.reparse_mode,
        safe_input,
    )
    lock_acquired = False
    try:
        project = orchestrator.get_project(db, body.project_id)
        recover_stale_processing_status_if_possible(db, project)
        project = orchestrator.get_project(db, body.project_id)
        orchestrator.assert_step_allowed(db, project, WorkflowStep.PARSE_PRODUCT)
        acquire_project_task_lock(db, project, stage="s1_product")
        lock_acquired = True
        existing_context = latest_product_context(db, body.project_id)
        had_existing_context = existing_context is not None

        status_before = project.status
        language_policy = build_language_policy(
            workflow_source=body.input.model_dump(),
            market_source={
                "target_users_raw": body.input.target_users_raw,
                "usage_scenarios_raw": body.input.usage_scenarios_raw,
                "extra_notes_raw": body.input.extra_notes_raw,
            },
            explicit_target_market=(project.target_market or "North America"),
        )
        project_constraints = {
            "duration": project.duration or "",
            "format": project.format or "",
            "style": project.style or "",
            "visual_style": project.visual_style or "",
            "aspect_ratio": project.aspect_ratio or "",
            "target_market": language_policy["target_market"],
            "creative_intent": project.creative_intent or "",
            "legacy_creative_intent_summary": "；".join(
                [
                    x
                    for x in [
                        f"营销目标：{project.marketing_goal}" if project.marketing_goal else "",
                        f"目标受众：{project.target_audience}" if project.target_audience else "",
                        f"品牌调性：{project.brand_tone}" if project.brand_tone else "",
                        f"补充说明：{project.creative_brief}" if project.creative_brief else "",
                    ]
                    if x
                ]
            ),
            "workflow_language": language_policy["workflow_language"],
            "video_language": language_policy["video_language"],
            "language_policy": language_policy,
            "language_prompt_rules": language_prompt_rules(language_policy),
        }
        logger.info("[S1_DB_RELEASE_BEFORE_EXTERNAL_CALL] project_id=%s", body.project_id)
        db.close()
        try:
            artifacts = product_parser_service.parse(
                body.project_id,
                body.input,
                project_constraints=project_constraints,
            )
        except (ShortDramaProviderError, ShortDramaInvalidModelOutputError) as e:
            logger.info(
                "[SHORT_DRAMA_STEP_FAIL] project_id=%s step=%s error_type=%s project_status_before=%s project_status_after=%s",
                body.project_id,
                "S1_parse_product",
                type(e).__name__,
                status_before,
                project.status,
            )
            raise_short_drama_http(e)
        except Exception as e:
            logger.info(
                "[SHORT_DRAMA_STEP_FAIL] project_id=%s step=%s error_type=%s project_status_before=%s project_status_after=%s",
                body.project_id,
                "S1_parse_product",
                type(e).__name__,
                status_before,
                project.status,
            )
            logger.exception("Product parse unexpected error project_id=%s", body.project_id)
            if isinstance(e, (ValidationError, ValueError, TypeError)):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="产品解析失败，请检查输入内容或稍后重试。",
                )
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="产品解析服务暂时异常，请稍后重试。",
            )

        logger.info("[S1_DB_REOPEN_FOR_WRITEBACK] project_id=%s", body.project_id)
        write_db = SessionLocal()
        try:
            write_project = orchestrator.get_project(write_db, body.project_id)
            prev_ctx = (
            ProductContextSchema.model_validate(existing_context.normalized_context_json)
            if existing_context
            else None
            )
            merged_context, updated_fields, preserved_fields = _merge_context_by_mode(
                body.reparse_mode,
                prev_ctx,
                artifacts.product_context,
            )
            version = next_product_context_version(write_db, body.project_id)
            record = ProductContextRecord(
                project_id=body.project_id,
                raw_inputs_json=artifacts.raw_input.model_dump(),
                image_understanding_json=artifacts.image_understanding.model_dump(),
                normalized_context_json=merged_context.model_dump(),
                parse_status="success",
                version=version,
            )
            write_db.add(record)
            _trace(
                "S1_CONTEXT_NORMALIZED",
                {
                    "project_id": body.project_id,
                    "updated_fields": updated_fields,
                    "preserved_fields": preserved_fields,
                    "fallback_or_overrides": [
                        {"field": f, "reason": "preserve_user_edited"}
                        for f in preserved_fields
                    ],
                    "normalized_context_final": merged_context.model_dump(),
                },
            )
            mark_step_completed(write_project, STEP_1)
            if had_existing_context:
                propagate_downstream_stale(write_project, STEP_1)
            update_last_active_step(write_project, STEP_1)
            orchestrator.advance_on_success(write_db, write_project, WorkflowStep.PARSE_PRODUCT)
            write_db.commit()
            write_db.refresh(record)
            final_status = write_project.status
        except Exception:
            write_db.rollback()
            raise
        finally:
            write_db.close()
        post_db = SessionLocal()
        try:
            mark_project_stage_succeeded(
                post_db,
                body.project_id,
                stage="s1_product",
                status_after=final_status,
            )
        finally:
            post_db.close()

        log_api_success(
            logger,
            "POST /product/parse",
            project_id=body.project_id,
            record_id=record.id,
            version=record.version,
        )
        resp = ParseProductResponse(
            record_id=record.id,
            project_id=body.project_id,
            version=record.version,
            parse_status=record.parse_status or "success",
            raw_inputs=record.raw_inputs_json,
            image_understanding=ProductImageUnderstandingSchema.model_validate(
                record.image_understanding_json or {}
            ),
            product_context=ProductContextSchema.model_validate(record.normalized_context_json),
            from_version=existing_context.version if existing_context else None,
            updated_fields=updated_fields,
            preserved_fields=preserved_fields,
            created_at=record.created_at,
        )
        logger.info(
            "[S1_PARSE_RESPONSE] project_id=%s record_id=%s version=%s from_version=%s updated_fields=%s preserved_fields=%s",
            body.project_id,
            record.id,
            record.version,
            existing_context.version if existing_context else None,
            updated_fields,
            preserved_fields,
        )
        return resp
        
    except HTTPException as e:
        if lock_acquired:
            fail_db = SessionLocal()
            try:
                mark_project_stage_failed(
                    fail_db,
                    body.project_id,
                    stage="s1_product",
                    error_type_value="storage_or_db_error" if e.status_code >= 500 else "request_conflict",
                    message=str(e.detail),
                )
            except Exception:
                pass
            finally:
                fail_db.close()
        log_api_error(
            logger,
            "POST /product/parse",
            str(e.detail),
            project_id=body.project_id,
            status_code=e.status_code,
        )
        raise


@router.patch("/context", response_model=UpdateProductContextResponse)
async def update_product_context(body: UpdateProductContextRequest, db: Session = Depends(get_db)):
    project = orchestrator.get_project(db, body.project_id)
    orchestrator.assert_step_allowed(db, project, WorkflowStep.PARSE_PRODUCT)
    latest = latest_product_context(db, body.project_id)
    if not latest:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Product context missing; run parse first")
    version = next_product_context_version(db, body.project_id)
    latest_ctx = ProductContextSchema.model_validate(latest.normalized_context_json)
    incoming = body.product_context.model_dump()
    latest_data = latest_ctx.model_dump()
    field_meta = dict(latest_data.get("field_meta") or {})
    for field in _PRODUCT_CONTEXT_FIELDS:
        if incoming.get(field) != latest_data.get(field):
            prev_meta = field_meta.get(field) if isinstance(field_meta.get(field), dict) else {}
            field_meta[field] = {
                **prev_meta,
                "edited_by_user": True,
                "edited_at": datetime.utcnow().isoformat(),
            }
    incoming["field_meta"] = field_meta
    record = ProductContextRecord(
        project_id=body.project_id,
        raw_inputs_json=latest.raw_inputs_json,
        image_understanding_json=latest.image_understanding_json,
        normalized_context_json=incoming,
        parse_status="edited",
        version=version,
    )
    db.add(record)
    mark_step_completed(project, STEP_1)
    propagate_downstream_stale(project, STEP_1)
    update_last_active_step(project, STEP_1)
    db.commit()
    db.refresh(record)
    return UpdateProductContextResponse(
        record_id=record.id,
        project_id=body.project_id,
        version=record.version,
        parse_status=record.parse_status or "edited",
        product_context=ProductContextSchema.model_validate(record.normalized_context_json),
        created_at=record.created_at,
    )
