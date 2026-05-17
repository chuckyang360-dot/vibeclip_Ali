import { useState } from 'react';
import type { StoryBlueprintSubtitleVm } from '../utils/shortDramaAdapters';
import { ri } from '../utils/shortDramaHelpers';
import { FramerEmptyInline } from './storyBlueprintDisplay';

function StrategyRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 py-2.5" style={{ borderBottom: '1px solid #F5F5F7' }}>
      <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
        <i className={ri(`${icon} text-[12px] text-[#8E8E93]`)} aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: '#AEAEB2' }}>
          {label}
        </p>
        <p className="text-[12.5px] leading-relaxed" style={{ color: '#444444' }}>
          {value}
        </p>
      </div>
    </div>
  );
}

const ROW_ICON: Record<string, string> = {
  是否启用: 'ri-toggle-line',
  字幕语言: 'ri-translate-2',
  字幕风格: 'ri-font-size',
  字幕出现方式: 'ri-layout-bottom-line',
  字幕节奏: 'ri-timer-line',
  最大行数: 'ri-list-ordered',
};

type Props = { subtitle: StoryBlueprintSubtitleVm };

export function StoryBlueprintSubtitleSection({ subtitle }: Props) {
  const [detailOpen, setDetailOpen] = useState(false);

  if (!subtitle.present) {
    return (
      <FramerEmptyInline icon="ri-closed-captioning-line" message="尚未生成字幕策略。重新生成蓝图后将在此显示。" />
    );
  }

  if (subtitle.rawText) {
    return (
      <div className="rounded-xl border border-[#EAEAEA] bg-white p-4">
        <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-[#444444]">{subtitle.rawText}</p>
      </div>
    );
  }

  const enabledRow = subtitle.rows.find((r) => r.label === '是否启用');
  const enabled = enabledRow?.value === '是';
  const language = subtitle.rows.find((r) => r.label === '字幕语言')?.value;
  const detailRows = subtitle.rows.filter((r) => r.label !== '是否启用' && r.label !== '字幕语言');

  return (
    <div className="overflow-hidden rounded-xl" style={{ border: '1px solid #EAEAEA', background: '#ffffff' }}>
      <div className="flex items-center justify-between px-4 py-3" style={{ background: '#F9F9FB' }}>
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-lg"
            style={{ background: enabled ? '#d1fae5' : '#F5F5F7' }}
          >
            <i
              className={ri('ri-closed-captioning-line text-[13px]')}
              style={{ color: enabled ? '#059669' : '#AEAEB2' }}
              aria-hidden
            />
          </div>
          <div>
            <p className="text-[12.5px] font-bold" style={{ color: '#1D1D1F' }}>
              {enabled ? '字幕已启用' : '不使用字幕'}
            </p>
            {language ? (
              <p className="text-[11px]" style={{ color: '#8E8E93' }}>
                {language}
              </p>
            ) : null}
          </div>
        </div>
        {enabled && detailRows.length ? (
          <button
            type="button"
            onClick={() => setDetailOpen((v) => !v)}
            className="flex cursor-pointer items-center gap-1 whitespace-nowrap text-[11px]"
            style={{ color: '#8E8E93' }}
          >
            {detailOpen ? '收起' : '查看详情'}
            <i className={detailOpen ? ri('ri-arrow-up-s-line text-[13px]') : ri('ri-arrow-down-s-line text-[13px]')} aria-hidden />
          </button>
        ) : null}
      </div>
      {enabled && detailOpen ? (
        <div className="px-4 pb-3" style={{ borderTop: '1px solid #EAEAEA' }}>
          {detailRows.map((row) => (
            <StrategyRow key={row.label} icon={ROW_ICON[row.label] ?? 'ri-information-line'} label={row.label} value={row.value} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
