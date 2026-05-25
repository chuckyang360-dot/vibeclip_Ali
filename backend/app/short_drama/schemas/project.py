from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field

class CreateShortDramaProjectRequest(BaseModel):
    user_id: int = Field(..., description="Owner user id (existing users.id)")
    project_name: str = Field(..., min_length=1, max_length=256)
    duration: Optional[str] = Field(None, description="e.g. 60s")
    format: Optional[str] = Field(None, description="e.g. vertical_9_16")
    style: Optional[str | List[str]] = Field(None, description="Narrative style (single-select; legacy list accepted)")
    visual_style: Optional[str] = Field(None, description="Cinematography / look")
    aspect_ratio: Optional[str] = Field(None, description="e.g. 9:16")
    target_market: Optional[str] = Field(None, description="Optional target market hint")
    marketing_goal: Optional[str] = Field("brand_seeding", description="Marketing goal for story strategy")
    target_audience: Optional[str] = Field("", description="Target audience free text")
    brand_tone: Optional[str] = Field("natural", description="Brand tone")
    creative_intent: Optional[str] = Field("", description="Natural-language creative intent")
    creative_brief: Optional[str] = Field("", description="Additional creative brief")
    workflow_language: Optional[str] = Field(None, description="Workflow language like zh-CN/en-US")
    video_language: Optional[str] = Field(None, description="Dialogue/subtitle language like en-US")


class CreativeIntentInput(BaseModel):
    intent_text: str = ""
    platform_hints: List[str] = Field(default_factory=list)
    duration_hint: str = ""
    aspect_ratio_hint: str = ""


class ScriptImportInput(BaseModel):
    raw_text: str = Field(..., min_length=1)
    file_name: str = ""
    platform_hints: List[str] = Field(default_factory=list)
    duration_hint: str = ""
    aspect_ratio_hint: str = ""
    strict_mode: bool = False


class ScriptImportAnalysis(BaseModel):
    input_type: str = "mixed"
    confidence: float = 0.0
    detected_language: str = ""
    missing_fields: List[str] = Field(default_factory=list)
    global_style: str = ""
    constraints: List[str] = Field(default_factory=list)
    summary: str = ""


class ScriptImportPrepareResponse(BaseModel):
    project_id: int
    workflow_mode: Literal["script_import"] = "script_import"
    parse_status: Literal["completed"] = "completed"
    analysis: ScriptImportAnalysis = Field(default_factory=ScriptImportAnalysis)
    segment_count: int = 0
    record_ids: List[int] = Field(default_factory=list)
    redirect_to: str


class ProductImageInput(BaseModel):
    url: str = ""
    image_url: str = ""
    image_order: Optional[int] = None
    is_main_image: bool = False
    image_caption_raw: str = ""


class ProductInput(BaseModel):
    product_images: List[ProductImageInput] = Field(default_factory=list)
    product_note: str = ""
    product_url: str = ""


class CreativeIntentInputResponse(BaseModel):
    project_id: int
    creative_intent_input: CreativeIntentInput


class ProductInputResponse(BaseModel):
    project_id: int
    product_input: ProductInput


class CreativeBriefGenerateResponse(BaseModel):
    project_id: int
    product_understanding: Dict[str, Any] = Field(default_factory=dict)
    creative_brief: Dict[str, Any] = Field(default_factory=dict)


class ProjectCoverAsset(BaseModel):
    asset_type: Optional[Literal["character", "product", "scene"]] = None
    name: Optional[str] = None
    image_url: Optional[str] = None
    status: Literal["ready", "missing"] = "missing"


