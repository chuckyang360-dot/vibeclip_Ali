import type { TargetMarketOption } from '@/types/shortDrama';

export const TARGET_MARKET_OPTIONS: Array<{ value: TargetMarketOption; zhLabel: string }> = [
  { value: 'North America', zhLabel: '北美' },
  { value: 'Europe', zhLabel: '欧洲' },
  { value: 'Japan', zhLabel: '日本' },
  { value: 'Korea', zhLabel: '韩国' },
  { value: 'Thailand', zhLabel: '泰国' },
  { value: 'Southeast Asia', zhLabel: '东南亚' },
  { value: 'China', zhLabel: '中国' },
  { value: 'Global', zhLabel: '全球' },
  { value: 'Custom', zhLabel: '自定义' },
];

const TARGET_MARKET_MAP = new Map(TARGET_MARKET_OPTIONS.map((x) => [x.value, x.zhLabel]));
const LANGUAGE_ZH_LABEL: Record<string, string> = {
  'zh-CN': '中文',
  'en-US': '英文',
  'ja-JP': '日文',
  'ko-KR': '韩文',
  'th-TH': '泰文',
};
const FORMAT_ZH_LABEL: Record<string, string> = {
  single_ad: '单条广告',
  series: '系列短剧',
};
const STORY_STYLE_ZH_LABEL: Record<string, string> = {
  light_conflict: '轻冲突',
  conflict: '轻冲突',
  healing: '治愈陪伴',
  comedy: '轻喜剧',
  suspense: '悬疑反转',
  emotional: '情绪共鸣',
};
const VISUAL_STYLE_ZH_LABEL: Record<string, string> = {
  cinematic: '写实电影感',
  anime: '动画风格',
  animation: '动画风格',
  '3d_render': '3D 渲染',
  '3d': '3D 渲染',
  premium_ad: '高级广告感',
};
export const MARKETING_GOAL_OPTIONS: Array<{ value: string; zhLabel: string }> = [
  { value: 'brand_seeding', zhLabel: '品牌种草' },
  { value: 'pain_point_conversion', zhLabel: '痛点转化' },
  { value: 'product_demo', zhLabel: '产品展示' },
  { value: 'trust_building', zhLabel: '信任背书' },
  { value: 'comparison', zhLabel: '对比测评' },
  { value: 'promotion', zhLabel: '活动促销' },
  { value: 'corporate_promo', zhLabel: '企业宣传' },
  { value: 'series_story', zhLabel: '系列短剧' },
];
export const BRAND_TONE_OPTIONS: Array<{ value: string; zhLabel: string }> = [
  { value: 'natural', zhLabel: '自然真实' },
  { value: 'premium', zhLabel: '高级专业' },
  { value: 'funny', zhLabel: '轻松幽默' },
  { value: 'emotional', zhLabel: '情绪共鸣' },
  { value: 'bold', zhLabel: '强冲突' },
  { value: 'warm', zhLabel: '温暖治愈' },
];
export const DIALOGUE_MODE_OPTIONS: Array<{ value: string; zhLabel: string }> = [
  { value: 'spoken', zhLabel: '角色口播' },
  { value: 'subtitle', zhLabel: '屏幕字幕' },
  { value: 'voiceover', zhLabel: '旁白' },
  { value: 'none', zhLabel: '无台词' },
];
export const STORY_FRAMEWORK_OPTIONS: Array<{ value: string; zhLabel: string }> = [
  { value: 'pain_point_conversion', zhLabel: '痛点转化型' },
  { value: 'brand_seeding', zhLabel: '品牌种草型' },
  { value: 'product_demo', zhLabel: '产品展示型' },
  { value: 'trust_building', zhLabel: '信任背书型' },
  { value: 'comparison', zhLabel: '对比测评型' },
  { value: 'promotion', zhLabel: '活动促销型' },
  { value: 'corporate_promo', zhLabel: '企业宣传型' },
  { value: 'series_story', zhLabel: '系列短剧型' },
];
const MARKETING_GOAL_MAP = new Map(MARKETING_GOAL_OPTIONS.map((x) => [x.value, x.zhLabel]));
const BRAND_TONE_MAP = new Map(BRAND_TONE_OPTIONS.map((x) => [x.value, x.zhLabel]));
const DIALOGUE_MODE_MAP = new Map(DIALOGUE_MODE_OPTIONS.map((x) => [x.value, x.zhLabel]));
const STORY_FRAMEWORK_MAP = new Map(STORY_FRAMEWORK_OPTIONS.map((x) => [x.value, x.zhLabel]));

export function normalizeTargetMarket(value: unknown): TargetMarketOption {
  const text = String(value || '').trim();
  if (!text) return 'North America';
  const low = text.toLowerCase();
  if (low.includes('north america') || text.includes('北美')) return 'North America';
  if (low.includes('europe') || text.includes('欧洲')) return 'Europe';
  if (low.includes('japan') || text.includes('日本')) return 'Japan';
  if (low.includes('korea') || text.includes('韩国')) return 'Korea';
  if (low.includes('thailand') || low.includes('thai') || text.includes('泰国')) return 'Thailand';
  if (low.includes('southeast asia') || text.includes('东南亚')) return 'Southeast Asia';
  if (low.includes('china') || text.includes('中国') || text.includes('中国大陆')) return 'China';
  if (low.includes('global') || text.includes('全球')) return 'Global';
  if (low.includes('custom') || text.includes('自定义')) return 'Custom';
  return 'North America';
}

export function targetMarketZhLabel(value: unknown): string {
  return TARGET_MARKET_MAP.get(normalizeTargetMarket(value)) || '北美';
}

export function languageZhLabel(value: unknown): string {
  const key = String(value || '').trim();
  if (!key) return '—';
  return LANGUAGE_ZH_LABEL[key] || key;
}

export function formatZhLabel(value: unknown): string {
  const key = String(value || '').trim();
  if (!key) return '—';
  return FORMAT_ZH_LABEL[key] || key;
}

export function storyStyleZhLabel(value: unknown): string {
  if (Array.isArray(value)) {
    const first = value.length ? value[0] : '';
    return storyStyleZhLabel(first);
  }
  const key = String(value || '').trim();
  if (!key) return '—';
  const normalized = key === 'conflict' ? 'light_conflict' : key.split(',')[0]?.trim() || key;
  return STORY_STYLE_ZH_LABEL[normalized] || normalized;
}

export function visualStyleZhLabel(value: unknown): string {
  const key = String(value || '').trim();
  if (!key) return '—';
  return VISUAL_STYLE_ZH_LABEL[key] || key;
}

export function marketingGoalZhLabel(value: unknown): string {
  const key = String(value || '').trim();
  if (!key) return '—';
  return MARKETING_GOAL_MAP.get(key) || key;
}

export function brandToneZhLabel(value: unknown): string {
  const key = String(value || '').trim();
  if (!key) return '—';
  return BRAND_TONE_MAP.get(key) || key;
}

export function dialogueModeZhLabel(value: unknown): string {
  const key = String(value || '').trim();
  if (!key) return '—';
  return DIALOGUE_MODE_MAP.get(key) || key;
}

export function storyFrameworkZhLabel(value: unknown): string {
  const key = String(value || '').trim();
  if (!key) return '—';
  return STORY_FRAMEWORK_MAP.get(key) || key;
}
