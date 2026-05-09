import { useState } from 'react';
import { AdminConfirmModal } from './AdminConfirmModal';
import { useAdminLocale } from '../../contexts/AdminLocaleContext';

export function CreditAdjustmentModal({
  open,
  mode,
  onClose,
  onSubmit,
}: {
  open: boolean;
  mode: 'grant' | 'deduct';
  onClose: () => void;
  onSubmit: (amount: number, reason: string) => Promise<void>;
}) {
  const { locale, t } = useAdminLocale();
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setError(null);
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      setError(locale === 'zh' ? '请输入有效的正数数量。' : 'Enter a valid positive amount.');
      return;
    }
    if (!reason.trim()) {
      setError(locale === 'zh' ? '原因为必填项。' : 'Reason is required.');
      return;
    }
    setBusy(true);
    try {
      await onSubmit(Math.floor(n), reason.trim());
      setAmount('');
      setReason('');
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminConfirmModal
      open={open}
      title={mode === 'grant' ? (locale === 'zh' ? '赠送积分' : 'Grant credits') : locale === 'zh' ? '扣减积分' : 'Deduct credits'}
      description={locale === 'zh' ? '所有调整都会记录审计日志。API 密钥不会显示。' : 'All adjustments are audited. API keys are never shown in logs.'}
      confirmLabel={busy ? (locale === 'zh' ? '提交中…' : 'Submitting…') : t('confirm')}
      danger={mode === 'deduct'}
      onCancel={onClose}
      onConfirm={handleConfirm}
    >
      <div className="mt-1 space-y-3">
        <label className="block text-xs text-gray-600">
          {t('amount')}
          <input
            type="number"
            min={1}
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <label className="block text-xs text-gray-600">
          {t('reason')}
          <textarea
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        {error ? <p className="text-xs text-rose-600">{error}</p> : null}
      </div>
    </AdminConfirmModal>
  );
}
