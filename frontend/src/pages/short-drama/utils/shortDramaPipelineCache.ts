import type { PipelineSummaryDto } from '@/types/shortDramaApi';

const pipelineCache = new Map<number, PipelineSummaryDto>();

function mergeLightweightPipeline(prev: PipelineSummaryDto, next: PipelineSummaryDto): PipelineSummaryDto {
  if (!next.lightweight) return next;
  return {
    ...prev,
    ...next,
    project: {
      ...prev.project,
      ...next.project,
    },
    // Keep heavyweight data from last full pipeline.
    assets: prev.assets,
    segment_scripts: prev.segment_scripts,
    product_context: prev.product_context,
    story_blueprint: prev.story_blueprint,
  };
}

export function getCachedShortDramaPipeline(projectId: number): PipelineSummaryDto | null {
  return pipelineCache.get(projectId) ?? null;
}

export function setCachedShortDramaPipeline(projectId: number, pipeline: PipelineSummaryDto): void {
  const prev = pipelineCache.get(projectId);
  if (pipeline.lightweight && prev) {
    pipelineCache.set(projectId, mergeLightweightPipeline(prev, pipeline));
    return;
  }
  pipelineCache.set(projectId, pipeline);
}

export function mergeCachedShortDramaPipeline(
  projectId: number,
  patch: Partial<PipelineSummaryDto>,
): PipelineSummaryDto | null {
  const prev = pipelineCache.get(projectId);
  if (!prev) return null;
  const next = {
    ...prev,
    ...patch,
    project: patch.project ? { ...prev.project, ...patch.project } : prev.project,
    assets: prev.assets,
    segment_scripts: prev.segment_scripts,
    product_context: prev.product_context,
    story_blueprint: prev.story_blueprint,
  };
  pipelineCache.set(projectId, next);
  return next;
}

export function clearCachedShortDramaPipeline(projectId?: number): void {
  if (typeof projectId === 'number') {
    pipelineCache.delete(projectId);
    return;
  }
  pipelineCache.clear();
}

