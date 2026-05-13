import { Link } from 'react-router-dom';
import { ShortDramaLayout } from '../short-drama/components/ShortDramaLayout';

export function BillingProcessingPage() {
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
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              type="button"
              className="cursor-default rounded-xl border border-[#EAEAEA] bg-[#F7F8FA] px-6 py-3 text-[14px] font-semibold text-[#AEAEB2]"
              disabled
            >
              刷新状态
            </button>
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
