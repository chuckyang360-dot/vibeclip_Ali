import { useState } from "react";
import { useNavigate } from "react-router-dom";
import SDSharedNav from "@/pages/short-drama/components/SDSharedNav";

const DURATION_OPTIONS = ["30s", "45s", "60s"];
const FORMAT_OPTIONS = [
  { value: "single", label: "单条广告", desc: "独立完整的广告短片" },
  { value: "series", label: "系列短剧", desc: "2-5集连载剧情内容" },
];
const PLOT_STYLES = [
  { value: "twist", label: "反转", icon: "ri-exchange-line" },
  { value: "conflict", label: "冲突", icon: "ri-sword-line" },
  { value: "suspense", label: "悬疑", icon: "ri-eye-2-line" },
  { value: "comedy", label: "搞笑", icon: "ri-emotion-laugh-line" },
  { value: "emotion", label: "情绪", icon: "ri-heart-pulse-line" },
];
const VISUAL_STYLES = [
  { value: "cinematic", label: "写实电影感", icon: "ri-camera-lens-line" },
  { value: "animation", label: "动画风格", icon: "ri-brush-line" },
  { value: "3d", label: "3D 渲染", icon: "ri-shape-2-line" },
  { value: "premium_ad", label: "高级广告感", icon: "ri-sparkling-2-line" },
];
const RATIOS = ["9:16", "16:9", "1:1"];

const FLOW_STEPS = [
  { icon: "ri-file-add-line", title: "项目初始化", desc: "设置名称与形式", step: 0 },
  { icon: "ri-upload-cloud-2-line", title: "产品输入", desc: "上传产品资料", step: 1 },
  { icon: "ri-pen-nib-line", title: "剧本大纲", desc: "AI 生成结构", step: 2 },
  { icon: "ri-user-star-line", title: "角色场景", desc: "视觉资产生成", step: 3 },
  { icon: "ri-movie-2-line", title: "片段视频", desc: "脚本与视频", step: 4 },
];

