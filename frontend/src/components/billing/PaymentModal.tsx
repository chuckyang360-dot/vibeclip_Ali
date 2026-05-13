export type PaymentMethod = 'alipay' | 'wechat';

type PaymentModalProps = {
  open: boolean;
  amountLabel: string;
  titleLine: string;
  loading: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onRetry: () => void;
};

export function PaymentModal({
  open,
  amountLabel,
  titleLine,
  loading,
  errorMessage,
  onClose,
  onRetry,
}: PaymentModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4 backdrop-blur-[2px]">
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-[#EAEAEA] bg-white shadow-[0_24px_64px_rgba(15,23,42,0.18)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pay-modal-title"
      >
        <div className="border-b border-[#F0F0F0] px-6 py-4">
          <h2 id="pay-modal-title" className="text-[17px] font-bold text-[#1D1D1F]">
            完成支付
          </h2>
        </div>
        <div className="space-y-4 px-6 py-5">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-semibold" style={{ color: '#1677FF' }}>
              支付宝
            </span>
            <span className="text-[13px] text-[#6E6E73]">正在创建订单并跳转收银台</span>
          </div>

          <div className="rounded-xl bg-[#F7F8FA] px-4 py-3 text-[13px] text-[#444444]">
            <p>
              <span className="text-[#8E8E93]">金额</span>{' '}
              <span className="font-semibold text-[#1D1D1F]">{amountLabel}</span>
            </p>
            <p className="mt-1">
              <span className="text-[#8E8E93]">套餐</span> {titleLine}
            </p>
            {loading ? (
              <p className="mt-2 text-[12px] font-medium text-[#7B61FF]">状态：正在创建订单...</p>
            ) : errorMessage ? (
              <p className="mt-2 text-[12px] font-medium text-[#DC2626]">状态：创建失败，请重试</p>
            ) : (
              <p className="mt-2 text-[12px] font-medium text-[#7B61FF]">状态：即将跳转支付宝</p>
            )}
          </div>

          {errorMessage ? (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-[12px] text-red-600">
              {errorMessage}
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={onRetry}
              disabled={loading}
              className="w-full rounded-xl bg-[#1D1D1F] px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#374151] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? '创建中...' : '重新发起支付'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-xl border border-[#EAEAEA] bg-white px-4 py-2.5 text-[13px] font-medium text-[#444444] transition-colors hover:bg-[#F7F8FA]"
            >
              返回结算页
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
