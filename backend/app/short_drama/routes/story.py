import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ...database import SessionLocal, get_db
from ..exceptions import ShortDramaInvalidModelOutputError, ShortDramaProviderError
from ..http_errors import raise_short_drama_http
from ..models import StoryBlueprintRecord
from ..schemas.product import ProductContextSchema
from ..schemas.story import GenerateStoryRequest, GenerateStoryResponse, StoryBlueprintSchema
from ..services.read_models import (
    latest_product_context,
    latest_story_blueprint,
    list_pipeline_asset_rows,
    list_segment_scripts,
    next_story_version,
)
from ..services.project_state_service import (
    STEP_2,
    mark_step_completed,
    propagate_downstream_stale,
    update_last_active_step,
)
from ..services.story_planner_service import story_planner_service
from ..services.workflow_orchestrator import orchestrator
from ..services.project_task_guard import (
    acquire_project_task_lock,
    current_stage,
    mark_project_stage_failed,
    mark_project_stage_succeeded,
    recover_stale_processing_status_if_possible,
)
from ..utils.creative_brief import build_creative_brief
from ..utils.enums import WorkflowStep
from ..utils.flow_logging import log_api_error, log_api_request, log_api_success
from ..utils.language import build_language_policy, language_prompt_rules

logger = logging.getLogger(__name__)

router = APIRouter()


def _asset_req_preview_rows(rows: object, keys: list[str], limit: int = 2) -> list[dict]:
    if not isinstance(rows, list):
        return []
    out: list[dict] = []
    for row in rows[:limit]:
        if not isinstance(row, dict):
            continue
        out.append({k: row.get(k) for k in keys})
    return out


