import type { SegmentItem } from "../types";

interface TimelineProps {
  segments: SegmentItem[];
  videoStatus: Record<number, "idle" | "generating" | "done">;
  activeSegment: number;
  onSegmentClick: (id: number) => void;
  onAddSegment: () => void;
  onCompose: () => void;
}

export default function Timeline({
  segments,
  videoStatus,
  activeSegment,
  onSegmentClick,
  onAddSegment,
  onCompose,
}: TimelineProps) {
  const allDone = segments.length > 0 && segments.every((s) => videoStatus[s.id] === "done");
  const doneCount = segments.filter((s) => videoStatus[s.id] === "done").length;

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
          disabled={!allDone}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[12px] font-semibold whitespace-nowrap transition-all duration-200"
          style={{
            background: allDone ? "#1D1D1F" : "#F0F0F0",
            color: allDone ? "#ffffff" : "#AEAEB2",
            cursor: allDone ? "pointer" : "not-allowed",
            border: allDone ? "1px solid #1D1D1F" : "1px solid #EAEAEA",
          }}
          onMouseEnter={(e) => {
            if (allDone) (e.currentTarget as HTMLElement).style.background = "#374151";
          }}
          onMouseLeave={(e) => {
            if (allDone) (e.currentTarget as HTMLElement).style.background = "#1D1D1F";
          }}
        >
          <i className="ri-film-line text-[11px]" />
          合成完整视频
        </button>
      </div>

      {/* Timeline segments bar + add button */}
      <div className="flex items-center gap-1.5 w-full">
        {/* Segment blocks */}
        <div className="flex flex-1 h-11 rounded-xl overflow-hidden gap-0.5">
          {segments.map((seg) => {
            const status = videoStatus[seg.id] || "idle";
            const isActive = activeSegment === seg.id;

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
                {status === "generating" && (
                  <div className="absolute inset-0 opacity-8 animate-pulse" style={{ background: seg.color }} />
                )}
                {/* Status icon */}
                {status === "done" && (
                  <i className="ri-checkbox-circle-fill text-[10px] shrink-0" style={{ color: seg.color }} />
                )}
                {status === "generating" && (
                  <i className="ri-loader-4-line text-[10px] animate-spin shrink-0" style={{ color: seg.color }} />
                )}
                {status === "idle" && seg.isNew && (
                  <i className="ri-edit-line text-[10px] shrink-0" style={{ color: "#AEAEB2" }} />
                )}
                <span className="truncate text-[11px]">{seg.name}</span>
                {status !== "idle" && (
                  <span className="shrink-0 text-[10px]" style={{ color: "#AEAEB2" }}>{seg.duration}</span>
                )}
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
          onClick={onAddSegment}
          className="flex-shrink-0 h-11 flex items-center gap-1.5 px-3.5 rounded-xl cursor-pointer transition-all duration-200 whitespace-nowrap"
          style={{
            background: "#ffffff",
            border: "1.5px dashed #D1D1D6",
            color: "#8E8E93",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = "#F5F5F7";
            (e.currentTarget as HTMLElement).style.borderColor = "#1D1D1F";
            (e.currentTarget as HTMLElement).style.color = "#1D1D1F";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "#ffffff";
            (e.currentTarget as HTMLElement).style.borderColor = "#D1D1D6";
            (e.currentTarget as HTMLElement).style.color = "#8E8E93";
          }}
        >
          <i className="ri-add-circle-line text-[14px]" />
          <span className="text-[11.5px] font-medium">新增片段</span>
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
                    videoStatus[s.id] === "done"
                      ? "#047857"
                      : videoStatus[s.id] === "generating"
                      ? "#B45309"
                      : "#D1D1D6",
                }}
              />
              <span className="text-[10px]" style={{ color: "#AEAEB2" }}>
                {s.name.split(" · ")[1] || s.name}
              </span>
            </div>
          ))}
        </div>
        {!allDone && (
          <p className="text-[10px]" style={{ color: "#AEAEB2" }}>
            {doneCount}/{segments.length} 已完成 · 全部生成后可合成
          </p>
        )}
        {allDone && (
          <p className="text-[10px] font-medium" style={{ color: "#047857" }}>
            ✓ 所有片段已就绪
          </p>
        )}
      </div>
    </div>
  );
}
