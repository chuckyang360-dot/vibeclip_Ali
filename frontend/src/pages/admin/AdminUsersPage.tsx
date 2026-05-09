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

export function AdminUsersPage() {
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
        <label className="flex flex-col text-xs text-zinc-500">
          Search
          <input
            className="mt-1 rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            placeholder="Email, name, username"
          />
        </label>
        <label className="flex flex-col text-xs text-zinc-500">
          Status
          <select
            className="mt-1 rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value);
            }}
          >
            <option value="">All</option>
            <option value="normal">normal</option>
            <option value="disabled">disabled</option>
            <option value="risk">risk</option>
          </select>
        </label>
        <label className="flex flex-col text-xs text-zinc-500">
          Sort
          <select
            className="mt-1 rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
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
          className="rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-500"
        >
          Apply
        </button>
      </AdminFilterBar>

      {loading ? <AdminLoadingState /> : null}
      {error ? <AdminErrorState message={error} onRetry={load} /> : null}

      {!loading && !error && items.length === 0 ? <AdminEmptyState title="No users match filters" /> : null}

      {!loading && !error && items.length > 0 ? (
        <>
          <AdminDataTable headers={['User', 'Status', 'Credits', 'Counts', 'API 7d', 'Actions']}>
            {items.map((row) => {
              const id = Number(row.user_id);
              return (
                <tr key={id}>
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-white">{String(row.email)}</div>
                    <div className="text-xs text-zinc-500">@{String(row.username)}</div>
                  </td>
                  <td className="px-4 py-3">
                    <AdminStatusBadge status={String(row.status || 'normal')} />
                  </td>
                  <td className="px-4 py-3 text-sm">{String(row.credit_balance)}</td>
                  <td className="px-4 py-3 text-xs text-zinc-400">
                    P {String(row.projects_count)} / A {String(row.assets_count)} / V {String(row.videos_count)}
                  </td>
                  <td className="px-4 py-3 text-xs">{Number(row.api_cost_7d || 0).toFixed(4)}</td>
                  <td className="space-x-2 px-4 py-3 text-xs">
                    <Link className="text-violet-400 hover:underline" to={`/admin/users/${id}`}>
                      View
                    </Link>
                    <button type="button" className="text-violet-300 hover:underline" onClick={() => setGrantUserId(id)}>
                      Grant
                    </button>
                    {String(row.status) === 'disabled' ? (
                      <button
                        type="button"
                        className="text-emerald-300 hover:underline"
                        onClick={() => setRestoreUser({ id, email: String(row.email) })}
                      >
                        Restore
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="text-rose-300 hover:underline"
                        onClick={() => setDisableUser({ id, email: String(row.email) })}
                      >
                        Disable
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </AdminDataTable>
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>
              Page {page} / {pages} · {total} users
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-white/10 px-3 py-1 disabled:opacity-40"
              >
                Prev
              </button>
              <button
                type="button"
                disabled={page >= pages}
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                className="rounded-lg border border-white/10 px-3 py-1 disabled:opacity-40"
              >
                Next
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
        title="Disable user"
        description={disableUser ? `This will block ${disableUser.email} from signing in.` : undefined}
        confirmLabel="Disable account"
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
        <label className="mt-4 block text-xs text-zinc-500">
          Reason (required)
          <textarea
            className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
            rows={3}
            value={disableReason}
            onChange={(e) => setDisableReason(e.target.value)}
          />
        </label>
      </AdminConfirmModal>

      <AdminConfirmModal
        open={restoreUser !== null}
        title="Restore user"
        description={restoreUser ? `This will allow ${restoreUser.email} to sign in again.` : undefined}
        confirmLabel="Restore account"
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
        <label className="mt-4 block text-xs text-zinc-500">
          Reason (required)
          <textarea
            className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
            rows={3}
            value={restoreReason}
            onChange={(e) => setRestoreReason(e.target.value)}
          />
        </label>
      </AdminConfirmModal>
    </div>
  );
}
