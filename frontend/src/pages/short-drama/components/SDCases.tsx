import { useNavigate } from 'react-router-dom';
import { DEMO_CASES, type DemoCase } from '../data/demoCases';

const GENRE_COLORS: Record<string, string> = {
  品牌广告: '#B45309',
  种草短剧: '#047857',
  网络剧集: '#334155',
  独立电影: '#6B7280',
  个人播客: '#7C3AED',
  动漫短片: '#EA580C',
  运动广告: '#0F766E',
  产品发布: '#1D4ED8',
};

export function SDCases() {
  const navigate = useNavigate();
  return (
    <section id="cases" className="bg-white px-6 py-24 scroll-mt-24">
      <div className="mx-auto max-w-6xl">
        <div className="mb-14 flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#EAEAEA] bg-[#F5F5F7] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-[#6E6E73]">
              Case Preview
            </div>
            <h2 className="text-3xl font-black text-[#1D1D1F] lg:text-4xl">行业样例</h2>
            <p className="mt-2 text-[14px] text-[#8E8E93]">9 种不同题材的完整创作案例，点击查看完整制作流程与最终效果</p>
          </div>
          <div className="flex max-w-xs flex-wrap gap-2">
            {Object.entries(GENRE_COLORS).map(([genre, color]) => (
              <span key={genre} className="rounded-full px-2.5 py-1 text-[10px] font-semibold" style={{ background: `${color}10`, color, border: `1px solid ${color}25` }}>
                {genre}
              </span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {DEMO_CASES.map((c: DemoCase) => {
            const genreColor = GENRE_COLORS[c.genre] || c.color;
            return (
              <div
                key={c.id}
                className="group cursor-pointer overflow-hidden rounded-2xl border border-[#EAEAEA] bg-white transition-all duration-300 hover:-translate-y-1"
                onClick={() => navigate(`/cases/${c.id}`)}
              >
                <div className="relative h-[180px] w-full overflow-hidden bg-[#F7F8FA]">
                  <img src={c.img} alt={c.title} className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-105" />
                  <div className="absolute bottom-3 left-3 flex items-center gap-2">
                    <span className="rounded-full px-2 py-1 text-[10px] font-semibold" style={{ background: 'rgba(255,255,255,0.92)', color: genreColor, border: `1px solid ${genreColor}30` }}>
                      {c.genre}
                    </span>
                    <span className="rounded-full bg-[rgba(255,255,255,0.9)] px-2 py-1 text-[10px] font-medium text-[#444444]">{c.duration}</span>
                  </div>
                  <div className="absolute right-3 top-3 rounded-full bg-[rgba(29,29,31,0.75)] px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-white">Demo</div>
                </div>
                <div className="p-5">
                  <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] text-[#8E8E93]">
                    <span>{c.industry}</span><span>·</span><span>{c.market}</span><span>·</span><span>{c.platform}</span>
                  </div>
                  <h3 className="mb-2 text-[15px] font-bold text-[#1D1D1F]">{c.title}</h3>
                  <p className="line-clamp-2 mb-4 text-[12px] leading-relaxed text-[#6E6E73]">{c.desc}</p>
                  <div className="flex items-center justify-between">
                    <span className="rounded-full px-2.5 py-1 text-[10.5px] font-medium" style={{ background: `${genreColor}08`, color: genreColor, border: `1px solid ${genreColor}20` }}>{c.style}</span>
                    <span className="text-[11px] text-[#AEAEB2]">查看案例</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-12 text-center">
          <button
            onClick={() => navigate('/short-drama/create')}
            className="inline-flex items-center gap-2 rounded-xl bg-[#1D1D1F] px-8 py-3.5 text-[14px] font-semibold text-white"
          >
            <i className="ri-add-circle-line text-[14px]" />
            创建我的短剧项目
          </button>
        </div>
      </div>
    </section>
  );
}
