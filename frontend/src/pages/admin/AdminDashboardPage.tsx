import { useCallback, useEffect, useState } from 'react';
import { AdminDashboardResponse, adminApi } from '../../api/adminApi';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AdminEmptyState } from '../../components/admin/AdminEmptyState';
import { AdminErrorState } from '../../components/admin/AdminErrorState';
import { AdminLoadingState } from '../../components/admin/AdminLoadingState';
import { AdminMetricCard } from '../../components/admin/AdminMetricCard';
import { AdminDataTable } from '../../components/admin/AdminDataTable';
import { AdminStatusBadge } from '../../components/admin/AdminStatusBadge';
import { useAdminLocale } from '../../contexts/AdminLocaleContext';
import { formatAdminStatus } from '../../i18n/adminI18n';

function ChartEmpty({ title }: { title: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 rounded-lg bg-gray-50">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white">
        <i className="ri-line-chart-line text-lg text-gray-400" />
      </div>
      <p className="text-xs font-medium text-gray-600">{title}</p>
    </div>
  );
}

function hasAnyPositive(data: Record<string, unknown>[], keys: string[]) {
  return data.some((row) => keys.some((key) => Number(row[key] || 0) > 0));
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

  const formatCny = (raw: string | number | undefined) => {
    if (raw == null) return '¥0.00';
    if (typeof raw === 'number') {
      return Number.isFinite(raw) ? `¥${raw.toFixed(2)}` : '¥0.00';
    }
    const n = Number(String(raw).trim().replace(/[¥,\s]/g, ''));
    if (!Number.isFinite(n)) return '¥0.00';
    return `¥${n.toFixed(2)}`;
  };

  const abnormal = data.abnormal_tasks || [];
  const topUsers = data.top_consuming_users || [];
  const providerStats = data.provider_stats || [];
  const userGrowth = data.user_growth_7d || [];
  const pv = data.project_video_generation_7d || [];
  const apiCost = data.api_calls_cost_7d || [];
  const canRenderUserGrowth = userGrowth.length > 0 && hasAnyPositive(userGrowth, ['count', 'value']);
  const canRenderPv = pv.length > 0 && hasAnyPositive(pv, ['projects', 'videos', 'value', 'value2']);
  const canRenderApiCost = apiCost.length > 0 && hasAnyPositive(apiCost, ['calls', 'cost_usd', 'value', 'value2']);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <AdminMetricCard label={t('totalRevenue')} value={formatCny(data.total_revenue ?? '0')} icon="ri-wallet-3-line" />
        <AdminMetricCard label={t('todayRevenue')} value={formatCny(data.today_revenue ?? '0')} icon="ri-money-cny-circle-line" />
        <AdminMetricCard label={t('totalUsers')} value={data.total_users || 0} icon="ri-user-3-line" />
        <AdminMetricCard label={t('newUsersToday')} value={data.new_users_today || 0} icon="ri-user-add-line" />
        <AdminMetricCard label={t('totalProjects')} value={data.total_projects || 0} icon="ri-folder-line" />
        <AdminMetricCard label={t('projectsToday')} value={data.projects_today || 0} icon="ri-folder-add-line" />
        <AdminMetricCard label={t('assetsGeneratedToday')} value={data.assets_generated_today || 0} icon="ri-image-line" />
        <AdminMetricCard label={t('videosGeneratedToday')} value={data.videos_generated_today || 0} icon="ri-video-line" />
        <AdminMetricCard label={t('apiCallsToday')} value={data.api_calls_today || 0} icon="ri-server-line" />
        <AdminMetricCard label={t('creditsConsumedToday')} value={data.credits_consumed_today || 0} icon="ri-coins-line" />
        <AdminMetricCard label={t('estimatedCostToday')} value={(data.estimated_cost_today || 0).toFixed(4)} icon="ri-money-dollar-circle-line" />
        <AdminMetricCard label={t('failedJobsToday')} value={data.failed_jobs_today || 0} icon="ri-error-warning-line" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-gray-900">{t('userGrowth')}</h3>
          <div className="h-56">
            {!canRenderUserGrowth ? (
              <ChartEmpty title={locale === 'zh' ? '暂无趋势数据' : 'No trend data'} />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={userGrowth.map((item) => ({ date: String(item.date || ''), value: Number(item.count ?? item.value ?? 0) }))}>
                  <defs>
                    <linearGradient id="colorUserReal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                  <Area type="monotone" dataKey="value" stroke="#4f46e5" strokeWidth={2} fill="url(#colorUserReal)" name={locale === 'zh' ? '新增用户' : 'New Users'} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-gray-900">{t('projectVideoGeneration')}</h3>
          <div className="h-56">
            {!canRenderPv ? (
              <ChartEmpty title={locale === 'zh' ? '暂无趋势数据' : 'No trend data'} />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pv.map((item) => ({ date: String(item.date || ''), projects: Number(item.projects ?? item.value ?? 0), videos: Number(item.videos ?? item.value2 ?? 0) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="projects" name={locale === 'zh' ? '项目' : 'Projects'} fill="#4f46e5" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="videos" name={locale === 'zh' ? '视频' : 'Videos'} fill="#0ea5e9" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-gray-900">{t('apiCallsAndCost')}</h3>
          <div className="h-56">
            {!canRenderApiCost ? (
              <ChartEmpty title={locale === 'zh' ? '暂无趋势数据' : 'No trend data'} />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={apiCost.map((item) => ({ date: String(item.date || ''), calls: Number(item.calls ?? item.value ?? 0), cost: Number(item.cost_usd ?? item.value2 ?? 0) }))}>
                  <defs>
                    <linearGradient id="colorApiReal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="calls" stroke="#10b981" strokeWidth={2} fill="url(#colorApiReal)" name={locale === 'zh' ? 'API 调用' : 'API Calls'} />
                  <Area type="monotone" dataKey="cost" stroke="#f59e0b" strokeWidth={2} fill="none" name={locale === 'zh' ? '成本 USD' : 'Cost USD'} />
                </AreaChart>
              </ResponsiveContainer>
            )}
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
            <div className="mt-4 space-y-4">
              {providerStats.map((p, i) => {
                const calls = Number(p.calls || 0);
                const successRateRaw = Number(p.success_rate || 0);
                const failureRateRaw = Number(p.failure_rate || 0);
                const successPct = successRateRaw > 1 ? successRateRaw : successRateRaw * 100;
                const failurePct = failureRateRaw > 1 ? failureRateRaw : failureRateRaw * 100;
                return (
                  <div key={i}>
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-xs text-gray-600">{String(p.provider)}</span>
                      <span className="text-xs font-medium text-gray-900">{calls}</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.max(0, Math.min(100, successPct))}%` }} />
                    </div>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {locale === 'zh' ? `成功率 ${successPct.toFixed(1)}% · 失败率 ${failurePct.toFixed(1)}%` : `Success ${successPct.toFixed(1)}% · Failure ${failurePct.toFixed(1)}%`}
                    </p>
                  </div>
                );
              })}
            </div>
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
