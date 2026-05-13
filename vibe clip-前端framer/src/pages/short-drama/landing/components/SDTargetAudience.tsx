const AUDIENCES = [
  {
    icon: "ri-global-line",
    title: "出海品牌",
    desc: "为品牌出海构建剧情化广告内容，在欧美、东南亚市场建立情绪认知。",
    examples: ["家居品牌", "3C 数码", "快消品"],
    color: "#B45309",
  },
  {
    icon: "ri-store-2-line",
    title: "跨境电商卖家",
    desc: "将产品卖点转化为 TikTok、Reels 可用的故事型广告，提升 CVR。",
    examples: ["Amazon 卖家", "独立站", "Shopify 商家"],
    color: "#DC2626",
  },
  {
    icon: "ri-team-line",
    title: "独立站团队",
    desc: "快速生产系列化短剧内容，建立品牌内容资产池，降低制作成本。",
    examples: ["内容团队", "品牌运营", "市场部门"],
    color: "#047857",
  },
  {
    icon: "ri-megaphone-line",
    title: "海外内容营销团队",
    desc: "将 Campaign Brief 转化为可执行的短剧脚本与分镜资产。",
    examples: ["营销代理", "内容机构", "MCN 公司"],
    color: "#334155",
  },
];

export default function SDTargetAudience() {
  return (
    <section className="py-24 px-6" style={{ background: "#F7F8FA" }}>
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-5 text-[11px] font-semibold tracking-widest uppercase"
            style={{ background: "#EAEAEA", color: "#6E6E73" }}
          >
            For Who
          </div>
          <h2
            className="text-3xl lg:text-4xl font-black mb-4"
            style={{ fontFamily: "'Syne', sans-serif", color: "#1D1D1F" }}
          >
            为出海业务而生
          </h2>
          <p className="max-w-lg mx-auto text-[15px]" style={{ color: "#8E8E93" }}>
            专为 B 端内容决策者设计，不是泛娱乐工具，是商业内容生产系统
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {AUDIENCES.map((a) => (
            <div
              key={a.title}
              className="rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1"
              style={{ background: "#ffffff", border: "1px solid #EAEAEA" }}
            >
              <div
                className="w-10 h-10 flex items-center justify-center rounded-xl mb-4"
                style={{ background: `${a.color}10` }}
              >
                <i className={`${a.icon} text-[18px]`} style={{ color: a.color }} />
              </div>
              <h3
                className="text-[15px] font-bold mb-2"
                style={{ fontFamily: "'Syne', sans-serif", color: "#1D1D1F" }}
              >
                {a.title}
              </h3>
              <p className="text-[12.5px] leading-relaxed mb-4" style={{ color: "#6E6E73" }}>{a.desc}</p>
              <div className="flex flex-wrap gap-1.5">
                {a.examples.map((ex) => (
                  <span
                    key={ex}
                    className="text-[10px] px-2 py-1 rounded-full"
                    style={{ background: "#F5F5F7", color: "#6E6E73", border: "1px solid #EAEAEA" }}
                  >
                    {ex}
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
