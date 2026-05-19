import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional, Union

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator

from ..exceptions import ShortDramaInvalidModelOutputError

logger = logging.getLogger(__name__)

# Legacy S2 fields: Grok may emit dict, list, string, or null; preserve without coercion to fake dicts.
LegacyFlexibleValue = Union[Dict[str, Any], List[Any], str, None]
LegacyVisualRequirements = Union[List[str], str, None]


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


class StoryOverviewSchema(BaseModel):
    model_config = ConfigDict(extra="ignore")

    title: str = ""
    premise: str = ""
    hook: str = ""
    target_audience: str = ""
    marketing_goal: str = ""
    creative_intent_summary: str = ""
    story_angle: str = ""
    emotional_arc: List[str] = Field(default_factory=list)
    conversion_goal: str = ""


class StoryBeatSchema(BaseModel):
    model_config = ConfigDict(extra="ignore")

    title: str = ""
    purpose: str = ""
    content: str = ""


class StoryOutlineSchema(BaseModel):
    model_config = ConfigDict(extra="ignore")

    title: str = ""
    summary: str = ""
    structure_type: str = ""
    structure_reasoning: str = ""
    story_beats: List[StoryBeatSchema] = Field(default_factory=list)


class CreativeBlueprintCharacterSchema(BaseModel):
    model_config = ConfigDict(extra="ignore")

    character_key: str = ""
    display_name: str = ""
    role_in_story: str = ""
    description: str = ""
    personality: str = ""
    visual_identity: str = ""
    wardrobe: str = ""
    continuity_notes: str = ""


class CreativeBlueprintSceneSchema(BaseModel):
    model_config = ConfigDict(extra="ignore")

    scene_key: str = ""
    display_name: str = ""
    location_type: str = ""
    description: str = ""
    atmosphere: str = ""
    lighting: str = ""
    props: List[str] = Field(default_factory=list)
    continuity_notes: str = ""

    @field_validator("props", mode="before")
    @classmethod
    def _coerce_props(cls, v: Any) -> List[str]:
        if v is None:
            return []
        if isinstance(v, str):
            return [v.strip()] if v.strip() else []
        if isinstance(v, list):
            return [str(x).strip() for x in v if str(x).strip()]
        return []


class CreativeBlueprintProductAssetSchema(BaseModel):
    model_config = ConfigDict(extra="ignore")

    product_asset_key: str = ""
    display_name: str = ""
    product_name: str = ""
    description: str = ""
    key_visual_features: List[str] = Field(default_factory=list)
    usage_notes: str = ""
    continuity_notes: str = ""

    @field_validator("key_visual_features", mode="before")
    @classmethod
    def _coerce_kv(cls, v: Any) -> List[str]:
        if v is None:
            return []
        if isinstance(v, str):
            return [v.strip()] if v.strip() else []
        if isinstance(v, list):
            return [str(x).strip() for x in v if str(x).strip()]
        return []


AssetKindLiteral = Literal["character", "scene", "product"]
ReferenceRoleLiteral = Literal["character_reference", "scene_reference", "product_reference"]


class AssetGenerationSpecSchema(BaseModel):
    model_config = ConfigDict(extra="ignore")

    asset_key: str = ""
    asset_kind: AssetKindLiteral = "character"
    reference_role: ReferenceRoleLiteral = "character_reference"
    display_name: str = ""
    description: str = ""
    image_prompt: str = ""
    negative_prompt: str = ""
    immutable_constraints: List[str] = Field(default_factory=list)
    linked_entity_key: str = ""

    @field_validator("immutable_constraints", mode="before")
    @classmethod
    def _coerce_immutable(cls, v: Any) -> List[str]:
        if v is None:
            return []
        if isinstance(v, str):
            return [v.strip()] if v.strip() else []
        if isinstance(v, list):
            return [str(x).strip() for x in v if str(x).strip()]
        return []


