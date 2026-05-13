import { useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { getBillingOrder } from '../../api/billingApi';

const POLL_MS = 2000;
const MAX_POLLS = 60;

type WechatNativePayModalProps = {
  open: boolean;
  /** 正在向后端创建订单 */
  creating: boolean;
  errorMessage: string | null;
  codeUrl: string | null;
  outTradeNo: string | null;
  amountLabel: string;
  titleLine: string;
  onClose: () => void;
  onRetry: () => void;
  onPaid: (outTradeNo: string) => void;
};

export function WechatNativePayModal({
  open,
  creating,
  errorMessage,
  codeUrl,
  outTradeNo,
  amountLabel,
  titleLine,
  onClose,
  onRetry,
  onPaid,
}: WechatNativePayModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [pollPhase, setPollPhase] = useState<'idle' | 'polling' | 'timeout'>('idle');
  const [pollCount, setPollCount] = useState(0);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!open) {
      setQrDataUrl(null);
      setQrError(null);
      setPollPhase('idle');
      setPollCount(0);
      return;
    }
    cancelledRef.current = false;
    if (!codeUrl) {
      setQrDataUrl(null);
      setQrError(null);
      return;
    }
    let alive = true;
    setQrError(null);
    QRCode.toDataURL(codeUrl, { width: 220, margin: 2, errorCorrectionLevel: 'M' })
      .then((url) => {
        if (alive) setQrDataUrl(url);
      })
      .catch(() => {
        if (alive) setQrError('二维码生成失败，请重试');
      });
    return () => {
      alive = false;
    };
  }, [open, codeUrl]);

  const tick = useCallback(async () => {
    if (!outTradeNo || cancelledRef.current) return false;
    try {
      const order = await getBillingOrder(outTradeNo);
      if (cancelledRef.current) return false;
      if (order.status === 'paid') {
        onPaid(outTradeNo);
        return true;
      }
    } catch {
      /* 单次失败继续轮询 */
    }
    return false;
  }, [outTradeNo, onPaid]);

  useEffect(() => {
    if (!open || !codeUrl || !outTradeNo || creating || errorMessage) {
      return;
    }
    cancelledRef.current = false;
    setPollPhase('polling');
    setPollCount(0);
    let count = 0;
    let timer: number | undefined;

    const step = async () => {
      if (cancelledRef.current) return;
      count += 1;
      if (!cancelledRef.current) setPollCount(count);
      const done = await tick();
      if (cancelledRef.current) return;
      if (done) return;
      if (count >= MAX_POLLS) {
        if (!cancelledRef.current) setPollPhase('timeout');
        return;
      }
      timer = window.setTimeout(() => void step(), POLL_MS);
    };

    void step();

    return () => {
      cancelledRef.current = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [open, codeUrl, outTradeNo, creating, errorMessage, tick]);

  if (!open) return null;

  const showTimeout = pollPhase === 'timeout';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4 backdrop-blur-[2px]">
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-[#EAEAEA] bg-white shadow-[0_24px_64px_rgba(15,23,42,0.18)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wechat-pay-modal-title"
      >
        <div className="border-b border-[#F0F0F0] px-6 py-4">
          <h2 id="wechat-pay-modal-title" className="text-[17px] font-bold text-[#1D1D1F]">
            微信支付
          </h2>
        </div>
        <div className="space-y-4 px-6 py-5">
          {creating ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <span className="inline-block h-10 w-10 animate-spin rounded-full border-2 border-[#EAEAEA] border-t-[#07C160]" />
              <p className="text-[13px] text-[#6E6E73]">正在创建微信订单…</p>
            </div>
          ) : errorMessage ? (
            <div className="space-y-3">
              <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-[12px] text-red-600">{errorMessage}</div>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={onRetry}
                  className="w-full rounded-xl bg-[#1D1D1F] px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#374151]"
                >
                  重新发起支付
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
          ) : (
            <>
              <p className="text-center text-[14px] font-medium text-[#1D1D1F]">请使用微信扫一扫完成支付</p>

              <div className="flex justify-center rounded-xl bg-white p-3">
                {qrError ? (
                  <p className="text-[12px] text-red-600">{qrError}</p>
                ) : qrDataUrl ? (
                  <img src={qrDataUrl} alt="微信支付二维码" className="h-[220px] w-[220px] object-contain" />
                ) : (
                  <div className="flex h-[220px] w-[220px] items-center justify-center text-[12px] text-[#8E8E93]">
                    正在生成二维码…
                  </div>
                )}
              </div>

              <div className="rounded-xl bg-[#F7F8FA] px-4 py-3 text-[13px] text-[#444444]">
                <p>
                  <span className="text-[#8E8E93]">金额</span>{' '}
                  <span className="font-semibold text-[#1D1D1F]">{amountLabel}</span>
                </p>
                <p className="mt-1">
                  <span className="text-[#8E8E93]">套餐</span> {titleLine}
                </p>
                {outTradeNo ? (
                  <p className="mt-1 break-all font-mono text-[12px]">
                    <span className="text-[#8E8E93]">订单号</span> {outTradeNo}
                  </p>
                ) : null}
                {pollPhase === 'polling' && !showTimeout ? (
                  <p className="mt-2 text-[11px] text-[#8E8E93]">
                    等待支付确认… {pollCount}/{MAX_POLLS}
                  </p>
                ) : null}
              </div>

              {showTimeout ? (
                <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-[12px] text-amber-900">
                  支付结果确认中，请稍后到账单中心查看
                </div>
              ) : null}

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={onRetry}
                  className="w-full rounded-xl bg-[#1D1D1F] px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#374151]"
                >
                  重新发起支付
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full rounded-xl border border-[#EAEAEA] bg-white px-4 py-2.5 text-[13px] font-medium text-[#444444] transition-colors hover:bg-[#F7F8FA]"
                >
                  返回结算页
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