class ShortDramaProjectResponse(BaseModel):
    id: int
    user_id: int
    project_name: str
    status: str
    effective_status: Optional[str] = None
    suggested_status: Optional[str] = None
    status_recoverable: bool = False
    duration: Optional[str] = None
    format: Optional[str] = None
    style: Optional[str] = None
    visual_style: Optional[str] = None
    aspect_ratio: Optional[str] = None
    target_market: Optional[str] = None
    marketing_goal: Optional[str] = None
    target_audience: Optional[str] = None
    brand_tone: Optional[str] = None
    creative_intent: Optional[str] = None
    creative_brief: Optional[str] = None
    workflow_language: Optional[str] = None
    video_language: Optional[str] = None
    last_active_step: Optional[Literal["step_0", "step_1", "step_2", "step_3", "step_4", "overview"]] = None
    step_status: Dict[str, str] = Field(default_factory=dict)
    overall_status: Optional[Literal["draft", "stale", "generating", "completed", "failed"]] = None
    task_running: Optional[bool] = None
    current_stage: Optional[str] = None
    failed_stage: Optional[str] = None
    error_message: Optional[str] = None
    error_type: Optional[str] = None
    can_retry: Optional[bool] = None
    final_video_url: Optional[str] = None
    has_final_video: Optional[bool] = None
    has_all_segment_videos: Optional[bool] = None
    segment_video_count: Optional[int] = None
    segment_video_total: Optional[int] = None
    cover_asset: ProjectCoverAsset = Field(default_factory=ProjectCoverAsset)
    workflow_mode: Optional[str] = None
    script_import: Optional[Dict[str, Any]] = None
    creative_intent_input: Optional[Dict[str, Any]] = None
    product_input: Optional[Dict[str, Any]] = None
    product_understanding: Optional[Dict[str, Any]] = None
    creative_brief_structured: Optional[Dict[str, Any]] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class CreateShortDramaProjectResponse(BaseModel):
    project: ShortDramaProjectResponse


class ShortDramaProjectListResponse(BaseModel):
    projects: List[ShortDramaProjectResponse] = Field(default_factory=list)


class ProjectEntryRedirectResponse(BaseModel):
    project_id: int
    redirect_to: str
    reason: Literal["completed_overview", "last_active_step", "default_step_1"]


class TouchProjectStepRequest(BaseModel):
    step: Literal["step_1", "step_2", "step_3", "step_4", "overview"]
    save_intent: Optional[Literal["save_draft", "before_exit"]] = None


class PipelineSummaryResponse(BaseModel):
    project: ShortDramaProjectResponse
    product_context: Optional[Dict[str, Any]] = None
    creative_intent_input: Optional[Dict[str, Any]] = None
    product_input: Optional[Dict[str, Any]] = None
    product_understanding: Optional[Dict[str, Any]] = None
    creative_brief: Optional[Dict[str, Any]] = None
    story_blueprint: Optional[Dict[str, Any]] = None
    assets: Dict[str, List[Dict[str, Any]]] = Field(
        default_factory=lambda: {"characters": [], "scenes": [], "products": []}
    )
    segment_scripts: List[Dict[str, Any]] = Field(default_factory=list)
    final_video_url: Optional[str] = None
    #: 片段与成片状态（供 Step4 展示，不依赖前端猜测）
    current_video_stage: Optional[str] = None
    has_all_segment_videos: bool = False
    has_final_video: bool = False
    final_render_status: Optional[str] = None
    final_render_error: Optional[str] = None
    final_render_job_id: Optional[int] = None
    has_active_render_job: bool = False
    video_render_task_running: bool = False
    segment_render_statuses: List[Dict[str, Any]] = Field(default_factory=list)
    #: 角色+场景+产品资产行中 image_url 非空的数量（与 DB 一致）
    image_url_filled: int = 0
    #: 角色+场景+产品资产总行数
    asset_rows_total: int = 0
    lightweight: bool = False
    has_product_context: Optional[bool] = None
    has_story_blueprint: Optional[bool] = None
    has_asset_generation_specs: bool = False
    asset_generation_specs_count: int = 0
    asset_counts: Optional[Dict[str, int]] = None
    segment_scripts_count: Optional[int] = None
    workflow_mode: Optional[str] = None
    script_import: Optional[Dict[str, Any]] = None
