from __future__ import annotations

from typing import Any


AI_STAGE_DEFINITIONS: list[dict[str, str]] = [
    {
        "stage_key": "s1_product_understanding",
        "stage_name": "S1 产品理解",
        "capability": "vision_text",
    },
    {
        "stage_key": "s2_story_generation",
        "stage_name": "S2 剧本生成",
        "capability": "text",
    },
    {
        "stage_key": "s3_asset_management",
        "stage_name": "S3 资产管理",
        "capability": "image",
    },
    {
        "stage_key": "s4_video_generation",
        "stage_name": "S4 视频生成",
        "capability": "video",
    },
]


DEFAULT_AI_MODELS: list[dict[str, Any]] = [
    {
        "provider": "xai",
        "model_id": "grok-4.20",
        "display_name": "Grok 4.20",
        "capability": "vision_text",
        "sort_order": 10,
        "metadata_json": {"env_key": "XAI_TEXT_MODEL", "supports_images": True},
    },
    {
        "provider": "gemini",
        "model_id": "gemini-3.1-pro-preview",
        "display_name": "Gemini 3.1 Pro Preview",
        "capability": "vision_text",
        "sort_order": 20,
        "config_schema": {
            "thinking_level": ["low", "medium", "high"],
            "response_mime_type": "application/json",
        },
        "default_config": {"thinking_level": "low", "response_mime_type": "application/json"},
        "metadata_json": {"env_key": "GEMINI_API_KEY", "supports_images": True},
    },
    {
        "provider": "gemini",
        "model_id": "gemini-3-flash-preview",
        "display_name": "Gemini 3 Flash Preview",
        "capability": "vision_text",
        "sort_order": 30,
        "config_schema": {
            "thinking_level": ["minimal", "low", "medium", "high"],
            "response_mime_type": "application/json",
        },
        "default_config": {"thinking_level": "low", "response_mime_type": "application/json"},
        "metadata_json": {"env_key": "GEMINI_API_KEY", "supports_images": True},
    },
    {
        "provider": "xai",
        "model_id": "grok-4.20",
        "display_name": "Grok 4.20",
        "capability": "text",
        "sort_order": 10,
        "metadata_json": {"env_key": "XAI_TEXT_MODEL"},
    },
    {
        "provider": "gemini",
        "model_id": "gemini-3.1-pro-preview",
        "display_name": "Gemini 3.1 Pro Preview",
        "capability": "text",
        "sort_order": 20,
        "config_schema": {
            "thinking_level": ["low", "medium", "high"],
            "response_mime_type": "application/json",
        },
        "default_config": {"thinking_level": "medium", "response_mime_type": "application/json"},
        "metadata_json": {"env_key": "GEMINI_API_KEY"},
    },
    {
        "provider": "gemini",
        "model_id": "gemini-3-flash-preview",
        "display_name": "Gemini 3 Flash Preview",
        "capability": "text",
        "sort_order": 30,
        "config_schema": {
            "thinking_level": ["minimal", "low", "medium", "high"],
            "response_mime_type": "application/json",
        },
        "default_config": {"thinking_level": "low", "response_mime_type": "application/json"},
        "metadata_json": {"env_key": "GEMINI_API_KEY"},
    },
    {
        "provider": "gemini",
        "model_id": "gemini-3.1-flash-image-preview",
        "display_name": "Nano Banana 2 / Gemini 3.1 Flash Image",
        "capability": "image",
        "sort_order": 10,
        "config_schema": {
            "aspect_ratio": ["1:1", "3:4", "4:3", "9:16", "16:9"],
            "image_size": ["1K", "2K", "4K"],
            "response_format": ["r2_url", "b64_json"],
        },
        "default_config": {"aspect_ratio": "9:16", "image_size": "1K", "response_format": "r2_url"},
        "metadata_json": {"env_key": "GEMINI_API_KEY", "response_modalities": ["TEXT", "IMAGE"]},
    },
    {
        "provider": "gemini",
        "model_id": "gemini-3-pro-image-preview",
        "display_name": "Nano Banana Pro / Gemini 3 Pro Image",
        "capability": "image",
        "sort_order": 20,
        "config_schema": {
            "aspect_ratio": ["1:1", "3:4", "4:3", "9:16", "16:9"],
            "image_size": ["1K", "2K", "4K"],
            "response_format": ["r2_url", "b64_json"],
        },
        "default_config": {"aspect_ratio": "9:16", "image_size": "1K", "response_format": "r2_url"},
        "metadata_json": {"env_key": "GEMINI_API_KEY", "response_modalities": ["TEXT", "IMAGE"]},
    },
    {
        "provider": "xai",
        "model_id": "grok-imagine-image",
        "display_name": "Grok Imagine Image",
        "capability": "image",
        "sort_order": 30,
        "config_schema": {"response_format": ["r2_url", "url", "b64_json"]},
        "default_config": {"response_format": "r2_url"},
        "metadata_json": {"env_key": "XAI_IMAGE_MODEL"},
    },
    {
        "provider": "gemini",
        "model_id": "veo-3.1-generate-preview",
        "display_name": "Veo 3.1 Generate Preview",
        "capability": "video",
        "sort_order": 10,
        "config_schema": {
            "aspect_ratio": ["16:9", "9:16"],
            "duration_seconds": [4, 6, 8],
            "person_generation": ["allow_all", "allow_adult"],
            "storage": ["r2"],
        },
        "default_config": {
            "aspect_ratio": "9:16",
            "duration_seconds": 8,
            "person_generation": "allow_adult",
            "storage": "r2",
        },
        "metadata_json": {"env_key": "GEMINI_API_KEY", "requires_r2_rehost": True},
    },
    {
        "provider": "gemini",
        "model_id": "veo-3.1-fast-generate-preview",
        "display_name": "Veo 3.1 Fast Generate Preview",
        "capability": "video",
        "sort_order": 11,
        "config_schema": {
            "aspect_ratio": ["16:9", "9:16"],
            "duration_seconds": [4, 6, 8],
            "storage": ["r2"],
        },
        "default_config": {"aspect_ratio": "9:16", "duration_seconds": 8, "storage": "r2"},
        "metadata_json": {"env_key": "GEMINI_API_KEY", "requires_r2_rehost": True},
    },
    {
        "provider": "gemini",
        "model_id": "veo-3.1-lite-generate-preview",
        "display_name": "Veo 3.1 Lite Generate Preview",
        "capability": "video",
        "sort_order": 12,
        "config_schema": {
            "aspect_ratio": ["16:9", "9:16"],
            "duration_seconds": [4, 6, 8],
            "storage": ["r2"],
        },
        "default_config": {"aspect_ratio": "9:16", "duration_seconds": 8, "storage": "r2"},
        "metadata_json": {"env_key": "GEMINI_API_KEY", "requires_r2_rehost": True},
    },
    {
        "provider": "xai",
        "model_id": "grok-imagine-video",
        "display_name": "Grok Imagine Video",
        "capability": "video",
        "sort_order": 20,
        "config_schema": {"aspect_ratio": ["16:9", "9:16"], "duration_seconds": [4, 6, 8], "storage": ["r2"]},
        "default_config": {"aspect_ratio": "9:16", "duration_seconds": 8, "storage": "r2"},
        "metadata_json": {"env_key": "XAI_VIDEO_MODEL", "requires_r2_rehost": True},
    },
    {
        "provider": "seedance",
        "model_id": "doubao-seedance-2-0-260128",
        "display_name": "Seedance 2.0",
        "capability": "video",
        "sort_order": 30,
        "config_schema": {"aspect_ratio": ["16:9", "9:16"], "duration_seconds": [4, 6, 8], "storage": ["r2"]},
        "default_config": {"aspect_ratio": "9:16", "duration_seconds": 8, "storage": "r2"},
        "metadata_json": {"env_key": "SEEDANCE_VIDEO_MODEL"},
    },
]


