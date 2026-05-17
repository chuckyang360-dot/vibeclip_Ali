import type { ProductInputDraft, ProductPreviewSummary } from '@/types/shortDrama';
import type {
  ProductContextDto,
  ProductInputPayload,
  SegmentPlanItemDto,
  StoryBlueprintDto,
} from '@/types/shortDramaApi';
import { marketingGoalZhLabel } from './projectLocales';

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/** 将 pipeline / DB 中的 raw_inputs 还原为表单草稿（与 mapDraftToProductInputPayload 互逆，尽力而为）。 */
export function pipelineRawInputsToDraft(raw: unknown): ProductInputDraft | null {
  const o = asRecord(raw);
  if (!o) return null;
  const productImages = Array.isArray(o.product_images)
    ? o.product_images
        .map((row, idx) => {
          const r = asRecord(row);
          if (!r || typeof r.image_url !== 'string' || !r.image_url.trim()) return null;
          return {
            imageUrl: r.image_url.trim(),
            imageOrder: typeof r.image_order === 'number' ? r.image_order : idx,
            isMainImage: Boolean(r.is_main_image),
            imageCaptionRaw: typeof r.image_caption_raw === 'string' ? r.image_caption_raw : '',
          };
        })
        .filter((x): x is ProductInputDraft['productImages'][number] => Boolean(x))
    : [];
  const hasAnything =
    (typeof o.product_name_raw === 'string' && o.product_name_raw.trim()) ||
    (typeof o.product_category_raw === 'string' && o.product_category_raw.trim()) ||
    (typeof o.brand_raw === 'string' && o.brand_raw.trim()) ||
    (typeof o.price_raw === 'string' && o.price_raw.trim()) ||
    (typeof o.target_users_raw === 'string' && o.target_users_raw.trim()) ||
    (Array.isArray(o.selling_points_raw) && o.selling_points_raw.length > 0) ||
    (Array.isArray(o.usage_scenarios_raw) && o.usage_scenarios_raw.length > 0) ||
    (typeof o.extra_notes_raw === 'string' && o.extra_notes_raw.trim()) ||
    productImages.length > 0;

  if (!hasAnything) return null;

  return {
    productNameRaw: typeof o.product_name_raw === 'string' ? o.product_name_raw : '',
    productCategoryRaw: typeof o.product_category_raw === 'string' ? o.product_category_raw : '',
    brandRaw: typeof o.brand_raw === 'string' ? o.brand_raw : '',
    priceRaw: typeof o.price_raw === 'string' ? o.price_raw : '',
    targetUsersRaw: typeof o.target_users_raw === 'string' ? o.target_users_raw : '',
    sellingPointsRaw: Array.isArray(o.selling_points_raw) ? o.selling_points_raw.map((x) => String(x)) : [],
    usageScenariosRaw: Array.isArray(o.usage_scenarios_raw) ? o.usage_scenarios_raw.map((x) => String(x)) : [],
    extraNotesRaw: typeof o.extra_notes_raw === 'string' ? o.extra_notes_raw : '',
    productImages,
  };
}

/** Map create-project form → POST /project body fields (duration/format/style/visual/aspect already strings on backend). */
export function mapDraftToProductInputPayload(draft: ProductInputDraft): ProductInputPayload {
  return {
    product_name_raw: draft.productNameRaw.trim() || undefined,
    product_category_raw: draft.productCategoryRaw.trim() || undefined,
    brand_raw: draft.brandRaw.trim() || undefined,
    price_raw: draft.priceRaw.trim() || undefined,
    target_users_raw: draft.targetUsersRaw.trim() || undefined,
    selling_points_raw: draft.sellingPointsRaw.length ? draft.sellingPointsRaw : undefined,
    usage_scenarios_raw: draft.usageScenariosRaw.length ? draft.usageScenariosRaw : undefined,
    extra_notes_raw: draft.extraNotesRaw.trim() || undefined,
    product_images: draft.productImages.map((img, idx) => ({
      image_url: img.imageUrl,
      image_order: img.imageOrder ?? idx,
      is_main_image: Boolean(img.isMainImage),
      image_caption_raw: img.imageCaptionRaw || '',
    })),
  };
}

/**
 * ProductContext (normalized) → InfoPreviewPanel model.
 * Graceful degradation when arrays empty.
 */
