import type { StoryBlueprint } from '@/types/shortDrama';
import { ri, sdColors, sdFontHeading } from '../utils/shortDramaHelpers';

const BLOCKS: Array<{
  key: keyof StoryBlueprint;
  label: string;
  icon: string;
  isTitle?: boolean;
}> = [
  { key: 'title', label: '剧集标题', icon: 'ri-quill-pen-line', isTitle: true },
  { key: 'premise', label: '故事前提 Premise', icon: 'ri-book-open-line' },
  { key: 'hook', label: '钩子 Hook', icon: 'ri-anchor-line' },
  { key: 'coreConflict', label: '核心冲突 Conflict', icon: 'ri-sword-line' },
  { key: 'twist', label: '反转 Twist', icon: 'ri-exchange-funds-line' },
  { key: 'resolution', label: '结尾 Resolution', icon: 'ri-flag-line' },
];

type Props = {
  blueprint: StoryBlueprint;
};

const formatSummaryValue = (value: unknown): string => {
  if (value == null) return '—';
  if (typeof value === 'string') return value || '—';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    return (
      value
        .map((item) => formatSummaryValue(item))
        .filter((item) => item && item !== '—')
        .join('、') || '—'
    );
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.display === 'string') return record.display;
    if (typeof record.label === 'string') return record.label;
    if (typeof record.content === 'string') return record.content;
    if (typeof record.description === 'string') return record.description;
    return '—';
  }
  return '—';
};

export function StorySummaryCard({ blueprint }: Props) {
  return (
    <div
      className="overflow-hidden rounded-2xl border border-[#EAEAEA] bg-white shadow-[0_1px_0_rgba(0,0,0,0.04)]"
    >
      <div className="border-b border-[#EAEAEA] bg-[#FAFAFB] px-5 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white" style={{ border: `1px solid ${sdColors.border}` }}>
            <i className={ri('ri-draft-line', 'text-[13px]')} style={{ color: sdColors.ink }} aria-hidden />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#AEAEB2]">剧情蓝图</p>
            <p className="text-[12px] font-semibold text-[#444444]">结构化叙事方案 · 可直接对齐分段拍摄</p>
          </div>
        </div>
      </div>
      <div className="divide-y divide-[#F0F0F0]">
        {BLOCKS.map((b) => {
          const text = blueprint[b.key];
          return (
            <div key={b.key} className="px-5 py-4 sm:px-6 sm:py-5">
              <div className="mb-2 flex items-center gap-2">
                <div
                  className="flex h-6 w-6 items-center justify-center rounded-lg"
                  style={{ background: sdColors.surface2 }}
                >
                  <i className={ri(b.icon, 'text-[12px]')} style={{ color: sdColors.ink }} aria-hidden />
                </div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#8E8E93]">{b.label}</span>
              </div>
              <p
                className="leading-relaxed"
                style={{
                  ...sdFontHeading,
                  color: '#444444',
                  fontWeight: b.isTitle ? 800 : 400,
                  fontSize: b.isTitle ? '17px' : '13.5px',
                  fontFamily: b.isTitle ? sdFontHeading.fontFamily : 'inherit',
                }}
              >
                {formatSummaryValue(text)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
