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
};
