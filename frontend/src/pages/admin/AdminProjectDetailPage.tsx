import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { adminApi } from '../../api/adminApi';
import { AdminDataTable } from '../../components/admin/AdminDataTable';
import { AdminErrorState } from '../../components/admin/AdminErrorState';
import { AdminLoadingState } from '../../components/admin/AdminLoadingState';
import { AdminStatusBadge } from '../../components/admin/AdminStatusBadge';
import { AdminStepProgress } from '../../components/admin/AdminStepProgress';
import { AdminTabs } from '../../components/admin/AdminTabs';
import { useAdminLocale } from '../../contexts/AdminLocaleContext';
import { formatAdminStatus, formatBusinessType } from '../../i18n/adminI18n';

export function AdminProjectDetailPage() {
  const { locale, t } = useAdminLocale();
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
      <Link to="/admin/projects" className="text-xs text-indigo-600 hover:underline">
        {locale === 'zh' ? '← 返回项目列表' : '← Back to projects'}
      </Link>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{String(basic.project_name)}</h2>
            <p className="text-xs text-gray-500">{locale === 'zh' ? `项目 #${String(basic.project_id)}` : `Project #${String(basic.project_id)}`}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <AdminStatusBadge status={formatAdminStatus(locale, basic.status || 'unknown')} />
              <span className="text-xs text-gray-500">{t('currentStep')}: {String(basic.current_step || '—')}</span>
            </div>
          </div>
          <div className="text-right text-xs text-gray-500">
            <div>{String(basic.user_email || '')}</div>
            <div className="mt-1">{t('creditsUsed')}: {String(basic.credits_used)}</div>
            <div className="mt-1">{t('estimatedCost')}: {Number(basic.api_cost || 0).toFixed(4)}</div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-gray-900">{locale === 'zh' ? '流程进度' : 'Pipeline progress'}</h3>
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
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-gray-900">{t('overview')}</h3>
          <pre className="mt-3 max-h-80 overflow-auto rounded-lg bg-gray-50 p-3 text-[11px] text-gray-500">
            {JSON.stringify(overview, null, 2)}
          </pre>
        </div>
      </div>

      <div className="space-y-4">
        <AdminTabs
          active={tab}
          onChange={setTab}
          tabs={[
            { id: 'overview', label: t('overview') },
            { id: 'assets', label: t('assets') },
            { id: 'videos', label: t('videos') },
            { id: 'api', label: t('apiLogs') },
            { id: 'errors', label: t('errors') },
          ]}
        />
        {tab === 'overview' ? (
          <p className="text-sm text-gray-500">{locale === 'zh' ? '仅支持只读查看，V1 不提供编辑。' : 'Read-only project inspection. Editing is intentionally disabled in V1.'}</p>
        ) : null}
        {tab === 'assets' ? (
          <AdminDataTable headers={['ID', t('businessType'), t('status'), 'Preview', t('createdAt')]}>
            {assets.map((a) => (
              <tr key={String(a.asset_id)}>
                <td className="px-4 py-3 text-xs">{String(a.asset_id)}</td>
                <td className="px-4 py-3 text-xs">{String(a.type)}</td>
                <td className="px-4 py-3 text-xs">{formatAdminStatus(locale, a.status)}</td>
                <td className="px-4 py-3 text-xs">
                  {a.preview_url ? (
                    <a className="text-indigo-600 hover:underline" href={String(a.preview_url)} target="_blank" rel="noreferrer">
                      link
                    </a>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">{String(a.created_at || '')}</td>
              </tr>
            ))}
          </AdminDataTable>
        ) : null}
        {tab === 'videos' ? (
          <AdminDataTable headers={['ID', t('businessType'), t('status'), 'URL', t('errors'), t('createdAt')]}>
            {videos.map((v) => (
              <tr key={String(v.video_id)}>
                <td className="px-4 py-3 text-xs">{String(v.video_id)}</td>
                <td className="px-4 py-3 text-xs">{String(v.type)}</td>
                <td className="px-4 py-3 text-xs">{formatAdminStatus(locale, v.status)}</td>
                <td className="px-4 py-3 text-xs">
                  {v.video_url ? (
                    <a className="text-indigo-600 hover:underline" href={String(v.video_url)} target="_blank" rel="noreferrer">
                      open
                    </a>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="max-w-xs truncate px-4 py-3 text-xs text-red-300">{String(v.error || '')}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{String(v.created_at || '')}</td>
              </tr>
            ))}
          </AdminDataTable>
        ) : null}
        {tab === 'api' ? (
          <AdminDataTable headers={['ID', t('provider'), t('businessType'), t('status'), t('createdAt')]}>
            {apiLogs.map((l) => (
              <tr key={String(l.api_call_id)}>
                <td className="px-4 py-3 text-xs">{String(l.api_call_id)}</td>
                <td className="px-4 py-3 text-xs">{String(l.provider)}</td>
                <td className="px-4 py-3 text-xs">{formatBusinessType(locale, l.business_type)}</td>
                <td className="px-4 py-3 text-xs">{formatAdminStatus(locale, l.status)}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{String(l.created_at || '')}</td>
              </tr>
            ))}
          </AdminDataTable>
        ) : null}
        {tab === 'errors' ? (
          <AdminDataTable headers={['Source', 'ID', t('errorMessage'), t('createdAt')]}>
            {errors.map((er, i) => (
              <tr key={i}>
                <td className="px-4 py-3 text-xs">{String(er.source)}</td>
                <td className="px-4 py-3 text-xs">{String(er.id)}</td>
                <td className="max-w-lg truncate px-4 py-3 text-xs text-red-200">{String(er.message)}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{String(er.created_at || '')}</td>
              </tr>
            ))}
          </AdminDataTable>
        ) : null}
      </div>
    </div>
  );
}
