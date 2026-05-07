from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class SegmentPlanItemSchema(BaseModel):
    model_config = ConfigDict(extra="ignore")

    segment_id: str = ""
    stage_name: str = ""
    title: str = ""
    segment_title: str = ""
    segment_goal: str = ""
    key_message: str = ""
    duration_sec: float = 0.0
    goal: str = ""
    duration_seconds: float = 0.0
    story_beat: str = ""
    summary: str = ""
    product_exposure_mode: str = ""
    product_exposure: str = ""
    segment_role: str = ""
    emotional_state: str = ""
    source_selling_point: str = ""
    product_feature_to_show: str = ""
    target_user_trigger: str = ""
    required_visual_elements: List[str] = Field(default_factory=list)
    required_assets: List[str] = Field(default_factory=list)
    expected_assets: List[str] = Field(default_factory=list)
    transition_to_next: str = ""

    @field_validator("duration_seconds", "duration_sec", mode="before")
    @classmethod
    def _coerce_duration(cls, v: Any) -> float:
        if v is None or v == "":
            return 0.0
        try:
            return float(v)
        except (TypeError, ValueError):
            return 0.0


class StoryBlueprintSchema(BaseModel):
    model_config = ConfigDict(extra="ignore")

    title: str = ""
    script_title: str = ""
    format: str = ""
    style: str = ""
    premise: str = ""
    target_audience: str = ""
    core_pain: str = ""
    emotional_trigger: str = ""
    product_promise: str = ""
    conversion_goal: str = ""
    script_structure_type: str = ""
    script_type_display: str = ""
    structure_type_display: str = ""
    structure_reason: str = ""
    structure_reason_for_user: str = ""
    hook: str = ""
    core_conflict: str = ""
    twist: str = ""
    resolution: str = ""
    segment_plan: List[SegmentPlanItemSchema] = Field(default_factory=list)
    scene_goals: Dict[str, str] = Field(default_factory=dict)
    product_selling_point_mapping: Dict[str, str] = Field(default_factory=dict)
    target_user_expression: str = ""
    visual_requirements: List[str] = Field(default_factory=list)
    dialogue_tone: str = ""
    must_show_elements: List[str] = Field(default_factory=list)
    must_avoid_elements: List[str] = Field(default_factory=list)
    meta: Dict[str, Any] = Field(default_factory=dict)
    language_policy: Dict[str, str] = Field(default_factory=dict)
    marketing_strategy: Dict[str, Any] = Field(default_factory=dict)
    story_structure: Dict[str, Any] = Field(default_factory=dict)
    story_framework: Dict[str, Any] = Field(default_factory=dict)
    asset_requirements: Dict[str, Any] = Field(default_factory=dict)
    shot_plan: Dict[str, Any] = Field(default_factory=dict)
    spoken_strategy: Dict[str, Any] = Field(default_factory=dict)
    creative_brief: Dict[str, Any] = Field(default_factory=dict)
    market_visual_constraints: Dict[str, Any] = Field(default_factory=dict)
    visual_style_constraints: Dict[str, Any] = Field(default_factory=dict)


class GenerateStoryRequest(BaseModel):
    project_id: int


class GenerateStoryResponse(BaseModel):
    record_id: int
    project_id: int
    version: int
    blueprint: StoryBlueprintSchema
    approved: bool = False
    created_at: Optional[datetime] = None
