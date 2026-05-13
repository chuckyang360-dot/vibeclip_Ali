import { useState } from "react";
import { useNavigate } from "react-router-dom";
import UserDropdown from "@/components/feature/UserDropdown";

const PROJECT = {
  name: "北欧家居欧洲市场短剧",
  createdAt: "2024-03-18",
  duration: "60s",
  format: "单条广告",
  ratio: "9:16",
  style: "情绪 · 反转",
  visual: "写实电影感",
  market: "欧洲",
};

const SEGMENTS = [
  {
    id: 1, name: "S1 · Hook", duration: "12s", color: "#B45309", status: "done",
    img: "https://readdy.ai/api/search-image?query=cinematic%20film%20frame%20empty%20apartment%20night%20woman%20sitting%20lonely%20dramatic%20moody%20vertical%20advertisement&width=240&height=420&seq=ov01&orientation=portrait",
  },
  {
    id: 2, name: "S2 · Conflict", duration: "28s", color: "#DC2626", status: "done",
    img: "https://readdy.ai/api/search-image?query=cinematic%20furniture%20showroom%20woman%20browsing%20nordic%20interior%20warm%20daylight%20vertical%20commercial%20advertisement&width=240&height=420&seq=ov02&orientation=portrait",
  },
  {
    id: 3, name: "S3 · Resolution", duration: "20s", color: "#047857", status: "done",
    img: "https://readdy.ai/api/search-image?query=cinematic%20golden%20hour%20cozy%20nordic%20home%20woman%20smiling%20warm%20living%20room%20vertical%20brand%20advertisement%20lifestyle&width=240&height=420&seq=ov03&orientation=portrait",
  },
];

const CHARS = [
  {
    name: "林晓", role: "主角",
    img: "https://readdy.ai/api/search-image?query=young%20chinese%20professional%20woman%20confident%20portrait%20studio%20clean%20background%20commercial%20advertisement&width=80&height=80&seq=ov_c01&orientation=squarish",
  },
  {
    name: "Sarah", role: "配角",
    img: "https://readdy.ai/api/search-image?query=european%20young%20woman%20friend%20portrait%20casual%20clean%20background%20commercial%20advertisement&width=80&height=80&seq=ov_c02&orientation=squarish",
  },
];

const SCENES = ["空旷公寓 · 夜晚", "家居展厅 · 日间", "完整新家 · 黄金时段"];
const PRODUCTS = ["Fjord 实木餐桌", "Lund 布艺沙发", "Birch 落地灯"];

