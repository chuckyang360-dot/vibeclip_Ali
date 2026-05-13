const CAPS = [
  {
    icon: "ri-scan-2-line",
    title: "产品解析",
    desc: "深度解析产品卖点、品牌调性、目标受众，自动提炼剧情化关键词与情绪方向。",
    tags: ["卖点提炼", "受众画像", "品牌语境"],
    color: "#B45309",
  },
  {
    icon: "ri-pen-nib-line",
    title: "剧情生成",
    desc: "基于产品信息生成完整剧本大纲，包含 Hook、冲突、反转、结尾，结构化输出。",
    tags: ["Hook 设计", "冲突节奏", "分段脚本"],
    color: "#DC2626",
  },
  {
    icon: "ri-user-star-line",
    title: "角色与场景资产",
    desc: "自动生成角色设定与场景描述，配套 AI 参考图，构建统一视觉资产库。",
    tags: ["角色设定", "场景生成", "视觉资产"],
    color: "#047857",
  },
  {
    icon: "ri-movie-2-line",
    title: "分镜与视频生成",
    desc: "将脚本转化为逐镜头描述，对接 AI 视频生成，完成可下载的广告片段。",
    tags: ["镜头设计", "AI 视频", "多平台导出"],
    color: "#334155",
  },
];

export default function SDCapabilities() {
  return (
    <section className="py-24 px-6" style={{ background: "#F7F8FA" }}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-5 text-[11px] font-semibold tracking-widest uppercase"
            style={{ background: "#EAEAEA", color: "#6E6E73" }}
          >
            Core Capabilities
          </div>
          <h2
            className="text-3xl lg:text-4xl font-black mb-4"
            style={{ fontFamily: "'Syne', sans-serif", color: "#1D1D1F" }}
          >
            四大核心能力
          </h2>
          <p className="max-w-xl mx-auto text-[15px]" style={{ color: "#8E8E93" }}>
            从产品资料到可用视频，完整的 AI 工作流，每个步骤都有结构化产出
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {CAPS.map((cap) => (
            <div
              key={cap.title}
              className="rounded-2xl p-6 flex flex-col gap-4 transition-all duration-300 hover:-translate-y-1"
              style={{ background: "#ffffff", border: "1px solid #EAEAEA" }}
            >
              <div
                className="w-10 h-10 flex items-center justify-center rounded-xl"
                style={{ background: `${cap.color}10` }}
              >
                <i className={`${cap.icon} text-[18px]`} style={{ color: cap.color }} />
              </div>
              <div>
                <h3
                  className="text-[15px] font-bold mb-2"
                  style={{ fontFamily: "'Syne', sans-serif", color: "#1D1D1F" }}
                >
                  {cap.title}
                </h3>
                <p className="text-[12.5px] leading-relaxed" style={{ color: "#6E6E73" }}>{cap.desc}</p>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-auto">
                {cap.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] font-medium px-2 py-1 rounded-full"
                    style={{ background: `${cap.color}10`, color: cap.color }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
