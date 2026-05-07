from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class CharacterAssetSchema(BaseModel):
    id: Optional[int] = None
    name: str
    role_type: str
    description: Optional[str] = None
    business_profile: Dict[str, Any] = Field(default_factory=dict)
    image_prompt: Optional[str] = None
    visual_prompt: Optional[str] = None
    technical_constraints: Dict[str, Any] = Field(default_factory=dict)
    image_url: Optional[str] = None
    visual_anchor_image_id: Optional[int] = None
    source_asset_version: str = "legacy-1"
    exposure_priority: str = "secondary"  # primary | secondary | background
    narrative_function: Optional[str] = None
    purpose: Optional[str] = None
    asset_identity: Optional[str] = None
    boundary_warnings: List[str] = Field(default_factory=list)
    meta: Dict[str, Any] = Field(default_factory=dict)


class SceneAssetSchema(BaseModel):
    id: Optional[int] = None
    name: str
    scene_type: Optional[str] = None
    scene_form: Optional[str] = None
    description: Optional[str] = None
    business_profile: Dict[str, Any] = Field(default_factory=dict)
    image_prompt: Optional[str] = None
    visual_prompt: Optional[str] = None
    technical_constraints: Dict[str, Any] = Field(default_factory=dict)
    image_url: Optional[str] = None
    visual_anchor_image_id: Optional[int] = None
    source_asset_version: str = "legacy-1"
    exposure_priority: str = "secondary"  # primary | secondary | background
    narrative_function: Optional[str] = None
    purpose: Optional[str] = None
    asset_identity: Optional[str] = None
    boundary_warnings: List[str] = Field(default_factory=list)
    meta: Dict[str, Any] = Field(default_factory=dict)


class ProductAssetSchema(BaseModel):
    id: Optional[int] = None
    name: str
    product_role: Optional[str] = None
    description: Optional[str] = None
    business_profile: Dict[str, Any] = Field(default_factory=dict)
    image_prompt: Optional[str] = None
    visual_prompt: Optional[str] = None
    technical_constraints: Dict[str, Any] = Field(default_factory=dict)
    immutable_structure_constraints: List[str] = Field(default_factory=list)
    image_url: Optional[str] = None
    visual_anchor_image_id: Optional[int] = None
    source_asset_version: str = "legacy-1"
    exposure_priority: str = "secondary"  # primary | secondary | background
    narrative_function: Optional[str] = None
    purpose: Optional[str] = None
    asset_identity: Optional[str] = None
    boundary_warnings: List[str] = Field(default_factory=list)
    meta: Dict[str, Any] = Field(default_factory=dict)


class AssetSpecsBundleSchema(BaseModel):
    characters: List[CharacterAssetSchema] = Field(default_factory=list)
    scenes: List[SceneAssetSchema] = Field(default_factory=list)
    products: List[ProductAssetSchema] = Field(default_factory=list)


class GenerateAssetSpecsRequest(BaseModel):
    project_id: int


class GenerateAssetSpecsResponse(BaseModel):
    project_id: int
    assets: AssetSpecsBundleSchema


class GenerateAssetImagesRequest(BaseModel):
    project_id: int


class AssetImageBatchResponse(BaseModel):
    project_id: int
    characters_attempted: int = 0
    characters_succeeded: int = 0
    scenes_attempted: int = 0
    scenes_succeeded: int = 0
    products_attempted: int = 0
    products_succeeded: int = 0
    errors: List[Dict[str, Any]] = Field(default_factory=list)


class UpdateAssetRequest(BaseModel):
    project_id: int
    name: Optional[str] = None
    role_type: Optional[str] = None
    scene_type: Optional[str] = None
    description: Optional[str] = None
    visual_prompt: Optional[str] = None
    voice_style: Optional[str] = None
    reference_image_data_url: Optional[str] = None
    reference_image_name: Optional[str] = None
    product_usage: Optional[str] = None
    product_type: Optional[str] = None


class UpdateAssetResponse(BaseModel):
    project_id: int
    asset_type: str
    asset_id: int
    stale_marked_step_4: bool = True


class RegenerateOneAssetImageRequest(BaseModel):
    project_id: int
    asset_type: str
    asset_id: int


