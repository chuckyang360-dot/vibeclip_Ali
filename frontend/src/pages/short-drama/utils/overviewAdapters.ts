import type { PipelineSummaryDto, SegmentScriptPipelineRowDto, StoryBlueprintDto } from '@/types/shortDramaApi';
import { resolveAssetImageUrl, } from './assetsPageAdapters';
import { NEUTRAL_VERTICAL_POSTER, resolvePublicMediaUrl } from './shortDramaMedia';
import { segmentScriptDtoToStepSegmentViewModel } from './stepFourAdapters';
import { formatZhLabel, storyStyleZhLabel, targetMarketZhLabel, visualStyleZhLabel } from './projectLocales';

const EM_DASH = '—';

export type OverviewProjectBannerVm = {
  name: string;
  createdAt: string;
  duration: string;
  format: string;
  ratio: string;
  style: string;
  visualStyle: string;
  market: string;
  status: string;
  statusBadge: 'completed' | 'in_progress' | 'draft';
};

export type OverviewCharacterRowVm = {
  name: string;
  role: string;
  img: string | null;
};

export type OverviewSegmentCardVm = {
  id: number;
  name: string;
  duration: string;
  color: string;
  posterUrl: string;
  videoUrl: string | null;
  hasVideo: boolean;
};

export type OverviewPageViewModel = {
  project: OverviewProjectBannerVm;
  plotSummary: string;
  characters: OverviewCharacterRowVm[];
  scenes: string[];
  products: string[];
  segments: OverviewSegmentCardVm[];
  finalVideoUrl: string | null;
  finalVideoPoster: string;
  finalMetaChip: string;
};

function formatDate(iso: string | undefined | null): string {
  if (!iso) return EM_DASH;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

export function storyBlueprintToOverviewSummary(blueprint: StoryBlueprintDto | null | undefined): string {
  if (!blueprint) return '';
  const parts = [
    blueprint.premise,
    blueprint.hook,
    blueprint.core_conflict,
    blueprint.twist,
    blueprint.resolution,
  ]
    .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    .map((x) => x.trim());
  return parts.length ? parts.join(' ') : '';
}

export function assetsToOverviewStrip(
  pipeline: PipelineSummaryDto | null,
): Pick<OverviewPageViewModel, 'characters' | 'scenes' | 'products'> {
  const assets = pipeline?.assets;
  if (!assets) {
    return { characters: [], scenes: [], products: [] };
  }

  const characters: OverviewCharacterRowVm[] = assets.characters.map((c) => {
    const { src } = resolveAssetImageUrl(c.image_url,);
    return { name: c.name, role: c.role_type || '角色', img: src };
  });

  const scenes = assets.scenes.map((s) => (s.scene_type ? `${s.name} · ${s.scene_type}` : s.name));

  const products = assets.products.map((p) => p.name);

  return { characters, scenes, products };
}

/** Resolve final merged video URL from pipeline (field-compat for historical responses). */
export function resolveFinalVideoUrlFromPipeline(pipeline: PipelineSummaryDto | null): string | null {
  if (!pipeline) return null;
  const p = pipeline as PipelineSummaryDto & {
    output_url?: string | null;
    result_url?: string | null;
    merged_video_url?: string | null;
    final_video?: { video_url?: string | null; final_video_url?: string | null; output_url?: string | null } | null;
  };
  const nested = p.final_video;
  const raw =
    pipeline.final_video_url ||
    nested?.video_url ||
    nested?.final_video_url ||
    nested?.output_url ||
    p.output_url ||
    p.result_url ||
    p.merged_video_url ||
    null;
  return resolvePublicMediaUrl(raw);
}

function truncateDisplayUrl(url: string, max = 56): string {
  if (url.length <= max) return url;
  return `${url.slice(0, max - 1)}…`;
}

export function formatFinalVideoAddressDisplay(
  finalVideoUrl: string | null,
  isMockTestPatternVideo: boolean,
): string {
  if (isMockTestPatternVideo) return '测试视频（ffmpeg 测试条拼接）';
  if (!finalVideoUrl) return EM_DASH;
  return truncateDisplayUrl(finalVideoUrl);
}

export function segmentsToOverviewPreview(pipeline: PipelineSummaryDto | null): OverviewSegmentCardVm[] {
  const rowsRaw = pipeline?.segment_scripts;
  const rows: SegmentScriptPipelineRowDto[] = Array.isArray(rowsRaw)
    ? rowsRaw.filter((r): r is SegmentScriptPipelineRowDto => r != null && typeof r === 'object' && 'segment_id' in r)
    : [];

  if (rows.length === 0) return [];

  const sorted = [...rows].sort((a, b) => {
    const na = parseInt(String(a.segment_id).replace(/\D/g, ''), 10) || 0;
    const nb = parseInt(String(b.segment_id).replace(/\D/g, ''), 10) || 0;
    return na - nb;
  });

  return sorted.map((row, index) => {
    const vm = segmentScriptDtoToStepSegmentViewModel(row, index);
    const abs = resolvePublicMediaUrl(vm.videoUrl);
    return {
      id: vm.id,
      name: vm.name,
      duration: vm.duration,
      color: vm.color,
      posterUrl: NEUTRAL_VERTICAL_POSTER,
      videoUrl: abs,
      hasVideo: !!abs,
    };
  });
}

export function pipelineToOverviewViewModel(pipeline: PipelineSummaryDto | null): OverviewPageViewModel {
  const bp = pipeline?.story_blueprint?.blueprint ?? null;
  const plotSummary = storyBlueprintToOverviewSummary(bp);

  const { characters, scenes, products } = assetsToOverviewStrip(pipeline);
  const segments = segmentsToOverviewPreview(pipeline);

  const proj = pipeline?.project;
  const finalAbs = resolveFinalVideoUrlFromPipeline(pipeline);

  const duration = proj?.duration?.trim() || EM_DASH;
  const format = formatZhLabel(proj?.format);
  const ratio = proj?.aspect_ratio?.trim() || EM_DASH;
  const style = storyStyleZhLabel(proj?.style);
  const visualStyle = visualStyleZhLabel(proj?.visual_style);

  let market = targetMarketZhLabel(proj?.target_market ?? 'North America');
  const norm = pipeline?.product_context && (pipeline.product_context as { normalized?: unknown }).normalized;
  if (norm && typeof norm === 'object' && !Array.isArray(norm)) {
    const n = norm as Record<string, unknown>;
    const m = n.target_markets ?? n.markets;
    if (Array.isArray(m) && m.length && typeof m[0] === 'string') market = targetMarketZhLabel(m[0]);
    else if (typeof m === 'string' && m.trim()) market = targetMarketZhLabel(m.trim());
  }

  const status = proj?.status ?? '';
  let statusBadge: OverviewProjectBannerVm['statusBadge'] = 'draft';
  if (finalAbs) statusBadge = 'completed';
  else if (status === 'video_rendering' || status === 'assets_ready') statusBadge = 'in_progress';

  const project: OverviewProjectBannerVm = {
    name: proj?.project_name?.trim() || EM_DASH,
    createdAt: formatDate(proj?.created_at),
    duration,
    format,
    ratio,
    style,
    visualStyle,
    market,
    status,
    statusBadge,
  };

  const finalMetaChip = `${duration} · ${ratio} · ${visualStyle}`;

  return {
    project,
    plotSummary,
    characters,
    scenes,
    products,
    segments,
    finalVideoUrl: finalAbs,
    finalVideoPoster: NEUTRAL_VERTICAL_POSTER,
    finalMetaChip,
  };
}
