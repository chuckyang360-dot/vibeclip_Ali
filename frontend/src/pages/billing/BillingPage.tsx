import { useNavigate } from 'react-router-dom';
import { ShortDramaLayout } from '../short-drama/components/ShortDramaLayout';

export function BillingPage() {
  const navigate = useNavigate();
  const creditHistory = [
    { desc: '免费版月度赠送', change: '+100', date: '2026-05-01', type: 'bonus' as const },
    { desc: '创建项目', change: '-3', date: '2026-05-08', type: 'use' as const },
    { desc: '内容理解', change: '-5', date: '2026-05-08', type: 'use' as const },
    { desc: '图片资产生成', change: '-12', date: '2026-05-09', type: 'use' as const },
  ];

  return (
    <ShortDramaLayout headerMode="landing">
      <div className="min-h-screen bg-[#F7F8FA] px-6 py-10">
        <div className="mx-auto max-w-[960px]">
          <div className="mb-8">
            <h1 className="text-[26px] font-black text-[#1D1D1F]">账单中心</h1>
            <p className="mt-1 text-[13.5px] text-[#8E8E93]">查看订阅状态、积分记录与支付记录</p>
          </div>

          <div className="rounded-2xl overflow-hidden border border-[#EAEAEA] bg-white mb-6">
            <div className="px-6 py-4 border-b border-[#F0F0F5]">
              <h2 className="text-[14px] font-bold text-[#1D1D1F]">当前订阅</h2>
            </div>
            <div className="px-6 py-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[#F5F3FF]">
                  <i className="ri-vip-crown-line text-[20px] text-[#7C3AED]" />
                </div>
                <div>
                  <p className="text-[15px] font-bold text-[#1D1D1F]">免费版</p>
                  <p className="text-[12.5px] text-[#8E8E93]">每月 100 积分 · 基础视频生成</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[13px] text-[#6E6E73]">
                <p>下一个结算日：--</p>
                <p>当前积分余额：--</p>
                <p>订阅状态：未订阅</p>
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => navigate('/billing/plans')}
                  className="rounded-xl bg-[#7C3AED] px-4 py-2.5 text-[13px] font-semibold text-white"
                >
                  升级计划
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/billing/credits')}
                  className="rounded-xl border border-[#EAEAEA] bg-white px-4 py-2.5 text-[13px] font-semibold text-[#444444]"
                >
                  购买积分
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/account/settings')}
                  className="rounded-xl border border-[#EAEAEA] bg-white px-4 py-2.5 text-[13px] font-semibold text-[#444444]"
                >
                  账户设置
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl overflow-hidden border border-[#EAEAEA] bg-white mb-6">
            <div className="px-6 py-4 border-b border-[#F0F0F5]">
              <h2 className="text-[14px] font-bold text-[#1D1D1F]">积分记录</h2>
            </div>
            <div className="px-6 py-5">
              {creditHistory.map((row, idx) => (
                <div key={`${row.desc}-${idx}`} className="flex items-center justify-between py-3" style={{ borderBottom: idx < creditHistory.length - 1 ? '1px solid #F0F0F5' : 'none' }}>
                  <div>
                    <p className="text-[13.5px] text-[#1D1D1F]">{row.desc}</p>
                    <p className="text-[11.5px] text-[#8E8E93]">{row.date}</p>
                  </div>
                  <span className="text-[13.5px] font-bold" style={{ color: row.type === 'bonus' ? '#16A34A' : '#DC2626' }}>
                    {row.change}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl overflow-hidden border border-[#EAEAEA] bg-white mb-6">
            <div className="px-6 py-4 border-b border-[#F0F0F5]">
              <h2 className="text-[14px] font-bold text-[#1D1D1F]">最近订单 / 支付记录</h2>
            </div>
            <div className="px-6 py-10 text-center">
              <p className="text-[13.5px] font-medium text-[#8E8E93]">暂无订单</p>
              <p className="mt-1 text-[12px] text-[#C7C7CC]">当前为演示占位数据，不接入真实支付</p>
            </div>
          </div>
        </div>
      </div>
    </ShortDramaLayout>
  );
}
