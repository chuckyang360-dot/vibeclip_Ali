from enum import Enum


class ProjectStatus(str, Enum):
    CREATED = "created"
    PRODUCT_PARSED = "product_parsed"
    STORY_GENERATED = "story_generated"
    ASSET_SPECS_GENERATED = "asset_specs_generated"
    SEGMENTS_GENERATED = "segments_generated"
    ASSETS_RENDERING = "assets_rendering"
    ASSETS_READY = "assets_ready"
    VIDEO_RENDERING = "video_rendering"
    #: 全部片段 MP4 已就绪，可合成最终成片（区别于仍在生成片段）
    VIDEO_SEGMENTS_READY = "video_segments_ready"
    COMPLETED = "completed"
    FAILED = "failed"


class WorkflowStep(str, Enum):
    PARSE_PRODUCT = "parse_product"
    GENERATE_STORY = "generate_story"
    GENERATE_ASSET_SPECS = "generate_asset_specs"
    GENERATE_SEGMENTS = "generate_segments"
    RENDER_ASSETS = "render_assets"
    RENDER_VIDEO = "render_video"
    MERGE = "merge"


class RenderTargetType(str, Enum):
    CHARACTER_IMAGE = "character_image"
    SCENE_IMAGE = "scene_image"
    PRODUCT_IMAGE = "product_image"
    SEGMENT_VIDEO = "segment_video"
    MERGED_VIDEO = "merged_video"
    SEGMENT = "segment"
    FINAL = "final"


class RenderJobStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    # Legacy aliases (older rows / docs)
    PENDING = "pending"
    SUCCEEDED = "succeeded"


class AssetRoleType(str, Enum):
    PROTAGONIST = "protagonist"
    SUPPORTING = "supporting"
    NARRATOR = "narrator"
    OTHER = "other"


class SceneType(str, Enum):
    INTERIOR = "interior"
    EXTERIOR = "exterior"
    STUDIO = "studio"
    ABSTRACT = "abstract"
    OTHER = "other"
