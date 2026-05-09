const CAPS = [
  { icon: 'ri-scan-2-line', title: '产品解析', desc: '深度解析产品卖点、品牌调性、目标受众，自动提炼剧情化关键词与情绪方向。', tags: ['卖点提炼', '受众画像', '品牌语境'], color: '#B45309' },
  { icon: 'ri-pen-nib-line', title: '剧情生成', desc: '基于产品信息生成完整剧本大纲，包含 Hook、冲突、反转、结尾，结构化输出。', tags: ['Hook 设计', '冲突节奏', '分段脚本'], color: '#DC2626' },
  { icon: 'ri-user-star-line', title: '角色与场景资产', desc: '自动生成角色设定与场景描述，配套 AI 参考图，构建统一视觉资产库。', tags: ['角色设定', '场景生成', '视觉资产'], color: '#047857' },
  { icon: 'ri-movie-2-line', title: '分镜与视频生成', desc: '将脚本转化为逐镜头描述，对接 AI 视频生成，完成可下载的广告片段。', tags: ['镜头设计', 'AI 视频', '多平台导出'], color: '#334155' },
];

export function SDCapabilities() {
  return (
    <section id="capabilities" className="bg-[#F7F8FA] px-6 py-24 scroll-mt-24">
      <div className="mx-auto max-w-6xl">
        <div className="mb-16 text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-[#EAEAEA] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-[#6E6E73]">Core Capabilities</div>
          <h2 className="mb-4 text-3xl font-black text-[#1D1D1F] lg:text-4xl">四大核心能力</h2>
          <p className="mx-auto max-w-xl text-[15px] text-[#8E8E93]">从产品资料到可用视频，完整的 AI 工作流，每个步骤都有结构化产出</p>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {CAPS.map((cap) => (
            <div key={cap.title} className="flex flex-col gap-4 rounded-2xl border border-[#EAEAEA] bg-white p-6 transition-all duration-300 hover:-translate-y-1">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: `${cap.color}10` }}>
                <i className={`${cap.icon} text-[18px]`} style={{ color: cap.color }} />
              </div>
              <div>
                <h3 className="mb-2 text-[15px] font-bold text-[#1D1D1F]">{cap.title}</h3>
                <p className="text-[12.5px] leading-relaxed text-[#6E6E73]">{cap.desc}</p>
              </div>
              <div className="mt-auto flex flex-wrap gap-1.5">
                {cap.tags.map((tag) => (
                  <span key={tag} className="rounded-full px-2 py-1 text-[10px] font-medium" style={{ background: `${cap.color}10`, color: cap.color }}>{tag}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
