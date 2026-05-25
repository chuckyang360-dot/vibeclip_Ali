import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { SDWorkflowNav } from './components/SDWorkflowNav';
import { StepFourAssetLibrary } from './components/StepFourAssetLibrary';
import { StepFourSegmentWorkbench } from './components/StepFourSegmentWorkbench';
import { StepFourVideoPreview } from './components/StepFourVideoPreview';
import { StepFourTimeline } from './components/StepFourTimeline';
import { MobileBottomActionBar } from './components/MobileBottomActionBar';
import { useStepFourPage } from './hooks/useStepFourPage';
import { NEUTRAL_VERTICAL_POSTER, resolvePublicMediaUrl } from './utils/shortDramaMedia';
import { SHORT_DRAMA_UI } from './utils/shortDramaUiCopy';
import { isScriptImportWorkflowLike, withProjectQuery } from './utils/shortDramaRoutes';
import type { Step4SegmentItem, Step4VideoStatusMap } from '@/types/shortDrama';
import type { PipelineSummaryDto, ScriptImportStateDto } from '@/types/shortDramaApi';

function isScriptImportPipeline(pipeline: PipelineSummaryDto | null): boolean {
  if (!pipeline) return false;
  if (isScriptImportWorkflowLike(pipeline)) return true;
  const assetTotal = Number(pipeline.asset_rows_total ?? 0);
  const segmentCount = Number(pipeline.segment_scripts_count ?? pipeline.segment_scripts?.length ?? 0);
  return segmentCount > 0 && assetTotal === 0 && pipeline.has_product_context === false && pipeline.has_story_blueprint === false;
}

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
    autoMaterializingSegments,
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
    isVideoRenderActive,
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
  const isScriptImportMode = isScriptImportPipeline(pipeline);
  const scriptImport = pipeline?.script_import || pipeline?.project?.script_import || null;

  const projectVideoHeadline = useMemo(() => {
    if (pipeline?.final_render_status === 'failed') {
      return `最终成片合成失败：${finalErrorDisplay || '请检查日志或重试合成'}`;
    }
    const st = pipelineVm.currentVideoStage;
    if (st === 'completed' || projectStatus === 'completed') {
      return '项目状态：已完成（含最终成片）';
    }
    if (st === 'final_rendering' && isVideoRenderActive) return '项目状态：最终成片合成中…';
    if (st === 'segments_complete_pending_final') return '项目状态：片段已全部就绪，可合成完整视频';
    if (st === 'segment_rendering' && isVideoRenderActive) return '项目状态：片段视频生成中…';
    if (projectStatus === 'video_segments_ready') return '项目状态：片段已齐，待合成最终成片';
    if (isVideoRenderActive && projectStatus === 'video_rendering') return '项目状态：片段视频生成中…';
    if (hasBackendSegmentScripts && displayTotal > 0 && doneCount < displayTotal) return '片段脚本已准备，等待生成视频';
    return '';
  }, [
    pipeline?.final_render_status,
    pipelineVm.currentVideoStage,
    projectStatus,
    finalErrorDisplay,
    isVideoRenderActive,
    hasBackendSegmentScripts,
    displayTotal,
    doneCount,
  ]);

  const videoActionsDisabled = !hasBackendSegmentScripts || !canGenerateVideos || batchGenerating;
  const mergeUiDisabled = !mergePrimaryActionsEnabled || batchGenerating;
  const step4Stale = pipeline?.project?.step_status?.step_4 === 'stale';

  if (phase === 'no_project' || projectId == null) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: '#ffffff', fontFamily: "'Inter', sans-serif" }}>
        <SDWorkflowNav currentStep={4} projectId={projectId} isDirty={isDirty} onSaveDraft={saveDraft} workflowMode={isScriptImportMode ? 'script_import' : 'standard'} />
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
        <SDWorkflowNav currentStep={4} projectName={navProjectName} projectId={projectId} isDirty={isDirty} onSaveDraft={saveDraft} workflowMode={isScriptImportMode ? 'script_import' : 'standard'} />
        <div className="flex flex-1 items-center justify-center pt-14">
          <div className="flex flex-col items-center gap-3">
            <i className="ri-loader-4-line text-2xl animate-spin" style={{ color: '#1D1D1F' }} />
            <p className="text-[13px]" style={{ color: '#8E8E93' }}>
              {phase === 'generating_segments' ? '正在准备片段数据...' : SHORT_DRAMA_UI.loading.pipeline}
            </p>
            {phase === 'generating_segments' ? (
              <p className="text-[12px] text-center max-w-md" style={{ color: '#8E8E93' }}>
                正在同步已生成的片段脚本，请稍候。
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
        <SDWorkflowNav currentStep={4} projectName={navProjectName} projectId={projectId} isDirty={isDirty} onSaveDraft={saveDraft} workflowMode={isScriptImportMode ? 'script_import' : 'standard'} />
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
      <SDWorkflowNav currentStep={4} projectName={navProjectName} projectId={projectId} isDirty={isDirty} onSaveDraft={saveDraft} workflowMode={isScriptImportMode ? 'script_import' : 'standard'} />

      {step4Stale ? (
        <div className="hidden px-5 pt-16 md:block">
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
            你已修改剧本或资产，当前分镜/视频基于旧内容生成，请重新生成后生效。
          </div>
        </div>
      ) : null}

      <MobileStepFourStudio
        segments={segments}
        activeSegment={activeSegment}
        active={active}
        videoStatus={videoStatus}
        previewTarget={previewTarget}
        posterUrl={posterUrl}
        videoSrc={videoSrc}
        finalVideoResolved={finalVideoResolved}
        finalVideoUrlRaw={pipeline?.final_video_url ?? null}
        step4Stale={step4Stale}
        segmentScriptsBlocked={segmentScriptsBlocked}
        segmentScriptsError={segmentScriptsError}
        segmentScriptsBusyError={segmentScriptsBusyError}
        autoMaterializingSegments={autoMaterializingSegments}
        hasBackendSegmentScripts={hasBackendSegmentScripts}
        canGenerateVideos={canGenerateVideos}
        videoStatusBlockedHint={videoStatusBlockedHint}
        projectVideoHeadline={projectVideoHeadline}
        isMockTestPatternVideo={isMockTestPatternVideo}
        generateError={generateError}
        mergeError={mergeError}
        doneCount={doneCount}
        displayTotal={displayTotal}
        batchGenerating={batchGenerating}
        videoActionsDisabled={videoActionsDisabled}
        mergeUiDisabled={mergeUiDisabled}
        mergeReadyByRequirement={mergeReadyByRequirement}
        timelineMergeLabel={timelineMergeLabel}
        onPreviewTargetChange={setPreviewTarget}
        onSegmentChange={setActiveSegment}
        onGenerateAll={handleGenerateAll}
        onGenerateVideo={handleGenerateVideo}
        onRegenerate={handleRegenerate}
        onRetryGenerateSegments={handleRetryGenerateSegments}
        onMergeFinalVideo={() => mergeFinalVideo({ buttonType: 'merge_only', navigateOnSuccess: false })}
        onBack={() => navigate(withProjectQuery(isScriptImportMode ? '/short-drama/create' : '/short-drama/assets', projectId))}
        onGoOverview={goOverview}
      />

      <div className="hidden flex-1 pt-14 md:flex" style={{ minHeight: 'calc(100vh - 56px)' }}>
        {isScriptImportMode ? (
          <StepFourScriptImportPanel scriptImport={scriptImport} segmentCount={segments.length} />
        ) : (
          <StepFourAssetLibrary library={assetLibraryVm} />
        )}

        <div className="flex flex-col flex-1 overflow-hidden">
          {(segmentScriptsBlocked ||
            segmentScriptsError ||
            autoMaterializingSegments ||
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
              {autoMaterializingSegments && (
                <div className="text-[12px] px-3 py-2 rounded-lg" style={{ background: 'rgba(51,65,85,0.06)', color: '#334155', border: '1px solid rgba(51,65,85,0.15)' }}>
                  正在准备片段数据...
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
                脚本 {hasBackendSegmentScripts ? segments.length : 0} /{' '}
                {displayTotal || segments.length || 0} · 视频 {doneCount} / {displayTotal || segments.length || 0}
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
                {autoMaterializingSegments ? '正在准备片段数据...' : '片段脚本暂未生成'}
              </p>
              <p className="text-[12px] text-center max-w-md" style={{ color: '#8E8E93' }}>
                {autoMaterializingSegments
                  ? '正在同步 S2 已生成的片段脚本，完成后会自动展示。'
                  : segmentScriptsError
                  ? '本次生成未完成，项目内容已保存。'
                  : segmentScriptsBlocked ||
                    (isScriptImportMode
                      ? '剧本解析还没有生成可用片段，请返回创作意图页重新导入。'
                      : '请先完成前置流程，或返回「角色场景」页确认资产规范已生成。')}
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
              scriptImportMode={isScriptImportMode}
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

      <div className="hidden px-6 py-3 md:flex items-center justify-between" style={{ background: '#F7F8FA', borderTop: '1px solid #EAEAEA' }}>
        <button
          type="button"
          onClick={() => navigate(withProjectQuery(isScriptImportMode ? '/short-drama/create' : '/short-drama/assets', projectId))}
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
          {isScriptImportMode ? '返回导入' : '上一步'}
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

function StepFourScriptImportPanel({
  scriptImport,
  segmentCount,
}: {
  scriptImport: ScriptImportStateDto | null;
  segmentCount: number;
}) {
  const analysis = scriptImport?.analysis || {};
  const confidence = typeof analysis.confidence === 'number' ? Math.round(analysis.confidence * 100) : null;
  const missing = Array.isArray(analysis.missing_fields) ? analysis.missing_fields.filter(Boolean) : [];
  const constraints = Array.isArray(analysis.constraints) ? analysis.constraints.filter(Boolean) : [];
  const rawText = scriptImport?.source?.raw_text || '';
  const fileName = scriptImport?.source?.file_name || '粘贴内容';

  return (
    <aside
      className="hidden w-64 shrink-0 flex-col overflow-y-auto md:flex"
      style={{ background: '#F7F8FA', borderRight: '1px solid #EAEAEA' }}
    >
      <div className="space-y-4 p-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#8E8E93' }}>
            剧本导入
          </p>
          <h3 className="mt-1 truncate text-[15px] font-bold" style={{ color: '#1D1D1F' }}>
            {fileName}
          </h3>
        </div>

        <div className="rounded-xl border border-[#E5E5EA] bg-white p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-semibold" style={{ color: '#6E6E73' }}>
              AI 解析
            </span>
            {confidence != null ? (
              <span className="rounded-full bg-[#F0F0F0] px-2 py-0.5 text-[10px] font-semibold text-[#444444]">
                {confidence}%
              </span>
            ) : null}
          </div>
          <div className="space-y-2 text-[11.5px] leading-relaxed" style={{ color: '#444444' }}>
            <p>类型：{analysis.input_type || 'mixed'}</p>
            <p>片段：{scriptImport?.segment_count || segmentCount}</p>
            {analysis.global_style ? <p>风格：{analysis.global_style}</p> : null}
            {analysis.summary ? <p className="line-clamp-4">摘要：{analysis.summary}</p> : null}
          </div>
        </div>

        {missing.length > 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="mb-2 text-[11px] font-semibold text-amber-900">待确认信息</p>
            <div className="space-y-1">
              {missing.slice(0, 5).map((item) => (
                <p key={item} className="text-[11px] leading-relaxed text-amber-900">
                  {item}
                </p>
              ))}
            </div>
          </div>
        ) : null}

        {constraints.length > 0 ? (
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#AEAEB2' }}>
              强约束
            </p>
            <div className="space-y-1.5">
              {constraints.slice(0, 6).map((item) => (
                <div key={item} className="rounded-lg border border-[#E5E5EA] bg-white px-2.5 py-2 text-[11px] leading-relaxed text-[#444444]">
                  {item}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {rawText ? (
          <details className="rounded-xl border border-[#E5E5EA] bg-white p-3">
            <summary className="cursor-pointer text-[11px] font-semibold" style={{ color: '#6E6E73' }}>
              查看原文
            </summary>
            <p className="mt-2 max-h-72 overflow-y-auto whitespace-pre-wrap text-[11px] leading-relaxed" style={{ color: '#444444' }}>
              {rawText}
            </p>
          </details>
        ) : null}
      </div>
    </aside>
  );
}

type MobileStepFourStudioProps = {
  segments: Step4SegmentItem[];
  activeSegment: number;
  active?: Step4SegmentItem;
  videoStatus: Step4VideoStatusMap;
  previewTarget: 'segment' | 'final';
  posterUrl: string;
  videoSrc: string | null;
  finalVideoResolved: string | null;
  finalVideoUrlRaw: string | null;
  step4Stale: boolean;
  segmentScriptsBlocked: string | null;
  segmentScriptsError: string | null;
  segmentScriptsBusyError: boolean;
  autoMaterializingSegments: boolean;
  hasBackendSegmentScripts: boolean;
  canGenerateVideos: boolean;
  videoStatusBlockedHint: string;
  projectVideoHeadline: string;
  isMockTestPatternVideo: boolean;
  generateError: string | null;
  mergeError: string | null;
  doneCount: number;
  displayTotal: number;
  batchGenerating: boolean;
  videoActionsDisabled: boolean;
  mergeUiDisabled: boolean;
  mergeReadyByRequirement: boolean;
  timelineMergeLabel: string;
  onPreviewTargetChange: (target: 'segment' | 'final') => void;
  onSegmentChange: (id: number) => void;
  onGenerateAll: () => Promise<void> | void;
  onGenerateVideo: (id: number) => Promise<void> | void;
  onRegenerate: (id: number) => Promise<void> | void;
  onRetryGenerateSegments: () => Promise<void> | void;
  onMergeFinalVideo: () => Promise<void> | void;
  onBack: () => void;
  onGoOverview: () => void;
};

function MobileStepFourStudio({
  segments,
  activeSegment,
  active,
  videoStatus,
  previewTarget,
  posterUrl,
  videoSrc,
  finalVideoResolved,
  finalVideoUrlRaw,
  step4Stale,
  segmentScriptsBlocked,
  segmentScriptsError,
  segmentScriptsBusyError,
  autoMaterializingSegments,
  hasBackendSegmentScripts,
  canGenerateVideos,
  videoStatusBlockedHint,
  projectVideoHeadline,
  isMockTestPatternVideo,
  generateError,
  mergeError,
  doneCount,
  displayTotal,
  batchGenerating,
  videoActionsDisabled,
  mergeUiDisabled,
  mergeReadyByRequirement,
  timelineMergeLabel,
  onPreviewTargetChange,
  onSegmentChange,
  onGenerateAll,
  onGenerateVideo,
  onRegenerate,
  onRetryGenerateSegments,
  onMergeFinalVideo,
  onBack,
  onGoOverview,
}: MobileStepFourStudioProps) {
  const total = displayTotal || segments.length || 0;
  const progress = total > 0 ? Math.round((doneCount / total) * 100) : 0;
  const primaryLabel = finalVideoUrlRaw
    ? '查看成片'
    : mergeReadyByRequirement
      ? timelineMergeLabel
      : batchGenerating
        ? '生成中...'
        : '全部生成';
  const primaryDisabled = finalVideoUrlRaw
    ? false
    : mergeReadyByRequirement
      ? mergeUiDisabled
      : videoActionsDisabled;

  const handlePrimary = () => {
    if (finalVideoUrlRaw) {
      onGoOverview();
      return;
    }
    if (mergeReadyByRequirement) {
      void onMergeFinalVideo();
      return;
    }
    void onGenerateAll();
  };

  const notices = [
    step4Stale ? { tone: 'warn' as const, text: '你已修改剧本或资产，当前视频基于旧内容生成，请重新生成后生效。' } : null,
    segmentScriptsBlocked ? { tone: 'warn' as const, text: segmentScriptsBlocked } : null,
    segmentScriptsError ? { tone: 'danger' as const, text: segmentScriptsBusyError ? '当前服务繁忙，请稍后重试。' : '生成失败，请稍后重试。' } : null,
    autoMaterializingSegments ? { tone: 'info' as const, text: '正在准备片段数据...' } : null,
    hasBackendSegmentScripts && !canGenerateVideos ? { tone: 'info' as const, text: videoStatusBlockedHint } : null,
    projectVideoHeadline ? { tone: 'info' as const, text: projectVideoHeadline } : null,
    isMockTestPatternVideo ? { tone: 'warn' as const, text: SHORT_DRAMA_UI.stepFour.mockTestVideoBanner } : null,
    generateError ? { tone: 'danger' as const, text: generateError } : null,
    mergeError ? { tone: 'danger' as const, text: mergeError } : null,
  ].filter(Boolean) as Array<{ tone: 'info' | 'warn' | 'danger'; text: string }>;

  return (
    <div className="md:hidden flex-1 px-4 pb-32 pt-[112px]">
      <div className="rounded-2xl border border-[#EAEAEA] bg-[#111] p-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/50">视频预览</p>
            <p className="truncate text-[13px] font-semibold text-white">
              {previewTarget === 'final' ? '完整成片' : active?.name || '当前片段'}
            </p>
          </div>
          <div className="flex rounded-lg bg-white/10 p-1">
            <button
              type="button"
              onClick={() => onPreviewTargetChange('segment')}
              className="rounded-md px-2.5 py-1 text-[11px] font-semibold"
              style={{
                background: previewTarget === 'segment' ? '#ffffff' : 'transparent',
                color: previewTarget === 'segment' ? '#1D1D1F' : 'rgba(255,255,255,0.72)',
              }}
            >
              片段
            </button>
            <button
              type="button"
              onClick={() => onPreviewTargetChange('final')}
              className="rounded-md px-2.5 py-1 text-[11px] font-semibold"
              style={{
                background: previewTarget === 'final' ? '#ffffff' : 'transparent',
                color: previewTarget === 'final' ? '#1D1D1F' : 'rgba(255,255,255,0.72)',
              }}
            >
              成片
            </button>
          </div>
        </div>
        {previewTarget === 'final' && finalVideoResolved ? (
          <video controls playsInline src={finalVideoResolved} poster={posterUrl} className="aspect-[9/16] max-h-[58vh] w-full rounded-xl bg-black object-contain" />
        ) : previewTarget === 'segment' && videoSrc ? (
          <video controls playsInline src={videoSrc} poster={posterUrl} className="aspect-[9/16] max-h-[58vh] w-full rounded-xl bg-black object-contain" />
        ) : (
          <div className="flex aspect-[9/16] max-h-[58vh] w-full items-center justify-center rounded-xl bg-black text-center text-[12px] text-white/50">
            {previewTarget === 'final' ? '合成完整视频后可预览' : '生成当前片段后可预览'}
          </div>
        )}
      </div>

      <div className="mt-4 rounded-2xl border border-[#EAEAEA] bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: '#8E8E93' }}>
              STEP 04
            </p>
            <h1 className="mt-1 text-[22px] font-black leading-tight" style={{ fontFamily: "'Syne', sans-serif", color: '#1D1D1F' }}>
              视频生成
            </h1>
          </div>
          <div className="rounded-2xl bg-[#F7F8FA] px-3 py-2 text-right">
            <p className="text-[18px] font-black leading-none" style={{ color: '#1D1D1F' }}>
              {doneCount}/{total}
            </p>
            <p className="mt-1 text-[10px] font-semibold" style={{ color: '#8E8E93' }}>
              已完成
            </p>
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#EAEAEA]">
          <div className="h-full rounded-full bg-[#1D1D1F] transition-all" style={{ width: `${progress}%` }} />
        </div>
        <button
          type="button"
          disabled={videoActionsDisabled}
          onClick={() => void onGenerateAll()}
          className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl text-[13px] font-semibold transition-all"
          style={{
            background: videoActionsDisabled ? '#EAEAEA' : '#1D1D1F',
            color: videoActionsDisabled ? '#AEAEB2' : '#ffffff',
            cursor: videoActionsDisabled ? 'not-allowed' : 'pointer',
          }}
        >
          <i className="ri-video-add-line text-[14px]" />
          {batchGenerating ? '正在生成全部片段' : '生成全部片段'}
        </button>
      </div>

      {notices.length > 0 ? (
        <div className="mt-3 space-y-2">
          {notices.map((notice, index) => (
            <div
              key={`${notice.tone}-${index}`}
              className="rounded-xl px-3 py-2 text-[12px] leading-relaxed"
              style={{
                background: notice.tone === 'danger' ? 'rgba(220,38,38,0.06)' : notice.tone === 'warn' ? 'rgba(180,83,9,0.08)' : 'rgba(51,65,85,0.06)',
                border: notice.tone === 'danger' ? '1px solid rgba(220,38,38,0.2)' : notice.tone === 'warn' ? '1px solid rgba(180,83,9,0.2)' : '1px solid rgba(51,65,85,0.15)',
                color: notice.tone === 'danger' ? '#B91C1C' : notice.tone === 'warn' ? '#92400E' : '#334155',
              }}
            >
              {notice.text}
            </div>
          ))}
        </div>
      ) : null}

      {!hasBackendSegmentScripts ? (
        <div className="mt-4 rounded-2xl border border-[#EAEAEA] bg-white px-5 py-8 text-center">
          <i className="ri-file-list-3-line text-3xl" style={{ color: '#AEAEB2' }} />
          <p className="mt-3 text-[15px] font-bold" style={{ color: '#1D1D1F' }}>
            {autoMaterializingSegments ? '正在准备片段数据...' : '片段脚本暂未生成'}
          </p>
          <p className="mt-2 text-[12px] leading-relaxed" style={{ color: '#8E8E93' }}>
            {autoMaterializingSegments
              ? '正在同步 S2 已生成的片段脚本，完成后会自动展示。'
              : segmentScriptsError
                ? '本次生成未完成，项目内容已保存。'
                : segmentScriptsBlocked
                  ? '返回「角色场景」页完成上一步后，系统会自动同步分段脚本。'
                  : '请先完成前置流程，或返回「角色场景」页确认资产规范已生成。'}
          </p>
          {segmentScriptsError ? (
            <button
              type="button"
              onClick={() => void onRetryGenerateSegments()}
              className="mt-5 h-11 rounded-xl px-5 text-[13px] font-semibold text-white"
              style={{ background: '#1D1D1F' }}
            >
              重新生成
            </button>
          ) : null}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-black" style={{ color: '#1D1D1F' }}>
              片段队列
            </h2>
            <span className="text-[12px]" style={{ color: '#8E8E93' }}>
              {segments.length} 个片段
            </span>
          </div>
          {segments.map((segment) => (
            <MobileSegmentCard
              key={segment.id}
              segment={segment}
              active={activeSegment === segment.id}
              status={videoStatus[segment.id] || 'idle'}
              generateDisabled={videoActionsDisabled}
              onOpen={() => {
                onSegmentChange(segment.id);
                onPreviewTargetChange('segment');
              }}
              onGenerate={() => {
                onSegmentChange(segment.id);
                void onGenerateVideo(segment.id);
              }}
              onRegenerate={() => {
                onSegmentChange(segment.id);
                void onRegenerate(segment.id);
              }}
            />
          ))}
        </div>
      )}

      <MobileBottomActionBar>
        <button
          type="button"
          onClick={onBack}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#EAEAEA] bg-white text-[18px]"
          style={{ color: '#444444' }}
          aria-label="上一步"
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
          {finalVideoUrlRaw ? <i className="ri-film-line text-[15px]" /> : <i className="ri-sparkling-line text-[15px]" />}
          {primaryLabel}
        </button>
      </MobileBottomActionBar>
    </div>
  );
}

function MobileSegmentCard({
  segment,
  active,
  status,
  generateDisabled,
  onOpen,
  onGenerate,
  onRegenerate,
}: {
  segment: Step4SegmentItem;
  active: boolean;
  status: Step4VideoStatusMap[number];
  generateDisabled: boolean;
  onOpen: () => void;
  onGenerate: () => void;
  onRegenerate: () => void;
}) {
  const statusMeta = getMobileVideoStatus(status);
  const segmentVideo = resolvePublicMediaUrl(segment.videoUrl);
  const isCompleted = status === 'completed' || Boolean(segment.videoUrl);
  const actionDisabled = generateDisabled || status === 'queued' || status === 'running';

  return (
    <div
      className="rounded-2xl border bg-white p-3"
      style={{ borderColor: active ? `${segment.color}66` : '#EAEAEA', boxShadow: active ? '0 10px 24px rgba(15,23,42,0.08)' : 'none' }}
    >
      <button type="button" onClick={onOpen} className="flex w-full items-start gap-3 text-left">
        <div className="relative h-[112px] w-[64px] shrink-0 overflow-hidden rounded-xl bg-[#111]">
          {segmentVideo ? (
            <video src={segmentVideo} poster={NEUTRAL_VERTICAL_POSTER} playsInline muted className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[20px] text-white/45">
              <i className="ri-movie-2-line" />
            </div>
          )}
          <span
            className="absolute bottom-1.5 left-1.5 right-1.5 rounded-md px-1.5 py-0.5 text-center text-[10px] font-semibold"
            style={{ background: statusMeta.bg, color: statusMeta.color }}
          >
            {statusMeta.label}
          </span>
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-2 text-[14px] font-bold leading-snug" style={{ color: '#1D1D1F' }}>
              {segment.name}
            </h3>
            <span className="shrink-0 rounded-full bg-[#F7F8FA] px-2 py-0.5 text-[10px] font-semibold" style={{ color: '#8E8E93' }}>
              {segment.duration}
            </span>
          </div>
          <p className="mt-2 line-clamp-2 text-[12px] leading-relaxed" style={{ color: '#6E6E73' }}>
            {segment.goal || segment.placement || '点击查看并生成该片段视频'}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {segment.characters.slice(0, 2).map((character) => (
              <span key={character} className="rounded-full bg-[#F7F8FA] px-2 py-1 text-[10px] font-medium" style={{ color: '#6E6E73' }}>
                {character}
              </span>
            ))}
            {segment.scene ? (
              <span className="rounded-full bg-[#F7F8FA] px-2 py-1 text-[10px] font-medium" style={{ color: '#6E6E73' }}>
                {segment.scene}
              </span>
            ) : null}
          </div>
        </div>
      </button>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onOpen}
          className="h-10 rounded-xl border border-[#EAEAEA] bg-white text-[12px] font-semibold"
          style={{ color: '#444444' }}
        >
          预览
        </button>
        <button
          type="button"
          disabled={actionDisabled}
          onClick={isCompleted ? onRegenerate : onGenerate}
          className="h-10 rounded-xl text-[12px] font-semibold"
          style={{
            background: actionDisabled ? '#EAEAEA' : '#1D1D1F',
            color: actionDisabled ? '#AEAEB2' : '#ffffff',
            cursor: actionDisabled ? 'not-allowed' : 'pointer',
          }}
        >
          {isCompleted ? '重新生成' : status === 'running' || status === 'queued' ? '生成中' : '生成视频'}
        </button>
      </div>
    </div>
  );
}

function getMobileVideoStatus(status: Step4VideoStatusMap[number]) {
  if (status === 'completed') return { label: '已完成', bg: 'rgba(4,120,87,0.14)', color: '#047857' };
  if (status === 'running') return { label: '生成中', bg: 'rgba(180,83,9,0.16)', color: '#92400E' };
  if (status === 'queued') return { label: '排队中', bg: 'rgba(180,83,9,0.12)', color: '#92400E' };
  if (status === 'failed') return { label: '失败', bg: 'rgba(220,38,38,0.12)', color: '#B91C1C' };
  return { label: '待生成', bg: 'rgba(255,255,255,0.88)', color: '#6E6E73' };
}
