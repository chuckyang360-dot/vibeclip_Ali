import type { ProductInputDraft, ProductPreviewSummary } from '@/types/shortDrama';
import type { ProductImageUnderstandingDto } from '@/types/shortDramaApi';

/** 内部使用：归一 pipeline 中的图片理解结构 */
export function normalizeImageUnderstanding(raw: unknown): ProductImageUnderstandingDto | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const strArr = (k: string): string[] | undefined => {
    const v = o[k];
    if (!Array.isArray(v)) return undefined;
    const out = v.map((x) => String(x).trim()).filter(Boolean);
    return out.length ? out : undefined;
  };
  const hasAny =
    (typeof o.detected_product_type === 'string' && o.detected_product_type.trim().length > 0) ||
    Boolean(strArr('detected_visual_features')?.length) ||
    Boolean(strArr('detected_materials')?.length) ||
    Boolean(strArr('detected_colors')?.length) ||
    Boolean(strArr('detected_usage_context')?.length) ||
    Boolean(strArr('detected_people_type')?.length) ||
    Boolean(strArr('detected_pose_or_usage')?.length) ||
    Boolean(strArr('detected_packaging')?.length) ||
    Boolean(strArr('detected_brand_clues')?.length) ||
    Boolean(strArr('detected_quality_risks')?.length) ||
    Boolean(strArr('image_conflicts')?.length) ||
    (Array.isArray(o.per_image_notes) && o.per_image_notes.length > 0);
  if (!hasAny) return null;
  return {
    detected_product_type: typeof o.detected_product_type === 'string' ? o.detected_product_type : undefined,
    detected_visual_features: strArr('detected_visual_features'),
    detected_materials: strArr('detected_materials'),
    detected_colors: strArr('detected_colors'),
    detected_usage_context: strArr('detected_usage_context'),
    detected_people_type: strArr('detected_people_type'),
    detected_pose_or_usage: strArr('detected_pose_or_usage'),
    detected_packaging: strArr('detected_packaging'),
    detected_brand_clues: strArr('detected_brand_clues'),
    detected_quality_risks: strArr('detected_quality_risks'),
    image_conflicts: strArr('image_conflicts'),
    per_image_notes: Array.isArray(o.per_image_notes) ? (o.per_image_notes as Record<string, unknown>[]) : undefined,
  };
}

const LEAD_STRIP = /^(?:conflict|raw|detected_\w+|image_\w+)\s*[:：]\s*/i;

function stripLead(s: string): string {
  let t = String(s || '').trim();
  t = t.replace(LEAD_STRIP, '').replace(/^conflict\s*[:：]\s*/i, '');
  return t.trim();
}

/** 去掉不应出现在用户界面上的字样（输出前最后清洗） */
export function polishUserFacingLine(s: string): string {
  let t = String(s || '')
    .replace(/\b(conflict|raw\s*user\s*text|detected_\w+|image_conflicts|per_image_notes|schema|json)\b/gi, '')
    .replace(/\b(api|openai|gpt)\b/gi, '')
    .replace(/\bAI\b|\b模型\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  t = t.replace(/^[，。；、\s]+|[，。；、\s]+$/g, '').trim();
  return t;
}

const VISUAL_PHRASES: Array<{ re: RegExp; zh: string }> = [
  { re: /cylindrical\s+black\s+tub\s+with\s+red\s+lid/i, zh: '黑色圆柱形包装桶，红色盖子' },
  { re: /cylindrical\s+.*\b(tub|container)\b/i, zh: '圆柱形包装容器' },
  { re: /black\s+tub/i, zh: '黑色包装桶' },
  { re: /red\s+lid/i, zh: '红色盖子' },
  {
    re: /prominent\s+product\s+label\s+with\s+nutritional\s+claims\s+and\s+graphics/i,
    zh: '包装正面有明显产品标签、营养宣称与图形信息',
  },
  { re: /prominent\s+product\s+label/i, zh: '包装正面有明显产品标签' },
  { re: /nutritional\s+claims?/i, zh: '营养相关宣称' },
  { re: /graphics?|graphic\s+elements?/i, zh: '图形信息' },
  { re: /milk\s+splash/i, zh: '牛奶飞溅效果' },
  { re: /cookie\s+illustration/i, zh: '饼干风味插画' },
  { re: /flavor|flavour/i, zh: '口味相关画面' },
  { re: /post-?workout\s+fitness\s+recovery/i, zh: '健身恢复训练' },
  { re: /fitness\s+recovery/i, zh: '运动恢复' },
  { re: /packaging|package\b/i, zh: '包装' },
  { re: /studio\s+light/i, zh: '棚拍光线' },
  { re: /white\s+background/i, zh: '白底背景' },
];

/**
 * 将单条英文/混合外观描述转为中文；无法可靠转换时返回空（不进入主界面）。
 */
export function translateVisualFeatureToChineseOrEmpty(raw: string): string {
  const stripped = stripLead(raw);
  if (!stripped) return '';
  const zhCount = (stripped.match(/[\u4e00-\u9fff]/g) || []).length;
  if (zhCount >= 2) return polishUserFacingLine(stripped);

  let out = stripped;
  for (const { re, zh } of VISUAL_PHRASES) {
    if (re.test(out)) out = out.replace(re, zh);
  }
  out = out.replace(/\s+/g, ' ').trim();
  const letters = (out.match(/[A-Za-z]/g) || []).length;
  const zhAfter = (out.match(/[\u4e00-\u9fff]/g) || []).length;
  if (letters > 12 && zhAfter < 2) return '';
  return polishUserFacingLine(out);
}

function uniquePush(list: string[], seen: Set<string>, item: string) {
  const t = item.trim();
  if (!t || seen.has(t)) return;
  seen.add(t);
  list.push(t);
}

function mergeTranslatedVisuals(
  previewFeatures: string[],
  iu: ProductImageUnderstandingDto | null,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of previewFeatures) {
    const zh = translateVisualFeatureToChineseOrEmpty(x);
    if (zh) uniquePush(out, seen, zh);
  }
  const extraArrays = [
    iu?.detected_visual_features,
    iu?.detected_packaging,
    iu?.detected_colors,
    iu?.detected_materials,
  ];
  for (const arr of extraArrays) {
    for (const x of arr ?? []) {
      const zh = translateVisualFeatureToChineseOrEmpty(x);
      if (zh) uniquePush(out, seen, zh);
    }
  }
  return out;
}

