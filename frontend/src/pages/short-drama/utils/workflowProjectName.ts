import { SHORT_DRAMA_UI } from './shortDramaUiCopy';

export type WorkflowNavNameInput = {
  /** GET /pipeline 中 project.project_name */
  pipelineProjectName?: string | null;
  /** sessionStorage gp_short_drama_session */
  sessionProjectName?: string | null;
  /** GET /project/:id 的 project_name（未拉 pipeline 时） */
  fetchedProjectName?: string | null;
};

/**
 * 工作流顶栏项目名：pipeline / 单项目接口 > session > 演示 fallback。
 */
export function workflowNavProjectName(i: WorkflowNavNameInput): string {
  const fromPipeline = i.pipelineProjectName?.trim();
  if (fromPipeline) return fromPipeline;
  const fromFetch = i.fetchedProjectName?.trim();
  if (fromFetch) return fromFetch;
  const fromSession = i.sessionProjectName?.trim();
  if (fromSession) return fromSession;
  return SHORT_DRAMA_UI.fallbackProjectName;
}
