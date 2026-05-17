import { useState, type ReactNode } from 'react';
import type { StoryBlueprintKvFieldVm } from '../utils/shortDramaAdapters';
import { ri } from '../utils/shortDramaHelpers';

/** 折叠态单行摘要截断 */
export function truncateBlueprintSummary(text: string, maxLen = 80): string {
  const t = String(text || '').trim();
  if (!t || t === '—') return '';
  return t.length > maxLen ? `${t.slice(0, maxLen)}…` : t;
}

export type CollapsibleBlueprintCardProps = {
  defaultCollapsed?: boolean;
  accentColor?: string;
  indexLabel?: string | number;
  badge?: string;
  title: string;
  meta?: ReactNode;
  summary?: string;
  statusBadge?: { label: string; tone?: 'ready' | 'muted' | 'warn' };
  children?: ReactNode;
  className?: string;
};

const STATUS_TONE = {
  ready: { bg: '#d1fae5', color: '#059669' },
  muted: { bg: '#F5F5F7', color: '#8E8E93' },
  warn: { bg: '#fef3c7', color: '#D97706' },
} as const;

/** 统一可折叠蓝图卡片：默认折叠，点击头部展开 */
export function CollapsibleBlueprintCard({
  defaultCollapsed = true,
  accentColor = '#1D1D1F',
  indexLabel,
  badge,
  title,
  meta,
  summary,
  statusBadge,
  children,
  className = '',
}: CollapsibleBlueprintCardProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const summaryText = truncateBlueprintSummary(summary ?? '');
  const borderColor = !collapsed ? `${accentColor}25` : '#EAEAEA';
  const headerBg = !collapsed ? `${accentColor}06` : '#ffffff';
  const statusStyle = statusBadge ? STATUS_TONE[statusBadge.tone ?? 'muted'] : null;

  return (
    <div
      className={`overflow-hidden rounded-2xl ${className}`.trim()}
      style={{ border: `1px solid ${borderColor}` }}
    >
      <button
        type="button"
        className="flex w-full cursor-pointer select-none flex-col gap-1 px-5 py-3.5 text-left"
        style={{ background: headerBg }}
        onClick={() => setCollapsed((v) => !v)}
      >
        <div className="flex w-full items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2.5">
            {indexLabel != null ? (
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                style={{ background: `${accentColor}15`, color: accentColor, border: `2px solid ${accentColor}35` }}
              >
                {indexLabel}
              </span>
            ) : null}
            {badge ? (
              <span
                className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                style={{ background: `${accentColor}18`, color: accentColor }}
              >
                {badge}
              </span>
            ) : null}
            <span className="truncate text-[14px] font-bold" style={{ color: '#1D1D1F' }}>
              {title}
            </span>
            {meta}
            {statusBadge && statusStyle ? (
              <span
                className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
                style={{ background: statusStyle.bg, color: statusStyle.color }}
              >
                {statusBadge.label}
              </span>
            ) : null}
          </div>
          <i
            className={
              collapsed
                ? ri('ri-arrow-down-s-line shrink-0 text-[16px] text-[#AEAEB2]')
                : ri('ri-arrow-up-s-line shrink-0 text-[16px] text-[#AEAEB2]')
            }
            aria-hidden
          />
        </div>
        {collapsed && summaryText ? (
          <p className="truncate pl-0 text-[12px] leading-snug" style={{ color: '#8E8E93' }}>
            {summaryText}
          </p>
        ) : null}
      </button>
      {!collapsed && children ? (
        <div className="px-5 py-4" style={{ background: '#ffffff', borderTop: '1px solid #F5F5F7' }}>
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function StoryBlueprintCollapsibleSubSection({
  label,
  icon,
  color,
  count,
  hint,
  summary,
  defaultCollapsed = true,
  children,
}: {
  label: string;
  icon: string;
  color: string;
  count?: number | null;
  hint?: string;
  summary?: string;
  defaultCollapsed?: boolean;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const summaryText = truncateBlueprintSummary(summary ?? '');

  return (
    <div className="mb-5 overflow-hidden rounded-2xl" style={{ background: '#ffffff', border: '1px solid #EAEAEA' }}>
      <button
        type="button"
        className="flex w-full cursor-pointer select-none flex-col gap-1 px-5 py-4 text-left"
        onClick={() => setCollapsed((v) => !v)}
      >
        <div className="flex w-full items-center gap-2.5">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg" style={{ background: `${color}12` }}>
            <i className={ri(`${icon} text-[11px]`)} style={{ color }} aria-hidden />
          </div>
          <span className="text-[12.5px] font-bold text-[#1D1D1F]">{label}</span>
          {count != null && count > 0 ? (
            <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ background: `${color}10`, color }}>
              {count}
            </span>
          ) : null}
          <div className="h-px flex-1" style={{ background: '#F0F0F0' }} />
          {hint && collapsed ? (
            <span className="shrink-0 text-[10px]" style={{ color: '#C7C7CC' }}>
              {hint}
            </span>
          ) : null}
          <i
            className={
              collapsed
                ? ri('ri-arrow-down-s-line shrink-0 text-[16px] text-[#AEAEB2]')
                : ri('ri-arrow-up-s-line shrink-0 text-[16px] text-[#AEAEB2]')
            }
            aria-hidden
          />
        </div>
        {collapsed && summaryText ? (
          <p className="truncate text-[12px] leading-snug" style={{ color: '#8E8E93' }}>
            {summaryText}
          </p>
        ) : null}
      </button>
      {!collapsed ? <div className="px-5 pb-5 pt-0">{children}</div> : null}
    </div>
  );
}

export function scrollToBlueprintSection(id: string) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

const ANCHOR_TABS = [
  { id: 'layer-1', icon: 'ri-book-open-line', label: '故事理解' },
  { id: 'layer-2', icon: 'ri-scissors-cut-line', label: '执行分段' },
  { id: 'layer-3', icon: 'ri-settings-4-line', label: '生产准备' },
] as const;

export function StoryBlueprintAnchorNav() {
  return (
    <div className="mb-5 flex w-fit items-center gap-1 rounded-xl p-1" style={{ background: '#ffffff', border: '1px solid #EAEAEA' }}>
      {ANCHOR_TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => scrollToBlueprintSection(tab.id)}
          className="flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors"
          style={{ color: '#666666' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#F5F5F7';
            e.currentTarget.style.color = '#1D1D1F';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = '#666666';
          }}
        >
          <i className={ri(`${tab.icon} text-[11px]`)} aria-hidden />
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function StoryBlueprintSectionDivider({
  id,
  layer,
  title,
  desc,
  icon,
}: {
  id: string;
  layer: number;
  title: string;
  desc: string;
  icon: string;
}) {
  return (
    <div id={id} className="mb-5 flex scroll-mt-24 items-center gap-3">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg" style={{ background: '#1D1D1F' }}>
        <i className={ri(`${icon} text-[11px] text-white`)} aria-hidden />
      </div>
      <div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: '#AEAEB2' }}>
            第 {layer} 层
          </span>
          <span className="text-[13px] font-bold" style={{ color: '#1D1D1F' }}>
            {title}
          </span>
        </div>
        <p className="text-[11px]" style={{ color: '#AEAEB2' }}>
          {desc}
        </p>
      </div>
      <div className="h-px flex-1" style={{ background: '#EAEAEA' }} />
    </div>
  );
}

export function StoryBlueprintBlockHeader({
  label,
  icon,
  color,
  count,
  hint,
}: {
  label: string;
  icon: string;
  color: string;
  count?: number | null;
  hint?: string;
}) {
  return (
    <div className="mb-4 flex items-center gap-2.5">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg" style={{ background: `${color}12` }}>
        <i className={ri(`${icon} text-[11px]`)} style={{ color }} aria-hidden />
      </div>
      <span className="text-[12.5px] font-bold text-[#1D1D1F]">{label}</span>
      {count != null && count > 0 ? (
        <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ background: `${color}10`, color }}>
          {count}
        </span>
      ) : null}
      <div className="h-px flex-1" style={{ background: '#F0F0F0' }} />
      {hint ? (
        <span className="shrink-0 text-[10px]" style={{ color: '#C7C7CC' }}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}

export function StoryBlueprintSubSection({ children }: { children: ReactNode }) {
  return (
    <div className="mb-5 rounded-2xl p-5" style={{ background: '#ffffff', border: '1px solid #EAEAEA' }}>
      {children}
    </div>
  );
}

export function StoryBlueprintFieldGrid({ fields }: { fields: StoryBlueprintKvFieldVm[] }) {
  if (!fields.length) return null;
  return (
    <div className="mt-3 grid grid-cols-1 gap-3 border-t border-[#F0F0F0] pt-3 sm:grid-cols-2">
      {fields.map((field) => (
        <FieldBlock key={`${field.label}-${field.value.slice(0, 24)}`} label={field.label} value={field.value} />
      ))}
    </div>
  );
}

export function FieldBlock({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  if (!value.trim() || value === '—') return null;
  return (
    <div className={wide ? 'sm:col-span-2' : undefined}>
      <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[#AEAEB2]">{label}</p>
      <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-[#444444]">{value}</p>
    </div>
  );
}

export function PromptMonoBlock({ text }: { text: string }) {
  return (
    <div
      className="rounded-lg p-3 text-[11.5px] leading-relaxed"
      style={{
        background: '#F7F8FA',
        border: '1px solid #EAEAEA',
        color: '#666666',
        fontFamily: 'ui-monospace, monospace',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}
    >
      {text}
    </div>
  );
}

export function SpecFieldBox({
  icon,
  label,
  value,
  warning,
}: {
  icon: string;
  label: string;
  value: string;
  warning?: boolean;
}) {
  return (
    <div
      className="rounded-lg px-3 py-2.5"
      style={{
        background: warning ? '#fff7f7' : '#F9F9FB',
        border: `1px solid ${warning ? '#fee2e2' : '#EAEAEA'}`,
      }}
    >
      <div className="mb-1 flex items-center gap-1.5">
        <i className={ri(icon, 'text-[10px]')} style={{ color: warning ? '#dc2626' : '#8E8E93' }} aria-hidden />
        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: warning ? '#dc2626' : '#AEAEB2' }}>
          {label}
        </span>
      </div>
      <p className="text-[12px] leading-relaxed" style={{ color: warning ? '#dc2626' : '#444444' }}>
        {value}
      </p>
    </div>
  );
}

export function FramerEmptyInline({
  icon,
  message,
  submessage,
}: {
  icon: string;
  message: string;
  submessage?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl p-5" style={{ border: '1px dashed #EAEAEA', background: '#FAFAFA' }}>
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ background: '#F0F0F0' }}>
        <i className={ri(`${icon} text-[14px] text-[#AEAEB2]`)} aria-hidden />
      </div>
      <div>
        <p className="text-[12px]" style={{ color: '#AEAEB2' }}>
          {message}
        </p>
        {submessage ? (
          <p className="mt-0.5 text-[11px]" style={{ color: '#C7C7CC' }}>
            {submessage}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function FramerEmptyCentered({ icon, message }: { icon: string; message: string }) {
  return (
    <div className="rounded-xl p-6 text-center" style={{ border: '1px dashed #EAEAEA', background: '#FAFAFA' }}>
      <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center">
        <i className={ri(`${icon} text-[18px] text-[#AEAEB2]`)} aria-hidden />
      </div>
      <p className="text-[12px]" style={{ color: '#AEAEB2' }}>
        {message}
      </p>
    </div>
  );
}
