import { useNavigate } from 'react-router-dom';
import { CREDIT_PACKS } from '../../constants/billing';
import { ShortDramaLayout } from '../short-drama/components/ShortDramaLayout';

export function BillingCreditsPage() {
  const navigate = useNavigate();

  return (
    <ShortDramaLayout headerMode="landing">
      <div className="min-h-screen bg-[#F7F8FA] px-6 py-10">
        <div className="mx-auto max-w-[960px]">
          <h1 className="text-2xl font-black text-[#1D1D1F]">购买积分</h1>
          <p className="mt-2 text-[14px] text-[#6E6E73]">选择积分包，支付完成后积分将发放到账户（演示流程）。</p>

          <section className="mt-8 rounded-2xl border border-[#EAEAEA] bg-white p-6 shadow-sm">
            <p className="text-[14px] text-[#444444]">
              当前积分余额：<span className="font-semibold">--</span>
            </p>
          </section>

          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {CREDIT_PACKS.map((pack) => (
              <div
                key={pack.id}
                className="flex flex-col rounded-2xl border border-[#EAEAEA] bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <p className="text-[28px] font-black text-[#1D1D1F]">¥{pack.price}</p>
                <p className="mt-2 text-[15px] font-semibold text-[#444444]">{pack.points} 积分</p>
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