function explicitNoBrand(brandRaw: string): boolean {
  return /^(无|无品牌|没有品牌|不适用|n\/a|na|none|-+)$/i.test(brandRaw.trim());
}

const AVOID_ISSUE_BLOCK_PATTERNS: RegExp[] = [
  /conflict\s*:/i,
  /raw\s*user\s*text/i,
  /generic\s*product\s*name/i,
  /empty\s*brand/i,
  /image\s*shows/i,
  /usage\s*context/i,
  /detected_/i,
  /image_conflicts/i,
  /input_value/i,
  /\bschema\b/i,
  /\bjson\b/i,
  /\bapi\b/i,
  /\bmodel\b/i,
  /\bprovider\b/i,
];

function isMostlyEnglishLongLine(text: string): boolean {
  const letters = (text.match(/[A-Za-z]/g) || []).length;
  const zh = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  return letters > 24 && zh < 2;
}

/** 渲染「生成注意事项」前兜底过滤 */
export function sanitizeAvoidIssueLine(raw: string): string {
  let t = polishUserFacingLine(stripLead(raw));
  if (!t) return '';
  for (const re of AVOID_ISSUE_BLOCK_PATTERNS) {
    if (re.test(t)) return '';
  }
  if (isMostlyEnglishLongLine(t)) return '';
  return t;
}

/** 解析/载入后：清洗外观要点；空品牌时用图片品牌线索预填（用户明确填「无品牌」时不预填，交给提示卡片） */
export function sanitizePreviewForConfirm(
  p: ProductPreviewSummary,
  iu: ProductImageUnderstandingDto | null,
  draft: ProductInputDraft,
): ProductPreviewSummary {
  let brandName = p.brandName.trim();
  const clues = iu?.detected_brand_clues?.filter(Boolean) ?? [];
  if (!brandName && clues.length && !explicitNoBrand(draft.brandRaw)) {
    brandName = clues.join(' / ');
  }
  return {
    ...p,
    brandName,
    visualFeatures: mergeTranslatedVisuals(p.visualFeatures ?? [], iu),
    visualRiskNotes: mergeAvoidIssues(p.visualRiskNotes ?? [], iu),
  };
}

function humanizeQualityRiskToZh(raw: string): string {
  const t = stripLead(raw);
  if (!t) return '';
  if (/exaggerat|夸大|overstate|功效宣传/i.test(t)) return '避免夸大功效宣传';
  if (/medical|medicalized|医疗|治愈|疗效|临床/i.test(t)) return '避免医疗化表达';
  if (/avoid graphic|夸张病症|dental/i.test(t)) return '避免夸张病症画面';
  if (/negative|负面|unhealthy|不健康|adverse/i.test(t)) return '避免负面健康结果';
  if (/cannot be altered|must remain|immutable|shape|form|appearance|形态|外观|材质|颜色/i.test(t)) {
    return '避免产品形态被改变';
  }
  const zh = translateVisualFeatureToChineseOrEmpty(t);
  if (zh) return sanitizeAvoidIssueLine(zh);
  if ((t.match(/[\u4e00-\u9fff]/g) || []).length >= 2) return sanitizeAvoidIssueLine(t);
  return '';
}

