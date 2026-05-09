import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminApi } from '../../api/adminApi';
import { AdminDataTable } from '../../components/admin/AdminDataTable';
import { AdminEmptyState } from '../../components/admin/AdminEmptyState';
import { AdminErrorState } from '../../components/admin/AdminErrorState';
import { AdminFilterBar } from '../../components/admin/AdminFilterBar';
import { AdminLoadingState } from '../../components/admin/AdminLoadingState';

export function AdminOperationLogsPage() {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [operator, setOperator] = useState('');
  const [action, setAction] = useState('');
  const [targetType, setTargetType] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    p.set('page', String(page));
    p.set('page_size', String(pageSize));
    if (operator.trim()) p.set('operator', operator.trim());
    if (action.trim()) p.set('action', action.trim());
    if (targetType.trim()) p.set('target_type', targetType.trim());
    return p.toString();
  }, [page, pageSize, operator, action, targetType]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.operationLogs(query);
      setItems((res.items as Record<string, unknown>[]) || []);
      setTotal(Number(res.total || 0));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load logs');
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
          Operator email
          <input
            className="mt-1 rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
            value={operator}
            onChange={(e) => {
              setPage(1);
              setOperator(e.target.value);
            }}
          />
        </label>
        <label className="flex flex-col text-xs text-zinc-500">
          Action
          <input
            className="mt-1 rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
            value={action}
            onChange={(e) => {
              setPage(1);
              setAction(e.target.value);
            }}
            placeholder="grant_credits / disable_user / …"
          />
        </label>
        <label className="flex flex-col text-xs text-zinc-500">
          Target type
          <input
            className="mt-1 rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
            value={targetType}
            onChange={(e) => {
              setPage(1);
              setTargetType(e.target.value);
            }}
            placeholder="user"
          />
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
      {!loading && !error && items.length === 0 ? <AdminEmptyState title="No admin operations yet" /> : null}

      {!loading && !error && items.length > 0 ? (
        <>
          <AdminDataTable headers={['ID', 'Operator', 'Action', 'Target', 'Reason', 'IP', 'At']}>
            {items.map((row) => (
              <tr key={String(row.log_id)}>
                <td className="px-4 py-3 text-xs">{String(row.log_id)}</td>
                <td className="px-4 py-3 text-xs">{String(row.operator)}</td>
                <td className="px-4 py-3 text-xs">{String(row.action)}</td>
                <td className="px-4 py-3 text-xs text-zinc-400">
                  {String(row.target_type)} #{String(row.target_id)}
                </td>
                <td className="max-w-sm truncate px-4 py-3 text-xs text-zinc-400">{String(row.reason || '')}</td>
                <td className="px-4 py-3 text-xs text-zinc-500">{String(row.ip || '—')}</td>
                <td className="px-4 py-3 text-xs text-zinc-500">{String(row.created_at || '')}</td>
              </tr>
            ))}
          </AdminDataTable>
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>
              Page {page} / {pages} · {total} logs
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
    </div>
  );
}
