import type { AspectRatioOption, DurationOption, NarrativeStyle, ProjectFormat, TargetMarketOption, VisualStyle } from '@/types/shortDrama';
import { BRAND_TONE_OPTIONS, MARKETING_GOAL_OPTIONS, TARGET_MARKET_OPTIONS } from '../utils/projectLocales';
import { ri, sdColors } from '../utils/shortDramaHelpers';

const DURATIONS: DurationOption[] = ['30s', '45s', '60s'];

const FORMATS: { value: ProjectFormat; label: string; desc: string }[] = [
  { value: 'single_ad', label: '单条广告', desc: '独立完整的广告短片' },
  { value: 'series', label: '系列短视频', desc: '多集连载营销内容' },
];

const NARRATIVE_STYLE_OPTIONS: { value: NarrativeStyle; label: string; icon: string }[] = [
  { value: 'light_conflict', label: '轻冲突', icon: 'ri-scales-3-line' },
  { value: 'healing', label: '治愈陪伴', icon: 'ri-mental-health-line' },
  { value: 'comedy', label: '轻喜剧', icon: 'ri-emotion-laugh-line' },
  { value: 'suspense', label: '悬疑反转', icon: 'ri-eye-2-line' },
  { value: 'emotional', label: '情绪共鸣', icon: 'ri-heart-pulse-line' },
];

const VISUAL: { value: VisualStyle; label: string; icon: string }[] = [
  { value: 'cinematic', label: '写实电影感', icon: 'ri-camera-lens-line' },
  { value: 'anime', label: '动画风格', icon: 'ri-brush-line' },
  { value: '3d_render', label: '3D 渲染', icon: 'ri-shape-2-line' },
  { value: 'premium_ad', label: '高级广告感', icon: 'ri-sparkling-2-line' },
];

const RATIOS: AspectRatioOption[] = ['9:16', '16:9'];

type Props = {
  projectName: string;
  setProjectName: (v: string) => void;
  duration: DurationOption;
  setDuration: (v: DurationOption) => void;
  format: ProjectFormat;
  setFormat: (v: ProjectFormat) => void;
  narrativeStyle: NarrativeStyle;
  setNarrativeStyle: (v: NarrativeStyle) => void;
  visualStyle: VisualStyle;
  setVisualStyle: (v: VisualStyle) => void;
  aspectRatio: AspectRatioOption;
  setAspectRatio: (v: AspectRatioOption) => void;
  targetMarket: TargetMarketOption;
  setTargetMarket: (v: TargetMarketOption) => void;
  marketingGoal: string;
  setMarketingGoal: (v: string) => void;
  targetAudience: string;
  setTargetAudience: (v: string) => void;
  brandTone: string;
  setBrandTone: (v: string) => void;
  creativeIntent: string;
  setCreativeIntent: (v: string) => void;
  creativeBrief: string;
  setCreativeBrief: (v: string) => void;
};

