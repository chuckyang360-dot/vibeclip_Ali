import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  generateShortDramaSegmentScripts,
  generateShortDramaSegmentVideos,
  generateShortDramaSingleSegmentVideo,
  getShortDramaRenderJob,
  getShortDramaPipeline,
  mergeShortDramaProjectVideo,
  ShortDramaApiError,
  touchShortDramaProjectStep,
  updateShortDramaSegmentShot,
} from '@/services/shortDramaApi';
import type { Step4SegmentItem, Step4VideoStatus, Step4VideoStatusMap } from '@/types/shortDrama';
import type { PipelineSummaryDto, RenderJobStatusResponseDto, UpdateSegmentShotBody } from '@/types/shortDramaApi';
import { mergeVideoStatus, pipelineAssetsToStepFourLibraryVm, pipelineToStepFourViewModel, pipelineUsesMockTestPatternVideo, resolveStepFourVideoLanguage, type StepFourAssetLibraryVm } from '../utils/stepFourAdapters';
import { resolvePublicMediaUrl } from '../utils/shortDramaMedia';
import { SHORT_DRAMA_UI } from '../utils/shortDramaUiCopy';
import { withProjectQuery } from '../utils/shortDramaRoutes';
import { touchProjectNameFromPipeline } from '../utils/shortDramaStorage';
import { workflowNavProjectName } from '../utils/workflowProjectName';
import { getCachedShortDramaPipeline, setCachedShortDramaPipeline } from '../utils/shortDramaPipelineCache';
import { useEffectiveShortDramaProjectId } from './useEffectiveShortDramaProjectId';

export type Step4MergeButtonType = 'merge_only' | 'merge_and_view';

const SEGMENT_COLORS = ['#B45309', '#DC2626', '#047857', '#334155', '#9333EA', '#0F766E'];

const VIDEO_ALLOWED_STATUSES = new Set([
  'assets_ready',
  'segments_generated',
  'video_rendering',
  'video_segments_ready',
  'completed',
]);

const PIPELINE_POLLING_ACTIVE_STATUSES = new Set([
  'video_rendering',
  'segment_rendering',
  'generating',
  'pending',
]);

function pipelineHasSegmentScripts(p: PipelineSummaryDto | null): boolean {
  const rows = p?.segment_scripts;
  if (!Array.isArray(rows) || rows.length === 0) return false;
  return rows.some((r) => r != null && typeof r === 'object' && 'segment_id' in r);
}

function pipelineAssetsCount(p: PipelineSummaryDto | null | undefined): number {
  if (!p?.assets) return 0;
  const chars = Array.isArray(p.assets.characters) ? p.assets.characters.length : 0;
  const scenes = Array.isArray(p.assets.scenes) ? p.assets.scenes.length : 0;
  const products = Array.isArray(p.assets.products) ? p.assets.products.length : 0;
  return chars + scenes + products;
}

function pipelineSegmentsCount(p: PipelineSummaryDto | null | undefined): number {
  const rows = p?.segment_scripts;
  if (!Array.isArray(rows)) return 0;
  return rows.filter((r) => r != null && typeof r === 'object' && 'segment_id' in r).length;
}

function mergeLightweightPipeline(
  prev: PipelineSummaryDto | null,
  next: PipelineSummaryDto,
): PipelineSummaryDto {
  if (!next.lightweight) return next;
  if (!prev) return next;

  const merged: PipelineSummaryDto = {
    ...prev,
    ...next,
    project: {
      ...prev.project,
      ...next.project,
    },
    assets: prev.assets,
    segment_scripts: prev.segment_scripts,
    product_context: prev.product_context,
    story_blueprint: prev.story_blueprint,
  };

  console.info('[S4_LIGHTWEIGHT_PIPELINE_MERGE]', {
    prevAssetsCount: pipelineAssetsCount(prev),
    prevSegmentsCount: pipelineSegmentsCount(prev),
    nextAssetsCount: pipelineAssetsCount(next),
    nextSegmentsCount: pipelineSegmentsCount(next),
    mergedAssetsCount: pipelineAssetsCount(merged),
    mergedSegmentsCount: pipelineSegmentsCount(merged),
    lightweight: next.lightweight === true,
  });

  return merged;
}

export type StepFourPhase = 'idle' | 'no_project' | 'loading' | 'generating_segments' | 'ready' | 'error';

