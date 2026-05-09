import { useEffect, useState } from 'react';
import { adminApi } from '../../api/adminApi';
import { AdminErrorState } from '../../components/admin/AdminErrorState';
import { AdminLoadingState } from '../../components/admin/AdminLoadingState';

export function AdminSettingsPage() {
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

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-5">
        <h3 className="text-sm font-semibold text-white">Credit rules</h3>
        <pre className="mt-3 overflow-auto rounded-lg bg-black/40 p-3 text-[11px] text-zinc-300">
          {JSON.stringify(data.credit_rules, null, 2)}
        </pre>
      </div>
      <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-5">
        <h3 className="text-sm font-semibold text-white">API providers</h3>
        <pre className="mt-3 overflow-auto rounded-lg bg-black/40 p-3 text-[11px] text-zinc-300">
          {JSON.stringify(data.api_providers, null, 2)}
        </pre>
      </div>
      <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-5">
        <h3 className="text-sm font-semibold text-white">Admin roles</h3>
        <pre className="mt-3 overflow-auto rounded-lg bg-black/40 p-3 text-[11px] text-zinc-300">
          {JSON.stringify(data.admin_roles, null, 2)}
        </pre>
        <p className="mt-3 text-xs text-zinc-500">Timezone: {String(data.timezone || '')}</p>
      </div>
    </div>
  );
}
