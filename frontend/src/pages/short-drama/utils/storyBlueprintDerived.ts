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
import {
  marketingGoalZhLabel,
  dialogueModeZhLabel,
  formatZhLabel,
  languageZhLabel,
  storyStyleZhLabel,
  targetMarketZhLabel,
  visualStyleZhLabel,
} from './projectLocales';

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

function extractMarket(
  normalized: Record<string, unknown> | null,
  pipeline: PipelineSummaryDto | null | undefined,
): string {
  const projectMarket = pipeline?.project?.target_market;
  if (typeof projectMarket === 'string' && projectMarket.trim()) return targetMarketZhLabel(projectMarket);
  if (normalized) {
    const tm = normalized['target_market'] ?? normalized['targetMarkets'];
    if (typeof tm === 'string' && tm.trim()) return targetMarketZhLabel(tm.trim());
    if (Array.isArray(tm) && tm.length) return tm.map(String).join('、');
    const tu = normalized['target_users'];
    if (typeof tu === 'string' && tu.trim()) return tu.trim();
  }
  const raw = asRecord(pipeline?.product_context)?.['raw_inputs'] as Record<string, unknown> | undefined;
  const aud = raw?.['audience'];
  if (typeof aud === 'string' && aud.trim()) return aud.trim();
  const extra = asRecord(raw?.['extra']);
  const mk = extra?.['target_markets'] ?? extra?.['targetMarkets'];
  if (Array.isArray(mk) && mk.length) return mk.map(String).join('、');
  const meta = getPipelineStoryMeta(pipeline);
  const mm = meta?.['target_market'] ?? meta?.['market'];
  if (typeof mm === 'string' && mm.trim()) return mm.trim();
  return '北美';
}

function segmentPlanFromBlueprint(blueprint: StoryBlueprintDto | null | undefined): SegmentPlanItemDto[] {
  return blueprint?.segment_plan ?? [];
}

function readableValue(value: unknown, fallback = '—'): string {
  if (Array.isArray(value)) return value.map(String).filter(Boolean).join(' → ') || fallback;
  if (typeof value === 'string' && value.trim()) return value.trim();
  return fallback;
}

/**
 * 左侧：项目设置 + 全局设定（真实 pipeline + 可推导字段）
 */
export function buildStoryBlueprintLeftRailsFromPipeline(
  pipeline: PipelineSummaryDto | null | undefined,
): { settings: StoryBlueprintSettingRow[]; globalFields: StoryBlueprintGlobalField[] } {
  const p = pipeline?.project;
  const normalized = getPipelineProductNormalized(pipeline);
  const blueprint = pipeline?.story_blueprint?.blueprint ?? undefined;
  const settings: StoryBlueprintSettingRow[] = [
    { label: '时长', value: p?.duration?.trim() || '—' },
    { label: '形式', value: formatZhLabel(p?.format ?? null) },
    { label: '叙事风格', value: storyStyleZhLabel(p?.style ?? null) },
    { label: '视觉', value: visualStyleZhLabel(p?.visual_style ?? null) },
    { label: '比例', value: p?.aspect_ratio?.trim() || '—' },
    { label: '市场', value: extractMarket(normalized, pipeline) },
    { label: '视频语言', value: languageZhLabel(p?.video_language ?? blueprint?.language_policy?.video_language ?? 'en-US') },
    { label: '工作语言', value: languageZhLabel(p?.workflow_language ?? blueprint?.language_policy?.workflow_language ?? 'zh-CN') },
  ];

  return { settings, globalFields: [] };
}

/**
 * 右侧：结构分析 + 评估文案（由当前 blueprint 派生）
 */
export function deriveStoryStructureAnalysis(
  pipeline: PipelineSummaryDto | null | undefined,
): { sections: StoryBlueprintAnalysisSection[] } {
  const blueprint = pipeline?.story_blueprint?.blueprint;
  const project = pipeline?.project;
  if (!blueprint || Object.keys(blueprint).length === 0) {
    return {
      sections: [
        {
          key: 'marketing_strategy',
          title: '营销策略',
          icon: 'ri-megaphone-line',
          color: '#047857',
          fields: [
            { label: '目标受众', value: '—' },
            { label: '核心痛点', value: '—' },
            { label: '情绪触发', value: '—' },
            { label: '产品承诺', value: '—' },
            { label: '转化目标', value: '—' },
            { label: '行动号召', value: '—' },
          ],
        },
        {
          key: 'creative_strategy',
          title: '制作摘要',
          icon: 'ri-file-list-3-line',
          color: '#334155',
          fields: [
            { label: '资产需求', value: '—' },
            { label: '分镜段落', value: '—' },
            { label: '目标市场', value: '—' },
            { label: '视频语言', value: '—' },
            { label: '口播方式', value: '—' },
            { label: '画面比例', value: '—' },
          ],
        },
      ],
    };
  }

  const plan = segmentPlanFromBlueprint(blueprint);
  const spoken = blueprint.spoken_strategy ?? {};
  const assets = blueprint.asset_requirements ?? {};
  const assetNeeds = `${Array.isArray(assets.characters) ? assets.characters.length : 0} 角色 / ${Array.isArray(assets.scenes) ? assets.scenes.length : 0} 场景 / ${Array.isArray(assets.products) ? assets.products.length : 0} 产品`;
  const sections: StoryBlueprintAnalysisSection[] = [
    {
      key: 'marketing_strategy',
      title: '营销策略',
      icon: 'ri-megaphone-line',
      color: '#047857',
      fields: [
        { label: '目标受众', value: readableValue(blueprint.target_audience) },
        { label: '核心痛点', value: readableValue(blueprint.core_pain) },
        { label: '情绪触发', value: readableValue(blueprint.emotional_trigger) },
        { label: '产品承诺', value: readableValue(blueprint.product_promise) },
        {
          label: '转化目标',
          value: readableValue(
            blueprint.conversion_goal,
            marketingGoalZhLabel(project?.marketing_goal),
          ),
        },
      ],
    },
    {
      key: 'creative_strategy',
      title: '制作摘要',
      icon: 'ri-file-list-3-line',
      color: '#334155',
      fields: [
        { label: '资产需求', value: assetNeeds },
        { label: '分镜段落', value: String(plan.length) },
        { label: '目标市场', value: targetMarketZhLabel(project?.target_market || blueprint.language_policy?.target_market) },
        { label: '视频语言', value: languageZhLabel(project?.video_language || blueprint.language_policy?.video_language) },
        { label: '口播方式', value: dialogueModeZhLabel(spoken.default_dialogue_mode || 'spoken') },
        { label: '画面比例', value: readableValue(project?.aspect_ratio) },
      ],
    },
  ];

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
