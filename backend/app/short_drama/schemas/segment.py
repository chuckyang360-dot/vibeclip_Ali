from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


def _stringify_line(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, dict):
        speaker = str(value.get("speaker") or value.get("role") or value.get("character") or "").strip()
        text = str(
            value.get("text")
            or value.get("line")
            or value.get("dialogue")
            or value.get("content")
            or ""
        ).strip()
        if speaker and text:
            return f"{speaker}：{text}"
        return text or str(value).strip()
    if isinstance(value, list):
        return "\n".join(x for x in (_stringify_line(v) for v in value) if x)
    return str(value).strip()


class ShotSchema(BaseModel):
    model_config = ConfigDict(extra="ignore")

    shot_id: str = ""
    shot_title: str = ""
    shot_role: str = ""
    shot_type: str = ""
    scene_ref: str = ""
    character_refs: List[str] = Field(default_factory=list)
    character_asset_ids: List[str] = Field(default_factory=list)
    visual_description: str = ""
    visual_action: str = ""
    scene_description: str = ""
    subject_description: str = ""
    action_description: str = ""
    camera: str = ""
    camera_movement: str = ""
    framing: str = ""
    camera_framing: str = ""
    camera_description: str = ""
    dialogue: str = ""
    spoken_text: str = ""
    voiceover: Optional[str] = None
    voiceover_text: str = ""
    subtitle: str = ""
    subtitle_text: str = ""
    narration: str = ""
    emotion: str = ""
    mood: str = ""
    duration_seconds: float = 0.0
    duration_sec: float = 0.0
    image_prompt: str = ""
    video_prompt: str = ""
    generation_prompt: str = ""
    negative_prompt: str = ""
    visual_style_instruction: str = ""
    market_localization_detail: str = ""
    manual_video_prompt: str = ""
    product_refs: List[str] = Field(default_factory=list)
    product_asset_id: str = ""
    product_ids: List[str] = Field(default_factory=list)
    character_ids: List[str] = Field(default_factory=list)
    scene_id: str = ""
    scene_asset_id: str = ""
    manual_character_refs: List[str] = Field(default_factory=list)
    manual_scene_ref: str = ""
    manual_product_refs: List[str] = Field(default_factory=list)
    required_assets: List[str] = Field(default_factory=list)
    must_show: List[str] = Field(default_factory=list)
    must_avoid: List[str] = Field(default_factory=list)
    source_segment_id: str = ""
    source_selling_point: str = ""
    source_visual_constraints: Dict[str, Any] = Field(default_factory=dict)
    # S4 / presentation: Chinese UI copy; execution still uses video_prompt / visual_action / generation_prompt.
    presentation_viewer_takeaway: str = ""
    presentation_visual_direction: str = ""
    presentation_character_action: str = ""
    presentation_scene_direction: str = ""
    presentation_product_purpose: str = ""

    @model_validator(mode="before")
    @classmethod
    def _normalize_dialogue_fields(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data
        out = dict(data)
        dialogue = _stringify_line(out.get("spoken_text") or out.get("dialogue"))
        if not dialogue:
            for key in ("dialogue_lines", "lines", "spoken_line", "caption", "script"):
                dialogue = _stringify_line(out.get(key))
                if dialogue:
                    break
        voiceover = _stringify_line(out.get("voiceover_text") or out.get("voiceover"))
        narration = _stringify_line(out.get("narration"))
        if not voiceover and narration:
            voiceover = narration
        subtitle = _stringify_line(out.get("subtitle_text") or out.get("subtitle"))
        if dialogue:
            out["dialogue"] = dialogue
            out["spoken_text"] = dialogue
        if voiceover:
            out["voiceover"] = voiceover
            out["voiceover_text"] = voiceover
        if narration or voiceover:
            out["narration"] = narration or voiceover
        if subtitle:
            out["subtitle"] = subtitle
            out["subtitle_text"] = subtitle
        if not _stringify_line(out.get("visual_action")) and _stringify_line(out.get("action_description")):
            out["visual_action"] = _stringify_line(out.get("action_description"))
        if not _stringify_line(out.get("action_description")) and _stringify_line(out.get("visual_action")):
            out["action_description"] = _stringify_line(out.get("visual_action"))
        if not _stringify_line(out.get("camera")) and _stringify_line(out.get("camera_description")):
            out["camera"] = _stringify_line(out.get("camera_description"))
        if not _stringify_line(out.get("camera_framing")) and _stringify_line(out.get("framing")):
            out["camera_framing"] = _stringify_line(out.get("framing"))
        if not _stringify_line(out.get("framing")) and _stringify_line(out.get("camera_framing")):
            out["framing"] = _stringify_line(out.get("camera_framing"))
        if not _stringify_line(out.get("mood")) and _stringify_line(out.get("emotion")):
            out["mood"] = _stringify_line(out.get("emotion"))
        if not _stringify_line(out.get("emotion")) and _stringify_line(out.get("mood")):
            out["emotion"] = _stringify_line(out.get("mood"))
        if not out.get("duration_sec") and out.get("duration_seconds"):
            out["duration_sec"] = out.get("duration_seconds")
        if not out.get("duration_seconds") and out.get("duration_sec"):
            out["duration_seconds"] = out.get("duration_sec")
        if not _stringify_line(out.get("generation_prompt")) and _stringify_line(out.get("video_prompt")):
            out["generation_prompt"] = _stringify_line(out.get("video_prompt"))
        if not _stringify_line(out.get("video_prompt")) and _stringify_line(out.get("generation_prompt")):
            out["video_prompt"] = _stringify_line(out.get("generation_prompt"))
        return out

    @field_validator("duration_seconds", "duration_sec", mode="before")
    @classmethod
    def _coerce_duration(cls, v: Any) -> float:
        if v is None or v == "":
            return 0.0
        try:
            return float(v)
        except (TypeError, ValueError):
            return 0.0


class SegmentScriptSchema(BaseModel):
    model_config = ConfigDict(extra="ignore")

    segment_id: str
    title: str = ""
    duration_limit: float = 0.0
    goal: str = ""
    shots: List[ShotSchema] = Field(default_factory=list)
    meta: Dict[str, Any] = Field(default_factory=dict)

    @field_validator("duration_limit", mode="before")
    @classmethod
    def _coerce_limit(cls, v: Any) -> float:
        if v is None or v == "":
            return 0.0
        try:
            return float(v)
        except (TypeError, ValueError):
            return 0.0


class GenerateSegmentsRequest(BaseModel):
    project_id: int
    # When true, skip S2 video_generation_specs materialization and call segment director / Grok.
    force_segment_director: bool = False


class GenerateSegmentsResponse(BaseModel):
    project_id: int
    segments: List[SegmentScriptSchema]
    record_ids: List[int] = Field(default_factory=list)


class UpdateSegmentShotRequest(BaseModel):
    project_id: int
    segment_title: Optional[str] = None
    segment_goal: Optional[str] = None
    duration_limit: Optional[float] = None
    action_description: Optional[str] = None
    dialogue: Optional[str] = None
    spoken_text: Optional[str] = None
    voiceover: Optional[str] = None
    voiceover_text: Optional[str] = None
    subtitle_text: Optional[str] = None
    emotion: Optional[str] = None
    video_prompt: Optional[str] = None
    generation_prompt: Optional[str] = None
    must_show: Optional[List[str]] = None
    must_avoid: Optional[List[str]] = None
    duration_seconds: Optional[float] = None
    manual_character_refs: Optional[List[str]] = None
    manual_scene_ref: Optional[str] = None
    manual_product_refs: Optional[List[str]] = None
    manual_video_prompt: Optional[str] = None
    shot_role: Optional[str] = None
    viewer_takeaway: Optional[str] = None
    visual_direction: Optional[str] = None
    character_direction: Optional[str] = None
    product_presence: Optional[str] = None
    product_purpose: Optional[str] = None
    scene_direction: Optional[str] = None
    camera_direction: Optional[str] = None
    dialogue_text: Optional[str] = None
    subtitle_text_presentation: Optional[str] = None
    audio_intent: Optional[str] = None
    character_refs: Optional[List[str]] = None
    character_asset_ids: Optional[List[str]] = None
    scene_refs: Optional[List[str]] = None
    scene_asset_id: Optional[str] = None
    product_refs: Optional[List[str]] = None
    product_asset_id: Optional[str] = None
    duration_sec: Optional[float] = None


class UpdateSegmentShotResponse(BaseModel):
    project_id: int
    segment_id: str
    shot_id: str
    segment: Dict[str, Any]
    shot: Dict[str, Any]
    needs_regeneration: bool = True
