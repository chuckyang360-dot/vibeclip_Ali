import { API_BASE_URL } from '../config/api';
import { getToken } from '../services/api';

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  if (!token) {
    throw new Error('Not authenticated');
  }
  const url = `${API_BASE_URL}/api/admin${path}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = await response.json();
      detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail || body);
    } catch {
      /* ignore */
    }
    throw new Error(detail || `Request failed: ${response.status}`);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}

export interface AdminDashboardResponse {
  total_revenue?: string;
  today_revenue?: string;
  total_users: number;
  new_users_today: number;
  total_projects: number;
  projects_today: number;
  assets_generated_today: number;
  videos_generated_today: number;
  api_calls_today: number;
  credits_consumed_today: number;
  estimated_cost_today: number;
  failed_jobs_today: number;
  user_growth_7d: Record<string, unknown>[];
  project_video_generation_7d: Record<string, unknown>[];
  api_calls_cost_7d: Record<string, unknown>[];
  provider_stats: Record<string, unknown>[];
  abnormal_tasks: Record<string, unknown>[];
  top_consuming_users: Record<string, unknown>[];
}

export interface AdminAIModel {
  id: number;
  provider: string;
  model_id: string;
  display_name: string;
  capability: string;
  enabled: boolean;
  sort_order: number;
  config_schema?: Record<string, unknown>;
  default_config?: Record<string, unknown>;
  metadata_json?: Record<string, unknown>;
}

export interface AdminAIPrompt {
  id: number;
  stage_key: string;
  name: string;
  version: number;
  status: string;
  system_prompt?: string;
  user_prompt_template?: string;
  variables_schema?: Record<string, unknown>;
  metadata_json?: Record<string, unknown>;
}

export interface AdminAIStageConfig {
  stage_key: string;
  stage_name: string;
  enabled: boolean;
  capability: string;
  active_model: AdminAIModel | null;
  fallback_model: AdminAIModel | null;
  active_prompt: AdminAIPrompt | null;
  candidate_models: AdminAIModel[];
  prompt_versions: AdminAIPrompt[];
  config_json?: Record<string, unknown>;
}

export interface AdminAIConfigsResponse {
  items: AdminAIStageConfig[];
  models: AdminAIModel[];
}

export interface AdminAIModelCreateBody {
  provider: string;
  model_id: string;
  display_name: string;
  capability: string;
  enabled?: boolean;
  sort_order?: number;
  config_schema?: Record<string, unknown>;
  default_config?: Record<string, unknown>;
  metadata_json?: Record<string, unknown>;
}

export interface AdminAIPromptBody {
  name: string;
  system_prompt: string;
  user_prompt_template?: string;
  variables_schema?: Record<string, unknown>;
  metadata_json?: Record<string, unknown>;
  reason: string;
}

export const adminApi = {
  dashboard: () => adminFetch<AdminDashboardResponse>('/dashboard'),
  users: (q: string) => adminFetch<Record<string, unknown>>(`/users?${q}`),
  user: (id: string | number) => adminFetch<Record<string, unknown>>(`/users/${id}`),
  grantCredits: (id: string | number, body: { amount: number; reason: string }) =>
    adminFetch<{ credit_balance: number }>(`/users/${id}/credits/grant`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  deductCredits: (id: string | number, body: { amount: number; reason: string }) =>
    adminFetch<{ credit_balance: number }>(`/users/${id}/credits/deduct`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  disableUser: (id: string | number, body: { reason: string }) =>
    adminFetch<{ success: boolean }>(`/users/${id}/disable`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  restoreUser: (id: string | number, body: { reason: string }) =>
    adminFetch<{ success: boolean }>(`/users/${id}/restore`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  projects: (q: string) => adminFetch<Record<string, unknown>>(`/projects?${q}`),
  project: (id: string | number) => adminFetch<Record<string, unknown>>(`/projects/${id}`),
  apiLogs: (q: string) => adminFetch<Record<string, unknown>>(`/api-logs?${q}`),
  apiLog: (id: string | number) => adminFetch<Record<string, unknown>>(`/api-logs/${id}`),
  creditAccounts: (q: string) => adminFetch<Record<string, unknown>>(`/credits/accounts?${q}`),
  creditTransactions: (q: string) => adminFetch<Record<string, unknown>>(`/credits/transactions?${q}`),
  operationLogs: (q: string) => adminFetch<Record<string, unknown>>(`/operation-logs?${q}`),
  settings: () => adminFetch<Record<string, unknown>>('/settings'),
  aiConfigs: () => adminFetch<AdminAIConfigsResponse>('/ai-models/configs'),
  createAiModel: (body: AdminAIModelCreateBody) =>
    adminFetch<{ success: boolean; model: AdminAIModel }>('/ai-models/catalog', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateAiStageModel: (stageKey: string, body: { model_catalog_id: number; fallback_model_catalog_id?: number; reason: string }) =>
    adminFetch<{ success: boolean; config: AdminAIStageConfig }>(`/ai-models/configs/${encodeURIComponent(stageKey)}/model`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  publishAiPrompt: (stageKey: string, body: AdminAIPromptBody) =>
    adminFetch<{ success: boolean; config: AdminAIStageConfig }>(`/ai-models/configs/${encodeURIComponent(stageKey)}/prompts/publish`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  activateAiPrompt: (stageKey: string, body: { prompt_template_id: number; reason: string }) =>
    adminFetch<{ success: boolean; config: AdminAIStageConfig }>(`/ai-models/configs/${encodeURIComponent(stageKey)}/prompts/active`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
};
