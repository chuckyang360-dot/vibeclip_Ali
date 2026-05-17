import { useState } from 'react';
import type { StoryBlueprintPageSegmentVm } from '../utils/shortDramaAdapters';
import { ri } from '../utils/shortDramaHelpers';
import { truncateBlueprintSummary } from './storyBlueprintDisplay';

type DetailRow = { label: string; value: string; accent?: boolean; wide?: boolean };

type Props = {
  segments: StoryBlueprintPageSegmentVm[];
  isEditingAll: boolean;
  detailRowsFor: (seg: StoryBlueprintPageSegmentVm) => DetailRow[];
  onSegmentFieldChange?: (segId: number, label: string, value: string) => void;
  showSectionHeader?: boolean;
};

function hasDisplayValue(value: string | undefined | null): boolean {
  const text = String(value || '').trim();
  return Boolean(text && text !== '—');
}

function FieldBlock({
  label,
  value,
  color,
  wide,
}: {
  label: string;
  value: string;
  color?: string;
  wide?: boolean;
}) {
  if (!value.trim()) return null;
  return (
    <div className={wide ? 'sm:col-span-2' : undefined}>
      <p className="mb-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: '#AEAEB2' }}>
        {label}
      </p>
      <p className="text-[12.5px] leading-relaxed" style={{ color: color || '#444444' }}>
        {value}
      </p>
    </div>
  );
}

function Chip({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value?: string;
  color?: string;
  icon?: string;
}) {
  if (!value?.trim() || value === '—') return null;
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium"
      style={{
        background: color ? `${color}10` : '#F5F5F7',
        color: color || '#666666',
        border: `1px solid ${color ? `${color}22` : '#EAEAEA'}`,
      }}
    >
      {icon ? <i className={ri(`${icon} text-[10px]`)} aria-hidden /> : null}
      <span className="mr-0.5 text-[9px] font-bold uppercase tracking-wider opacity-60">{label}</span>
      <span>{value}</span>
    </span>
  );
}

function segmentSummary(seg: StoryBlueprintPageSegmentVm, synopsis: string, goal: string): string {
  const raw = synopsis && synopsis !== '暂无概要' ? synopsis : goal && goal !== '暂无说明' ? goal : seg.keyMessage;
  return truncateBlueprintSummary(raw, 88);
}

function segmentStatusBadge(synopsis: string, goal: string): { label: string; tone: 'ready' | 'warn' } | undefined {
  const okSynopsis = Boolean(synopsis.trim() && synopsis !== '暂无概要' && synopsis !== '—');
  const okGoal = Boolean(goal.trim() && goal !== '暂无说明' && goal !== '—');
  if (okSynopsis && okGoal) return { label: '字段完整', tone: 'ready' };
  if (okSynopsis || okGoal) return { label: '部分待补', tone: 'warn' };
  return { label: '待补充', tone: 'warn' };
}

