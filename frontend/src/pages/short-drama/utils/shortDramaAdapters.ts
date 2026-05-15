import type { ProductInputDraft, ProductPreviewSummary } from '@/types/shortDrama';
import type { ProductContextDto, ProductInputPayload, StoryBlueprintDto } from '@/types/shortDramaApi';
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

export type StoryBlueprintPageScriptVm = {
  title: string;
  summary: string;
  scriptStructureType: string;
  structureRhythm: string;
  structureReason: string;
  sections: Array<{
    key: string;
    label: string;
    icon: string;
    content: string;
  }>;
};

export type StoryBlueprintPageSegmentVm = {
  id: number;
  name: string;
  stageName: string;
  goal: string;
  duration: string;
  productPlacement: string;
  segmentRole: string;
  emotionalState: string;
  keyMessage: string;
  expectedAssets: string[];
  transitionToNext: string;
  synopsis: string;
  color: string;
};

export type StoryBlueprintPageViewModel = {
  script: StoryBlueprintPageScriptVm;
  segments: StoryBlueprintPageSegmentVm[];
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

export function storyBlueprintDtoToPageView(dto: StoryBlueprintDto | undefined | null): StoryBlueprintPageViewModel {
  const b = dto ?? {};
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
        content: [purpose, content].filter(Boolean).join('\n') || '—',
      };
    })
    .filter((item): item is StoryBlueprintPageScriptVm['sections'][number] => Boolean(item));
  const legacySections = [
    { key: 'hook', label: '开场吸引', icon: 'ri-anchor-line', content: structure.hook?.trim() || b.hook?.trim() || '' },
    {
      key: 'conflict',
      label: '主要推进',
      icon: 'ri-sword-line',
      content: structure.conflict?.trim() || (b.core_conflict ?? '').trim() || '',
    },
    { key: 'twist', label: '关键变化', icon: 'ri-exchange-funds-line', content: structure.twist?.trim() || b.twist?.trim() || '' },
    {
      key: 'resolution',
      label: '收束表达',
      icon: 'ri-flag-line',
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
  const frameworkSections = frameworkSteps.map((step, idx) => ({
    key: `framework_${idx + 1}`,
    label: sanitizeDisplayLabel(String(step).trim()) || `段落 ${idx + 1}`,
    icon: ['ri-home-4-line', 'ri-heart-3-line', 'ri-gift-2-line', 'ri-magic-line', 'ri-bookmark-3-line'][idx] || 'ri-layout-row-line',
    content: (frameworkContentByIndex[idx] || frameworkContentByIndex[3] || '').trim(),
  })).filter((section) => section.content);
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
      stringValue(storyOverview?.creative_intent_summary) ||
      structure.premise?.trim() ||
      b.premise?.trim() ||
      '',
    scriptStructureType:
      sanitizeDisplayLabel(storyOutline?.structure_type) ||
      sanitizeDisplayLabel(b.script_type_display) ||
      sanitizeDisplayLabel(creativeStrategy?.script_type_display) ||
      sanitizeDisplayLabel(b.story_framework?.name) ||
      '',
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
    sections: useStoryBeatSections ? storyBeatSections : useFrameworkSections ? frameworkSections : legacySections,
  };

  const plan = b.segment_plan ?? [];
  const shotPlanSegments = Array.isArray(b.shot_plan?.segments) ? b.shot_plan?.segments ?? [] : [];
  const segments: StoryBlueprintPageSegmentVm[] = plan.map((item, idx) => {
    const id = idx + 1;
    const shotSeg = shotPlanSegments[idx];
    const shotSegName =
      shotSeg && typeof shotSeg === 'object' && !Array.isArray(shotSeg)
        ? String((shotSeg as Record<string, unknown>).name || '').trim()
        : '';
    const name =
      sanitizeDisplayLabel(item.segment_title?.trim()) ||
      sanitizeDisplayLabel(shotSegName) ||
      (frameworkSteps[idx] && sanitizeDisplayLabel(String(frameworkSteps[idx]).trim())) ||
      (item.story_beat && sanitizeDisplayLabel(String(item.story_beat).trim())) ||
      (item.segment_id && String(item.segment_id).trim()) ||
      `Segment ${id}`;
    const stageName =
      sanitizeDisplayLabel(item.stage_name?.trim()) ||
      (frameworkSteps[idx] && sanitizeDisplayLabel(String(frameworkSteps[idx]).trim())) ||
      sanitizeDisplayLabel(item.story_beat?.trim()) ||
      `阶段 ${id}`;
    return {
      id,
      name,
      stageName,
      goal: item.segment_goal?.trim() || item.goal?.trim() || '—',
      duration: formatSegmentDuration(item.duration_sec ?? item.duration_seconds),
      productPlacement: item.product_exposure?.trim() || item.product_exposure_mode?.trim() || '—',
      segmentRole: item.segment_role?.trim() || stageName || '—',
      emotionalState: item.emotional_state?.trim() || '—',
      keyMessage: item.key_message?.trim() || item.source_selling_point?.trim() || '—',
      expectedAssets: item.required_assets ?? item.expected_assets ?? item.required_visual_elements ?? [],
      transitionToNext: item.transition_to_next?.trim() || '—',
      synopsis: item.summary?.trim() || '—',
      color: SEGMENT_COLORS[idx % SEGMENT_COLORS.length],
    };
  });

  return { script, segments };
}
