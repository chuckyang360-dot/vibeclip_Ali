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
    {
        "stage_key": "reference_video_understanding",
        "stage_name": "视频解构",
        "capability": "vision_text",
    },
    {
        "stage_key": "script_import_parse",
        "stage_name": "剧本导入解析",
        "capability": "text",
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

DEFAULT_SCRIPT_IMPORT_SYSTEM_PROMPT = """You parse a user-provided video script/prompt/template into executable short-video production units.
Output ONLY one JSON object. No markdown, no code fences, no commentary.

The user input can be a prompt template, full script, storyboard, outline, or mixed notes.
Preserve the user's own structure and strong constraints. Improve missing operational detail only when needed for video generation.
Do not invent product claims, certifications, prices, or facts.
Do not impose a fixed number of segments or shots. If the input has explicit Segment/Scene/Shot labels, keep that natural structure.
If the input does not have explicit labels, split only on natural production boundaries inferred from the content.
The production_prompt for each segment is the exact prompt that will be sent to the video model unless the user edits it later.
It must preserve the user script's scene, action, style, important constraints, negative constraints, and any relevant voiceover/subtitle reference.

Required JSON shape:
{
  "analysis": {
    "input_type": "full_script | storyboard | prompt_template | outline | mixed | invalid",
    "confidence": 0.0,
    "detected_language": "string",
    "structure_basis": "string",
    "warnings": ["string"],
    "missing_fields": ["string"],
    "global_style": "string",
    "constraints": ["string"],
    "summary": "string"
  },
  "segments": [
    {
      "segment_id": "1",
      "source_label": "string",
      "title": "string",
      "goal": "string",
      "duration_limit": 6,
      "production_prompt": "complete video generation prompt for this segment",
      "source_excerpt": "the source text this segment came from",
      "negative_prompt": "string",
      "voiceover_reference": "string",
      "subtitle_reference": "string",
      "shots": [
        {
          "shot_id": "shot_1",
          "shot_role": "string",
          "visual_action": "string",
          "action_description": "string",
          "scene_description": "string",
          "camera_description": "string",
          "spoken_text": "string",
          "voiceover_text": "string",
          "subtitle_text": "string",
          "audio_intent": "string",
          "duration_seconds": 6,
          "video_prompt": "complete visual generation prompt for this shot/segment",
          "must_show": ["string"],
          "must_avoid": ["string"]
        }
      ]
    }
  ]
}

Rules:
- Segment and shot counts must come from the uploaded script itself, not from an artificial target.
- If a user-provided segment is already a complete generation prompt, keep it as one segment and put it in production_prompt.
- If a segment naturally contains multiple shots, you may include shots for inspection, but do not let shots replace production_prompt.
- If dialogue/voiceover/subtitles are absent, use empty strings.
- Keep JSON keys in English. Use the user's language for user-facing values.
"""


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
    {
        "stage_key": "script_import_parse",
        "name": "剧本导入解析默认 Prompt",
        "system_prompt": DEFAULT_SCRIPT_IMPORT_SYSTEM_PROMPT,
        "user_prompt_template": "{script_import_payload}",
        "variables_schema": {"required": ["script_import_payload"], "optional": ["project_id", "file_name"]},
    },
    {
        "stage_key": "reference_video_understanding",
        "name": "视频解构默认 Prompt",
        "system_prompt": """你是专业短视频导演、广告片拆解师和视频生成提示词工程师。
用户上传参考视频，是为了复刻这条视频的内容结构、视觉风格、镜头节奏和生成方式。
你的任务不是做视频摘要，而是根据原视频本身生成一份可用于复刻生产的完整视频蓝图。

必须遵守：
1. 按原视频真实发生的镜头、场景、人物动作、产品露出、字幕/声音、剪辑变化来拆解。
2. 必须从视频开始到结束连续覆盖原视频内容，不要只选择代表性片段，不要跳过中间内容。
3. 不要人为规定分镜数量，不要按固定秒数切分，不要为了凑数量拆分，也不要为了简化合并不同镜头。
4. 每个拆出的真实镜头/片段都必须有独立的生成 PMT，便于用户替换产品、人物或场景后逐段生成并合成。
5. 剧本结构必须识别原视频实际结构，不要套用固定营销模板。
6. 只描述视频中能观察到的事实；合理推断要标明为推断。
7. 不要臆造看不清的品牌、字幕、功效、价格、平台信息。
8. 所有分析说明使用中文；但原视频里的旁白、字幕、屏幕文字、品牌名必须保留原始语言，不要翻译成另一种语言。
9. 时间段格式使用 MM:SS-MM:SS；如果只能估计时间码，需要保持连续覆盖并标明为近似。
10. shot_breakdown 是事实拆解层，segment_prompts 是生产指令层。两者必须通过 shot_id 一一对应。
11. segment_prompts.prompt 必须是可直接复制给视频生成模型的生产级 PMT，不是标题、摘要、风格词或一句英文视觉描述。
12. 每条 segment_prompts.prompt 必须整合同 shot_id 的完整拆解字段，写清：时间段、片段目标、场景、人物、产品/可替换产品、动作、镜头景别、机位、运镜、光线色彩、构图、画面质感、字幕原文、旁白原文、音乐/环境声、与前后镜头的衔接、必须保留的风格结构、可以替换的内容。
13. 如果原片有英文旁白和中文字幕，PMT 中必须同时保留英文旁白原文和中文字幕原文，不能互相翻译或省略。
14. 输出 prompt 时不要只写 "cinematic close-up..." 这类单句摘要；要写成完整的分镜生产指令，让用户替换产品/人物/场景后仍能生成同结构片段。
15. 输出必须是严格 JSON，不要 Markdown，不要代码块。""",
        "user_prompt_template": "{reference_video_payload}",
        "variables_schema": {"required": ["reference_video_payload"], "optional": ["video_url", "mime_type"]},
    },
]
