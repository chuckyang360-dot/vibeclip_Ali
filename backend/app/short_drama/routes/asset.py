import logging
import json

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ...database import SessionLocal, get_db
from ..exceptions import ShortDramaInvalidModelOutputError, ShortDramaProviderError
from ..exceptions import ShortDramaImageProviderError
from ..http_errors import raise_short_drama_http
from ..models import AssetEntity, AssetImage, CharacterAsset, ProductAsset, SceneAsset
from ..schemas.asset import (
    AnalyzeAssetReferenceImageRequest,
    AnalyzeAssetReferenceImageResponse,
    AppendUploadedImagesRequest,
    AssetDetailSchema,
    AssetListResponse,
    AssetSpecsBundleSchema,
    CharacterAssetSchema,
    CreateAssetFromImageRequest,
    CreateAssetRequest,
    GenerateAssetSpecsRequest,
    GenerateAssetSpecsResponse,
    ProductAssetSchema,
    RepairSceneStructureRequest,
    RepairSceneStructureResponse,
    RegenerateAssetRequest,
    SetAssetCoverRequest,
    UpdateAssetMetaRequest,
    UpdateAssetRequest,
    UpdateAssetResponse,
    SceneAssetSchema,
)
from ..services.project_state_service import STEP_3, mark_step_completed, propagate_downstream_stale, update_last_active_step
from ..schemas.product import ProductContextSchema
from ..schemas.story import parse_story_blueprint_json
from ..services.asset_spec_service import (
    asset_bundle_from_story_requirements,
    asset_spec_service,
    inspect_asset_requirements_source,
    resolve_scene_fields,
)
from ..services.asset_library_service import asset_library_service
from ..services.asset_v2_materialize_service import (
    build_v2_asset_specs_bundle,
    is_creative_blueprint_v2_project,
    persist_v2_asset_specs_bundle_to_legacy_tables,
)
from ..services.read_models import latest_product_context, latest_story_blueprint
from ..services.workflow_orchestrator import orchestrator
from ..services.image_understanding_service import validate_supported_image_data_url
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
_XAI_IMAGE_QUOTA_DETAIL = "xAI 图片生成额度已耗尽或达到月度消费上限，请充值或提高 spending limit 后重试。"


def _is_xai_image_quota_exhausted(exc: Exception) -> bool:
    text = str(exc or "").lower()
    category = str(getattr(exc, "category", "") or "").lower()
    quota_markers = [
        "429",
        "quota",
        "spending limit",
        "rate limited",
        "resource has been exhausted",
        "used all available credits",
        "monthly spending limit",
    ]
    if category in {"quota", "rate_limit"}:
        return True
    return any(marker in text for marker in quota_markers)




def _preview_text(value: str | None, limit: int = 240) -> str:
    text = str(value or "").strip()
    return text if len(text) <= limit else f"{text[:limit]}..."


def _is_bad_display_text(text: str) -> bool:
    v = str(text or "").strip().lower()
    if not v:
        return True
    blocked = [
        "main character",
        "scene location",
        "character_",
        "scene_",
        "product_",
        "product-only reference asset",
        "reusable empty location reference",
        "clean character reference",
        "empty reusable location background plate",
    ]
    return any(k in v for k in blocked)


def _contains_any(text: str, phrases: list[str]) -> bool:
    low = str(text or "").strip().lower()
    if not low:
        return False
    return any(p.lower() in low for p in phrases)


def _as_text(value: object) -> str:
    return str(value or "").strip()


def _join_non_empty(parts: list[str], sep: str = "，") -> str:
    return sep.join([p for p in parts if _as_text(p)])


def _extract_time_phrase(*texts: str) -> str:
    corpus = " ".join([_as_text(t).lower() for t in texts if _as_text(t)])
    if any(k in corpus for k in ["清晨", "早高峰", "morning", "commute"]):
        return "清晨"
    if any(k in corpus for k in ["夜", "night", "晚"]):
        return "傍晚"
    return "日间"


def _extract_market_token(target_market: str) -> str:
    m = _as_text(target_market)
    low = m.lower()
    if "southeast asia" in low or "东南亚" in m:
        return "东南亚"
    if "china" in low or "中国" in m:
        return "中国"
    return "城市"


def _character_name_is_too_generic(name: str, target_audience: str) -> bool:
    v = _as_text(name)
    if not v:
        return True
    bad = ["都市青年", "都市年轻人", "main character", "character_", "主角"]
    if _contains_any(v, bad):
        return True
    return v == _as_text(target_audience)


def build_character_display_name(
    *,
    target_market: str,
    target_audience: str,
    role_type: str,
    scenario: str,
    marketing_goal: str,
) -> str:
    market = _extract_market_token(target_market)
    scenario_low = scenario.lower()
    if "通勤" in scenario or "commute" in scenario_low:
        scene_token = "通勤"
    elif "穿搭" in scenario or "outfit" in scenario_low:
        scene_token = "穿搭"
    else:
        scene_token = "日常"
    role = "主角" if role_type in {"main", "hero", "主角"} else "角色"
    if "男" in target_audience or "male" in target_audience.lower():
        audience = "青年"
    else:
        audience = "青年"
    if "brand_seeding" in marketing_goal.lower() or "种草" in marketing_goal:
        return f"{market}{scene_token}{audience}{role if role == '主角' else ''}".strip()
    return f"{market}{scene_token}{audience}{role if role == '主角' else ''}".strip()


def build_scene_display_name(
    *,
    primary_location: str,
    time_of_day: str,
    atmosphere: str,
    story_usage: str,
    target_market: str,
) -> str:
    loc = _as_text(primary_location) or "通勤场景"
    market = _extract_market_token(target_market)
    t = _as_text(time_of_day) or _extract_time_phrase(loc, story_usage, atmosphere)
    if "地铁" in loc or "metro" in loc.lower() or "subway" in loc.lower():
        return f"{t}地铁站通勤走廊"
    if "街" in loc or "street" in loc.lower():
        return f"{market}街头通勤路口"
    if "公寓" in loc or "apartment" in loc.lower():
        return f"{t}公寓玄关出门区"
    return f"{t}{loc}"


def _good_character_description(target_market: str, target_audience: str, story_usage: str) -> str:
    return (
        f"一位生活在{_extract_market_token(target_market)}城市的{target_audience or '年轻通勤者'}，"
        f"注重穿搭和日常便利，{story_usage or '负责承载产品在生活场景中的自然露出'}。"
    )


def _good_scene_description(target_market: str, location: str, lighting: str, atmosphere: str) -> str:
    return (
        f"{_extract_time_phrase(location, atmosphere)}的{_extract_market_token(target_market)}{location or '城市通勤空间'}，"
        f"{lighting or '光线明亮柔和'}，整体{atmosphere or '轻松日常且有都市节奏'}，"
        "适合表现年轻人通勤过程中的自然动作与产品露出。"
    )


def _good_product_description(name: str, form: str, features: list[str]) -> str:
    f = "、".join([_as_text(x) for x in features if _as_text(x)][:4]) or "产品外观与结构细节"
    return f"{name or '主商品'}以{form or '产品主体结构'}为核心，突出{f}，适合在生活化镜头中自然展示质感。"


