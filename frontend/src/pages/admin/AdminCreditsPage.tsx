import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminApi } from '../../api/adminApi';
import { AdminDataTable } from '../../components/admin/AdminDataTable';
import { AdminEmptyState } from '../../components/admin/AdminEmptyState';
import { AdminErrorState } from '../../components/admin/AdminErrorState';
import { AdminFilterBar } from '../../components/admin/AdminFilterBar';
import { AdminLoadingState } from '../../components/admin/AdminLoadingState';
import { AdminTabs } from '../../components/admin/AdminTabs';
import { CreditAdjustmentModal } from '../../components/admin/CreditAdjustmentModal';

export function AdminCreditsPage() {
  const [tab, setTab] = useState('accounts');
  const [accounts, setAccounts] = useState<Record<string, unknown>[]>([]);
  const [acctTotal, setAcctTotal] = useState(0);
  const [txns, setTxns] = useState<Record<string, unknown>[]>([]);
  const [txnTotal, setTxnTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [userId, setUserId] = useState('');
  const [txnType, setTxnType] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [adjUserId, setAdjUserId] = useState('');
  const [adjBalance, setAdjBalance] = useState<number | null>(null);
  const [grantOpen, setGrantOpen] = useState(false);
  const [deductOpen, setDeductOpen] = useState(false);

  const acctQuery = useMemo(() => {
    const p = new URLSearchParams();
    p.set('page', String(page));
    p.set('page_size', String(pageSize));
    if (search.trim()) p.set('search', search.trim());
    return p.toString();
  }, [page, pageSize, search]);

  const txnQuery = useMemo(() => {
    const p = new URLSearchParams();
    p.set('page', String(page));
    p.set('page_size', String(pageSize));
    if (userId.trim() && Number.isFinite(Number(userId))) p.set('user_id', String(Number(userId)));
    if (txnType) p.set('transaction_type', txnType);
    return p.toString();
  }, [page, pageSize, userId, txnType]);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.creditAccounts(acctQuery);
      setAccounts((res.items as Record<string, unknown>[]) || []);
      setAcctTotal(Number(res.total || 0));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load accounts');
    } finally {
      setLoading(false);
    }
  }, [acctQuery]);

  const loadTxns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.creditTransactions(txnQuery);
      setTxns((res.items as Record<string, unknown>[]) || []);
      setTxnTotal(Number(res.total || 0));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  }, [txnQuery]);

  useEffect(() => {
    if (tab === 'accounts') void loadAccounts();
    if (tab === 'transactions') void loadTxns();
    // manual tab: no auto load
  }, [tab, loadAccounts, loadTxns]);

  const refreshBalancePreview = async () => {
    const id = Number(adjUserId);
    if (!Number.isFinite(id) || id <= 0) {
      setAdjBalance(null);
      return;
    }
    try {
      const u = await adminApi.user(id);
      const basic = u.basic_info as Record<string, unknown>;
      setAdjBalance(Number(basic.credit_balance || 0));
    } catch {
      setAdjBalance(null);
    }
  };

  useEffect(() => {
    if (tab !== 'manual') return;
    const t = window.setTimeout(() => {
      void refreshBalancePreview();
    }, 400);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adjUserId, tab]);

  const pages = Math.max(1, Math.ceil((tab === 'accounts' ? acctTotal : txnTotal) / pageSize));

  return (
    <div className="space-y-6">
      <AdminTabs
        active={tab}
        onChange={(id) => {
          setTab(id);
          setPage(1);
          setError(null);
        }}
        tabs={[
          { id: 'accounts', label: 'Credit accounts' },
          { id: 'transactions', label: 'Credit transactions' },
          { id: 'manual', label: 'Manual adjustment' },
        ]}
      />

      {tab === 'accounts' ? (
        <>
          <AdminFilterBar>
            <label className="flex flex-col text-xs text-zinc-500">
              Search
              <input
                className="mt-1 rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
                value={search}
                onChange={(e) => {
                  setPage(1);
                  setSearch(e.target.value);
                }}
              />
            </label>
            <button
              type="button"
              onClick={() => void loadAccounts()}
              className="rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-500"
            >
              Apply
            </button>
          </AdminFilterBar>
          {loading ? <AdminLoadingState /> : null}
          {error ? <AdminErrorState message={error} onRetry={loadAccounts} /> : null}
          {!loading && !error && accounts.length === 0 ? <AdminEmptyState title="No credit accounts" /> : null}
          {!loading && !error && accounts.length > 0 ? (
            <>
              <AdminDataTable headers={['User', 'Email', 'Balance', 'Granted', 'Consumed', 'Refunded', 'Updated']}>
                {accounts.map((row, i) => {
                  const u = row.user as Record<string, unknown> | undefined;
                  return (
                    <tr key={i}>
                      <td className="px-4 py-3 text-xs">{String(u?.username || u?.user_id)}</td>
                      <td className="px-4 py-3 text-xs">{String(row.email)}</td>
                      <td className="px-4 py-3 text-sm">{String(row.current_balance)}</td>
                      <td className="px-4 py-3 text-xs text-zinc-400">{String(row.total_granted)}</td>
                      <td className="px-4 py-3 text-xs text-zinc-400">{String(row.total_consumed)}</td>
                      <td className="px-4 py-3 text-xs text-zinc-400">{String(row.total_refunded)}</td>
                      <td className="px-4 py-3 text-xs text-zinc-500">{String(row.updated_at || '')}</td>
                    </tr>
                  );
                })}
              </AdminDataTable>
              <div className="flex items-center justify-between text-xs text-zinc-500">
                <span>
                  Page {page} / {pages}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="rounded-lg border border-white/10 px-3 py-1 disabled:opacity-40"
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    disabled={page >= pages}
                    onClick={() => setPage((p) => Math.min(pages, p + 1))}
                    className="rounded-lg border border-white/10 px-3 py-1 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          ) : null}
        </>
      ) : null}

      {tab === 'transactions' ? (
        <>
          <AdminFilterBar>
            <label className="flex flex-col text-xs text-zinc-500">
              User ID
              <input
                className="mt-1 rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
                value={userId}
                onChange={(e) => {
                  setPage(1);
                  setUserId(e.target.value);
                }}
              />
            </label>
            <label className="flex flex-col text-xs text-zinc-500">
              Type
              <input
                className="mt-1 rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
                value={txnType}
                onChange={(e) => {
                  setPage(1);
                  setTxnType(e.target.value);
                }}
                placeholder="admin_grant / admin_deduct / …"
              />
            </label>
            <button
              type="button"
              onClick={() => void loadTxns()}
              className="rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-500"
            >
              Apply
            </button>
          </AdminFilterBar>
          {loading ? <AdminLoadingState /> : null}
          {error ? <AdminErrorState message={error} onRetry={loadTxns} /> : null}
          {!loading && !error && txns.length === 0 ? <AdminEmptyState title="No transactions" /> : null}
          {!loading && !error && txns.length > 0 ? (
            <>
              <AdminDataTable headers={['ID', 'User', 'Type', 'Amount', 'Balances', 'Operator', 'Note', 'At']}>
                {txns.map((t) => {
                  const u = t.user as Record<string, unknown> | undefined;
                  const op = t.operator as Record<string, unknown> | undefined;
                  return (
                    <tr key={String(t.transaction_id)}>
                      <td className="px-4 py-3 text-xs">{String(t.transaction_id)}</td>
                      <td className="px-4 py-3 text-xs">{String(u?.email || u?.user_id)}</td>
                      <td className="px-4 py-3 text-xs">{String(t.type)}</td>
                      <td className="px-4 py-3 text-sm">{String(t.amount)}</td>
                      <td className="px-4 py-3 text-xs text-zinc-500">
                        {String(t.balance_before)} → {String(t.balance_after)}
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-400">
                        {String(op?.type || '')} {op?.admin_email ? `· ${String(op.admin_email)}` : ''}
                      </td>
                      <td className="max-w-xs truncate px-4 py-3 text-xs text-zinc-400">{String(t.note || '')}</td>
                      <td className="px-4 py-3 text-xs text-zinc-500">{String(t.created_at || '')}</td>
                    </tr>
                  );
                })}
              </AdminDataTable>
              <div className="flex items-center justify-between text-xs text-zinc-500">
                <span>
                  Page {page} / {pages}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="rounded-lg border border-white/10 px-3 py-1 disabled:opacity-40"
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    disabled={page >= pages}
                    onClick={() => setPage((p) => Math.min(pages, p + 1))}
                    className="rounded-lg border border-white/10 px-3 py-1 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          ) : null}
        </>
      ) : null}

      {tab === 'manual' ? (
        <div className="rounded-2xl border border-white/10 bg-zinc-900/40 p-6 space-y-4 max-w-xl">
          <label className="block text-xs text-zinc-500">
            User ID
            <input
              className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
              value={adjUserId}
              onChange={(e) => setAdjUserId(e.target.value)}
            />
          </label>
          <div className="text-sm text-zinc-300">
            Current balance:{' '}
            <span className="font-semibold text-white">{adjBalance == null ? '—' : String(adjBalance)}</span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setGrantOpen(true);
              }}
              className="rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-500"
            >
              Grant
            </button>
            <button
              type="button"
              onClick={() => {
                setDeductOpen(true);
              }}
              className="rounded-lg border border-white/10 px-4 py-2 text-xs font-semibold text-zinc-200 hover:bg-white/5"
            >
              Deduct
            </button>
          </div>
          <p className="text-xs text-zinc-500">Reason is required for all adjustments. Keys/tokens are never displayed.</p>
        </div>
      ) : null}

      <CreditAdjustmentModal
        open={grantOpen}
        mode="grant"
        onClose={() => setGrantOpen(false)}
        onSubmit={async (amount, reason) => {
          const id = Number(adjUserId);
          await adminApi.grantCredits(id, { amount, reason });
          setGrantOpen(false);
          await refreshBalancePreview();
        }}
      />
      <CreditAdjustmentModal
        open={deductOpen}
        mode="deduct"
        onClose={() => setDeductOpen(false)}
        onSubmit={async (amount, reason) => {
          const id = Number(adjUserId);
          await adminApi.deductCredits(id, { amount, reason });
          setDeductOpen(false);
          await refreshBalancePreview();
        }}
      />
    </div>
  );
}