class VideoGenerationSpecSchema(BaseModel):
    model_config = ConfigDict(extra="ignore")

    spec_key: str = ""
    segment_id: str = ""
    shot_id: Optional[str] = None
    video_prompt: str = ""
    reference_asset_keys: List[str] = Field(default_factory=list)
    duration_sec: float = 0.0
    aspect_ratio: str = ""
    camera: str = ""
    visual_action: str = ""
    audio_notes: str = ""
    dialogue_or_voiceover_ref: str = ""
    must_show: List[str] = Field(default_factory=list)
    must_avoid: List[str] = Field(default_factory=list)

    @field_validator("reference_asset_keys", "must_show", "must_avoid", mode="before")
    @classmethod
    def _coerce_str_lists(cls, v: Any) -> List[str]:
        if v is None:
            return []
        if isinstance(v, str):
            return [v.strip()] if v.strip() else []
        if isinstance(v, list):
            return [str(x).strip() for x in v if str(x).strip()]
        return []

    @field_validator("duration_sec", mode="before")
    @classmethod
    def _coerce_duration_sec(cls, v: Any) -> float:
        if v is None or v == "":
            return 0.0
        try:
            return float(v)
        except (TypeError, ValueError):
            return 0.0


DialogueModeLiteral = Literal[
    "dialogue",
    "voiceover",
    "narration",
    "subtitle",
    "subtitle_only",
    "silent",
]


def normalize_dialogue_or_voiceover_mode(value: Any) -> str:
    """Map AI aliases to canonical mode before Literal validation."""
    if value is None or value == "":
        return "voiceover"
    raw = str(value).strip().lower().replace("-", "_")
    aliases = {
        "caption": "subtitle",
        "onscreen_text": "subtitle",
        "on_screen_text": "subtitle",
        "screen_text": "subtitle",
        "screen_copy": "subtitle",
    }
    return aliases.get(raw, raw)


class DialogueOrVoiceoverItemSchema(BaseModel):
    model_config = ConfigDict(extra="ignore")

    ref_id: str = ""
    segment_id: str = ""
    shot_id: Optional[str] = None
    mode: DialogueModeLiteral = "voiceover"
    speaker: str = ""
    text: str = ""
    language: str = ""
    timing_notes: str = ""

    @field_validator("mode", mode="before")
    @classmethod
    def _coerce_dialogue_mode(cls, v: Any) -> str:
        return normalize_dialogue_or_voiceover_mode(v)


class SubtitleStrategySchema(BaseModel):
    model_config = ConfigDict(extra="ignore")

    enabled: bool = True
    language: str = ""
    max_lines: int = 2
    tone: str = ""
    cta_style: str = ""


ContinuitySeverityLiteral = Literal["hard", "soft", "medium"]


class ContinuityRuleSchema(BaseModel):
    model_config = ConfigDict(extra="ignore")

    rule_key: str = ""
    applies_to: str = ""
    rule_text: str = ""
    severity: ContinuitySeverityLiteral = "soft"


class ExecutionNoteSchema(BaseModel):
    model_config = ConfigDict(extra="ignore")

    note_key: str = ""
    note_type: str = ""
    note_text: str = ""


def _coerce_str_list(v: Any) -> List[str]:
    if v is None:
        return []
    if isinstance(v, str):
        return [v] if v.strip() else []
    if isinstance(v, list):
        return [str(x).strip() for x in v if x is not None and str(x).strip()]
    return []


