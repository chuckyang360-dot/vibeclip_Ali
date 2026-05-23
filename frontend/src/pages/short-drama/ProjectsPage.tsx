import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getUser } from '../../services/api';
import { ProjectCoverImage } from './components/ProjectCoverImage';
import { ShortDramaLayout } from './components/ShortDramaLayout';
import { listShortDramaAssetLibrary, listShortDramaProjects, ShortDramaApiError } from '@/services/shortDramaApi';
import type { AssetLibraryItemDto, AssetLibrarySummaryDto, ShortDramaProjectDto } from '@/types/shortDramaApi';
import { resolveAssetImageUrl } from './utils/assetsPageAdapters';

const PAGE_SIZE = 6;

type ProjectStatusFilter = 'all' | 'draft' | 'generating' | 'stale' | 'completed' | 'failed';
type ManagementModule = 'projects' | 'characters' | 'scenes' | 'products';
type AssetModule = Exclude<ManagementModule, 'projects'>;
type AssetImageFilter = 'all' | 'with_image' | 'without_image';
type AssetSortKey = 'recent' | 'oldest' | 'name_az';

type AssetFilterState = {
  query: string;
  imageStatus: AssetImageFilter;
  sourceProject: string;
  sort: AssetSortKey;
};

const STATUS_FILTERS: { key: ProjectStatusFilter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'draft', label: '草稿' },
  { key: 'generating', label: '生成中' },
  { key: 'stale', label: '需更新' },
  { key: 'completed', label: '已完成' },
  { key: 'failed', label: '异常' },
];

const MANAGEMENT_MODULES: {
  key: ManagementModule;
  title: string;
  shortTitle: string;
  icon: string;
  description: string;
}[] = [
  {
    key: 'projects',
    title: '项目管理',
    shortTitle: '项目管理',
    icon: 'ri-folder-3-line',
    description: '查看、继续编辑、删除、复制项目，管理每个短剧项目的创作进度。',
  },
  {
    key: 'characters',
    title: '人物资产管理',
    shortTitle: '人物资产',
    icon: 'ri-user-star-line',
    description: '管理可复用的人物角色资产，包括角色图、角色描述、风格标签、使用记录。',
  },
  {
    key: 'scenes',
    title: '场景资产管理',
    shortTitle: '场景资产',
    icon: 'ri-landscape-line',
    description: '管理可复用场景资产，包括场景图、场景描述、适用风格、使用记录。',
  },
  {
    key: 'products',
    title: '产品资产管理',
    shortTitle: '产品资产',
    icon: 'ri-archive-line',
    description: '管理商品/产品资产，包括产品图、产品描述、卖点信息、使用记录。',
  },
];

const ASSET_MODULE_META: Record<AssetModule, {
  title: string;
  icon: string;
  emptyTitle: string;
  emptyHint: string;
  searchPlaceholder: string;
}> = {
  characters: {
    title: '人物资产',
    icon: 'ri-user-star-line',
    emptyTitle: '暂无人物资产',
    emptyHint: '项目中生成的人物角色，后续会在这里汇总展示。',
    searchPlaceholder: '搜索人物名称、描述、来源项目',
  },
  scenes: {
    title: '场景资产',
    icon: 'ri-landscape-line',
    emptyTitle: '暂无场景资产',
    emptyHint: '项目中生成的场景资产，后续会在这里汇总展示。',
    searchPlaceholder: '搜索场景名称、描述、来源项目',
  },
  products: {
    title: '产品资产',
    icon: 'ri-archive-line',
    emptyTitle: '暂无产品资产',
    emptyHint: '项目中生成的产品资产，后续会在这里汇总展示。',
    searchPlaceholder: '搜索产品名称、描述、来源项目',
  },
};

const DEFAULT_ASSET_FILTER: AssetFilterState = {
  query: '',
  imageStatus: 'all',
  sourceProject: 'all',
  sort: 'recent',
};

function overallStatusLabel(status: ShortDramaProjectDto['overall_status']): string {
  if (status === 'completed') return '已完成';
  if (status === 'generating') return '生成中';
  if (status === 'stale') return '需更新';
  if (status === 'failed') return '异常';
  return '草稿';
}

function overallStatusTone(status: ShortDramaProjectDto['overall_status']): { bg: string; color: string; border: string } {
  if (status === 'completed') return { bg: 'rgba(4,120,87,0.08)', color: '#047857', border: 'rgba(4,120,87,0.18)' };
  if (status === 'generating') return { bg: 'rgba(180,83,9,0.08)', color: '#B45309', border: 'rgba(180,83,9,0.18)' };
  if (status === 'stale') return { bg: 'rgba(217,119,6,0.09)', color: '#92400E', border: 'rgba(217,119,6,0.22)' };
  if (status === 'failed') return { bg: 'rgba(220,38,38,0.08)', color: '#B91C1C', border: 'rgba(220,38,38,0.2)' };
  return { bg: '#F5F5F7', color: '#444444', border: '#EAEAEA' };
}

function actionLabel(status: ShortDramaProjectDto['overall_status']): string {
  if (status === 'completed') return '查看项目';
  if (status === 'stale') return '继续更新';
  if (status === 'generating') return '查看进度';
  if (status === 'failed') return '继续修复';
  return '继续编辑';
}

