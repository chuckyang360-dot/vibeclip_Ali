import { useState } from "react";
import type { SegmentItem, VideoStatusMap, RenderProgressMap } from "../types";

interface SegmentPanelProps {
  segments: SegmentItem[];
  activeSegment: number;
  videoStatus: VideoStatusMap;
  renderProgressMap: RenderProgressMap;
  onSegmentChange: (id: number) => void;
  onGenerateVideo: (segId: number) => void;
}

export default function SegmentPanel({
  segments,
  activeSegment,
  videoStatus,
  renderProgressMap,
  onSegmentChange,
  onGenerateVideo,
}: SegmentPanelProps) {
  const [expandedShot, setExpandedShot] = useState<number | null>(null);

  return (
    <div className="flex-1 overflow-y-auto p-5" style={{ background: "#ffffff" }}>
      <div className="space-y-3">
        {segments.map((seg) => {
          const isActive = seg.id === activeSegment;
          const isNewEmpty = seg.isNew && seg.shots.length === 0;
          const vStatus = videoStatus[seg.id] || "idle";
          const rProgress = renderProgressMap[seg.id] ?? null;

          return (
            <div
              key={seg.id}
              id={`segment-${seg.id}`}
              className="rounded-2xl overflow-hidden transition-all duration-200"
              style={{
                background: isActive ? "#ffffff" : "#F7F8FA",
                border: isActive ? `1.5px solid ${seg.color}40` : seg.isNew ? `1.5px dashed ${seg.color}30` : "1px solid #EAEAEA",
                boxShadow: isActive ? `0 2px 12px ${seg.color}12` : "none",
              }}
            >
              {/* Segment header */}
              <button
                className="w-full p-4 flex items-center justify-between cursor-pointer"
                onClick={() => onSegmentChange(isActive ? 0 : seg.id)}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-[11px] font-bold shrink-0"
                    style={{ background: `${seg.color}12`, color: seg.color }}
                  >
                    S{seg.id}
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <p className="text-[13.5px] font-bold" style={{ color: "#1D1D1F" }}>{seg.name}</p>
                      {seg.isNew && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: `${seg.color}15`, color: seg.color }}>
                          新片段
                        </span>
                      )}
                      {vStatus === "done" && !isActive && (
                        <i className="ri-checkbox-circle-fill text-[12px]" style={{ color: "#047857" }} />
                      )}
                    </div>
                    <p className="text-[11px]" style={{ color: "#8E8E93" }}>{seg.duration} · {seg.goal}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!isNewEmpty && vStatus !== "done" && (
                    <div className="flex gap-1.5 flex-wrap">
                      {seg.characters.map((c) => (
                        <span key={c} className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "rgba(180,83,9,0.08)", color: "#B45309" }}>
                          {c}
                        </span>
                      ))}
                      <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "rgba(4,120,87,0.08)", color: "#047857" }}>
                        {seg.scene}
                      </span>
                    </div>
                  )}
                  {vStatus === "done" && !isActive && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(4,120,87,0.08)", color: "#047857" }}>
                      已完成
                    </span>
                  )}
                  <i className={isActive ? "ri-arrow-up-s-line" : "ri-arrow-down-s-line"} style={{ color: "#AEAEB2" }} />
                </div>
              </button>

              {/* Expanded body */}
              {isActive && (
                <div className="px-4 pb-4">
                  {isNewEmpty ? (
                    <NewSegmentEditor seg={seg} />
                  ) : (
                    <>
                      {/* Info row */}
                      <div
                        className="flex items-center gap-4 mb-4 px-3 py-2.5 rounded-lg text-[12px]"
                        style={{ background: "#F7F8FA", border: "1px solid #EAEAEA" }}
                      >
                        <div>
                          <span style={{ color: "#8E8E93" }}>产品露出：</span>
                          <span style={{ color: seg.color, fontWeight: 600 }}>{seg.placement}</span>
                        </div>
                      </div>

                      {/* Shots */}
                      <div className="space-y-2 mb-4">
                        {seg.shots.map((shot) => (
                          <div
                            key={shot.id}
                            className="rounded-xl overflow-hidden cursor-pointer transition-all duration-150"
                            style={{ background: "#F7F8FA", border: "1px solid #EAEAEA" }}
                            onClick={() => setExpandedShot(expandedShot === shot.id ? null : shot.id)}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = `${seg.color}35`; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#EAEAEA"; }}
                          >
                            <div className="flex items-center justify-between px-3 py-2.5">
                              <div className="flex items-center gap-2.5">
                                <span className="w-5 h-5 flex items-center justify-center rounded-md text-[10px] font-bold" style={{ background: `${seg.color}10`, color: seg.color }}>
                                  {shot.id}
                                </span>
                                {/* When rendering this shot, show spinner */}
                                {vStatus === "generating" && rProgress?.currentShot === shot.id && (
                                  <i className="ri-loader-4-line text-[11px] animate-spin" style={{ color: seg.color }} />
                                )}
                                {vStatus === "done" && (
                                  <i className="ri-checkbox-circle-fill text-[11px]" style={{ color: "#047857" }} />
                                )}
                                <span className="text-[12.5px]" style={{ color: "#444444" }}>{shot.desc}</span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "#EAEAEA", color: "#6E6E73" }}>
                                  {shot.duration}
                                </span>
                              </div>
                              <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "#F5F5F7", color: "#8E8E93" }}>
                                {shot.emotion}
                              </span>
                            </div>
                            {expandedShot === shot.id && (
                              <div className="px-3 pb-3 pt-0 grid grid-cols-3 gap-3 text-[11.5px]" style={{ borderTop: "1px solid #EAEAEA" }}>
                                <div>
                                  <p className="mb-1" style={{ color: "#AEAEB2" }}>动作</p>
                                  <p style={{ color: "#444444" }} className="leading-snug">{shot.action}</p>
                                </div>
                                <div>
                                  <p className="mb-1" style={{ color: "#AEAEB2" }}>台词 / 旁白</p>
                                  <p style={{ color: "#444444" }} className="leading-snug">{shot.dialogue}</p>
                                </div>
                                <div>
                                  <p className="mb-1" style={{ color: "#AEAEB2" }}>情绪</p>
                                  <p style={{ color: seg.color, fontWeight: 600 }}>{shot.emotion}</p>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Generate button area */}
                      <SegmentGenerateArea
                        seg={seg}
                        vStatus={vStatus}
                        rProgress={rProgress}
                        onGenerateVideo={onGenerateVideo}
                      />
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Segment Generate Button Area ── */
interface GenerateAreaProps {
  seg: SegmentItem;
  vStatus: "idle" | "generating" | "done";
  rProgress: import("../types").RenderProgress | null;
  onGenerateVideo: (id: number) => void;
}

function SegmentGenerateArea({ seg, vStatus, rProgress, onGenerateVideo }: GenerateAreaProps) {
  if (vStatus === "generating" && rProgress) {
    return (
      <div className="rounded-xl overflow-hidden" style={{ background: "#F7F8FA", border: `1px solid ${seg.color}25` }}>
        {/* Phase label + spinner */}
        <div className="flex items-center gap-2.5 px-3 py-2.5">
          <div className="w-5 h-5 flex items-center justify-center rounded-full shrink-0" style={{ background: `${seg.color}12` }}>
            <i className="ri-loader-4-line text-[11px] animate-spin" style={{ color: seg.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold truncate" style={{ color: "#1D1D1F" }}>
              {rProgress.phaseLabel}
            </p>
          </div>
          <span className="text-[11px] font-mono tabular-nums shrink-0" style={{ color: seg.color }}>
            {rProgress.percent}%
          </span>
        </div>
        {/* Progress bar */}
        <div className="px-3 pb-3">
          <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: "#EAEAEA" }}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${rProgress.percent}%`,
                background: seg.color,
                transition: "width 0.55s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  if (vStatus === "done") {
    return (
      <div className="flex gap-2">
        <div
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[12px] font-medium"
          style={{ background: "rgba(4,120,87,0.07)", color: "#047857", border: "1px solid rgba(4,120,87,0.2)" }}
        >
          <i className="ri-checkbox-circle-fill text-[12px]" />
          视频已生成
        </div>
        <button
          onClick={() => onGenerateVideo(seg.id)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] cursor-pointer whitespace-nowrap transition-colors duration-150"
          style={{ background: "#F7F8FA", color: "#444444", border: "1px solid #EAEAEA" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#EAEAEA"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#F7F8FA"; }}
        >
          <i className="ri-refresh-line text-[11px]" />
          重新生成
        </button>
      </div>
    );
  }

  /* idle */
  return (
    <div className="flex gap-2">
      <button
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] cursor-pointer whitespace-nowrap transition-colors duration-150"
        style={{ background: "#F7F8FA", color: "#444444", border: "1px solid #EAEAEA" }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#EAEAEA"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#F7F8FA"; }}
      >
        <i className="ri-edit-line text-[11px]" />
        编辑
      </button>
      <button
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] cursor-pointer whitespace-nowrap transition-colors duration-150"
        style={{ background: "#F7F8FA", color: "#444444", border: "1px solid #EAEAEA" }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#EAEAEA"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#F7F8FA"; }}
      >
        <i className="ri-refresh-line text-[11px]" />
        重新生成
      </button>
      <button
        onClick={() => onGenerateVideo(seg.id)}
        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-semibold cursor-pointer whitespace-nowrap transition-all duration-200"
        style={{ background: "#1D1D1F", color: "#ffffff", border: "1px solid #1D1D1F" }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#374151"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#1D1D1F"; }}
      >
        <i className="ri-video-add-line text-[11px]" />
        生成视频
      </button>
    </div>
  );
}

/* ── New Segment Editor ── */
function NewSegmentEditor({ seg }: { seg: SegmentItem }) {
  const [goal, setGoal] = useState("");
  const [duration, setDuration] = useState("10s");
  const [scene, setScene] = useState("");
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-3">
        <i className="ri-loader-4-line animate-spin text-[24px]" style={{ color: seg.color }} />
        <p className="text-[13px]" style={{ color: "#444444" }}>AI 正在生成片段脚本...</p>
        <p className="text-[11px]" style={{ color: "#8E8E93" }}>预计 20-30 秒完成</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl" style={{ background: `${seg.color}08`, border: `1px solid ${seg.color}20` }}>
        <i className="ri-information-line text-[13px] mt-0.5 shrink-0" style={{ color: seg.color }} />
        <p className="text-[11.5px] leading-relaxed" style={{ color: "#444444" }}>
          这是一个新片段，请填写基本信息，AI 将为你生成完整的镜头脚本。
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] mb-1.5" style={{ color: "#8E8E93" }}>时长</label>
          <div className="flex gap-1.5">
            {["8s", "10s", "15s", "20s"].map((d) => (
              <button key={d} onClick={() => setDuration(d)}
                className="flex-1 py-2 rounded-lg text-[11.5px] cursor-pointer transition-all duration-150 whitespace-nowrap"
                style={{ background: duration === d ? "#1D1D1F" : "#F7F8FA", color: duration === d ? "#ffffff" : "#8E8E93", border: `1px solid ${duration === d ? "#1D1D1F" : "#EAEAEA"}` }}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-[11px] mb-1.5" style={{ color: "#8E8E93" }}>主要场景</label>
          <input value={scene} onChange={(e) => setScene(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-[12.5px] outline-none"
            style={{ background: "#ffffff", border: "1px solid #EAEAEA", color: "#1D1D1F" }}
            placeholder="例：品牌展示台..."
            onFocus={(e) => { e.currentTarget.style.borderColor = seg.color; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "#EAEAEA"; }}
          />
        </div>
      </div>

      <div>
        <label className="block text-[11px] mb-1.5" style={{ color: "#8E8E93" }}>
          片段目标 <span style={{ color: "#DC2626" }}>*</span>
        </label>
        <input value={goal} onChange={(e) => setGoal(e.target.value)}
          className="w-full px-3 py-2 rounded-lg text-[12.5px] outline-none"
          style={{ background: "#ffffff", border: "1px solid #EAEAEA", color: "#1D1D1F" }}
          placeholder="例：品牌Logo收尾，留下品牌印象"
          onFocus={(e) => { e.currentTarget.style.borderColor = seg.color; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = "#EAEAEA"; }}
        />
      </div>

      <button onClick={() => { if (goal.trim()) setSubmitted(true); }} disabled={!goal.trim()}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-semibold whitespace-nowrap transition-all duration-200"
        style={{ background: goal.trim() ? "#1D1D1F" : "#F5F5F7", color: goal.trim() ? "#ffffff" : "#AEAEB2", cursor: goal.trim() ? "pointer" : "not-allowed" }}
        onMouseEnter={(e) => { if (goal.trim()) (e.currentTarget as HTMLElement).style.background = "#374151"; }}
        onMouseLeave={(e) => { if (goal.trim()) (e.currentTarget as HTMLElement).style.background = "#1D1D1F"; }}
      >
        <i className="ri-ai-generate text-[13px]" />
        AI 生成片段脚本
      </button>
    </div>
  );
}
