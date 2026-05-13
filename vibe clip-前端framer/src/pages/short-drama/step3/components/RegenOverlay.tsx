import { useEffect, useRef } from "react";

export type RegenPhase = "analyzing" | "rendering" | "refining" | "complete";

interface Props {
  phase: RegenPhase;
  img: string;
}

const PHASE_META: Record<RegenPhase, { label: string; icon: string; progress: number }> = {
  analyzing: { label: "正在分析提示词...", icon: "ri-search-eye-line", progress: 18 },
  rendering: { label: "构建视觉风格...", icon: "ri-palette-line", progress: 52 },
  refining: { label: "渲染细节中...", icon: "ri-focus-3-line", progress: 84 },
  complete: { label: "生成完成", icon: "ri-checkbox-circle-fill", progress: 100 },
};

export default function RegenOverlay({ phase, img }: Props) {
  const styleInjected = useRef(false);

  useEffect(() => {
    if (styleInjected.current) return;
    const id = "sd-regen-keyframes";
    if (document.getElementById(id)) { styleInjected.current = true; return; }
    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
      @keyframes sd-scan {
        0%   { top: -3px; opacity: 0; }
        5%   { opacity: 1; }
        92%  { opacity: 1; }
        100% { top: 100%; opacity: 0; }
      }
      @keyframes sd-shimmer {
        0%   { background-position: -600px 0; }
        100% { background-position: 600px 0; }
      }
      @keyframes sd-deblur {
        0%   { filter: blur(14px) brightness(1.06) saturate(0.4); opacity: 0.7; }
        100% { filter: blur(0px)  brightness(1)    saturate(1);   opacity: 1; }
      }
      @keyframes sd-complete-flash {
        0%   { opacity: 0; transform: scale(0.9); }
        30%  { opacity: 1; transform: scale(1); }
        70%  { opacity: 1; }
        100% { opacity: 0; }
      }
      @keyframes sd-progress-fill {
        from { width: 0%; }
      }
    `;
    document.head.appendChild(style);
    styleInjected.current = true;
  }, []);

  const meta = PHASE_META[phase];

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* ── Phase: analyzing ── scan line + noise bg */}
      {phase === "analyzing" && (
        <>
          <div className="absolute inset-0" style={{ background: "#F0F0F5" }} />
          {/* grid noise pattern */}
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.04) 3px, rgba(0,0,0,0.04) 4px), repeating-linear-gradient(90deg, transparent, transparent 3px, rgba(0,0,0,0.04) 3px, rgba(0,0,0,0.04) 4px)",
            }}
          />
          {/* scan line */}
          <div
            className="absolute left-0 right-0 pointer-events-none"
            style={{
              height: "3px",
              background: "linear-gradient(90deg, transparent 0%, rgba(29,29,31,0.15) 20%, rgba(29,29,31,0.9) 50%, rgba(29,29,31,0.15) 80%, transparent 100%)",
              animation: "sd-scan 1.3s ease-in-out infinite",
              boxShadow: "0 0 12px 3px rgba(29,29,31,0.25), 0 0 24px 6px rgba(29,29,31,0.1)",
            }}
          />
        </>
      )}

      {/* ── Phase: rendering ── shimmer skeleton */}
      {phase === "rendering" && (
        <>
          <div className="absolute inset-0" style={{ background: "#EAEAEA" }} />
          <div
            className="absolute inset-0"
            style={{
              background: "linear-gradient(90deg, #EAEAEA 0%, #F5F5F7 40%, #ffffff 50%, #F5F5F7 60%, #EAEAEA 100%)",
              backgroundSize: "600px 100%",
              animation: "sd-shimmer 1.4s ease-in-out infinite",
            }}
          />
          {/* placeholder shapes */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 opacity-30">
            <div className="w-16 h-16 rounded-full" style={{ background: "#D1D1D6" }} />
            <div className="w-24 h-2 rounded-full" style={{ background: "#D1D1D6" }} />
            <div className="w-16 h-2 rounded-full" style={{ background: "#D1D1D6" }} />
          </div>
        </>
      )}

      {/* ── Phase: refining ── blurry image deblurring */}
      {phase === "refining" && (
        <img
          src={img}
          alt=""
          className="w-full h-full object-contain"
          style={{ animation: "sd-deblur 1.1s ease-out forwards" }}
        />
      )}

      {/* ── Phase: complete ── green flash */}
      {phase === "complete" && (
        <>
          <img src={img} alt="" className="w-full h-full object-contain" />
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-2"
            style={{
              background: "rgba(4,120,87,0.12)",
              animation: "sd-complete-flash 1.0s ease-in-out forwards",
            }}
          >
            <div
              className="w-11 h-11 flex items-center justify-center rounded-full"
              style={{ background: "rgba(4,120,87,0.18)", border: "1.5px solid rgba(4,120,87,0.5)" }}
            >
              <i className="ri-checkbox-circle-fill text-[22px]" style={{ color: "#047857" }} />
            </div>
            <span className="text-[11px] font-semibold" style={{ color: "#047857" }}>生成完成</span>
          </div>
        </>
      )}

      {/* ── Status bar (shown for all except complete) ── */}
      {phase !== "complete" && (
        <div
          className="absolute bottom-0 left-0 right-0 flex items-center gap-2.5 px-3 py-2.5"
          style={{ background: "rgba(255,255,255,0.92)", backdropFilter: "blur(8px)", borderTop: "1px solid rgba(0,0,0,0.06)" }}
        >
          <div
            className="w-5 h-5 flex items-center justify-center rounded-full shrink-0"
            style={{ background: "#1D1D1F" }}
          >
            <i className={`${meta.icon} text-[9px] text-white`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-medium mb-1 truncate" style={{ color: "#1D1D1F" }}>{meta.label}</p>
            <div className="w-full h-[3px] rounded-full overflow-hidden" style={{ background: "#EAEAEA" }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${meta.progress}%`,
                  background: "#1D1D1F",
                  transition: "width 0.6s ease-out",
                  animation: "sd-progress-fill 0.4s ease-out",
                }}
              />
            </div>
          </div>
          <span className="text-[10px] shrink-0" style={{ color: "#8E8E93" }}>{meta.progress}%</span>
        </div>
      )}
    </div>
  );
}
