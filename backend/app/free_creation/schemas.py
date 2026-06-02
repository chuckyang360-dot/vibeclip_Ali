from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


AssetType = Literal["image", "video", "audio", "avatar"]


class FreeCreationInputAsset(BaseModel):
    type: AssetType
    url: str
    storage_key: str | None = ""
    file_name: str | None = ""
    mime_type: str | None = ""
    file_size: int | None = 0
    role: str | None = ""
    label: str | None = ""


class FreeCreationAssetResponse(FreeCreationInputAsset):
    id: int
    project_id: int
    created_at: datetime | None = None


class FreeCreationUploadResponse(BaseModel):
    id: int
    project_id: int
    url: str
    storage_key: str
    file_name: str
    mime_type: str
    file_size: int
    asset_type: AssetType
    role: str
    label: str


class CreateFreeCreationProjectRequest(BaseModel):
    title: str | None = ""
    prompt: str = Field(..., min_length=1)
    assets: list[FreeCreationInputAsset] = Field(default_factory=list)
    model: str | None = "doubao-seedance-2-0-260128"
    ratio: str | None = "9:16"
    resolution: str | None = "720p"
    duration: int | None = 5
    generate_audio: bool | None = True
    watermark: bool | None = False


class CreateFreeCreationSegmentRequest(BaseModel):
    title: str | None = ""
    prompt: str = ""
    assets: list[FreeCreationInputAsset] = Field(default_factory=list)
    model: str | None = "doubao-seedance-2-0-260128"
    ratio: str | None = "9:16"
    resolution: str | None = "720p"
    duration: int | None = 5
    generate_audio: bool | None = True
    watermark: bool | None = False


class UpdateFreeCreationSegmentRequest(BaseModel):
    title: str | None = None
    prompt: str | None = None
    assets: list[FreeCreationInputAsset] | None = None
    model: str | None = None
    ratio: str | None = None
    resolution: str | None = None
    duration: int | None = None
    generate_audio: bool | None = None
    watermark: bool | None = None


class FreeCreationSegmentResponse(BaseModel):
    id: int
    project_id: int
    segment_index: int
    title: str
    prompt: str
    model: str
    ratio: str
    resolution: str
    duration: int
    generate_audio: bool
    watermark: bool
    input_assets: list[dict[str, Any]]
    status: str
    error_message: str
    provider_task_id: str
    video_url: str
    last_frame_url: str
    created_at: datetime | None = None
    updated_at: datetime | None = None


class FreeCreationProjectResponse(BaseModel):
    id: int
    user_id: int
    project_name: str
    status: str
    final_video_url: str
    final_render_status: str
    final_render_error: str
    settings: dict[str, Any]
    assets: list[FreeCreationAssetResponse]
    segments: list[FreeCreationSegmentResponse]
    created_at: datetime | None = None
    updated_at: datetime | None = None


class GenerateFreeCreationSegmentResponse(BaseModel):
    project_id: int
    segment_id: int
    render_job_id: int
    status: str
    ok: bool = True


class FreeCreationRenderJobResponse(BaseModel):
    id: int
    project_id: int
    segment_id: int | None
    target_type: str
    status: str
    progress: int
    provider_task_id: str
    output_url: str
    error_message: str


class MergeFreeCreationProjectResponse(BaseModel):
    project_id: int
    render_job_id: int
    status: str
    final_video_url: str | None = None