function mergeAvoidIssues(previewRisks: string[], iu: ProductImageUnderstandingDto | null): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (raw: string) => {
    const cleaned = sanitizeAvoidIssueLine(raw);
    if (!cleaned || seen.has(cleaned)) return;
    seen.add(cleaned);
    out.push(cleaned);
  };
  for (const x of previewRisks ?? []) add(x);
  for (const x of iu?.detected_quality_risks ?? []) {
    const zh = humanizeQualityRiskToZh(x);
    if (zh) add(zh);
  }
  return out;
}

/**
 * 将接口返回的冲突/差异文案统一为中文自然句；无法解析时给简短提示，不暴露英文模板。
 */
export function humanizeProductConflict(raw: string): string {
  let text = stripLead(String(raw || ''));
  if (!text) return '';

  const mBrand =
    /generic product name\s*[「"']?([^」"'\n]+)[」"']?\s+and\s+empty brand\s+while\s+image shows\s+specific\s+branded product\s*[「"']?([^」"'\n]+)[」"']/i.exec(
      text,
    ) ||
    /generic product name\s*[「"']?([^」"'\n]+)[」"']?[\s\S]{0,120}?empty brand[\s\S]{0,120}?branded product\s*[「"']?([^」"'\n]+)[」"']/i.exec(
      text,
    );
  if (mBrand) {
    const userPart = (mBrand[1] || '').trim();
    const imgPart = (mBrand[2] || '').trim();
    if (userPart && imgPart) {
      return polishUserFacingLine(
        `图片中识别到具体品牌「${imgPart}」，与你填写的「${userPart}/无品牌」不完全一致，请确认是否采用图片识别结果。`,
      );
    }
  }

  const mUsers =
    /target users include\s*[「"']?([^」"'\n]+)[」"']?\s+but\s+image usage context is focused on\s+(.+)/i.exec(text);
  if (mUsers) {
    const users = (mUsers[1] || '').trim();
    let ctx = (mUsers[2] || '').trim().replace(/\.$/, '');
    ctx = translateVisualFeatureToChineseOrEmpty(ctx) || ctx;
    if ((ctx.match(/[A-Za-z]/g) || []).length > 20 && (ctx.match(/[\u4e00-\u9fff]/g) || []).length < 2) {
      ctx = '与图片呈现的使用情境';
    }
    return polishUserFacingLine(`图片更偏向${ctx}，而你填写的目标用户是「${users}」，请确认是否调整使用场景。`);
  }

  const mZh =
    /用户输入(?:为|是)?\s*[「"']?([^」"'\n]+)[」"']?\s*而(?:图像|图片)显示(?:具体)?品牌\s*[「"']?([^」"'\n]+)[」"']?/i.exec(
      text,
    );
  if (mZh) {
    const userPart = (mZh[1] || '').trim();
    const imgPart = (mZh[2] || '').trim();
    if (userPart && imgPart) {
      return polishUserFacingLine(
        `图片中识别到具体品牌「${imgPart}」，与你填写的「${userPart}」不完全一致，请确认是否采用图片识别结果。`,
      );
    }
  }

  if ((text.match(/[\u4e00-\u9fff]/g) || []).length >= 4) {
    return polishUserFacingLine(text);
  }

  if (/brand|image|user|product|context/i.test(text)) {
    return polishUserFacingLine('表单填写与图片信息不完全一致，请核对品牌、品名与使用场景。');
  }

  return '';
}

/** 生成「需要确认的信息」列表（仅中文、无内部字段名） */
export function buildNeedsAttentionMessages(
  iu: ProductImageUnderstandingDto | null,
  draft: ProductInputDraft,
  preview: ProductPreviewSummary,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (s: string) => {
    const t = polishUserFacingLine(s);
    if (t.length < 6 || seen.has(t)) return;
    seen.add(t);
    out.push(t);
  };

  for (const c of iu?.image_conflicts ?? []) {
    const h = humanizeProductConflict(c);
    if (h) add(h);
  }

  const clues = iu?.detected_brand_clues?.filter(Boolean) ?? [];
  if (explicitNoBrand(draft.brandRaw) && !preview.brandName.trim() && clues.length && !out.some((x) => /品牌/.test(x))) {
    add(`图片中识别到品牌「${clues.join(' / ')}」，与你填写的品牌信息不一致，请确认品牌信息。`);
  }

  return out;
}
