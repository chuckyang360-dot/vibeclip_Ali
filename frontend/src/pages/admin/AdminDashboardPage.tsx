import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '../../api/adminApi';
import { AdminEmptyState } from '../../components/admin/AdminEmptyState';
import { AdminErrorState } from '../../components/admin/AdminErrorState';
import { AdminLoadingState } from '../../components/admin/AdminLoadingState';
import { AdminMetricCard } from '../../components/admin/AdminMetricCard';
import { AdminDataTable } from '../../components/admin/AdminDataTable';
import { AdminStatusBadge } from '../../components/admin/AdminStatusBadge';

function MiniBars({
  data,
  valueKey,
  labelKey = 'date',
}: {
  data: Record<string, unknown>[];
  valueKey: string;
  labelKey?: string;
}) {
  const nums = data.map((d) => Number(d[valueKey] || 0));
  const max = Math.max(1, ...nums);
  if (!data.length) {
    return <AdminEmptyState title="No trend data" />;
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
                className="w-full max-w-[28px] rounded-t-lg bg-gradient-to-t from-violet-600 to-fuchsia-500 opacity-90"
                style={{ height: h }}
                title={`${v}`}
              />
            </div>
            <span className="max-w-full truncate text-[10px] text-zinc-500">
              {String(row[labelKey] || '').slice(5)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function AdminDashboardPage() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
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
  if (!data) return <AdminEmptyState title="No data" />;

  const abnormal = (data.abnormal_tasks as Record<string, unknown>[]) || [];
  const topUsers = (data.top_consuming_users as Record<string, unknown>[]) || [];
  const providerStats = (data.provider_stats as Record<string, unknown>[]) || [];
  const userGrowth = (data.user_growth_7d as Record<string, unknown>[]) || [];
  const pv = (data.project_video_generation_7d as Record<string, unknown>[]) || [];
  const apiCost = (data.api_calls_cost_7d as Record<string, unknown>[]) || [];

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard label="Total users" value={Number(data.total_users || 0)} />
        <AdminMetricCard label="New users today" value={Number(data.new_users_today || 0)} />
        <AdminMetricCard label="Projects today" value={Number(data.projects_today || 0)} />
        <AdminMetricCard label="API calls today" value={Number(data.api_calls_today || 0)} />
        <AdminMetricCard label="Assets today" value={Number(data.assets_generated_today || 0)} />
        <AdminMetricCard label="Videos today" value={Number(data.videos_generated_today || 0)} />
        <AdminMetricCard label="Credits consumed today" value={Number(data.credits_consumed_today || 0)} />
        <AdminMetricCard
          label="Est. cost today (blend)"
          value={(Number(data.estimated_cost_today || 0)).toFixed(4)}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-zinc-900/40 p-5">
          <h3 className="text-sm font-semibold text-white">User growth (7d)</h3>
          <div className="mt-4">
            <MiniBars data={userGrowth} valueKey="count" />
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-zinc-900/40 p-5">
          <h3 className="text-sm font-semibold text-white">Projects & videos (7d)</h3>
          <p className="mt-1 text-xs text-zinc-500">Bars show projects per day</p>
          <div className="mt-4">
            <MiniBars data={pv} valueKey="projects" />
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-zinc-900/40 p-5">
          <h3 className="text-sm font-semibold text-white">API calls & cost (7d)</h3>
          <div className="mt-4">
            <MiniBars data={apiCost} valueKey="calls" />
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-zinc-900/40 p-5">
          <h3 className="text-sm font-semibold text-white">API health by provider</h3>
          {providerStats.length === 0 ? (
            <div className="mt-4">
              <AdminEmptyState title="No provider stats yet" description="Logs will populate over time." />
            </div>
          ) : (
            <AdminDataTable headers={['Provider', 'Calls', 'Success %', 'Fail %']}>
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
        <div className="rounded-2xl border border-white/10 bg-zinc-900/40 p-5">
          <h3 className="text-sm font-semibold text-white">Top consuming users (today)</h3>
          {topUsers.length === 0 ? (
            <div className="mt-4">
              <AdminEmptyState title="No consumption recorded today" />
            </div>
          ) : (
            <AdminDataTable headers={['User', 'Credits']}>
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

      <div className="rounded-2xl border border-white/10 bg-zinc-900/40 p-5">
        <h3 className="text-sm font-semibold text-white">Abnormal tasks</h3>
        {abnormal.length === 0 ? (
          <div className="mt-4">
            <AdminEmptyState title="No abnormal tasks detected" />
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <AdminDataTable headers={['Kind', 'ID', 'Project', 'Status', 'Message']}>
              {abnormal.map((r, i) => (
                <tr key={i}>
                  <td className="px-4 py-3 text-xs text-zinc-400">{String(r.kind)}</td>
                  <td className="px-4 py-3 text-sm">{String(r.id)}</td>
                  <td className="px-4 py-3 text-sm">{String(r.project_id ?? '—')}</td>
                  <td className="px-4 py-3">
                    <AdminStatusBadge status={String(r.status || 'unknown')} />
                  </td>
                  <td className="max-w-md truncate px-4 py-3 text-xs text-zinc-400">{String(r.message || '')}</td>
                </tr>
              ))}
            </AdminDataTable>
          </div>
        )}
      </div>
    </div>
  );
}
