import { useNavigate } from 'react-router-dom';
import { CREDIT_PACKS } from '../../constants/billing';
import { ShortDramaLayout } from '../short-drama/components/ShortDramaLayout';

export function BillingCreditsPage() {
  const navigate = useNavigate();

  return (
    <ShortDramaLayout headerMode="landing">
      <div className="min-h-screen bg-[#F7F8FA] px-4 py-7 md:px-6 md:py-10">
        <div className="mx-auto max-w-[960px]">
          <div className="rounded-[28px] bg-[#111111] p-5 text-white shadow-[0_16px_42px_rgba(15,23,42,0.16)] md:rounded-none md:bg-transparent md:p-0 md:text-[#1D1D1F] md:shadow-none">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/45 md:hidden">Credits</p>
            <h1 className="mt-2 text-[28px] font-black leading-tight md:mt-0 md:text-2xl">购买积分</h1>
            <p className="mt-3 text-[13px] leading-relaxed text-white/60 md:mt-2 md:text-[14px] md:text-[#6E6E73]">
              选择积分包，支付完成后积分将发放到账户（演示流程）。
            </p>
            <div className="mt-5 rounded-2xl bg-white/10 p-4 md:hidden">
              <p className="text-[12px] text-white/55">当前积分余额</p>
              <p className="mt-1 text-[24px] font-black">--</p>
            </div>
          </div>

          <section className="mt-8 hidden rounded-2xl border border-[#EAEAEA] bg-white p-6 shadow-sm md:block">
            <p className="text-[14px] text-[#444444]">
              当前积分余额：<span className="font-semibold">--</span>
            </p>
          </section>

          <div className="mb-3 mt-6 flex items-center justify-between md:hidden">
            <p className="text-[12px] font-semibold text-[#6E6E73]">左右滑动选择积分包</p>
            <span className="rounded-full bg-white px-2.5 py-1 text-[11px] text-[#8E8E93]">{CREDIT_PACKS.length} 个选项</span>
          </div>

          <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-4 md:mx-0 md:mt-8 md:grid md:grid-cols-2 md:gap-5 md:overflow-visible md:px-0 lg:grid-cols-4">
            {CREDIT_PACKS.map((pack) => (
              <div
                key={pack.id}
                className="flex min-w-[72vw] snap-center flex-col rounded-[22px] border border-[#EAEAEA] bg-white p-5 shadow-sm transition-shadow hover:shadow-md md:min-w-0 md:rounded-2xl md:p-6"
              >
                <p className="text-[28px] font-black text-[#1D1D1F]">¥{pack.price}</p>
                <p className="mt-2 text-[15px] font-semibold text-[#444444]">{pack.points} 积分</p>
                <p className="mt-2 text-[12px] text-[#8E8E93]">约 ¥{(pack.price / pack.points).toFixed(2)} / 积分</p>
                <button
                  type="button"
                  onClick={() => navigate(`/billing/checkout?type=credits&pack=${pack.id}`)}
                  className="mt-6 w-full rounded-xl bg-[#7B61FF] py-3 text-[13px] font-bold text-white hover:bg-[#6B51EF]"
                >
                  购买
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => navigate('/billing/plans')}
            className="mt-10 text-[13px] font-semibold text-[#7B61FF] hover:underline"
          >
            ← 返回升级计划
          </button>
        </div>
      </div>
    </ShortDramaLayout>
  );
}
