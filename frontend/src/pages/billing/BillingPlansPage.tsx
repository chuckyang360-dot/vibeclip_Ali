import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShortDramaLayout } from '../short-drama/components/ShortDramaLayout';
import type { BillingPeriod, PlanKey } from '../../constants/billing';
import { SUBSCRIPTION_PLANS, yearlyTotals } from '../../constants/billing';

const FAQ = [
  {
    q: '积分可以用来做什么？',
    a: '积分可用于内容理解、脚本与分镜生成、图片与视频片段生成、高清导出等。不同工作流会复用同一套底层能力。',
  },
  {
    q: '我是个人 IP，每次都要重新生成自己的人物吗？',
    a: '可在工作流中沉淀资产与模板，减少重复配置。具体能力将随版本迭代完善。',
  },
  { q: '积分不够怎么办？', a: '可前往购买积分包或升级更高档位订阅，获得更多月度积分。' },
  {
    q: '生成失败会扣积分吗？',
    a: '若失败由系统或服务商原因导致，积分会自动退回。生成成功但主观不满意，一般不退回积分。',
  },
  { q: '可以取消订阅吗？', a: '可在账单页面管理订阅。具体规则以《订阅条款》为准。' },
];

const SCENARIOS = [
  { icon: 'ri-shopping-bag-3-line', title: '商品营销视频', desc: '商品卖点、痛点、场景化短剧、种草广告。' },
  { icon: 'ri-user-smile-line', title: '个人 IP 内容', desc: '固定人物资产，每期更新选题、脚本和视频内容。' },
  { icon: 'ri-book-open-line', title: '知识付费课程', desc: '课程大纲、知识点拆解、短视频切片、口播视频。' },
  { icon: 'ri-gallery-line', title: '图文转视频', desc: '将文章、笔记、图文素材转成短视频脚本和视频。' },
  { icon: 'ri-lightbulb-flash-line', title: '品牌广告创意', desc: '多版本广告脚本、场景资产和创意视频。' },
  { icon: 'ri-stack-line', title: '账号矩阵运营', desc: '批量生成不同选题、不同平台比例的内容。' },
];

const CREDIT_USAGE = [
  { label: '文本 / 链接理解', cost: '3 积分 / 次' },
  { label: '图片理解', cost: '5 积分 / 张' },
  { label: '脚本生成与解析', cost: '30 积分 / 次' },
  { label: '图片资产生成', cost: '10-15 积分 / 张' },
  { label: '视频片段生成', cost: '120 积分 / 条' },
  { label: '高清导出', cost: '20 积分 / 次' },
  { label: '普通视频合成', cost: '暂不扣积分' },
];