def _infer_plot_stage(marketing_goal: str, story_usage: str, narrative_function: str, asset_type: str) -> str:
    corpus = f"{marketing_goal} {story_usage} {narrative_function}".lower()
    if "brand_seeding" in corpus or "种草" in corpus:
        if asset_type == "product":
            return "产品自然出现"
        if asset_type == "scene":
            return "生活场景"
        return "情绪共鸣"
    if "hook" in corpus:
        return "记忆点"
    return "生活场景"


def _infer_scene_form(asset_type: str, story_usage: str, scene_form: str = "") -> str:
    if asset_type == "character":
        return "主角人物资产"
    if asset_type == "product":
        return "主商品展示资产"
    usage = _as_text(story_usage)
    if "通勤" in usage:
        return "单地点通勤场景"
    return "单地点生活方式场景"


def _build_structure_summary(asset_type: str, scene_form: str, story_usage: str, core: str) -> str:
    if asset_type == "character":
        return f"{scene_form}，用于{story_usage or '通勤、穿搭和产品自然露出'}。"
    if asset_type == "scene":
        return f"{scene_form}，用于承载{story_usage or '主角日常动作和产品自然露出'}。"
    return f"{scene_form}，用于强化{core or '产品核心外观细节'}记忆点。"


def _zh_fallback_name(asset_type: str) -> str:
    if asset_type == "character":
        return "都市年轻主角"
    if asset_type == "scene":
        return "城市通勤场景"
    return "主商品资产"


def _missing_fields_of(values: dict[str, object], required: list[str]) -> list[str]:
    out: list[str] = []
    for key in required:
        value = values.get(key)
        if isinstance(value, list):
            if not value:
                out.append(key)
            continue
        if not str(value or "").strip():
            out.append(key)
    return out


def _mark_step3_and_stale_step4(db: Session, project_id: int) -> None:
    project = orchestrator.get_project(db, project_id)
    mark_step_completed(project, STEP_3)
    propagate_downstream_stale(project, STEP_3)
    update_last_active_step(project, STEP_3)
    db.add(project)


@router.patch("/{asset_type}/{asset_id}", response_model=UpdateAssetResponse)
async def update_one_asset(
    asset_type: str,
    asset_id: int,
    body: UpdateAssetRequest,
    db: Session = Depends(get_db),
):
    model_map = {
        "character": CharacterAsset,
        "scene": SceneAsset,
        "product": ProductAsset,
    }
    m = model_map.get((asset_type or "").strip().lower())
    if m is None:
        raise HTTPException(status_code=400, detail="Invalid asset_type")
    row = db.query(m).filter(m.id == asset_id, m.project_id == body.project_id).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Asset not found")
    project = orchestrator.get_project(db, body.project_id)

    if body.name is not None:
        row.name = body.name
    if body.description is not None:
        row.description = body.description
    if body.visual_prompt is not None:
        row.visual_prompt = body.visual_prompt
    if m is CharacterAsset and body.role_type is not None:
        row.role_type = body.role_type
    if m is SceneAsset and body.scene_type is not None:
        row.scene_type = body.scene_type

    meta = dict(row.meta_json or {})
    if body.voice_style is not None:
        meta["voice_style"] = body.voice_style
    if body.reference_image_data_url is not None:
        meta["reference_image_data_url"] = body.reference_image_data_url
    if body.reference_image_name is not None:
        meta["reference_image_name"] = body.reference_image_name
    if body.product_usage is not None:
        meta["product_usage"] = body.product_usage
    if m is ProductAsset and body.product_type is not None:
        meta["product_type"] = body.product_type
    row.meta_json = meta
    db.add(row)

    mark_step_completed(project, STEP_3)
    propagate_downstream_stale(project, STEP_3)
    update_last_active_step(project, STEP_3)
    db.add(project)
    db.commit()
    return UpdateAssetResponse(
        project_id=body.project_id,
        asset_type=asset_type,
        asset_id=asset_id,
        stale_marked_step_4=True,
    )


