import { useSearchParams, useNavigate } from "react-router-dom";
import UserDropdown from "@/components/feature/UserDropdown";

const navItems = [
  { label: "首页", href: "/" },
  { label: "流程", href: "/#workflow" },
  { label: "案例", href: "/#cases" },
  { label: "项目管理", href: "/projects" },
];

const PLAN_MAP: Record<string, { name: string; credits: string }> = {
  basic: { name: "基础会员", credits: "1,000" },
  standard: { name: "标准会员", credits: "3,000" },
  pro: { name: "高级会员", credits: "8,000" },
};

export default function BillingSuccessPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const planKey = searchParams.get("plan") || "standard";
  const period = searchParams.get("period") || "monthly";
  const plan = PLAN_MAP[planKey] || PLAN_MAP.standard;

  // Placeholder dates
  const nextRenewal = "2026-06-09";

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
        <div className="max-w-[560px] mx-auto px-6 lg:px-10 py-16 text-center">
          {/* Success icon */}
          <div className="w-20 h-20 flex items-center justify-center rounded-full mx-auto mb-6" style={{ background: "#F0FDF4" }}>
            <i className="ri-check-double-line text-[36px]" style={{ color: "#16A34A" }} />
          </div>

          <h1 className="text-[26px] md:text-[30px] font-black mb-3" style={{ fontFamily: "'Syne', sans-serif", color: "#1D1D1F" }}>
            订阅成功
          </h1>
          <p className="text-[14px] mb-10" style={{ color: "#6E6E73" }}>
            你的套餐已升级，积分已发放到账户。
          </p>

          {/* Result card */}
          <div className="bg-white rounded-2xl p-6 text-left mb-8" style={{ border: "1px solid #EAEAEA", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
            <div className="space-y-4">
              <div className="flex items-center justify-between" style={{ borderBottom: "1px solid #F0F0F5", paddingBottom: "12px" }}>
                <span className="text-[13px]" style={{ color: "#6E6E73" }}>套餐名称</span>
                <span className="text-[13.5px] font-bold" style={{ color: "#1D1D1F" }}>{plan.name}</span>
              </div>
              <div className="flex items-center justify-between" style={{ borderBottom: "1px solid #F0F0F5", paddingBottom: "12px" }}>
                <span className="text-[13px]" style={{ color: "#6E6E73" }}>已发放积分</span>
                <span className="text-[13.5px] font-bold" style={{ color: "#7C3AED" }}>{plan.credits}</span>
              </div>
              <div className="flex items-center justify-between" style={{ borderBottom: "1px solid #F0F0F5", paddingBottom: "12px" }}>
                <span className="text-[13px]" style={{ color: "#6E6E73" }}>计费周期</span>
                <span className="text-[13.5px] font-medium" style={{ color: "#1D1D1F" }}>
                  {period === "yearly" ? "连续包年" : "连续包月"}
                </span>
              </div>
              <div className="flex items-center justify-between" style={{ borderBottom: "1px solid #F0F0F5", paddingBottom: "12px" }}>
                <span className="text-[13px]" style={{ color: "#6E6E73" }}>生效时间</span>
                <span className="text-[13.5px] font-medium" style={{ color: "#16A34A" }}>立即生效</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13px]" style={{ color: "#6E6E73" }}>下次续费时间</span>
                <span className="text-[13.5px] font-medium" style={{ color: "#1D1D1F" }}>{nextRenewal}</span>
              </div>
            </div>
          </div>

          {/* CTA buttons */}
          <div className="space-y-3">
            <button
              onClick={() => navigate("/create")}
              className="w-full py-3 rounded-xl text-[14px] font-bold cursor-pointer whitespace-nowrap transition-opacity duration-200"
              style={{ background: "#7C3AED", color: "#ffffff" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.92"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
            >
              开始创建内容
            </button>
            <button
              onClick={() => navigate("/billing")}
              className="w-full py-3 rounded-xl text-[14px] font-medium cursor-pointer whitespace-nowrap transition-colors duration-150"
              style={{ border: "1px solid #EAEAEA", color: "#444444", background: "#ffffff" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#F5F5F7"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#ffffff"; }}
            >
              查看账单
            </button>
          </div>
        </div>
      </main>

      {/* ===== Footer ===== */}
      <footer className="py-10 px-6" style={{ background: "#F7F8FA", borderTop: "1px solid #EAEAEA" }}>
        <div className="max-w-[560px] mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 flex items-center justify-center rounded-lg" style={{ background: "linear-gradient(135deg, #7C3AED, #A78BFA)" }}>
              <i className="ri-film-line text-white text-[11px]" />
            </div>
            <span className="text-[13px] font-medium" style={{ fontFamily: "'Syne', sans-serif", color: "#8E8E93" }}>VibeClip Engine</span>
          </div>
          <p className="text-[12px]" style={{ color: "#AEAEB2" }}>© 2024 VibeClip. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}