DEFAULT_AI_PROMPTS: list[dict[str, Any]] = [
    {
        "stage_key": "s1_product_understanding",
        "name": "S1 产品理解默认 Prompt",
        "system_prompt": "Analyze the product inputs and return strict JSON that matches the existing S1 product understanding schema.",
        "user_prompt_template": "{product_payload}",
        "variables_schema": {"required": ["product_payload"], "optional": ["image_urls"]},
    },
    {
        "stage_key": "s2_story_generation",
        "name": "S2 剧本生成默认 Prompt",
        "system_prompt": "Generate a short-drama story plan as strict JSON using the existing schema and project language policy.",
        "user_prompt_template": "{story_payload}",
        "variables_schema": {"required": ["story_payload"], "optional": ["product_context", "creative_brief"]},
    },
    {
        "stage_key": "s3_asset_management",
        "name": "S3 资产管理默认 Prompt",
        "system_prompt": "Generate or refine visual asset prompts that preserve the product and story constraints.",
        "user_prompt_template": "{asset_payload}",
        "variables_schema": {"required": ["asset_payload"], "optional": ["story_blueprint", "reference_images"]},
    },
    {
        "stage_key": "s4_video_generation",
        "name": "S4 视频生成默认 Prompt",
        "system_prompt": "Generate a video prompt that follows the segment script, reference assets, duration, and aspect ratio.",
        "user_prompt_template": "{video_payload}",
        "variables_schema": {"required": ["video_payload"], "optional": ["reference_image_urls", "duration_seconds", "aspect_ratio"]},
    },
]
