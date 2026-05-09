import { Link, useSearchParams } from 'react-router-dom';
import { SUBSCRIPTION_PLANS } from '../../constants/billing';
import { ShortDramaLayout } from '../short-drama/components/ShortDramaLayout';

export function BillingSuccessPage() {
  const [params] = useSearchParams();
  const plan = params.get('plan') || 'standard';
  const key = plan === 'basic' || plan === 'pro' ? plan : 'standard';
  const name = SUBSCRIPTION_PLANS[key].name;

  return (
    <ShortDramaLayout headerMode="landing">
      <div className="min-h-screen bg-[#F7F8FA] px-6 py-16">
        <div className="mx-auto max-w-lg rounded-2xl border border-[#EAEAEA] bg-white p-10 text-center shadow-sm">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[rgba(34,197,94,0.12)] text-3xl text-[#16A34A]">
            ✓
          </div>
          <h1 className="text-2xl font-black text-[#1D1D1F]">订阅成功</h1>
          <p className="mt-4 text-[14px] text-[#444444]">
            套餐：<span className="font-semibold">{name}</span>
          </p>
          <p className="mt-2 text-[14px] text-[#444444]">
            已发放积分：<span className="font-semibold">{SUBSCRIPTION_PLANS[key].creditsPerMonth}</span>（演示）
          </p>
          <p className="mt-2 text-[14px] text-[#6E6E73]">当前积分余额：--</p>
          <p className="mt-2 text-[13px] text-[#6E6E73]">生效时间：立即生效</p>
          <p className="mt-1 text-[13px] text-[#6E6E73]">下次续费时间：--</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              to="/short-drama/create"
              className="rounded-xl bg-[#1D1D1F] px-6 py-3 text-[14px] font-semibold text-white hover:bg-[#374151]"
            >
              开始创建内容
            </Link>
            <Link
              to="/billing"
              className="rounded-xl border border-[#EAEAEA] bg-white px-6 py-3 text-[14px] font-semibold text-[#444444] hover:bg-[#F7F8FA]"
            >
              查看账单
            </Link>
          </div>
        </div>
      </div>
    </ShortDramaLayout>
  );
}
