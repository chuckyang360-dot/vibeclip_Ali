import { useState } from "react";
import { useNavigate } from "react-router-dom";
import UserDropdown from "@/components/feature/UserDropdown";

const navItems = [
  { label: "首页", href: "/" },
  { label: "流程", href: "/#workflow" },
  { label: "案例", href: "/#cases" },
  { label: "项目管理", href: "/projects" },
];



const monthlyPlans = [
  {
    name: "免费版",
    price: "永久免费",
    priceNum: 0,
    period: "",
    credits: "100",
    btnText: "当前套餐",
    current: true,
    target: "体验完整创作流程",
    features: [
      "每月 100 积分",
      "可创建 3 个项目",
      "可体验内容理解与脚本生成",
      "可少量生成图片资产和视频片段",
      "支持基础工作流模板",
      "导出带水印",
      "普通生成队列",
    ],
  },
  {
    name: "基础会员",
    price: "¥79",
    priceNum: 79,
    period: "/ 月",
    credits: "1,000",
    btnText: "订阅基础会员",
    current: false,
    target: "个人创作者、轻量内容生产、小商家测试",
    features: [
      "每月 1,000 积分",
      "可创建 30 个项目",
      "内容理解与脚本生成开放",
      "图片资产生成开放",
      "视频片段生成开放",
      "去除导出水印",
      "支持常用工作流模板",
      "普通生成队列",
    ],
  },
  {
    name: "标准会员",
    price: "¥209",
    priceNum: 209,
    period: "/ 月",
    credits: "3,000",
    btnText: "订阅标准会员",
    current: false,
    recommended: true,
    target: "个人 IP、知识付费创作者、内容团队、电商商家稳定生产内容",
    features: [
      "每月 3,000 积分",
      "可创建 150 个项目",
      "内容理解、脚本生成、分镜解析开放",
      "图片资产生成高额度",
      "视频片段生成高额度",
      "高清导出",
      "去除导出水印",
      "多平台比例适配",
      "支持全部核心工作流模板",
      "较高优先生成队列",
    ],
  },
  {
    name: "高级会员",
    price: "¥529",
    priceNum: 529,
    period: "/ 月",
    credits: "8,000",
    btnText: "订阅高级会员",
    current: false,
    hot: true,
    target: "账号矩阵、多 SKU 商家、知识付费团队、代运营和高频内容生产者",
    features: [
      "每月 8,000 积分",
      "项目数量高额度或不限",
      "内容理解高额度",
      "脚本与分镜生成高额度",
      "图片资产生成高额度",
      "视频片段生成高额度",
      "高清导出",
      "去除导出水印",
      "多平台比例适配",
      "支持批量生成",
      "更大资产库容量",
      "最高优先生成队列",
      "新功能优先体验",
    ],
  },
];

const yearlyPlans = monthlyPlans.map((p) => ({
  ...p,
  priceNum: p.priceNum > 0 ? Math.round(p.priceNum * 0.8) : p.priceNum,
  price: p.priceNum > 0 ? `¥${Math.round(p.priceNum * 0.8)}` : p.price,
  period: p.priceNum > 0 ? "/ 月（包年）" : p.period,
}));

const creditUsages = [
  { action: "文本 / 链接理解", cost: "3 积分 / 次" },
  { action: "图片理解", cost: "5 积分 / 张" },
  { action: "脚本生成与解析", cost: "30 积分 / 次" },
  { action: "图片资产生成", cost: "10–15 积分 / 张" },
  { action: "视频片段生成", cost: "120 积分 / 条" },
  { action: "高清导出", cost: "20 积分 / 次" },
  { action: "普通视频合成", cost: "暂不扣积分" },
];

const workflows = [
  { icon: "ri-shopping-bag-3-line", title: "商品营销视频", desc: "商品卖点、痛点、场景化短剧、种草广告。" },
  { icon: "ri-user-smile-line", title: "个人 IP 内容", desc: "固定人物资产，每期更新选题、脚本和视频内容。" },
  { icon: "ri-book-open-line", title: "知识付费课程", desc: "课程大纲、知识点拆解、短视频切片、口播视频。" },
  { icon: "ri-gallery-line", title: "图文转视频", desc: "将文章、笔记、图文素材转成短视频脚本和视频。" },
  { icon: "ri-lightbulb-flash-line", title: "品牌广告创意", desc: "多版本广告脚本、场景资产和创意视频。" },
  { icon: "ri-stack-line", title: "账号矩阵运营", desc: "批量生成不同选题、不同平台比例的内容。" },
];

