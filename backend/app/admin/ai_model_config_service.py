from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from sqlalchemy.orm import Session

from ..models import AIModelCatalog, AIPromptTemplate, AIStageConfig
from .ai_model_defaults import AI_STAGE_DEFINITIONS, DEFAULT_AI_MODELS, DEFAULT_AI_PROMPTS


@dataclass(frozen=True)
class ActiveAIStageConfig:
    stage_key: str
    stage_name: str
    provider: str | None
    model_id: str | None
    capability: str | None
    prompt_template_id: int | None
    prompt_version: int | None
    system_prompt: str | None
    user_prompt_template: str | None
    model_config: dict[str, Any]
    stage_config: dict[str, Any]


def seed_default_ai_model_configs(db: Session) -> None:
    """Insert idempotent AI model/prompt/stage defaults.

    This is intentionally side-effect-light: it creates missing rows only and does
    not overwrite administrator edits.
    """
    model_by_key: dict[tuple[str, str, str], AIModelCatalog] = {}
    for row in DEFAULT_AI_MODELS:
        key = (row["provider"], row["model_id"], row["capability"])
        existing = (
            db.query(AIModelCatalog)
            .filter(
                AIModelCatalog.provider == row["provider"],
                AIModelCatalog.model_id == row["model_id"],
                AIModelCatalog.capability == row["capability"],
            )
            .first()
        )
        if existing is None:
            existing = AIModelCatalog(
                provider=row["provider"],
                model_id=row["model_id"],
                display_name=row["display_name"],
                capability=row["capability"],
                enabled=True,
                sort_order=int(row.get("sort_order") or 100),
                config_schema=row.get("config_schema"),
                default_config=row.get("default_config"),
                metadata_json=row.get("metadata_json"),
            )
            db.add(existing)
            db.flush()
        model_by_key[key] = existing

    prompt_by_stage: dict[str, AIPromptTemplate] = {}
    for row in DEFAULT_AI_PROMPTS:
        existing = (
            db.query(AIPromptTemplate)
            .filter(
                AIPromptTemplate.stage_key == row["stage_key"],
                AIPromptTemplate.status == "active",
            )
            .order_by(AIPromptTemplate.version.desc(), AIPromptTemplate.id.desc())
            .first()
        )
        if existing is None:
            existing = AIPromptTemplate(
                stage_key=row["stage_key"],
                name=row["name"],
                version=1,
                status="active",
                system_prompt=row["system_prompt"],
                user_prompt_template=row.get("user_prompt_template"),
                variables_schema=row.get("variables_schema"),
                metadata_json={"seeded": True},
            )
            db.add(existing)
            db.flush()
        prompt_by_stage[row["stage_key"]] = existing

    default_model_for_stage = {
        "s1_product_understanding": ("xai", "grok-4.20", "vision_text"),
        "s2_story_generation": ("xai", "grok-4.20", "text"),
        "s3_asset_management": ("xai", "grok-imagine-image", "image"),
        "s4_video_generation": ("xai", "grok-imagine-video", "video"),
        "reference_video_understanding": ("gemini", "gemini-3-flash-preview", "vision_text"),
        "script_import_parse": ("gemini", "gemini-3.1-pro-preview", "text"),
    }
    fallback_model_for_stage = {
        "s1_product_understanding": ("gemini", "gemini-3-flash-preview", "vision_text"),
        "s2_story_generation": ("gemini", "gemini-3.1-pro-preview", "text"),
        "s3_asset_management": ("gemini", "gemini-3.1-flash-image-preview", "image"),
        "s4_video_generation": ("gemini", "veo-3.1-generate-preview", "video"),
        "reference_video_understanding": ("gemini", "gemini-3.1-pro-preview", "vision_text"),
        "script_import_parse": ("gemini", "gemini-3-flash-preview", "text"),
    }

    for stage in AI_STAGE_DEFINITIONS:
        stage_key = stage["stage_key"]
        existing = db.query(AIStageConfig).filter(AIStageConfig.stage_key == stage_key).first()
        if existing is not None:
            continue
        active_model = model_by_key.get(default_model_for_stage[stage_key])
        fallback_model = model_by_key.get(fallback_model_for_stage[stage_key])
        active_prompt = prompt_by_stage.get(stage_key)
        db.add(
            AIStageConfig(
                stage_key=stage_key,
                stage_name=stage["stage_name"],
                active_model_id=active_model.id if active_model else None,
                fallback_model_id=fallback_model.id if fallback_model else None,
                active_prompt_template_id=active_prompt.id if active_prompt else None,
                enabled=True,
                config_json={
                    "capability": stage["capability"],
                    "seeded": True,
                    **(
                        {"use_proxy_default_model": True}
                        if stage_key == "script_import_parse"
                        else {}
                    ),
                },
            )
        )
    db.commit()


def get_active_ai_stage_config(db: Session, stage_key: str) -> ActiveAIStageConfig | None:
    row = db.query(AIStageConfig).filter(AIStageConfig.stage_key == stage_key, AIStageConfig.enabled.is_(True)).first()
    if row is None:
        return None
    model = db.query(AIModelCatalog).filter(AIModelCatalog.id == row.active_model_id).first() if row.active_model_id else None
    prompt = (
        db.query(AIPromptTemplate).filter(AIPromptTemplate.id == row.active_prompt_template_id).first()
        if row.active_prompt_template_id
        else None
    )
    return ActiveAIStageConfig(
        stage_key=row.stage_key,
        stage_name=row.stage_name,
        provider=model.provider if model else None,
        model_id=model.model_id if model else None,
        capability=model.capability if model else None,
        prompt_template_id=prompt.id if prompt else None,
        prompt_version=prompt.version if prompt else None,
        system_prompt=prompt.system_prompt if prompt else None,
        user_prompt_template=prompt.user_prompt_template if prompt else None,
        model_config=dict(model.default_config or {}) if model else {},
        stage_config=dict(row.config_json or {}),
    )
