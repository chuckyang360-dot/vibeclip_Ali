import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { adminApi } from '../../api/adminApi';
import { AdminConfirmModal } from '../../components/admin/AdminConfirmModal';
import { AdminDataTable } from '../../components/admin/AdminDataTable';
import { AdminErrorState } from '../../components/admin/AdminErrorState';
import { AdminLoadingState } from '../../components/admin/AdminLoadingState';
import { AdminMetricCard } from '../../components/admin/AdminMetricCard';
import { AdminStatusBadge } from '../../components/admin/AdminStatusBadge';
import { AdminTabs } from '../../components/admin/AdminTabs';
import { CreditAdjustmentModal } from '../../components/admin/CreditAdjustmentModal';

export function AdminUserDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [tab, setTab] = useState('projects');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [grantOpen, setGrantOpen] = useState(false);
  const [deductOpen, setDeductOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const d = await adminApi.user(id);
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load user');
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
  const metrics = data.metrics as Record<string, unknown>;
  const projects = (data.projects as Record<string, unknown>[]) || [];
  const txns = (data.credit_transactions as Record<string, unknown>[]) || [];
  const apiu = (data.api_usage as Record<string, unknown>[]) || [];
  const ops = (data.admin_operation_history as Record<string, unknown>[]) || [];
  const uid = Number(basic.user_id);
  const isDisabled = String(basic.status) === 'disabled';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/admin/users" className="text-xs text-violet-400 hover:underline">
          ← Back to users
        </Link>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setGrantOpen(true)}
            className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500"
          >
            Grant credits
          </button>
          <button
            type="button"
            onClick={() => setDeductOpen(true)}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-white/5"
          >
            Deduct credits
          </button>
          {isDisabled ? (
            <button
              type="button"
              onClick={() => setRestoreOpen(true)}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
            >
              Restore user
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setDisableOpen(true)}
              className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-500"
            >
              Disable user
            </button>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">{String(basic.email)}</h2>
            <p className="text-xs text-zinc-500">User #{uid}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <AdminStatusBadge status={String(basic.status || 'normal')} />
              <span className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-[11px] text-zinc-300 ring-1 ring-white/10">
                {String(basic.subscription || 'free')}
              </span>
            </div>
          </div>
          <div className="text-right text-xs text-zinc-500">
            <div>Registered: {String(basic.registered_at || '—')}</div>
            <div className="mt-1">Credits: {String(basic.credit_balance)}</div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <AdminMetricCard label="Projects" value={Number(metrics.total_projects || 0)} />
        <AdminMetricCard label="Assets" value={Number(metrics.total_assets || 0)} />
        <AdminMetricCard label="Videos" value={Number(metrics.total_videos || 0)} />
        <AdminMetricCard label="Credits granted" value={Number(metrics.total_credits_granted || 0)} />
        <AdminMetricCard label="Credits consumed" value={Number(metrics.total_credits_consumed || 0)} />
        <AdminMetricCard label="Est. API cost" value={Number(metrics.estimated_api_cost || 0).toFixed(4)} />
      </div>

      <div className="space-y-4">
        <AdminTabs
          active={tab}
          onChange={setTab}
          tabs={[
            { id: 'projects', label: 'Projects' },
            { id: 'credits', label: 'Credit transactions' },
            { id: 'api', label: 'API usage' },
            { id: 'ops', label: 'Operation history' },
          ]}
        />
        {tab === 'projects' ? (
          <AdminDataTable headers={['Project', 'Status', 'Step', 'Updated']}>
            {projects.map((p) => (
              <tr key={String(p.project_id)}>
                <td className="px-4 py-3">
                  <Link className="text-violet-400 hover:underline" to={`/admin/projects/${p.project_id}`}>
                    {String(p.project_name)}
                  </Link>
                </td>
                <td className="px-4 py-3 text-xs">{String(p.status)}</td>
                <td className="px-4 py-3 text-xs">{String(p.current_step || '—')}</td>
                <td className="px-4 py-3 text-xs text-zinc-500">{String(p.updated_at || '')}</td>
              </tr>
            ))}
          </AdminDataTable>
        ) : null}
        {tab === 'credits' ? (
          <AdminDataTable headers={['ID', 'Type', 'Amount', 'Balances', 'Note', 'At']}>
            {txns.map((t) => (
              <tr key={String(t.transaction_id)}>
                <td className="px-4 py-3 text-xs">{String(t.transaction_id)}</td>
                <td className="px-4 py-3 text-xs">{String(t.type)}</td>
                <td className="px-4 py-3 text-sm">{String(t.amount)}</td>
                <td className="px-4 py-3 text-xs text-zinc-500">
                  {String(t.balance_before)} → {String(t.balance_after)}
                </td>
                <td className="max-w-xs truncate px-4 py-3 text-xs text-zinc-400">{String(t.note || '')}</td>
                <td className="px-4 py-3 text-xs text-zinc-500">{String(t.created_at || '')}</td>
              </tr>
            ))}
          </AdminDataTable>
        ) : null}
        {tab === 'api' ? (
          <AdminDataTable headers={['ID', 'Provider', 'Type', 'Status', 'Cost USD?', 'At']}>
            {apiu.map((a) => (
              <tr key={String(a.api_call_id)}>
                <td className="px-4 py-3 text-xs">{String(a.api_call_id)}</td>
                <td className="px-4 py-3 text-xs">{String(a.provider)}</td>
                <td className="px-4 py-3 text-xs">{String(a.business_type)}</td>
                <td className="px-4 py-3 text-xs">{String(a.status)}</td>
                <td className="px-4 py-3 text-xs">{a.estimated_cost_usd == null ? '—' : String(a.estimated_cost_usd)}</td>
                <td className="px-4 py-3 text-xs text-zinc-500">{String(a.created_at || '')}</td>
              </tr>
            ))}
          </AdminDataTable>
        ) : null}
        {tab === 'ops' ? (
          <AdminDataTable headers={['ID', 'Operator', 'Action', 'Reason', 'At']}>
            {ops.map((o) => (
              <tr key={String(o.log_id)}>
                <td className="px-4 py-3 text-xs">{String(o.log_id)}</td>
                <td className="px-4 py-3 text-xs">{String(o.operator)}</td>
                <td className="px-4 py-3 text-xs">{String(o.action)}</td>
                <td className="max-w-sm truncate px-4 py-3 text-xs text-zinc-400">{String(o.reason || '')}</td>
                <td className="px-4 py-3 text-xs text-zinc-500">{String(o.created_at || '')}</td>
              </tr>
            ))}
          </AdminDataTable>
        ) : null}
      </div>

      <CreditAdjustmentModal
        open={grantOpen}
        mode="grant"
        onClose={() => setGrantOpen(false)}
        onSubmit={async (amount, r) => {
          await adminApi.grantCredits(uid, { amount, reason: r });
          await load();
        }}
      />
      <CreditAdjustmentModal
        open={deductOpen}
        mode="deduct"
        onClose={() => setDeductOpen(false)}
        onSubmit={async (amount, r) => {
          await adminApi.deductCredits(uid, { amount, reason: r });
          await load();
        }}
      />

      <AdminConfirmModal
        open={disableOpen}
        title="Disable user"
        confirmLabel="Disable"
        danger
        onCancel={() => {
          setDisableOpen(false);
          setReason('');
        }}
        onConfirm={async () => {
          if (!reason.trim()) return;
          await adminApi.disableUser(uid, { reason: reason.trim() });
          setDisableOpen(false);
          setReason('');
          await load();
        }}
      >
        <textarea
          className="mt-4 w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
          rows={3}
          placeholder="Reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </AdminConfirmModal>

      <AdminConfirmModal
        open={restoreOpen}
        title="Restore user"
        confirmLabel="Restore"
        onCancel={() => {
          setRestoreOpen(false);
          setReason('');
        }}
        onConfirm={async () => {
          if (!reason.trim()) return;
          await adminApi.restoreUser(uid, { reason: reason.trim() });
          setRestoreOpen(false);
          setReason('');
          await load();
        }}
      >
        <textarea
          className="mt-4 w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
          rows={3}
          placeholder="Reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </AdminConfirmModal>
    </div>
  );
}
