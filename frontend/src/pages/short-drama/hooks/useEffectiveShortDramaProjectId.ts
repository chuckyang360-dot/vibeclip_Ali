import { useEffect, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { getShortDramaSession } from '../utils/shortDramaStorage';
import { useShortDramaProject } from './useShortDramaProject';

function parseQueryProjectId(searchParams: URLSearchParams): number | null {
  const q = searchParams.get('projectId') ?? searchParams.get('project_id');
  if (!q?.trim()) return null;
  const n = Number(q);
  if (!Number.isFinite(n)) return null;
  const id = Math.trunc(n);
  return id > 0 ? id : null;
}

/**
 * 优先使用 URL `?projectId=`（写入 session），否则使用 session 中的当前项目。
 * 数据回填请始终拉 pipeline，勿依赖本 hook 作为业务数据真相源。
 */
export function useEffectiveShortDramaProjectId() {
  const [searchParams] = useSearchParams();
  const params = useParams<{ projectId?: string }>();
  const { projectId: sessionProjectId, projectName, setSession, refresh, clearSession, session } =
    useShortDramaProject();

  const paramProjectId = useMemo(() => {
    const raw = params.projectId;
    if (!raw?.trim()) return null;
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    const id = Math.trunc(n);
    return id > 0 ? id : null;
  }, [params.projectId]);

  const queryProjectId = useMemo(() => parseQueryProjectId(searchParams), [searchParams]);
  const routedProjectId = paramProjectId ?? queryProjectId;

  useEffect(() => {
    if (routedProjectId == null) return;
    const existing = getShortDramaSession();
    if (existing?.projectId === routedProjectId) {
      refresh();
      return;
    }
    setSession(routedProjectId);
  }, [routedProjectId, setSession, refresh]);

  const effectiveProjectId = routedProjectId ?? sessionProjectId;

  return {
    effectiveProjectId,
    queryProjectId,
    paramProjectId,
    sessionProjectId,
    projectName,
    setSession,
    refreshSession: refresh,
    clearSession,
    session,
  };
}