function stepLabel(step: ShortDramaProjectDto['last_active_step']): string {
  if (step === 'step_0') return '项目设置';
  if (step === 'step_1') return '产品输入';
  if (step === 'step_2') return '剧本大纲';
  if (step === 'step_3') return '角色场景';
  if (step === 'step_4') return '片段视频';
  if (step === 'overview') return '项目总览';
  return '项目设置';
}

function step4StatusLabel(project: ShortDramaProjectDto): string {
  const hasFinal = Boolean(project.final_video_url) || Boolean(project.has_final_video);
  if (hasFinal) return '视频已完成';
  if (project.has_all_segment_videos) return '片段视频已生成';
  const segDone = Number(project.segment_video_count || 0);
  const segTotal = Number(project.segment_video_total || 0);
  if (segDone > 0 && segTotal > 0 && segDone < segTotal) return '部分片段已生成';
  const effectiveStatus = String(project.effective_status || project.suggested_status || project.status || '').trim();
  if (
    effectiveStatus === 'video_rendering' ||
    String(project.status || '').trim() === 'video_rendering' ||
    (effectiveStatus === 'processing' && String(project.current_stage || '').trim() === 's4_video')
  ) {
    return '视频生成中';
  }
  if (String(project.step_status?.step_4 || '').trim() === 'stale') return '视频需更新';
  if (String(project.step_status?.step_4 || '').trim() === 'failed') return '视频失败';
  return '视频未开始';
}

