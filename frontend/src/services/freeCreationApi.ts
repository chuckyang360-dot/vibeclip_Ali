import { API_BASE_URL } from '../config/api';
import { getToken } from './api';

function joinUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}

function authHeaders(): HeadersInit {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function parseError(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const json = JSON.parse(text) as { detail?: unknown };
    if (typeof json.detail === 'string') return json.detail;
    if (json.detail) return JSON.stringify(json.detail);
  } catch {
    // keep raw text
  }
  return text || res.statusText || `HTTP ${res.status}`;
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(joinUrl(path), {
    ...init,
    headers: {
      ...authHeaders(),
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<T>;
}

export type FreeCreationAssetType = 'image' | 'video' | 'audio' | 'avatar';

export type FreeCreationInputAsset = {
  type: FreeCreationAssetType;
  url: string;
  preview_url?: string;
  storage_key?: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
  role?: string;
  label?: string;
};

export type FreeCreationAsset = FreeCreationInputAsset & {
  id: number;
  project_id: number;
  created_at?: string | null;
};

export type FreeCreationUpload = {
  id: number;
  project_id: number;
  url: string;
  preview_url: string;
  storage_key: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  asset_type: FreeCreationAssetType;
  role: string;
  label: string;
};

export type FreeCreationSegment = {
  id: number;
  project_id: number;
  segment_index: number;
  title: string;
  prompt: string;
  model: string;
  ratio: string;
  resolution: string;
  duration: number;
  generate_audio: boolean;
  watermark: boolean;
  input_assets: FreeCreationInputAsset[];
  status: 'idle' | 'queued' | 'running' | 'completed' | 'failed' | string;
  error_message: string;
  provider_task_id: string;
  video_url: string;
  video_preview_url?: string;
  last_frame_url: string;
  last_frame_preview_url?: string;
  created_at?: string | null;
  updated_at?: string | null;
};

export type FreeCreationProject = {
  id: number;
  user_id: number;
  project_name: string;
  status: string;
  final_video_url: string;
  final_video_preview_url?: string;
  final_render_status: string;
  final_render_error: string;
  settings: Record<string, unknown>;
  assets: FreeCreationAsset[];
  segments: FreeCreationSegment[];
  created_at?: string | null;
  updated_at?: string | null;
};

export type FreeCreationRenderJob = {
  id: number;
  project_id: number;
  segment_id: number | null;
  target_type: 'segment' | 'final' | string;
  status: string;
  progress: number;
  provider_task_id: string;
  output_url: string;
  error_message: string;
};

export type CreateFreeCreationProjectBody = {
  title?: string;
  prompt: string;
  assets?: FreeCreationInputAsset[];
  template_id?: string;
  template_preview_video_url?: string;
  model?: string;
  ratio?: string;
  resolution?: string;
  duration?: number;
  generate_audio?: boolean;
  watermark?: boolean;
};

export type UpsertFreeCreationSegmentBody = {
  title?: string;
  prompt?: string;
  assets?: FreeCreationInputAsset[];
  model?: string;
  ratio?: string;
  resolution?: string;
  duration?: number;
  generate_audio?: boolean;
  watermark?: boolean;
};

export async function createFreeCreationProject(body: CreateFreeCreationProjectBody): Promise<FreeCreationProject> {
  return fetchJson<FreeCreationProject>('/api/free-creation/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function getFreeCreationProject(projectId: number): Promise<FreeCreationProject> {
  return fetchJson<FreeCreationProject>(`/api/free-creation/projects/${projectId}`);
}

export async function listFreeCreationProjects(): Promise<FreeCreationProject[]> {
  return fetchJson<FreeCreationProject[]>('/api/free-creation/projects');
}

export async function uploadFreeCreationAsset(projectId: number, file: File): Promise<FreeCreationUpload> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(joinUrl(`/api/free-creation/projects/${projectId}/uploads`), {
    method: 'POST',
    headers: authHeaders(),
    body: form,
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<FreeCreationUpload>;
}

export async function createFreeCreationSegment(projectId: number, body: UpsertFreeCreationSegmentBody): Promise<FreeCreationSegment> {
  return fetchJson<FreeCreationSegment>(`/api/free-creation/projects/${projectId}/segments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function updateFreeCreationSegment(segmentId: number, body: UpsertFreeCreationSegmentBody): Promise<FreeCreationSegment> {
  return fetchJson<FreeCreationSegment>(`/api/free-creation/segments/${segmentId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function generateFreeCreationSegment(segmentId: number): Promise<{ project_id: number; segment_id: number; render_job_id: number; status: string; ok: boolean }> {
  return fetchJson(`/api/free-creation/segments/${segmentId}/generate`, { method: 'POST' });
}

export async function cancelFreeCreationSegment(segmentId: number): Promise<FreeCreationSegment> {
  return fetchJson<FreeCreationSegment>(`/api/free-creation/segments/${segmentId}/cancel`, { method: 'POST' });
}

export async function getFreeCreationRenderJob(jobId: number): Promise<FreeCreationRenderJob> {
  return fetchJson<FreeCreationRenderJob>(`/api/free-creation/render-jobs/${jobId}`);
}

export async function mergeFreeCreationProject(projectId: number): Promise<{ project_id: number; render_job_id: number; status: string; final_video_url?: string | null }> {
  return fetchJson(`/api/free-creation/projects/${projectId}/merge`, { method: 'POST' });
}
