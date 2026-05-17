import type { StoryBlueprintAnalysisSection } from '@/types/shortDrama';
import type { StoryBlueprintLayerCompleteness } from '../utils/storyBlueprintDerived';
import { scrollToBlueprintSection } from './storyBlueprintDisplay';
import { ri } from '../utils/shortDramaHelpers';

type Props = {
  sections: StoryBlueprintAnalysisSection[];
  overallEval?: { ready: boolean; message: string; layers: StoryBlueprintLayerCompleteness };
  onNext?: () => void;
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

function AnchorLink({ layer, id, icon, label }: { layer: string; id: string; icon: string; label: string }) {
  return (
    <button
      type="button"
      onClick={() => scrollToBlueprintSection(id)}
      className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-[12px] transition-colors"
      style={{ color: '#444444' }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = '#F5F5F7';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
      }}
    >
      <div className="flex h-4 w-4 shrink-0 items-center justify-center">
        <i className={ri(`${icon} text-[10px] text-[#8E8E93]`)} aria-hidden />
      </div>
      <span className="flex-1 text-left">{label}</span>
      <span className="text-[9px] font-bold" style={{ color: '#C7C7CC' }}>
        {layer}
      </span>
      <i className={ri('ri-arrow-right-up-line text-[10px] text-[#C7C7CC]')} aria-hidden />
    </button>
  );
}

/** Framer RightPanel：蓝图检查 + 页面导航 + 进入资产管理（数据来自 pipeline 派生）。 */
export function StoryBlueprintRightRail({ sections, overallEval, onNext, className = '' }: Props) {
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

      <div className="mb-4 rounded-xl p-2" style={{ background: '#ffffff', border: '1px solid #EAEAEA' }}>
        <p className="px-2.5 pb-1.5 pt-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: '#AEAEB2' }}>
          页面导航
        </p>
        <AnchorLink layer="第1层" id="layer-1" icon="ri-book-open-line" label="故事理解" />
        <AnchorLink layer="第2层" id="layer-2" icon="ri-scissors-cut-line" label="执行分段" />
        <AnchorLink layer="第3层" id="layer-3" icon="ri-settings-4-line" label="生产准备" />
      </div>

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

      {onNext ? (
        <button
          type="button"
          onClick={onNext}
          className="flex w-full cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-3 text-[13px] font-semibold text-white transition-colors"
          style={{ background: '#1D1D1F' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#374151';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#1D1D1F';
          }}
        >
          进入资产管理
          <i className={ri('ri-arrow-right-line text-[12px]')} aria-hidden />
        </button>
      ) : null}
    </aside>
  );
}
