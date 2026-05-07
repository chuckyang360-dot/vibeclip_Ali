import {
  getAssetThumbnailUrl,
} from './assetsPageAdapters';
import { resolvePublicMediaUrl } from './shortDramaMedia';
import type { Step4SegmentItem, Step4Shot, Step4VideoStatus, Step4VideoStatusMap } from '@/types/shortDrama';
import type {
  PipelineAssetsBundleDto,
  PipelineSummaryDto,
  SegmentScriptPipelineRowDto,
} from '@/types/shortDramaApi';

const SEGMENT_COLORS = ['#B45309', '#DC2626', '#047857', '#334155', '#9333EA', '#0F766E'];

function workflowDisplayName(name: string): string {
  const raw = String(name || '').trim();
  if (!raw) return raw;
  const map: Record<string, string> = {
    bedroom: '卧室',
    'home gym': '家庭健身房',
    kitchen: '厨房',
    office: '办公室',
    street: '街道',
    park: '公园',
    'young male lead': '年轻男主',
  };
  return map[raw.toLowerCase()] || raw;
}

function cleanDisplayText(input: string): string {
  const raw = String(input || '').trim();
  if (!raw) return '';
  const lower = raw.toLowerCase();
  const blocked = [
    'main character',
    'scene location',
    'character_',
    'scene_',
    'product_',
    'product-only reference asset',
    'reusable empty location reference',
    'clean character reference',
    'empty reusable location background plate',
  ];
  if (blocked.some((t) => lower.includes(t))) return '';
  return raw;
}

const ENGINEERING_PREFIX_PATTERNS: RegExp[] = [
  /^\s*emotional_value\s*[:：]\s*/i,
  /^\s*user_pain_points\s*[:：]\s*/i,
  /^\s*core_selling_points\s*[:：]\s*/i,
  /^\s*source_selling_point\s*[:：]\s*/i,
  /^\s*product_presence\s*[:：]\s*/i,
  /^\s*product_purpose\s*[:：]\s*/i,
  /^\s*visual_action\s*[:：]\s*/i,
  /^\s*action_description\s*[:：]\s*/i,
  /^\s*scene_direction\s*[:：]\s*/i,
  /^\s*camera_direction\s*[:：]\s*/i,
  /^\s*character_action\s*[:：]\s*/i,
  /^\s*viewer_takeaway\s*[:：]\s*/i,
  /^\s*story_intent\s*[:：]\s*/i,
  /^\s*commercial_intent\s*[:：]\s*/i,
];

const ENGINEERING_KEYS = [
  'emotional_value',
  'core_selling_points',
  'user_pain_points',
  'product_purpose',
  'product_presence',
  'source_selling_point',
  'visual_action',
  'action_description',
  'scene_direction',
  'camera_direction',
  'character_action',
  'viewer_takeaway',
  'story_intent',
  'commercial_intent',
] as const;

const PRODUCT_PRESENCE_MAP: Record<string, string> = {
  none: '商品暂不出现',
  implied: '暗示商品相关',
  background: '商品作为背景出现',
  visible: '商品可见',
  explicit: '商品明确出现',
  hero: '商品作为主角展示',
};

const REMAINING_ENGINEERING_TOKEN_RE = new RegExp(ENGINEERING_KEYS.join('|'), 'i');

function prettifyValue(value: string): string {
  let out = value.replace(/，/g, '、').replace(/\s+/g, ' ').trim();
  // 主展示不直接确认品牌名，统一弱化品牌识别结果
  out = out.replace(/\bMCM\b\s*品牌?/gi, '品牌质感');
  out = out.replace(/\bMCM\b/gi, '品牌风格');
  return out;
}

function convertKeyValueSegment(segment: string): string {
  const m = segment.match(/^\s*([a-z_]+)\s*[:：]\s*(.*?)\s*$/i);
  if (!m) return prettifyValue(segment);
  const key = m[1].toLowerCase();
  const rawValue = String(m[2] || '').trim();
  if (!rawValue) return '';
  if (key === 'product_presence') {
    const mapped = PRODUCT_PRESENCE_MAP[rawValue.toLowerCase()];
    return mapped || prettifyValue(rawValue);
  }
  if ((ENGINEERING_KEYS as readonly string[]).includes(key)) {
    return prettifyValue(rawValue);
  }
  return prettifyValue(segment);
}

