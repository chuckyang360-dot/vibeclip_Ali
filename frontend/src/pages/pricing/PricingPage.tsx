import { ShortDramaLayout } from '../short-drama/components/ShortDramaLayout';

const plans = [
  {
    name: 'Free',
    desc: '适合体验',
    points: ['项目数量：少量测试', '图片/视频生成：Mock 或有限额度'],
    action: '当前计划',
    disabled: true,
  },
  {
    name: 'Pro',
    desc: '适合个人卖家',
    points: ['更多项目', '更高生成额度', '优先任务队列'],
    action: '即将开放',
    disabled: true,
  },
  {
    name: 'Team',
    desc: '适合团队和商家',
    points: ['多成员协作', '团队项目管理', '定制额度'],
    action: '联系支持 / 即将开放',
    disabled: true,
  },
];

export function PricingPage() {
  return (
    <ShortDramaLayout headerMode="landing">
      <div className="min-h-screen bg-[#F7F8FA] px-6 py-10">
        <div className="mx-auto max-w-[1100px]">
          <h1 className="text-2xl font-black text-[#1D1D1F]">升级计划</h1>
          <p className="mt-2 text-[14px] text-[#6E6E73]">根据商品短剧生成需求选择合适的计划。</p>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            {plans.map((plan) => (
              <section key={plan.name} className="rounded-2xl border border-[#EAEAEA] bg-white p-6 shadow-sm">
                <h2 className="text-[18px] font-bold text-[#1D1D1F]">{plan.name}</h2>
                <p className="mt-1 text-[13px] text-[#6E6E73]">{plan.desc}</p>
                <ul className="mt-4 space-y-2 text-[14px] text-[#444444]">
                  {plan.points.map((point) => (
                    <li key={point}>- {point}</li>
                  ))}
                </ul>
                <button
                  type="button"
                  disabled={plan.disabled}
                  className="mt-5 w-full rounded-lg border border-[#EAEAEA] bg-[#F7F8FA] px-3 py-2 text-[13px] font-semibold text-[#6E6E73]"
                >
                  {plan.action}
                </button>
              </section>
            ))}
          </div>
        </div>
      </div>
    </ShortDramaLayout>
  );
}
