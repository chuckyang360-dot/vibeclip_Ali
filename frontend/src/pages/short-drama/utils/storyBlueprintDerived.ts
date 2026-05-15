import type {
  PipelineSummaryDto,
  SegmentPlanItemDto,
  StoryBlueprintDto,
} from '@/types/shortDramaApi';
import type {
  StoryBlueprintAnalysisSection,
  StoryBlueprintGlobalField,
  StoryBlueprintSettingRow,
} from '@/types/shortDrama';

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/** pipeline.product_context.normalized */
export function getPipelineProductNormalized(
  pipeline: PipelineSummaryDto | null | undefined,
): Record<string, unknown> | null {
  const pc = pipeline?.product_context;
  const root = asRecord(pc);
  if (!root) return null;
  return asRecord(root['normalized']);
}

export function getPipelineStoryMeta(
  pipeline: PipelineSummaryDto | null | undefined,
): Record<string, unknown> | null {
  const bp = pipeline?.story_blueprint?.blueprint;
  const meta = asRecord(bp)?.['meta'];
  return asRecord(meta);
}

function segmentPlanFromBlueprint(blueprint: StoryBlueprintDto | null | undefined): SegmentPlanItemDto[] {
  return blueprint?.segment_plan ?? [];
}

function countByAssetKind(rows: unknown[] | undefined, kind: string): number {
  return (rows ?? []).filter((row) => asRecord(row)?.asset_kind === kind).length;
}

function yesNo(value: boolean): string {
  return value ? '已准备' : '未返回';
}

function readableBriefValue(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) return value.map(readableBriefValue).filter(Boolean).join('、');
  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).map(readableBriefValue).filter(Boolean).join('；');
  }
  return '';
}

/**
 * 左侧：S0 创作提示 + 可选 AI 创作理解摘要。
 */
export function buildStoryBlueprintLeftRailsFromPipeline(
  pipeline: PipelineSummaryDto | null | undefined,
): { settings: StoryBlueprintSettingRow[]; globalFields: StoryBlueprintGlobalField[] } {
  const creativeIntentInput = pipeline?.creative_intent_input ?? pipeline?.project?.creative_intent_input ?? null;
  const creativeBrief = pipeline?.creative_brief ?? pipeline?.project?.creative_brief_structured ?? null;
  const platforms = Array.isArray(creativeIntentInput?.platform_hints)
    ? creativeIntentInput.platform_hints.map(String).filter(Boolean).join('、')
    : '';
  const settings: StoryBlueprintSettingRow[] = [
    { label: '参考平台', value: platforms || '—' },
    { label: '大概时长', value: creativeIntentInput?.duration_hint?.trim() || '—' },
    { label: '画面比例', value: creativeIntentInput?.aspect_ratio_hint?.trim() || '—' },
  ];
  const briefProduct = asRecord(creativeBrief?.product_understanding);
  const briefIntent = asRecord(creativeBrief?.creative_intent);
  const briefInterpretation = asRecord(creativeBrief?.ai_interpretation);
  const briefAvoid = readableBriefValue(briefIntent?.avoid) || readableBriefValue(briefProduct?.avoid_notes);
  const globalFields: StoryBlueprintGlobalField[] = [
    { label: '创作目标', value: readableBriefValue(creativeBrief?.user_goal) },
    { label: '表达方向', value: readableBriefValue(briefInterpretation?.core_direction) },
    { label: '视觉方向', value: readableBriefValue(briefInterpretation?.visual_direction) },
    { label: '需要避免', value: briefAvoid },
  ].filter((item) => item.value);

  return { settings, globalFields };
}

/**
 * 右侧：结构分析 + 评估文案（由当前 blueprint 派生）
 */
export function deriveStoryStructureAnalysis(
  pipeline: PipelineSummaryDto | null | undefined,
): { sections: StoryBlueprintAnalysisSection[] } {
  const blueprint = pipeline?.story_blueprint?.blueprint;
  if (!blueprint || Object.keys(blueprint).length === 0) {
    return { sections: [] };
  }

  const plan = segmentPlanFromBlueprint(blueprint);
  const storyOutline = blueprint.story_outline;
  const storyBeats = storyOutline?.story_beats ?? [];
  const videoSpecs = blueprint.video_generation_specs ?? [];
  const assetSpecs = blueprint.asset_generation_specs ?? [];
  const dialogueItems = blueprint.dialogue_or_voiceover ?? [];
  const sections: StoryBlueprintAnalysisSection[] = [
    {
      key: 'creative_structure',
      title: '创作结构',
      icon: 'ri-node-tree',
      color: '#047857',
      fields: [
        { label: '结构类型', value: storyOutline?.structure_type?.trim() || '' },
        { label: '故事节奏', value: storyBeats.length ? `${storyBeats.length} 个` : '' },
        { label: '分镜段落', value: plan.length ? `${plan.length} 段` : '' },
        { label: '视频片段', value: videoSpecs.length ? `${videoSpecs.length} 个` : '' },
      ].filter((field) => field.value),
    },
    {
      key: 'asset_readiness',
      title: '资产需求',
      icon: 'ri-image-2-line',
      color: '#334155',
      fields: [
        { label: '角色', value: `${countByAssetKind(assetSpecs, 'character')} 个` },
        { label: '场景', value: `${countByAssetKind(assetSpecs, 'scene')} 个` },
        { label: '产品', value: `${countByAssetKind(assetSpecs, 'product')} 个` },
      ].filter((field) => field.value !== '0 个'),
    },
    {
      key: 'video_readiness',
      title: '视频生成准备',
      icon: 'ri-movie-2-line',
      color: '#B45309',
      fields: [
        { label: '视频规格', value: yesNo(videoSpecs.length > 0) },
        { label: '字幕策略', value: yesNo(Boolean(blueprint.subtitle_strategy)) },
        { label: '旁白/对白', value: yesNo(dialogueItems.length > 0) },
      ],
    },
  ].filter((section) => section.fields.length);

  return { sections };
}

/**
 * 已进入故事生成及之后阶段：禁止再请求 story/generate（与后端编排一致）；
 * 不影响 pipeline 读取与页面展示。
 */
export const STORY_PIPELINE_LOCKED_STATUSES = new Set<string>([
  'story_generated',
  'asset_specs_generated',
  'assets_rendering',
  'assets_ready',
  'segments_generated',
  'video_rendering',
  'completed',
  'failed',
]);

export function isStoryPipelineLockedForRegenerate(pipeline: PipelineSummaryDto | null | undefined): boolean {
  const st = pipeline?.project?.status;
  if (!st) return false;
  return STORY_PIPELINE_LOCKED_STATUSES.has(st);
}

export const STORY_REGENERATE_LOCKED_TITLE =
  '当前版本已生成，如需重新生成需新建项目或联系管理员重置流程';
