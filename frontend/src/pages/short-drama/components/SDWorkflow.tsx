import { useNavigate } from 'react-router-dom';

const STEPS = [
  { num: '01', title: '产品输入', desc: '上传产品信息、图片资料，AI 自动解析卖点与品牌调性', icon: 'ri-upload-cloud-2-line', color: '#B45309' },
  { num: '02', title: '剧本大纲', desc: '生成 Hook·冲突·反转·结尾完整结构，分段规划节奏', icon: 'ri-file-text-line', color: '#DC2626' },
  { num: '03', title: '角色场景', desc: '生成角色设定与场景图，构建可复用的视觉资产库', icon: 'ri-user-star-line', color: '#047857' },
  { num: '04', title: '片段视频', desc: '逐镜头脚本 + AI 视频生成，支持多段合成与导出', icon: 'ri-movie-2-line', color: '#334155' },
  { num: '05', title: '导出结果', desc: '下载视频、导出脚本和分镜文档，一键完成交付', icon: 'ri-download-cloud-line', color: '#1D1D1F' },
];

export function SDWorkflow() {
  const navigate = useNavigate();
  return (
    <section id="workflow" className="bg-white px-6 py-24 scroll-mt-24">
      <div className="mx-auto max-w-6xl">
        <div className="mb-16 text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#EAEAEA] bg-[#F5F5F7] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-[#6E6E73]">Workflow</div>
          <h2 className="mb-4 text-3xl font-black text-[#1D1D1F] lg:text-4xl">5 步完成一部短剧广告</h2>
          <p className="mx-auto max-w-lg text-[15px] text-[#8E8E93]">结构化工作流，每一步都有清晰产出，团队协作无摩擦</p>
        </div>
        <div className="flex flex-col items-stretch gap-3 lg:flex-row">
          {STEPS.map((step, idx) => (
            <div key={step.num} className="flex flex-1 items-center gap-2 lg:flex-col">
              <div className="flex flex-1 flex-col rounded-2xl border border-[#EAEAEA] bg-[#F7F8FA] p-5 transition-all duration-300 hover:-translate-y-1">
                <div className="mb-4 flex items-center gap-2">
                  <span className="text-[11px] font-bold tracking-wider" style={{ color: step.color }}>{step.num}</span>
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: `${step.color}10` }}>
                    <i className={`${step.icon} text-[14px]`} style={{ color: step.color }} />
                  </div>
                </div>
                <h3 className="mb-2 text-[14px] font-bold text-[#1D1D1F]">{step.title}</h3>
                <p className="flex-1 text-[12px] leading-relaxed text-[#8E8E93]">{step.desc}</p>
              </div>
              {idx < STEPS.length - 1 ? <i className="ri-arrow-right-line hidden shrink-0 text-[16px] text-[#D1D1D6] lg:block" /> : null}
            </div>
          ))}
        </div>
        <div className="mt-12 text-center">
          <button onClick={() => navigate('/short-drama/create')} className="inline-flex items-center gap-2 rounded-xl bg-[#1D1D1F] px-8 py-3.5 text-[14px] font-semibold text-white">
            <i className="ri-add-circle-line text-[14px]" />
            立即开始创建
          </button>
        </div>
      </div>
    </section>
  );
}