def default_creative_blueprint_v2_attachment(*, product_name: str = "Product") -> Dict[str, Any]:
    """Deterministic v2 layers for mock S2 and unit tests; satisfies P1 hard-constraint checks."""
    char_key = "char_main"
    scene_key = "scene_main"
    prod_key = "prod_main"
    char_blob = (
        "white background, clean plain background, only the character, no scene environment, "
        "no product, no extra people, no story action, reusable character reference image"
    )
    scene_blob = (
        "only the environment / location, no characters, no product, no story action, "
        "reusable scene reference image"
    )
    prod_blob = (
        "only the product, no characters, no complex scene, clean background preferred, "
        "no narrative scene, reusable product reference image"
    )
    return {
        "blueprint_schema_version": "creative_blueprint_v2",
        "story_overview": {
            "title": f"{product_name} · Creative Blueprint",
            "premise": "Test premise for execution-ready blueprint.",
            "hook": "Attention hook aligned with product context.",
            "target_audience": "Urban commuters",
            "marketing_goal": "brand_seeding",
            "creative_intent_summary": "Natural lifestyle integration.",
            "story_angle": "Relatable daily friction",
            "emotional_arc": ["curiosity", "tension", "relief"],
            "conversion_goal": "Soft consideration / next step",
        },
        "story_outline": {
            "title": f"{product_name} · Creative Blueprint",
            "summary": "Natural lifestyle integration built around a compact product story.",
            "structure_type": "Opening pressure to product-in-context relief",
            "structure_reasoning": "The mock outline keeps the story simple while preserving AI-authored dynamic beat structure.",
            "story_beats": [
                {
                    "title": "Morning friction",
                    "purpose": "Create a relatable entry point.",
                    "content": "The lead moves through a rushed morning moment where the product can later appear naturally.",
                },
                {
                    "title": "Natural product encounter",
                    "purpose": "Connect product value to the story situation.",
                    "content": "The product enters as part of the routine, not as a hard sales insert.",
                },
                {
                    "title": "Calm resolution",
                    "purpose": "Leave the viewer with a clear emotional memory.",
                    "content": "The segment closes on a quieter payoff and a grounded brand impression.",
                },
            ],
        },
        "characters": [
            {
                "character_key": char_key,
                "display_name": "Lead",
                "role_in_story": "protagonist",
                "description": "Everyday commuter",
                "personality": "pragmatic, warm",
                "visual_identity": "East Asian young adult, natural grooming",
                "wardrobe": "casual neutral layers",
                "continuity_notes": "Same hairstyle and wardrobe across segments unless story demands change.",
            }
        ],
        "scenes": [
            {
                "scene_key": scene_key,
                "display_name": "Morning apartment",
                "location_type": "interior_home",
                "description": "Soft daylight apartment kitchen counter",
                "atmosphere": "calm morning routine",
                "lighting": "soft side window light",
                "props": ["mug", "phone", "keys"],
                "continuity_notes": "Keep layout and prop positions stable across shots in this location.",
            }
        ],
        "product_assets": [
            {
                "product_asset_key": prod_key,
                "display_name": product_name,
                "product_name": product_name,
                "description": f"{product_name} hero SKU as provided in S1 context",
                "key_visual_features": ["pack shape", "brand mark", "primary color"],
                "usage_notes": "Show authentic packaging only; no invented claims.",
                "continuity_notes": "Same SKU angle and label legibility across segments.",
            }
        ],
        "asset_generation_specs": [
            {
                "asset_key": "asset_char_main",
                "asset_kind": "character",
                "reference_role": "character_reference",
                "display_name": "Lead reference",
                "image_prompt": char_blob,
                "negative_prompt": char_blob,
                "immutable_constraints": [char_blob],
                "linked_entity_key": char_key,
            },
            {
                "asset_key": "asset_scene_main",
                "asset_kind": "scene",
                "reference_role": "scene_reference",
                "display_name": "Apartment reference",
                "image_prompt": scene_blob,
                "negative_prompt": scene_blob,
                "immutable_constraints": [scene_blob],
                "linked_entity_key": scene_key,
            },
            {
                "asset_key": "asset_prod_main",
                "asset_kind": "product",
                "reference_role": "product_reference",
                "display_name": f"{product_name} packshot reference",
                "image_prompt": prod_blob,
                "negative_prompt": prod_blob,
                "immutable_constraints": [prod_blob],
                "linked_entity_key": prod_key,
            },
        ],
        "video_generation_specs": [
            {
                "spec_key": "vid_seg_1",
                "segment_id": "seg_1",
                "shot_id": "seg_1_shot_1",
                "video_prompt": (
                    "Single continuous vertical 9:16 segment: handheld kitchen morning routine from wide "
                    "establishing through natural gestures to a clear hero moment on the product label, "
                    "one flowing beat for the whole segment (not split into separate render specs)."
                ),
                "reference_asset_keys": ["asset_char_main", "asset_scene_main", "asset_prod_main"],
                "duration_sec": 7.0,
                "aspect_ratio": "9:16",
                "camera": "handheld medium; slow push-in on label",
                "visual_action": "pours drink, checks phone; label read moment",
                "audio_notes": "ambient kitchen, light foley; soft room tone",
                "dialogue_or_voiceover_ref": "dov_1",
                "must_show": [product_name],
                "must_avoid": ["medical claims", "before/after skin", "guaranteed results"],
            },
        ],
        "dialogue_or_voiceover": [
            {
                "ref_id": "dov_1",
                "segment_id": "seg_1",
                "shot_id": "seg_1_shot_1",
                "mode": "voiceover",
                "speaker": "narrator",
                "text": "Another rushed morning—until the routine gets a little easier.",
                "language": "zh-CN",
                "timing_notes": "0–4s",
            },
            {
                "ref_id": "dov_2",
                "segment_id": "seg_1",
                "shot_id": None,
                "mode": "subtitle_only",
                "speaker": "",
                "text": "See the label details clearly.",
                "language": "zh-CN",
                "timing_notes": "4–7s overlay",
            },
        ],
        "subtitle_strategy": {
            "enabled": True,
            "language": "zh-CN",
            "max_lines": 2,
            "tone": "conversational",
            "cta_style": "soft",
        },
        "continuity_rules": [
            {
                "rule_key": "cr_char_visual",
                "applies_to": "characters",
                "rule_text": "Keep lead wardrobe and grooming consistent unless script marks a time jump.",
                "severity": "hard",
            },
            {
                "rule_key": "cr_product_truth",
                "applies_to": "product_assets",
                "rule_text": "Do not invent certifications, metrics, or medical outcomes.",
                "severity": "hard",
            },
        ],
        "execution_notes": [
            {
                "note_key": "en_pipeline",
                "note_type": "pipeline",
                "note_text": "S3 must consume asset_generation_specs only; S4 must consume video_generation_specs only in P3+.",
            }
        ],
    }