export function productContextToPreview(ctx: ProductContextDto): ProductPreviewSummary {
  return {
    productName: ctx.product_name || '',
    productCategory: ctx.product_category || '',
    brandName: ctx.brand_name?.trim() || '',
    productSummary: ctx.product_summary || '',
    coreSellingPoints: ctx.core_selling_points ?? [],
    targetUsers: ctx.target_users ?? [],
    usageScenarios: ctx.usage_scenarios ?? [],
    visualFeatures: ctx.visual_features ?? [],
    productForm: ctx.product_form || '',
    keyFunctions: ctx.key_functions ?? [],
    emotionalValue: ctx.emotional_value ?? [],
    suitableStoryAngles: ctx.suitable_story_angles ?? [],
    userPainPoints: ctx.user_pain_points ?? [],
    visualRiskNotes: ctx.visual_risk_notes ?? [],
    consistencyNotes: ctx.consistency_notes ?? [],
    immutableStructureConstraints: ctx.immutable_structure_constraints ?? [],
    extractedFromImages: ctx.extracted_from_images ?? [],
    parseConfidence: typeof ctx.parse_confidence === 'number' ? ctx.parse_confidence : 0,
    sourceTrace: (ctx.source_trace ?? {}) as Record<string, string>,
    fieldMeta: (ctx.field_meta ?? {}) as Record<string, { edited_by_user?: boolean; edited_at?: string }>,
    status: 'ready',
  };
}

export function normalizedJsonToProductPreview(norm: unknown): ProductPreviewSummary | null {
  if (!norm || typeof norm !== 'object') return null;
  const o = norm as Record<string, unknown>;
  if (typeof o.product_name !== 'string' || !o.product_name.trim()) return null;
  return productContextToPreview(o as ProductContextDto);
}

export function previewToProductContextPayload(preview: ProductPreviewSummary): Record<string, unknown> {
  return {
    product_name: preview.productName,
    product_category: preview.productCategory,
    brand_name: preview.brandName.trim() || undefined,
    product_summary: preview.productSummary,
    core_selling_points: preview.coreSellingPoints,
    target_users: preview.targetUsers,
    usage_scenarios: preview.usageScenarios,
    visual_features: preview.visualFeatures,
    product_form: preview.productForm,
    key_functions: preview.keyFunctions,
    emotional_value: preview.emotionalValue,
    suitable_story_angles: preview.suitableStoryAngles,
    user_pain_points: preview.userPainPoints,
    visual_risk_notes: preview.visualRiskNotes,
    consistency_notes: preview.consistencyNotes,
    immutable_structure_constraints: preview.immutableStructureConstraints,
    extracted_from_images: preview.extractedFromImages,
    parse_confidence: preview.parseConfidence,
    source_trace: preview.sourceTrace,
    field_meta: preview.fieldMeta,
  };
}

const SEGMENT_COLORS = ['#B45309', '#DC2626', '#047857', '#334155', '#9333EA', '#0F766E'];
const STORY_ENUM_DISPLAY_MAP: Record<string, string> = {
  'Story Drama': '剧情短剧',
  'Light Conflict Transformation': '轻冲突转化',
  Hook: '开场钩子',
  Build: '情节推进',
  Reveal: '信息揭示',
  Payoff: '结果收束',
};

/** S2 剧本结构枚举 → 用户可读中文（仅展示，不改 DTO） */
const STRUCTURE_TYPE_ZH_MAP: Record<string, string> = {
  story_drama: '剧情短剧',
  short_drama: '短剧',
  mini_drama: '迷你短剧',
  product_demo: '产品演示',
  product_demo_ad: '产品演示广告',
  problem_solution_ad: '问题解决方案广告',
  ugc_review: 'UGC 种草测评',
  before_after_bridge: '前后对比桥接',
  pas: 'PAS 结构',
  aida: 'AIDA 结构',
  unboxing_review: '开箱测评',
  scene_pain_solution: '场景痛点解决',
  twist_reveal: '反转揭示',
  brand_seeding: '品牌种草',
  pain_point_conversion: '痛点转化',
  trust_building: '信任建立',
  corporate_promo: '企业宣传',
  comparison: '对比种草',
  promotion: '促销转化',
  series_story: '系列剧情',
  'story drama': '剧情短剧',
  'product demo ad': '产品演示广告',
};

const STRUCTURE_SLUG_RE = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$/;

function normalizeStructureTypeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '_');
}

function isStructureEngineeringSlug(value: string): boolean {
  const text = value.trim();
  if (!text) return false;
  if (STRUCTURE_SLUG_RE.test(text)) return true;
  return normalizeStructureTypeKey(text) in STRUCTURE_TYPE_ZH_MAP;
}

