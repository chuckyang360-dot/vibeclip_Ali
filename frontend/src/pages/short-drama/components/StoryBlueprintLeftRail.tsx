import { useState } from 'react';
import type { StoryBlueprintGlobalField, StoryBlueprintSettingRow } from '@/types/shortDrama';
import type { StoryBlueprintInputSourceRow } from '../utils/storyBlueprintDerived';

const GLOBAL_FIELD_ICONS: Record<string, string> = {
  创作目标: 'ri-focus-3-line',
  表达方向: 'ri-compass-3-line',
  视觉方向: 'ri-camera-lens-line',
  需要避免: 'ri-prohibited-line',
};

type Props = {
  settings: StoryBlueprintSettingRow[];
  metaRows?: StoryBlueprintSettingRow[];
  globalFields: StoryBlueprintGlobalField[];
  inputSources?: StoryBlueprintInputSourceRow[];
  className?: string;
};

function AIUnderstandingItem({ label, value, icon }: { label: string; value: string; icon: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = value.length > 60;
  const displayText = !expanded && isLong ? `${value.slice(0, 60)}…` : value;

  return (
    <div className="rounded-xl p-3" style={{ background: '#ffffff', border: '1px solid #EAEAEA' }}>
      <div className="mb-1.5 flex items-center gap-1.5">
        <i className={`${icon} text-[11px]`} style={{ color: '#8E8E93' }} aria-hidden />
        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#AEAEB2' }}>
          {label}
        </span>
      </div>
      <p className="text-[12px] leading-relaxed" style={{ color: '#444444' }}>
        {displayText}
      </p>
      {isLong ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 cursor-pointer whitespace-nowrap text-[10px] transition-colors"
          style={{ color: '#8E8E93' }}
        >
          {expanded ? '收起' : '展开全部'}
        </button>
      ) : null}
    </div>
  );
}

/** Framer LeftPanel：创作依据 + AI 理解摘要 + 输入来源。 */
export function StoryBlueprintLeftRail({
  settings,
  metaRows = [],
  globalFields,
  inputSources = [],
  className = '',
}: Props) {
  const chipIcons = ['ri-tv-2-line', 'ri-time-line', 'ri-phone-line'] as const;

  return (
    <aside
      className={`hidden w-60 shrink-0 flex-col overflow-y-auto border-[#EAEAEA] lg:flex lg:border-r lg:p-5 lg:pt-9 ${className}`}
      style={{ background: '#F9F9FB' }}
    >
      <div className="mb-5">
        <p className="mb-3 text-[10px] font-bold uppercase tracking-widest" style={{ color: '#AEAEB2' }}>
          创作依据
        </p>
        <div className="mb-4 flex flex-wrap gap-2">
          {settings.map((item, idx) => {
            const rawIcon = chipIcons[idx] ?? 'ri-information-line';
            const display = item.value === '—' ? item.label : item.value;
            return (
              <div
                key={item.label}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5"
                style={{ background: '#ffffff', border: '1px solid #EAEAEA' }}
              >
                <i className={`${rawIcon} text-[10px]`} style={{ color: '#8E8E93' }} aria-hidden />
                <span className="max-w-[120px] truncate text-[11px] font-medium" style={{ color: '#444444' }} title={display}>
                  {display}
                </span>
              </div>
            );
          })}
        </div>
        {metaRows.length ? (
          <div className="space-y-1">
            {metaRows.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between py-2"
                style={{ borderBottom: '1px solid #F0F0F0' }}
              >
                <span className="text-[11px]" style={{ color: '#AEAEB2' }}>
                  {item.label}
                </span>
                <span className="text-[11px] font-medium" style={{ color: '#444444' }}>
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {globalFields.length ? (
        <div>
          <p className="mb-3 text-[10px] font-bold uppercase tracking-widest" style={{ color: '#AEAEB2' }}>
            AI 理解摘要
          </p>
          <div className="space-y-2">
            {globalFields.map((item) => (
              <AIUnderstandingItem
                key={item.label}
                label={item.label}
                value={item.value}
                icon={GLOBAL_FIELD_ICONS[item.label] ?? 'ri-file-text-line'}
              />
            ))}
          </div>
        </div>
      ) : null}

      {inputSources.length ? (
        <div className="mt-5 border-t pt-4" style={{ borderColor: '#EAEAEA' }}>
          <p className="mb-2.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: '#AEAEB2' }}>
            输入来源
          </p>
          <div className="space-y-1.5">
            {inputSources.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between rounded-lg px-2.5 py-2"
                style={{ background: '#ffffff', border: '1px solid #EAEAEA' }}
              >
                <div className="flex items-center gap-1.5">
                  <i className={`${item.icon} text-[11px]`} style={{ color: '#8E8E93' }} aria-hidden />
                  <span className="text-[11px]" style={{ color: '#444444' }}>
                    {item.label}
                  </span>
                </div>
                <span
                  className="text-[10px] font-medium"
                  style={{ color: item.statusTone === 'ready' ? '#059669' : item.statusTone === 'pending' ? '#D97706' : '#AEAEB2' }}
                >
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </aside>
  );
}
