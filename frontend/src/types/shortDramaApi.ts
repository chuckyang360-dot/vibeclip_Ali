/** Short Drama REST API shapes (aligned with backend Pydantic schemas; JSON field names). */

export type ShortDramaProjectDto = {
  id: number;
  user_id: number;
  project_name: string;
  status: string;
  effective_status?: string | null;
  suggested_status?: string | null;
  status_recoverable?: boolean;
  duration?: string | null;
  format?: string | null;
  style?: string | string[] | null;
  visual_style?: string | null;
  aspect_ratio?: string | null;
  target_market?: string | null;
  marketing_goal?: string | null;
  target_audience?: string | null;
  brand_tone?: string | null;
  creative_intent?: string | null;
  creative_brief?: string | null;
  workflow_language?: string | null;
  video_language?: string | null;
  last_active_step?: 'step_0' | 'step_1' | 'step_2' | 'step_3' | 'step_4' | 'overview' | null;
  step_status?: Record<string, string>;
  overall_status?: 'draft' | 'stale' | 'generating' | 'completed' | 'failed' | null;
  /** 若后端在 pipeline 中透出运行锁，优先用于 S3 生成中判断（可选）。 */
  task_running?: boolean | null;
  current_stage?: string | null;
  failed_stage?: string | null;
  error_message?: string | null;
  error_type?: string | null;
  can_retry?: boolean | null;
  final_video_url?: string | null;
  has_final_video?: boolean | null;
  has_all_segment_videos?: boolean | null;
  segment_video_count?: number | null;
  segment_video_total?: number | null;
  cover_asset?: {
    asset_type: 'character' | 'product' | 'scene' | null;
    name: string | null;
    image_url: string | null;
    status: 'ready' | 'missing';
  };
  creative_intent_input?: CreativeIntentInputDto | null;
  product_input?: ProductInputDto | null;
  product_understanding?: Record<string, unknown> | null;
  creative_brief_structured?: CreativeBriefDto | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type CreateShortDramaProjectResponseDto = {
  project: ShortDramaProjectDto;
};

export type ShortDramaProjectListResponseDto = {
  projects: ShortDramaProjectDto[];
};

export type ProjectEntryRedirectResponseDto = {
  project_id: number;
  redirect_to: string;
  reason: 'completed_overview' | 'last_active_step' | 'default_step_1';
};

export type CreativeIntentInputDto = {
  intent_text: string;
  platform_hints: string[];
  duration_hint: string;
  aspect_ratio_hint: string;
};

export type ProductInputImageDto = {
  url: string;
  image_order?: number | null;
  is_main_image?: boolean;
  image_caption_raw?: string;
};

export type ProductInputDto = {
  product_images: ProductInputImageDto[];
  product_note: string;
  product_url: string;
};

export type CreativeBriefDto = {
  user_goal?: string;
  product_understanding?: Record<string, unknown>;
  creative_intent?: Record<string, unknown>;
  ai_interpretation?: Record<string, unknown>;
  uncertainties?: unknown[];
  source_inputs?: Record<string, unknown>;
};

export type SaveCreativeIntentResponseDto = {
  project_id: number;
  creative_intent_input: CreativeIntentInputDto;
};

export type SaveProductInputResponseDto = {
  project_id: number;
  product_input: ProductInputDto;
};

export type GenerateCreativeBriefResponseDto = {
  project_id: number;
  product_understanding: Record<string, unknown>;
  creative_brief: CreativeBriefDto;
};

export type TouchProjectStepBody = {
  step: 'step_0' | 'step_1' | 'step_2' | 'step_3' | 'step_4' | 'overview';
  save_intent?: 'save_draft' | 'before_exit';
};

export type ProductInputPayload = {
  product_name_raw?: string | null;
  product_category_raw?: string | null;
  brand_raw?: string | null;
  price_raw?: string | null;
  target_users_raw?: string | null;
  selling_points_raw?: string[] | null;
  usage_scenarios_raw?: string[] | null;
  extra_notes_raw?: string | null;
  product_images?: {
    image_url: string;
    image_order?: number;
    is_main_image?: boolean;
    image_caption_raw?: string;
  }[] | null;
};

export type ProductContextDto = {
  product_name: string;
  category?: string;
  brand_name?: string;
  core_features?: string[];
  selling_points?: string[];
  brand_tone?: string;
  constraints?: string[];
  notes_for_story?: string;
  meta?: Record<string, unknown>;
  product_category?: string;
  product_summary?: string;
  core_selling_points?: string[];
  target_users?: string[];
  usage_scenarios?: string[];
  visual_features?: string[];
  product_form?: string;
  key_functions?: string[];
  emotional_value?: string[];
  suitable_story_angles?: string[];
  user_pain_points?: string[];
  visual_risk_notes?: string[];
  consistency_notes?: string[];
  immutable_structure_constraints?: string[];
  extracted_from_images?: string[];
  parse_confidence?: number;
  source_trace?: Record<string, string>;
  field_meta?: Record<string, { edited_by_user?: boolean; edited_at?: string }>;
};

export type ProductImageUnderstandingDto = {
  detected_product_type?: string;
  detected_visual_features?: string[];
  detected_materials?: string[];
  detected_colors?: string[];
  detected_usage_context?: string[];
  detected_people_type?: string[];
  detected_pose_or_usage?: string[];
  detected_packaging?: string[];
  detected_brand_clues?: string[];
  detected_quality_risks?: string[];
  image_conflicts?: string[];
  per_image_notes?: Record<string, unknown>[];
};

export type ParseProductResponseDto = {
  record_id: number;
  project_id: number;
  version: number;
  parse_status?: string;
  raw_inputs: Record<string, unknown>;
  image_understanding?: ProductImageUnderstandingDto;
  product_context: ProductContextDto;
  from_version?: number | null;
  updated_fields?: string[];
  preserved_fields?: string[];
  created_at?: string | null;
};

export type UpdateProductContextResponseDto = {
  record_id: number;
  project_id: number;
  version: number;
  parse_status?: string;
  product_context: ProductContextDto;
  created_at?: string | null;
};

export type SegmentPlanItemDto = {
  segment_id?: string;
  stage_name?: string;
  title?: string;
  segment_title?: string;
  segment_goal?: string;
  duration_sec?: number;
  key_message?: string;
  goal?: string;
  duration_seconds?: number;
  story_beat?: string;
  segment_role?: string;
  emotional_state?: string;
  summary?: string;
  product_exposure_mode?: string;
  product_exposure?: string;
  source_selling_point?: string;
  product_feature_to_show?: string;
  target_user_trigger?: string;
  required_visual_elements?: string[];
  required_assets?: string[];
  expected_assets?: string[];
  transition_to_next?: string;
};

export type StoryBeatDto = {
  title?: string;
  purpose?: string;
  content?: string;
};

export type StoryOutlineDto = {
  title?: string;
  summary?: string;
  structure_type?: string;
  structure_reasoning?: string;
  story_beats?: StoryBeatDto[];
};

export type StoryBlueprintDto = {
  blueprint_schema_version?: string;
  story_outline?: StoryOutlineDto;
  story_overview?: Record<string, unknown>;
  characters?: unknown[];
  scenes?: unknown[];
  product_assets?: unknown[];
  asset_generation_specs?: unknown[];
  video_generation_specs?: unknown[];
  dialogue_or_voiceover?: unknown[];
  subtitle_strategy?: Record<string, unknown>;
  continuity_rules?: unknown[];
  execution_notes?: unknown[];
  title?: string;
  script_title?: string;
  format?: string;
  style?: string | string[];
  premise?: string;
  target_audience?: string;
  core_pain?: string;
  emotional_trigger?: string;
  product_promise?: string;
  conversion_goal?: string;
  script_structure_type?: string;
  script_type_display?: string;
  structure_type_display?: string;
  structure_reason?: string;
  structure_reason_for_user?: string;
  hook?: string;
  core_conflict?: string;
  twist?: string;
  resolution?: string;
  segment_plan?: SegmentPlanItemDto[];
  scene_goals?: Record<string, string>;
  product_selling_point_mapping?: Record<string, string>;
  target_user_expression?: string;
  visual_requirements?: string[];
  dialogue_tone?: string;
  must_show_elements?: string[];
  must_avoid_elements?: string[];
  language_policy?: {
    workflow_language?: string;
    video_language?: string;
    target_market?: string;
  };
  marketing_strategy?: Record<string, unknown>;
  story_structure?: {
    title?: string;
    premise?: string;
    hook?: string;
    conflict?: string;
    twist?: string;
    resolution?: string;
    emotional_arc?: string[];
  };
  story_framework?: {
    type?: string;
    name?: string;
    structure?: string[];
    reason?: string;
  };
  asset_requirements?: {
    characters?: unknown[];
    scenes?: unknown[];
    products?: unknown[];
  };
  shot_plan?: {
    segments?: unknown[];
  };
  spoken_strategy?: Record<string, unknown>;
  creative_brief?: Record<string, unknown>;
  market_visual_constraints?: Record<string, unknown>;
  visual_style_constraints?: Record<string, unknown>;
  meta?: Record<string, unknown>;
};

export type GenerateStoryResponseDto = {
  record_id: number;
  project_id: number;
  version: number;
  blueprint: StoryBlueprintDto;
  approved?: boolean;
  created_at?: string | null;
};

export type PipelineStoryBlueprintWrapper = {
  id?: number;
  version?: number;
  approved?: boolean;
  blueprint?: StoryBlueprintDto;
  created_at?: string | null;
};

/** GET /pipeline 中 assets 行（与后端 read_models 一致） */
export type PipelineCharacterAssetDto = {
  id: number;
  name: string;
  role_type: string;
  description: string;
  visual_prompt: string;
  image_url: string | null;
  visual_anchor_image_id?: number | null;
  source_asset_version?: string;
  exposure_priority?: 'primary' | 'secondary' | 'background' | string;
  narrative_function?: string | null;
  purpose?: string | null;
  meta: Record<string, unknown>;
};

export type PipelineSceneAssetDto = {
  id: number;
  name: string;
  scene_type?: string | null;
  scene_form?: string | null;
  description: string;
  visual_prompt: string;
  image_url: string | null;
  visual_anchor_image_id?: number | null;
  source_asset_version?: string;
  exposure_priority?: 'primary' | 'secondary' | 'background' | string;
  narrative_function?: string | null;
  purpose?: string | null;
  meta: Record<string, unknown>;
};

export type PipelineProductAssetDto = {
  id: number;
  name: string;
  product_role?: string | null;
  description: string;
  visual_prompt: string;
  image_url: string | null;
  visual_anchor_image_id?: number | null;
  source_asset_version?: string;
  exposure_priority?: 'primary' | 'secondary' | 'background' | string;
  narrative_function?: string | null;
  purpose?: string | null;
  meta: Record<string, unknown>;
};

export type PipelineAssetsBundleDto = {
  characters: PipelineCharacterAssetDto[];
  scenes: PipelineSceneAssetDto[];
  products: PipelineProductAssetDto[];
};

/** GET /pipeline 中的 product_context 块（与 project.py 一致：raw_inputs + normalized） */
export type PipelineProductContextBlockDto = {
  id?: number;
  version?: number;
  parse_status?: string;
  raw_inputs?: Record<string, unknown> | null;
  image_understanding?: ProductImageUnderstandingDto | Record<string, unknown> | null;
  normalized?: ProductContextDto | Record<string, unknown> | null;
  created_at?: string | null;
};

/** GET /pipeline 中单条 segment_scripts（与 project.py seg_payload 一致） */
export type SegmentScriptPipelineRowDto = {
  id: number;
  segment_id: string;
  version?: number;
  script: Record<string, unknown>;
  video_url?: string | null;
  video_render?: Record<string, unknown> | null;
  created_at?: string | null;
  render_status?: string | null;
  render_job_id?: number | null;
  render_error?: string | null;
};

export type PipelineSummaryDto = {
  project: ShortDramaProjectDto;
  lightweight?: boolean;
  has_product_context?: boolean;
  has_story_blueprint?: boolean;
  asset_counts?: { characters: number; scenes: number; products: number };
  segment_scripts_count?: number;
  product_context?: PipelineProductContextBlockDto | null;
  creative_intent_input?: CreativeIntentInputDto | null;
  product_input?: ProductInputDto | null;
  product_understanding?: Record<string, unknown> | null;
  creative_brief?: CreativeBriefDto | null;
  story_blueprint?: PipelineStoryBlueprintWrapper | null;
  assets?: PipelineAssetsBundleDto | null;
  segment_scripts?: SegmentScriptPipelineRowDto[];
  final_video_url?: string | null;
  /** 后端推导：片段渲染中 / 待合成最终成片 / 最终合成中 / 完成 / 失败 */
  current_video_stage?: string | null;
  has_all_segment_videos?: boolean;
  has_final_video?: boolean;
  final_render_status?: string | null;
  final_render_error?: string | null;
  final_render_job_id?: number | null;
  has_active_render_job?: boolean;
  video_render_task_running?: boolean;
  segment_render_statuses?: SegmentScriptPipelineRowDto[];
  image_url_filled?: number;
  asset_rows_total?: number;
};

export type VideoBatchSummaryResponseDto = {
  project_id: number;
  segments_attempted: number;
  segments_succeeded: number;
  errors: Record<string, unknown>[];
};

export type SingleSegmentVideoResponseDto = {
  project_id: number;
  segment_id: string;
  ok: boolean;
  status: string;
  progress: number;
  video_url?: string | null;
  render_job_id?: number | null;
  error?: string | null;
};

export type RenderJobStatusResponseDto = {
  job_id: number;
  project_id: number;
  segment_id: string;
  status: string;
  progress: number;
  video_url?: string | null;
  error?: string | null;
  request_id?: string | null;
};

export type MergeVideoResponseDto = {
  project_id: number;
  final_video_url: string;
};

/** POST /segment/generate */
export type GenerateSegmentScriptsResponseDto = {
  project_id: number;
  segments: unknown[];
  record_ids: number[];
};

export type UpdateSegmentShotBody = {
  project_id: number;
  segment_title?: string;
  segment_goal?: string;
  duration_limit?: number;
  action_description?: string;
  dialogue?: string;
  spoken_text?: string;
  voiceover?: string;
  voiceover_text?: string;
  subtitle_text?: string;
  emotion?: string;
  video_prompt?: string;
  generation_prompt?: string;
  must_show?: string[];
  must_avoid?: string[];
  duration_seconds?: number;
  manual_character_refs?: string[];
  manual_scene_ref?: string;
  manual_product_refs?: string[];
  manual_video_prompt?: string;
  shot_role?: string;
  viewer_takeaway?: string;
  visual_direction?: string;
  character_direction?: string;
  product_presence?: string;
  product_purpose?: string;
  scene_direction?: string;
  camera_direction?: string;
  dialogue_text?: string;
  subtitle_text_presentation?: string;
  audio_intent?: string;
  character_refs?: string[];
  character_asset_ids?: string[];
  scene_refs?: string[];
  scene_asset_id?: string;
  product_refs?: string[];
  product_asset_id?: string;
  duration_sec?: number;
};

export type UpdateSegmentShotResponseDto = {
  project_id: number;
  segment_id: string;
  shot_id: string;
  segment: Record<string, unknown>;
  shot: Record<string, unknown>;
  needs_regeneration: boolean;
};

export type GenerateAssetSpecsResponseDto = {
  project_id: number;
  assets: PipelineAssetsBundleDto;
  image_generation?: AssetImageBatchResponseDto | null;
};

/** POST /assets/images/generate */
export type AssetImageBatchResponseDto = {
  project_id: number;
  characters_attempted: number;
  characters_succeeded: number;
  scenes_attempted: number;
  scenes_succeeded: number;
  products_attempted: number;
  products_succeeded: number;
  errors: Record<string, unknown>[];
};

export type UpdateAssetBody = {
  project_id: number;
  name?: string;
  role_type?: string;
  scene_type?: string;
  description?: string;
  visual_prompt?: string;
  voice_style?: string;
  reference_image_data_url?: string;
  reference_image_name?: string;
  product_usage?: string;
  /** 产品资产类型标签，写入 meta.product_type */
  product_type?: string;
};

export type UpdateAssetResponseDto = {
  project_id: number;
  asset_type: string;
  asset_id: number;
  stale_marked_step_4: boolean;
};

export type RegenerateOneAssetImageBody = {
  project_id: number;
  asset_type: 'character' | 'scene' | 'product';
  asset_id: number;
};

export type RegenerateOneAssetImageResponseDto = {
  project_id: number;
  asset_type: string;
  asset_id: number;
  image_url?: string | null;
  stale_marked_step_4: boolean;
};

export type AssetImageDto = {
  id: number;
  image_url: string;
  image_type: 'generated' | 'uploaded' | 'derived' | string;
  variant_label?: string | null;
  variant_meta: Record<string, unknown>;
  prompt_snapshot?: string | null;
  provider?: string | null;
  provider_params: Record<string, unknown>;
  is_cover: boolean;
  status: string;
  created_at?: string | null;
};

export type AssetReferenceImageDto = {
  id: number;
  file_url: string;
  file_name?: string | null;
  sort_order: number;
  is_primary: boolean;
  status: string;
  created_at?: string | null;
};

export type AssetLibraryItemDto = {
  id: number;
  project_id: number;
  asset_type: 'character' | 'scene' | 'product' | string;
  name: string;
  description?: string | null;
  tags: string[];
  base_prompt?: string | null;
  source: string;
  cover_image_id?: number | null;
  cover_image?: AssetImageDto | null;
  image_count: number;
  has_reference_images: boolean;
  sort_order: number;
  status: string;
  extra: Record<string, unknown>;
  images: AssetImageDto[];
  reference_images: AssetReferenceImageDto[];
  created_at?: string | null;
  updated_at?: string | null;
};

export type AssetLibraryListResponseDto = {
  project_id: number;
  asset_type: string;
  assets: AssetLibraryItemDto[];
};

export type CreateAssetLibraryBody = {
  project_id: number;
  asset_type: 'character' | 'scene' | 'product';
  name: string;
  description?: string;
  tags?: string[];
  base_prompt?: string;
  source?: 'system_generated' | 'user_created' | 'mixed';
  type_fields?: Record<string, unknown>;
  reference_images?: { file_url: string; file_name?: string }[];
  uploaded_images?: { file_url: string; file_name?: string }[];
  generate_count?: number;
  variant_directions?: string[];
};

export type AnalyzeAssetReferenceImageBody = {
  project_id: number;
  image: string;
};

export type AnalyzeAssetReferenceImageResponseDto = {
  asset: AssetLibraryItemDto;
  warning?: string | null;
};

export type CreateAssetFromImageBody = {
  project_id: number;
  asset_type: 'character' | 'scene' | 'product';
  image: string;
  optional_name?: string;
};
