import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { SDWorkflowNav } from './components/SDWorkflowNav';
import { StepFourAssetLibrary } from './components/StepFourAssetLibrary';
import { StepFourSegmentWorkbench } from './components/StepFourSegmentWorkbench';
import { StepFourVideoPreview } from './components/StepFourVideoPreview';
import { StepFourTimeline } from './components/StepFourTimeline';
import { useStepFourPage } from './hooks/useStepFourPage';
import { NEUTRAL_VERTICAL_POSTER, resolvePublicMediaUrl } from './utils/shortDramaMedia';
import { SHORT_DRAMA_UI } from './utils/shortDramaUiCopy';
import { withProjectQuery } from './utils/shortDramaRoutes';

export function ShortDramaStepFourPage() {
  const navigate = useNavigate();
  const {
    projectId,
    navProjectName,
    pipeline,
    pipelineVm,
    phase,
    loadError,
    segmentScriptsError,
    segmentScriptsBusyError,
    segmentScriptsBlocked,
    generateError,
    mergeError,
    segments,
    activeSegment,
    setActiveSegment,
    previewTarget,
    setPreviewTarget,
    videoStatus,
    batchGenerating,
    canMergeAll,
    canGenerateVideos,
    videoStatusBlockedHint,
    hasBackendSegmentScripts,
    doneCount,
    displayTotal,
    projectStatus,
    assetLibraryVm,
    stepFourVideoLanguage,
    handleGenerateAll,
    handleGenerateVideo,
    handleRegenerate,
    handleRetryGenerateSegments,
    handleSaveSegmentShot,
    mergeFinalVideo,
    mergePrimaryActionsEnabled,
    mergeReadyByRequirement,
    timelineMergeLabel,
    goOverview,
    isMockTestPatternVideo,
    handleAddSegment,
    goCreate,
    isDirty,
    markDirty,
    saveDraft,
  } = useStepFourPage();

  const active = segments.find((s) => s.id === activeSegment) ?? segments[0];
  const posterUrl = NEUTRAL_VERTICAL_POSTER;
  const videoSrc = active ? resolvePublicMediaUrl(active.videoUrl) : null;
  const finalVideoResolved = resolvePublicMediaUrl(pipeline?.final_video_url);
  const finalErrorDisplay = pipeline?.final_render_error || mergeError || null;

  const projectVideoHeadline = useMemo(() => {
    if (pipeline?.final_render_status === 'failed') {
      return `最终成片合成失败：${finalErrorDisplay || '请检查日志或重试合成'}`;
    }
    const st = pipelineVm.currentVideoStage;
    if (st === 'completed' || projectStatus === 'completed') {
      return '项目状态：已完成（含最终成片）';
    }
    if (st === 'final_rendering') return '项目状态：最终成片合成中…';
    if (st === 'segments_complete_pending_final') return '项目状态：片段已全部就绪，可合成完整视频';
    if (st === 'segment_rendering') return '项目状态：片段视频生成中…';
    if (projectStatus === 'video_segments_ready') return '项目状态：片段已齐，待合成最终成片';
    if (projectStatus === 'video_rendering') return '项目状态：视频流程进行中（片段或成片）';
    return '';
  }, [
    pipeline?.final_render_status,
    pipelineVm.currentVideoStage,
    projectStatus,
    finalErrorDisplay,
  ]);

  const videoActionsDisabled = !hasBackendSegmentScripts || !canGenerateVideos || batchGenerating;
  const mergeUiDisabled = !mergePrimaryActionsEnabled || batchGenerating;
  const step4Stale = pipeline?.project?.step_status?.step_4 === 'stale';

  if (phase === 'no_project' || projectId == null) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: '#ffffff', fontFamily: "'Inter', sans-serif" }}>
        <SDWorkflowNav currentStep={4} projectId={projectId} isDirty={isDirty} onSaveDraft={saveDraft} />
        <div className="mt-24 max-w-md text-center space-y-4">
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

  if (phase === 'loading' || phase === 'generating_segments') {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: '#ffffff', fontFamily: "'Inter', sans-serif" }}>
        <SDWorkflowNav currentStep={4} projectName={navProjectName} projectId={projectId} isDirty={isDirty} onSaveDraft={saveDraft} />
        <div className="flex flex-1 items-center justify-center pt-14">
          <div className="flex flex-col items-center gap-3">
            <i className="ri-loader-4-line text-2xl animate-spin" style={{ color: '#1D1D1F' }} />
            <p className="text-[13px]" style={{ color: '#8E8E93' }}>
              {phase === 'generating_segments' ? '正在生成片段脚本...' : SHORT_DRAMA_UI.loading.pipeline}
            </p>
            {phase === 'generating_segments' ? (
              <p className="text-[12px] text-center max-w-md" style={{ color: '#8E8E93' }}>
                正在生成导演分镜，正在结合商品理解、剧本和资产，生成可执行镜头。
              </p>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'error' && loadError) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: '#ffffff', fontFamily: "'Inter', sans-serif" }}>
        <SDWorkflowNav currentStep={4} projectName={navProjectName} projectId={projectId} isDirty={isDirty} onSaveDraft={saveDraft} />
        <div className="flex flex-1 flex-col items-center justify-center pt-14 px-6 gap-4">
          <p className="text-[14px] text-center max-w-lg" style={{ color: '#DC2626' }}>
            生成失败，请稍后重试。
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-5 py-2 rounded-xl text-[13px] cursor-pointer"
            style={{ background: '#F7F8FA', border: '1px solid #EAEAEA', color: '#444444' }}
          >
            重新生成
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#ffffff', fontFamily: "'Inter', sans-serif" }}>
      <SDWorkflowNav currentStep={4} projectName={navProjectName} projectId={projectId} isDirty={isDirty} onSaveDraft={saveDraft} />

      {step4Stale ? (
        <div className="px-5 pt-16">
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
            你已修改剧本或资产，当前分镜/视频基于旧内容生成，请重新生成后生效。
          </div>
        </div>
      ) : null}

      <div className="flex flex-1 pt-14" style={{ minHeight: 'calc(100vh - 56px)' }}>
        <StepFourAssetLibrary library={assetLibraryVm} />

        <div className="flex flex-col flex-1 overflow-hidden">
          {(segmentScriptsBlocked ||
            segmentScriptsError ||
            !canGenerateVideos ||
            generateError ||
            mergeError ||
            projectVideoHeadline ||
            isMockTestPatternVideo) && (
            <div className="px-5 pt-3 space-y-2 shrink-0">
              {segmentScriptsBlocked && (
                <div className="text-[12px] px-3 py-2 rounded-lg" style={{ background: 'rgba(180,83,9,0.08)', color: '#92400E', border: '1px solid rgba(180,83,9,0.2)' }}>
                  {segmentScriptsBlocked}
                </div>
              )}
              {segmentScriptsError && (
                <div className="text-[12px] px-3 py-2 rounded-lg" style={{ background: 'rgba(220,38,38,0.06)', color: '#B91C1C', border: '1px solid rgba(220,38,38,0.2)' }}>
                  {segmentScriptsBusyError ? '当前服务繁忙，请稍后重试。' : '生成失败，请稍后重试。'}
                </div>
              )}
              {hasBackendSegmentScripts && !canGenerateVideos && (
                <div className="text-[12px] px-3 py-2 rounded-lg" style={{ background: 'rgba(51,65,85,0.08)', color: '#334155', border: '1px solid rgba(51,65,85,0.2)' }}>
                  {videoStatusBlockedHint}
                </div>
              )}
              {projectVideoHeadline && (
                <div className="text-[12px] px-3 py-2 rounded-lg" style={{ background: 'rgba(51,65,85,0.06)', color: '#334155', border: '1px solid rgba(51,65,85,0.15)' }}>
                  {projectVideoHeadline}
                </div>
              )}
              {isMockTestPatternVideo && (
                <div
                  className="text-[12px] px-3 py-2 rounded-lg"
                  style={{
                    background: 'rgba(180,83,9,0.08)',
                    color: '#92400E',
                    border: '1px solid rgba(180,83,9,0.25)',
                  }}
                >
                  {SHORT_DRAMA_UI.stepFour.mockTestVideoBanner}
                </div>
              )}
              {generateError && (
                <div className="text-[12px] px-3 py-2 rounded-lg" style={{ background: 'rgba(220,38,38,0.06)', color: '#B91C1C', border: '1px solid rgba(220,38,38,0.2)' }}>
                  {generateError}
                </div>
              )}
              {mergeError && (
                <div className="text-[12px] px-3 py-2 rounded-lg" style={{ background: 'rgba(220,38,38,0.06)', color: '#B91C1C', border: '1px solid rgba(220,38,38,0.2)' }}>
                  {mergeError}
                </div>
              )}
            </div>
          )}

          <div
            className="px-5 pt-5 pb-3 flex items-center justify-between shrink-0"
            style={{ borderBottom: '1px solid #EAEAEA', background: '#ffffff' }}
          >
            <div>
              <span className="text-[11px] font-bold tracking-widest uppercase" style={{ color: '#8E8E93' }}>
                STEP 04
              </span>
              <h1 className="text-xl font-black mt-0.5" style={{ fontFamily: "'Syne', sans-serif", color: '#1D1D1F' }}>
                片段脚本
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[12px]" style={{ color: '#8E8E93' }}>
                {doneCount} / {displayTotal} 片段已生成
              </span>
              <div className="flex gap-1">
                {segments.map((s) => (
                  <div
                    key={s.id}
                    className="w-2 h-2 rounded-full"
                    style={{
                      background:
                        videoStatus[s.id] === 'completed'
                          ? '#047857'
                          : videoStatus[s.id] === 'queued' || videoStatus[s.id] === 'running'
                            ? '#B45309'
                            : videoStatus[s.id] === 'failed'
                              ? '#DC2626'
                            : '#EAEAEA',
                      transition: 'background 0.3s',
                    }}
                  />
                ))}
              </div>
              <button
                type="button"
                disabled={videoActionsDisabled}
                onClick={() => void handleGenerateAll()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11.5px] whitespace-nowrap transition-all duration-200"
                style={{
                  background: videoActionsDisabled ? '#EAEAEA' : '#F7F8FA',
                  color: videoActionsDisabled ? '#AEAEB2' : '#444444',
                  border: '1px solid #EAEAEA',
                  cursor: videoActionsDisabled ? 'not-allowed' : 'pointer',
                }}
                onMouseEnter={(e) => {
                  if (videoActionsDisabled) return;
                  (e.currentTarget as HTMLElement).style.background = '#1D1D1F';
                  (e.currentTarget as HTMLElement).style.color = '#ffffff';
                  (e.currentTarget as HTMLElement).style.borderColor = '#1D1D1F';
                }}
                onMouseLeave={(e) => {
                  if (videoActionsDisabled) return;
                  (e.currentTarget as HTMLElement).style.background = '#F7F8FA';
                  (e.currentTarget as HTMLElement).style.color = '#444444';
                  (e.currentTarget as HTMLElement).style.borderColor = '#EAEAEA';
                }}
              >
                <i className="ri-video-add-line text-[11px]" />
                {batchGenerating ? '生成中…' : '全部生成'}
              </button>
            </div>
          </div>

          {!hasBackendSegmentScripts ? (
            <div className="flex-1 flex flex-col items-center justify-center px-8 py-12" style={{ background: '#ffffff' }}>
              <i className="ri-file-list-3-line text-3xl mb-3" style={{ color: '#AEAEB2' }} />
              <p className="text-[14px] font-semibold text-center mb-1" style={{ color: '#1D1D1F' }}>
                片段脚本暂未生成
              </p>
              <p className="text-[12px] text-center max-w-md" style={{ color: '#8E8E93' }}>
                {segmentScriptsError
                  ? '本次生成未完成，项目内容已保存。'
                  : segmentScriptsBlocked || '请先完成前置流程，或返回「角色场景」页确认资产规范已生成。'}
              </p>
              {segmentScriptsError ? (
                <button
                  type="button"
                  onClick={() => void handleRetryGenerateSegments()}
                  className="mt-4 px-5 py-2 rounded-xl text-[13px] font-semibold cursor-pointer"
                  style={{ background: '#1D1D1F', color: '#ffffff' }}
                >
                  重新生成
                </button>
              ) : null}
            </div>
          ) : (
            <StepFourSegmentWorkbench
              segments={segments}
              activeSegment={activeSegment}
              videoStatus={videoStatus}
              renderProgressMap={{}}
              videoLanguage={stepFourVideoLanguage}
              onSegmentChange={setActiveSegment}
              videoGenerateDisabled={videoActionsDisabled}
              assetLibrary={assetLibraryVm}
              onSaveSegmentShot={handleSaveSegmentShot}
              onDirtyChange={markDirty}
              onGenerateVideo={(id) => {
                setActiveSegment(id);
                void handleGenerateVideo(id);
              }}
            />
          )}

          <StepFourTimeline
            segments={segments}
            videoStatus={videoStatus}
            activeSegment={activeSegment}
            onSegmentClick={setActiveSegment}
            onAddSegment={handleAddSegment}
            onCompose={() =>
              void mergeFinalVideo({ buttonType: 'merge_only', navigateOnSuccess: false })
            }
            mergeReady={canMergeAll}
            coreDoneCount={doneCount}
            coreTotal={displayTotal}
            composeDisabled={mergeUiDisabled}
            composeLabel={timelineMergeLabel}
            addSegmentDisabled={!hasBackendSegmentScripts}
          />
        </div>

        <StepFourVideoPreview
          projectId={projectId}
          segmentId={active?.id ?? activeSegment}
          videoStatus={videoStatus}
          renderProgress={null}
          onRegenerate={(id) => void handleRegenerate(id)}
          displayName={active?.name}
          accentColor={active?.color}
          posterUrl={posterUrl}
          videoSrc={videoSrc}
          regenerateDisabled={videoActionsDisabled}
          previewTarget={previewTarget}
          onPreviewTargetChange={setPreviewTarget}
          finalVideoSrc={finalVideoResolved}
          finalRenderError={finalErrorDisplay}
          segmentBackendKey={active?.backendSegmentId ?? null}
          segmentVideoUrlRaw={active?.videoUrl ?? null}
          finalVideoUrlRaw={pipeline?.final_video_url ?? null}
        />
      </div>

      <div className="px-6 py-3 flex items-center justify-between" style={{ background: '#F7F8FA', borderTop: '1px solid #EAEAEA' }}>
        <button
          type="button"
          onClick={() => navigate(withProjectQuery('/short-drama/assets', projectId))}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] cursor-pointer whitespace-nowrap transition-all duration-200"
          style={{ background: '#ffffff', color: '#444444', border: '1px solid #EAEAEA' }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = '#EAEAEA';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = '#ffffff';
          }}
        >
          <i className="ri-arrow-left-line text-[12px]" />
          上一步
        </button>
        <div className="flex items-center gap-2">
          {mergeReadyByRequirement ? (
            <button
              type="button"
              disabled={mergeUiDisabled}
              onClick={() =>
                void mergeFinalVideo({ buttonType: 'merge_only', navigateOnSuccess: false })
              }
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-200 whitespace-nowrap"
              style={{
                background: '#ffffff',
                color: mergeUiDisabled ? '#AEAEB2' : '#1D1D1F',
                border: '1px solid #D1D1D6',
                cursor: mergeUiDisabled ? 'not-allowed' : 'pointer',
              }}
            >
              <i className="ri-refresh-line text-[13px]" />
              {timelineMergeLabel}
            </button>
          ) : null}
          <button
            type="button"
            disabled={!pipeline?.final_video_url}
            onClick={() => goOverview()}
            className="flex items-center gap-2 px-7 py-2.5 rounded-xl text-[13.5px] font-semibold text-white transition-all duration-200 whitespace-nowrap"
            style={{
              background: !pipeline?.final_video_url ? '#D1D1D6' : '#1D1D1F',
              cursor: !pipeline?.final_video_url ? 'not-allowed' : 'pointer',
            }}
            onMouseEnter={(e) => {
              if (!pipeline?.final_video_url) return;
              (e.currentTarget as HTMLElement).style.background = '#374151';
            }}
            onMouseLeave={(e) => {
              if (!pipeline?.final_video_url) return;
              (e.currentTarget as HTMLElement).style.background = '#1D1D1F';
            }}
          >
            <i className="ri-film-line text-[13px]" />
            查看完整成片
            <i className="ri-arrow-right-line text-[12px]" />
          </button>
        </div>
      </div>
    </div>
  );
}