function humanizeUnknownStructureSlug(slug: string): string {
  return slug
    .trim()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => {
      if (/^[a-z]{2,4}$/i.test(part) && part.length <= 4) return part.toUpperCase();
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join(' ');
}

/** 将工程枚举 slug 转为可读展示文案；已是中文/自然语言则原样返回。 */
export function formatStoryStructureType(value: unknown): string {
  const text = String(value ?? '').trim();
  if (!text) return '';
  if (STORY_ENUM_DISPLAY_MAP[text]) return STORY_ENUM_DISPLAY_MAP[text];
  const key = normalizeStructureTypeKey(text);
  if (STRUCTURE_TYPE_ZH_MAP[key]) return STRUCTURE_TYPE_ZH_MAP[key];
  if (STRUCTURE_SLUG_RE.test(text) || key in STRUCTURE_TYPE_ZH_MAP) {
    return humanizeUnknownStructureSlug(text);
  }
  const sanitized = sanitizeDisplayLabel(text);
  if (sanitized && !isStructureEngineeringSlug(sanitized)) return sanitized;
  return sanitized || humanizeUnknownStructureSlug(text);
}

function pickHumanReadableStructureLabel(value: unknown): string {
  const text = String(value ?? '').trim();
  if (!text || isStructureEngineeringSlug(text)) return '';
  const sanitized = sanitizeDisplayLabel(text);
  if (!sanitized || isStructureEngineeringSlug(sanitized)) return '';
  return sanitized;
}

/** S2 主区 / 右侧统一的「剧本结构」展示值（人类可读优先）。 */
export function resolveBlueprintStructureTypeDisplay(dto: StoryBlueprintDto | undefined | null): string {
  const b = dto ?? {};
  const storyOutline = b.story_outline;
  const creativeStrategy =
    b.creative_brief && typeof b.creative_brief === 'object' && !Array.isArray(b.creative_brief)
      ? ((b.creative_brief as Record<string, unknown>).creative_strategy as Record<string, unknown> | undefined)
      : undefined;

  const humanReadable =
    pickHumanReadableStructureLabel(b.script_type_display) ||
    pickHumanReadableStructureLabel(creativeStrategy?.script_type_display) ||
    pickHumanReadableStructureLabel(b.story_framework?.name) ||
    '';

  if (humanReadable) return humanReadable;

  return (
    formatStoryStructureType(b.script_structure_type) ||
    formatStoryStructureType(storyOutline?.structure_type) ||
    sanitizeDisplayLabel(b.script_structure_type) ||
    sanitizeDisplayLabel(storyOutline?.structure_type) ||
    ''
  );
}

export type StoryBlueprintBeatSectionVm = {
  key: string;
  label: string;
  icon: string;
  purpose: string;
  content: string;
};

export type StoryBlueprintPageScriptVm = {
  title: string;
  summary: string;
  scriptStructureType: string;
  structureRhythm: string;
  structureReason: string;
  beatsSectionTitle: string;
  usesStoryBeats: boolean;
  sections: StoryBlueprintBeatSectionVm[];
};

export type StoryBlueprintPageSegmentVm = {
  id: number;
  segmentId: string;
  name: string;
  stageName: string;
  goal: string;
  duration: string;
  productPlacement: string;
  segmentRole: string;
  /** 真实画面/视觉描述（非 asset key 列表） */
  visualRequirement: string;
  emotionalState: string;
  keyMessage: string;
  expectedAssets: string[];
  /** required_visual_elements / required_assets 结构化依赖 */
  visualElementsSummary: string;
  /** 非泛化阶段标签（如「开场」），空则不在卡片头展示 */
  stageLabel: string;
  productFeature: string;
  targetUserTrigger: string;
  transitionToNext: string;
  synopsis: string;
  color: string;
};

export type StoryBlueprintKvFieldVm = { label: string; value: string };

export type StoryBlueprintAssetSpecVm = {
  assetKind: string;
  assetKindLabel: string;
  name: string;
  purpose: string;
  description: string;
  prompt: string;
  segmentRefs: string;
  extraFields: StoryBlueprintKvFieldVm[];
};

export type StoryBlueprintVideoSpecVm = {
  segmentId: string;
  segmentTitle: string;
  specKey: string;
  durationLabel: string;
  aspectRatio: string;
  videoPrompt: string;
  videoPromptSummary: string;
  extraFields: StoryBlueprintKvFieldVm[];
};

export type StoryBlueprintDialogueVm = {
  refId: string;
  segmentId: string;
  segmentTitle: string;
  mode: string;
  modeLabel: string;
  speaker: string;
  text: string;
  timingNotes: string;
  language: string;
  extraFields: StoryBlueprintKvFieldVm[];
};

export type StoryBlueprintSubtitleVm = {
  present: boolean;
  rows: StoryBlueprintKvFieldVm[];
  rawText: string;
};

export type StoryBlueprintProductionVm = {
  assetSpecs: StoryBlueprintAssetSpecVm[];
  videoSpecs: StoryBlueprintVideoSpecVm[];
  subtitle: StoryBlueprintSubtitleVm;
  dialogueItems: StoryBlueprintDialogueVm[];
};

export type StoryBlueprintPageViewModel = {
  script: StoryBlueprintPageScriptVm;
  segments: StoryBlueprintPageSegmentVm[];
  production: StoryBlueprintProductionVm;
};

function formatSegmentDuration(seconds: number | undefined): string {
  if (seconds == null || Number.isNaN(seconds) || seconds <= 0) return '—';
  if (seconds >= 60) {
    const s = Math.round(seconds);
    return `${s}s`;
  }
  return `~${Math.round(seconds)}s`;
}

function sanitizeDisplayLabel(value: unknown): string {
  const text = String(value || '').trim();
  if (!text) return '';
  if (STORY_ENUM_DISPLAY_MAP[text]) return STORY_ENUM_DISPLAY_MAP[text];
  const mapped = marketingGoalZhLabel(text);
  if (mapped !== text) return mapped;
  return text
    .replace(/^brand_seeding[，,:：\s-]*/i, '')
    .replace(/^single_ad[，,:：\s-]*/i, '')
    .replace(/^light_conflict[，,:：\s-]*/i, '')
    .replace(/^cinematic[，,:：\s-]*/i, '')
    .trim();
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function stringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((x) => String(x).trim()).filter(Boolean);
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
}

function joinList(values: string[]): string {
  return values.filter(Boolean).join('、');
}

/** 是否为无意义的阶段编号兜底文案（如「阶段 1」） */
function isGenericStageLabel(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (/^阶段\s*\d+$/i.test(t)) return true;
  if (/^segment\s*\d+$/i.test(t)) return true;
  if (/^第\s*\d+\s*段$/i.test(t)) return true;
  return false;
}

/** 判断文本是否像 asset key 列表（young_thai_user、garfield_plush） */
function looksLikeAssetKeyList(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  const parts = t.split(/[,、]/).map((p) => p.trim()).filter(Boolean);
  if (!parts.length) return false;
  return parts.every((p) => /^[a-z][a-z0-9_]*$/i.test(p));
}

function pickSegmentRole(item: SegmentPlanItemDto): string {
  const raw = asRecord(item);
  const candidates = [
    stringValue(item.segment_role),
    raw ? stringValue(raw.narrative_role) : '',
    raw ? stringValue(raw.section_role) : '',
    raw ? stringValue(raw.segment_responsibility) : '',
  ].filter(Boolean);
  for (const c of candidates) {
    if (isGenericStageLabel(c)) continue;
    return sanitizeDisplayLabel(c);
  }
  return '';
}

function visualElementToken(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  const row = asRecord(value);
  if (!row) return '';
  for (const key of ['asset_key', 'key', 'id', 'name', 'label']) {
    const token = stringValue(row[key]);
    if (token) return token;
  }
  return '';
}

function normalizeVisualElementList(value: unknown): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return value.map((el) => visualElementToken(el)).filter(Boolean);
  }
  if (typeof value === 'string') {
    const text = value.trim();
    if (!text) return [];
    if (/[,、，]/.test(text)) {
      return text
        .split(/[,、，]/)
        .map((part) => part.trim())
        .filter(Boolean);
    }
    return [text];
  }
  const row = asRecord(value);
  if (!row) return [];
  const nested: string[] = [];
  for (const key of ['characters', 'scenes', 'products', 'assets', 'elements', 'items']) {
    nested.push(...normalizeVisualElementList(row[key]));
  }
  if (nested.length) return nested;
  const single = visualElementToken(row);
  return single ? [single] : [];
}

