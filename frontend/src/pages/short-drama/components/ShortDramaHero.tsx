import { Link, useNavigate } from 'react-router-dom';
import { ri, sdColors, sdFontHeading } from '../utils/shortDramaHelpers';

const STATS = [
  { value: '2,400+', label: '短视频项目创建' },
  { value: '18+', label: '出海行业覆盖' },
  { value: '< 48h', label: '从输入到产出' },
  { value: '多平台适配', label: 'TikTok · YouTube · Meta' },
] as const;

export function ShortDramaHero() {
  const navigate = useNavigate();

  return (
    <section
      id="home"
      className="relative flex min-h-[calc(100vh-4.5rem)] flex-col items-center justify-center overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #F8FAFC 0%, #FFFFFF 45%)' }}
    >
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, #1D1D1F, transparent)' }}
      />

      {/* Weak atmosphere: no external image — layered gradients + soft bloom */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div
          className="absolute -top-[20%] left-1/2 h-[min(48vh,420px)] w-[min(120vw,880px)] -translate-x-1/2 rounded-[50%] opacity-[0.2] blur-3xl"
          style={{ background: 'radial-gradient(ellipse at center, rgba(196,181,253,0.2) 0%, rgba(191,219,254,0.12) 35%, transparent 72%)' }}
        />
        <div
          className="absolute -bottom-[20%] left-1/2 h-[min(70vh,520px)] w-[min(140vw,900px)] -translate-x-1/2 rounded-[50%] opacity-[0.07] blur-3xl"
          style={{ background: 'radial-gradient(ellipse at center, #374151 0%, transparent 70%)' }}
        />
        <div
          className="absolute bottom-0 right-[-10%] h-[45%] w-[55%] opacity-[0.05] blur-2xl"
          style={{ background: 'radial-gradient(circle at 70% 100%, #9CA3AF 0%, transparent 65%)' }}
        />
        <div
          className="absolute bottom-0 left-0 right-0 h-[52%] opacity-[0.04]"
          style={{
            background:
              'linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(229,231,235,0.55) 45%, rgba(243,244,246,0.35) 100%)',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white via-white/92 to-white" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-5xl px-6 pb-16 pt-28 text-center md:pb-20 md:pt-32">
        <div
          className="mb-10 inline-flex items-center gap-2 rounded-full px-4 py-2 text-[11.5px] font-semibold tracking-wider"
          style={{
            background: sdColors.surface2,
            color: '#444444',
            border: `1px solid ${sdColors.border}`,
          }}
        >
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          VibeClip / 维播 · AI 产品营销短视频工作台
        </div>

        <h1
          className="mb-8 font-black leading-[1.05] tracking-[-0.03em]"
          style={{
            ...sdFontHeading,
            fontSize: 'clamp(42px, 5.5vw, 80px)',
            color: sdColors.ink,
          }}
        >
          让产品自己会讲故事
        </h1>

        <p
          className="mx-auto mb-4 max-w-2xl text-[18px] leading-relaxed lg:text-[20px]"
          style={{ color: '#6E6E73' }}
        >
          为出海企业打造的 AI 产品营销短视频工作台
        </p>
        <p className="mx-auto mb-14 max-w-xl text-[15px] leading-relaxed" style={{ color: '#AEAEB2' }}>
          从产品资料到剧情、角色、场景、分镜与视频，一站式完成
        </p>

        <div className="mb-20 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <button
            type="button"
            onClick={() => navigate('/short-drama/create')}
            className="flex items-center gap-2 whitespace-nowrap rounded-xl px-8 py-3.5 text-[15px] font-semibold text-white transition-colors duration-200 hover:bg-[#374151]"
            style={{ background: sdColors.ink }}
          >
            <i className={ri('ri-add-circle-line', 'text-[14px]')} aria-hidden />
            开始创建
          </button>
          <Link
            to="/cases"
            className="flex items-center gap-2 whitespace-nowrap rounded-xl border border-[#EAEAEA] bg-transparent px-8 py-3.5 text-[15px] font-medium text-[#444444] transition-all duration-200 hover:border-[#D1D1D6] hover:bg-[#F7F8FA]"
          >
            <i className={ri('ri-play-circle-line', 'text-[14px]')} aria-hidden />
            查看案例
          </Link>
        </div>

        <div
          className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-x-10 gap-y-8 pt-10"
          style={{ borderTop: '1px solid #EAEAEA' }}
        >
          {STATS.map((s) => (
            <div key={s.label} className="min-w-[120px] text-center">
              <div
                className="mb-1 text-xl font-bold lg:text-2xl"
                style={{ ...sdFontHeading, color: sdColors.ink }}
              >
                {s.value}
              </div>
              <div className="text-[12px] leading-snug" style={{ color: '#8E8E93' }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
