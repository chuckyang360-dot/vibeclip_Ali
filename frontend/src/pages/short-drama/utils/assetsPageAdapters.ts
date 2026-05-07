import { API_BASE_URL } from '../../../config/api';
import type {
  AssetsPageCharacterVm,
  AssetsPageProductVm,
  AssetsPageSceneVm,
  AssetsPageViewModel,
} from '@/types/shortDrama';
import type {
  AssetImageDto,
  AssetLibraryItemDto,
  AssetReferenceImageDto,
  PipelineAssetsBundleDto,
  PipelineCharacterAssetDto,
  PipelineProductAssetDto,
  PipelineSceneAssetDto,
  PipelineSummaryDto,
} from '@/types/shortDramaApi';
import { SHORT_DRAMA_UI } from './shortDramaUiCopy';
import { resolveShortDramaMediaUrl } from './shortDramaMedia';

export const ASSETS_PAGE_MESSAGES = SHORT_DRAMA_UI.assets;

function isLikelyRenderableUrl(input: string): boolean {
  const u = input.trim().toLowerCase();
  if (!u) return false;
  if (u.startsWith('javascript:')) return false;
  if (u.includes('undefined') || u.includes('null')) return false;
  if (u.endsWith('.svg') || u.endsWith('.txt') || u.endsWith('.json')) return false;
  return true;
}

function maybeRewriteLocalStaticAbsoluteUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) return trimmed;
  try {
    const u = new URL(trimmed);
    const isLocalHost = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
    const isShortDramaStatic = u.pathname.startsWith('/static/short-drama-');
    const base = API_BASE_URL.replace(/\/$/, '');
    if (!isLocalHost || !isShortDramaStatic || !base) return trimmed;
    return `${base}${u.pathname}${u.search}${u.hash}`;
  } catch {
    return trimmed;
  }
}

export function resolveAssetImageUrl(imageUrl: string | null | undefined): { src: string | null; hasRealImage: boolean } {
  const u = imageUrl?.trim();
  if (!u || !isLikelyRenderableUrl(u)) return { src: null, hasRealImage: false };
  if (u.startsWith('data:') || u.startsWith('blob:')) return { src: isLikelyRenderableUrl(u) ? u : null, hasRealImage: true };
  if (u.startsWith('http://') || u.startsWith('https://')) {
    const rewritten = maybeRewriteLocalStaticAbsoluteUrl(u);
    return { src: isLikelyRenderableUrl(rewritten) ? rewritten : null, hasRealImage: true };
  }
  const resolved = resolveShortDramaMediaUrl(u);
  return { src: resolved && isLikelyRenderableUrl(resolved) ? resolved : null, hasRealImage: true };
}

type ThumbnailLikeAsset = {
  image_url?: string | null;
  imageUrl?: string | null;
  cover_image_id?: number | null;
  cover_image?: Partial<AssetImageDto> | null;
  images?: Partial<AssetImageDto>[];
  reference_images?: Partial<AssetReferenceImageDto>[];
};

function isActiveStatus(status: unknown): boolean {
  return String(status || 'active').toLowerCase() === 'active';
}

function resolveMaybeImageUrl(value: string | null | undefined): string | null {
  return resolveAssetImageUrl(value).src;
}

export function getAssetThumbnailUrl(asset: ThumbnailLikeAsset | AssetLibraryItemDto | null | undefined): string | null {
  if (!asset) return null;
  const cover = asset.cover_image;
  if (cover && isActiveStatus(cover.status)) {
    const src = resolveMaybeImageUrl(typeof cover.image_url === 'string' ? cover.image_url : null);
    if (src) return src;
  }

  const images = (asset.images ?? []).filter((img) => isActiveStatus(img.status));
  const coverId = typeof asset.cover_image_id === 'number' ? asset.cover_image_id : Number(asset.cover_image_id);
  if (Number.isInteger(coverId) && coverId > 0) {
    const byCoverId = images.find((img) => img.id === coverId);
    const src = resolveMaybeImageUrl(typeof byCoverId?.image_url === 'string' ? byCoverId.image_url : null);
    if (src) return src;
  }

  for (const img of images) {
    const src = resolveMaybeImageUrl(typeof img.image_url === 'string' ? img.image_url : null);
    if (src) return src;
  }

  for (const ref of asset.reference_images ?? []) {
    if (!isActiveStatus(ref.status)) continue;
    const src = resolveMaybeImageUrl(typeof ref.file_url === 'string' ? ref.file_url : null);
    if (src) return src;
  }

  const legacyImageUrl =
    'image_url' in asset && typeof asset.image_url === 'string'
      ? asset.image_url
      : 'imageUrl' in asset && typeof asset.imageUrl === 'string'
        ? asset.imageUrl
        : null;
  return resolveMaybeImageUrl(legacyImageUrl);
}

function metaRecord(meta: unknown): Record<string, unknown> {
  return meta && typeof meta === 'object' && !Array.isArray(meta) ? (meta as Record<string, unknown>) : {};
}

function pickString(meta: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = meta[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
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
    '符合目标市场与受众的角色设定',
    '单一地点场景：',
    '可复用的单一空间场景',
    '产品资产',
    '结构摘要待完善',
    '场景形态待完善',
  ];
  if (blocked.some((k) => lower.includes(k))) return '';
  return raw;
}

