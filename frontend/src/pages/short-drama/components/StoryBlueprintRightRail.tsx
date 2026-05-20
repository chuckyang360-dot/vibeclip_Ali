import type { StoryBlueprintAnalysisSection } from '@/types/shortDrama';
import type { StoryBlueprintLayerCompleteness } from '../utils/storyBlueprintDerived';
import { ri } from '../utils/shortDramaHelpers';

type Props = {
  sections: StoryBlueprintAnalysisSection[];
  overallEval?: { ready: boolean; message: string; layers: StoryBlueprintLayerCompleteness };
  className?: string;
};

type StatusTone = 'ready' | 'pending' | 'none';

const SECTION_HEADER_ICON: Record<string, string> = {
  creative_structure: 'ri-draft-line',
  asset_readiness: 'ri-stack-line',
  video_readiness: 'ri-video-line',
};

const SECTION_HEADER_COLOR: Record<string, string> = {
  creative_structure: '#059669',
  asset_readiness: '#D97706',
  video_readiness: '#6366f1',
};

function statusFromDisplayValue(value: string): StatusTone {
  const v = value.trim();
  if (!v || v === '—') return 'none';
  if (v.includes('未生成') || v.includes('待生成') || v.includes('待补全')) return 'pending';
  if (v.includes('已生成') || v.includes('完整')) return 'ready';
  const countMatch = /^(\d+)\s*(条|个|段|拍)/.exec(v);
  if (countMatch) return Number.parseInt(countMatch[1], 10) > 0 ? 'ready' : 'pending';
  return 'ready';
}

function StatusDot({ status }: { status: StatusTone }) {
  if (status === 'ready') {
    return (
      <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full" style={{ background: '#d1fae5' }}>
        <i className={ri('ri-check-line', 'text-[9px] text-[#059669]')} aria-hidden />
      </div>
    );
  }
  if (status === 'pending') {
    return (
      <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full" style={{ background: '#fef3c7' }}>
        <i className={ri('ri-time-line', 'text-[9px] text-[#D97706]')} aria-hidden />
      </div>
    );
  }
  return (
    <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full" style={{ background: '#F5F5F7' }}>
      <i className={ri('ri-subtract-line', 'text-[9px] text-[#AEAEB2]')} aria-hidden />
    </div>
  );
}

function CheckRow({ label, value, status }: { label: string; value: string; status: StatusTone }) {
  return (
    <div className="flex items-center justify-between gap-2 py-2" style={{ borderBottom: '1px solid #F5F5F7' }}>
      <div className="flex items-center gap-2">
        <StatusDot status={status} />
        <span className="text-[11.5px]" style={{ color: '#444444' }}>
          {label}
        </span>
      </div>
      <span className="text-[11px] font-medium" style={{ color: '#8E8E93' }}>
        {value}
      </span>
    </div>
  );
}

/** Framer RightPanel：蓝图检查（数据来自 pipeline 派生）。 */
export function StoryBlueprintRightRail({ sections, overallEval, className = '' }: Props) {
  const layers = overallEval?.layers;
  const overallReady = layers?.readyCount === 3;

  const displaySections = sections.filter((s) => s.key !== 'blueprint_completeness');

  return (
    <aside
      className={`hidden w-60 shrink-0 flex-col overflow-y-auto border-[#EAEAEA] xl:flex xl:border-l xl:p-5 xl:pt-9 ${className}`}
      style={{ background: '#F9F9FB' }}
    >
      <p className="mb-3 text-[10px] font-bold uppercase tracking-widest" style={{ color: '#AEAEB2' }}>
        蓝图检查
      </p>

      {displaySections.map((section) => {
        const headerIcon = SECTION_HEADER_ICON[section.key] ?? section.icon;
        const headerColor = SECTION_HEADER_COLOR[section.key] ?? section.color;
        return (
          <div key={section.key} className="mb-3 rounded-xl p-3.5" style={{ background: '#ffffff', border: '1px solid #EAEAEA' }}>
            <div className="mb-2 flex items-center gap-1.5">
              <i className={ri(headerIcon, 'text-[12px]')} style={{ color: headerColor }} aria-hidden />
              <span className="text-[11px] font-bold text-[#1D1D1F]">{section.title}</span>
            </div>
            {section.fields.map((field) => (
              <CheckRow
                key={`${section.key}-${field.label}`}
                label={field.label}
                value={field.value}
                status={statusFromDisplayValue(field.value)}
              />
            ))}
          </div>
        );
      })}

      {layers ? (
        <div
          className="mb-5 rounded-xl p-3.5"
          style={{
            background: overallReady ? 'rgba(5,150,105,0.05)' : 'rgba(217,119,6,0.05)',
            border: `1px solid ${overallReady ? 'rgba(5,150,105,0.18)' : 'rgba(217,119,6,0.18)'}`,
          }}
        >
          <p
            className="mb-2 text-[10px] font-bold uppercase tracking-wider"
            style={{ color: overallReady ? '#059669' : '#D97706' }}
          >
            蓝图完整性 {layers.readyCount}/3
          </p>
          <div className="space-y-1.5">
            {[
              { label: '故事层', ready: layers.story },
              { label: '分段层', ready: layers.segment },
              { label: '生产层', ready: layers.production },
            ].map(({ label, ready }) => (
              <div key={label} className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="h-1.5 w-1.5 rounded-full" style={{ background: ready ? '#059669' : '#D97706' }} />
                  <span className="text-[11px]" style={{ color: '#444444' }}>
                    {label}
                  </span>
                </div>
                <span className="text-[10px] font-semibold" style={{ color: ready ? '#059669' : '#D97706' }}>
                  {ready ? '完整' : '待补充'}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </aside>
  );
}