function normalizeDisplayText(input: unknown): string {
  const raw = String(input || '').trim();
  if (!raw) return '';

  const parts = raw
    .split(/[;\n；]+/)
    .map((x) => x.trim())
    .filter(Boolean)
    .map(convertKeyValueSegment)
    .filter(Boolean);
  let text = parts.join('；').trim();
  if (!text) return '';

  for (const p of ENGINEERING_PREFIX_PATTERNS) {
    text = text.replace(p, '');
  }
  text = prettifyValue(text);
  // 兜底：若仍残留工程字段名，不原样展示 key
  if (REMAINING_ENGINEERING_TOKEN_RE.test(text)) {
    text = text.replace(new RegExp(`\\b(${ENGINEERING_KEYS.join('|')})\\b\\s*[:：]?`, 'gi'), '').trim();
    text = prettifyValue(text);
  }
  return text;
}

export type StepFourAssetLibraryVm = {
  characters: {
    id: number;
    name: string;
    role: string;
    desc: string;
    img: string | null;
    visualPrompt: string;
    imageSource: string;
    voice: string;
    meta: Record<string, unknown>;
  }[];
  scenes: {
    id: number;
    name: string;
    type: string;
    desc: string;
    img: string | null;
    visualPrompt: string;
    imageSource: string;
    sceneForm?: string | null;
    meta: Record<string, unknown>;
  }[];
  products: {
    id: number;
    name: string;
    type: string;
    desc: string;
    img: string | null;
    visualPrompt: string;
    imageSource: string;
    meta: Record<string, unknown>;
  }[];
};

function metaRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function mergedMeta(meta: unknown): Record<string, unknown> {
  const root = metaRecord(meta);
  const tf = root.type_fields;
  if (tf && typeof tf === 'object' && !Array.isArray(tf)) {
    return { ...(tf as Record<string, unknown>), ...root };
  }
  return root;
}

function pickString(meta: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const v = meta[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => String(x || '').trim()).filter(Boolean) : [];
}

function stringifyLine(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) return value.map(stringifyLine).filter(Boolean).join('\n');
  if (value && typeof value === 'object') {
    const row = value as Record<string, unknown>;
    const speaker = typeof row.speaker === 'string'
      ? row.speaker.trim()
      : typeof row.role === 'string'
        ? row.role.trim()
        : typeof row.character === 'string'
          ? row.character.trim()
          : '';
    const text = stringifyLine(row.text ?? row.line ?? row.dialogue ?? row.content);
    if (speaker && text) return `${speaker}：${text}`;
    return text;
  }
  return '';
}

function resolveDialogueSource(shot: Record<string, unknown>): Step4Shot['dialogueSource'] {
  if (stringifyLine(shot.spoken_text)) return 'dialogue';
  if (stringifyLine(shot.voiceover_text)) return 'voiceover';
  if (stringifyLine(shot.subtitle_text)) return 'caption';
  if (stringifyLine(shot.dialogue)) return 'dialogue';
  if (stringifyLine(shot.voiceover)) return 'voiceover';
  if (stringifyLine(shot.narration)) return 'narration';
  if (stringifyLine(shot.spoken_line)) return 'spoken_line';
  if (stringifyLine(shot.caption)) return 'caption';
  if (stringifyLine(shot.dialogue_lines)) return 'dialogue_lines';
  if (stringifyLine(shot.lines)) return 'lines';
  if (stringifyLine(shot.script)) return 'script';
  return 'none';
}

function imageSourceLabel(img: string | null, anchorId?: number | null, imageType?: string): string {
  if (!img) return '未生成图片';
  const t = String(imageType || '').toLowerCase();
  if (t === 'reference') return '用户参考图';
  if (t === 'uploaded') return '用户上传';
  return anchorId ? `系统生成（锚点 #${anchorId}）` : '系统生成';
}

