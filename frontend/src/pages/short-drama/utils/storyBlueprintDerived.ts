import type {
  PipelineSummaryDto,
  SegmentPlanItemDto,
  StoryBlueprintDto,
} from '@/types/shortDramaApi';
import { resolveBlueprintStructureTypeDisplay } from './shortDramaAdapters';
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

function countLabel(count: number, unit = '条'): string {
  return count > 0 ? `${count} ${unit}` : '未生成';
}

function generatedLabel(present: boolean): string {
  return present ? '已生成' : '未生成';
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
export type StoryBlueprintInputSourceRow = {
  label: string;
  icon: string;
  status: string;
  statusTone: 'ready' | 'pending' | 'none';
};

export function buildStoryBlueprintLeftRailsFromPipeline(
  pipeline: PipelineSummaryDto | null | undefined,
): {
  settings: StoryBlueprintSettingRow[];
  metaRows: StoryBlueprintSettingRow[];
  globalFields: StoryBlueprintGlobalField[];
  inputSources: StoryBlueprintInputSourceRow[];
} {
  const creativeIntentInput = pipeline?.creative_intent_input ?? pipeline?.project?.creative_intent_input ?? null;
  const creativeBrief = pipeline?.creative_brief ?? pipeline?.project?.creative_brief_structured ?? null;
  const project = pipeline?.project;
  const platforms = Array.isArray(creativeIntentInput?.platform_hints)
    ? creativeIntentInput.platform_hints.map(String).filter(Boolean).join('、')
    : '';
  const settings: StoryBlueprintSettingRow[] = [
    { label: '参考平台', value: platforms || '—' },
    { label: '大概时长', value: creativeIntentInput?.duration_hint?.trim() || '—' },
    { label: '画面比例', value: creativeIntentInput?.aspect_ratio_hint?.trim() || '—' },
  ];
  const intentExtra = asRecord(creativeIntentInput);
  const styleParts = [
    project?.visual_style?.trim(),
    String(intentExtra?.content_form || '').trim(),
    String(intentExtra?.narrative_style || '').trim(),
  ].filter(Boolean);
  const metaRows: StoryBlueprintSettingRow[] = [
    { label: '风格', value: styleParts.join(' · ') || '—' },
    { label: '市场', value: project?.target_market?.trim() || '—' },
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

  const hasCreativeBrief = Boolean(creativeBrief && Object.keys(creativeBrief).length);
  const hasProductContext = Boolean(pipeline?.product_context && Object.keys(pipeline.product_context).length);
  const inputSources: StoryBlueprintInputSourceRow[] = [
    {
      label: 'S0 创作意图',
      icon: 'ri-lightbulb-line',
      status: hasCreativeBrief ? '已确认' : '待完成',
      statusTone: hasCreativeBrief ? 'ready' : 'pending',
    },
    {
      label: 'S1 商品理解',
      icon: 'ri-box-3-line',
      status: hasProductContext ? '已分析' : '待完成',
      statusTone: hasProductContext ? 'ready' : 'pending',
    },
  ];

  return { settings, metaRows, globalFields, inputSources };
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
  const storyBeats = blueprint.story_outline?.story_beats ?? [];
  const structureTypeLabel = resolveBlueprintStructureTypeDisplay(blueprint);
  const videoSpecs = blueprint.video_generation_specs ?? [];
  const assetSpecs = blueprint.asset_generation_specs ?? [];
  const dialogueItems = blueprint.dialogue_or_voiceover ?? [];
  const storyLayerComplete = Boolean(
    structureTypeLabel &&
      (stringValue(blueprint.story_outline?.title) ||
        stringValue(blueprint.story_outline?.summary) ||
        stringValue(blueprint.title)) &&
      (storyBeats.length > 0 || plan.length > 0),
  );
  const segmentLayerComplete = plan.length > 0;
  const productionLayerComplete =
    assetSpecs.length > 0 && videoSpecs.length > 0 && Boolean(blueprint.subtitle_strategy) && dialogueItems.length > 0;

  const sections: StoryBlueprintAnalysisSection[] = [
    {
      key: 'creative_structure',
      title: '创作结构',
      icon: 'ri-node-tree',
      color: '#047857',
      fields: [
        { label: '剧本结构', value: structureTypeLabel },
        { label: '故事节拍', value: storyBeats.length ? `${storyBeats.length} 个` : '未生成' },
        { label: '剧情段落', value: plan.length ? `${plan.length} 段` : '未生成' },
        { label: '视频段规格', value: countLabel(videoSpecs.length, '个') },
      ].filter((field) => field.value),
    },
    {
      key: 'asset_readiness',
      title: '资产准备',
      icon: 'ri-image-2-line',
      color: '#334155',
      fields: [
        { label: '角色规格', value: countLabel(countByAssetKind(assetSpecs, 'character')) },
        { label: '场景规格', value: countLabel(countByAssetKind(assetSpecs, 'scene')) },
        { label: '产品规格', value: countLabel(countByAssetKind(assetSpecs, 'product')) },
        { label: '资产规格合计', value: countLabel(assetSpecs.length) },
      ],
    },
    {
      key: 'video_readiness',
      title: '视频准备',
      icon: 'ri-movie-2-line',
      color: '#B45309',
      fields: [
        { label: '视频段规格', value: countLabel(videoSpecs.length) },
        { label: '字幕策略', value: generatedLabel(Boolean(blueprint.subtitle_strategy)) },
        { label: '旁白/对白', value: countLabel(dialogueItems.length) },
      ],
    },
    {
      key: 'blueprint_completeness',
      title: '蓝图完整性',
      icon: 'ri-shield-check-line',
      color: '#6366f1',
      fields: [
        { label: '故事层', value: storyLayerComplete ? '完整' : '待补全' },
        { label: '分段层', value: segmentLayerComplete ? '完整' : '待补全' },
        { label: '生产层', value: productionLayerComplete ? '完整' : '待补全' },
      ],
    },
  ].filter((section) => section.fields.length);

  return { sections };
}

export type StoryBlueprintLayerCompleteness = {
  story: boolean;
  segment: boolean;
  production: boolean;
  readyCount: number;
};

/** 右侧整体评估（由 blueprint 真实字段推导，非写死）。 */
export function deriveStoryBlueprintOverallEval(
  pipeline: PipelineSummaryDto | null | undefined,
): { ready: boolean; message: string; layers: StoryBlueprintLayerCompleteness } {
  const blueprint = pipeline?.story_blueprint?.blueprint;
  if (!blueprint || !Object.keys(blueprint).length) {
    return {
      ready: false,
      message: '剧本尚未生成，请先生成剧本大纲。',
      layers: { story: false, segment: false, production: false, readyCount: 0 },
    };
  }
  const structureType = resolveBlueprintStructureTypeDisplay(blueprint);
  const storyBeats = blueprint.story_outline?.story_beats ?? [];
  const segments = blueprint.segment_plan?.length ?? 0;
  const assetSpecs = blueprint.asset_generation_specs?.length ?? 0;
  const videoSpecs = blueprint.video_generation_specs?.length ?? 0;
  const dialogueItems = blueprint.dialogue_or_voiceover?.length ?? 0;
  const storyLayer = Boolean(
    structureType &&
      (stringValue(blueprint.story_outline?.title) ||
        stringValue(blueprint.story_outline?.summary) ||
        stringValue(blueprint.title)) &&
      (storyBeats.length > 0 || segments > 0),
  );
  const segmentLayer = segments > 0;
  const productionLayer =
    assetSpecs > 0 && videoSpecs > 0 && Boolean(blueprint.subtitle_strategy) && dialogueItems > 0;
  const readyCount = [storyLayer, segmentLayer, productionLayer].filter(Boolean).length;
  const ready = readyCount === 3;
  return {
    ready,
    message: ready
      ? '短剧生产蓝图三层结构已就绪，可进入资产管理。'
      : '蓝图部分层级尚未完整，建议确认缺失项后继续。',
    layers: { story: storyLayer, segment: segmentLayer, production: productionLayer, readyCount },
  };
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
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
