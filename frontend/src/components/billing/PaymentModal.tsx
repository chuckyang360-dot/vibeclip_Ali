import { useEffect, useState } from 'react';

export type PaymentMethod = 'alipay' | 'wechat';

type PaymentModalProps = {
  open: boolean;
  method: PaymentMethod;
  amountLabel: string;
  titleLine: string;
  onClose: () => void;
  onSwitchPayment: () => void;
  onCompletePay: () => void;
};

function formatMmSs(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function PaymentModal({
  open,
  method,
  amountLabel,
  titleLine,
  onClose,
  onSwitchPayment,
  onCompletePay,
}: PaymentModalProps) {
  const [left, setLeft] = useState(15 * 60);

  useEffect(() => {
    if (!open) {
      setLeft(15 * 60);
      return;
    }
    setLeft(15 * 60);
    const t = window.setInterval(() => {
      setLeft((x) => (x <= 0 ? 0 : x - 1));
    }, 1000);
    return () => window.clearInterval(t);
  }, [open]);

  if (!open) return null;

  const isAli = method === 'alipay';
  const brandColor = isAli ? '#1677FF' : '#07C160';
  const brandName = isAli ? '支付宝' : '微信支付';

  const handleCancel = () => {
    if (window.confirm('确定取消当前支付吗？')) onClose();
  };

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
            <span className="text-[14px] font-semibold" style={{ color: brandColor }}>
              {brandName}
            </span>
            <span className="text-[13px] text-[#6E6E73]">请使用{brandName}扫码完成支付</span>
          </div>

          <div
            className="flex aspect-square max-h-[200px] w-full max-w-[200px] mx-auto flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#E0E0E0] bg-[#F7F8FA] text-center"
            aria-hidden
          >
            <p className="text-[11px] font-medium uppercase tracking-wide text-[#AEAEB2]">QR Code Placeholder</p>
            <p className="mt-2 px-3 text-[12px] text-[#8E8E93]">二维码将在创建订单后生成</p>
          </div>

          <div className="rounded-xl bg-[#F7F8FA] px-4 py-3 text-[13px] text-[#444444]">
            <p>
              <span className="text-[#8E8E93]">金额</span> <span className="font-semibold text-[#1D1D1F]">{amountLabel}</span>
            </p>
            <p className="mt-1">
              <span className="text-[#8E8E93]">套餐</span> {titleLine}
            </p>
            <p className="mt-2 text-[12px] text-[#8E8E93]">订单将在 {formatMmSs(left)} 后失效</p>
            <p className="mt-1 text-[12px] font-medium text-[#7B61FF]">状态：等待支付...</p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={onCompletePay}
              className="flex-1 rounded-xl bg-[#1D1D1F] px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#374151]"
            >
              我已完成支付
            </button>
            <button
              type="button"
              onClick={() => {
                onSwitchPayment();
              }}
              className="flex-1 rounded-xl border border-[#EAEAEA] bg-white px-4 py-2.5 text-[13px] font-medium text-[#444444] transition-colors hover:bg-[#F7F8FA]"
            >
              更换支付方式
            </button>
          </div>
          <button
            type="button"
            onClick={handleCancel}
            className="w-full rounded-xl border border-red-100 bg-red-50/80 px-4 py-2.5 text-[13px] font-medium text-red-600 transition-colors hover:bg-red-50"
          >
            取消订单
          </button>
        </div>
      </div>
    </div>
  );
}
