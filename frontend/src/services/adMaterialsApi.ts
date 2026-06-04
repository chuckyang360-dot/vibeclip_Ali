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
    // fall through
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

export type AdMaterialTemplate = {
  id: string;
  name: string;
  category: string;
  description: string;
  industry_tags: string[];
  theme_categories?: string[];
  supported_ratios: string[];
  default_ratio: string;
  default_duration: number;
  default_resolution: string;
  default_generate_audio: boolean;
  preview_video_url?: string;
  cover_url?: string;
  slots: Array<Record<string, unknown>>;
};

export type AdMaterialUpload = {
  url: string;
  storage_key: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  asset_type: 'image' | 'video' | 'audio' | 'avatar';
};

export type AdMaterialInputAsset = {
  type: 'image' | 'video' | 'audio' | 'avatar';
  url: string;
  role: 'reference_image' | 'reference_video' | 'reference_audio' | 'first_frame' | 'last_frame';
  label?: string;
};

export type CreateAdMaterialTaskBody = {
  mode: 'template' | 'product_video' | 'video_edit';
  template_id?: string;
  title?: string;
  prompt_text?: string;
  product_name?: string;
  selling_points?: string;
  channel?: string;
  style?: string;
  edit_instruction?: string;
  assets: AdMaterialInputAsset[];
  ratio: string;
  resolution: string;
  duration: number;
  generate_audio: boolean;
  watermark: boolean;
  return_last_frame?: boolean;
  model?: string;
};

export type AdMaterialTask = {
  id: number;
  template_id: string;
  mode: string;
  title: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'expired' | string;
  error_message: string;
  provider_task_id: string;
  provider_video_url: string;
  video_url: string;
  last_frame_url: string;
  prompt: string;
  input_assets: Array<Record<string, unknown>>;
  parameters: Record<string, unknown>;
  model: string;
  ratio: string;
  resolution: string;
  duration: number;
  generate_audio: boolean;
  watermark: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

export async function listAdMaterialTemplates(): Promise<AdMaterialTemplate[]> {
  const data = await fetchJson<{ templates: AdMaterialTemplate[] }>('/api/ad-materials/templates');
  return data.templates;
}

export async function uploadAdMaterialAsset(file: File): Promise<AdMaterialUpload> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(joinUrl('/api/ad-materials/uploads'), {
    method: 'POST',
    headers: authHeaders(),
    body: form,
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<AdMaterialUpload>;
}

export async function createAdMaterialTask(body: CreateAdMaterialTaskBody): Promise<AdMaterialTask> {
  return fetchJson<AdMaterialTask>('/api/ad-materials/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function getAdMaterialTask(taskId: number): Promise<AdMaterialTask> {
  return fetchJson<AdMaterialTask>(`/api/ad-materials/tasks/${taskId}`);
}

export async function listAdMaterialTasks(): Promise<AdMaterialTask[]> {
  const data = await fetchJson<{ tasks: AdMaterialTask[] }>('/api/ad-materials/tasks');
  return data.tasks;
}
