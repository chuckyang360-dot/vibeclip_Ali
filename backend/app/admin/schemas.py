from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class CreditGrantRequest(BaseModel):
    amount: int = Field(..., gt=0)
    reason: str = Field(..., min_length=1)


class CreditDeductRequest(BaseModel):
    amount: int = Field(..., gt=0)
    reason: str = Field(..., min_length=1)


class ReasonRequest(BaseModel):
    reason: str = Field(..., min_length=1)


class AIModelCreateRequest(BaseModel):
    provider: str = Field(..., min_length=1, max_length=64)
    model_id: str = Field(..., min_length=1, max_length=200)
    display_name: str = Field(..., min_length=1, max_length=200)
    capability: str = Field(..., min_length=1, max_length=64)
    enabled: bool = True
    sort_order: int = 100
    config_schema: dict[str, Any] | None = None
    default_config: dict[str, Any] | None = None
    metadata_json: dict[str, Any] | None = None


class AIStageModelUpdateRequest(BaseModel):
    model_catalog_id: int = Field(..., gt=0)
    fallback_model_catalog_id: int | None = Field(default=None, gt=0)
    reason: str = Field(..., min_length=1)


class AIPromptDraftRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    system_prompt: str = Field(..., min_length=1)
    user_prompt_template: str | None = None
    variables_schema: dict[str, Any] | None = None
    metadata_json: dict[str, Any] | None = None
    reason: str | None = None


class AIPromptPublishRequest(AIPromptDraftRequest):
    reason: str = Field(..., min_length=1)


class AIStagePromptPublishExistingRequest(BaseModel):
    prompt_template_id: int = Field(..., gt=0)
    reason: str = Field(..., min_length=1)
