import { useCallback, useState } from 'react';
import {
  clearCurrentShortDramaProjectId,
  getShortDramaSession,
  setCurrentShortDramaProjectId,
} from '../utils/shortDramaStorage';

/**
 * 读取 / 更新 sessionStorage 中的当前短剧 project（id + 可选名称）。
 */
export function useShortDramaProject() {
  const [session, setSessionState] = useState(() => getShortDramaSession());

  const refresh = useCallback(() => {
    setSessionState(getShortDramaSession());
  }, []);

  const setSession = useCallback(
    (projectId: number, projectName?: string) => {
      setCurrentShortDramaProjectId(projectId, projectName);
      refresh();
    },
    [refresh],
  );

  const clearSession = useCallback(() => {
    clearCurrentShortDramaProjectId();
    refresh();
  }, [refresh]);

  return {
    projectId: session?.projectId ?? null,
    projectName: session?.projectName ?? null,
    session,
    refresh,
    setSession,
    clearSession,
  };
}
