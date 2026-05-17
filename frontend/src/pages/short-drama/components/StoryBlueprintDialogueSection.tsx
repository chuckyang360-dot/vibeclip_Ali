import { useMemo, useState } from 'react';
import type { StoryBlueprintDialogueVm } from '../utils/shortDramaAdapters';
import { ri } from '../utils/shortDramaHelpers';
import { CollapsibleBlueprintCard, FramerEmptyInline, truncateBlueprintSummary } from './storyBlueprintDisplay';

const TYPE_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  voiceover: { label: '旁白', icon: 'ri-mic-line', color: '#6366f1' },
  dialogue: { label: '对白', icon: 'ri-chat-3-line', color: '#0891b2' },
  subtitle_only: { label: '屏幕文字', icon: 'ri-text', color: '#D97706' },
  silent: { label: '静默', icon: 'ri-volume-mute-line', color: '#8E8E93' },
  sound_cue: { label: '音效提示', icon: 'ri-music-2-line', color: '#059669' },
};

function DialogueRow({ item }: { item: StoryBlueprintDialogueVm }) {
  const cfg = TYPE_CONFIG[item.mode] ?? { label: item.modeLabel, icon: 'ri-mic-line', color: '#6366f1' };
  const title = item.speaker && item.speaker !== '—' ? item.speaker : cfg.label;
  const summary = truncateBlueprintSummary(item.text, 96);

  return (
    <CollapsibleBlueprintCard title={title} badge={cfg.label} summary={summary || '暂无文案'} accentColor={cfg.color} className="rounded-xl">
      {item.speaker && item.speaker !== '—' ? (
        <p className="mb-2 text-[10px] font-bold" style={{ color: '#8E8E93' }}>
          {item.speaker}
          {item.timingNotes && item.timingNotes !== '—' ? (
            <span className="ml-2 font-normal" style={{ color: '#AEAEB2' }}>
              {item.timingNotes}
            </span>
          ) : null}
        </p>
      ) : null}
      <p className="text-[12.5px] leading-relaxed" style={{ color: '#1D1D1F' }}>
        {item.text}
      </p>
    </CollapsibleBlueprintCard>
  );
}

function SegmentGroup({ title, lines }: { title: string; lines: StoryBlueprintDialogueVm[] }) {
  const [collapsed, setCollapsed] = useState(true);
  const preview = truncateBlueprintSummary(lines.map((l) => l.text).join(' / '), 80);

  return (
    <div>
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="mb-2 flex w-full cursor-pointer flex-col gap-0.5 text-left"
      >
        <div className="flex w-full items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: '#8E8E93' }}>
            {title}
          </span>
          <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ background: '#F5F5F7', color: '#8E8E93' }}>
            {lines.length}
          </span>
          <div className="ml-1 h-px flex-1" style={{ background: '#EAEAEA' }} />
          <i
            className={
              collapsed
                ? ri('ri-arrow-down-s-line text-[14px] text-[#AEAEB2]')
                : ri('ri-arrow-up-s-line text-[14px] text-[#AEAEB2]')
            }
            aria-hidden
          />
        </div>
        {collapsed && preview ? (
          <p className="truncate text-[11px]" style={{ color: '#AEAEB2' }}>
            {preview}
          </p>
        ) : null}
      </button>
      {!collapsed ? (
        <div className="space-y-2">
          {lines.map((line) => (
            <DialogueRow key={line.refId || `${line.segmentId}-${line.text.slice(0, 16)}`} item={line} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

type Props = { items: StoryBlueprintDialogueVm[] };

export function StoryBlueprintDialogueSection({ items }: Props) {
  const grouped = useMemo(() => {
    const map = new Map<string, StoryBlueprintDialogueVm[]>();
    for (const item of items) {
      const key =
        item.segmentTitle && item.segmentTitle !== '—'
          ? `${item.segmentId} · ${item.segmentTitle}`
          : item.segmentId || '通用';
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return Array.from(map.entries());
  }, [items]);

  if (!items.length) {
    return (
      <FramerEmptyInline
        icon="ri-speak-line"
        message="尚未生成旁白 / 对白内容。"
        submessage="重新生成蓝图后将在此显示各段落的旁白、对白与屏幕文字。"
      />
    );
  }

  return (
    <div className="space-y-4">
      {grouped.map(([title, lines]) => (
        <SegmentGroup key={title} title={title} lines={lines} />
      ))}
    </div>
  );
}
