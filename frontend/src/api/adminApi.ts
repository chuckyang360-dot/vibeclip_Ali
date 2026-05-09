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

export const adminApi = {
  dashboard: () => adminFetch<Record<string, unknown>>('/dashboard'),
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