export default function OverviewPage() {
  const navigate = useNavigate();
  const [downloading, setDownloading] = useState<string | null>(null);

  const handleDownload = (type: string) => {
    setDownloading(type);
    setTimeout(() => setDownloading(null), 1800);
  };

  return (
    <div className="min-h-screen" style={{ background: "#F7F8FA", fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <header
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 lg:px-10 h-14"
        style={{ background: "#ffffff", borderBottom: "1px solid #EAEAEA", boxShadow: "0 1px 6px rgba(0,0,0,0.04)" }}
      >
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="flex items-center gap-2 cursor-pointer">
            <div
              className="w-7 h-7 flex items-center justify-center rounded-lg"
              style={{ background: "linear-gradient(135deg, #7C3AED, #A78BFA)" }}
            >
              <i className="ri-film-line text-white text-[13px]" />
            </div>
            <span className="text-[14px] font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "#1D1D1F" }}>
              VibeClip
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md hidden sm:inline" style={{ background: "#F5F3FF", color: "#7C3AED" }}>
              维播
            </span>
          </button>
          <span style={{ color: "#D1D1D6" }}>/</span>
          <span className="text-[13px]" style={{ color: "#8E8E93" }}>{PROJECT.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/step4")}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[12.5px] cursor-pointer whitespace-nowrap transition-colors"
            style={{ background: "#F7F8FA", color: "#444444", border: "1px solid #EAEAEA" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#EAEAEA"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#F7F8FA"; }}
          >
            <i className="ri-arrow-left-line text-[12px]" />
            返回编辑
          </button>
          <button
            onClick={() => handleDownload("all")}
            className="flex items-center gap-1.5 px-5 py-1.5 rounded-lg text-[12.5px] font-semibold cursor-pointer whitespace-nowrap transition-all duration-200"
            style={{ background: "#1D1D1F", color: "#ffffff" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#374151"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#1D1D1F"; }}
          >
            <i className="ri-download-cloud-line text-[12px]" />
            一键全部导出
          </button>
          <UserDropdown compact isLoggedIn={false} />
        </div>
      </header>

      <main className="pt-14 px-6 lg:px-10 py-10">
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
                {PROJECT.name}
              </h1>
              <div className="flex flex-wrap gap-2">
                {Object.entries({ 时长: PROJECT.duration, 形式: PROJECT.format, 比例: PROJECT.ratio, 风格: PROJECT.style, 市场: PROJECT.market }).map(([k, v]) => (
                  <span
                    key={k}
                    className="text-[11.5px] px-3 py-1 rounded-full"
                    style={{ background: "#EAEAEA", color: "#444444" }}
                  >
                    {k}：{v}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <p className="text-[11px]" style={{ color: "#AEAEB2" }}>创建于 {PROJECT.createdAt}</p>
              <p className="text-[12px]" style={{ color: "#8E8E93" }}>
                全程耗时 <span style={{ color: "#1D1D1F", fontWeight: 600 }}>约 2 小时 18 分钟</span>
              </p>
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
                  年轻女性独自搬入新公寓，面对孤独与自我怀疑，通过精心挑选北欧家具，最终找到属于自己的生活态度——家不是某个人，而是你对生活的态度。
                </p>
              </div>

              {/* Characters */}
              <div className="p-5 rounded-2xl" style={{ background: "#ffffff", border: "1px solid #EAEAEA" }}>
                <h3 className="text-[12px] font-bold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: "#8E8E93" }}>
                  <i className="ri-user-star-line text-[12px]" style={{ color: "#1D1D1F" }} />
                  角色 ({CHARS.length})
                </h3>
                <div className="flex gap-3">
                  {CHARS.map((c) => (
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
                  场景 ({SCENES.length})
                </h3>
                <div className="space-y-1.5">
                  {SCENES.map((s) => (
                    <div key={s} className="flex items-center gap-2 text-[12.5px]" style={{ color: "#444444" }}>
                      <i className="ri-checkbox-circle-fill text-[11px]" style={{ color: "#047857" }} />
                      {s}
                    </div>
                  ))}
                </div>
              </div>

              {/* Products */}
              <div className="p-5 rounded-2xl" style={{ background: "#ffffff", border: "1px solid #EAEAEA" }}>
                <h3 className="text-[12px] font-bold uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: "#8E8E93" }}>
                  <i className="ri-archive-line text-[12px]" style={{ color: "#DC2626" }} />
                  产品资产 ({PRODUCTS.length})
                </h3>
                <div className="space-y-1.5">
                  {PRODUCTS.map((p) => (
                    <div key={p} className="flex items-center gap-2 text-[12.5px]" style={{ color: "#444444" }}>
                      <i className="ri-checkbox-circle-fill text-[11px]" style={{ color: "#DC2626" }} />
                      {p}
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
                  {SEGMENTS.map((seg) => (
                    <div key={seg.id}>
                      <div
                        className="relative w-full rounded-xl overflow-hidden mb-2"
                        style={{ aspectRatio: "9/16", border: `1px solid ${seg.color}25` }}
                      >
                        <img src={seg.img} alt={seg.name} className="w-full h-full object-cover object-top" />
                        <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-all duration-200 cursor-pointer flex items-center justify-center opacity-0 hover:opacity-100">
                          <div className="w-10 h-10 flex items-center justify-center rounded-full bg-white/80 backdrop-blur-sm">
                            <i className="ri-play-fill text-[18px] ml-0.5" style={{ color: "#1D1D1F" }} />
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
                    60s · 9:16 · 写实电影感
                  </span>
                </div>
                <div className="flex gap-4">
                  <div
                    className="relative w-32 shrink-0 rounded-xl overflow-hidden"
                    style={{ aspectRatio: "9/16", border: "1px solid rgba(4,120,87,0.25)" }}
                  >
                    <img
                      src="https://readdy.ai/api/search-image?query=cinematic%20short%20film%20nordic%20home%20advertisement%20complete%20final%20composed%20video%20frame%20golden%20hour%20interior%20vertical%20portrait%20brand%20commercial&width=180&height=320&seq=final01&orientation=portrait"
                      alt="final"
                      className="w-full h-full object-cover object-top"
                    />
                    <div className="absolute inset-0 flex items-center justify-center cursor-pointer hover:bg-black/15 transition-all duration-200">
                      <div className="w-10 h-10 flex items-center justify-center rounded-full bg-white/80 backdrop-blur-sm">
                        <i className="ri-play-fill text-[18px] ml-0.5" style={{ color: "#1D1D1F" }} />
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 flex flex-col justify-between">
                    <div className="space-y-2">
                      {[
                        { label: "总时长", value: "60s" },
                        { label: "分辨率", value: "1080 × 1920" },
                        { label: "帧率", value: "24fps" },
                        { label: "格式", value: "MP4 · H.264" },
                      ].map((item) => (
                        <div key={item.label} className="flex justify-between text-[12px]">
                          <span style={{ color: "#8E8E93" }}>{item.label}</span>
                          <span style={{ color: "#1D1D1F", fontWeight: 500 }}>{item.value}</span>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => handleDownload("video")}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-semibold cursor-pointer transition-all duration-200 whitespace-nowrap"
                      style={{ background: "#1D1D1F", color: "#ffffff" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#374151"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#1D1D1F"; }}
                    >
                      {downloading === "video" ? (
                        <><i className="ri-loader-4-line animate-spin text-[12px]" />下载中...</>
                      ) : (
                        <><i className="ri-download-cloud-line text-[12px]" />下载完整视频</>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Export options */}
              <div className="p-5 rounded-2xl" style={{ background: "#ffffff", border: "1px solid #EAEAEA" }}>
                <h3 className="text-[12px] font-bold uppercase tracking-wider mb-4 flex items-center gap-2" style={{ color: "#8E8E93" }}>
                  <i className="ri-download-cloud-2-line text-[12px]" style={{ color: "#1D1D1F" }} />
                  导出选项
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { key: "video_pack", label: "下载视频包", desc: "所有片段 + 完整视频", icon: "ri-film-line", color: "#B45309" },
                    { key: "script", label: "导出脚本文档", desc: "完整剧本 + 分段台词", icon: "ri-file-text-line", color: "#047857" },
                    { key: "storyboard", label: "导出分镜文档", desc: "镜头描述 + 场景图", icon: "ri-layout-grid-line", color: "#334155" },
                  ].map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => handleDownload(opt.key)}
                      className="p-4 rounded-xl text-left cursor-pointer transition-all duration-200"
                      style={{ background: "#F7F8FA", border: "1px solid #EAEAEA" }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.background = "#F5F5F7";
                        (e.currentTarget as HTMLElement).style.borderColor = `${opt.color}35`;
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.background = "#F7F8FA";
                        (e.currentTarget as HTMLElement).style.borderColor = "#EAEAEA";
                      }}
                    >
                      <div
                        className="w-8 h-8 flex items-center justify-center rounded-lg mb-3"
                        style={{ background: `${opt.color}10` }}
                      >
                        {downloading === opt.key
                          ? <i className="ri-loader-4-line animate-spin text-[14px]" style={{ color: opt.color }} />
                          : <i className={`${opt.icon} text-[14px]`} style={{ color: opt.color }} />
                        }
                      </div>
                      <p className="text-[13px] font-semibold mb-1" style={{ color: "#1D1D1F" }}>{opt.label}</p>
                      <p className="text-[11px]" style={{ color: "#8E8E93" }}>{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