@router.post("/generate", response_model=GenerateAssetSpecsResponse)
async def generate_asset_specs(body: GenerateAssetSpecsRequest, db: Session = Depends(get_db)):
    log_api_request(logger, "POST /assets/specs/generate", project_id=body.project_id)
    lock_acquired = False
    try:
        project = orchestrator.get_project(db, body.project_id)
        recover_stale_processing_status_if_possible(db, project)
        project = orchestrator.get_project(db, body.project_id)
        orchestrator.assert_step_allowed(db, project, WorkflowStep.GENERATE_ASSET_SPECS)
        acquire_project_task_lock(db, project, stage="s3_assets")
        lock_acquired = True
        had_existing_assets = (
            db.query(CharacterAsset.id).filter(CharacterAsset.project_id == body.project_id).first() is not None
            or db.query(SceneAsset.id).filter(SceneAsset.project_id == body.project_id).first() is not None
            or db.query(ProductAsset.id).filter(ProductAsset.project_id == body.project_id).first() is not None
        )

        pc_row = latest_product_context(db, body.project_id)
        sb_row = latest_story_blueprint(db, body.project_id)
        if not pc_row or not sb_row:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Requires product context and story blueprint",
            )

        product = ProductContextSchema.model_validate(pc_row.normalized_context_json)
        blueprint = parse_story_blueprint_json(sb_row.blueprint_json)
        language_policy = build_language_policy(
            workflow_source={"product": product.model_dump(), "raw_inputs": pc_row.raw_inputs_json, "blueprint": blueprint.model_dump()},
            market_source={
                "raw_inputs": pc_row.raw_inputs_json,
                "target_users": product.target_users,
                "usage_scenarios": product.usage_scenarios,
            },
            explicit_target_market=(project.target_market or "North America"),
        )
        project_config = {
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
            "project_id": body.project_id,
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

        is_v2_blueprint = is_creative_blueprint_v2_project(blueprint)
        status_before = project.status
        try:
            if is_v2_blueprint:
                specs = list(blueprint.asset_generation_specs or [])
                n_char = sum(1 for s in specs if str(s.asset_kind or "").strip().lower() == "character")
                n_scene = sum(1 for s in specs if str(s.asset_kind or "").strip().lower() == "scene")
                n_prod = sum(1 for s in specs if str(s.asset_kind or "").strip().lower() == "product")
                logger.info(
                    "[S3_V2_ASSET_SPECS_USE_BLUEPRINT] %s",
                    json.dumps(
                        {
                            "project_id": body.project_id,
                            "asset_specs_count": len(specs),
                            "character_count": n_char,
                            "scene_count": n_scene,
                            "product_count": n_prod,
                        },
                        ensure_ascii=False,
                    ),
                )
                bundle = build_v2_asset_specs_bundle(project_id=body.project_id, blueprint=blueprint)
                source = "blueprint.asset_generation_specs"
                used_fallback = False
                fallback_reason = None
                logger.info(
                    "[S3_ASSET_REQUIREMENTS_SOURCE] project_id=%s source=%s character_count=%s scene_count=%s product_count=%s",
                    body.project_id,
                    source,
                    len(bundle.characters),
                    len(bundle.scenes),
                    len(bundle.products),
                )
            else:
                logger.info(
                    "[S3_LEGACY_ASSET_SPEC_PATH] %s",
                    json.dumps(
                        {"project_id": body.project_id, "reason": "not_creative_blueprint_v2"},
                        ensure_ascii=False,
                    ),
                )
                logger.info("[S3_DB_RELEASE_BEFORE_EXTERNAL_CALL] project_id=%s", body.project_id)
                db.close()
                req_state = inspect_asset_requirements_source(blueprint)
                if blueprint.creative_brief:
                    bundle = asset_spec_service.generate(body.project_id, product, blueprint, project_config)
                    source = "asset_spec_provider"
                    used_fallback = False
                    fallback_reason = None
                else:
                    if not req_state.get("usable"):
                        logger.warning(
                            "[S3_ASSET_SPEC_MISSING] project_id=%s missing_field=%s",
                            body.project_id,
                            str(req_state.get("reason") or "asset_requirements"),
                        )
                        raise_short_drama_http(
                            ShortDramaInvalidModelOutputError(
                                "Story blueprint has no usable asset_requirements; regenerate S2 or complete asset_requirements.",
                                code="s3_asset_spec_missing",
                                missing_fields=[str(req_state.get("reason") or "asset_requirements")],
                            )
                        )
                    bundle = asset_bundle_from_story_requirements(blueprint, product=product, project_config=project_config)
                    source = "story_blueprint.asset_requirements"
                    used_fallback = False
                    fallback_reason = None
                logger.info(
                    "[S3_ASSET_REQUIREMENTS_SOURCE] project_id=%s source=%s character_count=%s scene_count=%s product_count=%s",
                    body.project_id,
                    source,
                    len(bundle.characters),
                    len(bundle.scenes),
                    len(bundle.products),
                )
                logger.info(
                    "[S3_ASSET_REQUIREMENTS_CONSUMED] %s",
                    {
                        "project_id": body.project_id,
                        "source": source,
                        "target_market": project_config.get("target_market"),
                        "target_audience": project_config.get("target_audience"),
                        "character_names": [c.name for c in bundle.characters],
                        "scene_names": [s.name for s in bundle.scenes],
                        "product_names": [p.name for p in bundle.products],
                        "used_fallback": used_fallback,
                        "fallback_reason": fallback_reason,
                    },
                )
                for c in bundle.characters:
                    logger.info(
                        "[S3_CHARACTER_ASSET_PROMPT] %s",
                        {
                            "project_id": body.project_id,
                            "target_market": project_config.get("target_market"),
                            "target_audience": project_config.get("target_audience"),
                            "final_character_name": c.name,
                            "prompt_preview": _preview_text((c.image_prompt or c.visual_prompt)),
                        },
                    )
                story_framework = blueprint.story_framework if isinstance(blueprint.story_framework, dict) else {}
                for s in bundle.scenes:
                    logger.info(
                        "[S3_SCENE_ASSET_PROMPT] %s",
                        {
                            "project_id": body.project_id,
                            "target_market": project_config.get("target_market"),
                            "story_framework_type": story_framework.get("type"),
                            "final_scene_name": s.name,
                            "prompt_preview": _preview_text((s.image_prompt or s.visual_prompt)),
                        },
                    )
                product_name_from_s1 = product.product_name
                product_req_first_name = ""
                req = blueprint.asset_requirements if isinstance(blueprint.asset_requirements, dict) else {}
                req_products = req.get("products") if isinstance(req.get("products"), list) else []
                if req_products and isinstance(req_products[0], dict):
                    product_req_first_name = str(req_products[0].get("name") or "").strip()
                for p in bundle.products:
                    logger.info(
                        "[S3_PRODUCT_ASSET_CONTEXT] %s",
                        {
                            "project_id": body.project_id,
                            "product_name_from_s1": product_name_from_s1,
                            "product_name_from_asset_requirement": product_req_first_name,
                            "final_product_asset_name": p.name,
                            "visual_features": product.visual_features[:8],
                            "prompt_preview": _preview_text((p.image_prompt or p.visual_prompt)),
                        },
                    )
        except (ShortDramaProviderError, ShortDramaInvalidModelOutputError) as e:
            logger.info(
                "[SHORT_DRAMA_STEP_FAIL] project_id=%s step=%s error_type=%s project_status_before=%s project_status_after=%s",
                body.project_id,
                "S3_generate_asset_specs",
                type(e).__name__,
                status_before,
                project.status,
            )
            raise_short_drama_http(e)
        except Exception as e:
            logger.info(
                "[SHORT_DRAMA_STEP_FAIL] project_id=%s step=%s error_type=%s project_status_before=%s project_status_after=%s",
                body.project_id,
                "S3_generate_asset_specs",
                type(e).__name__,
                status_before,
                project.status,
            )
            logger.exception("Asset spec unexpected error project_id=%s", body.project_id)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Asset spec generation failed",
            )

        logger.info("[S3_DB_REOPEN_FOR_WRITEBACK] project_id=%s", body.project_id)
        db.query(CharacterAsset).filter(CharacterAsset.project_id == body.project_id).delete(
            synchronize_session=False
        )
        db.query(SceneAsset).filter(SceneAsset.project_id == body.project_id).delete(synchronize_session=False)
        db.query(ProductAsset).filter(ProductAsset.project_id == body.project_id).delete(synchronize_session=False)

        if is_v2_blueprint:
            persist_v2_asset_specs_bundle_to_legacy_tables(db, body.project_id, bundle)
        else:
            for c in bundle.characters:
                _trace(
                    "S3_SPEC_BEFORE_SAVE",
                    {
                        "project_id": body.project_id,
                        "asset_type": "character",
                        "asset_id": c.id,
                        "name": c.name,
                        "description": c.description,
                        "visual_prompt": c.visual_prompt,
                        "image_prompt": c.image_prompt,
                        "type_fields": c.meta,
                        "source_field": "bundle.characters",
                    },
                )
                original_name = c.name.strip() if isinstance(c.name, str) else ""
                role_type = _as_text(c.role_type) or "main"
                raw_story_usage = _as_text((c.meta or {}).get("story_usage"))
                story_usage = raw_story_usage or "用于展示产品在生活场景中的自然露出和人物反应。"
                display_name = original_name
                name_reason = "model_name_kept"
                if _character_name_is_too_generic(display_name, project_config.get("target_audience", "")):
                    display_name = build_character_display_name(
                        target_market=_as_text(project_config.get("target_market")),
                        target_audience=_as_text(project_config.get("target_audience")),
                        role_type=role_type,
                        scenario=story_usage,
                        marketing_goal=_as_text(project_config.get("marketing_goal")),
                    )
                    name_reason = "rewritten_generic_or_audience_name"
                if _is_bad_display_text(display_name):
                    display_name = _zh_fallback_name("character")
                    name_reason = "rewritten_bad_placeholder"
                logger.info(
                    "[S3_CHARACTER_NAME_RESOLVED] %s",
                    {
                        "project_id": body.project_id,
                        "original_name": original_name,
                        "target_market": project_config.get("target_market"),
                        "target_audience": project_config.get("target_audience"),
                        "story_usage": story_usage,
                        "resolved_name": display_name,
                        "reason": name_reason,
                    },
                )
                display_desc = str(c.description or "").strip()
                bad_char_desc = _is_bad_display_text(display_desc) or _contains_any(
                    display_desc,
                    ["符合目标市场与受众的角色设定", "符合目标市场的角色", "角色资产", "市场语境", "目标受众"],
                )
                if bad_char_desc:
                    display_desc = _good_character_description(
                        _as_text(project_config.get("target_market")),
                        _as_text(project_config.get("target_audience")),
                        story_usage,
                    )
                appearance = str((c.meta or {}).get("appearance") or "").strip() or _join_non_empty(
                    [
                        _as_text((c.technical_constraints or {}).get("market_context") or project_config.get("target_market")),
                        "动画角色，非真人，商业动画广告质感，干净线条，柔和色彩"
                        if "animation" in _as_text(project_config.get("visual_style")).lower() or "动画" in _as_text(project_config.get("visual_style"))
                        else "生活化广告人物，符合目标市场审美",
                    ],
                    "，",
                )
                costume = str((c.meta or {}).get("costume") or "").strip() or "浅色休闲衬衫、白色内搭、深色休闲裤，整体偏自然通勤穿搭。"
                base_expression = str((c.meta or {}).get("base_expression") or "").strip() or "轻松、自信、自然微笑。"
                if not raw_story_usage:
                    story_usage = "用于展示产品在生活场景中的自然露出和人物反应。"
                plot_stage = _infer_plot_stage(
                    _as_text(project_config.get("marketing_goal")),
                    story_usage,
                    _as_text(c.narrative_function),
                    "character",
                )
                scene_form = _infer_scene_form("character", story_usage)
                structure_summary = str((c.meta or {}).get("structure_summary") or "").strip() or _build_structure_summary(
                    "character",
                    scene_form,
                    story_usage,
                    "",
                )
                c_type_fields = {
                    "name": display_name,
                    "asset_type": "character",
                    "role_position": c.role_type or "主角",
                    "market_context": project_config.get("target_market"),
                    "age_range": (c.meta or {}).get("age_range") or "",
                    "gender": (c.meta or {}).get("gender") or "",
                    "occupation_or_identity": (c.meta or {}).get("identity") or (c.meta or {}).get("occupation_or_identity") or "",
                    "relationship_to_product": (c.meta or {}).get("relationship_to_product") or "使用者",
                    "personality": (c.meta or {}).get("personality") or "",
                    "emotional_baseline": (c.meta or {}).get("emotional_baseline") or base_expression,
                    "behavior_pattern": (c.meta or {}).get("behavior_pattern") or "自然、生活化、不过度表演",
                    "story_function": story_usage,
                    "role_type": c.role_type,
                    "appearance": appearance,
                    "appearance_overview": appearance,
                    "face_features": (c.meta or {}).get("face_features") or "",
                    "hairstyle": (c.meta or {}).get("hairstyle") or "",
                    "body_shape": (c.meta or {}).get("body_shape") or "",
                    "outfit": costume,
                    "accessories": (c.meta or {}).get("accessories") or "",
                    "posture_expression": base_expression,
                    "visual_memory_points": (c.meta or {}).get("visual_memory_points") or [],
                    "negative_constraints": (c.meta or {}).get("must_avoid") or c.boundary_warnings,
                    "costume": costume,
                    "base_expression": base_expression,
                    "voice_profile": (c.meta or {}).get("voice_profile") or (c.meta or {}).get("voice_style") or "",
                    "requires_spoken": bool((c.meta or {}).get("requires_spoken", True)),
                    "spoken_language": project_config.get("video_language"),
                    "voice_tone": (c.meta or {}).get("voice_tone") or project_config.get("brand_tone"),
                    "speech_style": (c.meta or {}).get("speech_style") or "自然口播",
                    "structured_prompt": c.image_prompt or c.visual_prompt or "",
                    "structure_summary": structure_summary,
                    "story_usage": story_usage,
                    "narrative_function": c.narrative_function or "",
                    "exposure_priority": c.exposure_priority,
                    "display_name": display_name,
                    "display_description": display_desc,
                    "image_prompt": c.image_prompt or c.visual_prompt or "",
                    "plot_stage": plot_stage,
                    "scene_form": scene_form,
                    "workflow_language": project_config.get("workflow_language"),
                    "business_profile": c.business_profile,
                    "technical_constraints": c.technical_constraints,
                }
                db.add(
                    CharacterAsset(
                        project_id=body.project_id,
                        name=display_name,
                        role_type=c.role_type,
                        description=display_desc,
                        visual_prompt=c.visual_prompt,
                        image_url=c.image_url,
                        meta_json={
                            **(c.meta or {}),
                            "type_fields": c_type_fields,
                            "asset_identity": c.asset_identity,
                            "boundary_warnings": c.boundary_warnings,
                            "source_asset_version": c.source_asset_version,
                            "exposure_priority": c.exposure_priority,
                            "narrative_function": c.narrative_function,
                            "purpose": c.purpose,
                        },
                    )
                )
                logger.info(
                    "[S3_ASSET_DISPLAY_FIELDS_BUILT] %s",
                    {
                        "project_id": body.project_id,
                        "asset_type": "character",
                        "asset_id": c.id,
                        "display_name": display_name,
                        "description_preview": _preview_text(display_desc),
                        "has_structure_summary": bool(c_type_fields.get("structure_summary")),
                        "has_image_prompt": bool(c.visual_prompt),
                        "workflow_language": project_config.get("workflow_language"),
                    },
                )
                missing_fields = _missing_fields_of(
                    c_type_fields,
                    ["appearance", "costume", "base_expression", "story_usage", "structure_summary"],
                )
                logger.info(
                    "[S3_CHARACTER_FIELDS_RESOLVED] %s",
                    {
                        "project_id": body.project_id,
                        "asset_id": c.id,
                        "has_description": bool(display_desc.strip()),
                        "has_appearance": bool(appearance.strip()),
                        "has_costume": bool(costume.strip()),
                        "has_base_expression": bool(base_expression.strip()),
                        "has_story_usage": bool(story_usage.strip()),
                        "bad_fallback_detected": bad_char_desc,
                    },
                )
                logger.info(
                    "[S3_STRUCTURE_SUMMARY_RESOLVED] %s",
                    {
                        "project_id": body.project_id,
                        "asset_id": c.id,
                        "asset_type": "character",
                        "plot_stage": plot_stage,
                        "scene_form": scene_form,
                        "structure_summary": structure_summary,
                        "used_fallback": not bool((c.meta or {}).get("structure_summary")),
                    },
                )
                logger.info(
                    "[S3_ASSET_STRUCTURED_FIELDS_BUILT] %s",
                    {
                        "project_id": body.project_id,
                        "asset_type": "character",
                        "asset_id": c.id,
                        "display_name": display_name,
                        "has_description": bool(display_desc.strip()),
                        "has_appearance_or_location_or_form": bool(appearance.strip()),
                        "has_story_usage": bool(story_usage.strip()),
                        "has_structure_summary": bool(structure_summary.strip()),
                        "workflow_language": project_config.get("workflow_language"),
                        "missing_fields": missing_fields,
                    },
                )
            scene_description_names: dict[str, list[str]] = {}
            for idx, s in enumerate(bundle.scenes):
                _trace(
                    "S3_SPEC_BEFORE_SAVE",
                    {
                        "project_id": body.project_id,
                        "asset_type": "scene",
                        "asset_id": s.id,
                        "name": s.name,
                        "description": s.description,
                        "visual_prompt": s.visual_prompt,
                        "image_prompt": s.image_prompt,
                        "type_fields": s.meta,
                        "source_field": "bundle.scenes",
                    },
                )
                original_name = s.name.strip() if isinstance(s.name, str) else ""
                resolved_scene = resolve_scene_fields(
                    scene=s,
                    project_context=project_config,
                    story_context={
                        "story_framework": blueprint.story_framework if isinstance(blueprint.story_framework, dict) else {},
                        "segment_plan": [
                            item.model_dump()
                            for item in (blueprint.segment_plan or [])
                        ],
                    },
                    index=idx,
                )
                raw_story_usage = _as_text((s.meta or {}).get("story_usage"))
                raw_location = resolved_scene.get("location", "")
                story_usage = resolved_scene.get("story_usage", "")
                lighting = resolved_scene.get("lighting", "")
                atmosphere = resolved_scene.get("atmosphere", "")
                props_text = resolved_scene.get("props", "")
                props = [x.strip() for x in props_text.split("、") if x.strip()]
                time_of_day = resolved_scene.get("time_of_day", "")
                display_name = resolved_scene.get("display_name", "")
                scene_name_reason = "composed_from_context"
                if _is_bad_display_text(display_name):
                    display_name = _zh_fallback_name("scene")
                    scene_name_reason = "rewritten_bad_placeholder"
                logger.info(
                    "[S3_SCENE_NAME_RESOLVED] %s",
                    {
                        "project_id": body.project_id,
                        "original_name": original_name,
                        "primary_location": raw_location,
                        "time_of_day": time_of_day,
                        "atmosphere": atmosphere,
                        "story_usage": story_usage,
                        "resolved_name": display_name,
                        "reason": scene_name_reason,
                    },
                )
                display_desc = str(s.description or "").strip()
                bad_scene_desc = _is_bad_display_text(display_desc) or _contains_any(
                    display_desc,
                    ["单一地点场景：", "可复用空间", "场景资产", "市场语境"],
                )
                location = raw_location or "地铁站台"
                if bad_scene_desc:
                    display_desc = resolved_scene.get("display_description", "")
                if not props:
                    props = ["生活化场景道具"]
                plot_stage = resolved_scene.get("plot_stage", "生活场景")
                scene_form = resolved_scene.get("scene_form", "单地点生活方式场景")
                structure_summary = resolved_scene.get("structure_summary", "暂无结构摘要")
                s_type_fields = {
                    "name": display_name,
                    "asset_type": "scene",
                    "scene_position": s.scene_type or "生活场景",
                    "market_context": project_config.get("target_market"),
                    "location_type": location,
                    "place_description": display_desc,
                    "spatial_layout": (s.meta or {}).get("spatial_layout") or "单一可复用空间",
                    "materials": (s.meta or {}).get("materials") or "",
                    "camera_viewpoint": (s.meta or {}).get("camera_viewpoint") or "生活广告片自然视角",
                    "foreground": (s.meta or {}).get("foreground") or "",
                    "midground": (s.meta or {}).get("midground") or "",
                    "background": (s.meta or {}).get("background") or "",
                    "visual_anchor": (s.meta or {}).get("visual_anchor") or location,
                    "memory_point": (s.meta or {}).get("memory_point") or "",
                    "negative_constraints": (s.meta or {}).get("must_avoid") or s.boundary_warnings,
                    "allowed_actions": (s.meta or {}).get("allowed_actions") or ["仅作为空间背景承载 shot 动作"],
                    "disallowed_actions": (s.meta or {}).get("disallowed_actions") or ["场景资产不写人物剧情动作", "不要在场景图中生成主角执行动作"],
                    "scene_type": s.scene_type or "",
                    "scene_form": scene_form,
                    "location": location,
                    "time_of_day": time_of_day,
                    "lighting": lighting,
                    "color_palette": (s.meta or {}).get("color_palette") or "",
                    "materials": (s.meta or {}).get("materials") or "",
                    "atmosphere": atmosphere,
                    "props": props,
                    "structured_prompt": s.image_prompt or s.visual_prompt or "",
                    "structure_summary": structure_summary,
                    "story_usage": story_usage,
                    "narrative_function": s.narrative_function or "",
                    "exposure_priority": s.exposure_priority,
                    "display_name": display_name,
                    "display_description": display_desc,
                    "image_prompt": s.image_prompt or s.visual_prompt or "",
                    "plot_stage": plot_stage,
                    "workflow_language": project_config.get("workflow_language"),
                    "business_profile": s.business_profile,
                    "technical_constraints": s.technical_constraints,
                }
                scene_description_names.setdefault(display_desc, []).append(display_name)
                db.add(
                    SceneAsset(
                        project_id=body.project_id,
                        name=display_name,
                        scene_type=s.scene_type,
                        description=display_desc,
                        visual_prompt=s.visual_prompt,
                        image_url=s.image_url,
                        meta_json={
                            **(s.meta or {}),
                            "type_fields": s_type_fields,
                            "asset_identity": s.asset_identity,
                            "boundary_warnings": s.boundary_warnings,
                            "scene_form": s.scene_form,
                            "source_asset_version": s.source_asset_version,
                            "exposure_priority": s.exposure_priority,
                            "narrative_function": s.narrative_function,
                            "purpose": s.purpose,
                        },
                    )
                )
                logger.info(
                    "[S3_ASSET_DISPLAY_FIELDS_BUILT] %s",
                    {
                        "project_id": body.project_id,
                        "asset_type": "scene",
                        "asset_id": s.id,
                        "display_name": display_name,
                        "description_preview": _preview_text(display_desc),
                        "has_structure_summary": bool(s_type_fields.get("structure_summary")),
                        "has_image_prompt": bool(s.visual_prompt),
                        "workflow_language": project_config.get("workflow_language"),
                    },
                )
                missing_fields = _missing_fields_of(
                    s_type_fields,
                    ["location", "lighting", "atmosphere", "props", "story_usage", "structure_summary"],
                )
                logger.info(
                    "[S3_SCENE_FIELDS_RESOLVED] %s",
                    {
                        "project_id": body.project_id,
                        "asset_id": s.id,
                        "original_name": original_name,
                        "resolved_name": display_name,
                        "location": location,
                        "time_of_day": time_of_day,
                        "lighting": lighting,
                        "atmosphere": atmosphere,
                        "props_preview": _preview_text("、".join(props)),
                        "story_usage_preview": _preview_text(story_usage),
                        "plot_stage": plot_stage,
                        "scene_form": scene_form,
                        "description_preview": _preview_text(display_desc),
                        "description_hash": resolved_scene.get("description_hash"),
                        "used_generic_template": resolved_scene.get("used_generic_template") == "true",
                    },
                )
                logger.info(
                    "[S3_STRUCTURE_SUMMARY_RESOLVED] %s",
                    {
                        "project_id": body.project_id,
                        "asset_id": s.id,
                        "asset_type": "scene",
                        "plot_stage": plot_stage,
                        "scene_form": scene_form,
                        "structure_summary": structure_summary,
                        "used_fallback": not bool((s.meta or {}).get("structure_summary")),
                    },
                )
            if bundle.scenes:
                unique_description_count = len(scene_description_names)
                scene_count = len(bundle.scenes)
                duplicate_detected = scene_count > 1 and unique_description_count < scene_count
                duplicate_names = (
                    [name for names in scene_description_names.values() if len(names) > 1 for name in names]
                    if duplicate_detected
                    else []
                )
                logger.info(
                    "[S3_SCENE_DESCRIPTION_DUPLICATE_CHECK] %s",
                    {
                        "project_id": body.project_id,
                        "scene_count": scene_count,
                        "unique_description_count": unique_description_count,
                        "duplicate_detected": duplicate_detected,
                        "duplicate_names": duplicate_names,
                    },
                )
                if scene_count > 1 and unique_description_count == 1:
                    logger.warning(
                        "[S3_SCENE_DESCRIPTION_DUPLICATE_CHECK] duplicated descriptions for all scenes project_id=%s",
                        body.project_id,
                    )
                logger.info(
                    "[S3_ASSET_STRUCTURED_FIELDS_BUILT] %s",
                    {
                        "project_id": body.project_id,
                        "asset_type": "scene",
                        "asset_id": s.id,
                        "display_name": display_name,
                        "has_description": bool(display_desc.strip()),
                        "has_appearance_or_location_or_form": bool(location.strip()),
                        "has_story_usage": bool(story_usage.strip()),
                        "has_structure_summary": bool(structure_summary.strip()),
                        "workflow_language": project_config.get("workflow_language"),
                        "missing_fields": missing_fields,
                    },
                )
            for p in bundle.products:
                _trace(
                    "S3_SPEC_BEFORE_SAVE",
                    {
                        "project_id": body.project_id,
                        "asset_type": "product",
                        "asset_id": p.id,
                        "name": p.name,
                        "description": p.description,
                        "visual_prompt": p.visual_prompt,
                        "image_prompt": p.image_prompt,
                        "type_fields": p.meta,
                        "source_field": "bundle.products",
                    },
                )
                display_name = p.name.strip() if isinstance(p.name, str) else ""
                if _is_bad_display_text(display_name):
                    display_name = product.product_name or _zh_fallback_name("product")
                display_desc = str(p.description or "").strip()
                bad_product_desc = _is_bad_display_text(display_desc) or _contains_any(
                    display_desc,
                    ["product-only reference asset", "产品资产", "市场语境", "结构摘要待完善"],
                )
                form = str((p.meta or {}).get("form") or "").strip() or (product.product_form or "产品主体结构")
                material = str((p.meta or {}).get("material") or "").strip() or "以 S1 产品信息为准的真实材质"
                color = str((p.meta or {}).get("color") or "").strip() or "以 S1 产品信息为准的真实颜色"
                visual_features = (p.meta or {}).get("visual_features") or []
                if not isinstance(visual_features, list) or not visual_features:
                    visual_features = product.visual_features or product.core_selling_points or ["产品外观与结构细节"]
                story_usage = str((p.meta or {}).get("story_usage") or "").strip() or "产品在使用场景中自然露出，展示与 S1 信息一致的外观和功能。"
                if bad_product_desc:
                    display_desc = _good_product_description(display_name, form, [str(x) for x in visual_features])
                plot_stage = _infer_plot_stage(
                    _as_text(project_config.get("marketing_goal")),
                    story_usage,
                    _as_text(p.narrative_function),
                    "product",
                )
                scene_form = _infer_scene_form("product", story_usage)
                structure_summary = str((p.meta or {}).get("structure_summary") or "").strip() or _build_structure_summary(
                    "product",
                    scene_form,
                    story_usage,
                    "产品外观、材质、结构和关键功能部件",
                )
                p_type_fields = {
                    "name": display_name,
                    "asset_type": "product",
                    "product_position": p.product_role or "主商品",
                    "category": product.product_category,
                    "brand": (p.meta or {}).get("brand") or "",
                    "model": (p.meta or {}).get("model") or "",
                    "market_context": project_config.get("target_market"),
                    "core_selling_points": product.core_selling_points,
                    "usage_scenarios": product.usage_scenarios,
                    "user_pain_points": [blueprint.core_pain or ""],
                    "purchase_reasons": product.emotional_value,
                    "product_shape": form,
                    "structure_details": (p.meta or {}).get("structure_details") or form,
                    "functional_parts": (p.meta or {}).get("functional_parts") or visual_features,
                    "key_closeups": (p.meta or {}).get("key_closeups") or visual_features[:4],
                    "usage_modes": (p.meta or {}).get("usage_modes") or product.usage_scenarios,
                    "packaging_or_label": (p.meta or {}).get("packaging_or_label") or "",
                    "negative_constraints": (p.meta or {}).get("must_avoid") or p.boundary_warnings,
                    "image_source": (p.meta or {}).get("image_source") or "generated",
                    "reference_images": (p.meta or {}).get("reference_images") or [],
                    "allow_redraw": (p.meta or {}).get("allow_redraw", True),
                    "allow_style_adaptation": (p.meta or {}).get("allow_style_adaptation", True),
                    "immutable_structure_constraints": p.immutable_structure_constraints
                    or (p.meta or {}).get("immutable_structure_constraints")
                    or [],
                    "product_role": p.product_role or "hero",
                    "form": form,
                    "color": color,
                    "material": material,
                    "visual_features": visual_features,
                    "structured_prompt": p.image_prompt or p.visual_prompt or "",
                    "structure_summary": structure_summary,
                    "story_usage": story_usage,
                    "narrative_function": p.narrative_function or "",
                    "exposure_priority": p.exposure_priority,
                    "display_name": display_name,
                    "display_description": display_desc,
                    "image_prompt": p.image_prompt or p.visual_prompt or "",
                    "plot_stage": plot_stage,
                    "scene_form": scene_form,
                    "workflow_language": project_config.get("workflow_language"),
                    "business_profile": p.business_profile,
                    "technical_constraints": p.technical_constraints,
                }
                db.add(
                    ProductAsset(
                        project_id=body.project_id,
                        name=display_name,
                        description=display_desc,
                        visual_prompt=p.visual_prompt,
                        image_url=p.image_url,
                        meta_json={
                            **(p.meta or {}),
                            "type_fields": p_type_fields,
                            "asset_identity": p.asset_identity,
                            "boundary_warnings": p.boundary_warnings,
                            "product_role": p.product_role,
                            "source_asset_version": p.source_asset_version,
                            "exposure_priority": p.exposure_priority,
                            "narrative_function": p.narrative_function,
                            "purpose": p.purpose,
                        },
                    )
                )
                logger.info(
                    "[S3_ASSET_DISPLAY_FIELDS_BUILT] %s",
                    {
                        "project_id": body.project_id,
                        "asset_type": "product",
                        "asset_id": p.id,
                        "display_name": display_name,
                        "description_preview": _preview_text(display_desc),
                        "has_structure_summary": bool(p_type_fields.get("structure_summary")),
                        "has_image_prompt": bool(p.visual_prompt),
                        "workflow_language": project_config.get("workflow_language"),
                    },
                )
                missing_fields = _missing_fields_of(
                    p_type_fields,
                    ["form", "material", "color", "visual_features", "story_usage", "structure_summary"],
                )
                logger.info(
                    "[S3_PRODUCT_FIELDS_RESOLVED] %s",
                    {
                        "project_id": body.project_id,
                        "asset_id": p.id,
                        "has_form": bool(form.strip()),
                        "has_material": bool(material.strip()),
                        "has_color": bool(color.strip()),
                        "has_visual_features": bool(visual_features),
                        "has_story_usage": bool(story_usage.strip()),
                        "bad_fallback_detected": bad_product_desc,
                    },
                )
                logger.info(
                    "[S3_STRUCTURE_SUMMARY_RESOLVED] %s",
                    {
                        "project_id": body.project_id,
                        "asset_id": p.id,
                        "asset_type": "product",
                        "plot_stage": plot_stage,
                        "scene_form": scene_form,
                        "structure_summary": structure_summary,
                        "used_fallback": not bool((p.meta or {}).get("structure_summary")),
                    },
                )
                logger.info(
                    "[S3_ASSET_STRUCTURED_FIELDS_BUILT] %s",
                    {
                        "project_id": body.project_id,
                        "asset_type": "product",
                        "asset_id": p.id,
                        "display_name": display_name,
                        "has_description": bool(display_desc.strip()),
                        "has_appearance_or_location_or_form": bool(form.strip()),
                        "has_story_usage": bool(story_usage.strip()),
                        "has_structure_summary": bool(structure_summary.strip()),
                        "workflow_language": project_config.get("workflow_language"),
                        "missing_fields": missing_fields,
                    },
                )

        # Step3 UI now reads unified asset library tables.
        # Keep legacy generation flow, but immediately sync generated legacy rows into library entities.
        db.flush()
        asset_library_service.sync_legacy_assets_for_project(db, body.project_id)

        mark_step_completed(project, STEP_3)
        if had_existing_assets:
            propagate_downstream_stale(project, STEP_3)
        update_last_active_step(project, STEP_3)
        orchestrator.advance_on_success(db, project, WorkflowStep.GENERATE_ASSET_SPECS)
        db.commit()
        final_status = project.status
        post_db = SessionLocal()
        try:
            mark_project_stage_succeeded(post_db, body.project_id, stage="s3_assets", status_after=final_status)
        finally:
            post_db.close()

        chars = (
            db.query(CharacterAsset)
            .filter(CharacterAsset.project_id == body.project_id)
            .order_by(CharacterAsset.id)
            .all()
        )
        scenes = db.query(SceneAsset).filter(SceneAsset.project_id == body.project_id).order_by(SceneAsset.id).all()
        products = (
            db.query(ProductAsset).filter(ProductAsset.project_id == body.project_id).order_by(ProductAsset.id).all()
        )

        out_bundle = AssetSpecsBundleSchema(
            characters=[
                CharacterAssetSchema(
                    id=c.id,
                    name=c.name,
                    role_type=c.role_type,
                    description=c.description,
                        visual_prompt=c.visual_prompt,
                    image_url=c.image_url,
                    visual_anchor_image_id=(c.meta_json or {}).get("visual_anchor_image_id"),
                    source_asset_version=str((c.meta_json or {}).get("source_asset_version") or "legacy-1"),
                    exposure_priority=str((c.meta_json or {}).get("exposure_priority") or "secondary"),
                    narrative_function=(c.meta_json or {}).get("narrative_function"),
                    purpose=(c.meta_json or {}).get("purpose"),
                    meta=c.meta_json or {},
                )
                for c in chars
            ],
            scenes=[
                SceneAssetSchema(
                    id=s.id,
                    name=s.name,
                    scene_type=s.scene_type,
                    scene_form=(s.meta_json or {}).get("scene_form"),
                    description=s.description,
                        visual_prompt=s.visual_prompt,
                    image_url=s.image_url,
                    visual_anchor_image_id=(s.meta_json or {}).get("visual_anchor_image_id"),
                    source_asset_version=str((s.meta_json or {}).get("source_asset_version") or "legacy-1"),
                    exposure_priority=str((s.meta_json or {}).get("exposure_priority") or "secondary"),
                    narrative_function=(s.meta_json or {}).get("narrative_function"),
                    purpose=(s.meta_json or {}).get("purpose"),
                    meta=s.meta_json or {},
                )
                for s in scenes
            ],
            products=[
                ProductAssetSchema(
                    id=p.id,
                    name=p.name,
                    description=p.description,
                        visual_prompt=p.visual_prompt,
                    image_url=p.image_url,
                    visual_anchor_image_id=(p.meta_json or {}).get("visual_anchor_image_id"),
                    source_asset_version=str((p.meta_json or {}).get("source_asset_version") or "legacy-1"),
                    exposure_priority=str((p.meta_json or {}).get("exposure_priority") or "secondary"),
                    narrative_function=(p.meta_json or {}).get("narrative_function"),
                    purpose=(p.meta_json or {}).get("purpose"),
                    meta=p.meta_json or {},
                )
                for p in products
            ],
        )

        log_api_success(
            logger,
            "POST /assets/specs/generate",
            project_id=body.project_id,
            characters=len(out_bundle.characters),
            scenes=len(out_bundle.scenes),
            products=len(out_bundle.products),
        )
        return GenerateAssetSpecsResponse(project_id=body.project_id, assets=out_bundle)
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
                    stage="s3_assets",
                    error_type_value=et,
                    message=str(e.detail),
                )
            except Exception:
                pass
            finally:
                fail_db.close()
        log_api_error(
            logger,
            "POST /assets/specs/generate",
            str(e.detail),
            project_id=body.project_id,
            status_code=e.status_code,
        )
        raise


