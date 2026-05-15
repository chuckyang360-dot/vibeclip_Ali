import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SDWorkflowNav } from './components/SDWorkflowNav';
import { AssetLightbox, type LightboxItem } from './components/AssetLightbox';
import { AssetInteractionModal, type AssetEditorPayload, type AssetInteractionEntity, type AssetKind } from './components/AssetInteractionModal';
import { useEffectiveShortDramaProjectId } from './hooks/useEffectiveShortDramaProjectId';
import { ShortDramaApiError, analyzeShortDramaAssetReferenceImage, createShortDramaAssetFromImage, createShortDramaAssetLibrary, generateShortDramaAssetImages, generateShortDramaAssetSpecs, getShortDramaAssetLibraryDetail, getShortDramaPipeline, listShortDramaAssetLibrary, regenerateShortDramaAssetLibrary, touchShortDramaProjectStep, updateShortDramaAssetLibrary } from '@/services/shortDramaApi';
import type { AssetLibraryItemDto, PipelineSummaryDto, ShortDramaProjectDto } from '@/types/shortDramaApi';
import { getAssetThumbnailUrl, normalizeAssetDisplayName, resolveAssetImageUrl } from './utils/assetsPageAdapters';
import { withProjectQuery } from './utils/shortDramaRoutes';
import { buildRawStructureSnapshot, buildStructureSummary, resolveAssetRoleLabel, resolveAssetSourceLabel, resolveNarrativeFunctionLabel, resolveTypeFields, resolveVisualAnchorImageId } from './utils/assetSpecDisplay';
import { getCachedShortDramaPipeline, setCachedShortDramaPipeline } from './utils/shortDramaPipelineCache';

type TabType = 'characters' | 'scenes' | 'assets';
type Step3AutoPhase = 'idle' | 'checking' | 'generating_specs' | 'generating_images' | 'ready' | 'error';
type AddMode = 'text' | 'upload';
type AddDraft = { name: string; prompt: string };
const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const SUPPORTED_IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp';
const UNSUPPORTED_IMAGE_MESSAGE = '当前图片格式暂不支持，请上传 JPG、PNG 或 WebP 图片。';

const S3_ASSET_PIPELINE_STAGES = new Set(['s3_assets', 's3_images']);

function readProjectTaskRunning(project: ShortDramaProjectDto | undefined): boolean {
  if (!project) return false;
  if (typeof project.task_running === 'boolean') return project.task_running;
  return false;
}

function isS3AssetPipelineStage(stage: string): boolean {
  return S3_ASSET_PIPELINE_STAGES.has(stage.trim().toLowerCase());
}

function inferS3AssetGeneratingFromPipeline(params: {
  rawStatus: string;
  effectiveStatus: string;
  currentStage: string;
  projectTaskRunning: boolean;
  overallStatus: string;
}): boolean {
  const raw = params.rawStatus.trim().toLowerCase();
  const eff = params.effectiveStatus.trim().toLowerCase();
  const stage = params.currentStage.trim().toLowerCase();
  const s3 = isS3AssetPipelineStage(stage);
  const overall = params.overallStatus.trim().toLowerCase();
  if (eff === 'assets_rendering') return true;
  if (params.projectTaskRunning && s3) return true;
  if (s3 && (raw === 'processing' || eff === 'processing')) return true;
  if (overall === 'generating' && s3) return true;
  return false;
}

function failedStageLooksLikeS3Assets(failedStage: string): boolean {
  const s = failedStage.trim().toLowerCase();
  if (!s) return false;
  if (s.includes('s4')) return false;
  return isS3AssetPipelineStage(s) || s.includes('s3_assets') || s.includes('s3_images') || (s.includes('s3') && s.includes('asset'));
}

/**
 * S3 资产网格区 UI：仅此函数决策 waiting / ready / empty / failed，优先级固定。
 * 1) 当前 tab 有行 → ready
 * 2) 已确认 pipeline 失败 → failed
 * 3) 后端真实 S3 任务或用户触发生成后 → waiting
 * 4) 其余 → empty（可手动触发生成，不用本地推断伪装成生成中）
 */
export type S3AssetGridUiState = 'waiting' | 'ready' | 'empty' | 'failed';

export function getS3AssetUiState(input: {
  currentTabRowCount: number;
  confirmedS3PipelineFailure: boolean;
  workInProgress: boolean;
}): S3AssetGridUiState {
  if (input.currentTabRowCount > 0) return 'ready';
  if (input.confirmedS3PipelineFailure) return 'failed';
  if (input.workInProgress) return 'waiting';
  return 'empty';
}

/** 轮询与资产卡封面「生成中」：仅供数据刷新与行内封面态，不参与网格四态分支。 */
function computeS3PipelineWorkInProgress(input: {
  listedAssetTotal: number;
  pipelineAssetRowsTotal: number;
  pipelineRawStatus: string;
  pipelineEffectiveStatus: string;
  pipelineCurrentStage: string;
  pipelineTaskRunning: boolean;
  pipelineOverallStatus: string;
  autoPhase: Step3AutoPhase;
}): boolean {
  const pipelineGen = inferS3AssetGeneratingFromPipeline({
    rawStatus: input.pipelineRawStatus,
    effectiveStatus: input.pipelineEffectiveStatus,
    currentStage: input.pipelineCurrentStage,
    projectTaskRunning: input.pipelineTaskRunning,
    overallStatus: input.pipelineOverallStatus,
  });
  const listed0 = input.listedAssetTotal === 0;
  const autoBootstrap =
    listed0
    && (input.autoPhase === 'checking' || input.autoPhase === 'generating_specs' || input.autoPhase === 'generating_images');
  const listSyncHint =
    listed0
    && input.pipelineAssetRowsTotal > 0
    && (input.pipelineRawStatus.trim().toLowerCase() === 'processing'
      || input.pipelineEffectiveStatus.trim().toLowerCase() === 'processing');
  return pipelineGen || autoBootstrap || listSyncHint;
}

function isS3AutoRequestPhase(phase: Step3AutoPhase): boolean {
  return phase === 'checking' || phase === 'generating_specs' || phase === 'generating_images';
}

/** 连续 pipeline 快照均满足时才累计 streak；与 computeS3PipelineWorkInProgress 互斥，避免误判 */
const S3_PIPELINE_FAILURE_STREAK_THRESHOLD = 3;

function isS3PipelineFailureStreakCandidate(params: {
  listedAssetTotal: number;
  pipelineAssetRowsTotal: number;
  pipelineTaskRunning: boolean;
  pipelineFailedStage: string;
  pipelineRawStatus: string;
  pipelineEffectiveStatus: string;
  pipelineCurrentStage: string;
  pipelineOverallStatus: string;
  pipelineStepStatus: Record<string, string>;
}): boolean {
  if (params.listedAssetTotal > 0 || params.pipelineAssetRowsTotal > 0) return false;
  if (params.pipelineTaskRunning) return false;
  if (!failedStageLooksLikeS3Assets(params.pipelineFailedStage)) return false;
  const raw = params.pipelineRawStatus.trim().toLowerCase();
  const eff = params.pipelineEffectiveStatus.trim().toLowerCase();
  const step3Failed =
    String(params.pipelineStepStatus.step_3 || '').toLowerCase() === 'failed'
    || String(params.pipelineStepStatus.assets || '').toLowerCase() === 'failed';
  const statusFailed = raw === 'failed' || eff === 'failed';
  if (!statusFailed && !step3Failed) return false;
  if (
    inferS3AssetGeneratingFromPipeline({
      rawStatus: params.pipelineRawStatus,
      effectiveStatus: params.pipelineEffectiveStatus,
      currentStage: params.pipelineCurrentStage,
      projectTaskRunning: params.pipelineTaskRunning,
      overallStatus: params.pipelineOverallStatus,
    })
  ) {
    return false;
  }
  return true;
}

function bumpS3PipelineFailureStreak(
  p: PipelineSummaryDto,
  listedTotal: number,
  streakRef: { current: number },
  setConfirmed: (v: boolean) => void,
  confirmedRef: { current: boolean },
): void {
  const rows = Number(p.asset_rows_total || 0);
  const taskRunning = readProjectTaskRunning(p.project);
  const failedStage = String(p.project?.failed_stage || '');
  const raw = String(p.project?.status || '');
  const eff = String(p.project?.effective_status || p.project?.suggested_status || p.project?.status || '');
  const stage = String(p.project?.current_stage || '');
  const overall = String(p.project?.overall_status || '');
  const stepStatus = (p.project?.step_status || {}) as Record<string, string>;
  if (listedTotal > 0 || rows > 0 || taskRunning) {
    streakRef.current = 0;
    confirmedRef.current = false;
    setConfirmed(false);
    return;
  }
  const candidate = isS3PipelineFailureStreakCandidate({
    listedAssetTotal: listedTotal,
    pipelineAssetRowsTotal: rows,
    pipelineTaskRunning: taskRunning,
    pipelineFailedStage: failedStage,
    pipelineRawStatus: raw,
    pipelineEffectiveStatus: eff,
    pipelineCurrentStage: stage,
    pipelineOverallStatus: overall,
    pipelineStepStatus: stepStatus,
  });
  if (candidate) {
    streakRef.current += 1;
    if (streakRef.current >= S3_PIPELINE_FAILURE_STREAK_THRESHOLD) {
      confirmedRef.current = true;
      setConfirmed(true);
    }
  } else {
    streakRef.current = 0;
    confirmedRef.current = false;
    setConfirmed(false);
  }
}

