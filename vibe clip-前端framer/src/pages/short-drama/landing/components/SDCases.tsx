import { useNavigate } from "react-router-dom";
import { DEMO_CASES } from "@/mocks/demoCases";

const GENRE_COLORS: Record<string, string> = {
  "品牌广告": "#B45309",
  "种草短剧": "#047857",
  "网络剧集": "#334155",
  "独立电影": "#6B7280",
  "个人播客": "#7C3AED",
  "动漫短片": "#EA580C",
  "运动广告": "#0F766E",
  "产品发布": "#1D4ED8",
};

export default function SDCases() {
  const navigate = useNavigate();

  return (
    <section className="py-24 px-6" style={{ background: "#ffffff" }}>
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row items-start md:items-end justify-between mb-14 gap-4">
          <div>
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4 text-[11px] font-semibold tracking-widest uppercase"
              style={{ background: "#F5F5F7", color: "#6E6E73", border: "1px solid #EAEAEA" }}
            >
              Case Preview
            </div>
            <h2
              className="text-3xl lg:text-4xl font-black"
              style={{ fontFamily: "'Syne', sans-serif", color: "#1D1D1F" }}
            >
              行业样例
            </h2>
            <p className="text-[14px] mt-2" style={{ color: "#8E8E93" }}>
              9 种不同题材的完整创作案例，点击查看完整制作流程与最终效果
            </p>
          </div>
          <div className="flex flex-wrap gap-2 max-w-xs">
            {Object.entries(GENRE_COLORS).map(([genre, color]) => (
              <span
                key={genre}
                className="text-[10px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap"
                style={{ background: `${color}10`, color, border: `1px solid ${color}25` }}
              >
                {genre}
              </span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {DEMO_CASES.map((c) => {
            const genreColor = GENRE_COLORS[c.genre] || c.color;
            return (
              <div
                key={c.id}
                className="rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1 cursor-pointer group"
                style={{ background: "#ffffff", border: "1px solid #EAEAEA" }}
                onClick={() => navigate(`/demo/${c.id}`)}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = `${genreColor}35`;
                  (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 20px ${genreColor}10`;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "#EAEAEA";
                  (e.currentTarget as HTMLElement).style.boxShadow = "none";
                }}
              >
                {/* Cover image */}
                <div className="relative w-full h-[180px] overflow-hidden" style={{ background: "#F7F8FA" }}>
                  <img
                    src={c.img}
                    alt={c.title}
                    className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                  />
                  {/* Overlay on hover */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300 flex items-center justify-center">
                    <div
                      className="flex items-center gap-2 px-4 py-2 rounded-full text-[12px] font-semibold opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0"
                      style={{ background: "rgba(255,255,255,0.95)", color: "#1D1D1F" }}
                    >
                      <i className="ri-play-circle-line text-[14px]" />
                      查看完整案例
                    </div>
                  </div>
                  {/* Badges */}
                  <div className="absolute bottom-3 left-3 flex items-center gap-2">
                    <span
                      className="text-[10px] font-semibold px-2 py-1 rounded-full"
                      style={{ background: "rgba(255,255,255,0.92)", color: genreColor, border: `1px solid ${genreColor}30` }}
                    >
                      {c.genre}
                    </span>
                    <span
                      className="text-[10px] font-medium px-2 py-1 rounded-full"
                      style={{ background: "rgba(255,255,255,0.9)", color: "#444444" }}
                    >
                      {c.duration}
                    </span>
                  </div>
                  {/* View demo badge top right */}
                  <div className="absolute top-3 right-3">
                    <span
                      className="text-[9px] font-bold px-2 py-1 rounded-full uppercase tracking-wider"
                      style={{ background: "rgba(29,29,31,0.75)", color: "#ffffff" }}
                    >
                      Demo
                    </span>
                  </div>
                </div>

                {/* Info */}
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <span className="text-[11px]" style={{ color: "#8E8E93" }}>{c.industry}</span>
                    <span style={{ color: "#D1D1D6" }}>·</span>
                    <span className="text-[11px]" style={{ color: "#8E8E93" }}>{c.market}</span>
                    <span style={{ color: "#D1D1D6" }}>·</span>
                    <span className="text-[11px]" style={{ color: "#8E8E93" }}>{c.platform}</span>
                  </div>
                  <h3
                    className="text-[15px] font-bold mb-2"
                    style={{ fontFamily: "'Syne', sans-serif", color: "#1D1D1F" }}
                  >
                    {c.title}
                  </h3>
                  <p className="text-[12px] leading-relaxed mb-4 line-clamp-2" style={{ color: "#6E6E73" }}>{c.desc}</p>

                  {/* Style tag */}
                  <div className="flex items-center justify-between">
                    <span
                      className="text-[10.5px] font-medium px-2.5 py-1 rounded-full"
                      style={{ background: `${genreColor}08`, color: genreColor, border: `1px solid ${genreColor}20` }}
                    >
                      {c.style}
                    </span>
                    <div className="flex items-center gap-1 text-[11px]" style={{ color: "#AEAEB2" }}>
                      <i className="ri-arrow-right-line text-[12px]" />
                      <span>查看案例</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-center mt-12">
          <button
            onClick={() => navigate("/create")}
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl text-[14px] font-semibold cursor-pointer transition-all duration-200 whitespace-nowrap"
            style={{ background: "#1D1D1F", color: "#ffffff" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#374151"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#1D1D1F"; }}
          >
            <i className="ri-add-circle-line text-[14px]" />
            创建我的短剧项目
          </button>
        </div>
      </div>
    </section>
  );
}