@router.get("/library/detail/{asset_id}", response_model=AssetDetailSchema)
async def get_asset_library_detail(asset_id: int, project_id: int, db: Session = Depends(get_db)):
    row = (
        db.query(AssetEntity)
        .filter(AssetEntity.id == asset_id, AssetEntity.project_id == project_id, AssetEntity.status == "active")
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Asset not found")
    return AssetDetailSchema.model_validate(asset_library_service.to_detail(db, row))


@router.get("/library/{project_id}/{asset_type}", response_model=AssetListResponse)
async def list_assets_library(project_id: int, asset_type: str, db: Session = Depends(get_db)):
    rows = (
        db.query(AssetEntity)
        .filter(
            AssetEntity.project_id == project_id,
            AssetEntity.asset_type == asset_type.strip().lower(),
            AssetEntity.status == "active",
        )
        .order_by(AssetEntity.sort_order.asc(), AssetEntity.id.asc())
        .all()
    )
    return AssetListResponse(
        project_id=project_id,
        asset_type=asset_type,
        assets=[AssetDetailSchema.model_validate(asset_library_service.to_detail(db, r)) for r in rows],
    )


@router.post("/library/scene/repair", response_model=RepairSceneStructureResponse)
async def repair_scene_library_structure(
    body: RepairSceneStructureRequest,
    dry_run: bool = Query(default=False),
    db: Session = Depends(get_db),
):
    diffs = asset_library_service.repair_scene_structure_for_project(
        db, body.project_id, apply_changes=not dry_run
    )
    if diffs and not dry_run:
        db.commit()
    return RepairSceneStructureResponse(
        project_id=body.project_id,
        dry_run=dry_run,
        repaired_count=len(diffs),
        diffs=diffs,
    )


@router.post("/library", response_model=AssetDetailSchema)
async def create_asset_library(body: CreateAssetRequest, db: Session = Depends(get_db)):
    try:
        row = asset_library_service.create_asset(db, body)
        _mark_step3_and_stale_step4(db, body.project_id)
        db.commit()
        db.refresh(row)
        return AssetDetailSchema.model_validate(asset_library_service.to_detail(db, row))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/library/regenerate", response_model=AssetDetailSchema)
async def regenerate_asset_library(body: RegenerateAssetRequest, db: Session = Depends(get_db)):
    try:
        row = asset_library_service.regenerate_asset_images(db, body)
        _mark_step3_and_stale_step4(db, body.project_id)
        db.commit()
        db.refresh(row)
        return AssetDetailSchema.model_validate(asset_library_service.to_detail(db, row))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ShortDramaImageProviderError as e:
        if _is_xai_image_quota_exhausted(e):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    "success": False,
                    "error": "XAI_IMAGE_QUOTA_EXHAUSTED",
                    "detail": _XAI_IMAGE_QUOTA_DETAIL,
                },
            )
        raise