export function BillingPlansPage() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<BillingPeriod>('monthly');
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(0);

  const checkoutHref = (plan: Exclude<PlanKey, 'free'>) =>
    `/billing/checkout?plan=${plan}&period=${period}`;

  return (
    <ShortDramaLayout headerMode="landing">
      <div className="min-h-screen bg-[#F7F8FA] px-6 py-10 pb-20">
        <div className="mx-auto max-w-[1200px]">
          <div className="text-center pt-8 pb-6">
            <h1 className="text-[28px] md:text-[34px] font-black leading-tight text-[#1D1D1F]">
              选择合适的计划，持续生产高质量内容
            </h1>
            <p className="text-[14px] md:text-[15px] mt-4 max-w-[640px] mx-auto leading-relaxed text-[#8E8E93]">
              订阅套餐每月发放积分，可用于内容理解、脚本生成、图片资产生成和视频生成，适配商品营销、个人 IP、知识付费和短视频运营等场景。
            </p>
          </div>

          <div className="flex justify-center mb-10">
            <div className="inline-flex items-center rounded-full p-1 border border-[#EAEAEA] bg-[#F0F0F5]">
              <button
                type="button"
                onClick={() => setPeriod('monthly')}
                className="px-5 py-2 text-[13.5px] font-medium rounded-full transition-all duration-200"
                style={{
                  background: period === 'monthly' ? '#ffffff' : 'transparent',
                  color: period === 'monthly' ? '#1D1D1F' : '#8E8E93',
                  boxShadow: period === 'monthly' ? '0 1px 4px rgba(0,0,0,0.06)' : 'none',
                }}
              >
                连续包月
              </button>
              <button
                type="button"
                onClick={() => setPeriod('yearly')}
                className="px-5 py-2 text-[13.5px] font-medium rounded-full transition-all duration-200"
                style={{
                  background: period === 'yearly' ? '#ffffff' : 'transparent',
                  color: period === 'yearly' ? '#1D1D1F' : '#8E8E93',
                  boxShadow: period === 'yearly' ? '0 1px 4px rgba(0,0,0,0.06)' : 'none',
                }}
              >
                连续包年 8 折
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 pb-20">
            <PlanCard
              name="免费版"
              price="永久免费"
              period=""
              credits="100"
              target="体验完整创作流程"
              features={[
                '每月 100 积分',
                '可创建 3 个项目',
                '可体验内容理解与脚本生成',
                '可少量生成图片资产和视频片段',
                '支持基础工作流模板',
                '导出带水印',
                '普通生成队列',
              ]}
              buttonText="当前方案"
              current
              badge="免费版"
            />

            {(['basic', 'standard', 'pro'] as const).map((key) => {
              const plan = SUBSCRIPTION_PLANS[key];
              const yearly = yearlyTotals(plan.monthlyPrice);
              const isRec = key === 'standard';
              const isPro = key === 'pro';
              const price = period === 'monthly' ? `¥${plan.monthlyPrice}` : `¥${yearly.payable}`;
              const periodText = period === 'monthly' ? '/ 月' : '/ 年';
              const yearlyHint = period === 'yearly' ? `原价 ¥${yearly.subtotal}，已省 ¥${yearly.saved}` : undefined;
              const target =
                key === 'basic'
                  ? '个人创作者、轻量内容生产、小商家测试'
                  : key === 'standard'
                    ? '个人 IP、知识付费创作者、内容团队、电商商家稳定生产内容'
                    : '账号矩阵、多 SKU 商家、知识付费团队、代运营和高频内容生产者';
              const features =
                key === 'basic'
                  ? [
                      '每月 1,000 积分',
                      '可创建 30 个项目',
                      '内容理解与脚本生成开放',
                      '图片资产生成开放',
                      '视频片段生成开放',
                      '去除导出水印',
                      '支持常用工作流模板',
                      '普通生成队列',
                    ]
                  : key === 'standard'
                    ? [
                        '每月 3,000 积分',
                        '可创建 150 个项目',
                        '内容理解、脚本生成、分镜解析开放',
                        '图片资产生成高额度',
                        '视频片段生成高额度',
                        '高清导出',
                        '去除导出水印',
                        '多平台比例适配',
                        '支持全部核心工作流模板',
                        '较高优先生成队列',
                      ]
                    : [
                        '每月 8,000 积分',
                        '项目数量高额度或不限',
                        '内容理解高额度',
                        '脚本与分镜生成高额度',
                        '图片资产生成高额度',
                        '视频片段生成高额度',
                        '高清导出',
                        '去除导出水印',
                        '多平台比例适配',
                        '支持批量生成',
                        '更大资产库容量',
                        '最高优先生成队列',
                        '新功能优先体验',
                      ];

              return (
                <PlanCard
                  key={key}
                  name={plan.name}
                  price={price}
                  period={periodText}
                  credits={`${plan.creditsPerMonth.toLocaleString()}`}
                  target={target}
                  features={features}
                  buttonText={`订阅${plan.name}`}
                  onSelect={() => navigate(checkoutHref(key))}
                  badge={isRec ? '推荐' : isPro ? '高级创作' : undefined}
                  recommended={isRec}
                  pro={isPro}
                  yearlyHint={yearlyHint}
                />
              );
            })}
          </div>

          <section className="pb-20">
            <div className="text-center mb-10">
              <h2 className="text-[22px] md:text-[26px] font-bold text-[#1D1D1F]">积分如何消耗？</h2>
              <p className="text-[13.5px] mt-2 text-[#8E8E93]">不同工作流复用同一套底层能力，按实际用量扣费</p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="rounded-2xl border border-[#EAEAEA] bg-white p-6">
                <h3 className="text-[14px] font-bold text-[#1D1D1F] flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-[#F5F3FF] flex items-center justify-center">
                    <i className="ri-coin-line text-[#7C3AED] text-[14px]" />
                  </span>
                  基础消耗明细
                </h3>
                <div className="mt-4 space-y-2.5">
                  {CREDIT_USAGE.map((row) => (
                    <div key={row.label} className="flex items-center justify-between rounded-xl px-3 py-2.5 bg-[#FAFAFA] border border-[#F0F0F5]">
                      <span className="text-[13px] text-[#444444]">{row.label}</span>
                      <span className="text-[13px] font-semibold text-[#7C3AED]">{row.cost}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-5">
                <div className="rounded-2xl border border-[#EAEAEA] bg-white p-6">
                  <h3 className="text-[14px] font-bold text-[#1D1D1F] flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-[#F5F3FF] flex items-center justify-center">
                      <i className="ri-lightbulb-line text-[#7C3AED] text-[14px]" />
                    </span>
                    场景与能力复用
                  </h3>
                  <div className="mt-4 space-y-2.5 text-[12.5px] text-[#6E6E73]">
                    <p><span className="text-[#444444] font-medium">商品营销：</span>内容理解对应商品理解与卖点提取。</p>
                    <p><span className="text-[#444444] font-medium">个人 IP：</span>内容理解对应选题、口播稿和知识点理解。</p>
                    <p><span className="text-[#444444] font-medium">知识付费：</span>内容理解对应课程大纲与知识结构理解。</p>
                  </div>
                </div>
                <div className="rounded-2xl border border-[#EAEAEA] bg-white p-6">
                  <h3 className="text-[14px] font-bold text-[#1D1D1F] flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-[#F5F3FF] flex items-center justify-center">
                      <i className="ri-shield-check-line text-[#7C3AED] text-[14px]" />
                    </span>
                    失败退回规则
                  </h3>
                  <p className="mt-4 text-[12.5px] leading-relaxed text-[#6E6E73]">
                    如果生成失败是系统或服务商原因，积分会自动退回。生成成功但用户主观不满意，不退回积分。
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="pb-20">
            <div className="text-center mb-10">
              <h2 className="text-[22px] md:text-[26px] font-bold text-[#1D1D1F]">适配多种内容场景</h2>
              <p className="text-[13.5px] mt-2 text-[#8E8E93]">同一套平台能力，灵活适配不同创作需求</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {SCENARIOS.map((wf) => (
                <div key={wf.title} className="rounded-2xl border border-[#EAEAEA] bg-white p-5 transition-all duration-200 hover:border-[#C4B5FD] hover:shadow-[0_4px_16px_rgba(124,58,237,0.06)]">
                  <div className="w-10 h-10 rounded-xl bg-[#F5F3FF] flex items-center justify-center mb-4">
                    <i className={`${wf.icon} text-[18px] text-[#7C3AED]`} />
                  </div>
                  <h3 className="text-[14.5px] font-bold text-[#1D1D1F] mb-1.5">{wf.title}</h3>
                  <p className="text-[12.5px] leading-relaxed text-[#6E6E73]">{wf.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="pb-12">
            <div className="text-center mb-10">
              <h2 className="text-[22px] md:text-[26px] font-bold text-[#1D1D1F]">常见问题</h2>
            </div>
            <div className="max-w-[760px] mx-auto space-y-3">
              {FAQ.map((faq, idx) => {
                const isOpen = openFaqIdx === idx;
                return (
                  <div key={faq.q} className="rounded-xl overflow-hidden bg-white border transition-all duration-200" style={{ borderColor: isOpen ? '#C4B5FD' : '#EAEAEA' }}>
                    <button
                      type="button"
                      onClick={() => setOpenFaqIdx(isOpen ? null : idx)}
                      className="w-full flex items-center justify-between px-5 py-4 text-left"
                    >
                      <span className="text-[13.5px] font-semibold text-[#1D1D1F]">{faq.q}</span>
                      <i className={`ri-arrow-down-s-line text-[16px] text-[#8E8E93] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isOpen ? (
                      <div className="px-5 pb-4">
                        <p className="text-[13px] leading-relaxed text-[#6E6E73]">{faq.a}</p>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <p className="mt-10 text-center text-[12px] text-[#AEAEB2]">
              如需帮助请查看{' '}
              <Link to="/faq" className="text-[#7B61FF] hover:underline">
                常见问题
              </Link>
              或{' '}
              <Link to="/help" className="text-[#7B61FF] hover:underline">
                帮助文档
              </Link>
              。
            </p>
          </section>
        </div>
      </div>
    </ShortDramaLayout>
  );
}

type PlanCardProps = {
  name: string;
  price: string;
  period: string;
  credits: string;
  target: string;
  features: string[];
  buttonText: string;
  badge?: string;
  current?: boolean;
  recommended?: boolean;
  pro?: boolean;
  yearlyHint?: string;
  onSelect?: () => void;
};

function PlanCard({
  name,
  price,
  period,
  credits,
  target,
  features,
  buttonText,
  badge,
  current,
  recommended,
  pro,
  yearlyHint,
  onSelect,
}: PlanCardProps) {
  return (
    <div
      className="rounded-2xl overflow-hidden relative flex flex-col h-full"
      style={{
        background: '#ffffff',
        border: `2px solid ${recommended ? '#7C3AED' : '#EAEAEA'}`,
        boxShadow: recommended ? '0 8px 28px rgba(124,58,237,0.14)' : '0 2px 12px rgba(0,0,0,0.04)',
      }}
    >
      {badge ? (
        <div
          className="absolute top-4 right-4 px-2.5 py-1 rounded-full text-[10px] font-bold"
          style={{
            background: recommended ? '#7C3AED' : pro ? '#1D1D1F' : '#F5F5F7',
            color: recommended || pro ? '#ffffff' : '#444444',
          }}
        >
          {badge}
        </div>
      ) : null}

      <div
        className="px-6 pt-6 pb-5"
        style={{ background: recommended ? 'linear-gradient(180deg,#FAF5FF 0%,#FFFFFF 100%)' : '#FAFAFA' }}
      >
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-[#F5F5F7] text-[#6E6E73]">套餐</span>
          {current ? (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#16A34A] text-white">当前方案</span>
          ) : null}
        </div>
        <h3 className="text-[18px] font-bold text-[#1D1D1F]">{name}</h3>
        <div className="mt-3 flex items-end gap-1.5">
          <span className="text-[32px] font-black" style={{ color: recommended ? '#7C3AED' : '#1D1D1F' }}>
            {price}
          </span>
          {period ? <span className="text-[13px] text-[#8E8E93] pb-1">{period}</span> : null}
        </div>
        <p className="text-[12px] mt-1 text-[#8E8E93] min-h-[18px]">{yearlyHint || ''}</p>
        <div className="mt-2 flex items-center gap-2">
          <span className="w-4 h-4 flex items-center justify-center">
            <i className="ri-coin-line text-[13px] text-[#7C3AED]" />
          </span>
          <span className="text-[13px] font-semibold text-[#7C3AED]">{credits} 积分 / 月</span>
        </div>
        <p className="text-[12px] mt-2 text-[#6E6E73] leading-relaxed">适合：{target}</p>
      </div>

      <div className="px-6 py-4 flex flex-col flex-1">
        <div className="space-y-2 flex-1">
          {features.map((f) => (
            <div key={f} className="flex items-start gap-2.5">
              <span className="w-4 h-4 mt-0.5 flex items-center justify-center shrink-0">
                <i className={`ri-check-line text-[13px] ${recommended ? 'text-[#7C3AED]' : 'text-[#8E8E93]'}`} />
              </span>
              <span className="text-[12.5px] leading-relaxed text-[#444444]">{f}</span>
            </div>
          ))}
        </div>
        <button
          type="button"
          disabled={!!current}
          onClick={onSelect}
          className="mt-6 w-full py-2.5 rounded-xl text-[13.5px] font-semibold transition-opacity duration-200"
          style={{
            background: current ? '#F5F5F7' : recommended ? '#7C3AED' : '#1D1D1F',
            color: current ? '#8E8E93' : '#ffffff',
            border: `1px solid ${current ? '#EAEAEA' : recommended ? '#7C3AED' : '#1D1D1F'}`,
            cursor: current ? 'not-allowed' : 'pointer',
          }}
        >
          {buttonText}
        </button>
      </div>
    </div>
  );
}
