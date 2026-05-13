import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DemoCaseConfig } from "@/mocks/demoCases";

interface Props {
  demo: DemoCaseConfig;
  onPrev: () => void;
}

export default function DemoOverview({ demo, onPrev }: Props) {
  const navigate = useNavigate();
  const { overview, step3 } = demo;
  const [playingSegment, setPlayingSegment] = useState<number | null>(null);

  const handlePlay = (id: number) => {
    setPlayingSegment(id);
    setTimeout(() => setPlayingSegment(null), 2000);
  };

  return (
    <div className="px-6 lg:px-10 py-10" style={{ background: "#F7F8FA" }}>
      <div className="max-w-6xl mx-auto">
        {/* Project header */}
        <div className="flex flex-col md:flex-row items-start justify-between gap-6 mb-10">
          <div>
            <div
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-3 text-[10px] font-bold uppercase tracking-widest"
              style={{ background: "rgba(4,120,87,0.08)", color: "#047857", border: "1px solid rgba(4,120,87,0.2)" }}
            >
              <i className="ri-checkbox-circle-fill text-[10px]" />
              项目已完成
            </div>
            <h1 className="text-3xl font-black mb-3" style={{ fontFamily: "'Syne', sans-serif", color: "#1D1D1F" }}>
              {demo.create.projectName}
            </h1>
            <div className="flex flex-wrap gap-2">
              {Object.entries({
                时长: overview.duration,
                形式: overview.format,
                比例: overview.ratio,
                风格: overview.style,
                视觉: overview.visual,
                市场: overview.market,
              }).map(([k, v]) => (
                <span key={k} className="text-[11.5px] px-3 py-1 rounded-full" style={{ background: "#EAEAEA", color: "#444444" }}>
                  {k}：{v}
                </span>
              ))}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span
              className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-full"
              style={{ background: "rgba(180,83,9,0.08)", color: "#B45309", border: "1px solid rgba(180,83,9,0.2)" }}
            >
              <i className="ri-eye-line text-[11px]" />
              展示案例
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column */}
          <div className="lg:col-span-1 space-y-4">
            {/* Plot summary */}
            <div className="p-5 rounded-2xl" style={{ background: "#ffffff", border: "1px solid #EAEAEA" }}>
              <h3 className="text-[12px] font-bold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: "#8E8E93" }}>
                <i className="ri-book-open-line text-[12px]" style={{ color: "#1D1D1F" }} />
                剧情摘要
              </h3>
              <p className="text-[13px] leading-relaxed" style={{ color: "#444444" }}>
                {overview.plotSummary}
              </p>
            </div>

            {/* Characters */}
            <div className="p-5 rounded-2xl" style={{ background: "#ffffff", border: "1px solid #EAEAEA" }}>
              <h3 className="text-[12px] font-bold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: "#8E8E93" }}>
                <i className="ri-user-star-line text-[12px]" style={{ color: "#1D1D1F" }} />
                角色 ({step3.characters.length})
              </h3>
              <div className="flex flex-wrap gap-3">
                {step3.characters.map((c) => (
                  <div key={c.name} className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-full overflow-hidden shrink-0">
                      <img src={c.img} alt={c.name} className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <p className="text-[12.5px] font-semibold" style={{ color: "#1D1D1F" }}>{c.name}</p>
                      <p className="text-[10.5px]" style={{ color: "#8E8E93" }}>{c.role}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Scenes */}
            <div className="p-5 rounded-2xl" style={{ background: "#ffffff", border: "1px solid #EAEAEA" }}>
              <h3 className="text-[12px] font-bold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: "#8E8E93" }}>
                <i className="ri-landscape-line text-[12px]" style={{ color: "#047857" }} />
                场景 ({step3.scenes.length})
              </h3>
              <div className="space-y-1.5">
                {step3.scenes.map((s) => (
                  <div key={s.name} className="flex items-center gap-2 text-[12.5px]" style={{ color: "#444444" }}>
                    <i className="ri-checkbox-circle-fill text-[11px]" style={{ color: "#047857" }} />
                    {s.name} · {s.type}
                  </div>
                ))}
              </div>
            </div>

            {/* Products */}
            <div className="p-5 rounded-2xl" style={{ background: "#ffffff", border: "1px solid #EAEAEA" }}>
              <h3 className="text-[12px] font-bold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: "#8E8E93" }}>
                <i className="ri-archive-line text-[12px]" style={{ color: "#DC2626" }} />
                产品资产 ({step3.products.length})
              </h3>
              <div className="space-y-1.5">
                {step3.products.map((p) => (
                  <div key={p.name} className="flex items-center gap-2 text-[12.5px]" style={{ color: "#444444" }}>
                    <i className="ri-checkbox-circle-fill text-[11px]" style={{ color: "#DC2626" }} />
                    {p.name}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right columns */}
          <div className="lg:col-span-2 space-y-5">
            {/* Segments preview */}
            <div className="p-5 rounded-2xl" style={{ background: "#ffffff", border: "1px solid #EAEAEA" }}>
              <h3 className="text-[12px] font-bold uppercase tracking-wider mb-4 flex items-center gap-2" style={{ color: "#8E8E93" }}>
                <i className="ri-layout-row-line text-[12px]" style={{ color: "#1D1D1F" }} />
                片段预览
              </h3>
              <div className="grid grid-cols-3 gap-4">
                {overview.segments.map((seg) => (
                  <div key={seg.id}>
                    <div
                      className="relative w-full rounded-xl overflow-hidden mb-2 cursor-pointer group"
                      style={{ aspectRatio: "9/16", border: `1px solid ${seg.color}25` }}
                      onClick={() => handlePlay(seg.id)}
                    >
                      <img src={seg.img} alt={seg.name} className="w-full h-full object-cover object-top" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-200 flex items-center justify-center">
                        <div className="w-10 h-10 flex items-center justify-center rounded-full bg-white/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all duration-200">
                          {playingSegment === seg.id ? (
                            <i className="ri-loader-4-line animate-spin text-[16px]" style={{ color: "#1D1D1F" }} />
                          ) : (
                            <i className="ri-play-fill text-[18px] ml-0.5" style={{ color: "#1D1D1F" }} />
                          )}
                        </div>
                      </div>
                      <div className="absolute top-2 left-2">
                        <span
                          className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                          style={{ background: "rgba(255,255,255,0.9)", color: seg.color }}
                        >
                          {seg.duration}
                        </span>
                      </div>
                    </div>
                    <p className="text-[12px] font-semibold" style={{ color: seg.color }}>{seg.name}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Final video */}
            <div
              className="p-5 rounded-2xl"
              style={{ background: "rgba(4,120,87,0.04)", border: "1px solid rgba(4,120,87,0.2)" }}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[13px] font-bold flex items-center gap-2" style={{ color: "#1D1D1F" }}>
                  <i className="ri-film-line text-[13px]" style={{ color: "#047857" }} />
                  最终合成视频
                </h3>
                <span
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                  style={{ background: "rgba(4,120,87,0.1)", color: "#047857", border: "1px solid rgba(4,120,87,0.2)" }}
                >
                  {overview.duration} · {overview.ratio} · {overview.visual}
                </span>
              </div>
              <div className="flex gap-4">
                <div
                  className="relative w-32 shrink-0 rounded-xl overflow-hidden cursor-pointer group"
                  style={{ aspectRatio: "9/16", border: "1px solid rgba(4,120,87,0.25)" }}
                  onClick={() => handlePlay(0)}
                >
                  <img src={overview.finalImg} alt="final" className="w-full h-full object-cover object-top" />
                  <div className="absolute inset-0 flex items-center justify-center hover:bg-black/15 transition-all duration-200">
                    <div className="w-10 h-10 flex items-center justify-center rounded-full bg-white/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all duration-200">
                      {playingSegment === 0 ? (
                        <i className="ri-loader-4-line animate-spin text-[16px]" style={{ color: "#1D1D1F" }} />
                      ) : (
                        <i className="ri-play-fill text-[18px] ml-0.5" style={{ color: "#1D1D1F" }} />
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex-1 flex flex-col justify-between">
                  <div className="space-y-2">
                    {[
                      { label: "总时长", value: overview.duration },
                      { label: "分辨率", value: overview.resolution },
                      { label: "帧率", value: overview.fps },
                      { label: "格式", value: "MP4 · H.264" },
                    ].map((item) => (
                      <div key={item.label} className="flex justify-between text-[12px]">
                        <span style={{ color: "#8E8E93" }}>{item.label}</span>
                        <span style={{ color: "#1D1D1F", fontWeight: 500 }}>{item.value}</span>
                      </div>
                    ))}
                  </div>
                  <div
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-semibold"
                    style={{ background: "#F5F5F7", color: "#8E8E93", border: "1px solid #EAEAEA" }}
                  >
                    <i className="ri-lock-line text-[12px]" />
                    展示模式 · 不可下载
                  </div>
                </div>
              </div>
            </div>

            {/* CTA */}
            <div
              className="p-6 rounded-2xl text-center"
              style={{ background: "linear-gradient(135deg, #1D1D1F 0%, #374151 100%)", border: "1px solid #1D1D1F" }}
            >
              <h3 className="text-[18px] font-black mb-2" style={{ fontFamily: "'Syne', sans-serif", color: "#ffffff" }}>
                想创作属于你的短剧？
              </h3>
              <p className="text-[13px] mb-5" style={{ color: "rgba(255,255,255,0.65)" }}>
                从 {demo.genre} 到任意题材，AI 帮你完成从剧本到成片的全流程
              </p>
              <button
                onClick={() => navigate("/create")}
                className="inline-flex items-center gap-2 px-8 py-3 rounded-xl text-[14px] font-semibold cursor-pointer transition-all duration-200 whitespace-nowrap"
                style={{ background: "#ffffff", color: "#1D1D1F" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#F5F5F7"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#ffffff"; }}
              >
                <i className="ri-add-circle-line text-[14px]" />
                立即开始创作
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mt-8 pt-6" style={{ borderTop: "1px solid #EAEAEA" }}>
          <button
            onClick={onPrev}
            className="flex items-center gap-2 px-5 py-3 rounded-xl text-[13.5px] cursor-pointer whitespace-nowrap transition-all duration-200"
            style={{ background: "#ffffff", color: "#444444", border: "1px solid #EAEAEA" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#F5F5F7"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#ffffff"; }}
          >
            <i className="ri-arrow-left-line text-[13px]" />
            上一步
          </button>
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 px-5 py-3 rounded-xl text-[13.5px] cursor-pointer whitespace-nowrap transition-all duration-200"
            style={{ background: "#F7F8FA", color: "#444444", border: "1px solid #EAEAEA" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#EAEAEA"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#F7F8FA"; }}
          >
            <i className="ri-arrow-left-line text-[12px]" />
            返回案例列表
          </button>
        </div>
      </div>
    </div>
  );
}