/** 合并多来源结构化视觉依赖；空数组不阻断后续来源（修复 ?? 对 [] 不回退的问题） */
function pickRequiredVisualElements(item: SegmentPlanItemDto, shotSeg: Record<string, unknown> | null): string[] {
  const raw = asRecord(item);
  const sourceValues: unknown[] = [
    item.required_visual_elements,
    item.required_assets,
    item.expected_assets,
    raw?.visual_elements,
    raw?.visual_requirements,
    raw?.asset_requirements,
    shotSeg?.required_visual_elements,
    shotSeg?.required_assets,
    shotSeg?.expected_assets,
    shotSeg?.reference_asset_keys,
    shotSeg?.visual_elements,
  ];
  const merged: string[] = [];
  const seen = new Set<string>();
  for (const src of sourceValues) {
    for (const token of normalizeVisualElementList(src)) {
      if (!token || seen.has(token)) continue;
      seen.add(token);
      merged.push(token);
    }
  }
  return merged;
}

function pickSegmentVisualRequirement(item: SegmentPlanItemDto, shotSeg: Record<string, unknown> | null): string {
  const raw = asRecord(item);
  const candidates: string[] = [];
  if (raw) {
    for (const key of ['visual_requirement', 'visual_need', 'visual_description', 'visual_expression']) {
      const v = stringValue(raw[key]);
      if (v && !looksLikeAssetKeyList(v)) candidates.push(v);
    }
    const vr = raw.visual_requirements;
    if (typeof vr === 'string') {
      const v = vr.trim();
      if (v && !looksLikeAssetKeyList(v)) candidates.push(v);
    }
  }
  if (shotSeg) {
    for (const key of ['visual_description', 'visual_action']) {
      const v = stringValue(shotSeg[key]);
      if (v && !looksLikeAssetKeyList(v)) candidates.push(v);
    }
  }
  const picked = candidates.find(Boolean);
  return picked ? sanitizeDisplayLabel(picked) : '';
}

