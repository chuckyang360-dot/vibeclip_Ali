from __future__ import annotations

import logging
import json
from dataclasses import dataclass
from typing import Any

from ...database import SessionLocal
from ...models import AIModelCatalog, AIPromptTemplate, AIStageConfig

logger = logging.getLogger(__name__)

STAGE_S1_PRODUCT_UNDERSTANDING = "s1_product_understanding"
STAGE_S2_STORY_GENERATION = "s2_story_generation"
STAGE_S3_ASSET_MANAGEMENT = "s3_asset_management"
STAGE_S4_VIDEO_GENERATION = "s4_video_generation"


@dataclass(frozen=True)
class AIRuntimeConfig:
    stage_key: str
    provider: str | None = None
    model_id: str | None = None
    prompt_template_id: int | None = None
    prompt_version: int | None = None
    system_prompt: str | None = None
    user_prompt_template: str | None = None
    model_default_config: dict[str, Any] | None = None
    stage_config: dict[str, Any] | None = None


def _admin_prompt_is_runtime_override(prompt: AIPromptTemplate | None) -> bool:
    if prompt is None:
        return False
    meta = prompt.metadata_json if isinstance(prompt.metadata_json, dict) else {}
    # Seed prompts document the fields for the admin UI. They must not replace
    # the existing production prompts until an admin publishes a new version.
    return meta.get("seeded") is not True


def render_runtime_prompt_template(template: str, values: dict[str, Any]) -> str:
    out = str(template or "")
    for key, value in values.items():
        if isinstance(value, (dict, list)):
            rendered = json.dumps(value, ensure_ascii=False, default=str)
        else:
            rendered = str(value or "")
        out = out.replace("{" + key + "}", rendered)
    return out


def apply_runtime_user_prompt_template(
    *,
    user_payload: dict[str, Any],
    template: str | None,
    payload_placeholder: str,
    values: dict[str, Any] | None = None,
) -> dict[str, Any]:
    if not template:
        return user_payload
    template_values = dict(values or {})
    template_values[payload_placeholder] = user_payload
    template_values.setdefault("payload", user_payload)
    return {
        "admin_user_prompt": render_runtime_prompt_template(template, template_values),
        payload_placeholder: user_payload,
    }


def get_ai_runtime_config(stage_key: str) -> AIRuntimeConfig:
    session = SessionLocal()
    try:
        stage = (
            session.query(AIStageConfig)
            .filter(AIStageConfig.stage_key == stage_key, AIStageConfig.enabled.is_(True))
            .first()
        )
        if stage is None:
            return AIRuntimeConfig(stage_key=stage_key)

        model = (
            session.query(AIModelCatalog).filter(AIModelCatalog.id == stage.active_model_id).first()
            if stage.active_model_id
            else None
        )
        prompt = (
            session.query(AIPromptTemplate).filter(AIPromptTemplate.id == stage.active_prompt_template_id).first()
            if stage.active_prompt_template_id
            else None
        )
        use_prompt = _admin_prompt_is_runtime_override(prompt)
        return AIRuntimeConfig(
            stage_key=stage_key,
            provider=(model.provider if model else None),
            model_id=(model.model_id if model else None),
            prompt_template_id=(prompt.id if prompt and use_prompt else None),
            prompt_version=(prompt.version if prompt and use_prompt else None),
            system_prompt=(prompt.system_prompt if prompt and use_prompt else None),
            user_prompt_template=(prompt.user_prompt_template if prompt and use_prompt else None),
            model_default_config=dict(model.default_config or {}) if model else {},
            stage_config=dict(stage.config_json or {}),
        )
    except Exception:
        logger.exception("[AI_RUNTIME_CONFIG_ERROR] stage_key=%s", stage_key)
        return AIRuntimeConfig(stage_key=stage_key)
    finally:
        session.close()