function SegmentCard({
  seg,
  index,
  total,
  isEditingAll,
  detailRows,
  onSegmentFieldChange,
}: {
  seg: StoryBlueprintPageSegmentVm;
  index: number;
  total: number;
  isEditingAll: boolean;
  detailRows: DetailRow[];
  onSegmentFieldChange?: (segId: number, label: string, value: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(true);
  const [detailExpanded, setDetailExpanded] = useState(false);
  const isLast = index === total - 1;

  const PRIMARY_LABELS = ['段落目标', '产品露出', '段落概要'] as const;
  const EXPANDED_CORE_LABELS = ['阶段名', '段落职责', '所需视觉元素', '转场到下一段'] as const;
  const primaryRows = detailRows.filter((r) => PRIMARY_LABELS.includes(r.label as (typeof PRIMARY_LABELS)[number]));
  const expandedCoreRows = detailRows.filter((r) =>
    EXPANDED_CORE_LABELS.includes(r.label as (typeof EXPANDED_CORE_LABELS)[number]),
  );
  const optionalExtraRows = detailRows.filter(
    (r) =>
      !PRIMARY_LABELS.includes(r.label as (typeof PRIMARY_LABELS)[number]) &&
      !EXPANDED_CORE_LABELS.includes(r.label as (typeof EXPANDED_CORE_LABELS)[number]),
  );
  const goal = primaryRows.find((r) => r.label === '段落目标')?.value || seg.goal || '';
  const placement = primaryRows.find((r) => r.label === '产品露出')?.value || seg.productPlacement || '';
  const synopsis = primaryRows.find((r) => r.label === '段落概要')?.value || seg.synopsis || '';
  const requiredVisualValue =
    expandedCoreRows.find((r) => r.label === '所需视觉元素')?.value ||
    (seg.expectedAssets.length ? seg.expectedAssets.join('、') : '');
  const hasOptionalExtra = optionalExtraRows.length > 0;
  const summaryLine = segmentSummary(seg, synopsis, goal);
  const statusBadge = segmentStatusBadge(synopsis, goal);

  const editFields: Array<{ label: string; key: keyof StoryBlueprintPageSegmentVm | string }> = [
    { label: '段落目标', key: 'goal' },
    { label: '段落概要', key: 'synopsis' },
    { label: '产品露出', key: 'productPlacement' },
    { label: '情绪状态', key: 'emotionalState' },
    { label: '关键信息', key: 'keyMessage' },
    { label: '段落职责', key: 'segmentRole' },
    { label: '画面需求', key: 'visualRequirement' },
    { label: '所需视觉元素', key: 'expectedAssets' },
    { label: '转场到下一段', key: 'transitionToNext' },
  ];

  return (
    <div className="flex gap-4">
      <div className="flex shrink-0 flex-col items-center">
        <div
          className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full text-[12px] font-bold"
          style={{
            background: `${seg.color}15`,
            color: seg.color,
            border: `2px solid ${seg.color}35`,
          }}
        >
          {index + 1}
        </div>
        {!isLast ? <div className="mt-2 w-px flex-1" style={{ background: '#EAEAEA', minHeight: '24px' }} /> : null}
      </div>

      <div className="mb-4 flex-1 overflow-hidden rounded-2xl" style={{ border: `1px solid ${!collapsed ? `${seg.color}25` : '#EAEAEA'}` }}>
        <button
          type="button"
          className="flex w-full cursor-pointer select-none flex-col gap-1 px-5 py-3.5 text-left"
          style={{ background: !collapsed ? `${seg.color}06` : '#ffffff' }}
          onClick={() => setCollapsed((v) => !v)}
        >
          <div className="flex w-full items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2.5">
              {seg.stageLabel.trim() ? (
                <span
                  className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                  style={{ background: `${seg.color}18`, color: seg.color }}
                >
                  {seg.stageLabel}
                </span>
              ) : null}
              <span className="truncate text-[14px] font-bold" style={{ color: '#1D1D1F' }}>
                {seg.name || `段落 ${index + 1}`}
              </span>
              {seg.duration.trim() && seg.duration !== '—' ? (
                <span
                  className="shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium"
                  style={{ background: '#F5F5F7', color: '#8E8E93', borderLeft: `2px solid ${seg.color}50` }}
                >
                  {seg.duration}
                </span>
              ) : null}
              {statusBadge ? (
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
                  style={{
                    background: statusBadge.tone === 'ready' ? '#d1fae5' : '#fef3c7',
                    color: statusBadge.tone === 'ready' ? '#059669' : '#D97706',
                  }}
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
          {collapsed && summaryLine ? (
            <p className="truncate text-[12px] leading-snug" style={{ color: '#8E8E93' }}>
              {summaryLine}
            </p>
          ) : null}
        </button>

        {!collapsed ? (
          <div className="px-5 py-4" style={{ background: '#ffffff', borderTop: '1px solid #F5F5F7' }}>
            {isEditingAll ? (
              <div className="space-y-3">
                {editFields.map((field) => {
                  const raw =
                    field.key === 'expectedAssets'
                      ? seg.expectedAssets.join('、')
                      : String(seg[field.key as keyof StoryBlueprintPageSegmentVm] ?? '');
                  return (
                    <div key={field.label}>
                      <label className="mb-1 block text-[11px] font-semibold" style={{ color: '#8E8E93' }}>
                        {field.label}
                      </label>
                      <textarea
                        value={raw}
                        onChange={(e) => onSegmentFieldChange?.(seg.id, field.label, e.target.value)}
                        rows={2}
                        className="w-full resize-none rounded-xl px-3 py-2 text-[12.5px] outline-none"
                        style={{ background: '#F7F8FA', border: '1px solid #EAEAEA', color: '#444444' }}
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div>
                <div className="mb-3 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                  <FieldBlock label="段落目标" value={goal || '暂无说明'} />
                  <FieldBlock label="产品露出" value={placement || '待定'} color={seg.color} />
                  <div className="sm:col-span-2">
                    <FieldBlock label="段落概要" value={synopsis || '暂无概要'} />
                  </div>
                </div>
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {seg.emotionalState && seg.emotionalState !== '—' ? (
                    <Chip label="情绪" value={seg.emotionalState} color={seg.color} icon="ri-emotion-line" />
                  ) : null}
                  {placement && placement !== '—' ? <Chip label="露出" value={placement} icon="ri-box-3-line" /> : null}
                  {seg.visualRequirement && seg.visualRequirement !== '—' ? (
                    <Chip label="画面需求" value={seg.visualRequirement} icon="ri-image-line" />
                  ) : null}
                </div>
                {expandedCoreRows.length || hasDisplayValue(requiredVisualValue) ? (
                  <div className="mb-3 grid grid-cols-1 gap-x-6 gap-y-3 border-t border-[#F0F0F0] pt-3 sm:grid-cols-2">
                    {expandedCoreRows
                      .filter((row) => row.label !== '所需视觉元素' || hasDisplayValue(row.value))
                      .map((row) => (
                        <FieldBlock
                          key={row.label}
                          label={row.label}
                          value={row.value}
                          color={row.accent ? seg.color : undefined}
                          wide={row.wide}
                        />
                      ))}
                    {!expandedCoreRows.some((r) => r.label === '所需视觉元素') && hasDisplayValue(requiredVisualValue) ? (
                      <FieldBlock label="所需视觉元素" value={requiredVisualValue} wide />
                    ) : null}
                  </div>
                ) : null}
                {hasOptionalExtra ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setDetailExpanded((v) => !v)}
                      className="flex cursor-pointer items-center gap-1.5 py-1 text-[11px] transition-colors"
                      style={{ color: '#8E8E93' }}
                    >
                      <i className={detailExpanded ? ri('ri-arrow-up-s-line text-[13px]') : ri('ri-arrow-down-s-line text-[13px]')} aria-hidden />
                      {detailExpanded ? '收起更多字段' : '展开更多字段'}
                    </button>
                    {detailExpanded ? (
                      <div className="mt-3 grid grid-cols-1 gap-4 border-t border-[#F0F0F0] pt-3 sm:grid-cols-2">
                        {optionalExtraRows.map((row) => (
                          <FieldBlock
                            key={row.label}
                            label={row.label}
                            value={row.value}
                            color={row.accent ? seg.color : undefined}
                            wide={row.wide}
                          />
                        ))}
                      </div>
                    ) : null}
                  </>
                ) : null}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Framer SegmentTimeline：剧情分段时间线（纯展示 + 本地编辑态）。 */
export function StoryBlueprintSegmentTimeline({
  segments,
  isEditingAll,
  detailRowsFor,
  onSegmentFieldChange,
  showSectionHeader = true,
}: Props) {
  if (!segments.length) {
    return (
      <div className="mb-6 rounded-2xl p-8 text-center" style={{ border: '1px dashed #EAEAEA', background: '#FAFAFA' }}>
        <i className={ri('ri-layout-row-line text-[22px] text-[#AEAEB2]')} aria-hidden />
        <p className="mt-3 text-[13px]" style={{ color: '#8E8E93' }}>
          暂无剧情分段数据
        </p>
      </div>
    );
  }

  return (
    <div className="mb-6">
      {showSectionHeader ? (
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center rounded-md" style={{ background: '#F5F5F7' }}>
            <i className={ri('ri-list-ordered text-[11px] text-[#1D1D1F]')} aria-hidden />
          </div>
          <h3 className="text-[12px] font-bold uppercase tracking-wider" style={{ color: '#444444' }}>
            执行分段
          </h3>
          <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: '#F5F5F7', color: '#8E8E93' }}>
            {segments.length} 段
          </span>
          <span className="text-[11px]" style={{ color: '#AEAEB2' }}>
            · 点击卡片展开详情
          </span>
        </div>
      ) : null}
      <div>
        {segments.map((seg, idx) => (
          <SegmentCard
            key={seg.id}
            seg={seg}
            index={idx}
            total={segments.length}
            isEditingAll={isEditingAll}
            detailRows={detailRowsFor(seg)}
            onSegmentFieldChange={onSegmentFieldChange}
          />
        ))}
      </div>
    </div>
  );
}