class RegenerateOneAssetImageResponse(BaseModel):
    project_id: int
    asset_type: str
    asset_id: int
    image_url: Optional[str] = None
    stale_marked_step_4: bool = True


class AssetImageSchema(BaseModel):
    id: int
    image_url: str
    image_type: str
    variant_label: Optional[str] = None
    variant_meta: Dict[str, Any] = Field(default_factory=dict)
    prompt_snapshot: Optional[str] = None
    provider: Optional[str] = None
    provider_params: Dict[str, Any] = Field(default_factory=dict)
    is_cover: bool = False
    status: str = "active"
    created_at: Optional[datetime] = None


class AssetReferenceImageSchema(BaseModel):
    id: int
    file_url: str
    file_name: Optional[str] = None
    sort_order: int = 0
    is_primary: bool = False
    status: str = "active"
    created_at: Optional[datetime] = None


class AssetDetailSchema(BaseModel):
    id: int
    project_id: int
    asset_type: str
    name: str
    description: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    base_prompt: Optional[str] = None
    source: str = "system_generated"
    role_type: Optional[str] = None
    scene_type: Optional[str] = None
    scene_form: Optional[str] = None
    product_role: Optional[str] = None
    narrative_function: Optional[str] = None
    exposure_priority: Optional[str] = None
    visual_anchor_image_id: Optional[int] = None
    variant_image_ids: List[int] = Field(default_factory=list)
    cover_image_id: Optional[int] = None
    cover_image: Optional[AssetImageSchema] = None
    image_count: int = 0
    has_reference_images: bool = False
    sort_order: int = 0
    status: str = "active"
    extra: Dict[str, Any] = Field(default_factory=dict)
    images: List[AssetImageSchema] = Field(default_factory=list)
    reference_images: List[AssetReferenceImageSchema] = Field(default_factory=list)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class AssetListResponse(BaseModel):
    project_id: int
    asset_type: str
    assets: List[AssetDetailSchema] = Field(default_factory=list)


class CreateAssetRequest(BaseModel):
    project_id: int
    asset_type: str
    name: str
    description: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    base_prompt: Optional[str] = None
    source: Optional[str] = "user_created"
    type_fields: Dict[str, Any] = Field(default_factory=dict)
    reference_images: List[Dict[str, str]] = Field(default_factory=list)
    uploaded_images: List[Dict[str, str]] = Field(default_factory=list)
    generate_count: int = 4
    variant_directions: List[str] = Field(default_factory=list)


class RegenerateAssetRequest(BaseModel):
    project_id: int
    asset_id: int
    reuse_reference_images: bool = True
    reference_images: List[Dict[str, str]] = Field(default_factory=list)
    generate_count: int = 1
    variant_directions: List[str] = Field(default_factory=list)
    image_description_override: Optional[str] = None
    current_image_prompt: Optional[str] = None
    base_prompt: Optional[str] = None


class AppendUploadedImagesRequest(BaseModel):
    project_id: int
    uploaded_images: List[Dict[str, str]] = Field(default_factory=list)


class AnalyzeAssetReferenceImageRequest(BaseModel):
    project_id: int
    image: str


class AnalyzeAssetReferenceImageResponse(BaseModel):
    asset: AssetDetailSchema
    warning: Optional[str] = None


class CreateAssetFromImageRequest(BaseModel):
    project_id: int
    asset_type: str
    image: str
    optional_name: Optional[str] = None


class UpdateAssetMetaRequest(BaseModel):
    project_id: int
    name: Optional[str] = None
    description: Optional[str] = None
    tags: Optional[List[str]] = None
    base_prompt: Optional[str] = None
    type_fields: Optional[Dict[str, Any]] = None


class SetAssetCoverRequest(BaseModel):
    project_id: int
    image_id: int


class RepairSceneStructureRequest(BaseModel):
    project_id: int


class SceneRepairDiffSchema(BaseModel):
    asset_id: int
    name: str
    before: Dict[str, Optional[str]]
    after: Dict[str, Optional[str]]
    audit: Dict[str, Optional[str]]


class RepairSceneStructureResponse(BaseModel):
    project_id: int
    dry_run: bool = False
    repaired_count: int
    diffs: List[SceneRepairDiffSchema] = Field(default_factory=list)