export function useStepFourPage() {
  const navigate = useNavigate();
  const { effectiveProjectId: projectId, projectName } = useEffectiveShortDramaProjectId();

  const [pipeline, setPipeline] = useState<PipelineSummaryDto | null>(null);
  const [phase, setPhase] = useState<StepFourPhase>('idle');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [segmentScriptsError, setSegmentScriptsError] = useState<string | null>(null);
  const [segmentScriptsErrorRaw, setSegmentScriptsErrorRaw] = useState<string | null>(null);
  const [segmentScriptsBusyError, setSegmentScriptsBusyError] = useState(false);
  const [segmentScriptsBlocked, setSegmentScriptsBlocked] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [mergeError, setMergeError] = useState<string | null>(null);

  const [batchGenerating, setBatchGenerating] = useState(false);
  const [mergeLoading, setMergeLoading] = useState(false);
  const [segmentStatusOverrides, setSegmentStatusOverrides] = useState<Partial<Record<number, Step4VideoStatus>>>({});
  const [segmentRenderJobs, setSegmentRenderJobs] = useState<Record<number, number>>({});

  const [localAdditions, setLocalAdditions] = useState<Step4SegmentItem[]>([]);
  const [activeSegment, setActiveSegment] = useState(1);
  /** 右侧预览：当前片段视频 vs 最终成片 */
  const [previewTarget, setPreviewTarget] = useState<'segment' | 'final'>('segment');
  const [isDirty, setIsDirty] = useState(false);
  const markDirty = useCallback(() => {
    setIsDirty(true);
  }, []);

  const isBusyGenerationError = useCallback((err: unknown): boolean => {
    const msg =
      err instanceof ShortDramaApiError
        ? `${err.message} ${err.status}`
        : err instanceof Error
          ? err.message
          : String(err ?? '');
    return (
      err instanceof ShortDramaApiError &&
      err.status === 503
    ) || /service is currently unavailable|model is at capacity|currently cannot serve this request|please try again later|xai responses api http 503|http 503/i.test(msg);
  }, []);

  const refreshPipeline = useCallback(async () => {
    if (projectId == null) return null;
    const p = await getShortDramaPipeline(projectId);
    setPipeline(p);
    setCachedShortDramaPipeline(projectId, p);
    touchProjectNameFromPipeline(projectId, p.project?.project_name);
    if (import.meta.env.DEV) {
      console.info('[STEP4_PIPELINE_VIDEO_STATE]', {
        current_video_stage: p.current_video_stage,
        has_all_segment_videos: p.has_all_segment_videos,
        has_final_video: p.has_final_video,
        final_render_status: p.final_render_status,
        final_render_error: p.final_render_error,
        project_status: p.project?.status,
      });
    }
    return p;
  }, [projectId]);

  const pollEpochRef = useRef(0);
  const segmentJobPollersRef = useRef<Record<number, number>>({});
  const segmentJobPollFailuresRef = useRef<Record<number, number>>({});
  const segmentJobAbortRef = useRef<Record<number, AbortController>>({});
  const pipelinePollFailureRef = useRef(0);
  const pipelinePollAbortRef = useRef<AbortController | null>(null);

  const shouldKeepPipelinePolling = useCallback((p: PipelineSummaryDto | null | undefined): boolean => {
    if (!p) return false;
    const stage = String(p.current_video_stage || '').trim();
    if (stage === 'segment_rendering' || stage === 'final_rendering') return true;

    const effectiveStatus = String(p.project?.effective_status || p.project?.status || '').trim().toLowerCase();
    const isExplicitFailure =
      effectiveStatus === 'failed' ||
      String(p.final_render_status || '').trim().toLowerCase() === 'failed' ||
      !!String(p.final_render_error || '').trim();
    if (isExplicitFailure) return false;

    return PIPELINE_POLLING_ACTIVE_STATUSES.has(effectiveStatus);
  }, []);

  const stopSegmentJobPolling = useCallback((segmentUiId: number) => {
    const timerId = segmentJobPollersRef.current[segmentUiId];
    if (timerId != null) {
      window.clearInterval(timerId);
      delete segmentJobPollersRef.current[segmentUiId];
    }
    segmentJobPollFailuresRef.current[segmentUiId] = 0;
    segmentJobAbortRef.current[segmentUiId]?.abort();
    delete segmentJobAbortRef.current[segmentUiId];
  }, []);

  const startSegmentJobPolling = useCallback(
    (segmentUiId: number, renderJobId: number) => {
      stopSegmentJobPolling(segmentUiId);
      setSegmentRenderJobs((prev) => ({ ...prev, [segmentUiId]: renderJobId }));
      setSegmentStatusOverrides((prev) => ({ ...prev, [segmentUiId]: 'running' }));
      console.info('[FRONT_SEGMENT_STATE_UPDATE]', { segment_ui_id: segmentUiId, status: 'running' });

      const tick = async () => {
        try {
          segmentJobAbortRef.current[segmentUiId]?.abort();
          const ctrl = new AbortController();
          segmentJobAbortRef.current[segmentUiId] = ctrl;
          const job: RenderJobStatusResponseDto = await getShortDramaRenderJob(renderJobId, { signal: ctrl.signal });
          const st = (job.status || '').toLowerCase();
          const mapped: Step4VideoStatus =
            st === 'completed' ? 'completed' : st === 'failed' ? 'failed' : st === 'queued' || st === 'pending' ? 'queued' : 'running';
          console.info('[FRONT_RENDER_JOB_POLL]', {
            render_job_id: renderJobId,
            segment_id: job.segment_id,
            status: mapped,
            progress: job.progress,
            video_url: job.video_url || '',
          });
          setSegmentStatusOverrides((prev) => ({ ...prev, [segmentUiId]: mapped }));
          segmentJobPollFailuresRef.current[segmentUiId] = 0;
          console.info('[FRONT_SEGMENT_STATE_UPDATE]', { segment_ui_id: segmentUiId, status: mapped });
          if (st === 'completed') {
            stopSegmentJobPolling(segmentUiId);
            console.info('[FRONT_RENDER_JOB_COMPLETED]', {
              render_job_id: renderJobId,
              segment_id: job.segment_id,
              video_url: job.video_url || '',
            });
            setGenerateError(null);
            await refreshPipeline();
            return;
          }
          if (st === 'failed') {
            stopSegmentJobPolling(segmentUiId);
            setGenerateError(job.error || `片段 ${job.segment_id} 生成失败`);
            await refreshPipeline();
          }
        } catch {
          segmentJobPollFailuresRef.current[segmentUiId] = (segmentJobPollFailuresRef.current[segmentUiId] || 0) + 1;
          if (segmentJobPollFailuresRef.current[segmentUiId] >= 3) {
            stopSegmentJobPolling(segmentUiId);
            setSegmentStatusOverrides((prev) => ({ ...prev, [segmentUiId]: 'failed' }));
            console.info('[FRONT_SEGMENT_STATE_UPDATE]', { segment_ui_id: segmentUiId, status: 'failed' });
          }
        }
      };

      void tick();
      const id = window.setInterval(() => {
        void tick();
      }, 3000);
      segmentJobPollersRef.current[segmentUiId] = id;
    },
    [refreshPipeline, stopSegmentJobPolling],
  );

  useEffect(() => {
    if (projectId == null || phase !== 'ready' || !!loadError) return;
    if (!shouldKeepPipelinePolling(pipeline)) return;

    const stage = pipeline?.current_video_stage ?? '';

    pollEpochRef.current += 1;
    const epoch = pollEpochRef.current;
    console.info('[STEP4_POLLING_START]', { reason: 'video_stage', stage });

    const id = window.setInterval(() => {
      void (async () => {
        if (pollEpochRef.current !== epoch) return;
        try {
          pipelinePollAbortRef.current?.abort();
          const ctrl = new AbortController();
          pipelinePollAbortRef.current = ctrl;
          const p = await getShortDramaPipeline(projectId, { signal: ctrl.signal, lightweight: true });
          if (pollEpochRef.current !== epoch) return;
          setPipeline((prev) => {
            const merged = mergeLightweightPipeline(prev, p);
            if (projectId != null) setCachedShortDramaPipeline(projectId, merged);
            return merged;
          });
          touchProjectNameFromPipeline(projectId, p.project?.project_name);
          pipelinePollFailureRef.current = 0;
          if (!shouldKeepPipelinePolling(p)) {
            console.info('[STEP4_POLLING_STOP]', {
              reason: 'pipeline_not_in_progress',
              stage: p.current_video_stage ?? '',
              effective_status: p.project?.effective_status ?? p.project?.status ?? '',
              final_render_status: p.final_render_status ?? '',
            });
            window.clearInterval(id);
            pollEpochRef.current += 1;
          }
        } catch {
          pipelinePollFailureRef.current += 1;
          if (pipelinePollFailureRef.current >= 3) {
            window.clearInterval(id);
            console.info('[STEP4_POLLING_STOP]', { reason: 'fetch_error_3x' });
            setGenerateError('当前片段生成状态查询失败，请稍后重试当前片段。');
            pollEpochRef.current += 1;
          }
        }
      })();
    }, 3000);

    const maxWait = window.setTimeout(
      () => {
        window.clearInterval(id);
        if (pollEpochRef.current === epoch) {
          console.info('[STEP4_POLLING_STOP]', { reason: 'timeout_120s' });
          pollEpochRef.current += 1;
        }
      },
      120_000,
    );

    return () => {
      window.clearInterval(id);
      window.clearTimeout(maxWait);
      pipelinePollAbortRef.current?.abort();
      pipelinePollAbortRef.current = null;
    };
  }, [projectId, phase, pipeline, loadError, shouldKeepPipelinePolling]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      let hasCache = false;
      if (projectId == null) {
        setPhase('no_project');
        setPipeline(null);
        setLoadError(null);
        setSegmentScriptsError(null);
        setSegmentScriptsErrorRaw(null);
        setSegmentScriptsBusyError(false);
        setSegmentScriptsBlocked(null);
        return;
      }

      setLoadError(null);
      setSegmentScriptsError(null);
      setSegmentScriptsErrorRaw(null);
      setSegmentScriptsBusyError(false);
      setSegmentScriptsBlocked(null);

      try {
        const cached = getCachedShortDramaPipeline(projectId);
        if (cached) {
          hasCache = true;
          console.info('[CACHE_PIPELINE_HIT]', { projectId, sourcePage: 'step4' });
          setPipeline(cached);
          setPhase('ready');
        } else {
          console.info('[CACHE_PIPELINE_MISS]', { projectId, sourcePage: 'step4' });
          setPhase('loading');
        }

        const startedAt = performance.now();
        let p = await getShortDramaPipeline(projectId);
        if (cancelled) return;
        console.info('[CACHE_PIPELINE_REFRESH_SUCCESS]', {
          projectId,
          sourcePage: 'step4',
          durationMs: Math.round(performance.now() - startedAt),
        });
        touchProjectNameFromPipeline(projectId, p.project?.project_name);
        setPipeline(p);
        setCachedShortDramaPipeline(projectId, p);

        const hasScripts = pipelineHasSegmentScripts(p);
        const st = p.project?.status ?? '';

        if (!hasScripts) {
          if (st === 'asset_specs_generated' || st === 'assets_ready') {
            setPhase('generating_segments');
            try {
              await generateShortDramaSegmentScripts(projectId);
              p = await getShortDramaPipeline(projectId);
              if (cancelled) return;
              setPipeline(p);
              setCachedShortDramaPipeline(projectId, p);
              touchProjectNameFromPipeline(projectId, p.project?.project_name);
              if (!pipelineHasSegmentScripts(p)) {
                setSegmentScriptsBusyError(false);
                setSegmentScriptsError('生成失败，请稍后重试。');
                setSegmentScriptsErrorRaw('segment scripts missing after generation');
              }
            } catch (e) {
              if (cancelled) return;
              const busy = isBusyGenerationError(e);
              setSegmentScriptsBusyError(busy);
              setSegmentScriptsError(busy ? '当前服务繁忙，请稍后重试。' : '生成失败，请稍后重试。');
              setSegmentScriptsErrorRaw(
                e instanceof ShortDramaApiError ? `status=${e.status}; ${e.message}` : e instanceof Error ? e.message : String(e),
              );
              try {
                const refreshed = await getShortDramaPipeline(projectId);
                if (!cancelled) {
                  setPipeline(refreshed);
                  setCachedShortDramaPipeline(projectId, refreshed);
                  touchProjectNameFromPipeline(projectId, refreshed.project?.project_name);
                }
              } catch {
                /* keep last pipeline */
              }
            }
          } else {
            setSegmentScriptsBlocked(SHORT_DRAMA_UI.stepFour.segmentScriptsBlocked);
          }
        }

        if (cancelled) return;
        setPhase('ready');
      } catch (e) {
        if (cancelled) return;
        const msg =
          e instanceof ShortDramaApiError ? e.message : SHORT_DRAMA_UI.error.pipelineLoad;
        console.warn('[CACHE_PIPELINE_REFRESH_ERROR]', {
          projectId,
          sourcePage: 'step4',
          error: msg,
        });
        if (!hasCache) {
          setLoadError(msg);
          setPhase('error');
        } else {
          setGenerateError('后台刷新失败，已展示缓存数据。');
          setPhase('ready');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId, isBusyGenerationError]);

  const handleRetryGenerateSegments = useCallback(async () => {
    if (projectId == null) return;
    setSegmentScriptsError(null);
    setSegmentScriptsErrorRaw(null);
    setSegmentScriptsBusyError(false);
    setPhase('generating_segments');
    try {
      await generateShortDramaSegmentScripts(projectId);
      const p = await getShortDramaPipeline(projectId);
      setPipeline(p);
      touchProjectNameFromPipeline(projectId, p.project?.project_name);
      if (!pipelineHasSegmentScripts(p)) {
        setSegmentScriptsError('生成失败，请稍后重试。');
        setSegmentScriptsErrorRaw('segment scripts missing after retry generation');
      }
    } catch (e) {
      const busy = isBusyGenerationError(e);
      setSegmentScriptsBusyError(busy);
      setSegmentScriptsError(busy ? '当前服务繁忙，请稍后重试。' : '生成失败，请稍后重试。');
      setSegmentScriptsErrorRaw(
        e instanceof ShortDramaApiError ? `status=${e.status}; ${e.message}` : e instanceof Error ? e.message : String(e),
      );
      await refreshPipeline();
    } finally {
      setPhase('ready');
    }
  }, [projectId, isBusyGenerationError, refreshPipeline]);

  useEffect(() => {
    if (!pipeline || projectId == null) return;
    console.info('[FRONT_PROJECT_DATA_RESTORED]', { project_id: projectId, page: 'step_4' });
    if (pipeline.project?.step_status?.step_4 === 'stale') {
      console.info('[FRONT_STEP_STALE_BANNER_SHOWN]', { project_id: projectId, step: 'step_4' });
    }
  }, [pipeline, projectId]);

  useEffect(() => {
    console.info('[FRONT_DIRTY_STATE_CHANGED]', { project_id: projectId ?? null, step: 'step_4', dirty: isDirty });
  }, [isDirty, projectId]);

  useEffect(() => {
    return () => {
      Object.values(segmentJobPollersRef.current).forEach((id) => {
        window.clearInterval(id);
      });
      Object.values(segmentJobAbortRef.current).forEach((c) => c.abort());
      pipelinePollAbortRef.current?.abort();
      segmentJobPollersRef.current = {};
      segmentJobAbortRef.current = {};
    };
  }, []);

  const pipelineVm = useMemo(() => pipelineToStepFourViewModel(pipeline), [pipeline]);

  const assetLibraryVm: StepFourAssetLibraryVm = useMemo(
    () => pipelineAssetsToStepFourLibraryVm(pipeline?.assets),
    [pipeline?.assets],
  );
  const stepFourVideoLanguage = useMemo(() => resolveStepFourVideoLanguage(pipeline), [pipeline]);

  const projectStatus = pipelineVm.projectStatus;
  const pipelineEffectiveStatus = String(pipeline?.project?.effective_status || '').trim();
  const suggestedStatus = String(pipeline?.project?.suggested_status || '').trim();
  const statusRecoverable = Boolean(pipeline?.project?.status_recoverable);
  const effectiveStatus = pipelineEffectiveStatus || projectStatus || suggestedStatus;
  const canGenerateVideos = VIDEO_ALLOWED_STATUSES.has(effectiveStatus);
  const videoStatusBlockedHint = `当前项目状态尚不允许生成片段视频（当前 ${effectiveStatus || 'unknown'}，需 assets_ready / segments_generated / video_rendering / video_segments_ready / completed）。请在后端流程到达可渲染阶段后再试。`;
  const hasBackendSegmentScripts = pipelineVm.coreSegments.length > 0;
  useEffect(() => {
    if (!pipeline?.project) return;
    console.info('[S4_EFFECTIVE_STATUS_CHECK]', {
      status: String(pipeline.project.status || ''),
      effective_status: pipelineEffectiveStatus || null,
      suggested_status: suggestedStatus || null,
      status_recoverable: statusRecoverable,
      effectiveStatus,
      canGenerateVideo: canGenerateVideos,
    });
    console.info('[S4_EFFECTIVE_STATUS]', {
      status: projectStatus,
      effective_status: pipelineEffectiveStatus || null,
      suggested_status: suggestedStatus || null,
      status_recoverable: statusRecoverable,
      effectiveStatus,
      canGenerateVideo: canGenerateVideos,
    });
  }, [pipeline?.project, projectStatus, pipelineEffectiveStatus, suggestedStatus, statusRecoverable, effectiveStatus, canGenerateVideos]);

  useEffect(() => {
    if (pipelineVm.coreSegments.length === 0 && pipeline?.lightweight !== true) {
      setLocalAdditions([]);
    }
  }, [pipelineVm.coreSegments.length, pipeline?.lightweight, projectId]);

  useEffect(() => {
    const ids = pipelineVm.coreSegments.map((s) => s.id);
    if (ids.length && !ids.includes(activeSegment)) {
      setActiveSegment(ids[0]);
    }
  }, [pipelineVm.coreSegments, activeSegment]);

  useEffect(() => {
    setPreviewTarget('segment');
  }, [activeSegment]);

  const segments = useMemo(() => {
    if (pipelineVm.coreSegments.length === 0) return [];
    return [...pipelineVm.coreSegments, ...localAdditions];
  }, [pipelineVm.coreSegments, localAdditions]);

  useEffect(() => {
    for (const seg of pipelineVm.coreSegments) {
      const row = pipeline?.segment_scripts?.find((x) => x.segment_id === seg.backendSegmentId);
      if (!row?.render_job_id) continue;
      const st = (row.render_status || '').toLowerCase();
      if (st === 'running' || st === 'queued' || st === 'pending') {
        startSegmentJobPolling(seg.id, row.render_job_id);
      }
    }
  }, [pipeline?.segment_scripts, pipelineVm.coreSegments, startSegmentJobPolling]);

  const runtimeStatusOverrides = useMemo(() => {
    const o: Partial<Record<number, Step4VideoStatus>> = {};
    if (batchGenerating) {
      for (const s of pipelineVm.coreSegments) {
        if (s.backendSegmentId) o[s.id] = 'running';
      }
    }
    Object.assign(o, segmentStatusOverrides);
    return o;
  }, [batchGenerating, pipelineVm.coreSegments, segmentStatusOverrides]);

  const videoStatus: Step4VideoStatusMap = useMemo(() => {
    const base = { ...pipelineVm.videoStatusFromPipeline };
    for (const s of localAdditions) {
      if (base[s.id] === undefined) base[s.id] = 'idle';
    }
    return mergeVideoStatus(base, runtimeStatusOverrides);
  }, [pipelineVm.videoStatusFromPipeline, runtimeStatusOverrides, localAdditions]);

  const canMergeAll = pipelineVm.canMergeAll;
  const segmentVideoCount = Number(pipeline?.project?.segment_video_count ?? 0);
  const segmentVideoTotal = Number(pipeline?.project?.segment_video_total ?? 0);
  const hasAllSegmentsByCount =
    Number.isFinite(segmentVideoCount) &&
    Number.isFinite(segmentVideoTotal) &&
    segmentVideoTotal > 0 &&
    segmentVideoCount === segmentVideoTotal;
  const hasAllSegmentsByStatus =
    effectiveStatus === 'video_segments_ready' || effectiveStatus === 'completed';
  const mergeReadyByRequirement = canMergeAll || hasAllSegmentsByStatus || hasAllSegmentsByCount;


  const hasFinalVideo = useMemo(
    () => !!resolvePublicMediaUrl(pipeline?.final_video_url),
    [pipeline?.final_video_url],
  );

  const canCallMergeApi = useMemo(() => {
    if (!mergeReadyByRequirement) return false;
    return true;
  }, [mergeReadyByRequirement]);

  /** 时间轴 / 底栏：可点「合成」调 API，或已完成且已有成片时走「仅跳转」 */
  const mergePrimaryActionsEnabled = useMemo(() => {
    if (mergeLoading) return false;
    return canCallMergeApi || hasFinalVideo;
  }, [mergeLoading, canCallMergeApi, hasFinalVideo]);

  const isMockTestPatternVideo = useMemo(() => pipelineUsesMockTestPatternVideo(pipeline), [pipeline]);

  const timelineMergeLabel = mergeLoading
    ? '合成中...'
    : hasFinalVideo
      ? '重新合成完整视频'
      : '合成完整视频';

  const doneCount = useMemo(() => {
    return pipelineVm.coreSegments.filter((s) => !!resolvePublicMediaUrl(s.videoUrl)).length;
  }, [pipelineVm.coreSegments]);

  const displayTotal = pipelineVm.coreSegments.length;

  const navProjectName = useMemo(
    () =>
      workflowNavProjectName({
        pipelineProjectName: pipeline?.project?.project_name,
        sessionProjectName: projectName,
      }),
    [pipeline?.project?.project_name, projectName],
  );

  const handleGenerateAll = useCallback(async () => {
    if (projectId == null || !hasBackendSegmentScripts || !canGenerateVideos) return;
    setGenerateError(null);
    setBatchGenerating(true);
    try {
      await generateShortDramaSegmentVideos(projectId);
      await refreshPipeline();
      console.info('[FRONT_STEP_STATUS_UPDATED]', { project_id: projectId, step: 'step_4', action: 'generate_all_videos' });
    } catch (e) {
      const msg = e instanceof ShortDramaApiError ? e.message : SHORT_DRAMA_UI.error.videoBatch;
      setGenerateError(msg);
    } finally {
      setBatchGenerating(false);
    }
  }, [projectId, refreshPipeline, hasBackendSegmentScripts, canGenerateVideos]);

  const runSingleGenerate = useCallback(
    async (segId: number) => {
      if (projectId == null || !canGenerateVideos) {
        if (!canGenerateVideos) setGenerateError(videoStatusBlockedHint);
        return;
      }
      const seg = segments.find((s) => s.id === segId);
      if (!seg?.backendSegmentId) {
        setGenerateError(SHORT_DRAMA_UI.stepFour.segmentNotSynced);
        return;
      }
      setGenerateError(null);
      try {
        const res = await generateShortDramaSingleSegmentVideo(projectId, seg.backendSegmentId);
        if (!res.ok || !res.render_job_id) {
          setGenerateError(res.error || `片段 ${seg.backendSegmentId} 创建任务失败`);
          return;
        }
        const queuedStatus: Step4VideoStatus = res.status === 'queued' || res.status === 'pending' ? 'queued' : 'running';
        setSegmentStatusOverrides((prev) => ({ ...prev, [segId]: queuedStatus }));
        console.info('[FRONT_RENDER_JOB_CREATED]', {
          project_id: projectId,
          segment_id: seg.backendSegmentId,
          render_job_id: res.render_job_id,
          status: queuedStatus,
        });
        console.info('[FRONT_SEGMENT_STATE_UPDATE]', { segment_ui_id: segId, status: queuedStatus });
        startSegmentJobPolling(segId, res.render_job_id);
        await refreshPipeline();
        console.info('[FRONT_STEP_STATUS_UPDATED]', { project_id: projectId, step: 'step_4', action: 'generate_single_video' });
      } catch (e) {
        const msg = e instanceof ShortDramaApiError ? e.message : SHORT_DRAMA_UI.error.videoSingle;
        setGenerateError(msg);
      }
    },
    [projectId, refreshPipeline, segments, canGenerateVideos, startSegmentJobPolling, videoStatusBlockedHint],
  );

  const handleGenerateVideo = useCallback(
    async (segId: number) => {
      await runSingleGenerate(segId);
    },
    [runSingleGenerate],
  );

  const handleRegenerate = useCallback(
    async (segId: number) => {
      await runSingleGenerate(segId);
    },
    [runSingleGenerate],
  );

  const handleSaveSegmentShot = useCallback(
    async (segId: number, shotId: string, body: Omit<UpdateSegmentShotBody, 'project_id'>) => {
      if (projectId == null) {
        throw new ShortDramaApiError('项目不存在，无法保存片段修改', 400);
      }
      const seg = segments.find((s) => s.id === segId);
      if (!seg?.backendSegmentId) {
        throw new ShortDramaApiError(SHORT_DRAMA_UI.stepFour.segmentNotSynced, 400);
      }
      const res = await updateShortDramaSegmentShot(seg.backendSegmentId, shotId, {
        project_id: projectId,
        ...body,
      });
      setIsDirty(true);
      setSegmentStatusOverrides((prev) => ({ ...prev, [segId]: 'idle' }));
      await refreshPipeline();
      return res;
    },
    [projectId, refreshPipeline, segments],
  );

  const mergeFinalVideo = useCallback(
    async (opts: { buttonType: Step4MergeButtonType; navigateOnSuccess: boolean }) => {
      if (projectId == null) return;
      const { buttonType, navigateOnSuccess } = opts;

      console.info('[STEP4_MERGE_BUTTON_CLICK]', {
        button_type: buttonType,
        project_id: projectId,
        current_status: projectStatus,
        has_final_video: hasFinalVideo,
      });

      if (!canCallMergeApi || mergeLoading) return;

      setMergeError(null);
      setMergeLoading(true);
      try {
        const res = await mergeShortDramaProjectVideo(projectId);
        const refreshed = await refreshPipeline();
        console.info('[FRONT_STEP_STATUS_UPDATED]', { project_id: projectId, step: 'step_4', action: 'merge_final' });
        const finalUrlRaw = refreshed?.final_video_url || res.final_video_url;
        const urlResolved = resolvePublicMediaUrl(finalUrlRaw);
        if (!urlResolved) {
          setMergeError(SHORT_DRAMA_UI.error.mergeNoFinalUrl);
          return;
        }
        window.alert('完整视频已合成');
        console.info('[STEP4_MERGE_SUCCESS]', {
          button_type: buttonType,
          final_video_url: finalUrlRaw,
          navigate_on_success: navigateOnSuccess,
        });
        setPreviewTarget('final');
        if (navigateOnSuccess) {
          const route = withProjectQuery('/short-drama/overview', projectId);
          console.info('[STEP4_NAVIGATE_OVERVIEW]', { project_id: projectId, route, reason: 'post_merge_success' });
          navigate(route);
        }
      } catch (e) {
        if (e instanceof ShortDramaApiError) {
          console.warn('[STEP4_MERGE_ERROR]', { project_id: projectId, status: e.status, message: e.message });
        }
        setMergeError('完整视频合成失败，请稍后重试');
        await refreshPipeline();
      } finally {
        setMergeLoading(false);
      }
    },
    [
      projectId,
      canCallMergeApi,
      mergeLoading,
      refreshPipeline,
      navigate,
    ],
  );

  const goOverview = useCallback(() => {
    if (projectId == null) return;
    const route = withProjectQuery('/short-drama/overview', projectId);
    navigate(route);
  }, [navigate, projectId]);

  const handleAddSegment = useCallback(() => {
    if (pipelineVm.coreSegments.length === 0) return;
    const maxId = segments.length ? Math.max(...segments.map((s) => s.id)) : 0;
    const newId = maxId + 1;
    const colorIndex = segments.length % SEGMENT_COLORS.length;
    const newSegment: Step4SegmentItem = {
      id: newId,
      name: `S${newId} · 新片段`,
      duration: '待定',
      durationLimit: 0,
      goal: '请填写片段目标',
      characters: [],
      scene: '待设定',
      placement: '待设定',
      color: SEGMENT_COLORS[colorIndex],
      isNew: true,
      shots: [],
    };
    setLocalAdditions((prev) => [...prev, newSegment]);
    markDirty();
    setActiveSegment(newId);
    setTimeout(() => {
      document.getElementById(`segment-${newId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  }, [segments, pipelineVm.coreSegments.length, markDirty]);

  const goCreate = useCallback(() => {
    navigate('/short-drama/create');
  }, [navigate]);

  const saveDraft = useCallback(
    async (intent: 'save_draft' | 'before_exit'): Promise<boolean> => {
      if (projectId == null) return false;
      try {
        await touchShortDramaProjectStep(projectId, {
          step: 'step_4',
          save_intent: intent === 'before_exit' ? 'before_exit' : 'save_draft',
        });
        setIsDirty(false);
        return true;
      } catch (e) {
        window.alert(e instanceof Error ? e.message : '保存失败，请稍后重试');
        return false;
      }
    },
    [projectId],
  );

  return {
    projectId,
    navProjectName,
    pipeline,
    pipelineVm,
    phase,
    loadError,
    segmentScriptsError,
    segmentScriptsErrorRaw,
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
    mergeLoading,
    segmentRenderJobs,
    canMergeAll,
    mergeReadyByRequirement,
    canGenerateVideos,
    videoStatusBlockedHint,
    hasBackendSegmentScripts,
    doneCount,
    displayTotal,
    projectStatus,
    effectiveStatus,
    assetLibraryVm,
    stepFourVideoLanguage,
    handleGenerateAll,
    handleGenerateVideo,
    handleRegenerate,
    handleRetryGenerateSegments,
    handleSaveSegmentShot,
    mergeFinalVideo,
    mergePrimaryActionsEnabled,
    canCallMergeApi,
    hasFinalVideo,
    timelineMergeLabel,
    goOverview,
    isMockTestPatternVideo,
    handleAddSegment,
    goCreate,
    isDirty,
    markDirty,
    saveDraft,
  };
}