function truncateSummary(text: string, max = 160): string {
  const t = text.trim();
  if (!t) return '';
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

const ASSET_KIND_LABEL: Record<string, string> = {
  character: '角色资产',
  scene: '场景资产',
  product: '产品资产',
};

const REFERENCE_ROLE_LABEL: Record<string, string> = {
  character_reference: '角色参考',
  scene_reference: '场景参考',
  product_reference: '产品参考',
};

const DIALOGUE_MODE_LABEL: Record<string, string> = {
  dialogue: '对白',
  voiceover: '旁白',
  subtitle_only: '屏幕文字',
  silent: '静默',
};

const SUBTITLE_FIELD_LABEL: Record<string, string> = {
  enabled: '是否启用',
  language: '字幕语言',
  max_lines: '最大行数',
  tone: '字幕风格',
  cta_style: 'CTA 样式',
  style: '字幕风格',
  placement: '字幕出现方式',
  rhythm: '字幕节奏',
  pacing: '字幕节奏',
  appearance: '字幕出现方式',
};

const ASSET_SPEC_EXTRA_KEYS = new Set([
  'asset_key',
  'asset_kind',
  'reference_role',
  'display_name',
  'description',
  'image_prompt',
  'generation_prompt',
  'prompt',
  'negative_prompt',
  'immutable_constraints',
  'linked_entity_key',
  'segment_id',
  'segment_ids',
]);

const VIDEO_SPEC_EXTRA_KEYS = new Set([
  'spec_key',
  'segment_id',
  'shot_id',
  'video_prompt',
  'reference_asset_keys',
  'duration_sec',
  'duration',
  'aspect_ratio',
  'ratio',
  'camera',
  'visual_action',
  'audio_notes',
  'dialogue_or_voiceover_ref',
  'must_show',
  'must_avoid',
  'motion',
  'visual_style',
  'negative_prompt',
  'avoid',
]);

const DIALOGUE_EXTRA_KEYS = new Set(['ref_id', 'segment_id', 'shot_id', 'mode', 'speaker', 'text', 'language', 'timing_notes']);

function humanizeFieldKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatPrimitiveValue(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) return joinList(value.map((x) => formatPrimitiveValue(x)).filter(Boolean));
  return '';
}

function collectExtraFields(row: Record<string, unknown>, knownKeys: Set<string>): StoryBlueprintKvFieldVm[] {
  const out: StoryBlueprintKvFieldVm[] = [];
  for (const [key, value] of Object.entries(row)) {
    if (knownKeys.has(key)) continue;
    const text = formatPrimitiveValue(value);
    if (!text) continue;
    out.push({ label: humanizeFieldKey(key), value: text });
  }
  return out;
}

function resolveSegmentTitle(segmentId: string, plan: SegmentPlanItemDto[]): string {
  const sid = segmentId.trim();
  if (!sid) return '';
  const idx = plan.findIndex((item) => String(item.segment_id || '').trim() === sid);
  if (idx < 0) return '';
  const item = plan[idx];
  return (
    sanitizeDisplayLabel(item.segment_title?.trim()) ||
    sanitizeDisplayLabel(item.title?.trim()) ||
    sanitizeDisplayLabel(item.stage_name?.trim()) ||
    `段落 ${idx + 1}`
  );
}

function mapAssetSpecs(dto: StoryBlueprintDto): StoryBlueprintAssetSpecVm[] {
  return (dto.asset_generation_specs ?? [])
    .map((raw) => {
      const row = asRecord(raw);
      if (!row) return null;
      const kind = String(row.asset_kind || '').trim().toLowerCase();
      const name =
        stringValue(row.display_name) ||
        stringValue(row.name) ||
        stringValue(row.asset_key) ||
        '—';
      const purpose =
        stringValue(row.purpose) ||
        stringValue(row.narrative_function) ||
        REFERENCE_ROLE_LABEL[String(row.reference_role || '').trim()] ||
        (kind === 'character' ? '角色定位' : kind === 'scene' ? '场景用途' : kind === 'product' ? '产品用途' : '');
      const description = stringValue(row.description);
      const prompt =
        stringValue(row.image_prompt) ||
        stringValue(row.generation_prompt) ||
        stringValue(row.prompt);
      const segmentRefs = joinList([
        ...stringList(row.segment_ids),
        stringValue(row.segment_id),
      ]);
      return {
        assetKind: kind,
        assetKindLabel: ASSET_KIND_LABEL[kind] || (kind ? humanizeFieldKey(kind) : '其他资产'),
        name,
        purpose: purpose || '—',
        description: description || '—',
        prompt,
        segmentRefs,
        extraFields: [
          ...(stringValue(row.asset_key) ? [{ label: '资产键', value: stringValue(row.asset_key) }] : []),
          ...(stringValue(row.linked_entity_key) ? [{ label: '关联实体', value: stringValue(row.linked_entity_key) }] : []),
          ...(stringList(row.immutable_constraints).length
            ? [{ label: '不可变约束', value: joinList(stringList(row.immutable_constraints)) }]
            : []),
          ...(stringValue(row.negative_prompt) ? [{ label: '负向提示', value: stringValue(row.negative_prompt) }] : []),
          ...collectExtraFields(row, ASSET_SPEC_EXTRA_KEYS),
        ],
      };
    })
    .filter((item): item is StoryBlueprintAssetSpecVm => Boolean(item));
}

