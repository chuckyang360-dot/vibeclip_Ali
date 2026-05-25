from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class VideoAnalysisSection(BaseModel):
    title: str = ""
    content: str = ""
    items: list[dict[str, Any]] = Field(default_factory=list)


class ReferenceVideoAnalysisResult(BaseModel):
    script_reading: dict[str, Any] = Field(default_factory=dict)
    shooting_method: dict[str, Any] = Field(default_factory=dict)
    actual_script_structure: dict[str, Any] = Field(default_factory=dict)
    characters: list[dict[str, Any]] = Field(default_factory=list)
    product_presentation: list[dict[str, Any]] = Field(default_factory=list)
    shot_breakdown: list[dict[str, Any]] = Field(default_factory=list)
    video_prompt: dict[str, Any] = Field(default_factory=dict)
    uncertainty_notes: list[str] = Field(default_factory=list)
    copyright_safety_notes: list[str] = Field(default_factory=list)


class ReferenceVideoResponse(BaseModel):
    id: int
    user_id: int | None = None
    original_filename: str = ""
    mime_type: str = ""
    file_size: int = 0
    duration_seconds: int | None = None
    storage_provider: str = "r2"
    storage_key: str = ""
    public_url: str = ""
    analysis_status: Literal["uploaded", "processing", "success", "failed"] = "uploaded"
    analysis_json: dict[str, Any] | None = None
    generated_prompt: str = ""
    error_message: str = ""
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


class AnalyzeReferenceVideoRequest(BaseModel):
    force: bool = False


class AnalyzeReferenceVideoResponse(BaseModel):
    video: ReferenceVideoResponse


class ReferenceVideoListResponse(BaseModel):
    user_id: int
    videos: list[ReferenceVideoResponse] = Field(default_factory=list)
