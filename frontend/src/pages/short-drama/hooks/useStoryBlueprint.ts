import { useCallback, useEffect, useState } from 'react';
import type { PipelineSummaryDto } from '@/types/shortDramaApi';
import { generateShortDramaStory, getShortDramaPipeline, ShortDramaApiError } from '@/services/shortDramaApi';
import { SHORT_DRAMA_UI } from '../utils/shortDramaUiCopy';
import { STORY_PIPELINE_LOCKED_STATUSES } from '../utils/storyBlueprintDerived';
import { touchProjectNameFromPipeline } from '../utils/shortDramaStorage';
import { getCachedShortDramaPipeline, setCachedShortDramaPipeline } from '../utils/shortDramaPipelineCache';

export function useStoryBlueprint(projectId: number | null) {
  const [pipeline, setPipeline] = useState<PipelineSummaryDto | null>(null);
  const [pipelineLoading, setPipelineLoading] = useState(false);
  const [pipelineError, setPipelineError] = useState<string | null>(null);
  const [generateLoading, setGenerateLoading] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const loadPipeline = useCallback(async (opts?: { silent?: boolean }) => {
    if (projectId == null) return;
    const silent = opts?.silent === true;
    if (!silent) {
      setPipelineLoading(true);
      setPipelineError(null);
    }
    try {
      const startedAt = performance.now();
      const p = await getShortDramaPipeline(projectId);
      setPipeline(p);
      setCachedShortDramaPipeline(projectId, p);
      touchProjectNameFromPipeline(projectId, p.project?.project_name);
      console.info('[CACHE_PIPELINE_REFRESH_SUCCESS]', {
        projectId,
        sourcePage: 'step2',
        durationMs: Math.round(performance.now() - startedAt),
      });
      console.info('[FRONT_PROJECT_DATA_RESTORED]', { project_id: projectId, page: 'step_2' });
    } catch (e) {
      const msg =
        e instanceof ShortDramaApiError ? e.message : e instanceof Error ? e.message : SHORT_DRAMA_UI.error.pipelineLoad;
      console.warn('[CACHE_PIPELINE_REFRESH_ERROR]', {
        projectId,
        sourcePage: 'step2',
        error: msg,
      });
      if (!silent) setPipelineError(msg);
    } finally {
      if (!silent) setPipelineLoading(false);
    }
  }, [projectId]);

  const generate = useCallback(async () => {
    if (projectId == null) return;
    const st = pipeline?.project?.status;
    if (st && STORY_PIPELINE_LOCKED_STATUSES.has(st)) return;
    setGenerateLoading(true);
    setGenerateError(null);
    try {
      await generateShortDramaStory(projectId);
      console.info('[FRONT_STEP_STATUS_UPDATED]', { project_id: projectId, step: 'step_2', action: 'save_generate_story' });
      await loadPipeline();
    } catch (e) {
      const msg =
        e instanceof ShortDramaApiError ? e.message : e instanceof Error ? e.message : SHORT_DRAMA_UI.error.storyGenerate;
      setGenerateError(msg);
    } finally {
      setGenerateLoading(false);
    }
  }, [projectId, pipeline, loadPipeline]);

  useEffect(() => {
    if (projectId == null) return;
    const cached = getCachedShortDramaPipeline(projectId);
    if (cached) {
      console.info('[CACHE_PIPELINE_HIT]', { projectId, sourcePage: 'step2' });
      setPipeline(cached);
      setPipelineLoading(false);
      void loadPipeline({ silent: true });
      return;
    }
    console.info('[CACHE_PIPELINE_MISS]', { projectId, sourcePage: 'step2' });
    void loadPipeline();
  }, [projectId, loadPipeline]);

  return {
    pipeline,
    pipelineLoading,
    pipelineError,
    generate,
    generateLoading,
    generateError,
    loadPipeline,
  };
}