function formatUpdatedAt(value: string | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function assetKindLabel(assetType: string): string {
  if (assetType === 'character') return '人物角色';
  if (assetType === 'scene') return '场景资产';
  if (assetType === 'product') return '产品资产';
  return assetType || '资产';
}

function descriptionSummary(value: string | null | undefined): string {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '暂无描述';
  return text.length > 72 ? `${text.slice(0, 72)}...` : text;
}

function assetRecord(asset: AssetLibrarySummaryDto): Record<string, unknown> {
  return asset as unknown as Record<string, unknown>;
}

function assetText(asset: AssetLibrarySummaryDto, keys: string[]): string {
  const record = assetRecord(asset);
  return keys
    .map((key) => {
      const value = record[key];
      if (Array.isArray(value)) return value.join(' ');
      if (value && typeof value === 'object') return JSON.stringify(value);
      return String(value || '');
    })
    .join(' ')
    .trim();
}

function assetDisplayName(asset: AssetLibrarySummaryDto): string {
  return assetText(asset, ['name', 'title']) || `资产 ${asset.id}`;
}

function assetDisplayDescription(asset: AssetLibrarySummaryDto): string {
  return assetText(asset, ['description', 'display_description', 'summary', 'selling_points']);
}

function assetSourceProjectName(asset: AssetLibrarySummaryDto): string {
  return assetText(asset, ['source_project_name', 'project_name']) || `项目 ${asset.project_id}`;
}

function assetImageValue(asset: AssetLibrarySummaryDto): string {
  const record = assetRecord(asset);
  for (const key of ['image_url', 'imageUrl', 'thumbnail_url', 'preview_url']) {
    const value = String(record[key] || '').trim();
    if (value) return value;
  }
  return '';
}

function assetHasImage(asset: AssetLibrarySummaryDto): boolean {
  return Boolean(assetImageValue(asset));
}

function assetTimeMs(asset: AssetLibrarySummaryDto): number {
  const value = assetText(asset, ['updated_at', 'modified_at', 'created_at']);
  const time = value ? new Date(value).getTime() : NaN;
  return Number.isNaN(time) ? 0 : time;
}

function assetMatchesQuery(asset: AssetLibrarySummaryDto, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  const haystack = [
    'name',
    'title',
    'description',
    'display_description',
    'source_project_name',
    'project_name',
    'asset_type',
    'role',
    'role_type',
    'tag',
    'tags',
    'category',
  ];
  return assetText(asset, haystack).toLowerCase().includes(normalized);
}

function moduleToAssetType(module: AssetModule): 'character' | 'scene' | 'product' {
  if (module === 'characters') return 'character';
  if (module === 'scenes') return 'scene';
  return 'product';
}

function assetLibraryItemToSummary(asset: AssetLibraryItemDto, projectName: string): AssetLibrarySummaryDto {
  const coverUrl = asset.cover_image?.image_url || '';
  const firstImageUrl = asset.images?.find((img) => String(img.status || 'active').toLowerCase() === 'active')?.image_url || '';
  return {
    id: asset.id,
    project_id: asset.project_id,
    project_name: projectName || `项目 ${asset.project_id}`,
    asset_type: asset.asset_type,
    name: asset.name,
    description: asset.description,
    image_url: coverUrl || firstImageUrl || null,
    source: asset.source,
    created_at: asset.created_at,
    updated_at: asset.updated_at,
  };
}

function projectSortTimeMs(p: ShortDramaProjectDto): number {
  const updated = p.updated_at ? new Date(p.updated_at).getTime() : NaN;
  if (!Number.isNaN(updated)) return updated;
  const created = p.created_at ? new Date(p.created_at).getTime() : NaN;
  if (!Number.isNaN(created)) return created;
  return 0;
}

function coverFallbackText(p: ShortDramaProjectDto): string {
  const t = p.cover_asset?.asset_type;
  if (t === 'product') return '暂无角色封面，已使用产品图';
  if (t === 'scene') return '暂无角色封面，已使用场景图';
  return '完成 S3 后会自动生成项目封面';
}

function coverEmptyTitle(p: ShortDramaProjectDto): string {
  const step3 = p.step_status?.step_3;
  const hasAssetContext =
    step3 === 'completed' ||
    step3 === 'stale' ||
    step3 === 'generating' ||
    p.last_active_step === 'step_4' ||
    p.last_active_step === 'overview' ||
    Boolean(p.cover_asset?.asset_type);
  return hasAssetContext ? '暂无项目封面' : '待生成角色资产';
}

function AssetManagementEmptyState({
  title,
  icon,
  hint,
}: {
  title: string;
  icon: string;
  hint: string;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-[#D1D1D6] bg-white px-6 py-12 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F5F5F7] text-[#6E6E73]">
        <i className={`${icon} text-[24px]`} aria-hidden />
      </div>
      <p className="mt-4 text-[15px] font-bold text-[#1D1D1F]">{title}</p>
      <p className="mx-auto mt-2 max-w-lg text-[13px] leading-relaxed text-[#8E8E93]">{hint}</p>
    </div>
  );
}

function AssetFilterEmptyState() {
  return (
    <div className="rounded-3xl border border-dashed border-[#D1D1D6] bg-white px-6 py-12 text-center">
      <p className="text-[15px] font-bold text-[#1D1D1F]">没有匹配的资产</p>
      <p className="mt-2 text-[13px] text-[#8E8E93]">可以调整筛选条件后重试。</p>
    </div>
  );
}

function AssetSummaryCard({ asset }: { asset: AssetLibrarySummaryDto }) {
  const image = resolveAssetImageUrl(assetImageValue(asset)).src;
  const updatedText =
    formatUpdatedAt(assetText(asset, ['updated_at'])) ||
    formatUpdatedAt(assetText(asset, ['modified_at'])) ||
    formatUpdatedAt(assetText(asset, ['created_at'])) ||
    '未知时间';
  const isCharacter = asset.asset_type === 'character';
  const isProduct = asset.asset_type === 'product';
  const imageClass = isCharacter
    ? 'object-contain object-top'
    : isProduct
      ? 'object-contain object-center'
      : 'object-cover object-center';
  const imageBg = isCharacter || isProduct ? 'bg-[#FAFAFB]' : 'bg-[#F5F5F7]';
  return (
    <div className="overflow-hidden rounded-2xl border border-[#EAEAEA] bg-white shadow-[0_8px_28px_rgba(15,23,42,0.04)]">
      <div className={`relative h-44 ${imageBg}`}>
        {image ? (
          <img
            src={image}
            alt={assetDisplayName(asset)}
            className={`h-full w-full ${imageClass}`}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center px-4 text-center text-[12px] text-[#8E8E93]">
            暂无资产图片
          </div>
        )}
        <span className="absolute right-3 top-3 rounded-full border border-white/70 bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-[#444444] backdrop-blur">
          {assetKindLabel(asset.asset_type)}
        </span>
      </div>
      <div className="p-4">
        <h3 className="truncate text-[15px] font-bold text-[#1D1D1F]">{assetDisplayName(asset)}</h3>
        <p
          className="mt-2 min-h-[38px] overflow-hidden text-[12px] leading-relaxed text-[#6E6E73]"
          style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}
        >
          {descriptionSummary(assetDisplayDescription(asset))}
        </p>
        <div className="mt-3 space-y-1.5 rounded-xl bg-[#F7F8FA] p-3 text-[11.5px] text-[#6E6E73]">
          <div className="flex items-center justify-between gap-3">
            <span>来源项目</span>
            <span className="truncate font-medium text-[#1D1D1F]">{assetSourceProjectName(asset)}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span>更新时间</span>
            <span className="font-medium text-[#1D1D1F]">{updatedText}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function AssetPagination({
  page,
  totalPages,
  totalCount,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  totalCount: number;
  onPageChange: (page: number) => void;
}) {
  if (totalCount <= PAGE_SIZE) return null;
  return (
    <div className="mt-6 flex flex-col items-center justify-between gap-3 rounded-2xl border border-[#EAEAEA] bg-white px-4 py-3 sm:flex-row">
      <p className="text-[12px] text-[#8E8E93]">
        第 {page} / {totalPages} 页 · 共 {totalCount} 个资产
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          className="rounded-lg px-3 py-1.5 text-[12px] font-semibold"
          style={{
            background: page <= 1 ? '#F5F5F7' : '#ffffff',
            color: page <= 1 ? '#AEAEB2' : '#444444',
            border: '1px solid #EAEAEA',
            cursor: page <= 1 ? 'not-allowed' : 'pointer',
          }}
        >
          上一页
        </button>
        <span className="rounded-lg bg-[#F7F8FA] px-3 py-1.5 text-[12px] font-semibold text-[#1D1D1F]">{page}</span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          className="rounded-lg px-3 py-1.5 text-[12px] font-semibold"
          style={{
            background: page >= totalPages ? '#F5F5F7' : '#ffffff',
            color: page >= totalPages ? '#AEAEB2' : '#444444',
            border: '1px solid #EAEAEA',
            cursor: page >= totalPages ? 'not-allowed' : 'pointer',
          }}
        >
          下一页
        </button>
      </div>
    </div>
  );
}

function AssetModulePanel({
  module,
  loading,
  error,
  assets,
  filteredAssets,
  pagedAssets,
  filters,
  sourceOptions,
  page,
  totalPages,
  onFilterChange,
  onPageChange,
}: {
  module: AssetModule;
  loading: boolean;
  error: string | null;
  assets: AssetLibrarySummaryDto[];
  filteredAssets: AssetLibrarySummaryDto[];
  pagedAssets: AssetLibrarySummaryDto[];
  filters: AssetFilterState;
  sourceOptions: string[];
  page: number;
  totalPages: number;
  onFilterChange: (patch: Partial<AssetFilterState>) => void;
  onPageChange: (page: number) => void;
}) {
  const meta = ASSET_MODULE_META[module];
  return (
    <>
      {loading ? <div className="text-[13px] text-[#8E8E93]">加载{meta.title}中...</div> : null}
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-[13px] text-red-800">{error}</div> : null}
      {!loading && !error && assets.length > 0 ? (
        <div className="mb-5 rounded-2xl border border-[#EAEAEA] bg-white p-4 shadow-[0_8px_28px_rgba(15,23,42,0.04)]">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_140px_160px_140px]">
            <input
              value={filters.query}
              onChange={(event) => onFilterChange({ query: event.target.value })}
              placeholder={meta.searchPlaceholder}
              className="rounded-xl border border-[#EAEAEA] bg-[#FAFAFB] px-3 py-2 text-[13px] text-[#1D1D1F] outline-none focus:border-[#1D1D1F]"
            />
            <select
              value={filters.imageStatus}
              onChange={(event) => onFilterChange({ imageStatus: event.target.value as AssetImageFilter })}
              className="rounded-xl border border-[#EAEAEA] bg-[#FAFAFB] px-3 py-2 text-[13px] text-[#1D1D1F] outline-none focus:border-[#1D1D1F]"
            >
              <option value="all">全部</option>
              <option value="with_image">有图片</option>
              <option value="without_image">无图片</option>
            </select>
            <select
              value={filters.sourceProject}
              onChange={(event) => onFilterChange({ sourceProject: event.target.value })}
              disabled={sourceOptions.length === 0}
              className="rounded-xl border border-[#EAEAEA] bg-[#FAFAFB] px-3 py-2 text-[13px] text-[#1D1D1F] outline-none focus:border-[#1D1D1F] disabled:text-[#AEAEB2]"
            >
              <option value="all">全部项目</option>
              {sourceOptions.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <select
              value={filters.sort}
              onChange={(event) => onFilterChange({ sort: event.target.value as AssetSortKey })}
              className="rounded-xl border border-[#EAEAEA] bg-[#FAFAFB] px-3 py-2 text-[13px] text-[#1D1D1F] outline-none focus:border-[#1D1D1F]"
            >
              <option value="recent">最近更新</option>
              <option value="oldest">最早更新</option>
              <option value="name_az">名称 A-Z</option>
            </select>
          </div>
        </div>
      ) : null}
      {!loading && !error && assets.length === 0 ? (
        <AssetManagementEmptyState title={meta.emptyTitle} icon={meta.icon} hint={meta.emptyHint} />
      ) : null}
      {!loading && !error && assets.length > 0 && filteredAssets.length === 0 ? <AssetFilterEmptyState /> : null}
      {!loading && !error && filteredAssets.length > 0 ? (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {pagedAssets.map((asset) => <AssetSummaryCard key={asset.id} asset={asset} />)}
          </div>
          <AssetPagination page={page} totalPages={totalPages} totalCount={filteredAssets.length} onPageChange={onPageChange} />
        </>
      ) : null}
    </>
  );
}

function MobileProjectWorkbench({
  loading,
  error,
  projects,
  statusCounts,
  onOpenProject,
  onCreateProject,
}: {
  loading: boolean;
  error: string | null;
  projects: ShortDramaProjectDto[];
  statusCounts: Record<ProjectStatusFilter, number>;
  onOpenProject: (id: number) => void;
  onCreateProject: () => void;
}) {
  const generating = projects.filter((p) => p.overall_status === 'generating');
  const failed = projects.filter((p) => p.overall_status === 'failed' || p.overall_status === 'stale');
  const completed = projects.filter((p) => p.overall_status === 'completed');
  const topProjects = projects.slice(0, 5);

  return (
    <div className="md:hidden">
      <section className="rounded-[28px] bg-[#111111] p-5 text-white shadow-[0_16px_40px_rgba(15,23,42,0.16)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/45">Mobile Workspace</p>
            <h1 className="mt-2 text-[28px] font-black leading-tight">今天要继续哪个视频？</h1>
            <p className="mt-3 text-[13px] leading-relaxed text-white/60">手机端优先处理创建、进度、重试和成片查看。</p>
          </div>
          <button
            type="button"
            onClick={onCreateProject}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-[#111111]"
            aria-label="创建项目"
          >
            <i className="ri-add-line text-[22px]" aria-hidden />
          </button>
        </div>
        <div className="mt-6 grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-white/10 p-3">
            <p className="text-[20px] font-black">{statusCounts.all}</p>
            <p className="mt-1 text-[11px] text-white/55">全部项目</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-3">
            <p className="text-[20px] font-black">{generating.length}</p>
            <p className="mt-1 text-[11px] text-white/55">生成中</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-3">
            <p className="text-[20px] font-black">{completed.length}</p>
            <p className="mt-1 text-[11px] text-white/55">已完成</p>
          </div>
        </div>
      </section>

      <section className="mt-4 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onCreateProject}
          className="rounded-2xl border border-[#EAEAEA] bg-white p-4 text-left"
        >
          <i className="ri-add-circle-line text-[22px] text-[#1D1D1F]" aria-hidden />
          <p className="mt-3 text-[14px] font-bold text-[#1D1D1F]">新建项目</p>
          <p className="mt-1 text-[12px] leading-relaxed text-[#8E8E93]">上传商品图开始</p>
        </button>
        <button
          type="button"
          onClick={() => {
            const target = failed[0] || generating[0] || topProjects[0];
            if (target?.id) onOpenProject(target.id);
          }}
          disabled={!topProjects.length}
          className="rounded-2xl border border-[#EAEAEA] bg-white p-4 text-left disabled:opacity-50"
        >
          <i className="ri-refresh-line text-[22px] text-[#1D1D1F]" aria-hidden />
          <p className="mt-3 text-[14px] font-bold text-[#1D1D1F]">继续处理</p>
          <p className="mt-1 text-[12px] leading-relaxed text-[#8E8E93]">{failed.length ? `${failed.length} 个需更新` : '打开最近项目'}</p>
        </button>
      </section>

      {loading ? <div className="mt-5 text-[13px] text-[#8E8E93]">项目加载中...</div> : null}
      {error ? <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-[13px] text-red-800">{error}</div> : null}

      {!loading && !error && topProjects.length === 0 ? (
        <section className="mt-5 rounded-2xl border border-dashed border-[#D1D1D6] bg-white px-5 py-8 text-center">
          <p className="text-[15px] font-bold text-[#1D1D1F]">还没有项目</p>
          <p className="mt-2 text-[12px] leading-relaxed text-[#8E8E93]">先创建一个商品视频项目，后续生成进度会出现在这里。</p>
          <button type="button" onClick={onCreateProject} className="mt-5 rounded-xl bg-[#1D1D1F] px-5 py-2.5 text-[13px] font-semibold text-white">
            开始创建
          </button>
        </section>
      ) : null}

      {!loading && !error && topProjects.length > 0 ? (
        <section className="mt-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[15px] font-bold text-[#1D1D1F]">最近项目</h2>
            <span className="text-[12px] text-[#8E8E93]">共 {projects.length} 个</span>
          </div>
          <div className="space-y-3">
            {topProjects.map((p) => {
              const tone = overallStatusTone(p.overall_status);
              const updatedText = formatUpdatedAt(p.updated_at) || formatUpdatedAt(p.created_at) || '未知时间';
              const progressTotal = Number(p.segment_video_total || 0);
              const progressDone = Number(p.segment_video_count || 0);
              const progressLabel = progressTotal > 0 ? `${progressDone}/${progressTotal}` : stepLabel(p.last_active_step);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onOpenProject(p.id)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-[#EAEAEA] bg-white p-3 text-left"
                >
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-[#F5F5F7]">
                    <ProjectCoverImage
                      projectName={p.project_name || `项目 ${p.id}`}
                      cover={p.cover_asset ?? null}
                      emptyTitle=""
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-[14px] font-bold text-[#1D1D1F]">{p.project_name || `项目 ${p.id}`}</h3>
                      <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: tone.bg, color: tone.color }}>
                        {overallStatusLabel(p.overall_status)}
                      </span>
                    </div>
                    <p className="mt-1 text-[12px] text-[#8E8E93]">视频进度：{progressLabel}</p>
                    <p className="mt-0.5 text-[11px] text-[#C7C7CC]">更新于 {updatedText}</p>
                  </div>
                  <i className="ri-arrow-right-s-line text-[20px] text-[#C7C7CC]" aria-hidden />
                </button>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}

export function ShortDramaProjectsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getUser();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<ShortDramaProjectDto[]>([]);
  const [activeFilter, setActiveFilter] = useState<ProjectStatusFilter>('all');
  const [activeModule, setActiveModule] = useState<ManagementModule>('projects');
  const [assetLoading, setAssetLoading] = useState(false);
  const [assetError, setAssetError] = useState<string | null>(null);
  const [assetRows, setAssetRows] = useState<Record<AssetModule, AssetLibrarySummaryDto[]>>({
    characters: [],
    scenes: [],
    products: [],
  });
  const [assetLoaded, setAssetLoaded] = useState<Record<AssetModule, boolean>>({
    characters: false,
    scenes: false,
    products: false,
  });
  const [assetFilters, setAssetFilters] = useState<Record<AssetModule, AssetFilterState>>({
    characters: { ...DEFAULT_ASSET_FILTER },
    scenes: { ...DEFAULT_ASSET_FILTER },
    products: { ...DEFAULT_ASSET_FILTER },
  });
  const [assetPages, setAssetPages] = useState<Record<AssetModule, number>>({
    characters: 1,
    scenes: 1,
    products: 1,
  });
  const [currentPage, setCurrentPage] = useState(1);
  const selectedAssetModule: AssetModule = activeModule === 'projects' ? 'characters' : activeModule;

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const res = await listShortDramaProjects(user.id);
        setProjects(res.projects || []);
        console.info('[FRONT_PROJECT_LIST_LOADED]', { user_id: user.id, count: res.projects?.length ?? 0 });
      } catch (e) {
        const msg = e instanceof ShortDramaApiError ? e.message : e instanceof Error ? e.message : '加载项目列表失败';
        setError(msg);
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || activeModule === 'projects') return;
    const module = activeModule;
    if (assetLoaded[module]) return;
    if (loading) return;
    setAssetLoading(true);
    setAssetError(null);
    void (async () => {
      try {
        const assetType = moduleToAssetType(module);
        const projectList = projects.filter((project) => typeof project.id === 'number');
        const lists = await Promise.all(
          projectList.map(async (project) => {
            const res = await listShortDramaAssetLibrary(project.id, assetType);
            return (res.assets || []).map((asset) => assetLibraryItemToSummary(asset, project.project_name || `项目 ${project.id}`));
          }),
        );
        setAssetRows((prev) => ({ ...prev, [module]: lists.flat() }));
        setAssetLoaded((prev) => ({ ...prev, [module]: true }));
      } catch (e) {
        const msg = e instanceof ShortDramaApiError ? e.message : e instanceof Error ? e.message : '加载资产列表失败';
        setAssetError(msg);
      } finally {
        setAssetLoading(false);
      }
    })();
  }, [activeModule, assetLoaded, loading, projects, user?.id]);

  const sorted = useMemo(
    () =>
      [...projects].sort((a, b) => {
        const timeDiff = projectSortTimeMs(b) - projectSortTimeMs(a);
        if (timeDiff !== 0) return timeDiff;
        return (b.id ?? 0) - (a.id ?? 0);
      }),
    [projects],
  );
  const statusCounts = useMemo(() => {
    const counts: Record<ProjectStatusFilter, number> = {
      all: sorted.length,
      draft: 0,
      generating: 0,
      stale: 0,
      completed: 0,
      failed: 0,
    };
    for (const project of sorted) {
      const status = project.overall_status;
      if (status === 'draft' || status === 'generating' || status === 'stale' || status === 'completed' || status === 'failed') {
        counts[status] += 1;
      }
    }
    return counts;
  }, [sorted]);

  const filteredProjects = useMemo(() => {
    if (activeFilter === 'all') return sorted;
    return sorted.filter((project) => project.overall_status === activeFilter);
  }, [activeFilter, sorted]);

  const totalPages = Math.max(1, Math.ceil(filteredProjects.length / PAGE_SIZE));
  const pagedProjects = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredProjects.slice(start, start + PAGE_SIZE);
  }, [currentPage, filteredProjects]);

  const currentAssetRows = assetRows[selectedAssetModule] || [];
  const currentAssetFilters = assetFilters[selectedAssetModule];
  const currentAssetPage = assetPages[selectedAssetModule] || 1;

  const currentAssetSourceOptions = useMemo(() => {
    return Array.from(new Set(currentAssetRows.map((asset) => assetSourceProjectName(asset)).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b),
    );
  }, [currentAssetRows]);

  const filteredAssets = useMemo(() => {
    const filtered = currentAssetRows.filter((asset) => {
      if (!assetMatchesQuery(asset, currentAssetFilters.query)) return false;
      if (currentAssetFilters.imageStatus === 'with_image' && !assetHasImage(asset)) return false;
      if (currentAssetFilters.imageStatus === 'without_image' && assetHasImage(asset)) return false;
      if (currentAssetFilters.sourceProject !== 'all' && assetSourceProjectName(asset) !== currentAssetFilters.sourceProject) return false;
      return true;
    });
    return [...filtered].sort((a, b) => {
      if (currentAssetFilters.sort === 'name_az') {
        return assetDisplayName(a).localeCompare(assetDisplayName(b));
      }
      const diff = assetTimeMs(a) - assetTimeMs(b);
      if (currentAssetFilters.sort === 'oldest') return diff || assetDisplayName(a).localeCompare(assetDisplayName(b));
      return -diff || assetDisplayName(a).localeCompare(assetDisplayName(b));
    });
  }, [currentAssetFilters, currentAssetRows]);

  const assetTotalPages = Math.max(1, Math.ceil(filteredAssets.length / PAGE_SIZE));
  const pagedAssets = useMemo(() => {
    const start = (currentAssetPage - 1) * PAGE_SIZE;
    return filteredAssets.slice(start, start + PAGE_SIZE);
  }, [currentAssetPage, filteredAssets]);

  const updateCurrentAssetFilter = (patch: Partial<AssetFilterState>) => {
    setAssetFilters((prev) => ({
      ...prev,
      [selectedAssetModule]: {
        ...prev[selectedAssetModule],
        ...patch,
      },
    }));
    setAssetPages((prev) => ({ ...prev, [selectedAssetModule]: 1 }));
  };

  const updateCurrentAssetPage = (page: number) => {
    setAssetPages((prev) => ({ ...prev, [selectedAssetModule]: page }));
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilter]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(1);
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (currentAssetPage > assetTotalPages) {
      setAssetPages((prev) => ({ ...prev, [selectedAssetModule]: 1 }));
    }
  }, [assetTotalPages, currentAssetPage, selectedAssetModule]);

  return (
    <ShortDramaLayout headerMode="landing">
      <div className="min-h-screen bg-[#F7F8FA] px-4 py-7 md:px-6 md:py-10" style={{ fontFamily: "'Inter', sans-serif" }}>
        <div className="mx-auto max-w-5xl">
        {!user?.id ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
            <p className="text-[14px] font-semibold text-amber-900">请先登录后查看项目列表</p>
            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  navigate('/login', {
                    state: { from: `${location.pathname}${location.search}${location.hash}` },
                  })
                }
                className="rounded-lg bg-[#1D1D1F] px-4 py-2 text-[13px] font-semibold text-white"
              >
                登录
              </button>
              <button
                type="button"
                onClick={() => navigate('/')}
                className="rounded-lg border border-[#EAEAEA] bg-white px-4 py-2 text-[13px] font-semibold text-[#444444]"
              >
                返回首页
              </button>
            </div>
          </div>
        ) : (
          <>
        <MobileProjectWorkbench
          loading={loading}
          error={error}
          projects={sorted}
          statusCounts={statusCounts}
          onOpenProject={(id) => navigate(`/short-drama/projects/${id}`)}
          onCreateProject={() => navigate('/short-drama/create')}
        />

        <div className="mb-7 hidden md:block">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#8E8E93]">Management Center</span>
            <h1 className="mt-2 text-2xl font-black text-[#1D1D1F] md:text-3xl" style={{ fontFamily: "'Syne', sans-serif" }}>VibeClip 管理中心</h1>
            <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-[#8E8E93]">
              统一管理短剧项目和未来可跨项目复用的人物、场景、产品资产。项目内资产生成与编辑仍在各项目 S3 页面完成。
            </p>
          </div>
        </div>

        <div className="mb-7 hidden snap-x gap-3 overflow-x-auto pb-1 md:grid md:grid-cols-2 md:overflow-visible xl:grid-cols-4">
          {MANAGEMENT_MODULES.map((module) => {
            const active = activeModule === module.key;
            return (
              <button
                key={module.key}
                type="button"
                onClick={() => setActiveModule(module.key)}
                className="min-w-[220px] snap-start rounded-2xl border p-4 text-left transition-all duration-150 md:min-w-0"
                style={{
                  background: active ? '#1D1D1F' : '#ffffff',
                  borderColor: active ? '#1D1D1F' : '#EAEAEA',
                  boxShadow: active ? '0 14px 34px rgba(29,29,31,0.16)' : '0 8px 28px rgba(15,23,42,0.04)',
                }}
              >
                <div
                  className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl"
                  style={{ background: active ? 'rgba(255,255,255,0.12)' : '#F5F5F7', color: active ? '#ffffff' : '#6E6E73' }}
                >
                  <i className={`${module.icon} text-[20px]`} aria-hidden />
                </div>
                <h2 className="text-[14px] font-bold" style={{ color: active ? '#ffffff' : '#1D1D1F' }}>{module.title}</h2>
                <p className="mt-2 text-[12px] leading-relaxed" style={{ color: active ? 'rgba(255,255,255,0.72)' : '#8E8E93' }}>
                  {module.description}
                </p>
              </button>
            );
          })}
        </div>

        <div className="hidden md:block">
        {activeModule === 'projects' ? (
          <>
            {loading ? <div className="text-[13px] text-[#8E8E93]">加载中...</div> : null}
            {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-[13px] text-red-800">{error}</div> : null}
          <div className="mb-5 flex gap-2 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible">
            {STATUS_FILTERS.map((filter) => {
              const active = activeFilter === filter.key;
              return (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => setActiveFilter(filter.key)}
                  className="shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors duration-150"
                  style={{
                    background: active ? '#1D1D1F' : '#ffffff',
                    color: active ? '#ffffff' : '#444444',
                    border: `1px solid ${active ? '#1D1D1F' : '#EAEAEA'}`,
                    boxShadow: active ? '0 6px 18px rgba(29,29,31,0.12)' : 'none',
                  }}
                >
                  {filter.label} <span style={{ opacity: active ? 0.82 : 0.62 }}>{statusCounts[filter.key]}</span>
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {pagedProjects.map((p) => {
              const tone = overallStatusTone(p.overall_status);
              const cover = p.cover_asset ?? null;
              const updatedText = formatUpdatedAt(p.updated_at);
              const createdText = formatUpdatedAt(p.created_at);
              const timeLabel = updatedText
                ? `更新于：${updatedText}`
                : createdText
                  ? `创建于：${createdText}`
                  : '创建于：未知时间';
              console.info('[FRONT_PROJECT_CARD_RENDERED]', { project_id: p.id, overall_status: p.overall_status || 'draft', cover_asset_type: cover?.asset_type || null });
              return (
                <div
                  key={p.id}
                  className="overflow-hidden rounded-2xl border border-[#EAEAEA] bg-white shadow-[0_8px_28px_rgba(15,23,42,0.04)] transition-transform duration-150 hover:-translate-y-0.5"
                >
                  <div className="relative h-44 bg-[#F5F5F7]">
                    <ProjectCoverImage
                      projectName={p.project_name || `项目 ${p.id}`}
                      cover={cover}
                      emptyTitle={coverEmptyTitle(p)}
                      emptyHint={coverEmptyTitle(p) === '待生成角色资产' ? coverFallbackText(p) : undefined}
                    />
                    <span
                      className="absolute right-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-semibold backdrop-blur"
                      style={{ background: tone.bg, color: tone.color, border: `1px solid ${tone.border}` }}
                    >
                      {overallStatusLabel(p.overall_status)}
                    </span>
                    {cover?.image_url && cover?.asset_type !== 'character' ? (
                      <span className="absolute bottom-3 left-3 rounded-full bg-white/90 px-2.5 py-1 text-[10.5px] text-[#6E6E73]">
                        {coverFallbackText(p)}
                      </span>
                    ) : null}
                  </div>

                  <div className="p-4">
                    <div className="mb-3">
                      <h2 className="truncate text-[15px] font-bold text-[#1D1D1F]">{p.project_name || `项目 ${p.id}`}</h2>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11.5px] text-[#8E8E93]">
                        <span>项目 ID：{p.id}</span>
                        <span>{timeLabel}</span>
                      </div>
                    </div>

                    <div className="space-y-2 rounded-xl bg-[#F7F8FA] p-3 text-[12px] text-[#444444]">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[#8E8E93]">当前步骤</span>
                        <span className="font-medium text-[#1D1D1F]">{stepLabel(p.last_active_step)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[#8E8E93]">视频状态</span>
                        <span className="font-medium text-[#1D1D1F]">{step4StatusLabel(p)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[#8E8E93]">最终成片</span>
                        <span className="font-medium text-[#1D1D1F]">{p.final_video_url ? '已生成' : '未生成'}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => navigate(`/short-drama/projects/${p.id}`)}
                      className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#1D1D1F] px-4 py-2.5 text-[13px] font-semibold text-white transition-colors duration-150 hover:bg-[#374151]"
                    >
                      {actionLabel(p.overall_status)}
                      <i className="ri-arrow-right-line text-[12px]" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          {!loading && sorted.length === 0 && !error ? (
            <div className="rounded-2xl border border-dashed border-[#D1D1D6] bg-white px-6 py-10 text-center">
              <p className="text-[14px] font-semibold text-[#1D1D1F]">还没有 Vibe Clip 项目</p>
              <p className="mt-1 text-[12px] text-[#8E8E93]">创建项目后，这里会展示角色封面和生成进度。</p>
            </div>
          ) : null}
          {!loading && sorted.length > 0 && filteredProjects.length === 0 && !error ? (
            <div className="rounded-2xl border border-dashed border-[#D1D1D6] bg-white px-6 py-10 text-center">
              <p className="text-[14px] font-semibold text-[#1D1D1F]">暂无该状态项目</p>
              <p className="mt-1 text-[12px] text-[#8E8E93]">可以创建新项目，或切换其他筛选条件。</p>
            </div>
          ) : null}
          {filteredProjects.length > PAGE_SIZE ? (
            <div className="mt-6 flex flex-col items-center justify-between gap-3 rounded-2xl border border-[#EAEAEA] bg-white px-4 py-3 sm:flex-row">
              <p className="text-[12px] text-[#8E8E93]">
                第 {currentPage} / {totalPages} 页 · 共 {filteredProjects.length} 个项目
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  className="rounded-lg px-3 py-1.5 text-[12px] font-semibold"
                  style={{
                    background: currentPage <= 1 ? '#F5F5F7' : '#ffffff',
                    color: currentPage <= 1 ? '#AEAEB2' : '#444444',
                    border: '1px solid #EAEAEA',
                    cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
                  }}
                >
                  上一页
                </button>
                <span className="rounded-lg bg-[#F7F8FA] px-3 py-1.5 text-[12px] font-semibold text-[#1D1D1F]">
                  {currentPage}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  className="rounded-lg px-3 py-1.5 text-[12px] font-semibold"
                  style={{
                    background: currentPage >= totalPages ? '#F5F5F7' : '#ffffff',
                    color: currentPage >= totalPages ? '#AEAEB2' : '#444444',
                    border: '1px solid #EAEAEA',
                    cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                  }}
                >
                  下一页
                </button>
              </div>
            </div>
          ) : null}
          </>
        ) : activeModule === 'characters' ? (
          <AssetModulePanel
            module="characters"
            loading={assetLoading}
            error={assetError}
            assets={assetRows.characters}
            filteredAssets={filteredAssets}
            pagedAssets={pagedAssets}
            filters={currentAssetFilters}
            sourceOptions={currentAssetSourceOptions}
            page={currentAssetPage}
            totalPages={assetTotalPages}
            onFilterChange={updateCurrentAssetFilter}
            onPageChange={updateCurrentAssetPage}
          />
        ) : activeModule === 'scenes' ? (
          <AssetModulePanel
            module="scenes"
            loading={assetLoading}
            error={assetError}
            assets={assetRows.scenes}
            filteredAssets={filteredAssets}
            pagedAssets={pagedAssets}
            filters={currentAssetFilters}
            sourceOptions={currentAssetSourceOptions}
            page={currentAssetPage}
            totalPages={assetTotalPages}
            onFilterChange={updateCurrentAssetFilter}
            onPageChange={updateCurrentAssetPage}
          />
        ) : (
          <AssetModulePanel
            module="products"
            loading={assetLoading}
            error={assetError}
            assets={assetRows.products}
            filteredAssets={filteredAssets}
            pagedAssets={pagedAssets}
            filters={currentAssetFilters}
            sourceOptions={currentAssetSourceOptions}
            page={currentAssetPage}
            totalPages={assetTotalPages}
            onFilterChange={updateCurrentAssetFilter}
            onPageChange={updateCurrentAssetPage}
          />
        )}
        </div>
          </>
        )}
        </div>
      </div>
    </ShortDramaLayout>
  );
}
