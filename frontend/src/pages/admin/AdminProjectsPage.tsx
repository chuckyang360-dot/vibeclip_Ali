import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../api/adminApi';
import { AdminDataTable } from '../../components/admin/AdminDataTable';
import { AdminEmptyState } from '../../components/admin/AdminEmptyState';
import { AdminErrorState } from '../../components/admin/AdminErrorState';
import { AdminFilterBar } from '../../components/admin/AdminFilterBar';
import { AdminLoadingState } from '../../components/admin/AdminLoadingState';
import { AdminStatusBadge } from '../../components/admin/AdminStatusBadge';
import { useAdminLocale } from '../../contexts/AdminLocaleContext';
import { formatAdminStatus } from '../../i18n/adminI18n';

export function AdminProjectsPage() {
  const { locale, t } = useAdminLocale();
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [projStatus, setProjStatus] = useState('');
  const [currentStep, setCurrentStep] = useState('');
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    p.set('page', String(page));
    p.set('page_size', String(pageSize));
    if (search.trim()) p.set('search', search.trim());
    if (projStatus) p.set('status', projStatus);
    if (currentStep) p.set('current_step', currentStep);
    if (userId.trim() && Number.isFinite(Number(userId))) p.set('user_id', String(Number(userId)));
    return p.toString();
  }, [page, pageSize, search, projStatus, currentStep, userId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.projects(query);
      setItems((res.items as Record<string, unknown>[]) || []);
      setTotal(Number(res.total || 0));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load projects');
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
          {locale === 'zh' ? '项目名称搜索' : 'Search name'}
          <input
            className="mt-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
        </label>
        <label className="flex flex-col text-xs text-gray-600">
          {t('status')}
          <input
            className="mt-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900"
            value={projStatus}
            onChange={(e) => {
              setPage(1);
              setProjStatus(e.target.value);
            }}
            placeholder="e.g. completed"
          />
        </label>
        <label className="flex flex-col text-xs text-gray-600">
          {t('currentStep')}
          <input
            className="mt-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900"
            value={currentStep}
            onChange={(e) => {
              setPage(1);
              setCurrentStep(e.target.value);
            }}
            placeholder="e.g. step_3"
          />
        </label>
        <label className="flex flex-col text-xs text-gray-600">
          User ID
          <input
            className="mt-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900"
            value={userId}
            onChange={(e) => {
              setPage(1);
              setUserId(e.target.value);
            }}
          />
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
      {!loading && !error && items.length === 0 ? <AdminEmptyState title={locale === 'zh' ? '暂无项目' : 'No projects'} /> : null}

      {!loading && !error && items.length > 0 ? (
        <>
          <AdminDataTable
            headers={[t('projectName'), t('user'), t('currentStep'), t('status'), locale === 'zh' ? '统计' : 'Counts', t('credits'), 'API', t('updatedAt'), '']}
          >
            {items.map((row) => {
              const pid = Number(row.project_id);
              const u = row.user as Record<string, unknown> | undefined;
              return (
                <tr key={pid}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{String(row.project_name)}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{String(u?.email || u?.user_id || '')}</td>
                  <td className="px-4 py-3 text-xs">{String(row.current_step || '—')}</td>
                  <td className="px-4 py-3">
                    <AdminStatusBadge status={formatAdminStatus(locale, row.status || 'unknown')} />
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    A {String(row.assets_count)} / V {String(row.videos_count)}
                  </td>
                  <td className="px-4 py-3 text-xs">{String(row.credits_used)}</td>
                  <td className="px-4 py-3 text-xs">{String(row.api_calls)}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{String(row.updated_at || '')}</td>
                  <td className="px-4 py-3 text-xs">
                    <Link className="text-indigo-600 hover:underline" to={`/admin/projects/${pid}`}>
                      {t('view')}
                    </Link>
                  </td>
                </tr>
              );
            })}
          </AdminDataTable>
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>
              {locale === 'zh' ? `第 ${page} / ${pages} 页 · ${total} 项目` : `Page ${page} / ${pages} · ${total} projects`}
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
    </div>
  );
}
