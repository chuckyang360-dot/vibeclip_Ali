import { API_BASE_URL } from '../config/api';
import {
  PRODUCT_PARSE_GENERIC_MESSAGE,
  PRODUCT_PARSE_SERVICE_UNAVAILABLE_MESSAGE,
  PRODUCT_PARSE_UPSTREAM_UNAVAILABLE_MESSAGE,
} from '../pages/short-drama/utils/productParseErrors';
import type {
  AssetImageBatchResponseDto,
  CreateShortDramaProjectResponseDto,
  CreativeBriefDto,
  CreativeIntentInputDto,
  GenerateCreativeBriefResponseDto,
  GenerateAssetSpecsResponseDto,
  GenerateSegmentScriptsResponseDto,
  GenerateStoryResponseDto,
  MergeVideoResponseDto,
  ParseProductResponseDto,
  ProjectEntryRedirectResponseDto,
  PipelineSummaryDto,
  ProductInputPayload,
  ProductInputDto,
  RenderJobStatusResponseDto,
  RegenerateOneAssetImageBody,
  RegenerateOneAssetImageResponseDto,
  AssetLibraryItemDto,
  AssetLibraryListResponseDto,
  AssetLibrarySummaryListResponseDto,
  AnalyzeAssetReferenceImageBody,
  AnalyzeAssetReferenceImageResponseDto,
  CreateAssetFromImageBody,
  CreateAssetLibraryBody,
  ShortDramaProjectDto,
  ShortDramaProjectListResponseDto,
  SaveCreativeIntentResponseDto,
  SaveProductInputResponseDto,
  SingleSegmentVideoResponseDto,
  UpdateProductContextResponseDto,
  UpdateAssetBody,
  UpdateAssetResponseDto,
  VideoBatchSummaryResponseDto,
  TouchProjectStepBody,
  UpdateSegmentShotBody,
  UpdateSegmentShotResponseDto,
} from '../types/shortDramaApi';

export class ShortDramaApiError extends Error {
  readonly status: number;
  readonly detail?: unknown;
  readonly response?: unknown;

  constructor(message: string, status: number, detail?: unknown, response?: unknown) {
    super(message);
    this.name = 'ShortDramaApiError';
    this.status = status;
    this.detail = detail;
    this.response = response;
  }
}

function joinUrl(path: string): string {
  const base = API_BASE_URL.replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

function formatShortDramaDetailObject(d: Record<string, unknown>): string {
  const userMsg = typeof d.user_message === 'string' ? d.user_message : '';
  if (userMsg.trim()) return userMsg.trim();
  const msg = typeof d.message === 'string' ? d.message : '';
  const seg = d.segment_id != null && d.segment_id !== '' ? `segment=${String(d.segment_id)}` : '';
  const shot = d.shot_id != null && d.shot_id !== '' ? `shot=${String(d.shot_id)}` : '';
  const mfRaw = d.missing_fields;
  const mf =
    Array.isArray(mfRaw) && mfRaw.length
      ? `missing fields=${mfRaw.map((x) => String(x)).join(', ')}`
      : '';
  const parts = [msg, seg, shot, mf].filter(Boolean);
  return parts.length ? parts.join(' · ') : JSON.stringify(d);
}

async function parseErrorDetail(res: Response): Promise<{ message: string; detail?: unknown; response?: unknown }> {
  const text = await res.text();
  const promptTooLongMessage = '视频生成提示词过长，系统已自动压缩。请重试。';
  const looksPromptTooLong = (value: string) =>
    /prompt length exceeds|maximum allowed length of 4096|提示词过长/i.test(value);
  try {
    const j = JSON.parse(text) as { detail?: unknown };
    if (typeof j.detail === 'string') {
      return {
        message: looksPromptTooLong(j.detail) ? promptTooLongMessage : j.detail,
        detail: j.detail,
        response: j,
      };
    }
    if (Array.isArray(j.detail)) {
      const message = j.detail
        .map((x) => (typeof x === 'object' && x && 'msg' in x ? String((x as { msg: unknown }).msg) : String(x)))
        .join('; ');
      return { message, detail: j.detail, response: j };
    }
    if (typeof j.detail === 'object' && j.detail !== null && !Array.isArray(j.detail)) {
      const formatted = formatShortDramaDetailObject(j.detail as Record<string, unknown>);
      return {
        message: looksPromptTooLong(formatted) ? promptTooLongMessage : formatted,
        detail: j.detail,
        response: j,
      };
    }
    return { message: text.slice(0, 400) || res.statusText || `HTTP ${res.status}`, detail: j.detail, response: j };
  } catch {
    return {
      message: looksPromptTooLong(text) ? promptTooLongMessage : text.slice(0, 400) || res.statusText || `HTTP ${res.status}`,
      detail: text,
      response: text,
    };
  }
}

async function sdFetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(joinUrl(path), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const parsed = await parseErrorDetail(res);
    throw new ShortDramaApiError(parsed.message, res.status, parsed.detail, parsed.response);
  }
  return res.json() as Promise<T>;
}