export function ProjectCreateForm({
  projectName,
  setProjectName,
  duration,
  setDuration,
  format,
  setFormat,
  narrativeStyle,
  setNarrativeStyle,
  visualStyle,
  setVisualStyle,
  aspectRatio,
  setAspectRatio,
  targetMarket,
  setTargetMarket,
  marketingGoal,
  setMarketingGoal,
  targetAudience,
  setTargetAudience,
  brandTone,
  setBrandTone,
  creativeIntent,
  setCreativeIntent,
  creativeBrief,
  setCreativeBrief,
}: Props) {
  const inputCls =
    'w-full rounded-xl border border-[#EAEAEA] bg-[#F7F8FA] px-4 py-3 text-[14px] outline-none transition-colors focus:border-[#1D1D1F] focus:bg-white';

  return (
    <div className="space-y-8">
      <div>
        <label className="mb-2 block text-[13px] font-semibold text-[#444444]">
          项目名称 <span className="text-red-600">*</span>
        </label>
        <input
          className={inputCls}
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          placeholder="例如：夏季新品推广竖屏短视频"
        />
      </div>

      <div>
        <label className="mb-3 block text-[13px] font-semibold text-[#444444]">视频时长</label>
        <div className="flex gap-3">
          {DURATIONS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDuration(d)}
              className="flex-1 rounded-xl py-3 text-[14px] font-semibold transition-colors"
              style={{
                background: duration === d ? sdColors.ink : sdColors.surface,
                border: `1px solid ${duration === d ? sdColors.ink : sdColors.border}`,
                color: duration === d ? '#fff' : '#8E8E93',
              }}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-3 block text-[13px] font-semibold text-[#444444]">内容形式</label>
        <div className="grid grid-cols-2 gap-3">
          {FORMATS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFormat(f.value)}
              className="cursor-pointer rounded-xl p-4 text-left transition-colors"
              style={{
                background: format === f.value ? sdColors.ink : sdColors.surface,
                border: `1px solid ${format === f.value ? sdColors.ink : sdColors.border}`,
              }}
            >
              <p
                className="mb-1 text-[13.5px] font-semibold"
                style={{ color: format === f.value ? '#fff' : sdColors.ink }}
              >
                {f.label}
              </p>
              <p
                className="text-[11.5px]"
                style={{ color: format === f.value ? 'rgba(255,255,255,0.65)' : '#8E8E93' }}
              >
                {f.desc}
              </p>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-3 block text-[13px] font-semibold text-[#444444]">叙事风格</label>
        <div className="flex flex-wrap gap-2">
          {NARRATIVE_STYLE_OPTIONS.map((s) => {
            const active = narrativeStyle === s.value;
            return (
              <button
                key={s.value}
                type="button"
                onClick={() => setNarrativeStyle(s.value)}
                className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-medium transition-colors"
                style={{
                  background: active ? sdColors.ink : sdColors.surface,
                  border: `1px solid ${active ? sdColors.ink : sdColors.border}`,
                  color: active ? '#fff' : '#6E6E73',
                }}
              >
                <i
                  className={ri(s.icon, 'text-[13px]')}
                  style={{ color: active ? '#fff' : '#6E6E73' }}
                  aria-hidden
                />
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="mb-3 block text-[13px] font-semibold text-[#444444]">视觉风格</label>
        <div className="grid grid-cols-2 gap-3">
          {VISUAL.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setVisualStyle(s.value)}
              className="flex cursor-pointer items-center gap-3 rounded-xl p-4 transition-colors"
              style={{
                background: visualStyle === s.value ? sdColors.ink : sdColors.surface,
                border: `1px solid ${visualStyle === s.value ? sdColors.ink : sdColors.border}`,
              }}
            >
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                style={{
                  background: visualStyle === s.value ? 'rgba(255,255,255,0.15)' : '#EAEAEA',
                }}
              >
                <i
                  className={ri(s.icon, 'text-[14px]')}
                  style={{ color: visualStyle === s.value ? '#fff' : '#6E6E73' }}
                  aria-hidden
                />
              </div>
              <span
                className="text-[13px] font-medium"
                style={{ color: visualStyle === s.value ? '#fff' : '#444444' }}
              >
                {s.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-3 block text-[13px] font-semibold text-[#444444]">目标市场</label>
        <select
          className={inputCls}
          value={targetMarket}
          onChange={(e) => setTargetMarket(e.target.value as TargetMarketOption)}
        >
          {TARGET_MARKET_OPTIONS.map((market) => (
            <option key={market.value} value={market.value}>
              {market.value} / {market.zhLabel}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-3 block text-[13px] font-semibold text-[#444444]">营销目标</label>
        <select className={inputCls} value={marketingGoal} onChange={(e) => setMarketingGoal(e.target.value)}>
          {MARKETING_GOAL_OPTIONS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.zhLabel}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-2 block text-[13px] font-semibold text-[#444444]">目标受众</label>
        <input
          className={inputCls}
          value={targetAudience}
          onChange={(e) => setTargetAudience(e.target.value)}
          placeholder="例如：北美年轻通勤人群、TikTok 女性用户、独居青年等。"
        />
      </div>

      <div>
        <label className="mb-3 block text-[13px] font-semibold text-[#444444]">品牌调性</label>
        <select className={inputCls} value={brandTone} onChange={(e) => setBrandTone(e.target.value)}>
          {BRAND_TONE_OPTIONS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.zhLabel}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-2 block text-[13px] font-semibold text-[#444444]">创作意图</label>
        <textarea
          className={inputCls}
          rows={4}
          value={creativeIntent}
          onChange={(e) => setCreativeIntent(e.target.value)}
          placeholder="用自然语言描述这条视频想表达什么、希望什么风格、强调什么、不想要什么。"
        />
      </div>

      <div>
        <label className="mb-2 block text-[13px] font-semibold text-[#444444]">补充创作说明</label>
        <textarea
          className={inputCls}
          rows={4}
          value={creativeBrief}
          onChange={(e) => setCreativeBrief(e.target.value)}
          placeholder="补充你希望强调的剧情方向、禁忌、产品使用场景等。"
        />
      </div>

      <div>
        <label className="mb-3 block text-[13px] font-semibold text-[#444444]">画面比例</label>
        <div className="flex gap-3">
          {RATIOS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setAspectRatio(r)}
              className="flex-1 rounded-xl py-3 text-[14px] font-semibold transition-colors"
              style={{
                background: aspectRatio === r ? sdColors.ink : sdColors.surface,
                border: `1px solid ${aspectRatio === r ? sdColors.ink : sdColors.border}`,
                color: aspectRatio === r ? '#fff' : '#8E8E93',
              }}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