class StoryBlueprintSchema(BaseModel):
    model_config = ConfigDict(extra="ignore")

    blueprint_schema_version: str = ""
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
    scene_goals: LegacyFlexibleValue = None
    product_selling_point_mapping: LegacyFlexibleValue = None
    target_user_expression: str = ""
    visual_requirements: LegacyVisualRequirements = None
    dialogue_tone: str = ""
    must_show_elements: List[str] = Field(default_factory=list)
    must_avoid_elements: List[str] = Field(default_factory=list)
    meta: Dict[str, Any] = Field(default_factory=dict)
    language_policy: Dict[str, str] = Field(default_factory=dict)
    marketing_strategy: LegacyFlexibleValue = None
    story_structure: LegacyFlexibleValue = None
    story_framework: LegacyFlexibleValue = None
    asset_requirements: LegacyFlexibleValue = None
    shot_plan: Dict[str, Any] = Field(default_factory=dict)
    spoken_strategy: LegacyFlexibleValue = None
    creative_brief: Dict[str, Any] = Field(default_factory=dict)
    market_visual_constraints: LegacyFlexibleValue = None
    visual_style_constraints: LegacyFlexibleValue = None
    story_outline: Optional[StoryOutlineSchema] = None
    story_overview: Optional[StoryOverviewSchema] = None
    characters: List[CreativeBlueprintCharacterSchema] = Field(default_factory=list)
    scenes: List[CreativeBlueprintSceneSchema] = Field(default_factory=list)
    product_assets: List[CreativeBlueprintProductAssetSchema] = Field(default_factory=list)
    asset_generation_specs: List[AssetGenerationSpecSchema] = Field(default_factory=list)
    video_generation_specs: List[VideoGenerationSpecSchema] = Field(default_factory=list)
    dialogue_or_voiceover: List[DialogueOrVoiceoverItemSchema] = Field(default_factory=list)
    subtitle_strategy: Optional[SubtitleStrategySchema] = None
    continuity_rules: List[ContinuityRuleSchema] = Field(default_factory=list)
    execution_notes: List[ExecutionNoteSchema] = Field(default_factory=list)

    @field_validator("characters", "scenes", "product_assets", mode="before")
    @classmethod
    def _coerce_entity_lists(cls, v: Any) -> Any:
        if v is None:
            return []
        return v


def parse_story_blueprint_json(data: Dict[str, Any]) -> StoryBlueprintSchema:
    """Validate blueprint JSON; map Pydantic errors to domain error (HTTP 422), never 500 from ValidationError."""
    try:
        return StoryBlueprintSchema.model_validate(data)
    except ValidationError as e:
        sample: list[dict[str, Any]] = []
        for err in (e.errors() or [])[:5]:
            loc = err.get("loc") or ()
            path = ".".join(str(x) for x in loc)
            sample.append({"path": path or "(root)", "actual_type": str(err.get("type") or "")})
        logger.warning(
            "[AI_BLUEPRINT_VALIDATE_FAILED] pydantic_errors=%s",
            json.dumps(sample, ensure_ascii=False),
        )
        paths = [x["path"] for x in sample if x.get("path")]
        raise ShortDramaInvalidModelOutputError(
            "Story blueprint JSON failed schema validation.",
            code="ai_blueprint_validate_failed",
            missing_fields=paths,
        ) from e


class GenerateStoryRequest(BaseModel):
    project_id: int


class GenerateStoryResponse(BaseModel):
    record_id: int
    project_id: int
    version: int
    blueprint: StoryBlueprintSchema
    approved: bool = False
    created_at: Optional[datetime] = None
