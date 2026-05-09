import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminApi } from '../../api/adminApi';
import { AdminDataTable } from '../../components/admin/AdminDataTable';
import { AdminDetailDrawer } from '../../components/admin/AdminDetailDrawer';
import { AdminEmptyState } from '../../components/admin/AdminEmptyState';
import { AdminErrorState } from '../../components/admin/AdminErrorState';
import { AdminFilterBar } from '../../components/admin/AdminFilterBar';
import { AdminLoadingState } from '../../components/admin/AdminLoadingState';
import { AdminMetricCard } from '../../components/admin/AdminMetricCard';
import { AdminStatusBadge } from '../../components/admin/AdminStatusBadge';
import { useAdminLocale } from '../../contexts/AdminLocaleContext';
import { formatAdminStatus, formatBusinessType } from '../../i18n/adminI18n';

export function AdminApiLogsPage() {
  const { locale, t } = useAdminLocale();
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [provider, setProvider] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [logStatus, setLogStatus] = useState('');
  const [userId, setUserId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    p.set('page', String(page));
    p.set('page_size', String(pageSize));
    if (provider) p.set('provider', provider);
    if (businessType) p.set('business_type', businessType);
    if (logStatus) p.set('status', logStatus);
    if (userId.trim() && Number.isFinite(Number(userId))) p.set('user_id', String(Number(userId)));
    if (projectId.trim() && Number.isFinite(Number(projectId))) p.set('project_id', String(Number(projectId)));
    return p.toString();
  }, [page, pageSize, provider, businessType, logStatus, userId, projectId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.apiLogs(query);
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

  useEffect(() => {
    if (detailId == null) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const d = await adminApi.apiLog(detailId);
        if (!cancelled) setDetail(d);
      } catch {
        if (!cancelled) setDetail(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [detailId]);

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const failedOnPage = items.filter((i) => String(i.status) !== 'success').length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <AdminMetricCard label={locale === 'zh' ? '日志总数（筛选）' : 'Total logs (filter)'} value={total} />
        <AdminMetricCard label={locale === 'zh' ? '当前页数量' : 'On this page'} value={items.length} />
        <AdminMetricCard label={locale === 'zh' ? '失败数（当前页）' : 'Non-success (page)'} value={failedOnPage} hint={locale === 'zh' ? '按当前页估算' : 'Approximate from current page'} />
      </div>

      <AdminFilterBar>
        <label className="flex flex-col text-xs text-gray-600">
          {t('provider')}
          <input
            className="mt-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900"
            value={provider}
            onChange={(e) => {
              setPage(1);
              setProvider(e.target.value);
            }}
            placeholder="xAI / Gemini / …"
          />
        </label>
        <label className="flex flex-col text-xs text-gray-600">
          {t('businessType')}
          <input
            className="mt-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900"
            value={businessType}
            onChange={(e) => {
              setPage(1);
              setBusinessType(e.target.value);
            }}
          />
        </label>
        <label className="flex flex-col text-xs text-gray-600">
          {t('status')}
          <input
            className="mt-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900"
            value={logStatus}
            onChange={(e) => {
              setPage(1);
              setLogStatus(e.target.value);
            }}
            placeholder="success / failed / …"
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
        <label className="flex flex-col text-xs text-gray-600">
          Project ID
          <input
            className="mt-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900"
            value={projectId}
            onChange={(e) => {
              setPage(1);
              setProjectId(e.target.value);
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
      {!loading && !error && items.length === 0 ? <AdminEmptyState title={locale === 'zh' ? '暂无 API 日志' : 'No API logs yet'} /> : null}

      {!loading && !error && items.length > 0 ? (
        <>
          <AdminDataTable headers={['ID', t('provider'), t('model'), t('businessType'), t('user'), t('status'), t('duration'), t('estimatedCost'), t('createdAt')]}>
            {items.map((row) => (
              <tr
                key={String(row.api_call_id)}
                className="cursor-pointer hover:bg-gray-50/60"
                onClick={() => setDetailId(Number(row.api_call_id))}
              >
                <td className="px-4 py-3 text-xs">{String(row.api_call_id)}</td>
                <td className="px-4 py-3 text-xs">{String(row.provider)}</td>
                <td className="px-4 py-3 text-xs">{String(row.model || '—')}</td>
                <td className="px-4 py-3 text-xs">{formatBusinessType(locale, row.business_type)}</td>
                <td className="px-4 py-3 text-xs">
                  {(() => {
                    const u = row.user as Record<string, unknown> | undefined;
                    return String(u?.email || u?.user_id || '—');
                  })()}
                </td>
                <td className="px-4 py-3">
                  <AdminStatusBadge status={formatAdminStatus(locale, row.status || 'unknown')} />
                </td>
                <td className="px-4 py-3 text-xs">{row.duration == null ? '—' : String(row.duration)}</td>
                <td className="px-4 py-3 text-xs">{row.estimated_cost == null ? '—' : Number(row.estimated_cost).toFixed(4)}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{String(row.created_at || '')}</td>
              </tr>
            ))}
          </AdminDataTable>
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>
              {locale === 'zh' ? `第 ${page} / ${pages} 页` : `Page ${page} / ${pages}`}
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

      <AdminDetailDrawer open={detailId !== null} title={locale === 'zh' ? 'API 日志详情' : 'API log detail'} onClose={() => setDetailId(null)}>
        {detail ? (
          <div className="space-y-4 text-xs">
            <section>
              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{t('requestSummary')}</h4>
              <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-gray-700">
                {String(detail.request_summary || '—')}
              </pre>
            </section>
            <section>
              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{t('responseSummary')}</h4>
              <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-gray-700">
                {String(detail.response_summary || '—')}
              </pre>
            </section>
            <section>
              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{t('errorDetail')}</h4>
              <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-rose-50 p-3 text-rose-700">
                {JSON.stringify(detail.error_detail, null, 2)}
              </pre>
            </section>
            <section>
              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{locale === 'zh' ? '关联信息' : 'Related'}</h4>
              <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-gray-700">
                {JSON.stringify(
                  {
                    user: detail.related_user,
                    project: detail.related_project,
                    credit_txn: detail.related_credit_transaction,
                    timing: detail.timing,
                    estimated_cost: detail.estimated_cost,
                  },
                  null,
                  2,
                )}
              </pre>
            </section>
          </div>
        ) : (
          <AdminLoadingState label="Loading detail…" />
        )}
      </AdminDetailDrawer>
    </div>
  );
}