function mapVideoSpecs(dto: StoryBlueprintDto): StoryBlueprintVideoSpecVm[] {
  const plan = dto.segment_plan ?? [];
  return (dto.video_generation_specs ?? [])
    .map((raw) => {
      const row = asRecord(raw);
      if (!row) return null;
      const segmentId = stringValue(row.segment_id);
      const videoPrompt = stringValue(row.video_prompt) || stringValue(row.generation_prompt);
      const durationSec = row.duration_sec ?? row.duration;
      const durationNum = typeof durationSec === 'number' ? durationSec : Number(durationSec);
      const durationLabel =
        durationNum > 0 ? formatSegmentDuration(durationNum) : stringValue(durationSec) || '—';
      const aspectRatio = stringValue(row.aspect_ratio) || stringValue(row.ratio) || '—';
      const referenceKeys = joinList(stringList(row.reference_asset_keys));
      const mustShow = joinList(stringList(row.must_show));
      const mustAvoid = joinList(stringList(row.must_avoid));
      const extraFields: StoryBlueprintKvFieldVm[] = [
        ...(stringValue(row.spec_key) ? [{ label: '规格键', value: stringValue(row.spec_key) }] : []),
        ...(stringValue(row.shot_id) ? [{ label: '镜头 ID', value: stringValue(row.shot_id) }] : []),
        ...(referenceKeys ? [{ label: '参考资产', value: referenceKeys }] : []),
        ...(stringValue(row.camera) ? [{ label: '镜头语言', value: stringValue(row.camera) }] : []),
        ...(stringValue(row.visual_action) ? [{ label: '画面动作', value: stringValue(row.visual_action) }] : []),
        ...(stringValue(row.motion) ? [{ label: '运动', value: stringValue(row.motion) }] : []),
        ...(stringValue(row.visual_style) ? [{ label: '视觉风格', value: stringValue(row.visual_style) }] : []),
        ...(stringValue(row.audio_notes) ? [{ label: '音频说明', value: stringValue(row.audio_notes) }] : []),
        ...(stringValue(row.dialogue_or_voiceover_ref)
          ? [{ label: '旁白/对白引用', value: stringValue(row.dialogue_or_voiceover_ref) }]
          : []),
        ...(mustShow ? [{ label: '必须呈现', value: mustShow }] : []),
        ...(mustAvoid ? [{ label: '需要避免', value: mustAvoid }] : []),
        ...(stringValue(row.negative_prompt) || stringValue(row.avoid)
          ? [{ label: '负向提示', value: stringValue(row.negative_prompt) || stringValue(row.avoid) }]
          : []),
        ...collectExtraFields(row, VIDEO_SPEC_EXTRA_KEYS),
      ];
      return {
        segmentId: segmentId || '—',
        segmentTitle: resolveSegmentTitle(segmentId, plan) || '—',
        specKey: stringValue(row.spec_key),
        durationLabel,
        aspectRatio,
        videoPrompt,
        videoPromptSummary: truncateSummary(videoPrompt, 180),
        extraFields,
      };
    })
    .filter((item): item is StoryBlueprintVideoSpecVm => Boolean(item));
}

function mapDialogueItems(dto: StoryBlueprintDto): StoryBlueprintDialogueVm[] {
  const plan = dto.segment_plan ?? [];
  return (dto.dialogue_or_voiceover ?? [])
    .map((raw) => {
      const row = asRecord(raw);
      if (!row) return null;
      const segmentId = stringValue(row.segment_id);
      const mode = stringValue(row.mode).toLowerCase();
      return {
        refId: stringValue(row.ref_id),
        segmentId: segmentId || '—',
        segmentTitle: resolveSegmentTitle(segmentId, plan) || '—',
        mode,
        modeLabel: DIALOGUE_MODE_LABEL[mode] || sanitizeDisplayLabel(mode) || '旁白/对白',
        speaker: stringValue(row.speaker) || stringValue(row.voice) || stringValue(row.character) || '—',
        text: stringValue(row.text) || stringValue(row.content) || '—',
        timingNotes: stringValue(row.timing_notes) || stringValue(row.timing) || '—',
        language: stringValue(row.language) || '—',
        extraFields: collectExtraFields(row, DIALOGUE_EXTRA_KEYS),
      };
    })
    .filter((item): item is StoryBlueprintDialogueVm => Boolean(item));
}