export default function CreateProjectPage() {
  const navigate = useNavigate();
  const [projectName, setProjectName] = useState("");
  const [duration, setDuration] = useState("60s");
  const [format, setFormat] = useState("single");
  const [plotStyle, setPlotStyle] = useState<string[]>(["conflict"]);
  const [visualStyle, setVisualStyle] = useState("cinematic");
  const [ratio, setRatio] = useState("9:16");

  const togglePlotStyle = (v: string) => {
    setPlotStyle((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]);
  };

  return (
    <div className="min-h-screen" style={{ background: "#ffffff", fontFamily: "'Inter', sans-serif" }}>
      <SDSharedNav />
      <div className="flex min-h-screen pt-14">
        {/* Left sidebar */}
        <aside
          className="hidden lg:flex flex-col w-72 shrink-0 p-8 pt-10"
          style={{ borderRight: "1px solid #EAEAEA", background: "#F7F8FA" }}
        >
          <div className="mb-8">
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4 text-[10px] font-semibold tracking-widest uppercase"
              style={{ background: "#F5F5F7", color: "#6E6E73", border: "1px solid #E5E5EA" }}
            >
              <i className="ri-add-circle-line" />
              新建项目
            </div>
            <h2 className="text-xl font-black mb-3" style={{ fontFamily: "'Syne', sans-serif", color: "#1D1D1F" }}>
              创建短剧项目
            </h2>
            <p className="text-[13px] leading-relaxed" style={{ color: "#8E8E93" }}>
              设置基础参数，系统将根据这些设定规划剧情节奏与视觉风格。
            </p>
          </div>

          <div className="space-y-1">
            {FLOW_STEPS.map((s) => (
              <div
                key={s.title}
                className="flex items-start gap-3 p-3 rounded-xl transition-colors duration-150"
                style={{ background: s.step === 0 ? "#ffffff" : "transparent", border: s.step === 0 ? "1px solid #EAEAEA" : "1px solid transparent" }}
              >
                <div
                  className="w-7 h-7 flex items-center justify-center rounded-lg shrink-0"
                  style={{ background: s.step === 0 ? "#1D1D1F" : "#EAEAEA" }}
                >
                  <i className={`${s.icon} text-[13px]`} style={{ color: s.step === 0 ? "#ffffff" : "#8E8E93" }} />
                </div>
                <div>
                  <p className="text-[12.5px] font-semibold" style={{ color: s.step === 0 ? "#1D1D1F" : "#8E8E93" }}>
                    {s.title}
                  </p>
                  <p className="text-[11px]" style={{ color: "#AEAEB2" }}>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Main form */}
        <main className="flex-1 p-6 lg:p-12 overflow-y-auto" style={{ maxWidth: "680px" }}>
          <div className="mb-8">
            <span className="text-[11px] font-bold tracking-widest uppercase" style={{ color: "#8E8E93" }}>
              新建项目
            </span>
            <h1 className="text-2xl font-black mt-1" style={{ fontFamily: "'Syne', sans-serif", color: "#1D1D1F" }}>
              项目设置
            </h1>
          </div>

          <div className="space-y-8">
            {/* Project name */}
            <div>
              <label className="block text-[13px] font-semibold mb-2" style={{ color: "#444444" }}>
                项目名称 <span style={{ color: "#DC2626" }}>*</span>
              </label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="例如：北欧家具欧洲市场春季短剧"
                className="w-full px-4 py-3 rounded-xl text-[14px] outline-none transition-all duration-200"
                style={{ background: "#F7F8FA", border: "1px solid #EAEAEA", color: "#1D1D1F" }}
                onFocus={(e) => { e.currentTarget.style.border = "1px solid #1D1D1F"; e.currentTarget.style.background = "#ffffff"; }}
                onBlur={(e) => { e.currentTarget.style.border = "1px solid #EAEAEA"; e.currentTarget.style.background = "#F7F8FA"; }}
              />
            </div>

            {/* Duration */}
            <div>
              <label className="block text-[13px] font-semibold mb-3" style={{ color: "#444444" }}>视频时长</label>
              <div className="flex gap-3">
                {DURATION_OPTIONS.map((d) => (
                  <button
                    key={d}
                    onClick={() => setDuration(d)}
                    className="flex-1 py-3 rounded-xl text-[14px] font-semibold cursor-pointer transition-all duration-200 whitespace-nowrap"
                    style={{
                      background: duration === d ? "#1D1D1F" : "#F7F8FA",
                      border: `1px solid ${duration === d ? "#1D1D1F" : "#EAEAEA"}`,
                      color: duration === d ? "#ffffff" : "#8E8E93",
                    }}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {/* Format */}
            <div>
              <label className="block text-[13px] font-semibold mb-3" style={{ color: "#444444" }}>内容形式</label>
              <div className="grid grid-cols-2 gap-3">
                {FORMAT_OPTIONS.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setFormat(f.value)}
                    className="p-4 rounded-xl text-left cursor-pointer transition-all duration-200"
                    style={{
                      background: format === f.value ? "#1D1D1F" : "#F7F8FA",
                      border: `1px solid ${format === f.value ? "#1D1D1F" : "#EAEAEA"}`,
                    }}
                  >
                    <p className="text-[13.5px] font-semibold mb-1" style={{ color: format === f.value ? "#ffffff" : "#1D1D1F" }}>
                      {f.label}
                    </p>
                    <p className="text-[11.5px]" style={{ color: format === f.value ? "rgba(255,255,255,0.6)" : "#8E8E93" }}>
                      {f.desc}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Plot style (multi-select) */}
            <div>
              <label className="block text-[13px] font-semibold mb-3" style={{ color: "#444444" }}>
                剧情风格（可多选）
              </label>
              <div className="flex flex-wrap gap-2">
                {PLOT_STYLES.map((s) => {
                  const active = plotStyle.includes(s.value);
                  return (
                    <button
                      key={s.value}
                      onClick={() => togglePlotStyle(s.value)}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-medium cursor-pointer transition-all duration-200 whitespace-nowrap"
                      style={{
                        background: active ? "#1D1D1F" : "#F7F8FA",
                        border: `1px solid ${active ? "#1D1D1F" : "#EAEAEA"}`,
                        color: active ? "#ffffff" : "#6E6E73",
                      }}
                    >
                      <i className={`${s.icon} text-[13px]`} />
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Visual style */}
            <div>
              <label className="block text-[13px] font-semibold mb-3" style={{ color: "#444444" }}>视觉风格</label>
              <div className="grid grid-cols-2 gap-3">
                {VISUAL_STYLES.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => setVisualStyle(s.value)}
                    className="flex items-center gap-3 p-4 rounded-xl cursor-pointer transition-all duration-200"
                    style={{
                      background: visualStyle === s.value ? "#1D1D1F" : "#F7F8FA",
                      border: `1px solid ${visualStyle === s.value ? "#1D1D1F" : "#EAEAEA"}`,
                    }}
                  >
                    <div
                      className="w-8 h-8 flex items-center justify-center rounded-lg shrink-0"
                      style={{ background: visualStyle === s.value ? "rgba(255,255,255,0.15)" : "#EAEAEA" }}
                    >
                      <i
                        className={`${s.icon} text-[14px]`}
                        style={{ color: visualStyle === s.value ? "#ffffff" : "#6E6E73" }}
                      />
                    </div>
                    <span
                      className="text-[13px] font-medium"
                      style={{ color: visualStyle === s.value ? "#ffffff" : "#444444" }}
                    >
                      {s.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Ratio */}
            <div>
              <label className="block text-[13px] font-semibold mb-3" style={{ color: "#444444" }}>画面比例</label>
              <div className="flex gap-3">
                {RATIOS.map((r) => (
                  <button
                    key={r}
                    onClick={() => setRatio(r)}
                    className="flex-1 py-3 rounded-xl text-[14px] font-semibold cursor-pointer transition-all duration-200 whitespace-nowrap"
                    style={{
                      background: ratio === r ? "#1D1D1F" : "#F7F8FA",
                      border: `1px solid ${ratio === r ? "#1D1D1F" : "#EAEAEA"}`,
                      color: ratio === r ? "#ffffff" : "#8E8E93",
                    }}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom CTA */}
          <div
            className="mt-10 pt-8 flex items-center justify-between"
            style={{ borderTop: "1px solid #EAEAEA" }}
          >
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-2 px-5 py-3 rounded-xl text-[13.5px] cursor-pointer transition-all duration-200 whitespace-nowrap"
              style={{ background: "#F7F8FA", color: "#444444", border: "1px solid #EAEAEA" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#EAEAEA"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#F7F8FA"; }}
            >
              <i className="ri-arrow-left-line text-[13px]" />
              返回
            </button>
            <button
              onClick={() => navigate("/step1")}
              disabled={!projectName.trim()}
              className="flex items-center gap-2 px-7 py-3 rounded-xl text-[14px] font-semibold cursor-pointer transition-all duration-200 whitespace-nowrap"
              style={{
                background: projectName.trim() ? "#1D1D1F" : "#F5F5F7",
                color: projectName.trim() ? "#ffffff" : "#AEAEB2",
                cursor: projectName.trim() ? "pointer" : "not-allowed",
              }}
              onMouseEnter={(e) => { if (projectName.trim()) (e.currentTarget as HTMLElement).style.background = "#374151"; }}
              onMouseLeave={(e) => { if (projectName.trim()) (e.currentTarget as HTMLElement).style.background = "#1D1D1F"; }}
            >
              下一步：输入产品信息
              <i className="ri-arrow-right-line text-[13px]" />
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}
