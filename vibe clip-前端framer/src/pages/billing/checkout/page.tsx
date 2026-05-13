import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import UserDropdown from "@/components/feature/UserDropdown";

const navItems = [
  { label: "首页", href: "/" },
  { label: "流程", href: "/#workflow" },
  { label: "案例", href: "/#cases" },
  { label: "项目管理", href: "/projects" },
];

const PLAN_MAP: Record<string, { name: string; price: number; credits: string; desc: string }> = {
  basic: { name: "基础会员", price: 79, credits: "1,000", desc: "个人创作者、轻量内容生产、小商家测试" },
  standard: { name: "标准会员", price: 209, credits: "3,000", desc: "个人 IP、知识付费创作者、内容团队、电商商家稳定生产内容" },
  pro: { name: "高级会员", price: 529, credits: "8,000", desc: "账号矩阵、多 SKU 商家、知识付费团队、代运营和高频内容生产者" },
};

const PERIOD_LABEL: Record<string, string> = {
  monthly: "连续包月",
  yearly: "连续包年 8 折",
};

export default function BillingCheckoutPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const rawPlan = searchParams.get("plan") || "standard";
  const rawPeriod = searchParams.get("period") || "monthly";

  const planKey = PLAN_MAP[rawPlan] ? rawPlan : "standard";
  const plan = PLAN_MAP[planKey];

  const [period, setPeriod] = useState(rawPeriod === "yearly" ? "yearly" : "monthly");
  const [payment, setPayment] = useState<"alipay" | "wechat">("alipay");
  const [showPayModal, setShowPayModal] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [countdown, setCountdown] = useState(15 * 60);
  const [payStatus, setPayStatus] = useState<"waiting" | "success" | "failed">("waiting");

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isYearly = period === "yearly";
  const unitPrice = plan.price;
  const subtotal = isYearly ? unitPrice * 12 : unitPrice;
  const discount = isYearly ? Math.round(subtotal * 0.2) : 0;
  const total = subtotal - discount;

  useEffect(() => {
    if (showPayModal && payStatus === "waiting") {
      timerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            setPayStatus("failed");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [showPayModal, payStatus]);

  const handleOpenPay = () => {
    setCountdown(15 * 60);
    setPayStatus("waiting");
    setShowPayModal(true);
  };

  const handleClosePay = () => {
    if (payStatus === "waiting") {
      setShowCancelConfirm(true);
    } else {
      setShowPayModal(false);
    }
  };

  const handleConfirmCancel = () => {
    setShowCancelConfirm(false);
    setShowPayModal(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const handlePayComplete = () => {
    setPayStatus("success");
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeout(() => {
      setShowPayModal(false);
      navigate("/billing/success?plan=" + planKey + "&period=" + period);
    }, 1200);
  };

  const handlePayFail = () => {
    setPayStatus("failed");
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const paymentOptions: { key: "alipay" | "wechat"; label: string; sub: string; color: string; bg: string }[] = [
    { key: "alipay", label: "支付宝", sub: "使用支付宝扫码或跳转完成支付", color: "#1677FF", bg: "#F0F7FF" },
    { key: "wechat", label: "微信支付", sub: "使用微信扫码完成支付", color: "#07C160", bg: "#F0FFF4" },
  ];

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
          <div className="w-7 h-7 flex items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-105" style={{ background: "linear-gradient(135deg, #7C3AED, #A78BFA)" }}>
            <i className="ri-film-line text-white text-[13px]" />
          </div>
          <span className="text-[14px] font-bold whitespace-nowrap hidden sm:inline" style={{ fontFamily: "'Syne', sans-serif", color: "#1D1D1F" }}>VibeClip</span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md hidden sm:inline" style={{ background: "#F5F3FF", color: "#7C3AED" }}>维播</span>
        </a>

        <div className="hidden md:flex items-center gap-1">
          {navItems.map((item) => (
            <a key={item.label} href={item.href} className="px-3.5 py-1.5 text-[13.5px] font-medium rounded-lg cursor-pointer transition-all duration-200 whitespace-nowrap" style={{ color: "#8E8E93", textDecoration: "none" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#1D1D1F"; (e.currentTarget as HTMLElement).style.background = "#F5F5F7"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#8E8E93"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >{item.label}</a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <UserDropdown isLoggedIn={false} />
        </div>
      </header>

      {/* ===== Main ===== */}
      <main className="pt-14">
        <div className="max-w-[1080px] mx-auto px-6 lg:px-10 py-10">
          {/* Title */}
          <div className="mb-8">
            <h1 className="text-[26px] md:text-[30px] font-black" style={{ fontFamily: "'Syne', sans-serif", color: "#1D1D1F" }}>确认订阅</h1>
            <p className="text-[14px] mt-2 max-w-lg" style={{ color: "#8E8E93" }}>
              确认套餐信息并选择支付方式，支付完成后积分将自动发放到账户。
            </p>
          </div>

          {/* Two columns */}
          <div className="flex flex-col lg:flex-row gap-8">
            {/* --- Left column --- */}
            <div className="flex-1 space-y-6">
              {/* Selected plan card */}
              <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid #EAEAEA", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[12px] font-bold px-2.5 py-1 rounded-full" style={{ background: "#F5F3FF", color: "#7C3AED" }}>{plan.name}</span>
                  <button
                    onClick={() => navigate("/billing/plans")}
                    className="text-[12.5px] font-medium cursor-pointer transition-colors duration-150"
                    style={{ color: "#8E8E93" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#7C3AED"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#8E8E93"; }}
                  >
                    更换套餐
                  </button>
                </div>
                <div className="flex items-baseline gap-1.5 mb-1">
                  <span className="text-[28px] font-black" style={{ color: "#1D1D1F" }}>¥{unitPrice}</span>
                  <span className="text-[13px]" style={{ color: "#8E8E93" }}>/ 月</span>
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-4 h-4 flex items-center justify-center">
                    <i className="ri-coin-line text-[13px]" style={{ color: "#7C3AED" }} />
                  </div>
                  <span className="text-[13px] font-semibold" style={{ color: "#7C3AED" }}>{plan.credits} 积分 / 月</span>
                </div>
                <p className="text-[12.5px]" style={{ color: "#6E6E73" }}>适合：{plan.desc}</p>
              </div>

              {/* Period toggle */}
              <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid #EAEAEA", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
                <h3 className="text-[14px] font-bold mb-4" style={{ color: "#1D1D1F" }}>计费周期</h3>
                <div className="space-y-3">
                  <label
                    className="flex items-center gap-3 p-4 rounded-xl cursor-pointer transition-all duration-200"
                    style={{ border: period === "monthly" ? "2px solid #7C3AED" : "1px solid #EAEAEA", background: period === "monthly" ? "#FAF5FF" : "#ffffff" }}
                    onClick={() => setPeriod("monthly")}
                  >
                    <div className="w-5 h-5 flex items-center justify-center rounded-full shrink-0" style={{ border: period === "monthly" ? "2px solid #7C3AED" : "2px solid #D4D4D8" }}>
                      {period === "monthly" && <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#7C3AED" }} />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[13.5px] font-semibold" style={{ color: "#1D1D1F" }}>连续包月</span>
                        <span className="text-[13.5px] font-bold" style={{ color: "#1D1D1F" }}>¥{unitPrice} / 月</span>
                      </div>
                      <p className="text-[12px] mt-0.5" style={{ color: "#8E8E93" }}>按月自动续费，随时可取消</p>
                    </div>
                  </label>
                  <label
                    className="flex items-center gap-3 p-4 rounded-xl cursor-pointer transition-all duration-200"
                    style={{ border: period === "yearly" ? "2px solid #7C3AED" : "1px solid #EAEAEA", background: period === "yearly" ? "#FAF5FF" : "#ffffff" }}
                    onClick={() => setPeriod("yearly")}
                  >
                    <div className="w-5 h-5 flex items-center justify-center rounded-full shrink-0" style={{ border: period === "yearly" ? "2px solid #7C3AED" : "2px solid #D4D4D8" }}>
                      {period === "yearly" && <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#7C3AED" }} />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[13.5px] font-semibold" style={{ color: "#1D1D1F" }}>连续包年 8 折</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: "#7C3AED", color: "#ffffff" }}>省 20%</span>
                        </div>
                        <span className="text-[13.5px] font-bold" style={{ color: "#1D1D1F" }}>¥{Math.round(unitPrice * 0.8)} / 月</span>
                      </div>
                      <p className="text-[12px] mt-0.5" style={{ color: "#8E8E93" }}>
                        年付 ¥{subtotal - discount}，原价 ¥{subtotal}，已省 ¥{discount}
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Payment method */}
              <div className="bg-white rounded-2xl p-6" style={{ border: "1px solid #EAEAEA", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
                <h3 className="text-[14px] font-bold mb-4" style={{ color: "#1D1D1F" }}>选择支付方式</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {paymentOptions.map((opt) => {
                    const active = payment === opt.key;
                    return (
                      <div
                        key={opt.key}
                        className="flex items-center gap-3 p-4 rounded-xl cursor-pointer transition-all duration-200"
                        style={{
                          border: active ? "2px solid #7C3AED" : "1px solid #EAEAEA",
                          background: active ? "#FAF5FF" : "#ffffff",
                        }}
                        onClick={() => setPayment(opt.key)}
                      >
                        <div className="w-5 h-5 flex items-center justify-center rounded-full shrink-0" style={{ border: active ? "2px solid #7C3AED" : "2px solid #D4D4D8" }}>
                          {active && <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#7C3AED" }} />}
                        </div>
                        <div className="flex items-center gap-2 flex-1">
                          <div className="w-8 h-8 flex items-center justify-center rounded-lg shrink-0" style={{ background: opt.bg }}>
                            <span className="text-[11px] font-bold" style={{ color: opt.color }}>{opt.key === "alipay" ? "支付宝" : "微信"}</span>
                          </div>
                          <div>
                            <p className="text-[13px] font-semibold" style={{ color: "#1D1D1F" }}>{opt.label}</p>
                            <p className="text-[11.5px]" style={{ color: "#8E8E93" }}>{opt.sub}</p>
                          </div>
                        </div>
                        {active && (
                          <div className="w-5 h-5 flex items-center justify-center shrink-0">
                            <i className="ri-check-line text-[14px]" style={{ color: "#7C3AED" }} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Pay notice */}
              <div className="bg-white rounded-2xl p-5" style={{ border: "1px solid #EAEAEA" }}>
                <div className="flex items-start gap-2.5">
                  <div className="w-4 h-4 flex items-center justify-center shrink-0 mt-0.5">
                    <i className="ri-information-line text-[14px]" style={{ color: "#8E8E93" }} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[12.5px]" style={{ color: "#6E6E73" }}>支付成功后，套餐权益会立即生效。</p>
                    <p className="text-[12.5px]" style={{ color: "#6E6E73" }}>月度积分会自动发放到账户。</p>
                    <p className="text-[12.5px]" style={{ color: "#6E6E73" }}>订阅可在账单页面管理。</p>
                    <p className="text-[12.5px]" style={{ color: "#6E6E73" }}>如支付失败，不会扣除积分或变更套餐。</p>
                  </div>
                </div>
              </div>
            </div>

            {/* --- Right column: Order summary --- */}
            <div className="w-full lg:w-[360px] shrink-0">
              <div className="bg-white rounded-2xl p-6 sticky top-[72px]" style={{ border: "1px solid #EAEAEA", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
                <h3 className="text-[15px] font-bold mb-5" style={{ color: "#1D1D1F" }}>订单摘要</h3>

                <div className="space-y-3 pb-5" style={{ borderBottom: "1px solid #F0F0F5" }}>
                  <div className="flex items-center justify-between">
                    <span className="text-[13px]" style={{ color: "#6E6E73" }}>套餐</span>
                    <span className="text-[13px] font-medium" style={{ color: "#1D1D1F" }}>{plan.name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[13px]" style={{ color: "#6E6E73" }}>计费周期</span>
                    <span className="text-[13px] font-medium" style={{ color: "#1D1D1F" }}>{PERIOD_LABEL[period]}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[13px]" style={{ color: "#6E6E73" }}>每月积分</span>
                    <span className="text-[13px] font-medium" style={{ color: "#7C3AED" }}>{plan.credits}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[13px]" style={{ color: "#6E6E73" }}>生成队列</span>
                    <span className="text-[13px] font-medium" style={{ color: "#1D1D1F" }}>{planKey === "pro" ? "最高优先级" : planKey === "standard" ? "较高优先级" : "普通队列"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[13px]" style={{ color: "#6E6E73" }}>高清导出</span>
                    <span className="text-[13px] font-medium" style={{ color: "#1D1D1F" }}>{planKey === "basic" ? "标准" : "已包含"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[13px]" style={{ color: "#6E6E73" }}>去水印</span>
                    <span className="text-[13px] font-medium" style={{ color: "#1D1D1F" }}>{planKey === "basic" ? "已包含" : "已包含"}</span>
                  </div>
                </div>

                <div className="pt-4 space-y-2 pb-5" style={{ borderBottom: "1px solid #F0F0F5" }}>
                  <div className="flex items-center justify-between">
                    <span className="text-[13px]" style={{ color: "#6E6E73" }}>小计</span>
                    <span className="text-[13px]" style={{ color: "#1D1D1F" }}>¥{subtotal}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-[13px]" style={{ color: "#6E6E73" }}>年付优惠</span>
                      <span className="text-[13px] font-medium" style={{ color: "#16A34A" }}>-¥{discount}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[14px] font-bold" style={{ color: "#1D1D1F" }}>应付金额</span>
                    <span className="text-[20px] font-black" style={{ color: "#1D1D1F" }}>¥{total}</span>
                  </div>
                </div>

                <button
                  onClick={handleOpenPay}
                  className="w-full py-3 rounded-xl text-[14px] font-bold cursor-pointer whitespace-nowrap transition-all duration-200 mt-4"
                  style={{ background: "#1D1D1F", color: "#ffffff" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.92"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
                >
                  确认支付 ¥{total}
                </button>

                <p className="text-[11.5px] text-center mt-3" style={{ color: "#AEAEB2" }}>
                  点击确认支付即表示你同意
                  <a href="/" className="underline" style={{ color: "#7C3AED" }}>《服务协议》</a>
                  和
                  <a href="/" className="underline" style={{ color: "#7C3AED" }}>《订阅条款》</a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ===== Footer ===== */}
      <footer className="py-10 px-6" style={{ background: "#F7F8FA", borderTop: "1px solid #EAEAEA" }}>
        <div className="max-w-[1080px] mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 flex items-center justify-center rounded-lg" style={{ background: "linear-gradient(135deg, #7C3AED, #A78BFA)" }}>
              <i className="ri-film-line text-white text-[11px]" />
            </div>
            <span className="text-[13px] font-medium" style={{ fontFamily: "'Syne', sans-serif", color: "#8E8E93" }}>VibeClip Engine</span>
          </div>
          <p className="text-[12px]" style={{ color: "#AEAEB2" }}>© 2024 VibeClip. All rights reserved.</p>
        </div>
      </footer>

      {/* ===== Payment modal ===== */}
      {showPayModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.45)" }} onClick={handleClosePay}>
          <div
            className="bg-white rounded-2xl p-7 max-w-sm w-full mx-4 relative"
            style={{ boxShadow: "0 12px 40px rgba(0,0,0,0.12)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close */}
            <button
              onClick={handleClosePay}
              className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-full cursor-pointer transition-colors duration-150"
              style={{ color: "#AEAEB2" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#F5F5F7"; (e.currentTarget as HTMLElement).style.color = "#1D1D1F"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "#AEAEB2"; }}
            >
              <i className="ri-close-line text-[18px]" />
            </button>

            {payStatus === "waiting" && (
              <>
                <div className="text-center">
                  <div className="w-12 h-12 flex items-center justify-center rounded-full mx-auto mb-4" style={{ background: payment === "alipay" ? "#F0F7FF" : "#F0FFF4" }}>
                    <span className="text-[12px] font-bold" style={{ color: payment === "alipay" ? "#1677FF" : "#07C160" }}>
                      {payment === "alipay" ? "支付宝" : "微信"}
                    </span>
                  </div>
                  <h3 className="text-[17px] font-bold mb-1" style={{ color: "#1D1D1F" }}>完成支付</h3>
                  <p className="text-[13px]" style={{ color: "#8E8E93" }}>
                    请使用{payment === "alipay" ? "支付宝" : "微信"}扫码完成支付
                  </p>
                </div>

                {/* QR placeholder */}
                <div className="my-5 flex justify-center">
                  <div
                    className="w-44 h-44 flex flex-col items-center justify-center rounded-xl"
                    style={{ border: "2px dashed #EAEAEA", background: "#FAFAFA" }}
                  >
                    <i className="ri-qr-code-line text-[28px] mb-2" style={{ color: "#D4D4D8" }} />
                    <span className="text-[11px]" style={{ color: "#AEAEB2" }}>二维码将在创建订单后生成</span>
                  </div>
                </div>

                <div className="text-center space-y-1 mb-5">
                  <p className="text-[18px] font-black" style={{ color: "#1D1D1F" }}>¥{total}</p>
                  <p className="text-[12px]" style={{ color: "#6E6E73" }}>{plan.name} · {PERIOD_LABEL[period]}</p>
                  <p className="text-[12px]" style={{ color: "#8E8E93" }}>
                    订单将在 <span className="font-medium" style={{ color: "#DC2626" }}>{formatTime(countdown)}</span> 后失效
                  </p>
                  <p className="text-[12px] font-medium" style={{ color: "#7C3AED" }}>等待支付...</p>
                </div>

                <div className="space-y-2.5">
                  <button
                    onClick={handlePayComplete}
                    className="w-full py-2.5 rounded-xl text-[13.5px] font-semibold cursor-pointer whitespace-nowrap transition-opacity duration-200"
                    style={{ background: "#1D1D1F", color: "#ffffff" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.92"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
                  >
                    我已完成支付
                  </button>
                  <button
                    onClick={() => setPayment(payment === "alipay" ? "wechat" : "alipay")}
                    className="w-full py-2.5 rounded-xl text-[13.5px] font-medium cursor-pointer whitespace-nowrap transition-colors duration-150"
                    style={{ border: "1px solid #EAEAEA", color: "#444444", background: "#ffffff" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#F5F5F7"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#ffffff"; }}
                  >
                    更换支付方式
                  </button>
                  <button
                    onClick={handlePayFail}
                    className="w-full py-2.5 rounded-xl text-[13.5px] font-medium cursor-pointer whitespace-nowrap transition-colors duration-150"
                    style={{ border: "1px solid #EAEAEA", color: "#8E8E93", background: "#ffffff" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#FEF2F2"; (e.currentTarget as HTMLElement).style.color = "#DC2626"; (e.currentTarget as HTMLElement).style.borderColor = "#FECACA"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#ffffff"; (e.currentTarget as HTMLElement).style.color = "#8E8E93"; (e.currentTarget as HTMLElement).style.borderColor = "#EAEAEA"; }}
                  >
                    取消订单
                  </button>
                </div>
              </>
            )}

            {payStatus === "success" && (
              <div className="text-center py-4">
                <div className="w-14 h-14 flex items-center justify-center rounded-full mx-auto mb-4" style={{ background: "#F0FDF4" }}>
                  <i className="ri-check-line text-[28px]" style={{ color: "#16A34A" }} />
                </div>
                <h3 className="text-[18px] font-bold mb-1" style={{ color: "#1D1D1F" }}>支付成功</h3>
                <p className="text-[13px]" style={{ color: "#6E6E73" }}>正在跳转订阅成功页...</p>
              </div>
            )}

            {payStatus === "failed" && (
              <div className="text-center py-4">
                <div className="w-14 h-14 flex items-center justify-center rounded-full mx-auto mb-4" style={{ background: "#FEF2F2" }}>
                  <i className="ri-close-line text-[28px]" style={{ color: "#DC2626" }} />
                </div>
                <h3 className="text-[18px] font-bold mb-1" style={{ color: "#1D1D1F" }}>支付失败</h3>
                <p className="text-[13px] mb-5" style={{ color: "#6E6E73" }}>订单已失效或支付被取消，套餐和积分未发生变化。</p>
                <div className="space-y-2.5">
                  <button
                    onClick={() => { setPayStatus("waiting"); setCountdown(15 * 60); }}
                    className="w-full py-2.5 rounded-xl text-[13.5px] font-semibold cursor-pointer whitespace-nowrap transition-opacity duration-200"
                    style={{ background: "#1D1D1F", color: "#ffffff" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.92"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
                  >
                    重新支付
                  </button>
                  <button
                    onClick={() => { setShowPayModal(false); setPayStatus("waiting"); }}
                    className="w-full py-2.5 rounded-xl text-[13.5px] font-medium cursor-pointer whitespace-nowrap transition-colors duration-150"
                    style={{ border: "1px solid #EAEAEA", color: "#444444", background: "#ffffff" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#F5F5F7"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#ffffff"; }}
                  >
                    返回确认页
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== Cancel confirm modal ===== */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.45)" }} onClick={() => setShowCancelConfirm(false)}>
          <div
            className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 text-center"
            style={{ boxShadow: "0 12px 40px rgba(0,0,0,0.12)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-[16px] font-bold mb-2" style={{ color: "#1D1D1F" }}>确定取消当前支付吗？</h3>
            <p className="text-[13px] mb-5" style={{ color: "#6E6E73" }}>取消后订单将失效，你可以随时重新发起订阅。</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelConfirm(false)}
                className="flex-1 py-2.5 rounded-xl text-[13.5px] font-medium cursor-pointer whitespace-nowrap transition-colors duration-150"
                style={{ border: "1px solid #EAEAEA", color: "#444444", background: "#ffffff" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#F5F5F7"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#ffffff"; }}
              >
                继续支付
              </button>
              <button
                onClick={handleConfirmCancel}
                className="flex-1 py-2.5 rounded-xl text-[13.5px] font-semibold cursor-pointer whitespace-nowrap transition-opacity duration-200"
                style={{ background: "#DC2626", color: "#ffffff" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.92"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
              >
                确认取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}