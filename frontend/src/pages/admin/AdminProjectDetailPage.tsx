import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { adminApi } from '../../api/adminApi';
import { AdminDataTable } from '../../components/admin/AdminDataTable';
import { AdminErrorState } from '../../components/admin/AdminErrorState';
import { AdminLoadingState } from '../../components/admin/AdminLoadingState';
import { AdminStatusBadge } from '../../components/admin/AdminStatusBadge';
import { AdminStepProgress } from '../../components/admin/AdminStepProgress';
import { AdminTabs } from '../../components/admin/AdminTabs';

export function AdminProjectDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const d = await adminApi.project(id);
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load project');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <AdminLoadingState />;
  if (error) return <AdminErrorState message={error} onRetry={load} />;
  if (!data) return null;

  const basic = data.basic_info as Record<string, unknown>;
  const steps = (data.step_progress as Record<string, unknown>[]) || [];
  const overview = data.overview as Record<string, unknown>;
  const assets = (data.assets as Record<string, unknown>[]) || [];
  const videos = (data.videos as Record<string, unknown>[]) || [];
  const apiLogs = (data.api_logs as Record<string, unknown>[]) || [];
  const errors = (data.errors as Record<string, unknown>[]) || [];

  return (
    <div className="space-y-6">
      <Link to="/admin/projects" className="text-xs text-violet-400 hover:underline">
        ← Back to projects
      </Link>

      <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">{String(basic.project_name)}</h2>
            <p className="text-xs text-zinc-500">Project #{String(basic.project_id)}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <AdminStatusBadge status={String(basic.status || 'unknown')} />
              <span className="text-xs text-zinc-500">Step: {String(basic.current_step || '—')}</span>
            </div>
          </div>
          <div className="text-right text-xs text-zinc-500">
            <div>{String(basic.user_email || '')}</div>
            <div className="mt-1">Credits used: {String(basic.credits_used)}</div>
            <div className="mt-1">API cost (blend): {Number(basic.api_cost || 0).toFixed(4)}</div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-zinc-900/40 p-5">
          <h3 className="text-sm font-semibold text-white">Pipeline progress</h3>
          <div className="mt-4">
            <AdminStepProgress
              steps={steps.map((s) => ({
                step: String(s.step),
                label: String(s.label),
                status: String(s.status),
                error_message: s.error_message ? String(s.error_message) : null,
              }))}
            />
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-zinc-900/40 p-5">
          <h3 className="text-sm font-semibold text-white">Raw overview</h3>
          <pre className="mt-3 max-h-80 overflow-auto rounded-lg bg-black/40 p-3 text-[11px] text-zinc-400">
            {JSON.stringify(overview, null, 2)}
          </pre>
        </div>
      </div>

      <div className="space-y-4">
        <AdminTabs
          active={tab}
          onChange={setTab}
          tabs={[
            { id: 'overview', label: 'Overview' },
            { id: 'assets', label: 'Assets' },
            { id: 'videos', label: 'Videos' },
            { id: 'api', label: 'API logs' },
            { id: 'errors', label: 'Errors' },
          ]}
        />
        {tab === 'overview' ? (
          <p className="text-sm text-zinc-400">Read-only project inspection. Editing is intentionally disabled in V1.</p>
        ) : null}
        {tab === 'assets' ? (
          <AdminDataTable headers={['ID', 'Type', 'Status', 'Preview', 'Created']}>
            {assets.map((a) => (
              <tr key={String(a.asset_id)}>
                <td className="px-4 py-3 text-xs">{String(a.asset_id)}</td>
                <td className="px-4 py-3 text-xs">{String(a.type)}</td>
                <td className="px-4 py-3 text-xs">{String(a.status)}</td>
                <td className="px-4 py-3 text-xs">
                  {a.preview_url ? (
                    <a className="text-violet-400 hover:underline" href={String(a.preview_url)} target="_blank" rel="noreferrer">
                      link
                    </a>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-zinc-500">{String(a.created_at || '')}</td>
              </tr>
            ))}
          </AdminDataTable>
        ) : null}
        {tab === 'videos' ? (
          <AdminDataTable headers={['ID', 'Type', 'Status', 'URL', 'Error', 'Created']}>
            {videos.map((v) => (
              <tr key={String(v.video_id)}>
                <td className="px-4 py-3 text-xs">{String(v.video_id)}</td>
                <td className="px-4 py-3 text-xs">{String(v.type)}</td>
                <td className="px-4 py-3 text-xs">{String(v.status)}</td>
                <td className="px-4 py-3 text-xs">
                  {v.video_url ? (
                    <a className="text-violet-400 hover:underline" href={String(v.video_url)} target="_blank" rel="noreferrer">
                      open
                    </a>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="max-w-xs truncate px-4 py-3 text-xs text-red-300">{String(v.error || '')}</td>
                <td className="px-4 py-3 text-xs text-zinc-500">{String(v.created_at || '')}</td>
              </tr>
            ))}
          </AdminDataTable>
        ) : null}
        {tab === 'api' ? (
          <AdminDataTable headers={['ID', 'Provider', 'Business', 'Status', 'At']}>
            {apiLogs.map((l) => (
              <tr key={String(l.api_call_id)}>
                <td className="px-4 py-3 text-xs">{String(l.api_call_id)}</td>
                <td className="px-4 py-3 text-xs">{String(l.provider)}</td>
                <td className="px-4 py-3 text-xs">{String(l.business_type)}</td>
                <td className="px-4 py-3 text-xs">{String(l.status)}</td>
                <td className="px-4 py-3 text-xs text-zinc-500">{String(l.created_at || '')}</td>
              </tr>
            ))}
          </AdminDataTable>
        ) : null}
        {tab === 'errors' ? (
          <AdminDataTable headers={['Source', 'ID', 'Message', 'At']}>
            {errors.map((er, i) => (
              <tr key={i}>
                <td className="px-4 py-3 text-xs">{String(er.source)}</td>
                <td className="px-4 py-3 text-xs">{String(er.id)}</td>
                <td className="max-w-lg truncate px-4 py-3 text-xs text-red-200">{String(er.message)}</td>
                <td className="px-4 py-3 text-xs text-zinc-500">{String(er.created_at || '')}</td>
              </tr>
            ))}
          </AdminDataTable>
        ) : null}
      </div>
    </div>
  );
}