@router.post("/generate", response_model=GenerateStoryResponse)
async def generate_story(body: GenerateStoryRequest, db: Session = Depends(get_db)):
    log_api_request(logger, "POST /story/generate", project_id=body.project_id)
    lock_acquired = False
    try:
        project = orchestrator.get_project(db, body.project_id)
        recover_stale_processing_status_if_possible(db, project)
        project = orchestrator.get_project(db, body.project_id)
        pc_for_check = latest_product_context(db, body.project_id)
        sb_for_check = latest_story_blueprint(db, body.project_id)
        chars, scenes, products = list_pipeline_asset_rows(db, body.project_id)
        segs = list_segment_scripts(db, body.project_id)
        stage_now = current_stage(project)
        runtime_now = dict((project.step_status or {}).get("_runtime") or {})
        task_running_now = bool(runtime_now.get("task_running", False))
        logger.info(
            "[STEP_ALLOWED_CHECK] project_id=%s step=%s current_status=%s required_status=%s current_stage=%s task_running=%s has_product_context=%s has_story_blueprint=%s asset_counts=%s segment_scripts_count=%s",
            body.project_id,
            WorkflowStep.GENERATE_STORY.value,
            project.status,
            "product_parsed",
            stage_now,
            task_running_now,
            bool(pc_for_check),
            bool(sb_for_check),
            {"characters": len(chars), "scenes": len(scenes), "products": len(products)},
            len(segs),
        )

        if str(project.status or "").strip() == "processing" and task_running_now and stage_now:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "detail": "Project is currently processing. Please wait or retry after it finishes.",
                    "current_stage": stage_now,
                    "status": project.status,
                },
            )

        orchestrator.assert_step_allowed(db, project, WorkflowStep.GENERATE_STORY)
        acquire_project_task_lock(db, project, stage="s2_story")
        lock_acquired = True
        had_existing_story = latest_story_blueprint(db, body.project_id) is not None

        pc_row = latest_product_context(db, body.project_id)
        if not pc_row:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Product context missing; run /product/parse first",
            )

        product = ProductContextSchema.model_validate(pc_row.normalized_context_json)
        language_policy = build_language_policy(
            workflow_source={"product": product.model_dump(), "raw_inputs": pc_row.raw_inputs_json},
            market_source={
                "raw_inputs": pc_row.raw_inputs_json,
                "target_users": product.target_users,
                "usage_scenarios": product.usage_scenarios,
            },
            explicit_target_market=(project.target_market or "North America"),
        )
        project_config = {
            "project_id": body.project_id,
            "duration": project.duration,
            "format": project.format,
            "style": project.style,
            "visual_style": project.visual_style,
            "aspect_ratio": project.aspect_ratio,
            "target_market": language_policy["target_market"],
            "marketing_goal": project.marketing_goal or "brand_seeding",
            "target_audience": project.target_audience or "",
            "brand_tone": project.brand_tone or "natural",
            "creative_intent": project.creative_intent or "",
            "creative_brief": project.creative_brief or "",
            "workflow_language": language_policy["workflow_language"],
            "video_language": language_policy["video_language"],
            "language_policy": language_policy,
            "language_prompt_rules": language_prompt_rules(language_policy),
        }
        project_config["legacy_creative_intent_summary"] = "；".join(
            [
                x
                for x in [
                    f"营销目标：{project_config['marketing_goal']}" if project_config["marketing_goal"] else "",
                    f"目标受众：{project_config['target_audience']}" if project_config["target_audience"] else "",
                    f"品牌调性：{project_config['brand_tone']}" if project_config["brand_tone"] else "",
                    f"补充说明：{project_config['creative_brief']}" if project_config["creative_brief"] else "",
                ]
                if x
            ]
        )
        project_config["effective_creative_intent"] = (
            project_config["creative_intent"] or project_config["legacy_creative_intent_summary"]
        )
        project_config["creative_brief_data"] = build_creative_brief(project_config, product)

        status_before = project.status
        story_input_product = product
        story_input_config = project_config
        logger.info("[S2_DB_RELEASE_BEFORE_EXTERNAL_CALL] project_id=%s", body.project_id)
        db.close()
        try:
            blueprint = story_planner_service.generate(body.project_id, story_input_product, story_input_config)
        except (ShortDramaProviderError, ShortDramaInvalidModelOutputError) as e:
            logger.info(
                "[SHORT_DRAMA_STEP_FAIL] project_id=%s step=%s error_type=%s project_status_before=%s project_status_after=%s",
                body.project_id,
                "S2_generate_story",
                type(e).__name__,
                status_before,
                project.status,
            )
            raise_short_drama_http(e)
        except Exception as e:
            logger.info(
                "[SHORT_DRAMA_STEP_FAIL] project_id=%s step=%s error_type=%s project_status_before=%s project_status_after=%s",
                body.project_id,
                "S2_generate_story",
                type(e).__name__,
                status_before,
                project.status,
            )
            logger.exception("Story generation unexpected error project_id=%s", body.project_id)
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Story generation failed")

        req = blueprint.asset_requirements if isinstance(blueprint.asset_requirements, dict) else {}
        chars = req.get("characters") if isinstance(req.get("characters"), list) else []
        scenes = req.get("scenes") if isinstance(req.get("scenes"), list) else []
        products = req.get("products") if isinstance(req.get("products"), list) else []
        logger.info(
            "[S2_ASSET_REQUIREMENTS_OUTPUT] %s",
            {
                "project_id": body.project_id,
                "target_market": project_config.get("target_market"),
                "target_audience": project_config.get("target_audience"),
                "marketing_goal": project_config.get("marketing_goal"),
                "character_count": len(chars),
                "scene_count": len(scenes),
                "product_count": len(products),
                "characters_preview": _asset_req_preview_rows(
                    chars,
                    ["id", "name", "role", "identity", "appearance", "costume", "market_constraints"],
                ),
                "scenes_preview": _asset_req_preview_rows(
                    scenes,
                    ["id", "name", "location", "atmosphere", "props", "market_constraints"],
                ),
                "products_preview": _asset_req_preview_rows(
                    products,
                    ["id", "name", "product_role", "form", "visual_features", "market_constraints"],
                ),
            },
        )

        logger.info("[S2_DB_REOPEN_FOR_WRITEBACK] project_id=%s", body.project_id)
        write_db = SessionLocal()
        try:
            write_project = orchestrator.get_project(write_db, body.project_id)
            version = next_story_version(write_db, body.project_id)
            record = StoryBlueprintRecord(
                project_id=body.project_id,
                blueprint_json=blueprint.model_dump(),
                version=version,
                approved=False,
            )
            write_db.add(record)
            mark_step_completed(write_project, STEP_2)
            if had_existing_story:
                propagate_downstream_stale(write_project, STEP_2)
            update_last_active_step(write_project, STEP_2)
            orchestrator.advance_on_success(write_db, write_project, WorkflowStep.GENERATE_STORY)
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
            mark_project_stage_succeeded(post_db, body.project_id, stage="s2_story", status_after=final_status)
        finally:
            post_db.close()

        log_api_success(
            logger,
            "POST /story/generate",
            project_id=body.project_id,
            record_id=record.id,
            version=record.version,
        )
        return GenerateStoryResponse(
            record_id=record.id,
            project_id=body.project_id,
            version=record.version,
            blueprint=StoryBlueprintSchema.model_validate(record.blueprint_json),
            approved=record.approved,
            created_at=record.created_at,
        )
    except HTTPException as e:
        if lock_acquired:
            et = "storage_or_db_error" if e.status_code >= 500 else "request_conflict"
            if isinstance(e.detail, dict):
                et = str(e.detail.get("error_type") or et)
            fail_db = SessionLocal()
            try:
                mark_project_stage_failed(
                    fail_db,
                    body.project_id,
                    stage="s2_story",
                    error_type_value=et,
                    message=str(e.detail),
                )
            except Exception:
                pass
            finally:
                fail_db.close()
        log_api_error(
            logger,
            "POST /story/generate",
            str(e.detail),
            project_id=body.project_id,
            status_code=e.status_code,
        )
        raise