export type CreateProjectBody = {
  user_id: number;
  project_name: string;
  duration?: string | null;
  format?: string | null;
  style?: string | string[] | null;
  visual_style?: string | null;
  aspect_ratio?: string | null;
  target_market?: string | null;
  marketing_goal?: string | null;
  target_audience?: string | null;
  brand_tone?: string | null;
  creative_intent?: string | null;
  creative_brief?: string | null;
  workflow_language?: string | null;
  video_language?: string | null;
};

export async function createShortDramaProject(body: CreateProjectBody): Promise<CreateShortDramaProjectResponseDto> {
  return sdFetchJson<CreateShortDramaProjectResponseDto>('/api/short-drama/project', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function getShortDramaProject(projectId: number): Promise<ShortDramaProjectDto> {
  return sdFetchJson<ShortDramaProjectDto>(`/api/short-drama/project/${projectId}`);
}

export async function saveShortDramaCreativeIntent(
  projectId: number,
  body: CreativeIntentInputDto,
): Promise<SaveCreativeIntentResponseDto> {
  return sdFetchJson<SaveCreativeIntentResponseDto>(`/api/short-drama/project/${projectId}/creative-intent`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function saveShortDramaProductInput(
  projectId: number,
  body: ProductInputDto,
): Promise<SaveProductInputResponseDto> {
  return sdFetchJson<SaveProductInputResponseDto>(`/api/short-drama/project/${projectId}/product-input`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function generateShortDramaCreativeBrief(
  projectId: number,
): Promise<GenerateCreativeBriefResponseDto> {
  return sdFetchJson<GenerateCreativeBriefResponseDto>(`/api/short-drama/project/${projectId}/creative-brief/generate`, {
    method: 'POST',
  });
}

export type { CreativeBriefDto, CreativeIntentInputDto, ProductInputDto };

export async function listShortDramaProjects(userId: number): Promise<ShortDramaProjectListResponseDto> {
  return sdFetchJson<ShortDramaProjectListResponseDto>(`/api/short-drama/project?user_id=${encodeURIComponent(String(userId))}`);
}

export async function getShortDramaProjectEntry(projectId: number): Promise<ProjectEntryRedirectResponseDto> {
  return sdFetchJson<ProjectEntryRedirectResponseDto>(`/api/short-drama/project/${projectId}/entry`);
}

export async function touchShortDramaProjectStep(
  projectId: number,
  body: TouchProjectStepBody,
): Promise<ShortDramaProjectDto> {
  return sdFetchJson<ShortDramaProjectDto>(`/api/short-drama/project/${projectId}/touch-step`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function getShortDramaPipeline(
  projectId: number,
  options?: { signal?: AbortSignal; lightweight?: boolean },
): Promise<PipelineSummaryDto> {
  const lightweight = options?.lightweight ? '?lightweight=true' : '';
  return sdFetchJson<PipelineSummaryDto>(`/api/short-drama/project/${projectId}/pipeline${lightweight}`, {
    signal: options?.signal,
  });
}

export async function parseShortDramaProduct(
  projectId: number,
  input: ProductInputPayload,
  reparseMode: 'replace_all' | 'preserve_user_edited' = 'replace_all',
): Promise<ParseProductResponseDto> {
  try {
    return await sdFetchJson<ParseProductResponseDto>('/api/short-drama/product/parse', {
      method: 'POST',
      body: JSON.stringify({ project_id: projectId, input, reparse_mode: reparseMode }),
    });
  } catch (e) {
    if (!(e instanceof ShortDramaApiError)) throw e;
    if (
      e.status === 502 ||
      e.status === 503 ||
      /upstream_unavailable/i.test(e.message) ||
      /service temporarily unavailable/i.test(e.message)
    ) {
      console.warn('[S1_PARSE_UPSTREAM_UNAVAILABLE]', { status: e.status, detail: e.message });
      throw new ShortDramaApiError(PRODUCT_PARSE_UPSTREAM_UNAVAILABLE_MESSAGE, e.status);
    }
    if (/^Product parse failed$/i.test(e.message)) {
      throw new ShortDramaApiError(PRODUCT_PARSE_GENERIC_MESSAGE, e.status);
    }
    if (/Internal Server Error/i.test(e.message) || e.status === 500) {
      throw new ShortDramaApiError(PRODUCT_PARSE_SERVICE_UNAVAILABLE_MESSAGE, e.status);
    }
    throw e;
  }
}

export async function updateShortDramaProductContext(
  projectId: number,
  productContext: Record<string, unknown>,
): Promise<UpdateProductContextResponseDto> {
  return sdFetchJson<UpdateProductContextResponseDto>('/api/short-drama/product/context', {
    method: 'PATCH',
    body: JSON.stringify({ project_id: projectId, product_context: productContext }),
  });
}

export async function generateShortDramaStory(projectId: number): Promise<GenerateStoryResponseDto> {
  return sdFetchJson<GenerateStoryResponseDto>('/api/short-drama/story/generate', {
    method: 'POST',
    body: JSON.stringify({ project_id: projectId }),
  });
}

export type AssetSpecsCallMeta = {
  /** auto: 首屏；retry_button：手动重试；next_button：底部下一步兜底 */
  trigger?: 'auto' | 'retry_button' | 'next_button';
};

export async function generateShortDramaAssetSpecs(
  projectId: number,
  meta: AssetSpecsCallMeta = {},
): Promise<GenerateAssetSpecsResponseDto> {
  const trigger = meta.trigger ?? 'auto';
  console.info(`[FE_ASSET_SPECS_REQUEST] projectId=${projectId} trigger=${trigger}`);
  try {
    const res = await sdFetchJson<GenerateAssetSpecsResponseDto>('/api/short-drama/assets/specs/generate', {
      method: 'POST',
      body: JSON.stringify({ project_id: projectId }),
    });
    const nc = res.assets?.characters?.length ?? 0;
    const ns = res.assets?.scenes?.length ?? 0;
    const np = res.assets?.products?.length ?? 0;
    console.info(`[FE_ASSET_SPECS_SUCCESS] projectId=${projectId} trigger=${trigger} characters=${nc} scenes=${ns} products=${np}`);
    return res;
  } catch (e) {
    const msg = e instanceof ShortDramaApiError ? `${e.message} status=${e.status}` : String(e);
    console.warn(`[FE_ASSET_SPECS_ERROR] projectId=${projectId} trigger=${trigger} ${msg}`);
    throw e;
  }
}

export async function generateShortDramaAssetImages(projectId: number): Promise<AssetImageBatchResponseDto> {
  return sdFetchJson<AssetImageBatchResponseDto>('/api/short-drama/assets/images/generate', {
    method: 'POST',
    body: JSON.stringify({ project_id: projectId }),
  });
}

export async function updateShortDramaAsset(
  assetType: 'character' | 'scene' | 'product',
  assetId: number,
  body: UpdateAssetBody,
): Promise<UpdateAssetResponseDto> {
  return sdFetchJson<UpdateAssetResponseDto>(
    `/api/short-drama/assets/specs/${encodeURIComponent(assetType)}/${assetId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(body),
    },
  );
}

export async function regenerateShortDramaOneAssetImage(
  body: RegenerateOneAssetImageBody,
): Promise<RegenerateOneAssetImageResponseDto> {
  return sdFetchJson<RegenerateOneAssetImageResponseDto>('/api/short-drama/assets/images/regenerate-one', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function listShortDramaAssetLibrary(
  projectId: number,
  assetType: 'character' | 'scene' | 'product',
): Promise<AssetLibraryListResponseDto> {
  return sdFetchJson<AssetLibraryListResponseDto>(`/api/short-drama/assets/specs/library/${projectId}/${assetType}`);
}

export async function listShortDramaGlobalAssetLibrary(
  userId: number,
  assetType: 'character' | 'scene' | 'product',
): Promise<AssetLibrarySummaryListResponseDto> {
  const q = `user_id=${encodeURIComponent(String(userId))}&asset_type=${encodeURIComponent(assetType)}`;
  return sdFetchJson<AssetLibrarySummaryListResponseDto>(`/api/short-drama/assets/specs/library?${q}`);
}

export async function getShortDramaAssetLibraryDetail(projectId: number, assetId: number): Promise<AssetLibraryItemDto> {
  const path = `/api/short-drama/assets/specs/library/detail/${assetId}?project_id=${encodeURIComponent(String(projectId))}`;
  console.info('[S3_API_DETAIL_CALL]', JSON.stringify({
    path,
    asset_id: assetId,
    asset_id_type: typeof assetId,
    project_id: projectId,
    project_id_type: typeof projectId,
  }));
  return sdFetchJson<AssetLibraryItemDto>(path);
}

export async function createShortDramaAssetLibrary(body: CreateAssetLibraryBody): Promise<AssetLibraryItemDto> {
  return sdFetchJson<AssetLibraryItemDto>('/api/short-drama/assets/specs/library', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function regenerateShortDramaAssetLibrary(body: {
  project_id: number;
  asset_id: number;
  reuse_reference_images?: boolean;
  reference_images?: { file_url: string; file_name?: string }[];
  generate_count?: number;
  variant_directions?: string[];
  image_description_override?: string;
  current_image_prompt?: string;
  base_prompt?: string;
}): Promise<AssetLibraryItemDto> {
  return sdFetchJson<AssetLibraryItemDto>('/api/short-drama/assets/specs/library/regenerate', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function appendShortDramaAssetUploadedImages(
  assetId: number,
  body: { project_id: number; uploaded_images: { file_url: string; file_name?: string }[] },
): Promise<AssetLibraryItemDto> {
  return sdFetchJson<AssetLibraryItemDto>(`/api/short-drama/assets/specs/library/${assetId}/uploaded-images`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function analyzeShortDramaAssetReferenceImage(
  assetId: number,
  body: AnalyzeAssetReferenceImageBody,
): Promise<AnalyzeAssetReferenceImageResponseDto> {
  return sdFetchJson<AnalyzeAssetReferenceImageResponseDto>(`/api/short-drama/assets/specs/library/${assetId}/reference-image/analyze`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function createShortDramaAssetFromImage(
  body: CreateAssetFromImageBody,
): Promise<AssetLibraryItemDto> {
  return sdFetchJson<AssetLibraryItemDto>('/api/short-drama/assets/specs/library/create-from-image', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function updateShortDramaAssetLibrary(
  assetId: number,
  body: {
    project_id: number;
    name?: string;
    description?: string;
    tags?: string[];
    base_prompt?: string;
    type_fields?: Record<string, unknown>;
  },
): Promise<AssetLibraryItemDto> {
  return sdFetchJson<AssetLibraryItemDto>(`/api/short-drama/assets/specs/library/${assetId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function setShortDramaAssetLibraryCover(
  assetId: number,
  body: { project_id: number; image_id: number },
): Promise<AssetLibraryItemDto> {
  return sdFetchJson<AssetLibraryItemDto>(`/api/short-drama/assets/specs/library/${assetId}/cover`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function deleteShortDramaAssetLibraryImage(projectId: number, imageId: number): Promise<AssetLibraryItemDto> {
  return sdFetchJson<AssetLibraryItemDto>(
    `/api/short-drama/assets/specs/library/image/${imageId}?project_id=${encodeURIComponent(String(projectId))}`,
    { method: 'DELETE' },
  );
}

export async function deleteShortDramaAssetLibrary(projectId: number, assetId: number): Promise<{ ok: boolean; asset_id: number }> {
  return sdFetchJson<{ ok: boolean; asset_id: number }>(
    `/api/short-drama/assets/specs/library/${assetId}?project_id=${encodeURIComponent(String(projectId))}`,
    { method: 'DELETE' },
  );
}

export async function generateShortDramaSegmentScripts(projectId: number): Promise<GenerateSegmentScriptsResponseDto> {
  return sdFetchJson<GenerateSegmentScriptsResponseDto>('/api/short-drama/segment/generate', {
    method: 'POST',
    body: JSON.stringify({ project_id: projectId }),
  });
}

export async function updateShortDramaSegmentShot(
  segmentId: string,
  shotId: string,
  body: UpdateSegmentShotBody,
): Promise<UpdateSegmentShotResponseDto> {
  return sdFetchJson<UpdateSegmentShotResponseDto>(
    `/api/short-drama/segment/${encodeURIComponent(segmentId)}/shots/${encodeURIComponent(shotId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(body),
    },
  );
}

export async function generateShortDramaSegmentVideos(projectId: number): Promise<VideoBatchSummaryResponseDto> {
  return sdFetchJson<VideoBatchSummaryResponseDto>('/api/short-drama/videos/generate', {
    method: 'POST',
    body: JSON.stringify({ project_id: projectId }),
  });
}

export async function generateShortDramaSingleSegmentVideo(
  projectId: number,
  segmentId: string,
): Promise<SingleSegmentVideoResponseDto> {
  return sdFetchJson<SingleSegmentVideoResponseDto>(
    `/api/short-drama/videos/generate/${encodeURIComponent(segmentId)}`,
    {
      method: 'POST',
      body: JSON.stringify({ project_id: projectId, segment_id: segmentId }),
    },
  );
}

export async function getShortDramaRenderJob(jobId: number, options?: { signal?: AbortSignal }): Promise<RenderJobStatusResponseDto> {
  return sdFetchJson<RenderJobStatusResponseDto>(`/api/short-drama/videos/render-jobs/${jobId}`, {
    signal: options?.signal,
  });
}

export async function mergeShortDramaProjectVideo(projectId: number): Promise<MergeVideoResponseDto> {
  return sdFetchJson<MergeVideoResponseDto>('/api/short-drama/videos/merge', {
    method: 'POST',
    body: JSON.stringify({ project_id: projectId }),
  });
}

/** GET zip（视频包 / 一键全部导出），返回 Blob；失败抛 ShortDramaApiError */
export async function fetchShortDramaExportZip(projectId: number, kind: 'videos' | 'all'): Promise<Blob> {
  const path =
    kind === 'videos'
      ? `/api/short-drama/project/${projectId}/export/videos`
      : `/api/short-drama/project/${projectId}/export/all`;
  const res = await fetch(joinUrl(path), { method: 'GET' });
  if (!res.ok) {
    const parsed = await parseErrorDetail(res);
    throw new ShortDramaApiError(parsed.message, res.status, parsed.detail, parsed.response);
  }
  return res.blob();
}
