import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { getBillingOrder } from '../../api/billingApi';
import { ShortDramaLayout } from '../short-drama/components/ShortDramaLayout';

export function BillingProcessingPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const orderId = useMemo(() => {
    const raw = Number(searchParams.get('order_id') || 0);
    return Number.isFinite(raw) && raw > 0 ? raw : 0;
  }, [searchParams]);

  useEffect(() => {
    if (!orderId) {
      setError('缺少订单号，请返回结算页重新支付。');
      return;
    }
    let cancelled = false;
    let pollTimer: number | null = null;
    const timeoutAt = Date.now() + 2 * 60 * 1000;

    const poll = async () => {
      if (cancelled) return;
      try {
        const order = await getBillingOrder(orderId);
        if (cancelled) return;
        if (order.status === 'paid') {
          navigate(`/billing/success?plan=${encodeURIComponent(order.plan_code)}&order_id=${order.order_id}`, {
            replace: true,
          });
          return;
        }
        if (order.status === 'failed' || order.status === 'cancelled') {
          navigate(`/billing/failed?reason=${order.status}&order_id=${order.order_id}`, { replace: true });
          return;
        }
        if (Date.now() >= timeoutAt) {
          navigate(`/billing/failed?reason=timeout&order_id=${order.order_id}`, { replace: true });
          return;
        }
        pollTimer = window.setTimeout(poll, 3000);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : '查询订单状态失败');
      }
    };

    poll();
    return () => {
      cancelled = true;
      if (pollTimer) window.clearTimeout(pollTimer);
    };
  }, [navigate, orderId]);

  return (
    <ShortDramaLayout headerMode="landing">
      <div className="min-h-screen bg-[#F7F8FA] px-6 py-16">
        <div className="mx-auto max-w-lg rounded-2xl border border-[#EAEAEA] bg-white p-10 text-center shadow-sm">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center">
            <span className="inline-block h-10 w-10 animate-spin rounded-full border-2 border-[#EAEAEA] border-t-[#7B61FF]" />
          </div>
          <h1 className="text-2xl font-black text-[#1D1D1F]">支付处理中</h1>
          <p className="mt-4 text-[14px] leading-relaxed text-[#6E6E73]">我们正在确认支付结果，请稍候。</p>
          <p className="mt-2 text-[13px] leading-relaxed text-[#8E8E93]">
            如果长时间未更新，可前往账单页面查看订单状态。
          </p>
          {error ? (
            <p className="mt-3 text-[13px] leading-relaxed text-[#DC2626]">{error}</p>
          ) : null}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              to={`/billing/processing?order_id=${orderId}`}
              className="rounded-xl border border-[#EAEAEA] bg-[#F7F8FA] px-6 py-3 text-[14px] font-semibold text-[#444444] hover:bg-white"
            >
              刷新状态
            </Link>
            <Link
              to="/billing"
              className="rounded-xl bg-[#1D1D1F] px-6 py-3 text-[14px] font-semibold text-white hover:bg-[#374151]"
            >
              查看账单
            </Link>
          </div>
        </div>
      </div>
    </ShortDramaLayout>
  );
}