@router.post("/library/{asset_id}/uploaded-images", response_model=AssetDetailSchema)
async def append_uploaded_images_to_asset(
    asset_id: int,
    body: AppendUploadedImagesRequest,
    db: Session = Depends(get_db),
):
    if not body.uploaded_images:
        raise HTTPException(status_code=400, detail="uploaded_images is required")
    try:
        row = asset_library_service.append_uploaded_images(
            db,
            project_id=body.project_id,
            asset_id=asset_id,
            uploaded_images=body.uploaded_images,
        )
        _mark_step3_and_stale_step4(db, body.project_id)
        db.commit()
        db.refresh(row)
        return AssetDetailSchema.model_validate(asset_library_service.to_detail(db, row))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/library/{asset_id}/reference-image/analyze", response_model=AnalyzeAssetReferenceImageResponse)
async def analyze_reference_image_for_asset(
    asset_id: int,
    body: AnalyzeAssetReferenceImageRequest,
    db: Session = Depends(get_db),
):
    try:
        validate_supported_image_data_url(body.image)
        row, warning = asset_library_service.analyze_reference_image_and_update_asset(
            db,
            project_id=body.project_id,
            asset_id=asset_id,
            image_data_url=body.image,
        )
        _mark_step3_and_stale_step4(db, body.project_id)
        db.commit()
        db.refresh(row)
        return AnalyzeAssetReferenceImageResponse(
            asset=AssetDetailSchema.model_validate(asset_library_service.to_detail(db, row)),
            warning=warning,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/library/create-from-image", response_model=AssetDetailSchema)
async def create_asset_library_from_image(body: CreateAssetFromImageRequest, db: Session = Depends(get_db)):
    try:
        validate_supported_image_data_url(body.image)
        row = asset_library_service.create_asset_from_uploaded_image(
            db,
            project_id=body.project_id,
            asset_type=body.asset_type,
            image_data_url=body.image,
            optional_name=body.optional_name,
        )
        _mark_step3_and_stale_step4(db, body.project_id)
        db.commit()
        db.refresh(row)
        return AssetDetailSchema.model_validate(asset_library_service.to_detail(db, row))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/library/{asset_id}", response_model=AssetDetailSchema)
async def update_asset_library(asset_id: int, body: UpdateAssetMetaRequest, db: Session = Depends(get_db)):
    row = (
        db.query(AssetEntity)
        .filter(AssetEntity.id == asset_id, AssetEntity.project_id == body.project_id, AssetEntity.status == "active")
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Asset not found")
    if body.name is not None:
        row.name = body.name.strip() or row.name
    if body.description is not None:
        row.description = body.description
    if body.tags is not None:
        row.tags_json = body.tags
    if body.base_prompt is not None:
        row.base_prompt = body.base_prompt
    if body.type_fields is not None:
        extra = dict(row.extra_json or {})
        extra["type_fields"] = body.type_fields
        row.extra_json = extra
    db.add(row)
    _mark_step3_and_stale_step4(db, body.project_id)
    db.commit()
    db.refresh(row)
    return AssetDetailSchema.model_validate(asset_library_service.to_detail(db, row))


@router.post("/library/{asset_id}/cover", response_model=AssetDetailSchema)
async def set_asset_cover(asset_id: int, body: SetAssetCoverRequest, db: Session = Depends(get_db)):
    row = (
        db.query(AssetEntity)
        .filter(AssetEntity.id == asset_id, AssetEntity.project_id == body.project_id, AssetEntity.status == "active")
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Asset not found")
    image = (
        db.query(AssetImage)
        .filter(AssetImage.id == body.image_id, AssetImage.asset_id == row.id, AssetImage.status == "active")
        .first()
    )
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")
    row.cover_image_id = image.id
    db.add(row)
    asset_library_service._ensure_cover(db, row)
    _mark_step3_and_stale_step4(db, body.project_id)
    db.commit()
    db.refresh(row)
    return AssetDetailSchema.model_validate(asset_library_service.to_detail(db, row))


@router.delete("/library/image/{image_id}", response_model=AssetDetailSchema)
async def delete_asset_image(image_id: int, project_id: int, db: Session = Depends(get_db)):
    image = db.query(AssetImage).filter(AssetImage.id == image_id, AssetImage.status == "active").first()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")
    row = db.query(AssetEntity).filter(AssetEntity.id == image.asset_id, AssetEntity.project_id == project_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Asset not found")
    image.status = "deleted"
    db.add(image)
    # Guard point: future S4 binding check should prevent deleting in-use image_id.
    asset_library_service._ensure_cover(db, row)
    _mark_step3_and_stale_step4(db, project_id)
    db.commit()
    db.refresh(row)
    return AssetDetailSchema.model_validate(asset_library_service.to_detail(db, row))


@router.delete("/library/{asset_id}")
async def delete_asset_library(asset_id: int, project_id: int, db: Session = Depends(get_db)):
    row = db.query(AssetEntity).filter(AssetEntity.id == asset_id, AssetEntity.project_id == project_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Asset not found")
    # Guard point: future S4引用检查可在这里拦截硬删除。
    row.status = "deleted"
    db.add(row)
    for img in db.query(AssetImage).filter(AssetImage.asset_id == row.id).all():
        img.status = "deleted"
        db.add(img)
    _mark_step3_and_stale_step4(db, project_id)
    db.commit()
    return {"ok": True, "asset_id": asset_id}
