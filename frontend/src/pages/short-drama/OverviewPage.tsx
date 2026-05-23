import { useNavigate } from 'react-router-dom';
import { useOverviewExport } from './hooks/useOverviewExport';
import { useOverviewPage } from './hooks/useOverviewPage';
import { VibeClipLogo } from './components/VibeClipLogo';
import { MobileBottomActionBar } from './components/MobileBottomActionBar';
import { SHORT_DRAMA_UI } from './utils/shortDramaUiCopy';
import {
  formatFinalVideoAddressDisplay,
  type OverviewCharacterRowVm,
  type OverviewProjectBannerVm,
  type OverviewSegmentCardVm,
} from './utils/overviewAdapters';
import { withProjectQuery } from './utils/shortDramaRoutes';
import type { OverviewExportBusyKey } from './hooks/useOverviewExport';

export function ShortDramaOverviewPage() {
  const navigate = useNavigate();
  const {
    projectId,
    headerProjectName,
    phase,
    error,
    viewModel,
    pipeline,
    reload,
    mergeLoading,
    mergeError,
    canMergeFinalVideo,
    mergeFinalVideo,
    goCreate,
    isMockTestPatternVideo,
  } = useOverviewPage();

  const { busy, downloadFinalVideo, exportScript, exportStoryboard, exportVideoPack, exportAll } = useOverviewExport(
    projectId,
    pipeline,
    viewModel.project.name,
  );

  const exportBusy = busy !== null;

  const { project: PROJECT, plotSummary, characters: CHARS, scenes: SCENES, products: PRODUCTS, segments: SEGMENTS, finalVideoUrl, finalVideoPoster, finalMetaChip } =
    viewModel;

  if (phase === 'no_project' || projectId == null) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: '#F7F8FA', fontFamily: "'Inter', sans-serif" }}>
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-xl font-bold" style={{ fontFamily: "'Syne', sans-serif", color: '#1D1D1F' }}>
            {SHORT_DRAMA_UI.noProject.title}
          </h1>
          <p className="text-[14px]" style={{ color: '#8E8E93' }}>
            {SHORT_DRAMA_UI.noProject.body}
          </p>
          <button
            type="button"
            onClick={goCreate}
            className="px-6 py-2.5 rounded-xl text-[13px] font-semibold text-white cursor-pointer"
            style={{ background: '#1D1D1F' }}
          >
            {SHORT_DRAMA_UI.noProject.cta}
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F7F8FA', fontFamily: "'Inter', sans-serif" }}>
        <div className="flex flex-col items-center gap-3">
          <i className="ri-loader-4-line text-2xl animate-spin" style={{ color: '#1D1D1F' }} />
          <p className="text-[13px]" style={{ color: '#8E8E93' }}>
            {SHORT_DRAMA_UI.loading.pipeline}
          </p>
        </div>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 gap-4" style={{ background: '#F7F8FA', fontFamily: "'Inter', sans-serif" }}>
        <p className="text-[14px] text-center max-w-lg" style={{ color: '#DC2626' }}>
          {error}
        </p>
        <button
          type="button"
          onClick={() => void reload()}
          className="px-5 py-2 rounded-xl text-[13px] cursor-pointer"
          style={{ background: '#ffffff', border: '1px solid #EAEAEA', color: '#444444' }}
        >
          {SHORT_DRAMA_UI.actions.retry}
        </button>
      </div>
    );
  }

  const badge =
    PROJECT.statusBadge === 'completed'
      ? {
            label: SHORT_DRAMA_UI.overview.badgeCompleted,
          bg: 'rgba(4,120,87,0.08)',
          color: '#047857',
          border: '1px solid rgba(4,120,87,0.2)',
          icon: 'ri-checkbox-circle-fill',
        }
      : PROJECT.statusBadge === 'in_progress'
        ? {
            label: SHORT_DRAMA_UI.overview.badgeInProgress,
            bg: 'rgba(180,83,9,0.08)',
            color: '#92400E',
            border: '1px solid rgba(180,83,9,0.2)',
            icon: 'ri-loader-4-line',
          }
        : {
            label: SHORT_DRAMA_UI.overview.badgeDraft,
            bg: '#EAEAEA',
            color: '#444444',
            border: '1px solid #D1D1D6',
            icon: 'ri-eye-line',
          };

  return (
    <div className="min-h-screen" style={{ background: '#F7F8FA', fontFamily: "'Inter', sans-serif" }}>
      <header
        className="fixed top-0 left-0 right-0 z-50 flex h-14 items-center justify-between gap-3 px-4 md:px-6 lg:px-10"
        style={{ background: '#ffffff', borderBottom: '1px solid #EAEAEA', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}
      >
        <div className="flex min-w-0 items-center gap-2 md:gap-3">
          <button type="button" onClick={() => navigate('/short-drama/projects')} className="flex items-center gap-2 cursor-pointer">
            <VibeClipLogo compact />
            <span className="text-[14px] font-bold" style={{ fontFamily: "'Syne', sans-serif", color: '#1D1D1F' }}>
              VibeClip
            </span>
          </button>
          <span className="hidden md:inline" style={{ color: '#D1D1D6' }}>/</span>
          <span className="hidden max-w-[180px] truncate text-[13px] md:inline" style={{ color: '#8E8E93' }}>
            {headerProjectName}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 md:gap-2">
          <button
            type="button"
            onClick={() => navigate(withProjectQuery('/short-drama/step4', projectId))}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] cursor-pointer whitespace-nowrap transition-colors md:px-4"
            style={{ background: '#F7F8FA', color: '#444444', border: '1px solid #EAEAEA' }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = '#EAEAEA';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = '#F7F8FA';
            }}
          >
            <i className="ri-arrow-left-line text-[12px]" />
            <span className="hidden sm:inline">返回编辑</span>
          </button>
          <button
            type="button"
            disabled={exportBusy}
            onClick={() => void exportAll()}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold whitespace-nowrap transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed md:px-5"
            style={{ background: '#1D1D1F', color: '#ffffff' }}
            onMouseEnter={(e) => {
              if (exportBusy) return;
              (e.currentTarget as HTMLElement).style.background = '#374151';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = '#1D1D1F';
            }}
          >
            {busy === 'all' ? (
              <>
                <i className="ri-loader-4-line animate-spin text-[12px]" />
                <span className="hidden sm:inline">正在打包...</span>
              </>
            ) : (
              <>
                <i className="ri-download-cloud-line text-[12px]" />
                <span className="hidden sm:inline">一键全部导出</span>
              </>
            )}
          </button>
        </div>
      </header>

      <MobileOverviewDelivery
        projectId={projectId}
        project={PROJECT}
        plotSummary={plotSummary}
        characters={CHARS}
        scenes={SCENES}
        products={PRODUCTS}
        segments={SEGMENTS}
        finalVideoUrl={finalVideoUrl}
        finalVideoPoster={finalVideoPoster}
        finalMetaChip={finalMetaChip}
        badge={badge}
        busy={busy}
        exportBusy={exportBusy}
        mergeLoading={mergeLoading}
        mergeError={mergeError}
        canMergeFinalVideo={canMergeFinalVideo}
        isMockTestPatternVideo={isMockTestPatternVideo}
        onBackToEdit={() => navigate(withProjectQuery('/short-drama/step4', projectId))}
        onMergeFinalVideo={mergeFinalVideo}
        onDownloadFinalVideo={downloadFinalVideo}
        onExportAll={exportAll}
        onExportVideoPack={exportVideoPack}
        onExportScript={exportScript}
        onExportStoryboard={exportStoryboard}
      />

      <main className="hidden px-4 py-7 pt-20 md:block md:px-6 md:py-10 md:pt-14 lg:px-10">
        <div className="max-w-6xl mx-auto">
          {isMockTestPatternVideo && (
            <div
              className="mb-6 text-[12px] px-4 py-3 rounded-xl"
              style={{
                background: 'rgba(180,83,9,0.08)',
                color: '#92400E',
                border: '1px solid rgba(180,83,9,0.25)',
              }}
            >
              {SHORT_DRAMA_UI.stepFour.mockTestVideoBanner}
            </div>
          )}
          <div className="flex flex-col md:flex-row items-start justify-between gap-6 mb-10">
            <div>
              <div
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-3 text-[10px] font-bold uppercase tracking-widest"
                style={{ background: badge.bg, color: badge.color, border: badge.border }}
              >
                <i className={`${badge.icon} text-[10px] ${PROJECT.statusBadge === 'in_progress' ? 'animate-spin' : ''}`} />
                {badge.label}
              </div>
              <h1 className="mb-3 text-2xl font-black md:text-3xl" style={{ fontFamily: "'Syne', sans-serif", color: '#1D1D1F' }}>
                {PROJECT.name}
              </h1>
              <div className="flex flex-wrap gap-2">
                {Object.entries({
                  时长: PROJECT.duration,
                  形式: PROJECT.format,
                  比例: PROJECT.ratio,
                  风格: PROJECT.style,
                  视听: PROJECT.visualStyle,
                  市场: PROJECT.market,
                  状态: PROJECT.status || '—',
                }).map(([k, v]) => (
                  <span key={k} className="text-[11.5px] px-3 py-1 rounded-full" style={{ background: '#EAEAEA', color: '#444444' }}>
                    {k}：{v}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <p className="text-[11px]" style={{ color: '#AEAEB2' }}>
                创建于 {PROJECT.createdAt}
              </p>
              <p className="text-[12px]" style={{ color: '#8E8E93' }}>
                流程状态 <span style={{ color: '#1D1D1F', fontWeight: 600 }}>{PROJECT.status || '—'}</span>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-4">
              <div className="p-5 rounded-2xl" style={{ background: '#ffffff', border: '1px solid #EAEAEA' }}>
                <h3 className="text-[12px] font-bold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: '#8E8E93' }}>
                  <i className="ri-book-open-line text-[12px]" style={{ color: '#1D1D1F' }} />
                  剧情摘要
                </h3>
                <p className="text-[13px] leading-relaxed" style={{ color: plotSummary.trim() ? '#444444' : '#AEAEB2' }}>
                  {plotSummary.trim() ? plotSummary : '—'}
                </p>
              </div>

              <div className="p-5 rounded-2xl" style={{ background: '#ffffff', border: '1px solid #EAEAEA' }}>
                <h3 className="text-[12px] font-bold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: '#8E8E93' }}>
                  <i className="ri-user-star-line text-[12px]" style={{ color: '#1D1D1F' }} />
                  角色 ({CHARS.length})
                </h3>
                <div className="flex gap-3 flex-wrap">
                  {CHARS.length === 0 ? (
                    <p className="text-[12.5px]" style={{ color: '#AEAEB2' }}>
                      {SHORT_DRAMA_UI.overview.emptyAssets}
                    </p>
                  ) : (
                    CHARS.map((c, idx) => (
                      <div key={`${c.name}-${idx}`} className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-full overflow-hidden shrink-0">
                          {c.img ? (
                            <img src={c.img} alt={c.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-[#ECEDEF]" />
                          )}
                        </div>
                        <div>
                          <p className="text-[12.5px] font-semibold" style={{ color: '#1D1D1F' }}>
                            {c.name}
                          </p>
                          <p className="text-[10.5px]" style={{ color: '#8E8E93' }}>
                            {c.role}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="p-5 rounded-2xl" style={{ background: '#ffffff', border: '1px solid #EAEAEA' }}>
                <h3 className="text-[12px] font-bold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: '#8E8E93' }}>
                  <i className="ri-landscape-line text-[12px]" style={{ color: '#047857' }} />
                  场景 ({SCENES.length})
                </h3>
                <div className="space-y-1.5">
                  {SCENES.length === 0 ? (
                    <p className="text-[12.5px]" style={{ color: '#AEAEB2' }}>
                      {SHORT_DRAMA_UI.overview.emptyAssets}
                    </p>
                  ) : (
                    SCENES.map((s) => (
                      <div key={s} className="flex items-center gap-2 text-[12.5px]" style={{ color: '#444444' }}>
                        <i className="ri-checkbox-circle-fill text-[11px]" style={{ color: '#047857' }} />
                        {s}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="p-5 rounded-2xl" style={{ background: '#ffffff', border: '1px solid #EAEAEA' }}>
                <h3 className="text-[12px] font-bold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: '#8E8E93' }}>
                  <i className="ri-archive-line text-[12px]" style={{ color: '#DC2626' }} />
                  产品资产 ({PRODUCTS.length})
                </h3>
                <div className="space-y-1.5">
                  {PRODUCTS.length === 0 ? (
                    <p className="text-[12.5px]" style={{ color: '#AEAEB2' }}>
                      {SHORT_DRAMA_UI.overview.emptyAssets}
                    </p>
                  ) : (
                    PRODUCTS.map((p) => (
                      <div key={p} className="flex items-center gap-2 text-[12.5px]" style={{ color: '#444444' }}>
                        <i className="ri-checkbox-circle-fill text-[11px]" style={{ color: '#DC2626' }} />
                        {p}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 space-y-5">
              <div className="p-5 rounded-2xl" style={{ background: '#ffffff', border: '1px solid #EAEAEA' }}>
                <h3 className="text-[12px] font-bold uppercase tracking-wider mb-4 flex items-center gap-2" style={{ color: '#8E8E93' }}>
                  <i className="ri-layout-row-line text-[12px]" style={{ color: '#1D1D1F' }} />
                  片段预览
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {SEGMENTS.length === 0 ? (
                    <div className="sm:col-span-3 py-8 px-4 rounded-xl text-center" style={{ background: '#F7F8FA', border: '1px dashed #D1D1D6' }}>
                      <p className="text-[13px]" style={{ color: '#8E8E93' }}>
                        {SHORT_DRAMA_UI.overview.emptySegments}
                      </p>
                    </div>
                  ) : (
                    SEGMENTS.map((seg) => (
                    <div key={seg.id}>
                      <div
                        className="relative w-full rounded-xl overflow-hidden mb-2 bg-black"
                        style={{ aspectRatio: '9/16', border: `1px solid ${seg.color}25` }}
                      >
                        {seg.hasVideo && seg.videoUrl ? (
                          <video
                            src={seg.videoUrl}
                            className="w-full h-full object-cover object-top"
                            muted
                            playsInline
                            controls
                            poster={seg.posterUrl}
                          />
                        ) : (
                          <>
                            <img src={seg.posterUrl} alt={seg.name} className="w-full h-full object-cover object-top opacity-90" />
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <span className="text-[10px] px-2 py-1 rounded" style={{ background: 'rgba(0,0,0,0.55)', color: '#fff' }}>
                                暂无成片
                              </span>
                            </div>
                          </>
                        )}
                        <div className="absolute top-2 left-2 pointer-events-none">
                          <span
                            className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                            style={{ background: 'rgba(255,255,255,0.9)', color: seg.color }}
                          >
                            {seg.duration}
                          </span>
                        </div>
                      </div>
                      <p className="text-[12px] font-semibold" style={{ color: seg.color }}>
                        {seg.name}
                      </p>
                    </div>
                    ))
                  )}
                </div>
              </div>

              <div className="p-5 rounded-2xl" style={{ background: 'rgba(4,120,87,0.04)', border: '1px solid rgba(4,120,87,0.2)' }}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[13px] font-bold flex items-center gap-2" style={{ color: '#1D1D1F' }}>
                    <i className="ri-film-line text-[13px]" style={{ color: '#047857' }} />
                    最终合成视频
                  </h3>
                  <span
                    className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: 'rgba(4,120,87,0.1)', color: '#047857', border: '1px solid rgba(4,120,87,0.2)' }}
                  >
                    {isMockTestPatternVideo ? '测试拼接（dev mock）' : finalMetaChip}
                  </span>
                </div>
                {mergeError ? (
                  <div
                    className="mb-3 text-[12px] px-3 py-2 rounded-lg"
                    style={{ background: 'rgba(220,38,38,0.06)', color: '#B91C1C', border: '1px solid rgba(220,38,38,0.2)' }}
                  >
                    {mergeError}
                  </div>
                ) : null}
                {finalVideoUrl ? (
                  <div className="flex gap-4">
                    <div
                      className="relative w-32 shrink-0 rounded-xl overflow-hidden bg-black"
                      style={{ aspectRatio: '9/16', border: '1px solid rgba(4,120,87,0.25)' }}
                    >
                      <video
                        key={isMockTestPatternVideo ? 'mock-final' : 'final'}
                        src={finalVideoUrl}
                        className="w-full h-full object-cover object-top"
                        controls
                        playsInline
                        poster={finalVideoPoster}
                      />
                    </div>
                    <div className="flex-1 flex flex-col justify-between">
                      <div className="space-y-2">
                        {[
                          {
                            label: '成片地址',
                            value: formatFinalVideoAddressDisplay(finalVideoUrl, isMockTestPatternVideo),
                          },
                          { label: '比例', value: PROJECT.ratio },
                          { label: '形式', value: PROJECT.format },
                          { label: '状态', value: PROJECT.status || '—' },
                        ].map((item) => (
                          <div key={item.label} className="flex justify-between text-[12px]">
                            <span style={{ color: '#8E8E93' }}>{item.label}</span>
                            <span style={{ color: '#1D1D1F', fontWeight: 500 }}>{item.value}</span>
                          </div>
                        ))}
                      </div>
                      {canMergeFinalVideo ? (
                        <button
                          type="button"
                          disabled={mergeLoading}
                          onClick={() => void mergeFinalVideo()}
                          className="w-full mb-2 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[12.5px] font-semibold transition-all duration-200 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{ background: '#ffffff', color: '#1D1D1F', border: '1px solid #D1D1D6' }}
                        >
                          <i className={`${mergeLoading ? 'ri-loader-4-line animate-spin' : 'ri-refresh-line'} text-[12px]`} />
                          {mergeLoading ? '合成中...' : '重新合成完整视频'}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        disabled={exportBusy}
                        onClick={() => void downloadFinalVideo()}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-semibold transition-all duration-200 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ background: '#1D1D1F', color: '#ffffff' }}
                        onMouseEnter={(e) => {
                          if (exportBusy) return;
                          (e.currentTarget as HTMLElement).style.background = '#374151';
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.background = '#1D1D1F';
                        }}
                      >
                        {busy === 'video' ? (
                          <>
                            <i className="ri-loader-4-line animate-spin text-[12px]" />
                            下载中...
                          </>
                        ) : (
                          <>
                            <i className="ri-download-cloud-line text-[12px]" />
                            下载完整视频
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    className="flex flex-col items-center justify-center py-10 px-4 rounded-xl text-center gap-2"
                    style={{ background: '#ffffff', border: '1px dashed #D1D1D6' }}
                  >
                    <i className="ri-movie-2-line text-2xl" style={{ color: '#AEAEB2' }} />
                    <p className="text-[13px] font-medium" style={{ color: '#444444' }}>
                      {SHORT_DRAMA_UI.empty.noFinalVideo}
                    </p>
                    <p className="text-[12px] max-w-md" style={{ color: '#8E8E93' }}>
                      {SHORT_DRAMA_UI.empty.noFinalVideoHint}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      {canMergeFinalVideo ? (
                        <button
                          type="button"
                          disabled={mergeLoading}
                          onClick={() => void mergeFinalVideo()}
                          className="px-4 py-2 rounded-lg text-[12px] font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{ background: '#1D1D1F', color: '#ffffff' }}
                        >
                          {mergeLoading ? '合成中...' : '合成完整视频'}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => navigate(withProjectQuery('/short-drama/step4', projectId))}
                        className="px-4 py-2 rounded-lg text-[12px] font-medium cursor-pointer"
                        style={{ background: '#ffffff', color: '#1D1D1F', border: '1px solid #D1D1D6' }}
                      >
                        {SHORT_DRAMA_UI.overview.goStepFour}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-5 rounded-2xl" style={{ background: '#ffffff', border: '1px solid #EAEAEA' }}>
                <h3 className="text-[12px] font-bold uppercase tracking-wider mb-4 flex items-center gap-2" style={{ color: '#8E8E93' }}>
                  <i className="ri-download-cloud-2-line text-[12px]" style={{ color: '#1D1D1F' }} />
                  导出选项
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { key: 'video_pack', label: '下载视频包', desc: '所有片段 + 完整视频', icon: 'ri-film-line', color: '#B45309' },
                    { key: 'script', label: '导出脚本文档', desc: '完整剧本 + 分段台词', icon: 'ri-file-text-line', color: '#047857' },
                    { key: 'storyboard', label: '导出分镜文档', desc: '镜头描述 + 场景图', icon: 'ri-layout-grid-line', color: '#334155' },
                  ].map((opt) => {
                    const loading =
                      (opt.key === 'video_pack' && busy === 'video_pack') ||
                      (opt.key === 'script' && busy === 'script') ||
                      (opt.key === 'storyboard' && busy === 'storyboard');
                    const labelText =
                      opt.key === 'video_pack'
                        ? loading
                          ? '正在打包视频...'
                          : opt.label
                        : opt.key === 'script'
                          ? loading
                            ? '正在导出脚本...'
                            : opt.label
                          : opt.key === 'storyboard'
                            ? loading
                              ? '正在导出分镜...'
                              : opt.label
                            : opt.label;
                    const onExport =
                      opt.key === 'video_pack'
                        ? () => void exportVideoPack()
                        : opt.key === 'script'
                          ? () => void exportScript()
                          : () => void exportStoryboard();
                    return (
                    <button
                      key={opt.key}
                      type="button"
                      disabled={exportBusy}
                      onClick={onExport}
                      className="p-4 rounded-xl text-left transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ background: '#F7F8FA', border: '1px solid #EAEAEA' }}
                      onMouseEnter={(e) => {
                        if (exportBusy) return;
                        (e.currentTarget as HTMLElement).style.background = '#F5F5F7';
                        (e.currentTarget as HTMLElement).style.borderColor = `${opt.color}35`;
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.background = '#F7F8FA';
                        (e.currentTarget as HTMLElement).style.borderColor = '#EAEAEA';
                      }}
                    >
                      <div className="w-8 h-8 flex items-center justify-center rounded-lg mb-3" style={{ background: `${opt.color}10` }}>
                        {loading ? (
                          <i className="ri-loader-4-line animate-spin text-[14px]" style={{ color: opt.color }} />
                        ) : (
                          <i className={`${opt.icon} text-[14px]`} style={{ color: opt.color }} />
                        )}
                      </div>
                      <p className="text-[13px] font-semibold mb-1" style={{ color: '#1D1D1F' }}>
                        {labelText}
                      </p>
                      <p className="text-[11px]" style={{ color: '#8E8E93' }}>
                        {opt.desc}
                      </p>
                    </button>
                  );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

type OverviewBadgeVm = {
  label: string;
  bg: string;
  color: string;
  border: string;
  icon: string;
};

type MobileOverviewDeliveryProps = {
  projectId: number;
  project: OverviewProjectBannerVm;
  plotSummary: string;
  characters: OverviewCharacterRowVm[];
  scenes: string[];
  products: string[];
  segments: OverviewSegmentCardVm[];
  finalVideoUrl: string | null;
  finalVideoPoster: string;
  finalMetaChip: string;
  badge: OverviewBadgeVm;
  busy: OverviewExportBusyKey;
  exportBusy: boolean;
  mergeLoading: boolean;
  mergeError: string | null;
  canMergeFinalVideo: boolean;
  isMockTestPatternVideo: boolean;
  onBackToEdit: () => void;
  onMergeFinalVideo: () => Promise<void> | void;
  onDownloadFinalVideo: () => Promise<void> | void;
  onExportAll: () => Promise<void> | void;
  onExportVideoPack: () => Promise<void> | void;
  onExportScript: () => Promise<void> | void;
  onExportStoryboard: () => Promise<void> | void;
};

function MobileOverviewDelivery({
  project,
  plotSummary,
  characters,
  scenes,
  products,
  segments,
  finalVideoUrl,
  finalVideoPoster,
  finalMetaChip,
  badge,
  busy,
  exportBusy,
  mergeLoading,
  mergeError,
  canMergeFinalVideo,
  isMockTestPatternVideo,
  onBackToEdit,
  onMergeFinalVideo,
  onDownloadFinalVideo,
  onExportAll,
  onExportVideoPack,
  onExportScript,
  onExportStoryboard,
}: MobileOverviewDeliveryProps) {
  const primaryLabel = finalVideoUrl
    ? busy === 'video'
      ? '下载中...'
      : '下载成片'
    : canMergeFinalVideo
      ? mergeLoading
        ? '合成中...'
        : '合成成片'
      : '返回生成';
  const primaryDisabled = finalVideoUrl ? exportBusy : canMergeFinalVideo ? mergeLoading : false;
  const completedSegments = segments.filter((segment) => segment.hasVideo).length;

  const handlePrimary = () => {
    if (finalVideoUrl) {
      void onDownloadFinalVideo();
      return;
    }
    if (canMergeFinalVideo) {
      void onMergeFinalVideo();
      return;
    }
    onBackToEdit();
  };

  return (
    <main className="md:hidden px-4 pb-32 pt-20">
      <section className="rounded-2xl border border-[#EAEAEA] bg-white p-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div
              className="mb-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em]"
              style={{ background: badge.bg, color: badge.color, border: badge.border }}
            >
              <i className={`${badge.icon} text-[10px] ${project.statusBadge === 'in_progress' ? 'animate-spin' : ''}`} />
              {badge.label}
            </div>
            <h1 className="line-clamp-2 text-[22px] font-black leading-tight" style={{ fontFamily: "'Syne', sans-serif", color: '#1D1D1F' }}>
              {project.name}
            </h1>
          </div>
          <button
            type="button"
            disabled={exportBusy}
            onClick={() => void onExportAll()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[17px] disabled:opacity-50"
            style={{ background: '#F7F8FA', color: '#1D1D1F', border: '1px solid #EAEAEA' }}
            aria-label="导出全部"
          >
            <i className={busy === 'all' ? 'ri-loader-4-line animate-spin' : 'ri-download-cloud-line'} />
          </button>
        </div>

        <div className="overflow-hidden rounded-2xl bg-[#111] p-3">
          {finalVideoUrl ? (
            <video
              key={isMockTestPatternVideo ? 'mobile-mock-final' : 'mobile-final'}
              src={finalVideoUrl}
              className="aspect-[9/16] max-h-[62vh] w-full rounded-xl bg-black object-contain"
              controls
              playsInline
              poster={finalVideoPoster}
            />
          ) : (
            <div className="flex aspect-[9/16] max-h-[62vh] w-full flex-col items-center justify-center rounded-xl bg-black px-6 text-center">
              <i className="ri-movie-2-line text-3xl text-white/35" />
              <p className="mt-3 text-[14px] font-semibold text-white">{SHORT_DRAMA_UI.empty.noFinalVideo}</p>
              <p className="mt-2 text-[12px] leading-relaxed text-white/50">{SHORT_DRAMA_UI.empty.noFinalVideoHint}</p>
            </div>
          )}
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            { label: '片段', value: `${completedSegments}/${segments.length}` },
            { label: '比例', value: project.ratio },
            { label: '形式', value: project.format },
          ].map((item) => (
            <div key={item.label} className="rounded-xl bg-[#F7F8FA] px-3 py-2">
              <p className="truncate text-[13px] font-black" style={{ color: '#1D1D1F' }}>
                {item.value}
              </p>
              <p className="mt-0.5 text-[10px] font-semibold" style={{ color: '#8E8E93' }}>
                {item.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {(isMockTestPatternVideo || mergeError) && (
        <div className="mt-3 space-y-2">
          {isMockTestPatternVideo ? (
            <div className="rounded-xl px-3 py-2 text-[12px] leading-relaxed" style={{ background: 'rgba(180,83,9,0.08)', color: '#92400E', border: '1px solid rgba(180,83,9,0.25)' }}>
              {SHORT_DRAMA_UI.stepFour.mockTestVideoBanner}
            </div>
          ) : null}
          {mergeError ? (
            <div className="rounded-xl px-3 py-2 text-[12px] leading-relaxed" style={{ background: 'rgba(220,38,38,0.06)', color: '#B91C1C', border: '1px solid rgba(220,38,38,0.2)' }}>
              {mergeError}
            </div>
          ) : null}
        </div>
      )}

      <section className="mt-4 rounded-2xl border border-[#EAEAEA] bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[15px] font-black" style={{ color: '#1D1D1F' }}>
            成片信息
          </h2>
          <span className="max-w-[190px] truncate rounded-full bg-[#F7F8FA] px-2.5 py-1 text-[11px] font-semibold" style={{ color: '#6E6E73' }}>
            {isMockTestPatternVideo ? '测试拼接' : finalMetaChip}
          </span>
        </div>
        <div className="mt-3 space-y-2">
          {[
            { label: '成片地址', value: finalVideoUrl ? formatFinalVideoAddressDisplay(finalVideoUrl, isMockTestPatternVideo) : '等待合成' },
            { label: '创建时间', value: project.createdAt },
            { label: '流程状态', value: project.status || '—' },
            { label: '目标市场', value: project.market },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between gap-4 text-[12px]">
              <span className="shrink-0" style={{ color: '#8E8E93' }}>{item.label}</span>
              <span className="min-w-0 truncate text-right font-medium" style={{ color: '#1D1D1F' }}>{item.value}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[15px] font-black" style={{ color: '#1D1D1F' }}>
            片段预览
          </h2>
          <span className="text-[12px]" style={{ color: '#8E8E93' }}>
            {segments.length} 个
          </span>
        </div>
        {segments.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#D1D1D6] bg-white px-4 py-8 text-center text-[13px]" style={{ color: '#8E8E93' }}>
            {SHORT_DRAMA_UI.overview.emptySegments}
          </div>
        ) : (
          <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1">
            {segments.map((segment) => (
              <article key={segment.id} className="w-[43vw] min-w-[152px] snap-start rounded-2xl border border-[#EAEAEA] bg-white p-2">
                <div className="relative overflow-hidden rounded-xl bg-black" style={{ aspectRatio: '9/16' }}>
                  {segment.hasVideo && segment.videoUrl ? (
                    <video src={segment.videoUrl} className="h-full w-full object-cover object-top" muted playsInline controls poster={segment.posterUrl} />
                  ) : (
                    <>
                      <img src={segment.posterUrl} alt={segment.name} className="h-full w-full object-cover object-top opacity-90" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="rounded bg-black/55 px-2 py-1 text-[10px] text-white">暂无成片</span>
                      </div>
                    </>
                  )}
                  <span className="absolute left-2 top-2 rounded bg-white/90 px-1.5 py-0.5 text-[9px] font-bold" style={{ color: segment.color }}>
                    {segment.duration}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-[12px] font-semibold leading-snug" style={{ color: '#1D1D1F' }}>
                  {segment.name}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="mt-4 rounded-2xl border border-[#EAEAEA] bg-white p-4">
        <h2 className="text-[15px] font-black" style={{ color: '#1D1D1F' }}>
          项目素材
        </h2>
        <p className="mt-2 line-clamp-3 text-[12px] leading-relaxed" style={{ color: plotSummary.trim() ? '#444444' : '#AEAEB2' }}>
          {plotSummary.trim() ? plotSummary : '暂无剧情摘要'}
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <CompactAssetCount label="角色" value={characters.length} />
          <CompactAssetCount label="场景" value={scenes.length} />
          <CompactAssetCount label="产品" value={products.length} />
        </div>
        {characters.length > 0 ? (
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {characters.slice(0, 6).map((character, index) => (
              <div key={`${character.name}-${index}`} className="flex min-w-[96px] items-center gap-2 rounded-xl bg-[#F7F8FA] p-2">
                <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-[#ECEDEF]">
                  {character.img ? <img src={character.img} alt={character.name} className="h-full w-full object-cover" /> : null}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-semibold" style={{ color: '#1D1D1F' }}>{character.name}</p>
                  <p className="truncate text-[10px]" style={{ color: '#8E8E93' }}>{character.role}</p>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="mt-4 rounded-2xl border border-[#EAEAEA] bg-white p-4">
        <h2 className="text-[15px] font-black" style={{ color: '#1D1D1F' }}>
          导出
        </h2>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            { key: 'video_pack', label: '视频包', icon: 'ri-film-line', onClick: onExportVideoPack, loading: busy === 'video_pack' },
            { key: 'script', label: '脚本', icon: 'ri-file-text-line', onClick: onExportScript, loading: busy === 'script' },
            { key: 'storyboard', label: '分镜', icon: 'ri-layout-grid-line', onClick: onExportStoryboard, loading: busy === 'storyboard' },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              disabled={exportBusy}
              onClick={() => void item.onClick()}
              className="flex h-20 flex-col items-center justify-center gap-1.5 rounded-xl bg-[#F7F8FA] text-[12px] font-semibold disabled:opacity-50"
              style={{ color: '#1D1D1F', border: '1px solid #EAEAEA' }}
            >
              <i className={`${item.loading ? 'ri-loader-4-line animate-spin' : item.icon} text-[18px]`} />
              {item.label}
            </button>
          ))}
        </div>
      </section>

      <MobileBottomActionBar>
        <button
          type="button"
          onClick={onBackToEdit}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#EAEAEA] bg-white text-[18px]"
          style={{ color: '#444444' }}
          aria-label="返回编辑"
        >
          <i className="ri-arrow-left-line" />
        </button>
        <button
          type="button"
          disabled={primaryDisabled}
          onClick={handlePrimary}
          className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl text-[14px] font-semibold"
          style={{
            background: primaryDisabled ? '#D1D1D6' : '#1D1D1F',
            color: '#ffffff',
            cursor: primaryDisabled ? 'not-allowed' : 'pointer',
          }}
        >
          <i className={finalVideoUrl ? 'ri-download-cloud-line text-[15px]' : canMergeFinalVideo ? 'ri-film-line text-[15px]' : 'ri-edit-line text-[15px]'} />
          {primaryLabel}
        </button>
      </MobileBottomActionBar>
    </main>
  );
}

function CompactAssetCount({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-[#F7F8FA] px-3 py-2 text-center">
      <p className="text-[17px] font-black leading-none" style={{ color: '#1D1D1F' }}>
        {value}
      </p>
      <p className="mt-1 text-[10px] font-semibold" style={{ color: '#8E8E93' }}>
        {label}
      </p>
    </div>
  );
}
