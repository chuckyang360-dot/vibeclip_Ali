import { useEffect, useState } from 'react';
import { adminApi } from '../../api/adminApi';
import { AdminErrorState } from '../../components/admin/AdminErrorState';
import { AdminLoadingState } from '../../components/admin/AdminLoadingState';
import { useAdminLocale } from '../../contexts/AdminLocaleContext';

function toDisplayLabel(value: unknown): string {
  if (typeof value !== 'string') return 'Unknown';
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function toBoolText(value: unknown, locale: 'zh' | 'en'): string {
  if (value === true) return locale === 'zh' ? '必须填写原因' : 'Reason required';
  if (value === false) return locale === 'zh' ? '无需填写原因' : 'Not required';
  return locale === 'zh' ? '未配置' : 'Not configured';
}

function roleDescription(locale: 'zh' | 'en', badge: string): string {
  if (badge === 'Super Admin') {
    return locale === 'zh'
      ? '拥有全量权限，包括用户、积分与系统设置。'
      : 'Full access including users, credits, system settings.';
  }
  if (badge === 'Operator') {
    return locale === 'zh'
      ? '可查看所有数据，管理用户、处理积分与运营操作。'
      : 'Can view all data, manage users, handle credits and operations.';
  }
  return locale === 'zh'
    ? '只读或普通用户权限，具体取决于路由权限控制。'
    : 'Read-only or normal user access depending on route permissions.';
}

export function AdminSettingsPage() {
  const { locale, t } = useAdminLocale();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await adminApi.settings();
        if (!cancelled) setData(d);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <AdminLoadingState />;
  if (error) return <AdminErrorState message={error} />;
  if (!data) return null;

  const creditRules = (data.credit_rules as Record<string, unknown> | undefined) || {};
  const assetCost = Number(creditRules.asset_generation_cost ?? 0);
  const videoCost = Number(creditRules.video_generation_cost ?? 0);
  const fullComposeCost = creditRules.full_video_compose_cost;
  const refundPolicy = String(creditRules.refund_policy || 'Not configured');
  const requiresReason = creditRules.manual_adjustment_requires_reason;

  const providersRaw = Array.isArray(data.api_providers) ? (data.api_providers as unknown[]) : [];
  const providerRows = providersRaw.map((item) => {
    const p = (item as Record<string, unknown>) || {};
    const rawId = String(p.id || p.provider || p.name || p.label || 'other').toLowerCase();
    let label = String(p.label || p.name || p.provider || p.id || 'Other');
    let desc = 'External provider';
    if (rawId.includes('xai') || label.toLowerCase().includes('xai')) {
      label = 'xAI';
      desc = 'grok-2, grok-2-mini';
    } else if (rawId.includes('gemini') || label.toLowerCase().includes('gemini')) {
      label = 'Gemini';
      desc = 'gemini-2.0-flash, gemini-2.0-pro';
    } else if (rawId.includes('r2') || label.toLowerCase().includes('r2') || label.toLowerCase().includes('cloudflare')) {
      label = 'Cloudflare R2';
      desc = 'Storage & CDN';
    }
    return { label, desc };
  });
  if (providerRows.length === 0) {
    providerRows.push(
      { label: 'xAI', desc: 'grok-2, grok-2-mini' },
      { label: 'Gemini', desc: 'gemini-2.0-flash, gemini-2.0-pro' },
      { label: 'Cloudflare R2', desc: 'Storage & CDN' },
    );
  }

  const rolesRaw = Array.isArray(data.admin_roles) ? (data.admin_roles as unknown[]) : [];
  const roleRows = (rolesRaw.length ? rolesRaw : ['super_admin', 'admin', 'user']).map((role) => {
    const roleObj = role as Record<string, unknown>;
    const roleId = typeof role === 'string' ? role : String(roleObj.id || roleObj.role || roleObj.name || 'user');
    const normalized = roleId.toLowerCase();
    if (normalized.includes('super')) {
      return {
        badge: locale === 'zh' ? '超级管理员' : 'Super Admin',
        desc: roleDescription(locale, 'Super Admin'),
        tone: 'bg-rose-50 text-rose-700 border-rose-200',
      };
    }
    if (normalized === 'admin' || normalized.includes('operator')) {
      return {
        badge: locale === 'zh' ? '运营人员' : 'Operator',
        desc: roleDescription(locale, 'Operator'),
        tone: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      };
    }
    return {
      badge: locale === 'zh' ? '查看人员' : 'Viewer',
      desc: roleDescription(locale, 'Viewer'),
      tone: 'bg-gray-100 text-gray-600 border-gray-200',
    };
  });

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50">
            <i className="ri-coin-line text-sm text-indigo-600" />
          </div>
          <h2 className="text-sm font-semibold text-gray-900">{t('creditRules')}</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="mb-1 text-xs text-gray-400">{t('assetGenerationCost')}</p>
              <p className="text-sm font-medium text-gray-900">{assetCost} {locale === 'zh' ? '积分 / 资产' : 'credits / asset'}</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="mb-1 text-xs text-gray-400">{t('videoGenerationCost')}</p>
              <p className="text-sm font-medium text-gray-900">{videoCost} {locale === 'zh' ? '积分 / 分段' : 'credits / segment'}</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="mb-1 text-xs text-gray-400">{t('refundPolicy')}</p>
            <p className="text-sm font-medium text-gray-900">{toDisplayLabel(refundPolicy)}</p>
          </div>
          {fullComposeCost != null ? (
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="mb-1 text-xs text-gray-400">{locale === 'zh' ? '完整视频合成成本' : 'Full Video Compose Cost'}</p>
              <p className="text-sm font-medium text-gray-900">{Number(fullComposeCost)} credits</p>
            </div>
          ) : null}
          {requiresReason != null ? (
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="mb-1 text-xs text-gray-400">{t('manualAdjustment')}</p>
              <p className="text-sm font-medium text-gray-900">{toBoolText(requiresReason, locale)}</p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50">
            <i className="ri-server-line text-sm text-emerald-600" />
          </div>
          <h2 className="text-sm font-semibold text-gray-900">{t('apiProviders')}</h2>
        </div>
        <div className="space-y-3">
          {providerRows.map((p, idx) => (
            <div key={`${p.label}-${idx}`} className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
              <div className="flex items-center gap-3">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-sm font-medium text-gray-900">{p.label}</span>
                <span className="text-xs text-gray-500">{p.desc}</span>
              </div>
              <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                {locale === 'zh' ? '正常运行' : 'Running'}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50">
            <i className="ri-shield-user-line text-sm text-amber-600" />
          </div>
          <h2 className="text-sm font-semibold text-gray-900">{t('adminRoles')}</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {roleRows.map((r, idx) => (
            <div key={`${r.badge}-${idx}`} className="rounded-lg bg-gray-50 p-3">
              <div className="mb-2 flex items-center gap-2">
                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${r.tone}`}>
                  {r.badge}
                </span>
              </div>
              <p className="text-xs text-gray-500">{r.desc}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-gray-500">Timezone: {String(data.timezone || '')}</p>
      </div>
    </div>
  );
}
