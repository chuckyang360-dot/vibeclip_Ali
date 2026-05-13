import { useNavigate } from "react-router-dom";

export default function SDHero() {
  const navigate = useNavigate();

  return (
    <section
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden"
      style={{ background: "#ffffff" }}
    >
      {/* Subtle top accent line */}
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "linear-gradient(90deg, transparent, #1D1D1F, transparent)" }} />

      {/* Background image - subtle, bottom half */}
      <div className="absolute bottom-0 left-0 right-0 h-[55%] overflow-hidden">
        <img
          src="https://readdy.ai/api/search-image?query=minimal%20clean%20professional%20video%20production%20studio%20overhead%20aerial%20view%20white%20floor%20camera%20equipment%20cinematic%20clean%20lines%20sophisticated%20premium%20brand%20photography%20studio%20setup%20neutral%20tones&width=1440&height=600&seq=sdhero2024&orientation=landscape"
          alt=""
          className="w-full h-full object-cover object-top opacity-[0.07]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white via-white/80 to-white/0" />
      </div>

      <div className="relative z-10 w-full max-w-5xl mx-auto px-6 text-center pt-32 pb-20">
        {/* Badge */}
        <div
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-10 text-[11.5px] font-semibold tracking-wider"
          style={{ background: "#F5F5F7", color: "#444444", border: "1px solid #EAEAEA" }}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          AI Short Drama Engine · Story-Driven Ads
        </div>

        {/* Title */}
        <h1
          className="font-black leading-[1.05] tracking-[-0.03em] mb-8 whitespace-nowrap"
          style={{
            fontFamily: "'Syne', sans-serif",
            fontSize: "clamp(42px, 5.5vw, 80px)",
            color: "#1D1D1F",
          }}
        >
          用故事，卖产品
        </h1>

        {/* Subtitle */}
        <p
          className="text-[18px] lg:text-[20px] mb-4 max-w-2xl mx-auto leading-relaxed"
          style={{ color: "#6E6E73" }}
        >
          为出海企业打造的 AI 短剧广告制作平台
        </p>
        <p
          className="text-[15px] mb-14 max-w-xl mx-auto leading-relaxed"
          style={{ color: "#AEAEB2" }}
        >
          从产品资料到剧情、角色、场景、分镜与视频，一站式完成
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20">
          <button
            onClick={() => navigate("/create")}
            className="flex items-center gap-2 px-8 py-3.5 rounded-xl text-[15px] font-semibold cursor-pointer transition-all duration-200 whitespace-nowrap"
            style={{ background: "#1D1D1F", color: "#ffffff" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#374151"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#1D1D1F"; }}
          >
            <i className="ri-add-circle-line text-[14px]" />
            开始创建短剧
          </button>
          <button
            className="flex items-center gap-2 px-8 py-3.5 rounded-xl text-[15px] font-medium cursor-pointer transition-all duration-200 whitespace-nowrap"
            style={{ background: "transparent", color: "#444444", border: "1px solid #EAEAEA" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "#F7F8FA";
              (e.currentTarget as HTMLElement).style.borderColor = "#D1D1D6";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
              (e.currentTarget as HTMLElement).style.borderColor = "#EAEAEA";
            }}
          >
            <i className="ri-play-circle-line text-[14px]" />
            查看案例
          </button>
        </div>

        {/* Stats row */}
        <div
          className="flex flex-wrap items-center justify-center gap-10 pt-10"
          style={{ borderTop: "1px solid #EAEAEA" }}
        >
          {[
            { value: "2,400+", label: "短剧项目创建" },
            { value: "18+", label: "出海行业覆盖" },
            { value: "< 48h", label: "从输入到产出" },
            { value: "多平台适配", label: "TikTok · YouTube · Meta" },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <div
                className="text-xl lg:text-2xl font-bold mb-1"
                style={{ fontFamily: "'Syne', sans-serif", color: "#1D1D1F" }}
              >
                {s.value}
              </div>
              <div className="text-[12px]" style={{ color: "#8E8E93" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