const faqs = [
  {
    q: "积分可以用来做什么？",
    a: "积分可用于内容理解、脚本生成、图片资产生成、视频片段生成和高清导出。",
  },
  {
    q: "我是个人 IP，每次都要重新生成自己的人物吗？",
    a: "不需要。已创建的人物资产可以复用，复用资产不重复扣积分。",
  },
  {
    q: "积分不够怎么办？",
    a: "可以购买积分包，或升级到更高套餐。",
  },
  {
    q: "生成失败会扣积分吗？",
    a: "如果是系统或服务商原因，会自动退回积分。生成成功但主观不满意，不退回积分。",
  },
  {
    q: "可以取消订阅吗？",
    a: "可以，取消后当前周期权益仍可使用到期。",
  },
];

export default function BillingPlansPage() {
  const navigate = useNavigate();
  const [isYearly, setIsYearly] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(null);

  const plans = isYearly ? yearlyPlans : monthlyPlans;

  const getPlanKey = (name: string) => {
    if (name === "基础会员") return "basic";
    if (name === "标准会员") return "standard";
    if (name === "高级会员") return "pro";
    return "free";
  };

  const handleSubscribe = (planKey: string) => {
    const period = isYearly ? "yearly" : "monthly";
    navigate(`/billing/checkout?plan=${planKey}&period=${period}`);
  };

  return (
    <div style={{ background: "#F7F8FA", minHeight: "100vh", fontFamily: "'Inter', sans-serif" }}>
      {/* ===== Header ===== */}
      <header
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 lg:px-10 h-14"
        style={{
          background: "rgba(255,255,255,0.96)",
          backdropFilter: "blur(16px)",
          borderBottom: "1px solid #EAEAEA",
          boxShadow: "0 1px 6px rgba(0,0,0,0.04)",
        }}
      >
        <a href="/" className="flex items-center gap-2 cursor-pointer group" style={{ textDecoration: "none" }}>
          <div
            className="w-7 h-7 flex items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-105"
            style={{ background: "linear-gradient(135deg, #7C3AED, #A78BFA)" }}
          >
            <i className="ri-film-line text-white text-[13px]" />
          </div>
          <span className="text-[14px] font-bold whitespace-nowrap hidden sm:inline" style={{ fontFamily: "'Syne', sans-serif", color: "#1D1D1F" }}>
            VibeClip
          </span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md hidden sm:inline" style={{ background: "#F5F3FF", color: "#7C3AED" }}>
            维播
          </span>
        </a>

        <div className="hidden md:flex items-center gap-1">
          {navItems.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="px-3.5 py-1.5 text-[13.5px] font-medium rounded-lg cursor-pointer transition-all duration-200 whitespace-nowrap"
              style={{ color: "#8E8E93", textDecoration: "none" }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.color = "#1D1D1F";
                (e.currentTarget as HTMLElement).style.background = "#F5F5F7";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.color = "#8E8E93";
                (e.currentTarget as HTMLElement).style.background = "transparent";
              }}
            >
              {item.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <UserDropdown isLoggedIn={false} />
        </div>
      </header>

      {/* ===== Main ===== */}
      <main className="pt-14">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-10">
          {/* --- Title --- */}
          <div className="text-center pt-14 pb-6">
            <h1 className="text-[28px] md:text-[34px] font-black leading-tight" style={{ fontFamily: "'Syne', sans-serif", color: "#1D1D1F" }}>
              选择合适的计划，持续生产高质量内容
            </h1>
            <p className="text-[14px] md:text-[15px] mt-4 max-w-[620px] mx-auto leading-relaxed" style={{ color: "#8E8E93" }}>
              订阅套餐每月发放积分，可用于内容理解、脚本生成、图片资产生成和视频生成，适配商品营销、个人 IP、知识付费和短视频运营等场景。
            </p>
          </div>

          {/* --- Billing toggle --- */}
          <div className="flex justify-center mb-10">
            <div
              className="inline-flex items-center rounded-full p-1"
              style={{ background: "#F0F0F5", border: "1px solid #EAEAEA" }}
            >
              <button
                onClick={() => setIsYearly(false)}
                className="px-5 py-2 text-[13.5px] font-medium rounded-full cursor-pointer transition-all duration-200 whitespace-nowrap"
                style={{
                  background: !isYearly ? "#ffffff" : "transparent",
                  color: !isYearly ? "#1D1D1F" : "#8E8E93",
                  boxShadow: !isYearly ? "0 1px 4px rgba(0,0,0,0.06)" : "none",
                }}
              >
                连续包月
              </button>
              <button
                onClick={() => setIsYearly(true)}
                className="px-5 py-2 text-[13.5px] font-medium rounded-full cursor-pointer transition-all duration-200 whitespace-nowrap"
                style={{
                  background: isYearly ? "#ffffff" : "transparent",
                  color: isYearly ? "#1D1D1F" : "#8E8E93",
                  boxShadow: isYearly ? "0 1px 4px rgba(0,0,0,0.06)" : "none",
                }}
              >
                连续包年 8 折
              </button>
            </div>
          </div>

          {/* --- Plan cards --- */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 pb-20">
            {plans.map((plan) => {
              const isRec = plan.recommended;
              const isHot = plan.hot;
              const isFree = plan.priceNum === 0;
              const borderColor = isRec || isHot ? "#C4B5FD" : "#EAEAEA";
              const ringColor = isRec || isHot ? "#7C3AED" : "transparent";

              return (
                <div
                  key={plan.name}
                  className="rounded-2xl flex flex-col transition-all duration-200 relative"
                  style={{
                    background: "#ffffff",
                    border: `2px solid ${plan.current ? borderColor : "#EAEAEA"}`,
                    boxShadow: isRec ? "0 4px 20px rgba(124,58,237,0.08)" : "0 2px 12px rgba(0,0,0,0.04)",
                  }}
                  onMouseEnter={(e) => {
                    if (!plan.current) {
                      (e.currentTarget as HTMLElement).style.borderColor = borderColor;
                      (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 20px rgba(124,58,237,0.06)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!plan.current) {
                      (e.currentTarget as HTMLElement).style.borderColor = "#EAEAEA";
                      (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 12px rgba(0,0,0,0.04)";
                    }
                  }}
                >
                  {/* Badge */}
                  {isRec && (
                    <div
                      className="absolute top-0 right-4 -translate-y-1/2 px-2.5 py-1 text-[11px] font-bold rounded-full z-10"
                      style={{ background: "#7C3AED", color: "#ffffff" }}
                    >
                      推荐
                    </div>
                  )}
                  {isHot && !isRec && (
                    <div
                      className="absolute top-0 right-4 -translate-y-1/2 px-2.5 py-1 text-[11px] font-bold rounded-full z-10"
                      style={{ background: "#1D1D1F", color: "#ffffff" }}
                    >
                      高频创作
                    </div>
                  )}

                  {/* Card header */}
                  <div className="px-6 pt-6 pb-4" style={{ background: isRec ? "#FAF5FF" : isHot ? "#FAFAFA" : "#FAFAFA" }}>
                    <div className="flex items-center justify-between mb-3">
                      <span
                        className="text-[11px] font-bold px-2.5 py-1 rounded-full"
                        style={{
                          background: isRec ? "#F5F3FF" : isHot ? "#F5F5F7" : "#F5F5F7",
                          color: isRec ? "#7C3AED" : "#1D1D1F",
                        }}
                      >
                        {plan.name}
                      </span>
                      {plan.current && (
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: "#16A34A", color: "#ffffff" }}
                        >
                          当前方案
                        </span>
                      )}
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-[30px] font-black" style={{ color: isRec ? "#7C3AED" : "#1D1D1F" }}>
                        {plan.price}
                      </span>
                      {!isFree && (
                        <span className="text-[13px]" style={{ color: "#8E8E93" }}>{plan.period}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="w-4 h-4 flex items-center justify-center">
                        <i className="ri-coin-line text-[13px]" style={{ color: "#7C3AED" }} />
                      </div>
                      <span className="text-[13px] font-semibold" style={{ color: "#7C3AED" }}>
                        {plan.credits} 积分 / 月
                      </span>
                    </div>
                    <p className="text-[12px] mt-2" style={{ color: "#6E6E73" }}>适合：{plan.target}</p>
                  </div>

                  {/* Features */}
                  <div className="flex-1 px-6 py-5">
                    <div className="space-y-2.5">
                      {plan.features.map((feat) => (
                        <div key={feat} className="flex items-start gap-2.5">
                          <div className="w-4 h-4 flex items-center justify-center shrink-0 mt-0.5">
                            <i className="ri-check-line text-[13px]" style={{ color: isRec ? "#7C3AED" : "#8E8E93" }} />
                          </div>
                          <span className="text-[12.5px] leading-relaxed" style={{ color: "#444444" }}>{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* CTA */}
                  <div className="px-6 pb-6">
                    <button
                      disabled={plan.current}
                      onClick={plan.current ? undefined : () => handleSubscribe(getPlanKey(plan.name))}
                      className="w-full py-2.5 rounded-xl text-[13.5px] font-semibold cursor-pointer whitespace-nowrap transition-all duration-200"
                      style={{
                        background: plan.current ? "#F5F5F7" : isRec ? "#7C3AED" : "#1D1D1F",
                        color: plan.current ? "#8E8E93" : "#ffffff",
                        border: `1px solid ${plan.current ? "#EAEAEA" : isRec ? "#7C3AED" : "#1D1D1F"}`,
                        cursor: plan.current ? "not-allowed" : "pointer",
                        opacity: plan.current ? 0.7 : 1,
                      }}
                      onMouseEnter={(e) => {
                        if (!plan.current) (e.currentTarget as HTMLElement).style.opacity = "0.92";
                      }}
                      onMouseLeave={(e) => {
                        if (!plan.current) (e.currentTarget as HTMLElement).style.opacity = "1";
                      }}
                    >
                      {plan.btnText}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* --- Credit usage section --- */}
          <div className="pb-20">
            <div className="text-center mb-10">
              <h2 className="text-[22px] md:text-[26px] font-bold" style={{ color: "#1D1D1F" }}>积分如何消耗？</h2>
              <p className="text-[13.5px] mt-2" style={{ color: "#8E8E93" }}>不同工作流复用同一套底层能力，按实际用量扣费</p>
            </div>

            <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "1px solid #EAEAEA" }}>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ background: "#FAFAFA" }}>
                      <th className="text-left px-6 py-4 text-[12.5px] font-semibold" style={{ color: "#6E6E73" }}>功能</th>
                      <th className="text-right px-6 py-4 text-[12.5px] font-semibold" style={{ color: "#6E6E73" }}>每次消耗</th>
                    </tr>
                  </thead>
                  <tbody>
                    {creditUsages.map((row, idx) => (
                      <tr
                        key={row.action}
                        style={{ borderTop: "1px solid #F0F0F5", background: idx % 2 === 1 ? "#FAFAFA" : "#ffffff" }}
                      >
                        <td className="px-6 py-3.5 text-[13.5px]" style={{ color: "#1D1D1F" }}>{row.action}</td>
                        <td className="px-6 py-3.5 text-[13.5px] text-right font-medium" style={{ color: row.cost.includes("暂不") ? "#8E8E93" : "#7C3AED" }}>
                          {row.cost}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Credit usage notes */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl p-5" style={{ border: "1px solid #EAEAEA" }}>
                <h3 className="text-[13.5px] font-semibold mb-3" style={{ color: "#1D1D1F" }}>
                  <i className="ri-lightbulb-line mr-1.5 text-[14px]" style={{ color: "#7C3AED" }} />
                  不同场景的底层能力复用
                </h3>
                <div className="space-y-2">
                  <p className="text-[12.5px] leading-relaxed" style={{ color: "#6E6E73" }}>
                    <span className="font-medium" style={{ color: "#444444" }}>商品营销：</span>内容理解对应商品理解与卖点提取
                  </p>
                  <p className="text-[12.5px] leading-relaxed" style={{ color: "#6E6E73" }}>
                    <span className="font-medium" style={{ color: "#444444" }}>个人 IP：</span>内容理解对应选题、口播稿和知识点理解
                  </p>
                  <p className="text-[12.5px] leading-relaxed" style={{ color: "#6E6E73" }}>
                    <span className="font-medium" style={{ color: "#444444" }}>知识付费：</span>内容理解对应课程大纲和知识结构理解
                  </p>
                </div>
              </div>
              <div className="bg-white rounded-xl p-5" style={{ border: "1px solid #EAEAEA" }}>
                <h3 className="text-[13.5px] font-semibold mb-3" style={{ color: "#1D1D1F" }}>
                  <i className="ri-shield-check-line mr-1.5 text-[14px]" style={{ color: "#7C3AED" }} />
                  失败退回规则
                </h3>
                <p className="text-[12.5px] leading-relaxed" style={{ color: "#6E6E73" }}>
                  如果生成失败是系统或服务商原因，积分会自动退回。生成成功但用户主观不满意，不退回积分。
                </p>
              </div>
            </div>
          </div>

          {/* --- Workflow templates section --- */}
          <div className="pb-20">
            <div className="text-center mb-10">
              <h2 className="text-[22px] md:text-[26px] font-bold" style={{ color: "#1D1D1F" }}>适配多种内容场景</h2>
              <p className="text-[13.5px] mt-2" style={{ color: "#8E8E93" }}>同一套平台能力，灵活适配不同创作需求</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {workflows.map((wf) => (
                <div
                  key={wf.title}
                  className="bg-white rounded-2xl p-5 transition-all duration-200"
                  style={{ border: "1px solid #EAEAEA" }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = "#C4B5FD";
                    (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 16px rgba(124,58,237,0.06)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = "#EAEAEA";
                    (e.currentTarget as HTMLElement).style.boxShadow = "none";
                  }}
                >
                  <div className="w-10 h-10 flex items-center justify-center rounded-xl mb-4" style={{ background: "#F5F3FF" }}>
                    <i className={`${wf.icon} text-[18px]`} style={{ color: "#7C3AED" }} />
                  </div>
                  <h3 className="text-[14.5px] font-bold mb-1.5" style={{ color: "#1D1D1F" }}>{wf.title}</h3>
                  <p className="text-[12.5px] leading-relaxed" style={{ color: "#6E6E73" }}>{wf.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* --- FAQ section --- */}
          <div className="pb-20">
            <div className="text-center mb-10">
              <h2 className="text-[22px] md:text-[26px] font-bold" style={{ color: "#1D1D1F" }}>常见问题</h2>
            </div>

            <div className="max-w-[760px] mx-auto space-y-3">
              {faqs.map((faq, idx) => {
                const isOpen = openFaqIdx === idx;
                return (
                  <div
                    key={idx}
                    className="bg-white rounded-xl overflow-hidden transition-all duration-200"
                    style={{ border: isOpen ? "1px solid #C4B5FD" : "1px solid #EAEAEA" }}
                  >
                    <button
                      onClick={() => setOpenFaqIdx(isOpen ? null : idx)}
                      className="w-full flex items-center justify-between px-5 py-4 text-left cursor-pointer"
                    >
                      <span className="text-[13.5px] font-semibold" style={{ color: "#1D1D1F" }}>{faq.q}</span>
                      <div className="w-6 h-6 flex items-center justify-center shrink-0 ml-4">
                        <i
                          className={`ri-arrow-down-s-line text-[16px] transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                          style={{ color: "#8E8E93" }}
                        />
                      </div>
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-4">
                        <p className="text-[13px] leading-relaxed" style={{ color: "#6E6E73" }}>{faq.a}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>

      {/* ===== Footer ===== */}
      <footer className="py-10 px-6" style={{ background: "#F7F8FA", borderTop: "1px solid #EAEAEA" }}>
        <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 flex items-center justify-center rounded-lg" style={{ background: "linear-gradient(135deg, #7C3AED, #A78BFA)" }}>
              <i className="ri-film-line text-white text-[11px]" />
            </div>
            <span className="text-[13px] font-medium" style={{ fontFamily: "'Syne', sans-serif", color: "#8E8E93" }}>
              VibeClip Engine
            </span>
          </div>
          <p className="text-[12px]" style={{ color: "#AEAEB2" }}>© 2024 VibeClip. All rights reserved.</p>
        </div>
      </footer>

      {/* ===== Payment modal ===== */}
      {showPayModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.45)" }}
          onClick={() => setShowPayModal(false)}
        >
          <div
            className="bg-white rounded-2xl p-7 max-w-sm w-full mx-4 text-center"
            style={{ boxShadow: "0 12px 40px rgba(0,0,0,0.12)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 flex items-center justify-center rounded-full mx-auto mb-4" style={{ background: "#F5F3FF" }}>
              <i className="ri-bank-card-line text-[22px]" style={{ color: "#7C3AED" }} />
            </div>
            <h3 className="text-[17px] font-bold mb-2" style={{ color: "#1D1D1F" }}>支付功能即将开放</h3>
            <p className="text-[13px] leading-relaxed mb-6" style={{ color: "#6E6E73" }}>
              我们正在接入支付系统，订阅功能即将上线。你可以先体验免费版完整创作流程。
            </p>
            <button
              onClick={() => setShowPayModal(false)}
              className="w-full py-2.5 rounded-xl text-[13.5px] font-semibold cursor-pointer whitespace-nowrap transition-opacity duration-200"
              style={{ background: "#7C3AED", color: "#ffffff" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.92"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
            >
              知道了
            </button>
          </div>
        </div>
      )}
    </div>
  );
}