import type { Step4SegmentItem } from '@/types/shortDrama';
import { SHORT_DRAMA_UI } from '../utils/shortDramaUiCopy';

interface TimelineProps {
  segments: Step4SegmentItem[];
  videoStatus: Record<number, "idle" | "queued" | "running" | "completed" | "failed">;
  activeSegment: number;
  onSegmentClick: (id: number) => void;
  onAddSegment: () => void;
  onCompose: () => void;
  /** 后端片段是否均已具备 video_url（可与本地新增片段并存） */
  mergeReady: boolean;
  coreDoneCount: number;
  coreTotal: number;
  composeDisabled: boolean;
  /** 无后端分段脚本时不允许本地「新增片段」 */
  addSegmentDisabled?: boolean;
  /** 合成 / 查看 主按钮文案（与底栏「合成并查看」成对） */
  composeLabel?: string;
}

export function StepFourTimeline({
  segments,
  videoStatus,
  activeSegment,
  onSegmentClick,
  onAddSegment,
  onCompose,
  mergeReady,
  coreDoneCount,
  coreTotal,
  composeDisabled,
  addSegmentDisabled = false,
  composeLabel = '合成完整视频',
}: TimelineProps) {
  const allDone = mergeReady;
  const doneCount = coreDoneCount;
  // 临时止血：手动新增片段尚未具备后端持久化能力，先关闭入口避免假交互。
  const addSegmentTemporarilyDisabled = true;
  const addSegmentLocked = addSegmentDisabled || addSegmentTemporarilyDisabled;

  const timelineLabel = (seg: Step4SegmentItem): { label: string; source: string } => {
    if (seg.shortLabel?.trim()) return { label: seg.shortLabel.trim(), source: 'short_label' };
    if (seg.functionLabel?.trim()) return { label: seg.functionLabel.trim().slice(0, 8), source: 'function_label' };
    const fromTitle = seg.name.includes('：') ? seg.name.split('：')[0].trim() : seg.name.trim();
    if (fromTitle) return { label: fromTitle.slice(0, 8), source: 'title' };
    return { label: `S${seg.id}`, source: 'fallback' };
  };

  return (
    <div
      className="flex-shrink-0 px-4 py-3 flex flex-col gap-2"
      style={{ borderTop: "1px solid #EAEAEA", background: "#F7F8FA" }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <i className="ri-timeline-view text-[12px]" style={{ color: "#AEAEB2" }} />
          <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#8E8E93" }}>
            时间轴
          </span>
          <span
            className="text-[10px] px-2 py-0.5 rounded-full"
            style={{ background: "#EAEAEA", color: "#8E8E93" }}
          >
            {segments.length} 个片段
          </span>
        </div>
        <button
          onClick={onCompose}
          disabled={composeDisabled}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[12px] font-semibold whitespace-nowrap transition-all duration-200"
          style={{
            background: !composeDisabled ? "#1D1D1F" : "#F0F0F0",
            color: !composeDisabled ? "#ffffff" : "#AEAEB2",
            cursor: !composeDisabled ? "pointer" : "not-allowed",
            border: !composeDisabled ? "1px solid #1D1D1F" : "1px solid #EAEAEA",
          }}
          onMouseEnter={(e) => {
            if (!composeDisabled) (e.currentTarget as HTMLElement).style.background = "#374151";
          }}
          onMouseLeave={(e) => {
            if (!composeDisabled) (e.currentTarget as HTMLElement).style.background = "#1D1D1F";
          }}
        >
          <i className="ri-film-line text-[11px]" />
          {composeLabel}
        </button>
      </div>

      {/* Timeline segments bar + add button */}
      <div className="flex items-center gap-1.5 w-full">
        {/* Segment blocks */}
        <div className="flex flex-1 h-11 rounded-xl overflow-hidden gap-0.5">
          {segments.map((seg) => {
            const status = videoStatus[seg.id] || "idle";
            const isActive = activeSegment === seg.id;
            const label = timelineLabel(seg);
            if (import.meta.env.DEV) {
              console.info('[S4_TIMELINE_ITEM_RENDERED]', {
                segmentId: seg.id,
                shortLabel: label.label,
                duration: seg.duration,
                status,
                source: label.source,
              });
            }

            return (
              <button
                key={seg.id}
                onClick={() => onSegmentClick(seg.id)}
                className="h-full flex items-center justify-center gap-1.5 text-[11px] font-medium cursor-pointer transition-all duration-200 relative overflow-hidden flex-1"
                style={{
                  minWidth: "80px",
                  background: isActive ? `${seg.color}18` : "#ffffff",
                  border: isActive ? `1.5px solid ${seg.color}60` : `1px solid #E5E5EA`,
                  color: isActive ? seg.color : "#6E6E73",
                  borderRadius: "6px",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLElement).style.background = `${seg.color}0a`;
                    (e.currentTarget as HTMLElement).style.borderColor = `${seg.color}35`;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLElement).style.background = "#ffffff";
                    (e.currentTarget as HTMLElement).style.borderColor = "#E5E5EA";
                  }
                }}
              >
                {/* Generating animation */}
                {(status === "queued" || status === "running") && (
                  <div className="absolute inset-0 opacity-8 animate-pulse" style={{ background: seg.color }} />
                )}
                {/* Status icon */}
                {status === "completed" && (
                  <i className="ri-checkbox-circle-fill text-[10px] shrink-0" style={{ color: seg.color }} />
                )}
                {(status === "queued" || status === "running") && (
                  <i className="ri-loader-4-line text-[10px] animate-spin shrink-0" style={{ color: seg.color }} />
                )}
                {status === "failed" && (
                  <i className="ri-close-circle-fill text-[10px] shrink-0" style={{ color: "#DC2626" }} />
                )}
                {status === "idle" && seg.isNew && (
                  <i className="ri-edit-line text-[10px] shrink-0" style={{ color: "#AEAEB2" }} />
                )}
                <span className="truncate text-[11px]">{`S${seg.id} · ${label.label}`}</span>
                <span className="shrink-0 text-[10px]" style={{ color: "#AEAEB2" }}>{seg.duration}</span>
                {/* New badge */}
                {seg.isNew && status === "idle" && (
                  <span
                    className="absolute top-0.5 right-1 text-[9px] font-bold px-1 rounded"
                    style={{ background: `${seg.color}18`, color: seg.color }}
                  >
                    NEW
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Add segment button */}
        <button
          type="button"
          disabled={addSegmentLocked}
          title="手动新增片段暂未开放"
          onClick={() => {
            if (!addSegmentLocked) onAddSegment();
          }}
          className="flex-shrink-0 h-11 flex items-center gap-1.5 px-3.5 rounded-xl transition-all duration-200 whitespace-nowrap"
          style={{
            background: addSegmentLocked ? "#F5F5F7" : "#ffffff",
            border: addSegmentLocked ? "1.5px solid #EAEAEA" : "1.5px dashed #D1D1D6",
            color: addSegmentLocked ? "#AEAEB2" : "#8E8E93",
            cursor: addSegmentLocked ? "not-allowed" : "pointer",
          }}
          onMouseEnter={(e) => {
            if (addSegmentLocked) return;
            (e.currentTarget as HTMLElement).style.background = "#F5F5F7";
            (e.currentTarget as HTMLElement).style.borderColor = "#1D1D1F";
            (e.currentTarget as HTMLElement).style.color = "#1D1D1F";
          }}
          onMouseLeave={(e) => {
            if (addSegmentLocked) return;
            (e.currentTarget as HTMLElement).style.background = "#ffffff";
            (e.currentTarget as HTMLElement).style.borderColor = "#D1D1D6";
            (e.currentTarget as HTMLElement).style.color = "#8E8E93";
          }}
        >
          <i className="ri-add-circle-line text-[14px]" />
          <span className="text-[11.5px] font-medium">手动新增片段暂未开放</span>
        </button>
      </div>

      {/* Status hint bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {segments.map((s) => (
            <div key={s.id} className="flex items-center gap-1">
              <div
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  background:
                    videoStatus[s.id] === "completed"
                      ? "#047857"
                      : videoStatus[s.id] === "queued" || videoStatus[s.id] === "running"
                      ? "#B45309"
                      : videoStatus[s.id] === "failed"
                      ? "#DC2626"
                      : "#D1D1D6",
                }}
              />
              <span className="text-[10px]" style={{ color: "#AEAEB2" }}>
                {timelineLabel(s).label}
              </span>
            </div>
          ))}
        </div>
        {!allDone && (
          <p className="text-[10px]" style={{ color: "#AEAEB2" }}>
            {doneCount}/{Math.max(coreTotal, 1)} 片段视频已生成 · 全部完成后可合成
          </p>
        )}
        {allDone && (
          <p className="text-[10px] font-medium" style={{ color: "#047857" }}>
            ✓ {SHORT_DRAMA_UI.done.segmentsReady}
          </p>
        )}
      </div>
    </div>
  );
}
