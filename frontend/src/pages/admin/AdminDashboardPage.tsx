import { useCallback, useEffect, useState } from 'react';
import { AdminDashboardResponse, adminApi } from '../../api/adminApi';
import { AdminEmptyState } from '../../components/admin/AdminEmptyState';
import { AdminErrorState } from '../../components/admin/AdminErrorState';
import { AdminLoadingState } from '../../components/admin/AdminLoadingState';
import { AdminMetricCard } from '../../components/admin/AdminMetricCard';
import { AdminDataTable } from '../../components/admin/AdminDataTable';
import { AdminStatusBadge } from '../../components/admin/AdminStatusBadge';
import { useAdminLocale } from '../../contexts/AdminLocaleContext';
import { formatAdminStatus } from '../../i18n/adminI18n';

function MiniBars({
  data,
  valueKey,
  emptyTitle,
  labelKey = 'date',
}: {
  data: Record<string, unknown>[];
  valueKey: string;
  emptyTitle: string;
  labelKey?: string;
}) {
  const nums = data.map((d) => Number(d[valueKey] || 0));
  const max = Math.max(1, ...nums);
  if (!data.length) {
    return <AdminEmptyState title={emptyTitle} />;
  }
  return (
    <div className="flex h-40 items-end gap-2">
      {data.map((row, i) => {
        const v = Number(row[valueKey] || 0);
        const h = `${Math.round((v / max) * 100)}%`;
        return (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex w-full flex-1 items-end justify-center">
              <div
                className="w-full max-w-[28px] rounded-t-lg bg-gradient-to-t from-indigo-600 to-sky-500 opacity-90"
                style={{ height: h }}
                title={`${v}`}
              />
            </div>
            <span className="max-w-full truncate text-[10px] text-gray-500">
              {String(row[labelKey] || '').slice(5)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function AdminDashboardPage() {
  const { locale, t } = useAdminLocale();
  const [data, setData] = useState<AdminDashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await adminApi.dashboard();
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <AdminLoadingState />;
  if (error) return <AdminErrorState message={error} onRetry={load} />;
  if (!data) return <AdminEmptyState title={locale === 'zh' ? '暂无数据' : 'No data'} />;

  const abnormal = data.abnormal_tasks || [];
  const topUsers = data.top_consuming_users || [];
  const providerStats = data.provider_stats || [];
  const userGrowth = data.user_growth_7d || [];
  const pv = data.project_video_generation_7d || [];
  const apiCost = data.api_calls_cost_7d || [];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <AdminMetricCard label={t('totalUsers')} value={data.total_users || 0} />
        <AdminMetricCard label={t('newUsersToday')} value={data.new_users_today || 0} />
        <AdminMetricCard label={t('totalProjects')} value={data.total_projects || 0} />
        <AdminMetricCard label={t('projectsToday')} value={data.projects_today || 0} />
        <AdminMetricCard label={t('assetsGeneratedToday')} value={data.assets_generated_today || 0} />
        <AdminMetricCard label={t('videosGeneratedToday')} value={data.videos_generated_today || 0} />
        <AdminMetricCard label={t('apiCallsToday')} value={data.api_calls_today || 0} />
        <AdminMetricCard label={t('creditsConsumedToday')} value={data.credits_consumed_today || 0} />
        <AdminMetricCard label={t('estimatedCostToday')} value={(data.estimated_cost_today || 0).toFixed(4)} />
        <AdminMetricCard label={t('failedJobsToday')} value={data.failed_jobs_today || 0} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-gray-900">{t('userGrowth')}</h3>
          <div className="mt-4">
            <MiniBars data={userGrowth} valueKey="count" emptyTitle={locale === 'zh' ? '暂无趋势数据' : 'No trend data'} />
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-gray-900">{t('projectVideoGeneration')}</h3>
          <div className="mt-4">
            <MiniBars data={pv} valueKey="projects" emptyTitle={locale === 'zh' ? '暂无趋势数据' : 'No trend data'} />
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-gray-900">{t('apiCallsAndCost')}</h3>
          <div className="mt-4">
            <MiniBars data={apiCost} valueKey="calls" emptyTitle={locale === 'zh' ? '暂无趋势数据' : 'No trend data'} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-gray-900">{t('apiHealth')}</h3>
          {providerStats.length === 0 ? (
            <div className="mt-4">
              <AdminEmptyState title={t('noProviderStats')} description={t('logsPopulate')} />
            </div>
          ) : (
            <AdminDataTable headers={[t('provider'), t('apiCalls'), 'Success %', 'Fail %']}>
              {providerStats.map((p, i) => (
                <tr key={i}>
                  <td className="px-4 py-3 text-sm">{String(p.provider)}</td>
                  <td className="px-4 py-3 text-sm">{String(p.calls)}</td>
                  <td className="px-4 py-3 text-sm">{Math.round(Number(p.success_rate || 0) * 1000) / 10}</td>
                  <td className="px-4 py-3 text-sm">{Math.round(Number(p.failure_rate || 0) * 1000) / 10}</td>
                </tr>
              ))}
            </AdminDataTable>
          )}
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-gray-900">{t('topConsumingUsers')}</h3>
          {topUsers.length === 0 ? (
            <div className="mt-4">
              <AdminEmptyState title={locale === 'zh' ? '今日暂无消耗记录' : 'No consumption recorded today'} />
            </div>
          ) : (
            <AdminDataTable headers={[t('user'), t('credits')]}>
              {topUsers.map((u, i) => (
                <tr key={i}>
                  <td className="px-4 py-3 text-sm">{String(u.email || u.user_id)}</td>
                  <td className="px-4 py-3 text-sm">{String(u.credits_consumed_today)}</td>
                </tr>
              ))}
            </AdminDataTable>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-gray-900">{locale === 'zh' ? '异常任务 / 错误排行' : 'Abnormal Jobs / Error Ranking'}</h3>
        {abnormal.length === 0 ? (
          <div className="mt-4">
            <AdminEmptyState title={locale === 'zh' ? '未发现异常任务' : 'No abnormal tasks detected'} />
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <AdminDataTable headers={['Kind', 'ID', t('projects'), t('status'), t('errorMessage')]}>
              {abnormal.map((r, i) => (
                <tr key={i}>
                  <td className="px-4 py-3 text-xs text-gray-500">{String(r.kind)}</td>
                  <td className="px-4 py-3 text-sm">{String(r.id)}</td>
                  <td className="px-4 py-3 text-sm">{String(r.project_id ?? '—')}</td>
                  <td className="px-4 py-3">
                    <AdminStatusBadge status={formatAdminStatus(locale, r.status || 'unknown')} />
                  </td>
                  <td className="max-w-md truncate px-4 py-3 text-xs text-gray-500">{String(r.message || '')}</td>
                </tr>
              ))}
            </AdminDataTable>
          </div>
        )}
      </div>
    </div>
  );
}
