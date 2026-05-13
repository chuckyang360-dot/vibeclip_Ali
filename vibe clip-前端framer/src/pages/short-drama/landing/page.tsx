import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import SDHero from "./components/SDHero";
import SDCapabilities from "./components/SDCapabilities";
import SDWorkflow from "./components/SDWorkflow";
import SDTargetAudience from "./components/SDTargetAudience";
import SDCases from "./components/SDCases";
import UserDropdown from "@/components/feature/UserDropdown";

export default function ShortDramaLanding() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div style={{ background: "#ffffff", fontFamily: "'Inter', sans-serif" }}>
      {/* Light global nav */}
      <header
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 lg:px-10 h-14 transition-all duration-300"
        style={{
          background: scrolled ? "rgba(255,255,255,0.98)" : "rgba(255,255,255,0.82)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderBottom: "1px solid #E5E5EA",
          boxShadow: scrolled ? "0 2px 12px rgba(0,0,0,0.06)" : "0 1px 0 rgba(0,0,0,0.04)",
        }}
      >
        {/* Logo */}
        <a href="/" className="flex items-center gap-2 cursor-pointer group" style={{ textDecoration: "none" }}>
          <div
            className="w-7 h-7 flex items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-105"
            style={{ background: "linear-gradient(135deg, #7C3AED, #A78BFA)" }}
          >
            <i className="ri-film-line text-white text-[13px]" />
          </div>
          <span
            className="text-[14px] font-bold whitespace-nowrap hidden sm:inline"
            style={{ fontFamily: "'Syne', sans-serif", color: "#1D1D1F" }}
          >
            VibeClip
          </span>
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 rounded-md hidden sm:inline"
            style={{ background: "#F5F3FF", color: "#7C3AED" }}
          >
            维播
          </span>
        </a>

        {/* Nav links */}
        <div className="hidden md:flex items-center gap-1">
          {[
            { label: "首页", href: "#capabilities" },
            { label: "流程", href: "#workflow" },
            { label: "案例", href: "#cases" },
            { label: "项目管理", href: "/projects" },
          ].map((item) => {
            const isHome = item.href === "#capabilities";
            return (
              <a
                key={item.label}
                href={item.href}
                className="px-3.5 py-1.5 text-[13.5px] font-medium rounded-lg cursor-pointer transition-all duration-200 whitespace-nowrap"
                style={{
                  color: isHome ? "#1D1D1F" : "#8E8E93",
                  textDecoration: "none",
                  background: isHome ? "#F5F5F7" : "transparent",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.color = "#1D1D1F";
                  (e.currentTarget as HTMLElement).style.background = "#F5F5F7";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.color = isHome ? "#1D1D1F" : "#8E8E93";
                  (e.currentTarget as HTMLElement).style.background = isHome ? "#F5F5F7" : "transparent";
                }}
              >
                {item.label}
              </a>
            );
          })}
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          <UserDropdown isLoggedIn={false} />
        </div>
      </header>

      <main>
        <SDHero />
        <SDCapabilities />
        <SDWorkflow />
        <SDTargetAudience />
        <SDCases />
      </main>

      {/* Footer */}
      <footer style={{ background: "#F7F8FA", borderTop: "1px solid #EAEAEA" }}>
        <div className="max-w-6xl mx-auto px-6 lg:px-10">
          {/* Upper */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-10 py-12">
            {/* Brand */}
            <div className="md:col-span-4">
              <a href="/" className="flex items-center gap-2 cursor-pointer group" style={{ textDecoration: "none" }}>
                <div className="w-7 h-7 flex items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-105" style={{ background: "linear-gradient(135deg, #7C3AED, #A78BFA)" }}>
                  <i className="ri-film-line text-white text-[13px]" />
                </div>
                <span className="text-[14px] font-bold whitespace-nowrap" style={{ fontFamily: "'Syne', sans-serif", color: "#1D1D1F" }}>VibeClip</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: "#F5F3FF", color: "#7C3AED" }}>维播</span>
              </a>
              <p className="text-[13px] mt-4 leading-relaxed max-w-xs" style={{ color: "#8E8E93" }}>
                AI 内容视频生成工作台，让创作、营销和内容生产更高效。
              </p>
            </div>

            {/* Nav groups */}
            <div className="md:col-span-4 grid grid-cols-2 gap-8">
              <div>
                <h4 className="text-[13.5px] font-semibold mb-3" style={{ color: "#1D1D1F" }}>产品</h4>
                <ul className="space-y-2.5">
                  {[
                    { label: "首页", href: "/#capabilities" },
                    { label: "流程", href: "/#workflow" },
                    { label: "案例", href: "/#cases" },
                    { label: "项目管理", href: "/projects" },
                    { label: "升级计划", href: "/billing/plans" },
                  ].map((l) => (
                    <li key={l.label}>
                      <a href={l.href} className="text-[13px] transition-colors duration-150 cursor-pointer" style={{ color: "#6E6E73", textDecoration: "none" }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#7C3AED"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#6E6E73"; }}
                      >{l.label}</a>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-[13.5px] font-semibold mb-3" style={{ color: "#1D1D1F" }}>支持</h4>
                <ul className="space-y-2.5">
                  {[
                    { label: "帮助文档", href: "/help" },
                    { label: "使用教程", href: "/tutorials" },
                    { label: "常见问题", href: "/faq" },
                    { label: "账户设置", href: "/account/settings" },
                    { label: "账单管理", href: "/billing" },
                  ].map((l) => (
                    <li key={l.label}>
                      <a href={l.href} className="text-[13px] transition-colors duration-150 cursor-pointer" style={{ color: "#6E6E73", textDecoration: "none" }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#7C3AED"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#6E6E73"; }}
                      >{l.label}</a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Business contact */}
            <div className="md:col-span-4">
              <h4 className="text-[13.5px] font-semibold mb-3" style={{ color: "#1D1D1F" }}>商务合作</h4>
              <div className="space-y-2 text-[13px]" style={{ color: "#6E6E73" }}>
                <p>联系人：杨阳</p>
                <p>
                  邮箱：
                  <a href="mailto:chuckyang360@gmail.com" className="transition-colors duration-150 cursor-pointer" style={{ color: "#6E6E73", textDecoration: "none" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#7C3AED"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#6E6E73"; }}
                  >chuckyang360@gmail.com</a>
                </p>
                <p>
                  电话：
                  <a href="tel:15990150310" className="transition-colors duration-150 cursor-pointer" style={{ color: "#6E6E73", textDecoration: "none" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#7C3AED"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#6E6E73"; }}
                  >15990150310</a>
                </p>
                <p className="text-[12.5px] pt-1" style={{ color: "#8E8E93" }}>
                  欢迎品牌、渠道、服务商与内容团队合作。
                </p>
              </div>
            </div>
          </div>

          {/* Lower */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 py-6" style={{ borderTop: "1px solid #EAEAEA" }}>
            <p className="text-[12px]" style={{ color: "#AEAEB2" }}>© 2026 VibeClip. All rights reserved.</p>
            <div className="flex items-center gap-4">
              {[
                { label: "服务协议", href: "/terms" },
                { label: "隐私政策", href: "/privacy" },
                { label: "订阅条款", href: "/subscription-terms" },
              ].map((l) => (
                <a key={l.label} href={l.href} className="text-[12px] transition-colors duration-150 cursor-pointer" style={{ color: "#8E8E93", textDecoration: "none" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#7C3AED"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#8E8E93"; }}
                >{l.label}</a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
