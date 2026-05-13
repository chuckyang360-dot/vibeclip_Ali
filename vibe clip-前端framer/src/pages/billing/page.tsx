import { useNavigate } from "react-router-dom";
import UserDropdown from "@/components/feature/UserDropdown";

export default function BillingPage() {
  const navigate = useNavigate();

  const navItems = [
    { label: "首页", href: "/" },
    { label: "流程", href: "/#workflow" },
    { label: "案例", href: "/#cases" },
    { label: "项目管理", href: "/projects" },
  ];

  return (
    <div style={{ background: "#F7F8FA", minHeight: "100vh", fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
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

      {/* Main */}
      <main className="pt-14">
        <div className="max-w-[960px] mx-auto px-6 lg:px-10 py-10">
          <div className="mb-8">
            <h1 className="text-[26px] font-black" style={{ fontFamily: "'Syne', sans-serif", color: "#1D1D1F" }}>
              账单中心
            </h1>
            <p className="text-[13.5px] mt-1" style={{ color: "#8E8E93" }}>
              查看订阅状态、积分记录与支付记录
            </p>
          </div>

          {/* Current plan card */}
          <div
            className="rounded-2xl overflow-hidden mb-6"
            style={{ background: "#ffffff", border: "1px solid #EAEAEA" }}
          >
            <div className="px-6 py-4" style={{ borderBottom: "1px solid #F0F0F5" }}>
              <h2 className="text-[14px] font-bold" style={{ color: "#1D1D1F" }}>当前订阅</h2>
            </div>
            <div className="px-6 py-6">
              <div className="flex items-center gap-4 mb-4">
                <div
                  className="w-12 h-12 flex items-center justify-center rounded-xl"
                  style={{ background: "#F5F3FF" }}
                >
                  <i className="ri-vip-crown-line text-[20px]" style={{ color: "#7C3AED" }} />
                </div>
                <div>
                  <p className="text-[15px] font-bold" style={{ color: "#1D1D1F" }}>免费版</p>
                  <p className="text-[12.5px]" style={{ color: "#8E8E93" }}>每月 10 个积分 · 基础视频生成</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-[12.5px]" style={{ color: "#6E6E73" }}>
                <i className="ri-time-line text-[13px]" />
                <span>下一个结算日：2026-06-15</span>
              </div>
            </div>
          </div>

          {/* Credit history */}
          <div
            className="rounded-2xl overflow-hidden mb-6"
            style={{ background: "#ffffff", border: "1px solid #EAEAEA" }}
          >
            <div className="px-6 py-4" style={{ borderBottom: "1px solid #F0F0F5" }}>
              <h2 className="text-[14px] font-bold" style={{ color: "#1D1D1F" }}>积分记录</h2>
            </div>
            <div className="px-6 py-5">
              <div className="space-y-4">
                {[
                  { desc: "创建项目 · 护肤精华短视频", change: "-3", date: "2026-05-08", type: "use" },
                  { desc: "创建项目 · 运动水杯短视频", change: "-3", date: "2026-05-06", type: "use" },
                  { desc: "每日签到奖励", change: "+1", date: "2026-05-05", type: "bonus" },
                  { desc: "免费版月度赠送", change: "+10", date: "2026-05-01", type: "bonus" },
                ].map((row, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between py-2"
                    style={{ borderBottom: idx < 3 ? "1px solid #F0F0F5" : "none" }}
                  >
                    <div>
                      <p className="text-[13.5px]" style={{ color: "#1D1D1F" }}>{row.desc}</p>
                      <p className="text-[11.5px] mt-0.5" style={{ color: "#8E8E93" }}>{row.date}</p>
                    </div>
                    <span
                      className="text-[13.5px] font-bold"
                      style={{ color: row.type === "bonus" ? "#16A34A" : "#DC2626" }}
                    >
                      {row.change}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Payment history */}
          <div
            className="rounded-2xl overflow-hidden mb-6"
            style={{ background: "#ffffff", border: "1px solid #EAEAEA" }}
          >
            <div className="px-6 py-4" style={{ borderBottom: "1px solid #F0F0F5" }}>
              <h2 className="text-[14px] font-bold" style={{ color: "#1D1D1F" }}>支付记录</h2>
            </div>
            <div className="px-6 py-10 flex flex-col items-center justify-center">
              <div
                className="w-14 h-14 flex items-center justify-center rounded-2xl mb-3"
                style={{ background: "#F5F5F7" }}
              >
                <i className="ri-bill-line text-[22px]" style={{ color: "#AEAEB2" }} />
              </div>
              <p className="text-[13.5px] font-medium" style={{ color: "#8E8E93" }}>暂无支付记录</p>
              <p className="text-[12px] mt-1" style={{ color: "#C7C7CC" }}>升级专业版后即可查看完整账单</p>
            </div>
          </div>

          {/* Upgrade CTA */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: "#F5F3FF", border: "1px solid #E9D5FF" }}
          >
            <div className="px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <p className="text-[15px] font-bold" style={{ color: "#7C3AED" }}>需要更多积分？</p>
                <p className="text-[13px] mt-0.5" style={{ color: "#8E8E93" }}>升级到专业版，每月 100 积分，解锁全部功能</p>
              </div>
              <button
                onClick={() => navigate("/billing/plans")}
                className="px-5 py-2.5 rounded-xl text-[13px] font-semibold cursor-pointer whitespace-nowrap transition-all duration-200"
                style={{ background: "#7C3AED", color: "#ffffff" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#6D28D9"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#7C3AED"; }}
              >
                查看升级计划
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}