import { useState } from 'react';
import { AdminConfirmModal } from './AdminConfirmModal';

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
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setError(null);
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      setError('Enter a valid positive amount.');
      return;
    }
    if (!reason.trim()) {
      setError('Reason is required.');
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
      title={mode === 'grant' ? 'Grant credits' : 'Deduct credits'}
      description="All adjustments are audited. API keys are never shown in logs."
      confirmLabel={busy ? 'Submitting…' : 'Submit'}
      danger={mode === 'deduct'}
      onCancel={onClose}
      onConfirm={handleConfirm}
    >
      <div className="mt-4 space-y-3">
        <label className="block text-xs text-zinc-500">
          Amount
          <input
            type="number"
            min={1}
            className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <label className="block text-xs text-zinc-500">
          Reason
          <textarea
            className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        {error ? <p className="text-xs text-red-300">{error}</p> : null}
      </div>
    </AdminConfirmModal>
  );
}