export function pipelineAssetsToStepFourLibraryVm(
  assets: PipelineAssetsBundleDto | null | undefined,
): StepFourAssetLibraryVm {
  if (!assets) return { characters: [], scenes: [], products: [] };

  const characters = assets.characters.map((c) => {
    const meta = mergedMeta(c.meta);
    const displayName = cleanDisplayText(pickString(meta, ['display_name'])) || cleanDisplayText(c.name) || '都市年轻主角';
    const displayDesc = cleanDisplayText(pickString(meta, ['display_description'])) || cleanDisplayText(c.description ?? '') || '符合目标市场与受众的角色设定。';
    return {
      id: c.id,
      name: workflowDisplayName(displayName),
      role: c.role_type?.trim() || '角色',
      desc: displayDesc,
      img: getAssetThumbnailUrl(c),
      visualPrompt: (
        (c.visual_prompt ?? '') ||
        pickString(meta, ['image_prompt', 'visual_prompt']) ||
        (c.description ?? '')
      ).trim(),
      imageSource: imageSourceLabel(getAssetThumbnailUrl(c), c.visual_anchor_image_id, pickString(meta, ['cover_image_type', 'image_type'])),
      voice: pickString(meta, ['voice_style', 'voiceStyle', 'voice']) || '未指定',
      meta,
    };
  });

  const scenes = assets.scenes.map((s) => {
    const meta = mergedMeta(s.meta);
    const displayName = cleanDisplayText(pickString(meta, ['display_name'])) || cleanDisplayText(s.name) || '城市通勤场景';
    const displayDesc = cleanDisplayText(pickString(meta, ['display_description'])) || cleanDisplayText(s.description ?? '') || '暂无描述';
    return {
    id: s.id,
    name: workflowDisplayName(displayName),
    type: s.scene_type?.trim() || '场景',
    desc: displayDesc,
    img: getAssetThumbnailUrl(s),
    visualPrompt: (
      (s.visual_prompt ?? '') ||
      pickString(meta, ['image_prompt', 'visual_prompt']) ||
      (s.description ?? '')
    ).trim(),
    imageSource: imageSourceLabel(getAssetThumbnailUrl(s), s.visual_anchor_image_id, pickString(meta, ['cover_image_type', 'image_type'])),
    sceneForm: s.scene_form,
    meta,
    };
  });

  const products = assets.products.map((p) => {
    const meta = mergedMeta(p.meta);
    const displayName = cleanDisplayText(pickString(meta, ['display_name'])) || cleanDisplayText(p.name) || '主商品资产';
    const displayDesc = cleanDisplayText(pickString(meta, ['display_description'])) || cleanDisplayText(p.description ?? '') || '主商品资产展示。';
    return {
      id: p.id,
      name: workflowDisplayName(displayName),
      type: p.product_role?.trim() || pickString(meta, ['product_type', 'productType', 'type']) || '产品',
      desc: displayDesc,
      img: getAssetThumbnailUrl(p),
      visualPrompt: (
        (p.visual_prompt ?? '') ||
        pickString(meta, ['image_prompt', 'visual_prompt']) ||
        (p.description ?? '')
      ).trim(),
      imageSource: imageSourceLabel(getAssetThumbnailUrl(p), p.visual_anchor_image_id, pickString(meta, ['cover_image_type', 'image_type'])),
      meta,
    };
  });

  return { characters, scenes, products };
}

