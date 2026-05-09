import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../api/adminApi';
import { AdminConfirmModal } from '../../components/admin/AdminConfirmModal';
import { AdminDataTable } from '../../components/admin/AdminDataTable';
import { AdminEmptyState } from '../../components/admin/AdminEmptyState';
import { AdminErrorState } from '../../components/admin/AdminErrorState';
import { AdminFilterBar } from '../../components/admin/AdminFilterBar';
import { AdminLoadingState } from '../../components/admin/AdminLoadingState';
import { AdminStatusBadge } from '../../components/admin/AdminStatusBadge';
import { CreditAdjustmentModal } from '../../components/admin/CreditAdjustmentModal';
import { useAdminLocale } from '../../contexts/AdminLocaleContext';
import { formatAdminStatus } from '../../i18n/adminI18n';

export function AdminUsersPage() {
  const { locale, t } = useAdminLocale();
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('created_at_desc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [grantUserId, setGrantUserId] = useState<number | null>(null);
  const [disableUser, setDisableUser] = useState<{ id: number; email: string } | null>(null);
  const [restoreUser, setRestoreUser] = useState<{ id: number; email: string } | null>(null);
  const [disableReason, setDisableReason] = useState('');
  const [restoreReason, setRestoreReason] = useState('');

  const query = useMemo(() => {
    const p = new URLSearchParams();
    p.set('page', String(page));
    p.set('page_size', String(pageSize));
    if (search.trim()) p.set('search', search.trim());
    if (status) p.set('status', status);
    p.set('sort', sort);
    return p.toString();
  }, [page, pageSize, search, sort, status]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.users(query);
      setItems((res.items as Record<string, unknown>[]) || []);
      setTotal(Number(res.total || 0));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <AdminFilterBar>
        <label className="flex flex-col text-xs text-gray-600">
          {t('search')}
          <input
            className="mt-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            placeholder="Email, name, username"
          />
        </label>
        <label className="flex flex-col text-xs text-gray-600">
          {t('status')}
          <select
            className="mt-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900"
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value);
            }}
          >
            <option value="">{locale === 'zh' ? '全部' : 'All'}</option>
            <option value="normal">{formatAdminStatus(locale, 'normal')}</option>
            <option value="disabled">{formatAdminStatus(locale, 'disabled')}</option>
            <option value="risk">{formatAdminStatus(locale, 'risk')}</option>
          </select>
        </label>
        <label className="flex flex-col text-xs text-gray-600">
          {t('sort')}
          <select
            className="mt-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900"
            value={sort}
            onChange={(e) => {
              setPage(1);
              setSort(e.target.value);
            }}
          >
            <option value="created_at_desc">Newest</option>
            <option value="created_at_asc">Oldest</option>
            <option value="email_asc">Email A–Z</option>
          </select>
        </label>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
        >
          {t('apply')}
        </button>
      </AdminFilterBar>

      {loading ? <AdminLoadingState /> : null}
      {error ? <AdminErrorState message={error} onRetry={load} /> : null}

      {!loading && !error && items.length === 0 ? <AdminEmptyState title={locale === 'zh' ? '没有匹配的用户' : 'No users match filters'} /> : null}

      {!loading && !error && items.length > 0 ? (
        <>
          <AdminDataTable headers={[t('user'), t('status'), t('credits'), locale === 'zh' ? '统计' : 'Counts', locale === 'zh' ? '7日 API' : 'API 7D', t('actions')]}>
            {items.map((row) => {
              const id = Number(row.user_id);
              return (
                <tr key={id}>
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-gray-900">{String(row.email)}</div>
                    <div className="text-xs text-gray-500">@{String(row.username)}</div>
                  </td>
                  <td className="px-4 py-3">
                    <AdminStatusBadge status={formatAdminStatus(locale, row.status || 'normal')} />
                  </td>
                  <td className="px-4 py-3 text-sm">{String(row.credit_balance)}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    P {String(row.projects_count)} / A {String(row.assets_count)} / V {String(row.videos_count)}
                  </td>
                  <td className="px-4 py-3 text-xs">{Number(row.api_cost_7d || 0).toFixed(4)}</td>
                  <td className="space-x-2 px-4 py-3 text-xs">
                    <Link className="text-indigo-600 hover:underline" to={`/admin/users/${id}`}>
                      {t('view')}
                    </Link>
                    <button type="button" className="text-indigo-600 hover:underline" onClick={() => setGrantUserId(id)}>
                      {t('grant')}
                    </button>
                    {String(row.status) === 'disabled' ? (
                      <button
                        type="button"
                        className="text-emerald-300 hover:underline"
                        onClick={() => setRestoreUser({ id, email: String(row.email) })}
                      >
                        {t('restore')}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="text-rose-300 hover:underline"
                        onClick={() => setDisableUser({ id, email: String(row.email) })}
                      >
                        {t('disable')}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </AdminDataTable>
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>
              {locale === 'zh' ? `第 ${page} / ${pages} 页 · ${total} 用户` : `Page ${page} / ${pages} · ${total} users`}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-gray-200 px-3 py-1 disabled:opacity-40"
              >
                {locale === 'zh' ? '上一页' : 'Prev'}
              </button>
              <button
                type="button"
                disabled={page >= pages}
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                className="rounded-lg border border-gray-200 px-3 py-1 disabled:opacity-40"
              >
                {locale === 'zh' ? '下一页' : 'Next'}
              </button>
            </div>
          </div>
        </>
      ) : null}

      <CreditAdjustmentModal
        open={grantUserId !== null}
        mode="grant"
        onClose={() => setGrantUserId(null)}
        onSubmit={async (amount, reason) => {
          if (grantUserId == null) return;
          await adminApi.grantCredits(grantUserId, { amount, reason });
          await load();
        }}
      />

      <AdminConfirmModal
        open={disableUser !== null}
        title={locale === 'zh' ? '禁用用户' : 'Disable user'}
        description={disableUser ? `This will block ${disableUser.email} from signing in.` : undefined}
        confirmLabel={locale === 'zh' ? '确认禁用' : 'Disable account'}
        danger
        onCancel={() => {
          setDisableUser(null);
          setDisableReason('');
        }}
        onConfirm={async () => {
          if (!disableUser || !disableReason.trim()) return;
          await adminApi.disableUser(disableUser.id, { reason: disableReason.trim() });
          setDisableUser(null);
          setDisableReason('');
          await load();
        }}
      >
        <label className="mt-4 block text-xs text-gray-600">
          {locale === 'zh' ? '原因（必填）' : 'Reason (required)'}
          <textarea
            className="mt-1 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900"
            rows={3}
            value={disableReason}
            onChange={(e) => setDisableReason(e.target.value)}
          />
        </label>
      </AdminConfirmModal>

      <AdminConfirmModal
        open={restoreUser !== null}
        title={locale === 'zh' ? '恢复用户' : 'Restore user'}
        description={restoreUser ? `This will allow ${restoreUser.email} to sign in again.` : undefined}
        confirmLabel={locale === 'zh' ? '确认恢复' : 'Restore account'}
        onCancel={() => {
          setRestoreUser(null);
          setRestoreReason('');
        }}
        onConfirm={async () => {
          if (!restoreUser || !restoreReason.trim()) return;
          await adminApi.restoreUser(restoreUser.id, { reason: restoreReason.trim() });
          setRestoreUser(null);
          setRestoreReason('');
          await load();
        }}
      >
        <label className="mt-4 block text-xs text-gray-600">
          {locale === 'zh' ? '原因（必填）' : 'Reason (required)'}
          <textarea
            className="mt-1 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900"
            rows={3}
            value={restoreReason}
            onChange={(e) => setRestoreReason(e.target.value)}
          />
        </label>
      </AdminConfirmModal>
    </div>
  );
}
