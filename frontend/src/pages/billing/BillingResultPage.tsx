import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getBillingOrder } from '../../api/billingApi';
import { useAuth } from '../../contexts/AuthContext';
import { ShortDramaLayout } from '../short-drama/components/ShortDramaLayout';

type UiPhase = 'loading' | 'polling' | 'paid' | 'pending_timeout' | 'closed' | 'error';

const POLL_MS = 2000;
const MAX_POLLS = 10;

export function BillingResultPage() {
  const [searchParams] = useSearchParams();
  const { refreshUser } = useAuth();
  const outTradeNo = useMemo(() => (searchParams.get('out_trade_no') || '').trim(), [searchParams]);

  const [phase, setPhase] = useState<UiPhase>('loading');
  const [message, setMessage] = useState<string | null>(null);
  const [pollCount, setPollCount] = useState(0);

  const loadOnce = useCallback(async () => {
    const order = await getBillingOrder(outTradeNo);
    if (order.status === 'paid') {
      setPhase('paid');
      await refreshUser().catch(() => {});
      return true;
    }
    if (order.status === 'failed' || order.status === 'closed' || order.status === 'cancelled') {
      setPhase('closed');
      setMessage('支付未完成或已关闭');
      return true;
    }
    return false;
  }, [outTradeNo, refreshUser]);

  useEffect(() => {
    if (!outTradeNo) {
      setPhase('error');
      setMessage('缺少订单号，请从账单中心查看支付记录。');
      return;
    }

    let cancelled = false;
    let timer: number | undefined;

    const run = async () => {
      try {
        const done = await loadOnce();
        if (cancelled) return;
        if (done) return;

        setPhase('polling');
        let count = 0;
        const tick = async () => {
          if (cancelled) return;
          count += 1;
          setPollCount(count);
          try {
            const finished = await loadOnce();
            if (cancelled) return;
            if (finished) return;
            if (count >= MAX_POLLS) {
              setPhase('pending_timeout');
              setMessage('支付结果确认中，请稍后到账单中心查看。');
              return;
            }
            timer = window.setTimeout(tick, POLL_MS);
          } catch (e) {
            if (cancelled) return;
            setPhase('error');
            setMessage(e instanceof Error ? e.message : '查询订单失败');
          }
        };
        timer = window.setTimeout(tick, POLL_MS);
      } catch (e) {
        if (cancelled) return;
        setPhase('error');
        setMessage(e instanceof Error ? e.message : '查询订单失败');
      }
    };

    void run();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [outTradeNo, loadOnce]);

  const title =
    phase === 'paid'
      ? '支付成功'
      : phase === 'closed'
        ? '支付未完成'
        : phase === 'pending_timeout'
          ? '确认中'
          : phase === 'error'
            ? '无法确认'
            : '正在确认支付结果';

  const subtitle =
    phase === 'paid'
      ? '订阅已生效，积分已按套餐发放。'
      : phase === 'polling' || phase === 'loading'
        ? '支付已提交，正在等待支付宝确认（以后台异步通知为准）。'
        : message;

  return (
    <ShortDramaLayout headerMode="landing">
      <div className="min-h-screen bg-[#F7F8FA] px-6 py-16">
        <div className="mx-auto max-w-lg rounded-2xl border border-[#EAEAEA] bg-white p-10 text-center shadow-sm">
          {(phase === 'loading' || phase === 'polling') && (
            <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center">
              <span className="inline-block h-10 w-10 animate-spin rounded-full border-2 border-[#EAEAEA] border-t-[#7B61FF]" />
            </div>
          )}
          {phase === 'paid' && (
            <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-[#ECFDF5] text-[#16A34A] text-2xl font-bold">
              ✓
            </div>
          )}
          {(phase === 'closed' || phase === 'error' || phase === 'pending_timeout') && (
            <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-[#FEF3C7] text-[#D97706] text-xl font-bold">
              !
            </div>
          )}

          <h1 className="text-2xl font-black text-[#1D1D1F]">{title}</h1>
          {subtitle ? <p className="mt-4 text-[14px] leading-relaxed text-[#6E6E73]">{subtitle}</p> : null}
          {phase === 'polling' ? (
            <p className="mt-2 text-[12px] text-[#8E8E93]">已轮询 {pollCount} / {MAX_POLLS} 次</p>
          ) : null}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              to="/billing"
              className="rounded-xl bg-[#1D1D1F] px-6 py-3 text-[14px] font-semibold text-white hover:bg-[#374151]"
            >
              查看账单中心
            </Link>
            <Link
              to="/short-drama/projects"
              className="rounded-xl border border-[#EAEAEA] bg-[#F7F8FA] px-6 py-3 text-[14px] font-semibold text-[#444444] hover:bg-white"
            >
              进入项目管理
            </Link>
          </div>
        </div>
      </div>
    </ShortDramaLayout>
  );
}
