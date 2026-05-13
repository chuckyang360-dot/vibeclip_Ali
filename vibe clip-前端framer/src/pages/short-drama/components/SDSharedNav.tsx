import { useNavigate } from "react-router-dom";
import UserDropdown from "@/components/feature/UserDropdown";

const STEPS = [
  { label: "产品输入", path: "/step1", step: 1 },
  { label: "剧本大纲", path: "/step2", step: 2 },
  { label: "角色场景", path: "/step3", step: 3 },
  { label: "片段视频", path: "/step4", step: 4 },
];

interface SDSharedNavProps {
  currentStep?: number;
  projectName?: string;
}

export default function SDSharedNav({ currentStep, projectName }: SDSharedNavProps) {
  const navigate = useNavigate();

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50"
      style={{
        background: "#ffffff",
        borderBottom: "1px solid #EAEAEA",
        boxShadow: "0 1px 6px rgba(0,0,0,0.05)",
      }}
    >
      <div className="mx-auto px-6 lg:px-10 flex items-center justify-between h-14" style={{ maxWidth: "1440px" }}>
        {/* Left: brand + project name */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 cursor-pointer group"
          >
            <div
              className="w-7 h-7 flex items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-105"
              style={{ background: "linear-gradient(135deg, #7C3AED, #A78BFA)" }}
            >
              <i className="ri-film-line text-white text-[13px]" />
            </div>
            <span
              className="text-[14px] font-bold whitespace-nowrap"
              style={{ fontFamily: "'Syne', sans-serif", color: "#1D1D1F" }}
            >
              VibeClip
            </span>
          </button>

          {projectName && (
            <>
              <span className="text-[#AEAEB2] text-[14px]">/</span>
              <span className="text-[13px] max-w-[160px] truncate whitespace-nowrap" style={{ color: "#8E8E93" }}>
                {projectName}
              </span>
            </>
          )}
        </div>

        {/* Center: step indicators */}
        {currentStep !== undefined && (
          <div className="hidden md:flex items-center gap-1">
            {STEPS.map((s, idx) => {
              const isActive = s.step === currentStep;
              const isDone = s.step < currentStep;
              return (
                <div key={s.step} className="flex items-center">
                  <button
                    onClick={() => isDone && navigate(s.path)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12.5px] font-medium transition-all duration-200 whitespace-nowrap"
                    style={{
                      cursor: isDone ? "pointer" : isActive ? "default" : "not-allowed",
                      background: isActive ? "#1D1D1F" : isDone ? "rgba(5,150,105,0.08)" : "transparent",
                      color: isActive ? "#ffffff" : isDone ? "#047857" : "#AEAEB2",
                    }}
                    onMouseEnter={(e) => {
                      if (isDone) {
                        (e.currentTarget as HTMLElement).style.background = "rgba(5,150,105,0.14)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (isDone) {
                        (e.currentTarget as HTMLElement).style.background = "rgba(5,150,105,0.08)";
                      }
                    }}
                  >
                    <span
                      className="w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold shrink-0"
                      style={{
                        background: isActive ? "rgba(255,255,255,0.2)" : isDone ? "#047857" : "#F5F5F7",
                        color: isActive ? "#fff" : isDone ? "#fff" : "#AEAEB2",
                      }}
                    >
                      {isDone ? <i className="ri-check-line text-[10px]" /> : s.step}
                    </span>
                    {s.label}
                  </button>
                  {idx < STEPS.length - 1 && (
                    <i className="ri-arrow-right-s-line text-[14px] mx-0.5" style={{ color: "#D1D1D6" }} />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Right: actions */}
        <div className="flex items-center gap-2 shrink-0">
          <div style={{ width: "1px", height: "20px", background: "#EAEAEA" }} />
          <UserDropdown compact isLoggedIn={false} />
          <div style={{ width: "1px", height: "20px", background: "#EAEAEA" }} />
          <button
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[12.5px] font-medium cursor-pointer transition-all duration-200 whitespace-nowrap"
            style={{
              background: "#F7F8FA",
              color: "#444444",
              border: "1px solid #EAEAEA",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "#EAEAEA";
              (e.currentTarget as HTMLElement).style.color = "#1D1D1F";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "#F7F8FA";
              (e.currentTarget as HTMLElement).style.color = "#444444";
            }}
          >
            <i className="ri-save-line text-[12px]" />
            保存草稿
          </button>
        </div>
      </div>
    </header>
  );
}