function shouldContinuePipelinePolling(
  p: PipelineSummaryDto,
  opts: {
    listedTotalRef: { current: number };
    autoPhaseRef: { current: Step3AutoPhase };
    confirmedFailureRef: { current: boolean };
  },
): boolean {
  const listed = opts.listedTotalRef.current;
  const rows = Number(p.asset_rows_total || 0);
  const snap = {
    rawStatus: String(p.project?.status || ''),
    effectiveStatus: String(p.project?.effective_status || p.project?.suggested_status || p.project?.status || ''),
    currentStage: String(p.project?.current_stage || ''),
    projectTaskRunning: readProjectTaskRunning(p.project),
    overallStatus: String(p.project?.overall_status || ''),
  };
  if (inferS3AssetGeneratingFromPipeline(snap)) return true;
  if (listed === 0 && rows > 0) {
    const rawLo = snap.rawStatus.trim().toLowerCase();
    const effLo = snap.effectiveStatus.trim().toLowerCase();
    if (rawLo === 'processing' || effLo === 'processing') return true;
  }
  const ap = opts.autoPhaseRef.current;
  if (listed === 0 && (ap === 'checking' || ap === 'generating_specs' || ap === 'generating_images')) return true;
  if (opts.confirmedFailureRef.current) return false;
  if (listed > 0 || rows > 0) return false;
  if (readProjectTaskRunning(p.project)) return false;
  const failedStage = String(p.project?.failed_stage || '');
  if (!failedStageLooksLikeS3Assets(failedStage)) return false;
  const rawLo = snap.rawStatus.trim().toLowerCase();
  const effLo = snap.effectiveStatus.trim().toLowerCase();
  const step = (p.project?.step_status || {}) as Record<string, string>;
  const stepFail =
    String(step.step_3 || '').toLowerCase() === 'failed'
    || String(step.assets || '').toLowerCase() === 'failed';
  if (!(rawLo === 'failed' || effLo === 'failed' || stepFail)) return false;
  if (inferS3AssetGeneratingFromPipeline(snap)) return false;
  return true;
}

const toKind = (assetType: string): AssetKind => (assetType === 'scene' ? 'scene' : assetType === 'product' ? 'product' : 'character');
const tabToKind = (tab: TabType): AssetKind => (tab === 'scenes' ? 'scene' : tab === 'assets' ? 'product' : 'character');
const fallbackNameByTab: Record<TabType, string> = {
  characters: 'Character Asset',
  scenes: 'Scene Asset',
  assets: 'Product Asset',
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === '[object Object]';
}

function sanitizeJsonSafe(value: unknown): unknown {
  if (value == null) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    const arr = value.map((x) => sanitizeJsonSafe(x)).filter((x) => x !== undefined);
    return arr;
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      const cleaned = sanitizeJsonSafe(v);
      if (cleaned !== undefined) out[k] = cleaned;
    }
    return out;
  }
  return String(value);
}

function sanitizePatchPayload(body: {
  project_id: number;
  name?: string;
  description?: string;
  tags?: string[];
  base_prompt?: string;
  type_fields?: Record<string, unknown>;
}) {
  const out: {
    project_id: number;
    name?: string;
    description?: string;
    tags?: string[];
    base_prompt?: string;
    type_fields?: Record<string, unknown>;
  } = { project_id: body.project_id };
  if (typeof body.name === 'string') out.name = body.name.trim();
  if (typeof body.description === 'string') out.description = body.description.trim();
  if (Array.isArray(body.tags)) {
    const tags = body.tags.map((x) => String(x).trim()).filter(Boolean);
    if (tags.length) out.tags = tags;
  }
  if (typeof body.base_prompt === 'string') out.base_prompt = body.base_prompt.trim();
  if (body.type_fields && isPlainObject(body.type_fields)) {
    const cleaned = sanitizeJsonSafe(body.type_fields);
    if (cleaned && isPlainObject(cleaned)) out.type_fields = cleaned;
  }
  if (!out.base_prompt) out.base_prompt = out.description || '';
  return out;
}

function logPatchFailure(tag: '[S3_PATCH_SAVE_FAILED]' | '[S3_PATCH_REGENERATE_FAILED]', assetId: number, payload: unknown, error: unknown) {
  const e = error as { name?: unknown; message?: unknown; status?: unknown; detail?: unknown; response?: unknown };
  console.error(tag, {
    asset_id: assetId,
    payload_json: JSON.stringify(payload, null, 2),
    error_name: typeof e?.name === 'string' ? e.name : undefined,
    error_message: typeof e?.message === 'string' ? e.message : String(error),
    error_status: e?.status,
    error_detail: e?.detail,
    error_response: e?.response,
  });
}

function sanitizeAssetName(input: string): string {
  const blocked = new Set(['新增角色', '添加角色', '新增场景', '添加场景', '新增产品', '添加产品']);
  const trimmed = input.trim();
  return blocked.has(trimmed) ? '' : trimmed;
}

const SCENE_PLOT_STATE_TERMS = [
  'struggle',
  'conflict',
  'flashback',
  'energized',
  'workout',
  'failure',
  'comeback',
  'angry',
  'moment',
  'training',
  '挣扎',
  '冲突',
  '闪回',
  '回忆',
  '训练',
  '失败',
  '逆袭',
  '情绪',
];

function displayAssetName(row: AssetLibraryItemDto): string {
  const finalize = (inner: string) => {
    const t = String(inner || '').trim();
    const n = normalizeAssetDisplayName(t);
    return n || t;
  };
  if (row.asset_type !== 'scene') return finalize(normalizeSceneDisplayName(row.name));
  const identity = row.extra && typeof row.extra === 'object' ? (row.extra as Record<string, unknown>).location_identity || (row.extra as Record<string, unknown>).asset_identity : null;
  if (typeof identity === 'string' && identity.trim()) return finalize(identity.trim());
  let out = row.name || '';
  for (const term of SCENE_PLOT_STATE_TERMS) {
    out = out.replace(new RegExp(`\\b${term}\\b`, 'gi'), ' ').replace(new RegExp(term, 'g'), ' ');
  }
  out = out.replace(/\s+/g, ' ').trim();
  if (/home\s+gym/i.test(`${row.name} ${row.description ?? ''}`) || `${row.name} ${row.description ?? ''}`.includes('健身房')) return finalize('家庭健身房');
  return finalize(normalizeSceneDisplayName(out || '场景'));
}

function assetCoverImageClass(row: AssetLibraryItemDto): string {
  if (row.asset_type === 'character') {
    return 'h-full w-full object-cover object-top';
  }
  return 'h-full w-full object-cover object-center';
}

function normalizeSceneDisplayName(name: string): string {
  const raw = String(name || '').trim();
  if (!raw) return '场景';
  const key = raw.toLowerCase();
  const fallbackMap: Record<string, string> = {
    bedroom: '卧室',
    'home gym': '家庭健身房',
    kitchen: '厨房',
    office: '办公室',
    street: '街道',
    park: '公园',
  };
  return fallbackMap[key] || raw;
}

function activeRenderableImages(row: AssetLibraryItemDto) {
  return (row.images ?? [])
    .filter((img) => String(img.status || 'active').toLowerCase() === 'active')
    .map((img) => {
      const resolvedUrl = resolveAssetImageUrl(img.image_url).src;
      return resolvedUrl ? { ...img, resolvedUrl } : null;
    })
    .filter((img): img is NonNullable<typeof img> => img !== null);
}

function toPositiveInt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value;
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value);
    if (Number.isInteger(n) && n > 0) return n;
  }
  return null;
}

function assetLibraryTypeForTab(tab: TabType): AssetKind {
  return tab === 'characters' ? 'character' : tab === 'scenes' ? 'scene' : 'product';
}

function promptForImageGeneration(row: AssetLibraryItemDto): string {
  const tf = resolveTypeFields(row);
  return String(
    row.base_prompt ||
    tf.image_prompt ||
    tf.prompt ||
    tf.generation_prompt ||
    tf.visual_prompt ||
    row.description ||
    '',
  ).trim();
}

function legacySourceAssetId(row: AssetLibraryItemDto): number | null {
  const legacy = row.extra?.legacy_source;
  if (!legacy || typeof legacy !== 'object') return null;
  return toPositiveInt((legacy as Record<string, unknown>).table_asset_id);
}

function extractFailedAssetIds(errors: Record<string, unknown>[] | undefined): Set<number> {
  const ids = new Set<number>();
  for (const err of errors ?? []) {
    const assetId = toPositiveInt(err.asset_id ?? err.assetId ?? err.id);
    if (assetId != null) ids.add(assetId);
  }
  return ids;
}

function pipelineHasS2AssetGenerationSpecs(pipeline: PipelineSummaryDto): boolean {
  const directCount = pipeline.asset_generation_specs_count;
  if (typeof directCount === 'number') return directCount > 0;
  if (pipeline.has_asset_generation_specs === true) return true;
  const specs = pipeline.story_blueprint?.blueprint?.asset_generation_specs;
  return Array.isArray(specs) && specs.length > 0;
}

function assetImageGenerationFailed(row: AssetLibraryItemDto): boolean {
  const extra = row.extra && typeof row.extra === 'object' ? row.extra as Record<string, unknown> : {};
  const tf = extra.type_fields && typeof extra.type_fields === 'object' ? extra.type_fields as Record<string, unknown> : {};
  const failedInMeta =
    String(extra.image_generation_status || '').toLowerCase() === 'failed'
    || String(tf.image_generation_status || '').toLowerCase() === 'failed';
  const failedImageRow = (row.images ?? []).some((img) => String(img.status || '').toLowerCase() === 'failed');
  return failedInMeta || failedImageRow;
}

function assetImageGenerationStatus(row: AssetLibraryItemDto): string {
  const extra = row.extra && typeof row.extra === 'object' ? row.extra as Record<string, unknown> : {};
  const tf = extra.type_fields && typeof extra.type_fields === 'object' ? extra.type_fields as Record<string, unknown> : {};
  return String(extra.image_generation_status || tf.image_generation_status || '').trim().toLowerCase();
}

