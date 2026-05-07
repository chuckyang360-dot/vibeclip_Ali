from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class RenderJobSchema(BaseModel):
    id: Optional[int] = None
    project_id: int
    target_type: str
    target_id: str
    render_granularity: Optional[str] = Field(
        default="segment",
        description="Current video render granularity is segment-level; shot-level is reserved for future use.",
    )
    provider: Optional[str] = None
    provider_request_id: Optional[str] = None
    model: Optional[str] = None
    status: str
    input_payload: Optional[Dict[str, Any]] = None
    output_url: Optional[str] = None
    error_message: Optional[str] = None
    meta_json: Optional[Dict[str, Any]] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class VideoProjectRequest(BaseModel):
    project_id: int = Field(..., ge=1)
    segment_id: str | None = None


class VideoBatchSummaryResponse(BaseModel):
    project_id: int
    segments_attempted: int
    segments_succeeded: int
    errors: List[Dict[str, Any]] = Field(default_factory=list)


class SingleSegmentVideoResponse(BaseModel):
    project_id: int
    segment_id: str
    ok: bool
    status: str
    progress: int = 0
    video_url: Optional[str] = None
    render_job_id: Optional[int] = None
    error: Optional[str] = None


class RenderJobStatusResponse(BaseModel):
    job_id: int
    project_id: int
    segment_id: str
    status: str
    progress: int = 0
    video_url: Optional[str] = None
    error: Optional[str] = None
    request_id: Optional[str] = None


class MergeVideoResponse(BaseModel):
    project_id: int
    final_video_url: str
