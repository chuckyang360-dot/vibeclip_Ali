import { useNavigate } from 'react-router-dom';
import { useOverviewExport } from './hooks/useOverviewExport';
import { useOverviewPage } from './hooks/useOverviewPage';
import { VibeClipLogo } from './components/VibeClipLogo';
import { SHORT_DRAMA_UI } from './utils/shortDramaUiCopy';
import { withProjectQuery } from './utils/shortDramaRoutes';

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
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 lg:px-10 h-14"
        style={{ background: '#ffffff', borderBottom: '1px solid #EAEAEA', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}
      >
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate('/short-drama/projects')} className="flex items-center gap-2 cursor-pointer">
            <VibeClipLogo compact />
            <span className="text-[14px] font-bold" style={{ fontFamily: "'Syne', sans-serif", color: '#1D1D1F' }}>
              VibeClip
            </span>
          </button>
          <span style={{ color: '#D1D1D6' }}>/</span>
          <span className="text-[13px]" style={{ color: '#8E8E93' }}>
            {headerProjectName}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(withProjectQuery('/short-drama/step4', projectId))}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[12.5px] cursor-pointer whitespace-nowrap transition-colors"
            style={{ background: '#F7F8FA', color: '#444444', border: '1px solid #EAEAEA' }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = '#EAEAEA';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = '#F7F8FA';
            }}
          >
            <i className="ri-arrow-left-line text-[12px]" />
            返回编辑
          </button>
          <button
            type="button"
            disabled={exportBusy}
            onClick={() => void exportAll()}
            className="flex items-center gap-1.5 px-5 py-1.5 rounded-lg text-[12.5px] font-semibold whitespace-nowrap transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
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
                正在打包...
              </>
            ) : (
              <>
                <i className="ri-download-cloud-line text-[12px]" />
                一键全部导出
              </>
            )}
          </button>
        </div>
      </header>

      <main className="pt-14 px-6 lg:px-10 py-10">
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
              <h1 className="text-3xl font-black mb-3" style={{ fontFamily: "'Syne', sans-serif", color: '#1D1D1F' }}>
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
                            value: isMockTestPatternVideo ? '测试视频（ffmpeg 测试条拼接）' : '已生成（见预览）',
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