function normalizeLibraryItem(row: AssetLibraryItemDto): AssetLibraryItemDto | null {
  const id = toPositiveInt((row as unknown as { id?: unknown }).id);
  if (id == null) {
    console.error('[S3_ASSET_INVALID_ROW_ID]', { row });
    return null;
  }
  return {
    ...row,
    id,
    cover_image_id: toPositiveInt((row as unknown as { cover_image_id?: unknown }).cover_image_id) ?? null,
    image_count: toPositiveInt((row as unknown as { image_count?: unknown }).image_count) ?? 0,
    tags: Array.isArray(row.tags) ? row.tags.filter((x): x is string => typeof x === 'string') : [],
    extra: (row.extra && typeof row.extra === 'object') ? row.extra : {},
    images: (row.images ?? [])
      .map((img) => {
        const imageId = toPositiveInt((img as unknown as { id?: unknown }).id);
        if (imageId == null) return null;
        return { ...img, id: imageId };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null),
    reference_images: (row.reference_images ?? [])
      .map((img) => {
        const imageId = toPositiveInt((img as unknown as { id?: unknown }).id);
        if (imageId == null) return null;
        return { ...img, id: imageId };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null),
  };
}

function appendS3Debug(event: string, payload: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  const w = window as Window & { __S3_DEBUG__?: Array<{ event: string; payload: Record<string, unknown> }> };
  if (!w.__S3_DEBUG__) w.__S3_DEBUG__ = [];
  w.__S3_DEBUG__.push({ event, payload });
}

function toReadableErrorMessage(error: unknown, fallback: string): string {
  const looksLikeTraceback = (value: string) => /Traceback \(most recent call last\)|File ".+\.py"|[\r\n]\s*at\s+/i.test(value);
  if (error instanceof ShortDramaApiError) {
    const detail = error.detail;
    if (error.status === 429 && detail && typeof detail === 'object') {
      const d = detail as { error?: unknown; detail?: unknown };
      if (d.error === 'XAI_IMAGE_QUOTA_EXHAUSTED' && typeof d.detail === 'string' && d.detail.trim()) {
        return d.detail.trim();
      }
    }
    if (error.message && !looksLikeTraceback(error.message)) return error.message;
    return fallback;
  }
  if (error instanceof Error && error.message && !looksLikeTraceback(error.message)) return error.message;
  return fallback;
}

function toDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error('文件读取失败'));
    r.onload = () => resolve(typeof r.result === 'string' ? r.result : '');
    r.readAsDataURL(file);
  });
}

function isSupportedImageType(file: File): boolean {
  return SUPPORTED_IMAGE_TYPES.has(String(file.type || '').toLowerCase());
}

function extractSemanticTokens(text: string): string[] {
  if (!text) return [];
  const zh = (text.match(/[\u4e00-\u9fff]{2,}/g) ?? []).map((x) => x.toLowerCase());
  const en = (text.toLowerCase().match(/[a-z][a-z0-9_-]{3,}/g) ?? []).map((x) => x.toLowerCase());
  return Array.from(new Set([...zh, ...en]));
}

function warnAssetDetailMismatch(row: AssetLibraryItemDto): void {
  const textCorpus = `${row.name || ''} ${row.description || ''} ${row.base_prompt || ''}`.trim();
  const imageCorpus = [
    ...(row.images ?? []).flatMap((img) => [img.image_url || '', img.prompt_snapshot || '']),
    ...(row.reference_images ?? []).flatMap((img) => [img.file_url || '', img.file_name || '']),
  ]
    .join(' ')
    .toLowerCase();
  const textTokens = extractSemanticTokens(textCorpus);
  if (!textTokens.length) return;
  const overlap = textTokens.filter((t) => imageCorpus.includes(t));
  if (!overlap.length) {
    console.warn('[ASSET_DETAIL_MISMATCH_WARNING]', {
      asset_id: row.id,
      project_id: row.project_id,
      asset_type: row.asset_type,
      name: row.name,
      description: row.description,
      text_tokens: textTokens.slice(0, 20),
      image_sample: imageCorpus.slice(0, 280),
    });
  }
}