export function resolveStepFourVideoLanguage(pipeline: PipelineSummaryDto | null | undefined): string | null {
  const rows = pipeline?.segment_scripts ?? [];
  for (const row of rows) {
    const script = row.script && typeof row.script === 'object' ? (row.script as Record<string, unknown>) : {};
    const meta = script.meta && typeof script.meta === 'object' ? (script.meta as Record<string, unknown>) : {};
    const lp = meta.language_policy && typeof meta.language_policy === 'object'
      ? (meta.language_policy as Record<string, unknown>)
      : {};
    const v = lp.video_language;
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

function segmentRowVideoUrl(row: SegmentScriptPipelineRowDto): string | null {
  const top = row.video_url;
  const vr = row.video_render;
  const nested =
    vr && typeof vr === 'object' && 'video_url' in vr ? (vr as { video_url?: unknown }).video_url : undefined;
  const raw = top ?? (typeof nested === 'string' ? nested : null);
  return raw?.trim() || null;
}

function sortSegmentRows(rows: SegmentScriptPipelineRowDto[]): SegmentScriptPipelineRowDto[] {
  return [...rows].sort((a, b) => {
    const na = parseInt(String(a.segment_id).replace(/\D/g, ''), 10) || 0;
    const nb = parseInt(String(b.segment_id).replace(/\D/g, ''), 10) || 0;
    return na - nb;
  });
}

const EMPTY_SHOT_PLACEHOLDER: Step4Shot[] = [
  {
    id: 1,
    backendShotId: 'shot_1',
    desc: '—',
    action: '',
    spokenText: '',
    voiceoverText: '',
    subtitleText: '',
    dialogue: '',
    emotion: '',
    duration: '—',
    durationSeconds: 0,
  },
];

function scriptShotsToStep4Shots(script: Record<string, unknown>): Step4Shot[] {
  const presentationShots = Array.isArray(script.presentation_shots) ? script.presentation_shots : [];
  const shots = script.shots;
  if (presentationShots.length > 0) {
    return presentationShots.map((raw, i) => {
      const s = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
      const durationSec = Number(s.duration_sec ?? 0);
      const duration = Number.isFinite(durationSec) && durationSec > 0 ? `${durationSec}s` : '—';
      const dialogueText = normalizeDisplayText(stringifyLine(s.dialogue_text));
      const voiceoverText = normalizeDisplayText(stringifyLine(s.voiceover_text));
      const subtitleText = normalizeDisplayText(stringifyLine(s.subtitle_text));
      const shotRole = normalizeDisplayText(typeof s.shot_role === 'string' ? s.shot_role.trim() : '');
      const visualDirection = normalizeDisplayText(stringifyLine(s.visual_direction));
      const characterDirection = normalizeDisplayText(stringifyLine(s.character_action));
      return {
        id: i + 1,
        backendShotId:
          (typeof s.shot_id === 'string' && s.shot_id.trim()) ||
          (typeof s.shot_id === 'number' ? String(s.shot_id) : '') ||
          `shot_${i + 1}`,
        desc: visualDirection || characterDirection || `镜头 ${i + 1}`,
        shotRole: shotRole || undefined,
        action: characterDirection || visualDirection,
        spokenText: dialogueText,
        voiceoverText,
        subtitleText,
        dialogue: dialogueText,
        voiceover: voiceoverText,
        subtitle: subtitleText,
        dialogueSource: resolveDialogueSource({
          spoken_text: dialogueText,
          voiceover_text: voiceoverText,
          subtitle_text: subtitleText,
        }),
        emotion: normalizeDisplayText(stringifyLine(s.audio_intent)),
        duration,
        durationSeconds: Number.isFinite(durationSec) ? durationSec : 0,
        characterRefs: asStringArray(s.character_refs),
        characterAssetIds: asStringArray(s.character_asset_ids),
        sceneRef: asStringArray(s.scene_refs)[0],
        sceneAssetId: typeof s.scene_asset_id === 'string' ? s.scene_asset_id.trim() : undefined,
        productRefs: asStringArray(s.product_refs),
        productAssetId: typeof s.product_asset_id === 'string' ? s.product_asset_id.trim() : undefined,
        viewerTakeaway: normalizeDisplayText(stringifyLine(s.viewer_takeaway)) || undefined,
        visualDirection: visualDirection || undefined,
        characterDirection: characterDirection || undefined,
        productPresence: normalizeDisplayText(stringifyLine(s.product_presence)) || undefined,
        productPurpose: normalizeDisplayText(stringifyLine(s.product_purpose)) || undefined,
        sceneDirection: normalizeDisplayText(stringifyLine(s.scene_direction)) || undefined,
        cameraDirection: normalizeDisplayText(stringifyLine(s.camera_direction)) || undefined,
        dialogueText: dialogueText || undefined,
        audioIntent: normalizeDisplayText(stringifyLine(s.audio_intent)) || undefined,
      };
    });
  }
  const legacyAction = stringifyLine(script.visual_action ?? script.action_description ?? script.goal);
  if (!Array.isArray(shots) || shots.length === 0) {
    return [{
      ...EMPTY_SHOT_PLACEHOLDER[0],
      backendShotId: 'legacy_shot_1',
      desc: legacyAction || '旧版镜头',
      action: legacyAction,
      spokenText: stringifyLine(script.spoken_text ?? script.dialogue),
      voiceoverText: stringifyLine(script.voiceover_text ?? script.voiceover ?? script.narration),
      subtitleText: stringifyLine(script.subtitle_text ?? script.subtitle),
      dialogue: stringifyLine(script.spoken_text ?? script.dialogue),
      voiceover: stringifyLine(script.voiceover_text ?? script.voiceover ?? script.narration),
      subtitle: stringifyLine(script.subtitle_text ?? script.subtitle),
      dialogueSource: 'none',
    }];
  }

  return shots.map((raw, i) => {
    const s = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
    const dur = s.duration_seconds;
    let durationStr = '—';
    if (typeof dur === 'number' && Number.isFinite(dur)) durationStr = `${dur}s`;
    else if (typeof dur === 'string' && dur.trim()) durationStr = dur.trim();

    const desc =
      (typeof s.visual_description === 'string' && s.visual_description.trim()) ||
      (typeof s.action_description === 'string' && s.action_description.trim()) ||
      `镜头 ${i + 1}`;

    const sceneDescription =
      typeof s.scene_description === 'string' && s.scene_description.trim()
        ? s.scene_description.trim()
        : undefined;
    const subjectDescription =
      typeof s.subject_description === 'string' && s.subject_description.trim()
        ? s.subject_description.trim()
        : undefined;
    const cameraDescription =
      typeof s.camera_description === 'string' && s.camera_description.trim()
        ? s.camera_description.trim()
        : undefined;
    const imagePrompt =
      typeof s.image_prompt === 'string' && s.image_prompt.trim() ? s.image_prompt.trim() : undefined;
    const videoPrompt =
      typeof s.video_prompt === 'string' && s.video_prompt.trim() ? s.video_prompt.trim() : undefined;
    const generationPrompt =
      typeof s.generation_prompt === 'string' && s.generation_prompt.trim() ? s.generation_prompt.trim() : videoPrompt;
    const stringArray = (v: unknown) => (Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : undefined);
    const sourceVisualConstraints =
      s.source_visual_constraints && typeof s.source_visual_constraints === 'object' && !Array.isArray(s.source_visual_constraints)
        ? (s.source_visual_constraints as Record<string, unknown>)
        : undefined;
    const spokenText = normalizeDisplayText(stringifyLine(s.spoken_text) || stringifyLine(s.dialogue));
    const voiceoverText = normalizeDisplayText(
      stringifyLine(s.voiceover_text) || stringifyLine(s.voiceover) || stringifyLine(s.narration),
    );
    const subtitleText = normalizeDisplayText(stringifyLine(s.subtitle_text) || stringifyLine(s.subtitle));
    const legacyDialogue =
      stringifyLine(s.spoken_line) ||
      stringifyLine(s.caption) ||
      stringifyLine(s.dialogue_lines) ||
      stringifyLine(s.lines) ||
      stringifyLine(s.script);
    const displayDialogue = normalizeDisplayText(spokenText || legacyDialogue);

    const mapped: Step4Shot = {
      id: i + 1,
      backendShotId:
        (typeof s.shot_id === 'string' && s.shot_id.trim()) ||
        (typeof s.shot_id === 'number' ? String(s.shot_id) : '') ||
        `shot_${i + 1}`,
      desc,
      shotRole:
        typeof s.shot_role === 'string' && s.shot_role.trim()
          ? normalizeDisplayText(s.shot_role.trim())
          : undefined,
      action: normalizeDisplayText(
        (typeof s.visual_action === 'string' && s.visual_action.trim()) ||
          (typeof s.action_description === 'string' ? s.action_description : ''),
      ),
      spokenText,
      voiceoverText,
      subtitleText,
      camera: typeof s.camera === 'string' && s.camera.trim() ? s.camera.trim() : undefined,
      cameraMovement: typeof s.camera_movement === 'string' && s.camera_movement.trim() ? s.camera_movement.trim() : undefined,
      framing: typeof s.framing === 'string' && s.framing.trim() ? s.framing.trim() : undefined,
      dialogue: displayDialogue,
      voiceover: voiceoverText,
      subtitle: subtitleText,
      dialogueSource: resolveDialogueSource(s),
      emotion: normalizeDisplayText(typeof s.emotion === 'string' ? s.emotion : ''),
      duration: durationStr,
      durationSeconds:
        typeof dur === 'number' && Number.isFinite(dur)
          ? dur
          : typeof dur === 'string' && Number.isFinite(Number(dur))
            ? Number(dur)
            : 0,
      sceneDescription,
      subjectDescription,
      cameraDescription,
      imagePrompt,
      videoPrompt,
      generationPrompt,
      visualStyleInstruction:
        typeof s.visual_style_instruction === 'string' && s.visual_style_instruction.trim()
          ? s.visual_style_instruction.trim()
          : undefined,
      marketLocalizationDetail:
        typeof s.market_localization_detail === 'string' && s.market_localization_detail.trim()
          ? s.market_localization_detail.trim()
          : undefined,
      manualVideoPrompt:
        typeof s.manual_video_prompt === 'string' && s.manual_video_prompt.trim()
          ? s.manual_video_prompt.trim()
          : undefined,
      characterRefs: stringArray(s.character_refs),
      characterAssetIds: stringArray(s.character_asset_ids),
      manualCharacterRefs: stringArray(s.manual_character_refs),
      sceneRef: typeof s.scene_ref === 'string' && s.scene_ref.trim() ? s.scene_ref.trim() : undefined,
      sceneAssetId: typeof s.scene_id === 'string' && s.scene_id.trim() ? s.scene_id.trim() : undefined,
      manualSceneRef:
        typeof s.manual_scene_ref === 'string' && s.manual_scene_ref.trim() ? s.manual_scene_ref.trim() : undefined,
      productRefs: stringArray(s.product_refs),
      productAssetId:
        typeof s.product_asset_id === 'string' && s.product_asset_id.trim()
          ? s.product_asset_id.trim()
          : undefined,
      manualProductRefs: stringArray(s.manual_product_refs),
      mustShow: stringArray(s.must_show),
      mustAvoid: stringArray(s.must_avoid),
      sourceSegmentId: typeof s.source_segment_id === 'string' ? s.source_segment_id : undefined,
      sourceSellingPoint:
        typeof s.source_selling_point === 'string'
          ? normalizeDisplayText(s.source_selling_point)
          : undefined,
      sourceVisualConstraints,
      executionInput:
        s.execution_input && typeof s.execution_input === 'object' && !Array.isArray(s.execution_input)
          ? (s.execution_input as Record<string, unknown>)
          : undefined,
      promptBudget:
        s.prompt_budget && typeof s.prompt_budget === 'object' && !Array.isArray(s.prompt_budget)
          ? (s.prompt_budget as Record<string, unknown>)
          : undefined,
      providerError: typeof s.provider_error === 'string' ? s.provider_error : undefined,
      providerResponse:
        s.provider_response && typeof s.provider_response === 'object' && !Array.isArray(s.provider_response)
          ? (s.provider_response as Record<string, unknown>)
          : undefined,
    };
    if (import.meta.env.DEV) {
      const missingFields: string[] = [];
      if (!mapped.action?.trim()) missingFields.push('action');
      if (!mapped.durationSeconds || mapped.durationSeconds <= 0) missingFields.push('duration');
      if (!(mapped.characterRefs && mapped.characterRefs.length)) missingFields.push('characterRefs');
      if (!mapped.sceneRef) missingFields.push('sceneRef');
      if (!(mapped.productRefs && mapped.productRefs.length)) missingFields.push('productRefs');
      console.info('[S4_ADAPTER_SHOT_MAPPED]', {
        segmentId: String((script as Record<string, unknown>).segment_id || ''),
        shotId: mapped.backendShotId,
        actionPresent: !!mapped.action?.trim(),
        duration: mapped.durationSeconds,
        characterRefs: mapped.characterRefs ?? [],
        sceneRef: mapped.sceneRef ?? '',
        productRefs: mapped.productRefs ?? [],
        missingFields,
      });
    }
    return mapped;
  });
}

/** 仅从 pipeline 行构建片段 VM，不使用任何商品/剧情 mock 兜底 */
export function segmentScriptDtoToStepSegmentViewModel(
  row: SegmentScriptPipelineRowDto,
  index: number,
): Step4SegmentItem {
  const script = row.script && typeof row.script === 'object' ? row.script : {};
  const meta = script.meta && typeof script.meta === 'object' ? (script.meta as Record<string, unknown>) : {};
  const uiId = index + 1;
  const color = SEGMENT_COLORS[index % SEGMENT_COLORS.length];

  const title =
    (typeof script.title === 'string' && script.title.trim()) || `片段 ${uiId}`;
  const goal = (typeof script.goal === 'string' && script.goal.trim()) || '—';
  const segmentRole = (typeof script.segment_role === 'string' && script.segment_role.trim()) || (typeof meta.function_label === 'string' && meta.function_label.trim()) || '';
  const productExposure = (typeof script.product_exposure === 'string' && script.product_exposure.trim()) || '';
  const durLimit = script.duration_limit;
  let duration = '—';
  if (typeof durLimit === 'number' && durLimit > 0) duration = `${durLimit}s`;
  else if (typeof durLimit === 'string' && durLimit.trim()) duration = durLimit.trim();

  const shots = scriptShotsToStep4Shots(script);
  const functionLabel =
    (typeof meta.function_label === 'string' && meta.function_label.trim()) ||
    (typeof script.goal === 'string' && script.goal.trim()) ||
    '';
  const shortLabelRaw =
    (typeof meta.short_label === 'string' && meta.short_label.trim()) ||
    functionLabel ||
    (title.includes('：') ? title.split('：')[0] : title);
  const shortLabel = String(shortLabelRaw || '').trim().slice(0, 8) || `S${uiId}`;

  const inferredDurationLimit =
    typeof durLimit === 'number' && Number.isFinite(durLimit) && durLimit > 0
      ? durLimit
      : shots.reduce((acc, s) => acc + (Number.isFinite(s.durationSeconds) ? s.durationSeconds : 0), 0);
  if (duration === '—' && inferredDurationLimit > 0) duration = `${inferredDurationLimit}s`;

  const firstShot = shots[0];
  const characters = asStringArray(firstShot?.manualCharacterRefs?.length ? firstShot.manualCharacterRefs : firstShot?.characterRefs);
  const scene = String(firstShot?.manualSceneRef || firstShot?.sceneRef || '').trim() || '—';
  const products = asStringArray(firstShot?.manualProductRefs?.length ? firstShot.manualProductRefs : firstShot?.productRefs);
  const placement = products.length ? products.join(' / ') : '—';

  return {
    id: uiId,
    backendRecordId: row.id,
    name: title,
    duration,
    durationLimit:
      typeof durLimit === 'number' && Number.isFinite(durLimit)
        ? durLimit
        : typeof durLimit === 'string' && Number.isFinite(Number(durLimit))
          ? Number(durLimit)
          : inferredDurationLimit,
    goal,
    segmentRole,
    productExposure: productExposure || placement,
    characters,
    scene,
    placement,
    color,
    isNew: false,
    shots,
    backendSegmentId: row.segment_id,
    functionLabel,
    shortLabel,
    videoUrl: segmentRowVideoUrl(row),
  };
}

export function finalVideoAvailabilityFromPipeline(pipeline: PipelineSummaryDto | null): {
  hasFinal: boolean;
  url: string | null;
} {
  if (!pipeline) return { hasFinal: false, url: null };
  const u = resolvePublicMediaUrl(pipeline.final_video_url);
  return { hasFinal: !!u, url: u };
}

export function stepFourVideoStatusFromSegments(segments: Step4SegmentItem[]): Step4VideoStatusMap {
  const m: Step4VideoStatusMap = {};
  for (const s of segments) {
    const has = !!resolvePublicMediaUrl(s.videoUrl);
    m[s.id] = has ? 'completed' : 'idle';
  }
  return m;
}

export type StepFourPipelineViewModel = {
  coreSegments: Step4SegmentItem[];
  videoStatusFromPipeline: Step4VideoStatusMap;
  canMergeAll: boolean;
  projectStatus: string;
  currentVideoStage?: string | null;
  hasAllSegmentVideos?: boolean;
  hasFinalVideo?: boolean;
  finalRenderStatus?: string | null;
  finalRenderError?: string | null;
  finalVideoUrl?: string | null;
};

/** 无 segment_scripts 时返回空 coreSegments，禁止用假片段冒充真实数据 */
export function pipelineToStepFourViewModel(pipeline: PipelineSummaryDto | null): StepFourPipelineViewModel {
  const effectiveStatus = String(
    pipeline?.project?.effective_status || pipeline?.project?.suggested_status || pipeline?.project?.status || '',
  ).trim();
  const rowsRaw = pipeline?.segment_scripts;
  const rows: SegmentScriptPipelineRowDto[] = Array.isArray(rowsRaw)
    ? rowsRaw.filter((r): r is SegmentScriptPipelineRowDto => r != null && typeof r === 'object' && 'segment_id' in r)
    : [];

  if (rows.length === 0) {
    return {
      coreSegments: [],
      videoStatusFromPipeline: {},
      canMergeAll: false,
      projectStatus: effectiveStatus,
      currentVideoStage: pipeline?.current_video_stage,
      hasAllSegmentVideos: pipeline?.has_all_segment_videos,
      hasFinalVideo: pipeline?.has_final_video,
      finalRenderStatus: pipeline?.final_render_status,
      finalRenderError: pipeline?.final_render_error,
      finalVideoUrl: pipeline?.final_video_url,
    };
  }

  const sorted = sortSegmentRows(rows);
  const coreSegments = sorted.map((row, index) => segmentScriptDtoToStepSegmentViewModel(row, index));

  const videoStatusFromPipeline = stepFourVideoStatusFromSegments(coreSegments);
  for (let i = 0; i < sorted.length; i += 1) {
    const row = sorted[i];
    const uiSegId = coreSegments[i]?.id;
    if (!uiSegId) continue;
    const st = String(row.render_status || '').toLowerCase();
    if ((coreSegments[i].videoUrl || '').trim()) {
      videoStatusFromPipeline[uiSegId] = 'completed';
      continue;
    }
    if (st === 'failed') videoStatusFromPipeline[uiSegId] = 'failed';
    else if (st === 'running') videoStatusFromPipeline[uiSegId] = 'running';
    else if (st === 'queued' || st === 'pending') videoStatusFromPipeline[uiSegId] = 'queued';
  }
  const allUrlsLocal =
    coreSegments.length > 0 && coreSegments.every((s) => !!resolvePublicMediaUrl(s.videoUrl));
  const canMergeAll =
    pipeline?.has_all_segment_videos === true || allUrlsLocal;

  return {
    coreSegments,
    videoStatusFromPipeline,
    canMergeAll,
    projectStatus: effectiveStatus,
    currentVideoStage: pipeline?.current_video_stage,
    hasAllSegmentVideos: pipeline?.has_all_segment_videos ?? allUrlsLocal,
    hasFinalVideo: pipeline?.has_final_video,
    finalRenderStatus: pipeline?.final_render_status,
    finalRenderError: pipeline?.final_render_error,
    finalVideoUrl: pipeline?.final_video_url,
  };
}

export function mergeVideoStatus(
  base: Step4VideoStatusMap,
  overrides: Partial<Record<number, Step4VideoStatus>>,
): Step4VideoStatusMap {
  const out: Step4VideoStatusMap = { ...base };
  for (const [key, val] of Object.entries(overrides)) {
    if (val !== undefined) out[Number(key)] = val;
  }
  return out;
}

/** True when segment videos were produced by dev mock (ffmpeg testsrc / legacy mock), not real provider output. */
export function pipelineUsesMockTestPatternVideo(pipeline: PipelineSummaryDto | null | undefined): boolean {
  const rows = pipeline?.segment_scripts;
  if (!Array.isArray(rows) || rows.length === 0) return false;
  for (const row of rows) {
    const vr = row.video_render;
    if (!vr || typeof vr !== 'object') continue;
    const o = vr as Record<string, unknown>;
    if (o.provider === 'mock') return true;
    const model = o.model;
    if (model === 'mock-ffmpeg' || model === 'mock-embedded-fallback') return true;
    const meta = o.meta;
    if (meta && typeof meta === 'object') {
      const m = (meta as Record<string, unknown>).model;
      if (m === 'mock-ffmpeg' || m === 'mock-embedded-fallback') return true;
    }
  }
  return false;
}
