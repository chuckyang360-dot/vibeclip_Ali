const AUDIENCES = [
  { icon: 'ri-global-line', title: '出海品牌', desc: '为品牌出海构建剧情化广告内容，在欧美、东南亚市场建立情绪认知。', examples: ['家居品牌', '3C 数码', '快消品'], color: '#B45309' },
  { icon: 'ri-store-2-line', title: '跨境电商卖家', desc: '将产品卖点转化为 TikTok、Reels 可用的故事型广告，提升 CVR。', examples: ['Amazon 卖家', '独立站', 'Shopify 商家'], color: '#DC2626' },
  { icon: 'ri-team-line', title: '独立站团队', desc: '快速生产系列化短剧内容，建立品牌内容资产池，降低制作成本。', examples: ['内容团队', '品牌运营', '市场部门'], color: '#047857' },
  { icon: 'ri-megaphone-line', title: '海外内容营销团队', desc: '将 Campaign Brief 转化为可执行的短剧脚本与分镜资产。', examples: ['营销代理', '内容机构', 'MCN 公司'], color: '#334155' },
];

export function SDTargetAudience() {
  return (
    <section className="bg-[#F7F8FA] px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mb-16 text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-[#EAEAEA] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-[#6E6E73]">For Who</div>
          <h2 className="mb-4 text-3xl font-black text-[#1D1D1F] lg:text-4xl">为出海业务而生</h2>
          <p className="mx-auto max-w-lg text-[15px] text-[#8E8E93]">专为 B 端内容决策者设计，不是泛娱乐工具，是商业内容生产系统</p>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {AUDIENCES.map((a) => (
            <div key={a.title} className="rounded-2xl border border-[#EAEAEA] bg-white p-6 transition-all duration-300 hover:-translate-y-1">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: `${a.color}10` }}>
                <i className={`${a.icon} text-[18px]`} style={{ color: a.color }} />
              </div>
              <h3 className="mb-2 text-[15px] font-bold text-[#1D1D1F]">{a.title}</h3>
              <p className="mb-4 text-[12.5px] leading-relaxed text-[#6E6E73]">{a.desc}</p>
              <div className="flex flex-wrap gap-1.5">
                {a.examples.map((ex) => (
                  <span key={ex} className="rounded-full border border-[#EAEAEA] bg-[#F5F5F7] px-2 py-1 text-[10px] text-[#6E6E73]">{ex}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