export function ShortDramaAssetsPage() {
  const navigate = useNavigate();
  const { effectiveProjectId, projectName } = useEffectiveShortDramaProjectId();
  const [activeTab, setActiveTab] = useState<TabType>('characters');
  const [data, setData] = useState<Record<TabType, AssetLibraryItemDto[]>>({ characters: [], scenes: [], assets: [] });
  const [initialLoading, setInitialLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<AssetInteractionEntity | null>(null);
  const [lightbox, setLightbox] = useState<LightboxItem | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [addMode, setAddMode] = useState<AddMode>('text');
  const [draft, setDraft] = useState<AddDraft>({ name: '', prompt: '' });
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [addPending, setAddPending] = useState<{ tab: TabType; mode: AddMode } | null>(null);
  const [working, setWorking] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [autoPhase, setAutoPhase] = useState<Step3AutoPhase>('idle');
  const [, setAutoHint] = useState<string | null>(null);
  const [pipelineEffectiveStatus, setPipelineEffectiveStatus] = useState<string>('');
  const [pipelineRawStatus, setPipelineRawStatus] = useState<string>('');
  const [pipelineOverallStatus, setPipelineOverallStatus] = useState<string>('');
  const [pipelineCurrentStage, setPipelineCurrentStage] = useState<string>('');
  const [pipelineTaskRunning, setPipelineTaskRunning] = useState(false);
  const [pipelineFailedStage, setPipelineFailedStage] = useState('');
  const [pipelineAssetRowsTotal, setPipelineAssetRowsTotal] = useState(0);
  const [pipelineImageUrlFilled, setPipelineImageUrlFilled] = useState(0);
  const [pipelineStepStatus, setPipelineStepStatus] = useState<Record<string, string>>({});
  const [pipelineHasStoryBlueprint, setPipelineHasStoryBlueprint] = useState(false);
  const [pipelineHasAssetGenerationSpecs, setPipelineHasAssetGenerationSpecs] = useState(false);
  const [imageLoadFailedIds, setImageLoadFailedIds] = useState<Set<number>>(() => new Set());
  const [imageGenerationFailedIds, setImageGenerationFailedIds] = useState<Set<number>>(() => new Set());
  const [generatingImageAssetIds, setGeneratingImageAssetIds] = useState<Set<number>>(() => new Set());
  const [analyzingAssetIds, setAnalyzingAssetIds] = useState<Set<number>>(() => new Set());
  const [isDirty, setIsDirty] = useState(false);
  const refUploadInput = useRef<HTMLInputElement>(null);
  const refTargetAssetId = useRef<number | null>(null);
  const uploadPickerRef = useRef<HTMLInputElement>(null);
  const autoRunProjectRef = useRef<number | null>(null);
  const pipelinePollFailureRef = useRef(0);
  const pipelinePollAbortRef = useRef<AbortController | null>(null);
  const pipelinePollIntervalRef = useRef(0);
  /** 连续若干次 pipeline 快照均满足「S3 资产阶段失败候选」才展示失败卡，避免短暂 failed 误判 */
  const s3FailureStreakRef = useRef(0);
  const [confirmedS3PipelineFailure, setConfirmedS3PipelineFailure] = useState(false);
  const listedAssetTotalRef = useRef(0);
  const confirmedS3PipelineFailureRef = useRef(false);
  const autoPhaseRef = useRef<Step3AutoPhase>(autoPhase);
  useEffect(() => {
    autoPhaseRef.current = autoPhase;
  }, [autoPhase]);
  useEffect(() => {
    confirmedS3PipelineFailureRef.current = confirmedS3PipelineFailure;
  }, [confirmedS3PipelineFailure]);
  useEffect(() => {
    if (!toPositiveInt(effectiveProjectId)) return;
    s3FailureStreakRef.current = 0;
    confirmedS3PipelineFailureRef.current = false;
    setConfirmedS3PipelineFailure(false);
    setPipelineHasAssetGenerationSpecs(false);
  }, [effectiveProjectId]);

  const hasVisibleAssets = useMemo(
    () => data.characters.length > 0 || data.scenes.length > 0 || data.assets.length > 0,
    [data],
  );

  const reload = useCallback(async (opts?: { background?: boolean; reason?: string }) => {
    if (!effectiveProjectId) return;
    const background = opts?.background ?? true;
    console.info('[S3_RELOAD]', {
      projectId: effectiveProjectId,
      reason: opts?.reason ?? 'unspecified',
      background,
      lightweight: false,
    });
    if (!background) setInitialLoading(true);
    setError(null);
    try {
      const [characters, scenes, products] = await Promise.all([
        listShortDramaAssetLibrary(effectiveProjectId, 'character'),
        listShortDramaAssetLibrary(effectiveProjectId, 'scene'),
        listShortDramaAssetLibrary(effectiveProjectId, 'product'),
      ]);
      const nextData = {
        characters: characters.assets.map(normalizeLibraryItem).filter((x): x is AssetLibraryItemDto => x !== null),
        scenes: scenes.assets.map(normalizeLibraryItem).filter((x): x is AssetLibraryItemDto => x !== null),
        assets: products.assets.map(normalizeLibraryItem).filter((x): x is AssetLibraryItemDto => x !== null),
      };
      const total = nextData.characters.length + nextData.scenes.length + nextData.assets.length;
      listedAssetTotalRef.current = total;
      if (total > 0) {
        s3FailureStreakRef.current = 0;
        confirmedS3PipelineFailureRef.current = false;
        setConfirmedS3PipelineFailure(false);
      }
      setData(nextData);
      setImageLoadFailedIds(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      if (!background) setInitialLoading(false);
    }
  }, [effectiveProjectId]);

  const applyPipelineSnapshot = useCallback((p: PipelineSummaryDto) => {
    const pr = p.project;
    setPipelineEffectiveStatus(String(pr?.effective_status || pr?.suggested_status || pr?.status || ''));
    setPipelineRawStatus(String(pr?.status || ''));
    setPipelineOverallStatus(String(pr?.overall_status || ''));
    setPipelineStepStatus((pr?.step_status || {}) as Record<string, string>);
    setPipelineCurrentStage(String(pr?.current_stage || ''));
    setPipelineTaskRunning(readProjectTaskRunning(pr));
    setPipelineFailedStage(String(pr?.failed_stage || ''));
    setPipelineAssetRowsTotal(Number(p.asset_rows_total || 0));
    setPipelineImageUrlFilled(Number(p.image_url_filled || 0));
    setPipelineHasStoryBlueprint(Boolean(p.has_story_blueprint));
    const hasAssetGenerationSpecs = pipelineHasS2AssetGenerationSpecs(p);
    setPipelineHasAssetGenerationSpecs((prev) => prev || hasAssetGenerationSpecs);
  }, []);

  useEffect(() => {
    const projectId = toPositiveInt(effectiveProjectId);
    if (!projectId) return;
    const cached = getCachedShortDramaPipeline(projectId);
    if (!cached) {
      console.info('[CACHE_PIPELINE_MISS]', { projectId, sourcePage: 'step3' });
      if (!hasVisibleAssets) setInitialLoading(true);
      return;
    }
    console.info('[CACHE_PIPELINE_HIT]', { projectId, sourcePage: 'step3' });
    setInitialLoading(false);
    applyPipelineSnapshot(cached);
  }, [effectiveProjectId, applyPipelineSnapshot, hasVisibleAssets]);

  useEffect(() => {
    const run = async () => {
      const projectId = toPositiveInt(effectiveProjectId);
      console.info('[S3_AUTO_EFFECT_ENTER]', JSON.stringify({
        effective_project_id: effectiveProjectId,
        effective_project_id_type: typeof effectiveProjectId,
        normalized_project_id: projectId,
      }));
      if (!projectId) return;
      if (autoRunProjectRef.current === projectId) return;
      autoRunProjectRef.current = projectId;
      setAutoPhase('checking');
      setAutoHint('正在检查资产生成状态…');
      try {
        console.info('[S3_AUTO_PIPELINE_REQUEST]', JSON.stringify({ project_id: projectId }));
        const startedAt = performance.now();
        const pipeline = await getShortDramaPipeline(projectId);
        setCachedShortDramaPipeline(projectId, pipeline);
        console.info('[CACHE_PIPELINE_REFRESH_SUCCESS]', { projectId, sourcePage: 'step3', durationMs: Math.round(performance.now() - startedAt) });
        setInitialLoading(false);
        applyPipelineSnapshot(pipeline);
        console.info('[S3_EFFECTIVE_STATUS_CHECK]', {
          project_id: projectId,
          status: String(pipeline.project?.status || ''),
          effective_status: String(pipeline.project?.effective_status || pipeline.project?.suggested_status || pipeline.project?.status || ''),
          current_stage: String(pipeline.project?.current_stage || ''),
          status_recoverable: Boolean(pipeline.project?.status_recoverable),
          asset_rows_total: pipeline.asset_rows_total ?? null,
          image_url_filled: pipeline.image_url_filled ?? null,
        });
        const effectiveStatus = String(
          pipeline.project?.effective_status || pipeline.project?.suggested_status || pipeline.project?.status || '',
        );
        const assetRowsTotal = Number(pipeline.asset_rows_total || 0);
        const imageUrlFilled = Number(pipeline.image_url_filled || 0);
        const hasS2AssetSpecs = pipelineHasS2AssetGenerationSpecs(pipeline);
        console.info('[S3_AUTO_FLOW_CHECK]', JSON.stringify({
          project_id: projectId,
          project_status: pipeline.project.status,
          effective_status: effectiveStatus,
          asset_rows_total: pipeline.asset_rows_total ?? null,
          image_url_filled: pipeline.image_url_filled ?? null,
          has_s2_asset_generation_specs: hasS2AssetSpecs,
        }));
        if (assetRowsTotal === 0 && hasS2AssetSpecs) {
          setAutoPhase('generating_images');
          setAutoHint('正在生成资产，请稍候…');
          console.info('[S3_AUTO_TRIGGER_ASSETS]', JSON.stringify({ project_id: projectId }));
          try {
            const result = await generateShortDramaAssetSpecs(projectId, { trigger: 'auto' });
            setImageGenerationFailedIds(extractFailedAssetIds(result.image_generation?.errors));
            let nextPipeline = await getShortDramaPipeline(projectId);
            setCachedShortDramaPipeline(projectId, nextPipeline);
            applyPipelineSnapshot(nextPipeline);
            await reload({ background: true, reason: 'auto_assets_generated' });

            const rowsAfterSpecs = Number(nextPipeline.asset_rows_total || 0);
            const imagesAfterSpecs = Number(nextPipeline.image_url_filled || 0);
            if (rowsAfterSpecs > 0 && imagesAfterSpecs < rowsAfterSpecs) {
              console.info('[S3_AUTO_TRIGGER_IMAGES_AFTER_SPECS]', JSON.stringify({
                project_id: projectId,
                asset_rows_total: rowsAfterSpecs,
                image_url_filled: imagesAfterSpecs,
              }));
              const imageResult = await generateShortDramaAssetImages(projectId);
              setImageGenerationFailedIds(extractFailedAssetIds(imageResult.errors));
              nextPipeline = await getShortDramaPipeline(projectId);
              setCachedShortDramaPipeline(projectId, nextPipeline);
              applyPipelineSnapshot(nextPipeline);
              await reload({ background: true, reason: 'auto_images_after_specs_generated' });
            }
            setAutoPhase('ready');
            setAutoHint(null);
          } catch (e) {
            console.error('[S3_AUTO_ASSET_GENERATION_FAILED]', { project_id: projectId, error: e });
            setAutoPhase('error');
            setAutoHint('资产图片生成失败，请稍后重试');
            setError('资产图片生成失败，请稍后重试');
            await reload({ background: true, reason: 'auto_assets_error' });
          }
          return;
        }

        if (assetRowsTotal > 0 && imageUrlFilled < assetRowsTotal) {
          setAutoPhase('generating_images');
          setAutoHint('正在生成资产图片，请稍候…');
          console.info('[S3_AUTO_TRIGGER_MISSING_IMAGES]', JSON.stringify({
            project_id: projectId,
            asset_rows_total: assetRowsTotal,
            image_url_filled: imageUrlFilled,
          }));
          try {
            const imageResult = await generateShortDramaAssetImages(projectId);
            setImageGenerationFailedIds(extractFailedAssetIds(imageResult.errors));
            const nextPipeline = await getShortDramaPipeline(projectId);
            setCachedShortDramaPipeline(projectId, nextPipeline);
            applyPipelineSnapshot(nextPipeline);
            await reload({ background: true, reason: 'auto_missing_images_generated' });
            setAutoPhase('ready');
            setAutoHint(null);
          } catch (e) {
            console.error('[S3_AUTO_MISSING_IMAGES_FAILED]', { project_id: projectId, error: e });
            setAutoPhase('error');
            setAutoHint('资产图片生成失败，请稍后重试');
            setError('资产图片生成失败，请稍后重试');
            await reload({ background: true, reason: 'auto_missing_images_error' });
          }
          return;
        }

        if (assetRowsTotal > 0 && imageUrlFilled >= assetRowsTotal) {
          await reload({ background: true, reason: 'auto_assets_already_ready' });
          setAutoPhase('ready');
          setAutoHint(null);
          return;
        }

        let pipelineAfterSpecs = await getShortDramaPipeline(projectId);
        setCachedShortDramaPipeline(projectId, pipelineAfterSpecs);
        applyPipelineSnapshot(pipelineAfterSpecs);
        const effectiveAfterSpecs = String(
          pipelineAfterSpecs.project?.effective_status || pipelineAfterSpecs.project?.suggested_status || pipelineAfterSpecs.project?.status || '',
        );
        if (effectiveAfterSpecs === 'asset_specs_generated') {
          setAutoPhase('generating_images');
          setAutoHint('正在生成资产图片，请稍候…');
          console.info('[S3_AUTO_TRIGGER_IMAGES]', JSON.stringify({ project_id: projectId }));
          const imageResult = await generateShortDramaAssetImages(projectId);
          setImageGenerationFailedIds(extractFailedAssetIds(imageResult.errors));
          pipelineAfterSpecs = await getShortDramaPipeline(projectId);
          setCachedShortDramaPipeline(projectId, pipelineAfterSpecs);
          applyPipelineSnapshot(pipelineAfterSpecs);
        }

        const effectiveAfterImages = String(
          pipelineAfterSpecs.project?.effective_status || pipelineAfterSpecs.project?.suggested_status || pipelineAfterSpecs.project?.status || '',
        );
        const stageAfterImages = String(pipelineAfterSpecs.project?.current_stage || '');
        if (effectiveAfterImages === 'assets_rendering' || (effectiveAfterImages === 'processing' && isS3AssetPipelineStage(stageAfterImages))) {
          setAutoPhase('generating_images');
          setAutoHint('资产图片生成中，正在同步进度…');
        }

        await reload({ background: true, reason: 'auto_flow' });
        if (effectiveAfterImages === 'assets_rendering' || (effectiveAfterImages === 'processing' && isS3AssetPipelineStage(stageAfterImages))) {
          setAutoPhase('generating_images');
        } else {
          setAutoPhase('ready');
        }
        setAutoHint(null);
      } catch (e) {
        console.error('[S3_AUTO_FLOW_FAILED]', {
          project_id: projectId,
          error: e,
        });
        setAutoPhase('error');
        setAutoHint('资产图片生成失败，请稍后重试');
        setError('资产图片生成失败，请稍后重试');
        s3FailureStreakRef.current = 0;
        confirmedS3PipelineFailureRef.current = false;
        setConfirmedS3PipelineFailure(false);
        await reload({ background: true, reason: 'auto_flow_error_fallback' });
      } finally {
        if (autoRunProjectRef.current === projectId) autoRunProjectRef.current = null;
      }
    };
    void run();
  }, [effectiveProjectId, reload, applyPipelineSnapshot]);

  const openDetail = useCallback(async (rawAssetId: unknown, cardRow?: AssetLibraryItemDto) => {
    const projectId = toPositiveInt(effectiveProjectId);
    const assetId = toPositiveInt(rawAssetId);
    const openCtx = {
      card_row: cardRow,
      open_detail_arg: rawAssetId,
      open_detail_arg_type: typeof rawAssetId,
      normalized_asset_id: assetId,
      normalized_asset_id_type: typeof assetId,
      effective_project_id: effectiveProjectId,
      effective_project_id_type: typeof effectiveProjectId,
      normalized_project_id: projectId,
      normalized_project_id_type: typeof projectId,
    };
    console.info('[S3_DETAIL_OPEN_CLICKED]', JSON.stringify(openCtx));
    appendS3Debug('S3_DETAIL_OPEN_CLICKED', openCtx);
    if (projectId == null || assetId == null) {
      console.error('[S3_DETAIL_OPEN_INVALID_IDS]', { rawAssetId, effectiveProjectId, cardRow });
      window.alert('资产详情加载失败，请重试');
      return;
    }
    const requestUrl = `/api/short-drama/assets/specs/library/detail/${assetId}?project_id=${projectId}`;
    console.info('[S3_DETAIL_REQUEST]', JSON.stringify({ url: requestUrl, asset_id: assetId, project_id: projectId }));
    appendS3Debug('S3_DETAIL_REQUEST', { url: requestUrl, asset_id: assetId, project_id: projectId });
    try {
      let rawDetail: AssetLibraryItemDto;
      try {
        rawDetail = await getShortDramaAssetLibraryDetail(projectId, assetId);
      } catch (detailError) {
        const type = cardRow ? toKind(cardRow.asset_type) : assetLibraryTypeForTab(activeTab);
        const list = await listShortDramaAssetLibrary(projectId, type);
        const fallback = list.assets.find((item) => {
          const normalized = normalizeLibraryItem(item);
          if (!normalized) return false;
          return normalized.id === assetId || legacySourceAssetId(normalized) === assetId;
        });
        if (!fallback) throw detailError;
        rawDetail = fallback;
      }
      const d = normalizeLibraryItem(rawDetail);
      if (!d) {
        console.error('[S3_DETAIL_INVALID_RESPONSE]', { projectId, assetId });
        window.alert('资产详情加载失败，请重试');
        return;
      }
      warnAssetDetailMismatch(d);
      const tf = (d.extra?.type_fields ?? {}) as Record<string, unknown>;
      const detailTypeLabel = resolveAssetRoleLabel(d);
      const anchorImage = getAssetThumbnailUrl(d);
      const detailImages = activeRenderableImages(d).map((x) => ({
        id: x.id,
        imageUrl: x.resolvedUrl,
        isCover: x.is_cover,
        label: x.variant_label ?? undefined,
        sourceType: (
          String(x.image_type || '').toLowerCase() === 'reference'
            ? 'reference'
            : String(x.image_type || '').toLowerCase() === 'uploaded'
              ? 'uploaded'
              : 'generated'
        ) as 'reference' | 'uploaded' | 'generated',
      }));
      const detailVm: AssetInteractionEntity = {
        id: d.id,
        kind: toKind(d.asset_type),
        name: displayAssetName(d),
        typeLabel: detailTypeLabel,
        narrativeFunctionLabel: resolveNarrativeFunctionLabel(d),
        description: d.description ?? '',
        prompt: d.base_prompt ?? '',
        imageUrl: anchorImage,
        sourceLabel: resolveAssetSourceLabel(d),
        voiceStyle:
          typeof tf.voice_profile === 'string'
            ? tf.voice_profile
            : typeof tf.voice_style === 'string'
              ? tf.voice_style
              : typeof tf.personality === 'string'
                ? tf.personality
                : '',
        productUsage: typeof (tf.product_usage || tf.usage_mode) === 'string' ? String(tf.product_usage || tf.usage_mode) : '',
        imageCount: d.image_count,
        imageLimit: 6,
        images: detailImages,
        selectedImageId: resolveVisualAnchorImageId(d) ?? null,
        referenceImages: d.reference_images.map((x) => ({ id: x.id, fileUrl: x.file_url, fileName: x.file_name ?? undefined })),
        tags: d.tags ?? [],
        typeFields: resolveTypeFields(d),
        rawSnapshot: buildRawStructureSnapshot(d),
        structureSummary: buildStructureSummary(d),
      };
      console.info('[S3_DETAIL_MODAL_VM]', JSON.stringify(detailVm));
      if (typeof window !== 'undefined') {
        (window as Window & { __S3_LAST_DETAIL_VM__?: AssetInteractionEntity }).__S3_LAST_DETAIL_VM__ = detailVm;
      }
      setDetail(detailVm);
    } catch (e) {
      console.error('[S3_DETAIL_REQUEST_FAILED]', {
        rawAssetId,
        normalizedAssetId: assetId,
        projectId,
        requestUrl,
        error: e,
      });
      appendS3Debug('S3_DETAIL_REQUEST_FAILED', {
        raw_asset_id: rawAssetId,
        normalized_asset_id: assetId,
        project_id: projectId,
        request_url: requestUrl,
        error_message: e instanceof Error ? e.message : String(e),
      });
      window.alert('资产详情加载失败，请重试');
    }
  }, [activeTab, effectiveProjectId]);

  const analyzeReferenceImage = useCallback(async (assetId: number, file: File) => {
    if (!effectiveProjectId) return;
    if (!isSupportedImageType(file)) {
      window.alert(UNSUPPORTED_IMAGE_MESSAGE);
      return;
    }
    setAnalyzingAssetIds((prev) => {
      const next = new Set(prev);
      next.add(assetId);
      return next;
    });
    try {
      const image = await toDataUrl(file);
      const result = await analyzeShortDramaAssetReferenceImage(assetId, {
        project_id: effectiveProjectId,
        image,
      });
      if (result.warning) window.alert(result.warning);
      setIsDirty(true);
      await reload({ background: true });
      if (detail?.id === assetId) await openDetail(assetId);
    } catch {
      window.alert('参考图分析失败，请重试。');
    } finally {
      setAnalyzingAssetIds((prev) => {
        const next = new Set(prev);
        next.delete(assetId);
        return next;
      });
    }
  }, [detail?.id, effectiveProjectId, openDetail, reload]);

  const createLabel = activeTab === 'characters' ? '添加角色' : activeTab === 'scenes' ? '添加场景' : '添加产品';
  const currentRows = data[activeTab];
  const listedAssetTotal = data.characters.length + data.scenes.length + data.assets.length;
  const pipelineRowsNeedMaterialize = pipelineAssetRowsTotal === 0 && pipelineHasAssetGenerationSpecs;
  const pipelineRowsNeedImages = pipelineAssetRowsTotal > 0 && pipelineImageUrlFilled < pipelineAssetRowsTotal;
  const autoPreparing =
    !confirmedS3PipelineFailure
    && (
      isS3AutoRequestPhase(autoPhase)
      || pipelineRowsNeedMaterialize
      || pipelineRowsNeedImages
    );

  const workInProgress = computeS3PipelineWorkInProgress({
    listedAssetTotal,
    pipelineAssetRowsTotal,
    pipelineRawStatus,
    pipelineEffectiveStatus,
    pipelineCurrentStage,
    pipelineTaskRunning,
    pipelineOverallStatus,
    autoPhase,
  }) || autoPreparing;

  const step3Failed =
    String(pipelineStepStatus.step_3 || '').toLowerCase() === 'failed'
    || String(pipelineStepStatus.assets || '').toLowerCase() === 'failed';
  const rawFailedHint = pipelineRawStatus.trim().toLowerCase() === 'failed';
  const effFailedHint = pipelineEffectiveStatus.trim().toLowerCase() === 'failed';

  const pipelineFailureWatchActive =
    !confirmedS3PipelineFailure
    && listedAssetTotal === 0
    && pipelineAssetRowsTotal === 0
    && failedStageLooksLikeS3Assets(pipelineFailedStage)
    && (rawFailedHint || effFailedHint || step3Failed);

  const shouldPollPipeline =
    Boolean(toPositiveInt(effectiveProjectId))
    && (
      workInProgress
      || autoPreparing
      || pipelineFailureWatchActive
      || (listedAssetTotal === 0 && pipelineAssetRowsTotal > 0 && !confirmedS3PipelineFailure)
    );

  const s3AssetGridUi = getS3AssetUiState({
    currentTabRowCount: currentRows.length,
    confirmedS3PipelineFailure,
    workInProgress,
  });
  const canGenerateS3Assets =
    Boolean(toPositiveInt(effectiveProjectId))
    && pipelineHasStoryBlueprint
    && listedAssetTotal === 0
    && pipelineAssetRowsTotal === 0
    && !autoPreparing
    && !workInProgress;

  const hasVisibleAssetImages = useMemo(() => {
    const tabsRows = [...data.characters, ...data.scenes, ...data.assets];
    return tabsRows.some((row) => {
      const cover = getAssetThumbnailUrl(row);
      if (cover) return true;
      return activeRenderableImages(row).length > 0;
    });
  }, [data]);

  const tabs = useMemo(() => ([
    { key: 'characters' as const, label: '角色', count: data.characters.length, icon: 'ri-user-star-line' },
    { key: 'scenes' as const, label: '场景', count: data.scenes.length, icon: 'ri-landscape-line' },
    { key: 'assets' as const, label: '产品资产', count: data.assets.length, icon: 'ri-archive-line' },
  ]), [data]);

  useEffect(() => {
    const projectId = toPositiveInt(effectiveProjectId);
    console.info('[S3_POLLING_DECISION]', {
      projectId: projectId ?? null,
      shouldPollPipeline,
      workInProgress,
      pipelineFailureWatchActive,
    });
    if (!projectId || !shouldPollPipeline) {
      if (pipelinePollIntervalRef.current) {
        window.clearInterval(pipelinePollIntervalRef.current);
        pipelinePollIntervalRef.current = 0;
      }
      console.info('[S3_POLLING_STOP]', {
        projectId: projectId ?? null,
        reason: !projectId ? 'no_project' : 'should_poll_false',
      });
      return undefined;
    }

    const pollOpts = {
      listedTotalRef: listedAssetTotalRef,
      autoPhaseRef,
      confirmedFailureRef: confirmedS3PipelineFailureRef,
    };

    const tick = async (): Promise<boolean> => {
      try {
        pipelinePollAbortRef.current?.abort();
        const ctrl = new AbortController();
        pipelinePollAbortRef.current = ctrl;
        const p = await getShortDramaPipeline(projectId, { signal: ctrl.signal, lightweight: true });
        setCachedShortDramaPipeline(projectId, p);
        applyPipelineSnapshot(p);
        pipelinePollFailureRef.current = 0;

        await reload({ background: true, reason: 'polling' });
        bumpS3PipelineFailureStreak(p, listedAssetTotalRef.current, s3FailureStreakRef, setConfirmedS3PipelineFailure, confirmedS3PipelineFailureRef);

        console.info('[S3_EFFECTIVE_STATUS_CHECK]', {
          project_id: projectId,
          status: String(p.project?.status || ''),
          effective_status: String(p.project?.effective_status || p.project?.suggested_status || p.project?.status || ''),
          current_stage: String(p.project?.current_stage || ''),
          status_recoverable: Boolean(p.project?.status_recoverable),
          asset_rows_total: p.asset_rows_total ?? null,
          image_url_filled: p.image_url_filled ?? null,
        });

        const done =
          p.project?.effective_status === 'assets_ready'
          || p.project?.effective_status === 'segments_generated'
          || p.project?.effective_status === 'completed';
        if (done) setAutoPhase('ready');

        return shouldContinuePipelinePolling(p, pollOpts);
      } catch {
        pipelinePollFailureRef.current += 1;
        if (pipelinePollFailureRef.current >= 5) {
          console.warn('[S3_PIPELINE_POLL_NETWORK]', { projectId, streak: pipelinePollFailureRef.current });
        }
        return true;
      }
    };

    pipelinePollFailureRef.current = 0;
    console.info('[S3_POLLING_START]', { projectId });

    let cancelled = false;
    void (async () => {
      const keep = await tick();
      if (cancelled) return;
      if (!keep) {
        console.info('[S3_POLLING_STOP]', { projectId, reason: 'first_tick_done' });
        return;
      }
      pipelinePollIntervalRef.current = window.setInterval(() => {
        void (async () => {
          const k = await tick();
          if (!k && pipelinePollIntervalRef.current) {
            window.clearInterval(pipelinePollIntervalRef.current);
            pipelinePollIntervalRef.current = 0;
            console.info('[S3_POLLING_STOP]', { projectId, reason: 'pipeline_idle' });
          }
        })();
      }, 3000);
    })();

    return () => {
      cancelled = true;
      if (pipelinePollIntervalRef.current) {
        window.clearInterval(pipelinePollIntervalRef.current);
        pipelinePollIntervalRef.current = 0;
      }
      console.info('[S3_POLLING_STOP]', { projectId, reason: 'effect_cleanup' });
      pipelinePollAbortRef.current?.abort();
      pipelinePollAbortRef.current = null;
    };
  }, [effectiveProjectId, shouldPollPipeline, reload]);

  useEffect(() => {
    const projectId = toPositiveInt(effectiveProjectId);
    console.info('[S3_ASSET_RENDER_STATE]', {
      projectId: projectId ?? null,
      rawStatus: pipelineRawStatus,
      effectiveStatus: pipelineEffectiveStatus,
      currentStage: pipelineCurrentStage,
      taskRunning: pipelineTaskRunning,
      assetRowsTotal: pipelineAssetRowsTotal,
      imageUrlFilled: pipelineImageUrlFilled,
      hasAssetGenerationSpecs: pipelineHasAssetGenerationSpecs,
      hasVisibleAssets: hasVisibleAssetImages,
      autoPreparing,
      workInProgress,
      s3AssetGridUi,
      shouldPollPipeline,
    });
  }, [
    effectiveProjectId,
    pipelineRawStatus,
    pipelineEffectiveStatus,
    pipelineCurrentStage,
    pipelineTaskRunning,
    pipelineAssetRowsTotal,
    pipelineImageUrlFilled,
    pipelineHasAssetGenerationSpecs,
    hasVisibleAssetImages,
    autoPreparing,
    workInProgress,
    s3AssetGridUi,
    shouldPollPipeline,
  ]);

  const handleGenerateS3Assets = useCallback(async () => {
    const projectId = toPositiveInt(effectiveProjectId);
    if (!projectId || workInProgress) return;
    setError(null);
    setAutoPhase('generating_specs');
    setAutoHint('正在生成角色/场景/产品资产规范…');
    console.info('[S3_MANUAL_TRIGGER_SPECS]', JSON.stringify({ project_id: projectId }));
    try {
      const specsResult = await generateShortDramaAssetSpecs(projectId, { trigger: 'retry_button' });
      setImageGenerationFailedIds(extractFailedAssetIds(specsResult.image_generation?.errors));
      let nextPipeline = await getShortDramaPipeline(projectId);
      setCachedShortDramaPipeline(projectId, nextPipeline);
      applyPipelineSnapshot(nextPipeline);
      await reload({ background: true, reason: 'manual_specs_generated' });

      const effectiveAfterSpecs = String(
        nextPipeline.project?.effective_status || nextPipeline.project?.suggested_status || nextPipeline.project?.status || '',
      );
      if (effectiveAfterSpecs === 'asset_specs_generated') {
        setAutoPhase('generating_images');
        setAutoHint('正在同步资产图片，请稍候…');
        nextPipeline = await getShortDramaPipeline(projectId);
        setCachedShortDramaPipeline(projectId, nextPipeline);
        applyPipelineSnapshot(nextPipeline);
        await reload({ background: true, reason: 'manual_images_generated' });
      }

      const finalStatus = String(
        nextPipeline.project?.effective_status || nextPipeline.project?.suggested_status || nextPipeline.project?.status || '',
      );
      const finalStage = String(nextPipeline.project?.current_stage || '');
      if (finalStatus === 'assets_rendering' || (finalStatus === 'processing' && isS3AssetPipelineStage(finalStage))) {
        setAutoPhase('generating_images');
        setAutoHint('资产图片生成中，正在同步进度…');
      } else if (Number(nextPipeline.asset_rows_total || 0) === 0) {
        setAutoPhase('error');
        setAutoHint('未检测到资产生成任务，请重试。');
        setError('未检测到资产生成任务，请重试。');
      } else {
        setAutoPhase('ready');
        setAutoHint(null);
      }
    } catch (e) {
      const msg = toReadableErrorMessage(e, '资产生成失败，请稍后重试。');
      setAutoPhase('error');
      setAutoHint(msg);
      setError(msg);
      await reload({ background: true, reason: 'manual_generate_error' });
    }
  }, [effectiveProjectId, workInProgress, applyPipelineSnapshot, reload]);

  const handleGenerateAssetImage = useCallback(async (row: AssetLibraryItemDto) => {
    const projectId = toPositiveInt(effectiveProjectId);
    if (!projectId || generatingImageAssetIds.has(row.id)) return;
    const prompt = promptForImageGeneration(row);
    setGeneratingImageAssetIds((prev) => new Set(prev).add(row.id));
    setImageGenerationFailedIds((prev) => {
      const next = new Set(prev);
      next.delete(row.id);
      return next;
    });
    setImageLoadFailedIds((prev) => {
      const next = new Set(prev);
      next.delete(row.id);
      return next;
    });
    try {
      await regenerateShortDramaAssetLibrary({
        project_id: projectId,
        asset_id: row.id,
        generate_count: 1,
        reuse_reference_images: true,
        current_image_prompt: prompt,
      });
      setIsDirty(true);
      await reload({ background: true, reason: 'single_asset_image_generated' });
      if (detail?.id === row.id) await openDetail(row.id);
    } catch (e) {
      console.error('[S3_SINGLE_ASSET_IMAGE_FAILED]', { asset_id: row.id, error: e });
      setImageGenerationFailedIds((prev) => new Set(prev).add(row.id));
      setError(toReadableErrorMessage(e, '资产图片生成失败，请稍后重试。'));
    } finally {
      setGeneratingImageAssetIds((prev) => {
        const next = new Set(prev);
        next.delete(row.id);
        return next;
      });
    }
  }, [detail?.id, effectiveProjectId, generatingImageAssetIds, openDetail, reload]);

  const submitAdd = useCallback(async () => {
    if (!effectiveProjectId) return;
    try {
      if (addMode === 'text') {
        if (!draft.prompt.trim()) throw new Error('请输入描述/指令');
        const k = tabToKind(activeTab);
        setAddPending({ tab: activeTab, mode: addMode });
        setShowCreate(false);
        setDraft({ name: '', prompt: '' });
        setUploadFiles([]);
        void (async () => {
          try {
            await createShortDramaAssetLibrary({
              project_id: effectiveProjectId,
              asset_type: k,
              name: sanitizeAssetName(draft.name) || fallbackNameByTab[activeTab],
              description: draft.prompt.trim(),
              base_prompt: draft.prompt.trim(),
              generate_count: 4,
              variant_directions: [],
              reference_images: [],
              type_fields: {},
            });
            setIsDirty(true);
            await reload({ background: true });
          } catch (e) {
            setError(toReadableErrorMessage(e, '创建失败，请稍后重试。'));
          } finally {
            setAddPending(null);
          }
        })();
      } else {
        if (!uploadFiles.length) throw new Error('请先上传图片');
        const file = uploadFiles[0];
        if (!file || !isSupportedImageType(file)) throw new Error(UNSUPPORTED_IMAGE_MESSAGE);
        const image = await toDataUrl(file);
        const k = tabToKind(activeTab);
        setAddPending({ tab: activeTab, mode: addMode });
        setShowCreate(false);
        setDraft({ name: '', prompt: '' });
        setUploadFiles([]);
        void (async () => {
          try {
            await createShortDramaAssetFromImage({
              project_id: effectiveProjectId,
              asset_type: k,
              image,
              optional_name: sanitizeAssetName(draft.name),
            });
            setIsDirty(true);
            await reload({ background: true });
          } catch (e) {
            setError(toReadableErrorMessage(e, '创建失败，请稍后重试。'));
          } finally {
            setAddPending(null);
          }
        })();
      }
    } catch (e) {
      setError(toReadableErrorMessage(e, '创建失败，请稍后重试。'));
    }
  }, [effectiveProjectId, activeTab, addMode, draft, uploadFiles, createLabel, reload]);

  return (
    <div className="min-h-screen" style={{ background: '#fff', fontFamily: "'Inter', sans-serif" }}>
      <SDWorkflowNav currentStep={3} projectName={projectName ?? undefined} projectId={effectiveProjectId} isDirty={isDirty} onSaveDraft={async (intent) => {
        if (!effectiveProjectId) return false;
        try {
          await touchShortDramaProjectStep(effectiveProjectId, { step: 'step_3', save_intent: intent });
          setIsDirty(false);
          return true;
        } catch {
          return false;
        }
      }} />
      <div className="pt-14">
        <div className="px-6 lg:px-10 py-6 flex items-start justify-between" style={{ borderBottom: '1px solid #EAEAEA' }}>
          <div>
            <span className="text-[11px] font-bold tracking-widest uppercase" style={{ color: '#8E8E93' }}>STEP 03</span>
            <h1 className="text-2xl font-black mt-0.5" style={{ fontFamily: "'Syne', sans-serif", color: '#1D1D1F' }}>角色与场景资产</h1>
            <p className="text-[13px] mt-1" style={{ color: '#8E8E93' }}>构建可复用的视觉资产库，统一整部商品营销短视频的视觉风格</p>
          </div>
        </div>
        <div className="px-6 lg:px-10 pt-5">
          <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: '#F5F5F7', border: '1px solid #EAEAEA' }}>
            {tabs.map((tab) => (
              <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)} className="flex items-center gap-2 px-5 py-2 rounded-lg text-[13px] font-medium" style={{ background: activeTab === tab.key ? '#fff' : 'transparent', color: activeTab === tab.key ? '#1D1D1F' : '#8E8E93' }}>
                <i className={`${tab.icon} text-[13px]`} />{tab.label}<span className="text-[11px] px-1.5 py-0.5 rounded-full" style={{ background: '#EAEAEA' }}>{tab.count}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="px-6 lg:px-10 py-7">
          {initialLoading && !hasVisibleAssets && s3AssetGridUi !== 'waiting' && !error ? (
            <div className="mb-3 text-[12px] text-[#8E8E93]">加载中…</div>
          ) : null}
          {error ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">{error}</div> : null}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {currentRows.map((row) => {
              const visualAnchor = getAssetThumbnailUrl(row);
              const roleLabel = resolveAssetRoleLabel(row);
              const imageLoadFailed = imageLoadFailedIds.has(row.id);
              const cardImageGenerating = generatingImageAssetIds.has(row.id);
              const rowImageStatus = assetImageGenerationStatus(row);
              const rowMarkedGenerating = rowImageStatus === 'generating' || rowImageStatus === 'processing';
              const hasFailedImage =
                !visualAnchor &&
                (imageGenerationFailedIds.has(row.id) || assetImageGenerationFailed(row));
              const isImageGenerating =
                !hasFailedImage
                && !visualAnchor
                && !imageLoadFailed
                && (cardImageGenerating || rowMarkedGenerating || autoPreparing || workInProgress);
              return (
                <div key={row.id} className="flex h-full flex-col overflow-hidden rounded-2xl" style={{ background: '#fff', border: '1px solid #EAEAEA' }}>
                  <div
                    className="relative h-48 shrink-0 overflow-hidden"
                    style={{ background: '#F7F8FA', cursor: 'pointer' }}
                    onClick={() => visualAnchor && setLightbox({ img: visualAnchor, name: displayAssetName(row) })}
                    role="button"
                    tabIndex={0}
                  >
                    {visualAnchor && !imageLoadFailed ? (
                      <img
                        src={visualAnchor}
                        alt={displayAssetName(row)}
                        className={assetCoverImageClass(row)}
                        onError={() => setImageLoadFailedIds((prev) => new Set(prev).add(row.id))}
                      />
                    ) : isImageGenerating ? (
                      <div className="flex h-full w-full items-center justify-center bg-[#ECEDEF]">
                        <div className="text-center text-[12px] text-[#6E6E73]">
                          <i className="ri-loader-4-line mb-1 block animate-spin text-[18px]" aria-hidden />
                          资产图片生成中...
                        </div>
                      </div>
                    ) : imageLoadFailed ? (
                      <div className="flex h-full w-full items-center justify-center bg-[#F7F8FA] px-3 text-center text-[12px] text-[#B42318]">
                        图片加载失败
                      </div>
                    ) : hasFailedImage ? (
                      <div className="flex h-full w-full items-center justify-center bg-[#F7F8FA] px-3 text-center text-[12px] text-[#B42318]">
                        图片生成失败
                      </div>
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-[#ECEDEF]">
                        <div className="text-center text-[12px] text-[#6E6E73]">
                          <i className="ri-loader-4-line mb-1 block animate-spin text-[18px]" aria-hidden />
                          资产图片生成中...
                        </div>
                      </div>
                    )}
                    {hasFailedImage && (!visualAnchor || imageLoadFailed) && !autoPreparing && !workInProgress ? (
                      <button
                        type="button"
                        disabled={cardImageGenerating}
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleGenerateAssetImage(row);
                        }}
                        className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-lg bg-[#1D1D1F] px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm disabled:opacity-60"
                      >
                        重试生成图片
                      </button>
                    ) : null}
                  </div>
                  <div className="flex flex-1 flex-col p-4">
                    <div className="flex-1">
                      <div className="min-h-[42px]">
                        <h3
                          className="text-[14px] font-bold leading-[1.35]"
                          style={{
                            color: '#1D1D1F',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {displayAssetName(row)}
                        </h3>
                      </div>
                      <div className="mt-1 h-[24px] flex items-center justify-between">
                        <span className="text-[10px] rounded-full px-2 py-1" style={{ background: '#F5F5F7', color: '#6E6E73' }}>{roleLabel}</span>
                        <span className="text-[11px]" style={{ color: '#8E8E93' }}>{row.image_count}/6</span>
                      </div>
                      <div className="mt-2 min-h-[40px]">
                        <p
                          className="text-[12px] leading-relaxed"
                          style={{
                            color: '#6E6E73',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {row.description || '—'}
                        </p>
                      </div>
                      <div className="mt-2 h-[40px] flex items-center gap-1 overflow-hidden">
                        {activeRenderableImages(row).slice(0, 3).map((img) => (
                          <img key={img.id} src={img.resolvedUrl} alt={img.variant_label ?? 'thumb'} className="h-9 w-9 shrink-0 rounded border border-[#EAEAEA] object-cover" />
                        ))}
                        {row.has_reference_images ? <span className="ml-1 text-[11px] text-[#0B8D5A]">有参考图</span> : <span className="ml-1 text-[11px] text-transparent">占位</span>}
                      </div>
                    </div>
                    <div className="mt-auto pt-3 grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        className="h-9 rounded-lg px-2 text-[11.5px] font-medium text-white"
                        style={{ background: '#1D1D1F' }}
                        onClick={() => void openDetail(row.id, row)}
                      >
                        查看详情
                      </button>
                      <button
                        type="button"
                        className="h-9 rounded-lg border border-dashed border-[#D1D1D6] bg-[#F7F8FA] px-2 text-[11.5px] font-medium text-[#444]"
                        disabled={analyzingAssetIds.has(row.id)}
                        onClick={() => { refTargetAssetId.current = row.id; refUploadInput.current?.click(); }}
                      >
                        {analyzingAssetIds.has(row.id) ? '正在分析参考图...' : '上传参考图'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            {s3AssetGridUi === 'waiting' ? (
              <div
                className="flex h-full flex-col self-start overflow-hidden rounded-2xl"
                style={{ background: '#fff', border: '1px solid #EAEAEA', boxShadow: '0 4px 14px rgba(0,0,0,0.06)' }}
              >
                <div className="relative flex h-48 shrink-0 flex-col items-center justify-center overflow-hidden bg-[#ECEDEF] px-4">
                  <i className="ri-loader-4-line mb-2 block animate-spin text-[22px] text-[#6E6E73]" aria-hidden />
                  <span className="text-[11px] font-medium text-[#8E8E93]">生成中</span>
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <h3
                    className="text-[14px] font-bold leading-[1.35] text-[#1D1D1F]"
                    style={{
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    正在准备资产数据
                  </h3>
                  <p className="mt-2 text-[12px] leading-relaxed text-[#6E6E73]">
                    系统正在根据 S2 已确定的资产 prompt 创建资产并生成图片，请稍候。
                  </p>
                </div>
              </div>
            ) : null}
            {s3AssetGridUi === 'failed' ? (
              <div className="flex h-full flex-col self-start overflow-hidden rounded-2xl" style={{ background: '#fff', border: '1px solid #FECACA' }}>
                <div className="relative flex h-48 shrink-0 flex-col items-center justify-center overflow-hidden bg-[#FEF2F2] px-4">
                  <div className="text-center text-[12px] text-[#B91C1C]">
                    <i className="ri-error-warning-line mb-1 block text-[18px]" aria-hidden />
                    资产生成失败，可重试
                  </div>
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <p className="text-[12px] text-[#B91C1C]">请点击重试重新生成资产。</p>
                  <button
                    type="button"
                    disabled={!canGenerateS3Assets}
                    onClick={() => void handleGenerateS3Assets()}
                    className="mt-4 rounded-xl bg-[#1D1D1F] px-4 py-2 text-[12px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    重试生成资产
                  </button>
                </div>
              </div>
            ) : null}
            {s3AssetGridUi === 'empty' ? (
              <div className="flex h-full flex-col self-start overflow-hidden rounded-2xl border border-[#EAEAEA] bg-[#FAFAFB] p-4">
                <div className="flex h-48 shrink-0 flex-col items-center justify-center px-3">
                  <i className="ri-loader-4-line animate-spin text-[22px] text-[#8E8E93]" />
                </div>
                <div className="flex flex-1 flex-col">
                  <div className="text-[14px] font-semibold text-[#1D1D1F]">正在准备资产数据</div>
                  <div className="mt-2 text-[12px] leading-relaxed text-[#8E8E93]">
                    系统会根据 S2 已生成的资产 prompt 自动创建资产并生成图片。
                  </div>
                  {error ? (
                    <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
                      {error}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
            {addPending?.tab === activeTab ? (
              <div className="flex h-full flex-col overflow-hidden rounded-2xl" style={{ background: '#fff', border: '1px solid #EAEAEA' }}>
                <div className="h-48 animate-pulse bg-[#ECEDEF]" />
                <div className="flex flex-1 flex-col p-4">
                  <div className="flex-1">
                    <div className="h-5 w-2/3 animate-pulse rounded bg-[#ECEDEF]" />
                    <div className="mt-2 h-4 w-full animate-pulse rounded bg-[#F1F2F4]" />
                    <div className="mt-1 h-4 w-4/5 animate-pulse rounded bg-[#F1F2F4]" />
                  </div>
                  <div className="mt-auto pt-3 text-[12px] text-[#6E6E73]">
                    {addPending.mode === 'text' ? '正在生成资产图片，请稍候…' : '正在创建资产...'}
                  </div>
                </div>
              </div>
            ) : null}
            <button
              type="button"
              className="flex h-full min-h-[340px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#D1D1D6] bg-[#FAFAFB] p-6 text-center"
              onClick={() => setShowCreate(true)}
            >
              <i className="ri-add-circle-line text-[26px] text-[#6E6E73]" />
              <div className="mt-2 text-[14px] font-semibold text-[#1D1D1F]">{createLabel}</div>
              <div className="mt-1 text-[12px] text-[#8E8E93]">文字输入或图片上传（二选一）</div>
            </button>
          </div>
          <div className="flex items-center justify-between mt-10 pt-6" style={{ borderTop: '1px solid #EAEAEA' }}>
            <button type="button" onClick={() => navigate(withProjectQuery('/short-drama/story-blueprint', effectiveProjectId))} className="flex items-center gap-2 px-5 py-3 rounded-xl text-[13.5px]" style={{ background: '#F7F8FA', color: '#444', border: '1px solid #EAEAEA' }}><i className="ri-arrow-left-line text-[13px]" />上一步</button>
            <button type="button" disabled={!effectiveProjectId} onClick={() => navigate(withProjectQuery('/short-drama/step4', effectiveProjectId))} className="flex items-center gap-2 px-7 py-3 rounded-xl text-[14px] font-semibold disabled:opacity-45" style={{ background: '#1D1D1F', color: '#fff' }}>下一步：生成片段脚本<i className="ri-arrow-right-line text-[13px]" /></button>
          </div>
        </div>
      </div>
      <input ref={refUploadInput} type="file" accept={SUPPORTED_IMAGE_ACCEPT} className="hidden" onChange={(e) => void (async () => {
        const f = e.target.files?.[0];
        e.target.value = '';
        if (!f || !effectiveProjectId || refTargetAssetId.current == null) return;
        const assetId = refTargetAssetId.current;
        refTargetAssetId.current = null;
        await analyzeReferenceImage(assetId, f);
      })()} />

      <AssetLightbox item={lightbox} onClose={() => setLightbox(null)} />
      <AssetInteractionModal
        asset={detail}
        saving={working}
        regenerating={regenerating}
        onClose={() => setDetail(null)}
        onSaveAllNormal={async (payload: AssetEditorPayload) => {
          if (!effectiveProjectId || !detail) return;
          setWorking(true);
          try {
            const patchPayload = sanitizePatchPayload({
              project_id: Number(effectiveProjectId),
              base_prompt: String(payload.currentImagePrompt || '').trim(),
            });
            try {
              await updateShortDramaAssetLibrary(detail.id, patchPayload);
              setIsDirty(true);
            } catch (e) {
              logPatchFailure('[S3_PATCH_SAVE_FAILED]', detail.id, patchPayload, e);
              throw e;
            }
            await reload({ background: true });
            await openDetail(detail.id);
          } catch (e) {
            window.alert('保存失败，请稍后重试。');
          } finally { setWorking(false); }
        }}
        onRegeneratePrompt={async (payload: AssetEditorPayload) => {
          if (!effectiveProjectId || !detail) return;
          setRegenerating(true);
          try {
            await regenerateShortDramaAssetLibrary({
              project_id: effectiveProjectId,
              asset_id: detail.id,
              generate_count: 1,
              reuse_reference_images: true,
              current_image_prompt: String(payload.currentImagePrompt || '').trim(),
            });
            setIsDirty(true);
            await reload({ background: true });
            await openDetail(detail.id);
          } catch (e) {
            console.error('[S3_REGENERATE_FAILED]', {
              asset_id: detail.id,
              current_image_prompt: String(payload.currentImagePrompt || ''),
              error_name: e instanceof Error ? e.name : undefined,
              error_message: e instanceof Error ? e.message : String(e),
            });
            setError(toReadableErrorMessage(e, '资产图片生成失败，请稍后重试。'));
          } finally {
            setRegenerating(false);
          }
        }}
        onSelectImage={(imageId) => setDetail((prev) => (prev ? { ...prev, selectedImageId: imageId, imageUrl: prev.images?.find((x) => x.id === imageId)?.imageUrl ?? prev.imageUrl } : prev))}
        onAddImage={() => {
          if (!detail) return;
          if (analyzingAssetIds.has(detail.id)) return;
          refTargetAssetId.current = detail.id;
          refUploadInput.current?.click();
        }}
        imageAnalyzing={detail ? analyzingAssetIds.has(detail.id) : false}
        onPromptDirtyChange={(dirty) => {
          if (dirty) setIsDirty(true);
        }}
      />

      {showCreate ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-[#EAEAEA] bg-white p-5">
            <h3 className="text-[18px] font-black text-[#1D1D1F]">{createLabel}</h3>
            <div className="mt-3 flex gap-2">
              <button type="button" className={`rounded-lg px-3 py-1.5 text-[12px] ${addMode === 'text' ? 'bg-[#1D1D1F] text-white' : 'border border-[#EAEAEA] text-[#444]'}`} onClick={() => setAddMode('text')}>文字输入</button>
              <button type="button" className={`rounded-lg px-3 py-1.5 text-[12px] ${addMode === 'upload' ? 'bg-[#1D1D1F] text-white' : 'border border-[#EAEAEA] text-[#444]'}`} onClick={() => setAddMode('upload')}>图片上传</button>
            </div>
            <div className="mt-3 grid gap-2">
              <input className="rounded-lg border border-[#EAEAEA] px-3 py-2 text-[13px]" placeholder="名称（可选）" value={draft.name} onChange={(e) => setDraft((s) => ({ ...s, name: e.target.value }))} />
              {addMode === 'text' ? (
                <textarea className="rounded-lg border border-[#EAEAEA] px-3 py-2 text-[13px]" placeholder="输入描述/指令（必填）" rows={4} value={draft.prompt} onChange={(e) => setDraft((s) => ({ ...s, prompt: e.target.value }))} />
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    {uploadFiles.map((f, idx) => <span key={`${f.name}-${idx}`} className="rounded bg-[#F5F5F7] px-2 py-1 text-[11px] text-[#444]">{f.name}</span>)}
                    {uploadFiles.length < 1 ? (
                      <button type="button" className="h-8 w-8 rounded border border-dashed border-[#B8BBC2] text-[18px] text-[#6E6E73]" onClick={() => uploadPickerRef.current?.click()}>+</button>
                    ) : null}
                  </div>
                  <input ref={uploadPickerRef} type="file" accept={SUPPORTED_IMAGE_ACCEPT} className="hidden" onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (!file) return;
                    if (!isSupportedImageType(file)) {
                      window.alert(UNSUPPORTED_IMAGE_MESSAGE);
                      return;
                    }
                    setUploadFiles([file]);
                  }} />
                  <p className="text-[11px] text-[#8E8E93]">上传图片后将先做图像理解并创建新资产，不会自动重生成。</p>
                </>
              )}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="rounded-lg border border-[#EAEAEA] px-3 py-1.5 text-[13px]" onClick={() => setShowCreate(false)}>取消</button>
              <button type="button" disabled={working} className="rounded-lg bg-[#1D1D1F] px-3 py-1.5 text-[13px] font-semibold text-white disabled:opacity-50" onClick={() => void submitAdd()}>{working ? '处理中…' : '创建'}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
