import { useState, type CSSProperties } from 'react';
import type { StoryBlueprintBeatSectionVm } from '../utils/shortDramaAdapters';
import { ri } from '../utils/shortDramaHelpers';
import { FramerEmptyCentered, truncateBlueprintSummary } from './storyBlueprintDisplay';

type Props = {
  beatsSectionTitle: string;
  usesStoryBeats: boolean;
  sections: StoryBlueprintBeatSectionVm[];
  isEditingAll: boolean;
  onSectionContentChange: (idx: number, content: string) => void;
};

const BEAT_WARM = {
  ink: '#1F1F23',
  body: '#6B5F55',
  muted: '#A8988B',
  arrowHover: '#8F4A1A',
  tagBg: '#F8EFE7',
  tagText: '#9A4F1B',
  tagBorder: '#EED7C7',
  indexBg: '#FFF2E8',
  indexBorder: '#F0C7A7',
  indexText: '#B85C1E',
  indexBgActive: '#FFE6D3',
  indexBorderActive: '#E89A5C',
  indexTextActive: '#8F3D12',
  cardBg: '#FFFDFC',
  cardBgHover: '#FFFCF8',
  cardBorder: '#EEE7DF',
  cardBorderHover: 'rgba(232, 185, 143, 0.7)',
  cardBorderExpanded: '#E7A66F',
} as const;

function BeatRhythmCard({ section, index }: { section: StoryBlueprintBeatSectionVm; index: number }) {
  const [collapsed, setCollapsed] = useState(true);
  const [hovered, setHovered] = useState(false);
  const active = !collapsed || hovered;
  const summary = truncateBlueprintSummary(section.content || section.purpose, 96);

  const cardStyle: CSSProperties = collapsed
    ? {
        background: hovered ? BEAT_WARM.cardBgHover : BEAT_WARM.cardBg,
        border: `1px solid ${hovered ? BEAT_WARM.cardBorderHover : BEAT_WARM.cardBorder}`,
        borderRadius: '18px',
        boxShadow: hovered
          ? '0 6px 18px rgba(17, 24, 39, 0.05)'
          : '0 4px 14px rgba(17, 24, 39, 0.035)',
        transform: hovered ? 'translateY(-1px)' : undefined,
        transition: 'all 160ms ease',
      }
    : {
        background: 'linear-gradient(180deg, #FFF9F3 0%, #FFFFFF 100%)',
        border: `1px solid ${BEAT_WARM.cardBorderExpanded}`,
        borderRadius: '18px',
        boxShadow: '0 8px 24px rgba(196, 113, 38, 0.08)',
        transition: 'all 160ms ease',
      };

  return (
    <div
      className="overflow-hidden"
      style={cardStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        type="button"
        className="flex w-full cursor-pointer select-none flex-col gap-2 px-5 py-4 text-left"
        onClick={() => setCollapsed((v) => !v)}
      >
        <div className="flex w-full items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <span
              className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-bold"
              style={{
                background: active ? BEAT_WARM.indexBgActive : BEAT_WARM.indexBg,
                border: `2px solid ${active ? BEAT_WARM.indexBorderActive : BEAT_WARM.indexBorder}`,
                color: active ? BEAT_WARM.indexTextActive : BEAT_WARM.indexText,
                transition: 'all 160ms ease',
              }}
            >
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              {section.purpose ? (
                <span
                  className="mb-2 inline-block max-w-full truncate rounded-full px-2.5 py-0.5 text-[10px] font-semibold leading-snug"
                  style={{
                    background: BEAT_WARM.tagBg,
                    color: BEAT_WARM.tagText,
                    border: `1px solid ${BEAT_WARM.tagBorder}`,
                  }}
                >
                  {section.purpose}
                </span>
              ) : null}
              <p className="text-[14px] font-bold leading-snug" style={{ color: BEAT_WARM.ink }}>
                {section.label}
              </p>
              {collapsed && summary ? (
                <p
                  className="mt-1.5 line-clamp-2 text-[13px] leading-[1.6]"
                  style={{ color: BEAT_WARM.body }}
                >
                  {summary}
                </p>
              ) : null}
            </div>
          </div>
          <i
            className={`mt-1 shrink-0 text-[18px] transition-all duration-160 ease-out ${
              collapsed ? ri('ri-arrow-down-s-line') : ri('ri-arrow-up-s-line')
            }`}
            style={{
              color: active ? BEAT_WARM.arrowHover : BEAT_WARM.muted,
              transform: collapsed ? undefined : 'rotate(0deg)',
            }}
            aria-hidden
          />
        </div>
      </button>
      {!collapsed ? (
        <div className="border-t px-5 pb-4 pt-1" style={{ borderColor: '#F5EBE2' }}>
          {section.purpose ? (
            <p
              className="mb-2 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
              style={{
                background: BEAT_WARM.tagBg,
                color: BEAT_WARM.tagText,
                border: `1px solid ${BEAT_WARM.tagBorder}`,
              }}
            >
              {section.purpose}
            </p>
          ) : null}
          {section.content ? (
            <p className="text-[13px] leading-[1.6]" style={{ color: BEAT_WARM.body }}>
              {section.content}
            </p>
          ) : (
            <p className="text-[13px] leading-[1.6]" style={{ color: BEAT_WARM.muted }}>
              暂无节拍内容
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function StoryBlueprintBeatsSection({
  beatsSectionTitle,
  usesStoryBeats,
  sections,
  isEditingAll,
  onSectionContentChange,
}: Props) {
  const sectionDesc = usesStoryBeats
    ? 'AI 规划的宏观叙事节奏，高于剧情段落层级'
    : '来自故事框架的宏观叙事结构';

  if (!sections.length) {
    return <FramerEmptyCentered icon="ri-map-pin-time-line" message={`暂无${beatsSectionTitle}数据`} />;
  }

  if (isEditingAll) {
    return (
      <div className="space-y-3">
        {sections.map((section, idx) => (
          <div
            key={section.key}
            className="rounded-[18px] p-4"
            style={{ background: '#FFFDFC', border: '1px solid #EEE7DF' }}
          >
            <p className="mb-2 text-[13px] font-bold" style={{ color: BEAT_WARM.ink }}>
              {section.label}
            </p>
            <textarea
              value={section.content}
              onChange={(e) => onSectionContentChange(idx, e.target.value)}
              rows={3}
              className="w-full resize-none rounded-xl border px-3 py-2 text-[13px] leading-[1.6] outline-none"
              style={{ background: '#FFFFFF', borderColor: '#EED7C7', color: BEAT_WARM.body }}
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="mb-0">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div
          className="flex h-6 w-6 items-center justify-center rounded-lg"
          style={{ background: BEAT_WARM.indexBg, border: `1px solid ${BEAT_WARM.indexBorder}` }}
        >
          <i className={ri('ri-route-line text-[12px]')} style={{ color: BEAT_WARM.indexText }} aria-hidden />
        </div>
        <h3 className="text-[12px] font-bold uppercase tracking-wider" style={{ color: '#444444' }}>
          {beatsSectionTitle}
        </h3>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-bold"
          style={{ background: BEAT_WARM.tagBg, color: BEAT_WARM.tagText, border: `1px solid ${BEAT_WARM.tagBorder}` }}
        >
          {sections.length} 拍
        </span>
        <span className="text-[11px]" style={{ color: BEAT_WARM.muted }}>
          · {sectionDesc}
        </span>
      </div>
      <div className="space-y-3">
        {sections.map((section, idx) => (
          <BeatRhythmCard key={section.key} section={section} index={idx} />
        ))}
      </div>
    </div>
  );
}