function mapSubtitleStrategy(raw: StoryBlueprintDto['subtitle_strategy'] | string | unknown): StoryBlueprintSubtitleVm {
  if (raw == null) return { present: false, rows: [], rawText: '' };
  if (typeof raw === 'string') {
    const text = raw.trim();
    return { present: Boolean(text), rows: [], rawText: text };
  }
  const row = asRecord(raw);
  if (!row) return { present: false, rows: [], rawText: '' };
  const rows: StoryBlueprintKvFieldVm[] = [];
  for (const [key, value] of Object.entries(row)) {
    const text = formatPrimitiveValue(value);
    if (!text && typeof value !== 'boolean') continue;
    rows.push({
      label: SUBTITLE_FIELD_LABEL[key] || humanizeFieldKey(key),
      value: typeof value === 'boolean' ? (value ? '是' : '否') : text,
    });
  }
  return { present: rows.length > 0, rows, rawText: '' };
}

function mapProductionVm(dto: StoryBlueprintDto): StoryBlueprintProductionVm {
  return {
    assetSpecs: mapAssetSpecs(dto),
    videoSpecs: mapVideoSpecs(dto),
    subtitle: mapSubtitleStrategy(dto.subtitle_strategy),
    dialogueItems: mapDialogueItems(dto),
  };
}

