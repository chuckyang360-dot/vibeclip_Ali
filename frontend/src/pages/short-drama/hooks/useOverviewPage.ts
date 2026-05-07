import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getShortDramaPipeline, mergeShortDramaProjectVideo, ShortDramaApiError } from '@/services/shortDramaApi';
import type { PipelineSummaryDto } from '@/types/shortDramaApi';
import { pipelineToOverviewViewModel, type OverviewPageViewModel } from '../utils/overviewAdapters';
import { pipelineUsesMockTestPatternVideo } from '../utils/stepFourAdapters';
import { SHORT_DRAMA_UI } from '../utils/shortDramaUiCopy';
import { touchProjectNameFromPipeline } from '../utils/shortDramaStorage';
import { workflowNavProjectName } from '../utils/workflowProjectName';
import { getCachedShortDramaPipeline, setCachedShortDramaPipeline } from '../utils/shortDramaPipelineCache';
import { useEffectiveShortDramaProjectId } from './useEffectiveShortDramaProjectId';

export type OverviewPhase = 'idle' | 'no_project' | 'loading' | 'ready' | 'error';

export function useOverviewPage() {
  const navigate = useNavigate();
  const { effectiveProjectId: projectId, projectName } = useEffectiveShortDramaProjectId();

  const [pipeline, setPipeline] = useState<PipelineSummaryDto | null>(null);
  const [phase, setPhase] = useState<OverviewPhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [mergeLoading, setMergeLoading] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (projectId == null) {
      setPhase('no_project');
      setPipeline(null);
      setError(null);
      return;
    }
    const cached = getCachedShortDramaPipeline(projectId);
    if (cached) {
      console.info('[CACHE_PIPELINE_HIT]', { projectId, sourcePage: 'overview' });
      setPipeline(cached);
      setPhase('ready');
    } else {
      console.info('[CACHE_PIPELINE_MISS]', { projectId, sourcePage: 'overview' });
      setPhase('loading');
    }
    setError(null);
    try {
      const startedAt = performance.now();
      const p = await getShortDramaPipeline(projectId);
      setPipeline(p);
      setCachedShortDramaPipeline(projectId, p);
      touchProjectNameFromPipeline(projectId, p.project?.project_name);
      console.info('[CACHE_PIPELINE_REFRESH_SUCCESS]', {
        projectId,
        sourcePage: 'overview',
        durationMs: Math.round(performance.now() - startedAt),
      });
      console.info('[FRONT_PROJECT_DATA_RESTORED]', { project_id: projectId, page: 'overview' });
      setPhase('ready');
    } catch (e) {
      const msg =
        e instanceof ShortDramaApiError ? e.message : SHORT_DRAMA_UI.error.overviewLoad;
      console.warn('[CACHE_PIPELINE_REFRESH_ERROR]', { projectId, sourcePage: 'overview', error: msg });
      if (!cached) {
        setError(msg);
        setPhase('error');
      }
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const viewModel: OverviewPageViewModel = useMemo(() => pipelineToOverviewViewModel(pipeline), [pipeline]);
  const effectiveStatus = String(
    pipeline?.project?.effective_status || pipeline?.project?.suggested_status || pipeline?.project?.status || '',
  ).trim();
  const segmentVideoCount = Number(pipeline?.project?.segment_video_count ?? 0);
  const segmentVideoTotal = Number(pipeline?.project?.segment_video_total ?? 0);
  const hasAllSegmentsByCount =
    Number.isFinite(segmentVideoCount) &&
    Number.isFinite(segmentVideoTotal) &&
    segmentVideoTotal > 0 &&
    segmentVideoCount === segmentVideoTotal;
  const canMergeFinalVideo =
    pipeline?.has_all_segment_videos === true ||
    hasAllSegmentsByCount ||
    effectiveStatus === 'video_segments_ready' ||
    effectiveStatus === 'completed';

  const mergeFinalVideo = useCallback(async () => {
    if (projectId == null || !canMergeFinalVideo || mergeLoading) return;
    setMergeError(null);
    setMergeLoading(true);
    try {
      await mergeShortDramaProjectVideo(projectId);
      const refreshed = await getShortDramaPipeline(projectId);
      setPipeline(refreshed);
      setCachedShortDramaPipeline(projectId, refreshed);
      touchProjectNameFromPipeline(projectId, refreshed.project?.project_name);
      window.alert('完整视频已合成');
    } catch (e) {
      if (e instanceof ShortDramaApiError) {
        console.warn('[OVERVIEW_MERGE_ERROR]', { project_id: projectId, status: e.status, message: e.message });
      }
      setMergeError('完整视频合成失败，请稍后重试');
    } finally {
      setMergeLoading(false);
    }
  }, [canMergeFinalVideo, mergeLoading, projectId]);

  const isMockTestPatternVideo = useMemo(() => pipelineUsesMockTestPatternVideo(pipeline), [pipeline]);

  const headerProjectName = workflowNavProjectName({
    pipelineProjectName: pipeline?.project?.project_name,
    sessionProjectName: projectName,
  });

  const goCreate = useCallback(() => {
    navigate('/short-drama/create');
  }, [navigate]);

  return {
    projectId,
    headerProjectName,
    phase,
    error,
    viewModel,
    pipeline,
    reload: load,
    mergeLoading,
    mergeError,
    canMergeFinalVideo,
    mergeFinalVideo,
    goCreate,
    isMockTestPatternVideo,
  };
}