function tagsFromMeta(meta: Record<string, unknown>, fallback: string[]): string[] {
  const t = meta['tags'] ?? meta['trait_tags'] ?? meta['traitTags'];
  if (Array.isArray(t) && t.length) return t.map(String).filter(Boolean).slice(0, 8);
  if (typeof t === 'string' && t.trim()) return t.split(/[,，、]/).map((s) => s.trim()).filter(Boolean).slice(0, 8);
  return fallback.length ? fallback : ['资产规范'];
}

export function characterAssetDtoToViewModel(row: PipelineCharacterAssetDto): AssetsPageCharacterVm {
  const meta = metaRecord(row.meta);
  const src = getAssetThumbnailUrl(row);
  const voice =
    pickString(meta, ['voice_style', 'voiceStyle', 'voice']) ||
    (row.role_type?.includes('主') ? '未指定（主角）' : '未指定');
  const visual = (row.visual_prompt ?? '').trim();
  const displayName = cleanDisplayText(pickString(meta, ['display_name'])) || cleanDisplayText(row.name?.trim() || '') || '东南亚通勤青年主角';
  const displayDesc = cleanDisplayText(pickString(meta, ['display_description'])) || cleanDisplayText((row.description ?? '').trim()) || '一位生活在东南亚城市的年轻通勤者，注重穿搭和日常便利。';
  return {
    id: row.id,
    name: displayName,
    role: row.role_type?.trim() || '—',
    desc: displayDesc,
    tags: tagsFromMeta(meta, visual ? [visual.slice(0, 24)] : []),
    voice,
    img: src,
    hasRealImage: Boolean(src),
    visualPrompt: cleanDisplayText(pickString(meta, ['image_prompt'])) || visual || '—',
  };
}

export function sceneAssetDtoToViewModel(row: PipelineSceneAssetDto): AssetsPageSceneVm {
  const meta = metaRecord(row.meta);
  const src = getAssetThumbnailUrl(row);
  const visual = (row.visual_prompt ?? '').trim();
  const type = (row.scene_type ?? '').trim() || pickString(meta, ['sceneType', 'type']) || '场景';
  const displayName = cleanDisplayText(pickString(meta, ['display_name'])) || cleanDisplayText(row.name?.trim() || '') || '清晨地铁站通勤走廊';
  const displayDesc = cleanDisplayText(pickString(meta, ['display_description'])) || cleanDisplayText((row.description ?? '').trim()) || '暂无描述';
  return {
    id: row.id,
    name: displayName,
    type,
    desc: displayDesc,
    img: src,
    hasRealImage: Boolean(src),
    visualPrompt: cleanDisplayText(pickString(meta, ['image_prompt'])) || visual || '—',
  };
}

export function productAssetDtoToViewModel(row: PipelineProductAssetDto): AssetsPageProductVm {
  const meta = metaRecord(row.meta);
  const src = getAssetThumbnailUrl(row);
  const desc = cleanDisplayText(pickString(meta, ['display_description'])) || cleanDisplayText((row.description ?? '').trim()) || '主商品展示资产，突出金属边框、透明背板与旋转支架细节。';
  const visual = (row.visual_prompt ?? '').trim();
  const placement =
    pickString(meta, ['placement', 'shot_use', 'shotUse', 'use_mode', 'useMode']) ||
    (desc.length > 0 && desc !== '—' ? desc.slice(0, 80) : '产品出镜方式见描述');
  const cameraHint =
    visual.length > 0 ? (visual.length > 120 ? `${visual.slice(0, 120)}…` : visual) : '见视觉 Prompt / 描述';
  return {
    id: row.id,
    name: cleanDisplayText(pickString(meta, ['display_name'])) || cleanDisplayText(row.name?.trim() || '') || 'iPhone透明支架手机壳',
    placement,
    cameraHint,
    desc,
    img: src,
    hasRealImage: Boolean(src),
  };
}

export function assetsBundleEmpty(assets: PipelineSummaryDto['assets'] | null | undefined): boolean {
  if (!assets) return true;
  const c = assets.characters?.length ?? 0;
  const s = assets.scenes?.length ?? 0;
  const p = assets.products?.length ?? 0;
  return c === 0 && s === 0 && p === 0;
}

/** 三者均有行才算「规范齐套」；任一非空但总未齐套为 partial；全空为 empty */
export type AssetsBundleCompleteness = 'empty' | 'partial' | 'complete';

export function getAssetsBundleCompleteness(
  assets: PipelineSummaryDto['assets'] | null | undefined,
): AssetsBundleCompleteness {
  if (!assets) return 'empty';
  const c = assets.characters?.length ?? 0;
  const s = assets.scenes?.length ?? 0;
  const p = assets.products?.length ?? 0;
  if (c > 0 && s > 0 && p > 0) return 'complete';
  if (c === 0 && s === 0 && p === 0) return 'empty';
  return 'partial';
}

/** 将 pipeline.assets 转为 Assets 页可直接绑定的视图模型 */
export function pipelineAssetsToAssetsPageViewModel(
  assets: PipelineAssetsBundleDto | null | undefined,
): AssetsPageViewModel {
  if (!assets) {
    return { characters: [], scenes: [], products: [] };
  }
  return {
    characters: (assets.characters ?? []).map((r) => characterAssetDtoToViewModel(r)),
    scenes: (assets.scenes ?? []).map((r) => sceneAssetDtoToViewModel(r)),
    products: (assets.products ?? []).map((r) => productAssetDtoToViewModel(r)),
  };
}

export function assetsPageViewModelEmpty(vm: AssetsPageViewModel): boolean {
  return vm.characters.length === 0 && vm.scenes.length === 0 && vm.products.length === 0;
}
