import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { DEMO_CASES, DemoCaseConfig } from "@/mocks/demoCases";
import UserDropdown from "@/components/feature/UserDropdown";
import DemoCreate from "./components/DemoCreate";
import DemoStep1 from "./components/DemoStep1";
import DemoStep2 from "./components/DemoStep2";
import DemoStep3 from "./components/DemoStep3";
import DemoOverview from "./components/DemoOverview";

type TabKey = "create" | "step1" | "step2" | "step3" | "overview";

const TABS: Array<{ key: TabKey; label: string; icon: string; step?: number }> = [
  { key: "create", label: "项目设置", icon: "ri-file-add-line" },
  { key: "step1", label: "产品输入", icon: "ri-upload-cloud-2-line", step: 1 },
  { key: "step2", label: "剧本大纲", icon: "ri-pen-nib-line", step: 2 },
  { key: "step3", label: "角色场景", icon: "ri-user-star-line", step: 3 },
  { key: "overview", label: "最终成片", icon: "ri-film-line" },
];

export default function DemoPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabKey>("create");

  const demo: DemoCaseConfig | undefined = DEMO_CASES.find((c) => c.id === caseId);

  if (!demo) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#F7F8FA" }}>
        <div className="text-center">
          <p className="text-[16px] font-semibold mb-4" style={{ color: "#1D1D1F" }}>案例不存在</p>
          <button
            onClick={() => navigate("/")}
            className="px-6 py-2.5 rounded-xl text-[13px] font-medium cursor-pointer"
            style={{ background: "#1D1D1F", color: "#ffffff" }}
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  const currentTabIndex = TABS.findIndex((t) => t.key === activeTab);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#F7F8FA", fontFamily: "'Inter', sans-serif" }}>
      {/* Top nav */}
      <header
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 lg:px-10 h-14"
        style={{ background: "rgba(255,255,255,0.96)", backdropFilter: "blur(16px)", borderBottom: "1px solid #EAEAEA" }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 cursor-pointer shrink-0"
          >
            <div
              className="w-7 h-7 flex items-center justify-center rounded-lg"
              style={{ background: "linear-gradient(135deg, #7C3AED, #A78BFA)" }}
            >
              <i className="ri-film-line text-white text-[13px]" />
            </div>
            <span className="text-[14px] font-bold hidden sm:block" style={{ fontFamily: "'Syne', sans-serif", color: "#1D1D1F" }}>
              VibeClip
            </span>
          </button>
          <span style={{ color: "#D1D1D6" }}>/</span>
          <span className="text-[12px] truncate max-w-[200px]" style={{ color: "#8E8E93" }}>案例展示</span>
          <span style={{ color: "#D1D1D6" }}>/</span>
          <span className="text-[12px] font-semibold truncate max-w-[180px]" style={{ color: "#1D1D1F" }}>{demo.title}</span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Read-only badge */}
          <span
            className="hidden sm:flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-full"
            style={{ background: "rgba(180,83,9,0.08)", color: "#B45309", border: "1px solid rgba(180,83,9,0.2)" }}
          >
            <i className="ri-eye-line text-[11px]" />
            仅供展示
          </span>
          <button
            onClick={() => navigate("/create")}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[12.5px] font-semibold cursor-pointer whitespace-nowrap transition-all duration-200"
            style={{ background: "#1D1D1F", color: "#ffffff" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#374151"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#1D1D1F"; }}
          >
            <i className="ri-add-circle-line text-[12px]" />
            创建我的项目
          </button>
          <UserDropdown compact isLoggedIn={false} />
        </div>
      </header>

      {/* Case info banner */}
      <div
        className="pt-14"
        style={{ background: "#ffffff", borderBottom: "1px solid #EAEAEA" }}
      >
        <div className="px-6 lg:px-10 py-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0">
            <img src={demo.img} alt={demo.title} className="w-full h-full object-cover object-top" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span
                className="text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider"
                style={{ background: `${demo.color}10`, color: demo.color, border: `1px solid ${demo.color}25` }}
              >
                {demo.genre}
              </span>
              <span className="text-[11px]" style={{ color: "#8E8E93" }}>{demo.industry} · {demo.market}</span>
            </div>
            <h1 className="text-[18px] font-black" style={{ fontFamily: "'Syne', sans-serif", color: "#1D1D1F" }}>
              {demo.title}
            </h1>
            <p className="text-[12px] mt-0.5 line-clamp-1" style={{ color: "#6E6E73" }}>{demo.desc}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {[demo.duration, demo.platform, demo.style].map((tag) => (
              <span
                key={tag}
                className="text-[11px] px-2.5 py-1 rounded-full hidden md:block"
                style={{ background: "#F5F5F7", color: "#6E6E73", border: "1px solid #EAEAEA" }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Tab bar */}
        <div className="px-6 lg:px-10 flex items-center gap-0 overflow-x-auto" style={{ borderTop: "1px solid #F5F5F7" }}>
          {TABS.map((tab, idx) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="flex items-center gap-2 px-5 py-3.5 text-[13px] font-medium cursor-pointer transition-all duration-200 whitespace-nowrap shrink-0 relative"
              style={{
                color: activeTab === tab.key ? "#1D1D1F" : "#8E8E93",
                borderBottom: activeTab === tab.key ? "2px solid #1D1D1F" : "2px solid transparent",
                background: "transparent",
              }}
            >
              <i className={`${tab.icon} text-[13px]`} />
              {tab.step && (
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                  style={{
                    background: activeTab === tab.key ? "#1D1D1F" : "#EAEAEA",
                    color: activeTab === tab.key ? "#ffffff" : "#8E8E93",
                  }}
                >
                  S{tab.step}
                </span>
              )}
              {tab.label}
              {idx < TABS.length - 1 && (
                <i
                  className="ri-arrow-right-s-line text-[12px] absolute -right-1"
                  style={{ color: "#D1D1D6" }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Read-only notice */}
      <div
        className="px-6 lg:px-10 py-2.5 flex items-center gap-2"
        style={{ background: "rgba(180,83,9,0.04)", borderBottom: "1px solid rgba(180,83,9,0.1)" }}
      >
        <i className="ri-lock-line text-[12px]" style={{ color: "#B45309" }} />
        <p className="text-[11.5px]" style={{ color: "#B45309" }}>
          这是展示案例，所有内容仅供参考，不可编辑。
          <button
            onClick={() => navigate("/create")}
            className="ml-2 font-semibold underline cursor-pointer"
            style={{ color: "#B45309" }}
          >
            创建你自己的项目 →
          </button>
        </p>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "create" && <DemoCreate demo={demo} onNext={() => setActiveTab("step1")} />}
        {activeTab === "step1" && <DemoStep1 demo={demo} onNext={() => setActiveTab("step2")} onPrev={() => setActiveTab("create")} />}
        {activeTab === "step2" && <DemoStep2 demo={demo} onNext={() => setActiveTab("step3")} onPrev={() => setActiveTab("step1")} />}
        {activeTab === "step3" && <DemoStep3 demo={demo} onNext={() => setActiveTab("overview")} onPrev={() => setActiveTab("step2")} />}
        {activeTab === "overview" && <DemoOverview demo={demo} onPrev={() => setActiveTab("step3")} />}
      </div>

      {/* Bottom step nav */}
      <div
        className="px-6 lg:px-10 py-3 flex items-center justify-between shrink-0"
        style={{ background: "#ffffff", borderTop: "1px solid #EAEAEA" }}
      >
        <button
          onClick={() => {
            if (currentTabIndex > 0) setActiveTab(TABS[currentTabIndex - 1].key);
            else navigate("/");
          }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] cursor-pointer whitespace-nowrap transition-all duration-200"
          style={{ background: "#F7F8FA", color: "#444444", border: "1px solid #EAEAEA" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#EAEAEA"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#F7F8FA"; }}
        >
          <i className="ri-arrow-left-line text-[12px]" />
          {currentTabIndex === 0 ? "返回案例列表" : "上一步"}
        </button>

        <div className="flex items-center gap-1.5">
          {TABS.map((tab, idx) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="w-2 h-2 rounded-full cursor-pointer transition-all duration-200"
              style={{
                background: activeTab === tab.key ? "#1D1D1F" : "#D1D1D6",
                transform: activeTab === tab.key ? "scale(1.3)" : "scale(1)",
              }}
            />
          ))}
        </div>

        {currentTabIndex < TABS.length - 1 ? (
          <button
            onClick={() => setActiveTab(TABS[currentTabIndex + 1].key)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold cursor-pointer whitespace-nowrap transition-all duration-200"
            style={{ background: "#1D1D1F", color: "#ffffff" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#374151"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#1D1D1F"; }}
          >
            下一步：{TABS[currentTabIndex + 1].label}
            <i className="ri-arrow-right-line text-[12px]" />
          </button>
        ) : (
          <button
            onClick={() => navigate("/create")}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold cursor-pointer whitespace-nowrap transition-all duration-200"
            style={{ background: "#1D1D1F", color: "#ffffff" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#374151"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#1D1D1F"; }}
          >
            <i className="ri-add-circle-line text-[12px]" />
            创建我的项目
          </button>
        )}
      </div>
    </div>
  );
}
