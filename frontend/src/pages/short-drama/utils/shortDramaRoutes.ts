/** 工作流步骤间导航时附带 projectId，避免仅靠 session 丢上下文；页面数据仍以 pipeline API 为准。 */
export function withProjectQuery(path: string, projectId: number | null | undefined): string {
  if (projectId == null || !Number.isFinite(projectId)) return path;
  const id = Math.trunc(projectId);
  if (id <= 0) return path;
  const routeMap: Record<string, string> = {
    '/short-drama/product-input': `/short-drama/projects/${id}/step-1`,
    '/short-drama/story-blueprint': `/short-drama/projects/${id}/step-2`,
    '/short-drama/assets': `/short-drama/projects/${id}/step-3`,
    '/short-drama/step4': `/short-drama/projects/${id}/step-4`,
    '/short-drama/overview': `/short-drama/projects/${id}/overview`,
  };
  const direct = routeMap[path];
  if (direct) return direct;
  if (path.startsWith('/short-drama/projects/')) return path;
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}projectId=${encodeURIComponent(String(id))}`;
}

export function isScriptImportWorkflowLike(source: unknown): boolean {
  const row = source && typeof source === 'object' ? (source as Record<string, unknown>) : {};
  if (row.workflow_mode === 'script_import' || row.script_import) return true;
  const project = row.project && typeof row.project === 'object' ? (row.project as Record<string, unknown>) : {};
  if (project.workflow_mode === 'script_import' || project.script_import) return true;
  const step =
    project.step_status && typeof project.step_status === 'object'
      ? (project.step_status as Record<string, unknown>)
      : row.step_status && typeof row.step_status === 'object'
        ? (row.step_status as Record<string, unknown>)
        : {};
  return step.step_2 === 'skipped' && step.step_3 === 'skipped';
}
