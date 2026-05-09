import { Link, useSearchParams } from 'react-router-dom';
import { ShortDramaLayout } from '../short-drama/components/ShortDramaLayout';

const REASONS: Record<string, string> = {
  incomplete: '支付未完成',
  timeout: '订单超时',
  cancelled: '支付取消',
};

export function BillingFailedPage() {
  const [params] = useSearchParams();
  const code = params.get('reason') || 'incomplete';
  const reason = REASONS[code] || REASONS.incomplete;

  return (
    <ShortDramaLayout headerMode="landing">
      <div className="min-h-screen bg-[#F7F8FA] px-6 py-16">
        <div className="mx-auto max-w-lg rounded-2xl border border-[#EAEAEA] bg-white p-10 text-center shadow-sm">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[rgba(239,68,68,0.1)] text-3xl text-[#DC2626]">
            ×
          </div>
          <h1 className="text-2xl font-black text-[#1D1D1F]">支付失败</h1>
          <p className="mt-4 text-[14px] text-[#444444]">
            失败原因：<span className="font-semibold">{reason}</span>
          </p>
          <p className="mt-3 text-[13px] leading-relaxed text-[#6E6E73]">你的套餐和积分未发生变化。</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              to="/billing/checkout"
              className="rounded-xl bg-[#7B61FF] px-6 py-3 text-[14px] font-semibold text-white hover:bg-[#6B51EF]"
            >
              重新支付
            </Link>
            <Link
              to="/billing/plans"
              className="rounded-xl border border-[#EAEAEA] bg-white px-6 py-3 text-[14px] font-semibold text-[#444444] hover:bg-[#F7F8FA]"
            >
              返回套餐页
            </Link>
          </div>
        </div>
      </div>
    </ShortDramaLayout>
  );
}
