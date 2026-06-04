from typing import Any, Literal

from pydantic import BaseModel, Field


AdMaterialMode = Literal["template", "product_video", "video_edit"]
AdMaterialAssetType = Literal["image", "video", "audio", "avatar"]
AdMaterialAssetRole = Literal["reference_image", "reference_video", "reference_audio", "first_frame", "last_frame"]


class AdMaterialTemplate(BaseModel):
    id: str
    name: str
    category: str
    description: str
    industry_tags: list[str] = []
    theme_categories: list[str] = []
    supported_ratios: list[str] = []
    default_ratio: str = "9:16"
    default_duration: int = 8
    default_resolution: str = "720p"
    default_generate_audio: bool = True
    preview_video_url: str = ""
    cover_url: str = ""
    slots: list[dict[str, Any]] = []


class AdMaterialUploadResponse(BaseModel):
    url: str
    storage_key: str
    file_name: str
    mime_type: str
    file_size: int
    asset_type: AdMaterialAssetType


class AdMaterialInputAsset(BaseModel):
    type: AdMaterialAssetType
    url: str
    role: AdMaterialAssetRole
    label: str = ""


class CreateAdMaterialTaskRequest(BaseModel):
    mode: AdMaterialMode = "template"
    template_id: str = ""
    title: str = ""
    prompt_text: str = ""
    product_name: str = ""
    selling_points: str = ""
    channel: str = "douyin"
    style: str = ""
    edit_instruction: str = ""
    assets: list[AdMaterialInputAsset] = []
    ratio: str = "9:16"
    resolution: str = "720p"
    duration: int = Field(default=8, ge=4, le=15)
    generate_audio: bool = True
    watermark: bool = False
    return_last_frame: bool = True
    model: str = ""


class AdMaterialTaskResponse(BaseModel):
    id: int
    user_id: int | None = None
    template_id: str
    mode: str
    title: str
    status: str
    error_message: str
    provider_task_id: str
    provider_video_url: str
    video_url: str
    last_frame_url: str
    prompt: str
    input_assets: list[dict[str, Any]] = []
    parameters: dict[str, Any] = {}
    model: str
    ratio: str
    resolution: str
    duration: int
    generate_audio: bool
    watermark: bool
    created_at: str | None = None
    updated_at: str | None = None


class AdMaterialTaskListResponse(BaseModel):
    tasks: list[AdMaterialTaskResponse]


class AdMaterialTemplateListResponse(BaseModel):
    templates: list[AdMaterialTemplate]