export function storyBlueprintDtoToPageView(dto: StoryBlueprintDto | undefined | null): StoryBlueprintPageViewModel {
  const b = dto ?? {};
  if (!dto) {
    return {
      script: {
        title: '',
        summary: '',
        scriptStructureType: '',
        structureRhythm: '',
        structureReason: '',
        beatsSectionTitle: '叙事结构',
        usesStoryBeats: false,
        sections: [],
      },
      segments: [],
      production: {
        assetSpecs: [],
        videoSpecs: [],
        subtitle: { present: false, rows: [], rawText: '' },
        dialogueItems: [],
      },
    };
  }
  const structure = b.story_structure ?? {};
  const storyOutline = b.story_outline;
  const storyOverview = b.story_overview;
  const creativeStrategy =
    b.creative_brief && typeof b.creative_brief === 'object' && !Array.isArray(b.creative_brief)
      ? ((b.creative_brief as Record<string, unknown>).creative_strategy as Record<string, unknown> | undefined)
      : undefined;
  const briefStages = Array.isArray(creativeStrategy?.stage_display_names)
    ? creativeStrategy?.stage_display_names.map(String).filter(Boolean)
    : [];
  const frameworkSteps = briefStages.length ? briefStages : (Array.isArray(b.story_framework?.structure) ? b.story_framework?.structure ?? [] : []);
  const storyBeatSections = (storyOutline?.story_beats ?? [])
    .map((beat, idx) => {
      const title = stringValue(beat.title);
      const purpose = stringValue(beat.purpose);
      const content = stringValue(beat.content);
      if (!title && !purpose && !content) return null;
      return {
        key: `story_beat_${idx + 1}`,
        label: title || `故事节奏 ${idx + 1}`,
        icon: ['ri-quill-pen-line', 'ri-compass-3-line', 'ri-film-line', 'ri-sparkling-2-line', 'ri-bookmark-3-line'][idx] || 'ri-layout-row-line',
        purpose,
        content: content || '—',
      };
    })
    .filter((item): item is StoryBlueprintBeatSectionVm => Boolean(item));
  const legacySections: StoryBlueprintBeatSectionVm[] = [
    {
      key: 'hook',
      label: '开场吸引',
      icon: 'ri-anchor-line',
      purpose: '',
      content: structure.hook?.trim() || b.hook?.trim() || '',
    },
    {
      key: 'conflict',
      label: '主要推进',
      icon: 'ri-sword-line',
      purpose: '',
      content: structure.conflict?.trim() || (b.core_conflict ?? '').trim() || '',
    },
    {
      key: 'twist',
      label: '关键变化',
      icon: 'ri-exchange-funds-line',
      purpose: '',
      content: structure.twist?.trim() || b.twist?.trim() || '',
    },
    {
      key: 'resolution',
      label: '收束表达',
      icon: 'ri-flag-line',
      purpose: '',
      content: structure.resolution?.trim() || b.resolution?.trim() || '',
    },
  ].filter((section) => section.content.trim());
  const frameworkContentByIndex = [
    structure.hook?.trim() || b.hook?.trim() || '',
    structure.conflict?.trim() || (b.core_conflict ?? '').trim() || '',
    structure.twist?.trim() || b.twist?.trim() || '',
    structure.resolution?.trim() || b.resolution?.trim() || '',
    Array.isArray(structure.emotional_arc) ? structure.emotional_arc.map((x) => String(x)).join('；') : '',
  ];
  const frameworkSections: StoryBlueprintBeatSectionVm[] = frameworkSteps
    .map((step, idx) => ({
      key: `framework_${idx + 1}`,
      label: sanitizeDisplayLabel(String(step).trim()) || `段落 ${idx + 1}`,
      icon: ['ri-home-4-line', 'ri-heart-3-line', 'ri-gift-2-line', 'ri-magic-line', 'ri-bookmark-3-line'][idx] || 'ri-layout-row-line',
      purpose: '',
      content: (frameworkContentByIndex[idx] || frameworkContentByIndex[3] || '').trim(),
    }))
    .filter((section) => section.content);
  const useStoryBeatSections = storyBeatSections.length > 0;
  const useFrameworkSections = !useStoryBeatSections && frameworkSections.length > 0;
  const script: StoryBlueprintPageScriptVm = {
    title:
      stringValue(storyOutline?.title) ||
      stringValue(storyOverview?.title) ||
      structure.title?.trim() ||
      b.script_title?.trim() ||
      b.title?.trim() ||
      '',
    summary:
      stringValue(storyOutline?.summary) ||
      stringValue(storyOverview?.premise) ||
      stringValue(storyOverview?.creative_intent_summary) ||
      structure.premise?.trim() ||
      b.premise?.trim() ||
      '',
    scriptStructureType: resolveBlueprintStructureTypeDisplay(b),
    structureRhythm:
      sanitizeDisplayLabel(b.structure_type_display) ||
      sanitizeDisplayLabel(creativeStrategy?.structure_type_display) ||
      frameworkSteps.join(' → ') ||
      '',
    structureReason:
      stringValue(storyOutline?.structure_reasoning) ||
      b.structure_reason_for_user?.trim() ||
      b.structure_reason?.trim() ||
      String(creativeStrategy?.structure_reason_for_user || '').trim() ||
      '',
    beatsSectionTitle: useStoryBeatSections ? '故事节拍' : '叙事结构',
    usesStoryBeats: useStoryBeatSections,
    sections: useStoryBeatSections ? storyBeatSections : useFrameworkSections ? frameworkSections : legacySections,
  };

  const plan = b.segment_plan ?? [];
  const shotPlanSegments = Array.isArray(b.shot_plan?.segments) ? b.shot_plan?.segments ?? [] : [];
  const segments: StoryBlueprintPageSegmentVm[] = plan.map((item, idx) => {
    const id = idx + 1;
    const shotSeg =
      shotPlanSegments[idx] && typeof shotPlanSegments[idx] === 'object' && !Array.isArray(shotPlanSegments[idx])
        ? (shotPlanSegments[idx] as Record<string, unknown>)
        : null;
    const shotSegName = shotSeg ? String(shotSeg.name || '').trim() : '';
    const name =
      sanitizeDisplayLabel(item.segment_title?.trim()) ||
      sanitizeDisplayLabel(item.title?.trim()) ||
      sanitizeDisplayLabel(shotSegName) ||
      (frameworkSteps[idx] && sanitizeDisplayLabel(String(frameworkSteps[idx]).trim())) ||
      (item.story_beat && sanitizeDisplayLabel(String(item.story_beat).trim())) ||
      (item.segment_id && String(item.segment_id).trim()) ||
      `Segment ${id}`;
    const rawStageName =
      sanitizeDisplayLabel(item.stage_name?.trim()) ||
      (frameworkSteps[idx] && sanitizeDisplayLabel(String(frameworkSteps[idx]).trim())) ||
      sanitizeDisplayLabel(item.story_beat?.trim()) ||
      '';
    const stageName = rawStageName && !isGenericStageLabel(rawStageName) ? rawStageName : `阶段 ${id}`;
    const stageLabel =
      rawStageName && !isGenericStageLabel(rawStageName) && rawStageName !== name ? rawStageName : '';
    const visualTokens = pickRequiredVisualElements(item, shotSeg);
    const role = pickSegmentRole(item);
    const visualReq = pickSegmentVisualRequirement(item, shotSeg);
    return {
      id,
      segmentId: String(item.segment_id || '').trim() || `seg_${id}`,
      name,
      stageName,
      stageLabel,
      goal: item.segment_goal?.trim() || item.goal?.trim() || '—',
      duration: formatSegmentDuration(item.duration_sec ?? item.duration_seconds),
      productPlacement: item.product_exposure?.trim() || item.product_exposure_mode?.trim() || '—',
      segmentRole: role || '—',
      visualRequirement: visualReq || '—',
      emotionalState: item.emotional_state?.trim() || '—',
      keyMessage: item.key_message?.trim() || item.source_selling_point?.trim() || '—',
      expectedAssets: visualTokens,
      visualElementsSummary: joinList(visualTokens) || '—',
      productFeature: item.product_feature_to_show?.trim() || '—',
      targetUserTrigger: item.target_user_trigger?.trim() || '—',
      transitionToNext: item.transition_to_next?.trim() || '—',
      synopsis: item.summary?.trim() || '—',
      color: SEGMENT_COLORS[idx % SEGMENT_COLORS.length],
    };
  });

  return { script, segments, production: mapProductionVm(b) };
}
