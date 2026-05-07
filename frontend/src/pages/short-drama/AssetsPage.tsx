import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SDWorkflowNav } from './components/SDWorkflowNav';
import { AssetLightbox, type LightboxItem } from './components/AssetLightbox';
import { AssetInteractionModal, type AssetEditorPayload, type AssetInteractionEntity, type AssetKind } from './components/AssetInteractionModal';
import { useEffectiveShortDramaProjectId } from './hooks/useEffectiveShortDramaProjectId';
import { ShortDramaApiError, analyzeShortDramaAssetReferenceImage, createShortDramaAssetFromImage, createShortDramaAssetLibrary, generateShortDramaAssetImages, generateShortDramaAssetSpecs, getShortDramaAssetLibraryDetail, getShortDramaPipeline, listShortDramaAssetLibrary, regenerateShortDramaAssetLibrary, touchShortDramaProjectStep, updateShortDramaAssetLibrary } from '@/services/shortDramaApi';
import type { AssetImageDto, AssetLibraryItemDto, PipelineSummaryDto } from '@/types/shortDramaApi';
import { getAssetThumbnailUrl, resolveAssetImageUrl } from './utils/assetsPageAdapters';
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
  if (row.asset_type !== 'scene') return normalizeSceneDisplayName(row.name);
  const identity = row.extra && typeof row.extra === 'object' ? (row.extra as Record<string, unknown>).location_identity || (row.extra as Record<string, unknown>).asset_identity : null;
  if (typeof identity === 'string' && identity.trim()) return identity.trim();
  let out = row.name || '';
  for (const term of SCENE_PLOT_STATE_TERMS) {
    out = out.replace(new RegExp(`\\b${term}\\b`, 'gi'), ' ').replace(new RegExp(term, 'g'), ' ');
  }
  out = out.replace(/\s+/g, ' ').trim();
  if (/home\s+gym/i.test(`${row.name} ${row.description ?? ''}`) || `${row.name} ${row.description ?? ''}`.includes('健身房')) return '家庭健身房';
  return normalizeSceneDisplayName(out || '场景');
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

