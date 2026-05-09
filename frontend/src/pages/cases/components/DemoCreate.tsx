import type { DemoCaseConfig } from '../../short-drama/data/demoCases';

const DURATION_OPTIONS = ['30s', '45s', '60s'];
const FORMAT_OPTIONS = [
  { value: 'single', label: '单条广告', desc: '独立完整的广告短片' },
  { value: 'series', label: '系列短剧', desc: '2-5集连载剧情内容' },
];
const PLOT_STYLES = [
  { value: 'twist', label: '反转', icon: 'ri-exchange-line' },
  { value: 'conflict', label: '冲突', icon: 'ri-sword-line' },
  { value: 'suspense', label: '悬疑', icon: 'ri-eye-2-line' },
  { value: 'comedy', label: '搞笑', icon: 'ri-emotion-laugh-line' },
  { value: 'emotion', label: '情绪', icon: 'ri-heart-pulse-line' },
];
const VISUAL_STYLES = [
  { value: 'cinematic', label: '写实电影感', icon: 'ri-camera-lens-line' },
  { value: 'animation', label: '动画风格', icon: 'ri-brush-line' },
  { value: '3d', label: '3D 渲染', icon: 'ri-shape-2-line' },
  { value: 'premium_ad', label: '高级广告感', icon: 'ri-sparkling-2-line' },
];
const RATIOS = ['9:16', '16:9', '1:1'];

interface Props {
  demo: DemoCaseConfig;
  onNext: () => void;
}

export function DemoCreate({ demo, onNext }: Props) {
  const { create } = demo;
  return (
    <div className="flex min-h-[calc(100vh-200px)]">
      <aside className="hidden w-72 shrink-0 border-r border-[#EAEAEA] bg-[#F7F8FA] p-8 pt-10 lg:flex">
        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#E5E5EA] bg-[#F5F5F7] px-3 py-1.5 text-[10px] font-semibold tracking-widest uppercase text-[#6E6E73]">
            <i className="ri-eye-line" />
            展示模式
          </div>
          <h2 className="mb-3 text-xl font-black text-[#1D1D1F]">S0 项目设置</h2>
          <p className="text-[13px] leading-relaxed text-[#8E8E93]">这是 {demo.title} 的项目初始化配置，展示基础参数设定。</p>
        </div>
      </aside>
      <main className="max-w-[680px] flex-1 overflow-y-auto p-6 lg:p-12">
        <h1 className="text-2xl font-black text-[#1D1D1F]">{create.projectName}</h1>
        <div className="mt-8 space-y-8">
          <div>
            <label className="mb-2 block text-[13px] font-semibold text-[#444444]">项目名称</label>
            <div className="rounded-xl border border-[#EAEAEA] bg-[#F7F8FA] px-4 py-3 text-[14px] text-[#1D1D1F]">{create.projectName}</div>
          </div>
          <div>
            <label className="mb-3 block text-[13px] font-semibold text-[#444444]">视频时长</label>
            <div className="flex gap-3">
              {DURATION_OPTIONS.map((d) => (
                <div key={d} className="flex-1 rounded-xl py-3 text-center text-[14px] font-semibold" style={{ background: create.duration === d ? '#1D1D1F' : '#F7F8FA', color: create.duration === d ? '#fff' : '#8E8E93', border: `1px solid ${create.duration === d ? '#1D1D1F' : '#EAEAEA'}` }}>{d}</div>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-3 block text-[13px] font-semibold text-[#444444]">内容形式</label>
            <div className="grid grid-cols-2 gap-3">
              {FORMAT_OPTIONS.map((f) => (
                <div key={f.value} className="rounded-xl p-4" style={{ background: create.format === f.value ? '#1D1D1F' : '#F7F8FA', border: `1px solid ${create.format === f.value ? '#1D1D1F' : '#EAEAEA'}` }}>
                  <p className="mb-1 text-[13.5px] font-semibold" style={{ color: create.format === f.value ? '#fff' : '#1D1D1F' }}>{f.label}</p>
                  <p className="text-[11.5px]" style={{ color: create.format === f.value ? 'rgba(255,255,255,0.65)' : '#8E8E93' }}>{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-3 block text-[13px] font-semibold text-[#444444]">剧情风格</label>
            <div className="flex flex-wrap gap-2">
              {PLOT_STYLES.map((s) => {
                const active = create.plotStyles.includes(s.value);
                return (
                  <div key={s.value} className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-medium" style={{ background: active ? '#1D1D1F' : '#F7F8FA', border: `1px solid ${active ? '#1D1D1F' : '#EAEAEA'}`, color: active ? '#fff' : '#6E6E73' }}>
                    <i className={`${s.icon} text-[13px]`} />
                    {s.label}
                  </div>
                );
              })}
            </div>
          </div>
          <div>
            <label className="mb-3 block text-[13px] font-semibold text-[#444444]">视觉风格</label>
            <div className="grid grid-cols-2 gap-3">
              {VISUAL_STYLES.map((s) => (
                <div key={s.value} className="flex items-center gap-3 rounded-xl p-4" style={{ background: create.visualStyle === s.value ? '#1D1D1F' : '#F7F8FA', border: `1px solid ${create.visualStyle === s.value ? '#1D1D1F' : '#EAEAEA'}` }}>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: create.visualStyle === s.value ? 'rgba(255,255,255,0.15)' : '#EAEAEA' }}>
                    <i className={`${s.icon} text-[14px]`} style={{ color: create.visualStyle === s.value ? '#fff' : '#6E6E73' }} />
                  </div>
                  <span className="text-[13px] font-medium" style={{ color: create.visualStyle === s.value ? '#fff' : '#444' }}>{s.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-3 block text-[13px] font-semibold text-[#444444]">画面比例</label>
            <div className="flex gap-3">
              {RATIOS.map((r) => (
                <div key={r} className="flex-1 rounded-xl py-3 text-center text-[14px] font-semibold" style={{ background: create.ratio === r ? '#1D1D1F' : '#F7F8FA', color: create.ratio === r ? '#fff' : '#8E8E93', border: `1px solid ${create.ratio === r ? '#1D1D1F' : '#EAEAEA'}` }}>{r}</div>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-10 flex justify-end border-t border-[#EAEAEA] pt-8">
          <button onClick={onNext} className="rounded-xl bg-[#1D1D1F] px-7 py-3 text-[14px] font-semibold text-white">
            查看 S1 内容理解
          </button>
        </div>
      </main>
    </div>
  );
}
