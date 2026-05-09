import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminApi } from '../../api/adminApi';
import { AdminDataTable } from '../../components/admin/AdminDataTable';
import { AdminEmptyState } from '../../components/admin/AdminEmptyState';
import { AdminErrorState } from '../../components/admin/AdminErrorState';
import { AdminFilterBar } from '../../components/admin/AdminFilterBar';
import { AdminLoadingState } from '../../components/admin/AdminLoadingState';
import { AdminTabs } from '../../components/admin/AdminTabs';
import { CreditAdjustmentModal } from '../../components/admin/CreditAdjustmentModal';
import { useAdminLocale } from '../../contexts/AdminLocaleContext';
import { formatTransactionType } from '../../i18n/adminI18n';

export function AdminCreditsPage() {
  const { locale, t } = useAdminLocale();
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
          { id: 'accounts', label: t('creditAccounts') },
          { id: 'transactions', label: t('creditTransactions') },
          { id: 'manual', label: t('manualAdjustment') },
        ]}
      />

      {tab === 'accounts' ? (
        <>
          <AdminFilterBar>
            <label className="flex flex-col text-xs text-gray-600">
              {t('search')}
              <input
                className="mt-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900"
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
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
            >
              {t('apply')}
            </button>
          </AdminFilterBar>
          {loading ? <AdminLoadingState /> : null}
          {error ? <AdminErrorState message={error} onRetry={loadAccounts} /> : null}
          {!loading && !error && accounts.length === 0 ? <AdminEmptyState title={locale === 'zh' ? '暂无积分账户' : 'No credit accounts'} /> : null}
          {!loading && !error && accounts.length > 0 ? (
            <>
              <AdminDataTable headers={[t('user'), 'Email', t('currentBalance'), t('totalGranted'), t('totalConsumed'), t('totalRefunded'), t('updatedAt')]}>
                {accounts.map((row, i) => {
                  const u = row.user as Record<string, unknown> | undefined;
                  return (
                    <tr key={i}>
                      <td className="px-4 py-3 text-xs">{String(u?.username || u?.user_id)}</td>
                      <td className="px-4 py-3 text-xs">{String(row.email)}</td>
                      <td className="px-4 py-3 text-sm">{String(row.current_balance)}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{String(row.total_granted)}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{String(row.total_consumed)}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{String(row.total_refunded)}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{String(row.updated_at || '')}</td>
                    </tr>
                  );
                })}
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
        </>
      ) : null}

      {tab === 'transactions' ? (
        <>
          <AdminFilterBar>
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
              {t('action')}
              <input
                className="mt-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900"
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
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
            >
              {t('apply')}
            </button>
          </AdminFilterBar>
          {loading ? <AdminLoadingState /> : null}
          {error ? <AdminErrorState message={error} onRetry={loadTxns} /> : null}
          {!loading && !error && txns.length === 0 ? <AdminEmptyState title={locale === 'zh' ? '暂无积分流水' : 'No transactions'} /> : null}
          {!loading && !error && txns.length > 0 ? (
            <>
              <AdminDataTable headers={['ID', t('user'), t('action'), t('amount'), locale === 'zh' ? '余额变化' : 'Balances', t('operator'), t('reason'), t('createdAt')]}>
                {txns.map((t) => {
                  const u = t.user as Record<string, unknown> | undefined;
                  const op = t.operator as Record<string, unknown> | undefined;
                  return (
                    <tr key={String(t.transaction_id)}>
                      <td className="px-4 py-3 text-xs">{String(t.transaction_id)}</td>
                      <td className="px-4 py-3 text-xs">{String(u?.email || u?.user_id)}</td>
                      <td className="px-4 py-3 text-xs">{formatTransactionType(locale, t.type)}</td>
                      <td className="px-4 py-3 text-sm">{String(t.amount)}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {String(t.balance_before)} → {String(t.balance_after)}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {String(op?.type || '')} {op?.admin_email ? `· ${String(op.admin_email)}` : ''}
                      </td>
                      <td className="max-w-xs truncate px-4 py-3 text-xs text-gray-500">{String(t.note || '')}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{String(t.created_at || '')}</td>
                    </tr>
                  );
                })}
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
        </>
      ) : null}

      {tab === 'manual' ? (
        <div className="max-w-xl space-y-4 rounded-lg border border-gray-200 bg-white p-6">
          <label className="block text-xs text-gray-600">
            User ID
            <input
              className="mt-1 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900"
              value={adjUserId}
              onChange={(e) => setAdjUserId(e.target.value)}
            />
          </label>
          <div className="text-sm text-gray-600">
            {t('currentBalance')}:{' '}
            <span className="font-semibold text-gray-900">{adjBalance == null ? '—' : String(adjBalance)}</span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setGrantOpen(true);
              }}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
            >
              {t('grant')}
            </button>
            <button
              type="button"
              onClick={() => {
                setDeductOpen(true);
              }}
              className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
            >
              {locale === 'zh' ? '扣减' : 'Deduct'}
            </button>
          </div>
          <p className="text-xs text-gray-500">Reason is required for all adjustments. Keys/tokens are never displayed.</p>
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
