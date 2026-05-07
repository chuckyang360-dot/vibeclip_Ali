const STORAGE_KEY = 'gp_short_drama_session';

export type ShortDramaSession = {
  projectId: number;
  /** Breadcrumb / nav label; optional fallback to API fetch */
  projectName?: string;
};

function readRaw(): ShortDramaSession | null {
  try {
    const s = sessionStorage.getItem(STORAGE_KEY);
    if (!s) return null;
    const o = JSON.parse(s) as unknown;
    if (!o || typeof o !== 'object') return null;
    const id = (o as { projectId?: unknown }).projectId;
    if (typeof id !== 'number' || !Number.isFinite(id)) return null;
    const name = (o as { projectName?: unknown }).projectName;
    return {
      projectId: id,
      projectName: typeof name === 'string' ? name : undefined,
    };
  } catch {
    return null;
  }
}

export function getCurrentShortDramaProjectId(): number | null {
  return readRaw()?.projectId ?? null;
}

export function getShortDramaSession(): ShortDramaSession | null {
  return readRaw();
}

export function setCurrentShortDramaProjectId(projectId: number, projectName?: string): void {
  const payload: ShortDramaSession = { projectId, projectName };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function clearCurrentShortDramaProjectId(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}

/** pipeline 拉取成功后，用最新 project_name 回写 session（不改变 projectId） */
export function touchProjectNameFromPipeline(projectId: number, projectName: string | null | undefined): void {
  const n = projectName?.trim();
  if (!n) return;
  const s = readRaw();
  if (s?.projectId !== projectId) return;
  setCurrentShortDramaProjectId(projectId, n);
}
