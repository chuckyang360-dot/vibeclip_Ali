import { useState } from "react";
import { DemoCaseConfig } from "@/mocks/demoCases";

interface Props {
  demo: DemoCaseConfig;
  onNext: () => void;
  onPrev: () => void;
}

const SCRIPT_FIELD_META = [
  { key: "title" as const, label: "剧集标题", icon: "ri-quill-pen-line" },
  { key: "premise" as const, label: "故事前提 Premise", icon: "ri-book-open-line" },
  { key: "hook" as const, label: "钩子 Hook", icon: "ri-anchor-line" },
  { key: "conflict" as const, label: "核心冲突 Conflict", icon: "ri-sword-line" },
  { key: "twist" as const, label: "反转 Twist", icon: "ri-exchange-funds-line" },
  { key: "resolution" as const, label: "结尾 Resolution", icon: "ri-flag-line" },
];

export default function DemoStep2({ demo, onNext, onPrev }: Props) {
  const { step2 } = demo;
  const [expandedSeg, setExpandedSeg] = useState<number | null>(null);

  return (
    <div className="flex min-h-[calc(100vh-200px)]">
      {/* Left sidebar */}
      <aside
        className="hidden lg:flex flex-col w-64 shrink-0 p-6 pt-10 overflow-y-auto"
        style={{ borderRight: "1px solid #EAEAEA", background: "#F7F8FA" }}
      >
        <div className="mb-6">
          <p className="text-[10px] uppercase tracking-widest mb-3 font-bold" style={{ color: "#AEAEB2" }}>项目设置</p>
          {[
            { label: "时长", value: demo.create.duration },
            { label: "形式", value: demo.create.format === "single" ? "单条广告" : "系列短剧" },
            { label: "视觉", value: demo.create.visualStyle === "cinematic" ? "写实电影感" : demo.create.visualStyle === "animation" ? "动画风格" : demo.create.visualStyle === "3d" ? "3D 渲染" : "高级广告感" },
            { label: "比例", value: demo.create.ratio },
            { label: "市场", value: demo.step1.targetMarket.join(" · ") },
          ].map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between py-2.5"
              style={{ borderBottom: "1px solid #F0F0F0" }}
            >
              <span className="text-[12px]" style={{ color: "#8E8E93" }}>{item.label}</span>
              <span className="text-[12px] font-medium" style={{ color: "#444444" }}>{item.value}</span>
            </div>
          ))}
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-widest mb-3 font-bold" style={{ color: "#AEAEB2" }}>结构分析</p>
          <div className="space-y-3">
            {[
              { label: "叙事节奏", value: "快 → 中 → 缓压收", icon: "ri-pulse-line", color: "#B45309" },
              { label: "情绪弧线", value: "失落 → 探索 → 升华", icon: "ri-emotion-line", color: "#DC2626" },
              { label: "Hook 强度", value: "★★★★★", icon: "ri-star-line", color: "#B45309" },
            ].map((item) => (
              <div key={item.label} className="p-3.5 rounded-xl" style={{ background: "#ffffff", border: "1px solid #EAEAEA" }}>
                <div className="flex items-center gap-2 mb-1.5">
                  <i className={`${item.icon} text-[12px]`} style={{ color: item.color }} />
                  <span className="text-[11px]" style={{ color: "#8E8E93" }}>{item.label}</span>
                </div>
                <p className="text-[13px] font-semibold" style={{ color: "#1D1D1F" }}>{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto p-6 lg:p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <span className="text-[11px] font-bold tracking-widest uppercase" style={{ color: "#8E8E93" }}>STEP 02</span>
            <h1 className="text-2xl font-black mt-0.5" style={{ fontFamily: "'Syne', sans-serif", color: "#1D1D1F" }}>
              剧本大纲
            </h1>
          </div>
          <span
            className="flex items-center gap-1.5 text-[11.5px] font-medium px-3 py-1.5 rounded-full"
            style={{ background: "rgba(4,120,87,0.08)", color: "#047857", border: "1px solid rgba(4,120,87,0.18)" }}
          >
            <i className="ri-sparkling-2-line text-[12px]" />
            AI 已生成
          </span>
        </div>

        {/* Script fields */}
        <div className="space-y-3 mb-8">
          {SCRIPT_FIELD_META.map((field) => (
            <div
              key={field.key}
              className="p-5 rounded-2xl"
              style={{ background: "#ffffff", border: "1px solid #EAEAEA" }}
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 flex items-center justify-center rounded-lg" style={{ background: "#F5F5F7" }}>
                  <i className={`${field.icon} text-[12px]`} style={{ color: "#1D1D1F" }} />
                </div>
                <span className="text-[12px] font-bold uppercase tracking-wider" style={{ color: "#8E8E93" }}>
                  {field.label}
                </span>
              </div>
              <p
                className="leading-relaxed"
                style={{
                  color: "#444444",
                  fontFamily: field.key === "title" ? "'Syne', sans-serif" : "'Inter', sans-serif",
                  fontWeight: field.key === "title" ? 800 : 400,
                  fontSize: field.key === "title" ? "18px" : "13.5px",
                }}
              >
                {step2[field.key]}
              </p>
            </div>
          ))}
        </div>

        {/* Segment plan */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-5 h-5 flex items-center justify-center rounded-md" style={{ background: "#F5F5F7" }}>
              <i className="ri-layout-row-line text-[12px]" style={{ color: "#1D1D1F" }} />
            </div>
            <h3 className="text-[13px] font-bold uppercase tracking-wider" style={{ color: "#444444" }}>
              Segment Plan
            </h3>
          </div>
          <div className="space-y-3">
            {step2.segments.map((seg) => (
              <div
                key={seg.id}
                className="p-5 rounded-2xl cursor-pointer transition-all duration-200"
                style={{
                  background: "#ffffff",
                  border: expandedSeg === seg.id ? `1.5px solid ${seg.color}40` : "1px solid #EAEAEA",
                  boxShadow: expandedSeg === seg.id ? `0 2px 12px ${seg.color}10` : "none",
                }}
                onClick={() => setExpandedSeg(expandedSeg === seg.id ? null : seg.id)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 flex items-center justify-center rounded-lg shrink-0 text-[12px] font-bold"
                      style={{ background: `${seg.color}10`, color: seg.color }}
                    >
                      S{seg.id}
                    </div>
                    <div>
                      <span className="text-[14px] font-bold" style={{ color: "#1D1D1F" }}>{seg.name}</span>
                      <span className="ml-2 text-[11px]" style={{ color: "#8E8E93" }}>{seg.duration}</span>
                    </div>
                  </div>
                  <i
                    className={expandedSeg === seg.id ? "ri-arrow-up-s-line" : "ri-arrow-down-s-line"}
                    style={{ color: "#AEAEB2" }}
                  />
                </div>
                {expandedSeg === seg.id && (
                  <div className="grid grid-cols-3 gap-3 mt-4 text-[12px]">
                    <div>
                      <p className="mb-1" style={{ color: "#8E8E93" }}>目标</p>
                      <p className="leading-snug" style={{ color: "#444444" }}>{seg.goal}</p>
                    </div>
                    <div>
                      <p className="mb-1" style={{ color: "#8E8E93" }}>产品露出</p>
                      <p style={{ color: seg.color, fontWeight: 600 }}>{seg.productPlacement}</p>
                    </div>
                    <div>
                      <p className="mb-1" style={{ color: "#8E8E93" }}>剧情概要</p>
                      <p className="leading-snug" style={{ color: "#444444" }}>{seg.synopsis}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between pt-6" style={{ borderTop: "1px solid #EAEAEA" }}>
          <button
            onClick={onPrev}
            className="flex items-center gap-2 px-5 py-3 rounded-xl text-[13.5px] cursor-pointer whitespace-nowrap transition-all duration-200"
            style={{ background: "#F7F8FA", color: "#444444", border: "1px solid #EAEAEA" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#EAEAEA"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#F7F8FA"; }}
          >
            <i className="ri-arrow-left-line text-[13px]" />
            上一步
          </button>
          <button
            onClick={onNext}
            className="flex items-center gap-2 px-7 py-3 rounded-xl text-[14px] font-semibold cursor-pointer transition-all duration-200 whitespace-nowrap"
            style={{ background: "#1D1D1F", color: "#ffffff" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#374151"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#1D1D1F"; }}
          >
            查看角色与场景
            <i className="ri-arrow-right-line text-[13px]" />
          </button>
        </div>
      </main>
    </div>
  );
}
