from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class ProductImageInputSchema(BaseModel):
    image_url: str = ""
    image_order: int = 0
    is_main_image: bool = False
    image_caption_raw: str = ""


class ProductRawInputSchema(BaseModel):
    """S1 原始输入层：文本 + 多图资料。"""

    product_name_raw: str = ""
    product_category_raw: str = ""
    brand_raw: str = ""
    price_raw: str = ""
    target_users_raw: str = ""
    selling_points_raw: List[str] = Field(default_factory=list)
    usage_scenarios_raw: List[str] = Field(default_factory=list)
    extra_notes_raw: str = ""
    product_images: List[ProductImageInputSchema] = Field(default_factory=list)


class ProductImageUnderstandingSchema(BaseModel):
    """图片理解结构化结果（Grok Image Understanding）。"""

    detected_product_type: str = ""
    detected_visual_features: List[str] = Field(default_factory=list)
    detected_materials: List[str] = Field(default_factory=list)
    detected_colors: List[str] = Field(default_factory=list)
    detected_usage_context: List[str] = Field(default_factory=list)
    detected_people_type: List[str] = Field(default_factory=list)
    detected_pose_or_usage: List[str] = Field(default_factory=list)
    detected_packaging: List[str] = Field(default_factory=list)
    detected_brand_clues: List[str] = Field(default_factory=list)
    detected_quality_risks: List[str] = Field(default_factory=list)
    image_conflicts: List[str] = Field(default_factory=list)
    per_image_notes: List[Dict[str, Any]] = Field(default_factory=list)


class ProductContextSchema(BaseModel):
    """S1 解析结果层：供 S2/S3 消费的 Product Context。"""

    model_config = ConfigDict(extra="ignore")

    product_name: str = ""
    product_category: str = ""
    product_summary: str = ""
    core_selling_points: List[str] = Field(default_factory=list)
    target_users: List[str] = Field(default_factory=list)
    usage_scenarios: List[str] = Field(default_factory=list)
    visual_features: List[str] = Field(default_factory=list)
    product_form: str = ""
    key_functions: List[str] = Field(default_factory=list)
    emotional_value: List[str] = Field(default_factory=list)
    suitable_story_angles: List[str] = Field(default_factory=list)
    user_pain_points: List[str] = Field(default_factory=list)
    visual_risk_notes: List[str] = Field(default_factory=list)
    consistency_notes: List[str] = Field(default_factory=list)
    immutable_structure_constraints: List[str] = Field(default_factory=list)
    extracted_from_images: List[str] = Field(default_factory=list)
    parse_confidence: float = 0.0
    source_trace: Dict[str, Literal["user_input", "image_understanding", "merged_inference", "model_inference"]] = (
        Field(default_factory=dict)
    )
    field_meta: Dict[str, Dict[str, Any]] = Field(default_factory=dict)


class ParseProductRequest(BaseModel):
    project_id: int
    input: ProductRawInputSchema
    reparse_mode: Literal["replace_all", "preserve_user_edited"] = "replace_all"


class ParseProductResponse(BaseModel):
    record_id: int
    project_id: int
    version: int
    parse_status: str = "success"
    raw_inputs: Dict[str, Any]
    image_understanding: ProductImageUnderstandingSchema
    product_context: ProductContextSchema
    from_version: Optional[int] = None
    updated_fields: List[str] = Field(default_factory=list)
    preserved_fields: List[str] = Field(default_factory=list)
    created_at: Optional[datetime] = None


class UpdateProductContextRequest(BaseModel):
    project_id: int
    product_context: ProductContextSchema


class UpdateProductContextResponse(BaseModel):
    record_id: int
    project_id: int
    version: int
    parse_status: str = "edited"
    product_context: ProductContextSchema
    created_at: Optional[datetime] = None
