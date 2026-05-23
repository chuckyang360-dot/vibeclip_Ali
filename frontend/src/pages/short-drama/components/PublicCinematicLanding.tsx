import { Link } from 'react-router-dom';
import { ri } from '../utils/shortDramaHelpers';

const HERO_IMAGE =
  'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=1800&q=82';
const PORTRAIT_IMAGE =
  'https://images.unsplash.com/photo-1512316609839-ce289d3eba0a?auto=format&fit=crop&w=900&q=82';
const PRODUCT_IMAGE =
  'https://images.unsplash.com/photo-1526947425960-945c6e72858f?auto=format&fit=crop&w=900&q=82';

const CAPABILITIES = [
  { title: '商品理解', desc: '读取商品图、卖点、目标人群，拆出适合短视频表达的核心钩子。', icon: 'ri-focus-3-line' },
  { title: '真人感剧情', desc: '把功能卖点改写成角色、场景、冲突和转化动作，不再只是参数罗列。', icon: 'ri-user-voice-line' },
  { title: '分镜到视频', desc: '自动生成镜头规划、角色场景资产和视频片段，最后合成为完整成片。', icon: 'ri-movie-2-line' },
] as const;

const FLOW = ['上传商品', '生成剧本', '确认资产', '生成片段', '交付成片'] as const;

export function PublicCinematicLanding() {
  return (
    <main className="bg-[#0B0B0D] text-white">
      <section className="relative min-h-[calc(100vh-56px)] overflow-hidden">
        <img src={HERO_IMAGE} alt="" className="absolute inset-0 h-full w-full object-cover object-center opacity-72" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,7,9,0.94)_0%,rgba(7,7,9,0.70)_46%,rgba(7,7,9,0.20)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-[#0B0B0D] to-transparent" />

        <div className="relative z-10 mx-auto flex min-h-[calc(100vh-56px)] max-w-6xl flex-col justify-end px-4 pb-8 pt-20 md:justify-center md:px-8 md:pb-16">
          <div className="max-w-3xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/18 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white/76 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              VibeClip / 维播 · AI 商品短片工作台
            </div>
            <h1 className="text-[44px] font-black leading-[0.98] tracking-normal md:text-[76px]">
              让商品进入一支真正的短片
            </h1>
            <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-white/72 md:text-[19px]">
              VibeClip 把商品资料转成有角色、有场景、有镜头语言的营销视频。从卖点理解到分镜、资产、片段生成和成片交付，一条线完成。
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/register"
                className="flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-6 text-[14px] font-bold text-[#111111] md:h-13"
              >
                <i className={ri('ri-sparkling-line', 'text-[15px]')} aria-hidden />
                开始体验
              </Link>
              <Link
                to="/login"
                className="flex h-12 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-6 text-[14px] font-semibold text-white backdrop-blur"
              >
                <i className={ri('ri-login-circle-line', 'text-[15px]')} aria-hidden />
                登录工作台
              </Link>
            </div>
          </div>

          <div className="mt-10 grid grid-cols-3 gap-2 md:max-w-xl md:gap-3">
            {[
              ['9:16', '短视频比例'],
              ['5步', '从商品到成片'],
              ['AI', '剧本与视频生成'],
            ].map(([value, label]) => (
              <div key={label} className="rounded-2xl border border-white/12 bg-white/10 px-3 py-3 backdrop-blur md:px-4">
                <p className="text-[18px] font-black md:text-[24px]">{value}</p>
                <p className="mt-1 text-[10px] font-medium text-white/55 md:text-[12px]">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="workflow" className="mx-auto max-w-6xl px-4 py-12 md:px-8 md:py-20">
        <div className="grid gap-8 md:grid-cols-[0.9fr_1.1fr] md:items-center">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/42">Core Ability</p>
            <h2 className="mt-3 text-[30px] font-black leading-tight md:text-[48px]">不是模板拼贴，是商品叙事生成</h2>
            <p className="mt-4 text-[14px] leading-relaxed text-white/62 md:text-[16px]">
              维播先理解商品卖点和用户动机，再把它们改写成短片结构：谁在什么场景里遇到问题，商品如何自然出现，镜头如何推动信任和转化。
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/8">
              <img src={PORTRAIT_IMAGE} alt="" className="h-64 w-full object-cover md:h-80" />
            </div>
            <div className="space-y-3 pt-8">
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/8">
                <img src={PRODUCT_IMAGE} alt="" className="h-36 w-full object-cover md:h-44" />
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.08] p-4">
                <p className="text-[12px] leading-relaxed text-white/68">
                  真人角色、真实场景、商品露出、镜头节奏和字幕口播会一起进入生成链路。
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="capabilities" className="mx-auto max-w-6xl px-4 pb-12 md:px-8 md:pb-20">
        <div className="grid gap-3 md:grid-cols-3">
          {CAPABILITIES.map((item) => (
            <article key={item.title} className="rounded-2xl border border-white/10 bg-white/[0.06] p-5">
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#111111]">
                <i className={ri(item.icon, 'text-[20px]')} aria-hidden />
              </div>
              <h3 className="text-[17px] font-black">{item.title}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-white/58">{item.desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-t border-white/10 bg-white/[0.04] px-4 py-10 md:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-[24px] font-black md:text-[34px]">从一张商品图开始</h2>
              <p className="mt-2 text-[13px] text-white/56 md:text-[15px]">登录后进入工作台，按流程完成创建、生成和交付。</p>
            </div>
            <Link to="/register" className="flex h-12 items-center justify-center rounded-xl bg-white px-6 text-[14px] font-bold text-[#111111]">
              创建账号
            </Link>
          </div>
          <div className="mt-8 flex snap-x gap-2 overflow-x-auto pb-1 md:grid md:grid-cols-5 md:gap-3 md:overflow-visible">
            {FLOW.map((step, index) => (
              <div key={step} className="min-w-[132px] snap-start rounded-2xl border border-white/10 bg-[#0B0B0D] p-4">
                <p className="text-[11px] font-bold text-white/36">0{index + 1}</p>
                <p className="mt-6 text-[14px] font-bold">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
