import { ReactNode } from 'react';
import { useAdminLocale } from '../../contexts/AdminLocaleContext';

export function AdminConfirmModal({
  open,
  title,
  description,
  confirmLabel,
  danger,
  onCancel,
  onConfirm,
  children,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  children?: ReactNode;
}) {
  const { t } = useAdminLocale();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-md rounded-t-2xl bg-white shadow-xl sm:rounded-xl">
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-gray-200 sm:hidden" />
        <div className="border-b border-gray-100 px-4 py-4 sm:px-5">
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          {description ? <p className="mt-1 text-sm text-gray-600">{description}</p> : null}
        </div>
        <div className="max-h-[55vh] overflow-y-auto px-4 py-4 sm:max-h-none sm:px-5">{children}</div>
        <div className="flex flex-col-reverse gap-2 border-t border-gray-100 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 sm:flex-row sm:justify-end sm:px-5 sm:pb-3">
          <button type="button" onClick={onCancel} className="h-11 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 sm:h-auto">
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`h-11 rounded-lg px-4 py-2 text-xs font-semibold text-white sm:h-auto ${danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
