import { useNavigate } from 'react-router-dom';
import { ShortDramaLayout } from '../short-drama/components/ShortDramaLayout';

export function BillingPage() {
  const navigate = useNavigate();

  return (
    <ShortDramaLayout headerMode="landing">
      <div className="min-h-screen bg-[#F7F8FA] px-6 py-10">
        <div className="mx-auto max-w-[1100px]">
          <h1 className="text-2xl font-black text-[#1D1D1F]">账单</h1>
          <p className="mt-2 text-[14px] text-[#6E6E73]">查看订阅状态、额度与账单记录。</p>

          <div className="mt-6 grid grid-cols-1 gap-4">
            <section className="rounded-2xl border border-[#EAEAEA] bg-white p-6 shadow-sm">
              <h2 className="text-[16px] font-bold text-[#1D1D1F]">当前订阅</h2>
              <div className="mt-4 space-y-2 text-[14px] text-[#444444]">
                <p>当前计划：Free</p>
                <p>状态：正常</p>
                <p>续费日期：-</p>
                <p>生成额度：暂未接入</p>
              </div>
            </section>

            <section className="rounded-2xl border border-[#EAEAEA] bg-white p-6 shadow-sm">
              <h2 className="text-[16px] font-bold text-[#1D1D1F]">账单记录</h2>
              <p className="mt-4 text-[14px] text-[#6E6E73]">暂无账单记录</p>
            </section>

            <section className="rounded-2xl border border-[#EAEAEA] bg-white p-6 shadow-sm">
              <h2 className="text-[16px] font-bold text-[#1D1D1F]">说明</h2>
              <p className="mt-4 text-[14px] text-[#444444]">
                支付与订阅功能暂未开放，后续会在这里展示账单和额度消耗记录。
              </p>
            </section>
          </div>

          <button
            type="button"
            onClick={() => navigate('/short-drama/projects')}
            className="mt-6 rounded-lg bg-[#1D1D1F] px-4 py-2 text-[13px] font-semibold text-white"
          >
            返回项目管理
          </button>
        </div>
      </div>
    </ShortDramaLayout>
  );
}