function extractFailedAssetIds(errors: Record<string, unknown>[] | undefined): Set<number> {
  const ids = new Set<number>();
  for (const err of errors ?? []) {
    const assetId = toPositiveInt(err.asset_id ?? err.assetId ?? err.id);
    if (assetId != null) ids.add(assetId);
  }
  return ids;
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
  if (error instanceof ShortDramaApiError) {
    const detail = error.detail;
    if (error.status === 429 && detail && typeof detail === 'object') {
      const d = detail as { error?: unknown; detail?: unknown };
      if (d.error === 'XAI_IMAGE_QUOTA_EXHAUSTED' && typeof d.detail === 'string' && d.detail.trim()) {
        return d.detail.trim();
      }
    }
    if (error.message) return error.message;
  }
  if (error instanceof Error && error.message) return error.message;
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

function pipelineAssetsToCachedCards(pipeline: PipelineSummaryDto): Record<TabType, AssetLibraryItemDto[]> {
  const assets = pipeline.assets;
  if (!assets) return { characters: [], scenes: [], assets: [] };
  const makeImage = (id: number, imageUrl: string): AssetImageDto => ({
    id,
    image_url: imageUrl,
    image_type: 'generated',
    variant_meta: {},
    provider_params: {},
    is_cover: true,
    status: 'active',
    created_at: null,
  });
  const base: Omit<AssetLibraryItemDto, 'id' | 'asset_type' | 'name' | 'description' | 'base_prompt'> = {
    project_id: pipeline.project.id,
    source: 'system_generated',
    cover_image_id: null,
    cover_image: null,
    image_count: 0,
    has_reference_images: false,
    sort_order: 0,
    status: 'active',
    extra: {},
    images: [],
    reference_images: [],
    created_at: null,
    updated_at: null,
    tags: [],
  };
  return {
    characters: assets.characters.map((c, idx) => ({
      id: c.id,
      asset_type: 'character',
      name: c.name,
      description: c.description,
      base_prompt: c.visual_prompt,
      ...base,
      sort_order: idx,
      image_count: c.image_url ? 1 : 0,
      images: c.image_url ? [makeImage(c.id * 1000 + 1, c.image_url)] : [],
    })),
    scenes: assets.scenes.map((s, idx) => ({
      id: s.id,
      asset_type: 'scene',
      name: s.name,
      description: s.description,
      base_prompt: s.visual_prompt,
      ...base,
      sort_order: idx,
      image_count: s.image_url ? 1 : 0,
      images: s.image_url ? [makeImage(s.id * 1000 + 1, s.image_url)] : [],
    })),
    assets: assets.products.map((p, idx) => ({
      id: p.id,
      asset_type: 'product',
      name: p.name,
      description: p.description,
      base_prompt: p.visual_prompt,
      ...base,
      sort_order: idx,
      image_count: p.image_url ? 1 : 0,
      images: p.image_url ? [makeImage(p.id * 1000 + 1, p.image_url)] : [],
    })),
  };
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
  const [pipelineAssetRowsTotal, setPipelineAssetRowsTotal] = useState(0);
  const [pipelineImageUrlFilled, setPipelineImageUrlFilled] = useState(0);
  const [pipelineStepStatus, setPipelineStepStatus] = useState<Record<string, string>>({});
  const [imageLoadFailedIds, setImageLoadFailedIds] = useState<Set<number>>(() => new Set());
  const [imageGenerationFailedIds, setImageGenerationFailedIds] = useState<Set<number>>(() => new Set());
  const [analyzingAssetIds, setAnalyzingAssetIds] = useState<Set<number>>(() => new Set());
  const [isDirty, setIsDirty] = useState(false);
  const refUploadInput = useRef<HTMLInputElement>(null);
  const refTargetAssetId = useRef<number | null>(null);
  const uploadPickerRef = useRef<HTMLInputElement>(null);
  const autoRunProjectRef = useRef<number | null>(null);
  const pipelinePollFailureRef = useRef(0);
  const pipelinePollAbortRef = useRef<AbortController | null>(null);

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
      setData({
        characters: characters.assets.map(normalizeLibraryItem).filter((x): x is AssetLibraryItemDto => x !== null),
        scenes: scenes.assets.map(normalizeLibraryItem).filter((x): x is AssetLibraryItemDto => x !== null),
        assets: products.assets.map(normalizeLibraryItem).filter((x): x is AssetLibraryItemDto => x !== null),
      });
      setImageLoadFailedIds(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      if (!background) setInitialLoading(false);
    }
  }, [effectiveProjectId]);

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
    setData((prev) => {
      const hasExisting = prev.characters.length || prev.scenes.length || prev.assets.length;
      if (hasExisting) return prev;
      return pipelineAssetsToCachedCards(cached);
    });
    setPipelineEffectiveStatus(String(cached.project?.effective_status || cached.project?.suggested_status || cached.project?.status || ''));
    setPipelineRawStatus(String(cached.project?.status || ''));
    setPipelineOverallStatus(String(cached.project?.overall_status || ''));
    setPipelineStepStatus((cached.project?.step_status || {}) as Record<string, string>);
    setPipelineCurrentStage(String(cached.project?.current_stage || ''));
    setPipelineTaskRunning(Boolean(cached.project?.current_stage));
    setPipelineAssetRowsTotal(Number(cached.asset_rows_total || 0));
    setPipelineImageUrlFilled(Number(cached.image_url_filled || 0));
  }, [effectiveProjectId]);

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
        setPipelineEffectiveStatus(String(pipeline.project?.effective_status || pipeline.project?.suggested_status || pipeline.project?.status || ''));
        setPipelineRawStatus(String(pipeline.project?.status || ''));
        setPipelineOverallStatus(String(pipeline.project?.overall_status || ''));
        setPipelineStepStatus((pipeline.project?.step_status || {}) as Record<string, string>);
        setPipelineCurrentStage(String(pipeline.project?.current_stage || ''));
        setPipelineTaskRunning(Boolean(pipeline.project?.current_stage));
        setPipelineAssetRowsTotal(Number(pipeline.asset_rows_total || 0));
        setPipelineImageUrlFilled(Number(pipeline.image_url_filled || 0));
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
        console.info('[S3_AUTO_FLOW_CHECK]', JSON.stringify({
          project_id: projectId,
          project_status: pipeline.project.status,
          effective_status: effectiveStatus,
          assets_rows_total: pipeline.asset_rows_total ?? null,
        }));
        if (effectiveStatus === 'story_generated') {
          setAutoPhase('generating_specs');
          setAutoHint('正在自动生成角色/场景/产品资产规范…');
          console.info('[S3_AUTO_TRIGGER_SPECS]', JSON.stringify({ project_id: projectId, trigger: 'assets_page_auto' }));
          await generateShortDramaAssetSpecs(projectId, { trigger: 'auto' });
        }

        let pipelineAfterSpecs = await getShortDramaPipeline(projectId);
        setCachedShortDramaPipeline(projectId, pipelineAfterSpecs);
        setPipelineEffectiveStatus(String(pipelineAfterSpecs.project?.effective_status || pipelineAfterSpecs.project?.suggested_status || pipelineAfterSpecs.project?.status || ''));
        setPipelineRawStatus(String(pipelineAfterSpecs.project?.status || ''));
        setPipelineOverallStatus(String(pipelineAfterSpecs.project?.overall_status || ''));
        setPipelineStepStatus((pipelineAfterSpecs.project?.step_status || {}) as Record<string, string>);
        setPipelineCurrentStage(String(pipelineAfterSpecs.project?.current_stage || ''));
        setPipelineTaskRunning(Boolean(pipelineAfterSpecs.project?.current_stage));
        setPipelineAssetRowsTotal(Number(pipelineAfterSpecs.asset_rows_total || 0));
        setPipelineImageUrlFilled(Number(pipelineAfterSpecs.image_url_filled || 0));
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
          setPipelineEffectiveStatus(String(pipelineAfterSpecs.project?.effective_status || pipelineAfterSpecs.project?.suggested_status || pipelineAfterSpecs.project?.status || ''));
          setPipelineRawStatus(String(pipelineAfterSpecs.project?.status || ''));
          setPipelineOverallStatus(String(pipelineAfterSpecs.project?.overall_status || ''));
          setPipelineStepStatus((pipelineAfterSpecs.project?.step_status || {}) as Record<string, string>);
          setPipelineCurrentStage(String(pipelineAfterSpecs.project?.current_stage || ''));
          setPipelineTaskRunning(Boolean(pipelineAfterSpecs.project?.current_stage));
          setPipelineAssetRowsTotal(Number(pipelineAfterSpecs.asset_rows_total || 0));
          setPipelineImageUrlFilled(Number(pipelineAfterSpecs.image_url_filled || 0));
        }

        const effectiveAfterImages = String(
          pipelineAfterSpecs.project?.effective_status || pipelineAfterSpecs.project?.suggested_status || pipelineAfterSpecs.project?.status || '',
        );
        if (effectiveAfterImages === 'assets_rendering' || (effectiveAfterImages === 'processing' && String(pipelineAfterSpecs.project?.current_stage || '') === 's3_images')) {
          setAutoPhase('generating_images');
          setAutoHint('资产图片生成中，正在同步进度…');
        }

        await reload({ background: true, reason: 'auto_flow' });
        if (effectiveAfterImages === 'assets_rendering' || (effectiveAfterImages === 'processing' && String(pipelineAfterSpecs.project?.current_stage || '') === 's3_images')) {
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
        setAutoHint('资产自动生成失败，请点击重试或刷新页面。');
        await reload({ background: true, reason: 'auto_flow_error_fallback' });
      } finally {
        if (autoRunProjectRef.current === projectId) autoRunProjectRef.current = null;
      }
    };
    void run();
  }, [effectiveProjectId, reload]);

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
      const d = normalizeLibraryItem(await getShortDramaAssetLibraryDetail(projectId, assetId));
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
  }, [effectiveProjectId]);

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
  const isAssetGenerationRunning =
    pipelineEffectiveStatus === 'assets_rendering'
    || (pipelineRawStatus === 'processing' && pipelineCurrentStage === 's3_images' && pipelineTaskRunning);
  const isAssetGenerationFailed =
    autoPhase === 'error'
    || pipelineOverallStatus === 'failed'
    || String(pipelineStepStatus.step_3 || '').toLowerCase() === 'failed'
    || String(pipelineStepStatus.assets || '').toLowerCase() === 'failed';
  const hasVisibleAssetImages = useMemo(() => {
    const tabsRows = [...data.characters, ...data.scenes, ...data.assets];
    return tabsRows.some((row) => {
      const cover = getAssetThumbnailUrl(row);
      if (cover) return true;
      return activeRenderableImages(row).length > 0;
    });
  }, [data]);
  const shouldShowGeneratingCard = isAssetGenerationRunning && !hasVisibleAssetImages && currentRows.length === 0;
  const showSpecSkeletonCards = shouldShowGeneratingCard;
  const showFailureCard = isAssetGenerationFailed && currentRows.length === 0;
  const showEmptyStateCard = !showSpecSkeletonCards && !showFailureCard && currentRows.length === 0;
  const showAddCard = !showSpecSkeletonCards && !showFailureCard;
  const tabs = useMemo(() => ([
    { key: 'characters' as const, label: '角色', count: data.characters.length, icon: 'ri-user-star-line' },
    { key: 'scenes' as const, label: '场景', count: data.scenes.length, icon: 'ri-landscape-line' },
    { key: 'assets' as const, label: '产品资产', count: data.assets.length, icon: 'ri-archive-line' },
  ]), [data]);

  useEffect(() => {
    const projectId = toPositiveInt(effectiveProjectId);
    const shouldPoll = Boolean(projectId) && isAssetGenerationRunning;
    console.info('[S3_POLLING_DECISION]', {
      projectId: projectId ?? null,
      effectiveStatus: pipelineEffectiveStatus,
      rawStatus: pipelineRawStatus,
      currentStage: pipelineCurrentStage,
      taskRunning: pipelineTaskRunning,
      isAssetGenerationRunning,
      shouldPoll,
    });
    if (!projectId || !isAssetGenerationRunning) {
      console.info('[S3_POLLING_STOP]', {
        projectId: projectId ?? null,
        reason: !projectId ? 'no_project' : 'should_poll_false',
      });
      return;
    }
    pipelinePollFailureRef.current = 0;
    console.info('[S3_POLLING_START]', { projectId });
    const timer = window.setInterval(() => {
      void (async () => {
        try {
          pipelinePollAbortRef.current?.abort();
          const ctrl = new AbortController();
          pipelinePollAbortRef.current = ctrl;
          const p = await getShortDramaPipeline(projectId, { signal: ctrl.signal, lightweight: true });
          setCachedShortDramaPipeline(projectId, p);
          setPipelineEffectiveStatus(String(p.project?.effective_status || p.project?.suggested_status || p.project?.status || ''));
          setPipelineRawStatus(String(p.project?.status || ''));
          setPipelineOverallStatus(String(p.project?.overall_status || ''));
          setPipelineStepStatus((p.project?.step_status || {}) as Record<string, string>);
          setPipelineCurrentStage(String(p.project?.current_stage || ''));
          setPipelineTaskRunning(Boolean(p.project?.current_stage));
          setPipelineAssetRowsTotal(Number(p.asset_rows_total || 0));
          setPipelineImageUrlFilled(Number(p.image_url_filled || 0));
          pipelinePollFailureRef.current = 0;
          const runningNow =
            String(p.project?.effective_status || p.project?.suggested_status || p.project?.status || '') === 'assets_rendering'
            || (String(p.project?.status || '') === 'processing' && String(p.project?.current_stage || '') === 's3_images' && Boolean(p.project?.current_stage));
          if (!runningNow) {
            window.clearInterval(timer);
            console.info('[S3_POLLING_STOP]', { projectId, reason: 'stage_settled' });
            return;
          }
          await reload({ background: true, reason: 'polling' });
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
          if (done) {
            setAutoPhase('ready');
          }
        } catch {
          pipelinePollFailureRef.current += 1;
          if (pipelinePollFailureRef.current >= 3) {
            window.clearInterval(timer);
            console.info('[S3_POLLING_STOP]', { projectId, reason: 'polling_error_3x' });
            setAutoPhase('error');
            setAutoHint('pipeline 轮询连续失败，已自动停止，请稍后重试。');
          }
        }
      })();
    }, 3000);
    return () => {
      window.clearInterval(timer);
      console.info('[S3_POLLING_STOP]', { projectId, reason: 'effect_cleanup' });
      pipelinePollAbortRef.current?.abort();
      pipelinePollAbortRef.current = null;
    };
  }, [
    effectiveProjectId,
    isAssetGenerationRunning,
    pipelineCurrentStage,
    pipelineEffectiveStatus,
    pipelineRawStatus,
    pipelineTaskRunning,
    reload,
  ]);

  useEffect(() => {
    const projectId = toPositiveInt(effectiveProjectId);
    const shouldPoll = Boolean(projectId) && isAssetGenerationRunning;
    console.info('[S3_ASSET_RENDER_STATE]', {
      projectId: projectId ?? null,
      rawStatus: pipelineRawStatus,
      effectiveStatus: pipelineEffectiveStatus,
      currentStage: pipelineCurrentStage,
      taskRunning: pipelineTaskRunning,
      assetRowsTotal: pipelineAssetRowsTotal,
      imageUrlFilled: pipelineImageUrlFilled,
      hasVisibleAssets: hasVisibleAssetImages,
      isAssetGenerationRunning,
      shouldShowGeneratingCard,
      shouldPoll,
    });
  }, [
    effectiveProjectId,
    pipelineRawStatus,
    pipelineEffectiveStatus,
    pipelineCurrentStage,
    pipelineTaskRunning,
    pipelineAssetRowsTotal,
    pipelineImageUrlFilled,
    hasVisibleAssetImages,
    isAssetGenerationRunning,
    shouldShowGeneratingCard,
  ]);

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
            window.alert(e instanceof Error ? e.message : '创建失败');
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
            window.alert(e instanceof Error ? e.message : '创建失败，请重试。');
          } finally {
            setAddPending(null);
          }
        })();
      }
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '创建失败');
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
          {initialLoading && !hasVisibleAssets ? <div className="text-[13px] text-[#8E8E93]">加载中…</div> : null}
          {error ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">{error}</div> : null}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {currentRows.map((row) => {
              const visualAnchor = getAssetThumbnailUrl(row);
              const roleLabel = resolveAssetRoleLabel(row);
              const imageLoadFailed = imageLoadFailedIds.has(row.id);
              const isImageGenerating = isAssetGenerationRunning && !visualAnchor && !imageLoadFailed;
              const hasFailedImage =
                !visualAnchor &&
                (imageGenerationFailedIds.has(row.id) || (row.images ?? []).some((img) => String(img.status || '').toLowerCase() === 'failed'));
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
                        图片生成失败，可重试
                      </div>
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-[#F7F8FA] px-3 text-center text-[12px] text-[#8E8E93]">
                        暂无图片
                      </div>
                    )}
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
            {showSpecSkeletonCards ? (
              Array.from({ length: 3 }).map((_, idx) => (
                <div key={`spec-skeleton-${idx}`} className="flex h-full min-h-[340px] flex-col overflow-hidden rounded-2xl" style={{ background: '#fff', border: '1px solid #EAEAEA' }}>
                  <div className="flex h-48 items-center justify-center bg-[#ECEDEF]">
                    <div className="text-center text-[12px] text-[#6E6E73]">
                      <i className="ri-loader-4-line mb-1 block animate-spin text-[18px]" aria-hidden />
                      资产规范生成中…
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col p-4">
                    <div className="h-5 w-2/3 animate-pulse rounded bg-[#ECEDEF]" />
                    <div className="mt-3 h-4 w-full animate-pulse rounded bg-[#F1F2F4]" />
                    <div className="mt-2 h-4 w-4/5 animate-pulse rounded bg-[#F1F2F4]" />
                    <div className="mt-auto pt-3 text-[12px] text-[#6E6E73]">正在准备资产卡片…</div>
                  </div>
                </div>
              ))
            ) : null}
            {showFailureCard ? (
              <div className="flex h-full min-h-[340px] flex-col overflow-hidden rounded-2xl" style={{ background: '#fff', border: '1px solid #FECACA' }}>
                <div className="flex h-48 items-center justify-center bg-[#FEF2F2]">
                  <div className="text-center text-[12px] text-[#B91C1C]">
                    <i className="ri-error-warning-line mb-1 block text-[18px]" aria-hidden />
                    资产生成失败，可重试
                  </div>
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <p className="text-[12px] text-[#B91C1C]">请点击刷新或返回上一步重试生成。</p>
                </div>
              </div>
            ) : null}
            {showEmptyStateCard ? (
              <div className="flex h-full min-h-[340px] flex-col items-center justify-center rounded-2xl border border-[#EAEAEA] bg-[#FAFAFB] p-6 text-center">
                <i className="ri-inbox-archive-line text-[24px] text-[#8E8E93]" />
                <div className="mt-2 text-[14px] font-semibold text-[#1D1D1F]">暂无资产</div>
                <div className="mt-1 text-[12px] text-[#8E8E93]">当前没有可展示资产。若系统正在生成请稍候；若无任务请点击“添加”创建资产。</div>
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
            {showAddCard ? (
              <button
                type="button"
                className="flex h-full min-h-[340px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#D1D1D6] bg-[#FAFAFB] p-6 text-center"
                onClick={() => setShowCreate(true)}
              >
                <i className="ri-add-circle-line text-[26px] text-[#6E6E73]" />
                <div className="mt-2 text-[14px] font-semibold text-[#1D1D1F]">{createLabel}</div>
                <div className="mt-1 text-[12px] text-[#8E8E93]">文字输入或图片上传（二选一）</div>
              </button>
            ) : null}
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
            window.alert(toReadableErrorMessage(e, '重生成失败，请稍后重试。'));
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
