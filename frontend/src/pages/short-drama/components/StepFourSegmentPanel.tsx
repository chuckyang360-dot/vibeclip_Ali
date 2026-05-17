import { useState } from "react";
import type {
  Step4RenderProgress,
  Step4RenderProgressMap,
  Step4SegmentItem,
  Step4VideoStatusMap,
} from '@/types/shortDrama';
import { SHORT_DRAMA_UI } from '../utils/shortDramaUiCopy';

interface SegmentPanelProps {
  segments: Step4SegmentItem[];
  activeSegment: number;
  videoStatus: Step4VideoStatusMap;
  renderProgressMap: Step4RenderProgressMap;
  onSegmentChange: (id: number) => void;
  onGenerateVideo: (segId: number) => void;
  /** 无分段脚本或未达 assets_ready 等阶段时禁用生成/重生成 */
  videoGenerateDisabled?: boolean;
}

export function StepFourSegmentPanel({
  segments,
  activeSegment,
  videoStatus,
  renderProgressMap,
  onSegmentChange,
  onGenerateVideo,
  videoGenerateDisabled = false,
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
                      {vStatus === "completed" && !isActive && (
                        <i className="ri-checkbox-circle-fill text-[12px]" style={{ color: "#047857" }} />
                      )}
                    </div>
                    <p className="text-[11px]" style={{ color: "#8E8E93" }}>{seg.duration} · {seg.goal}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!isNewEmpty && vStatus !== "completed" && (
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
                  {vStatus === "completed" && !isActive && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(4,120,87,0.08)", color: "#047857" }}>
                        {SHORT_DRAMA_UI.done.segmentBadge}
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
                          <span style={{ color: seg.color, fontWeight: 600 }}>{seg.productExposure || seg.placement}</span>
                        </div>
                        <div>
                          <span style={{ color: "#8E8E93" }}>段落职责：</span>
                          <span style={{ color: "#444444" }}>{seg.segmentRole || "—"}</span>
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
                                {(vStatus === "queued" || vStatus === "running") && rProgress?.currentShot === shot.id && (
                                  <i className="ri-loader-4-line text-[11px] animate-spin" style={{ color: seg.color }} />
                                )}
                                {vStatus === "completed" && (
                                  <i className="ri-checkbox-circle-fill text-[11px]" style={{ color: "#047857" }} />
                                )}
                                {vStatus === "failed" && (
                                  <i className="ri-close-circle-fill text-[11px]" style={{ color: "#DC2626" }} />
                                )}
                                <span className="text-[12.5px]" style={{ color: "#444444" }}>{shot.desc}</span>
                                {shot.shotRole && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "#F5F5F7", color: "#6E6E73" }}>
                                    {shot.shotRole}
                                  </span>
                                )}
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "#EAEAEA", color: "#6E6E73" }}>
                                  {shot.duration}
                                </span>
                              </div>
                              <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "#F5F5F7", color: "#8E8E93" }}>
                                {shot.emotion}
                              </span>
                            </div>
                            {expandedShot === shot.id && (
                              <div className="px-3 pb-3 pt-0 space-y-3 text-[11.5px]" style={{ borderTop: "1px solid #EAEAEA" }}>
                                <div className="grid grid-cols-3 gap-3">
                                  <div>
                                    <p className="mb-1" style={{ color: "#AEAEB2" }}>动作</p>
                                    <p style={{ color: "#444444" }} className="leading-snug">{shot.action}</p>
                                  </div>
                                  <div>
                                    <p className="mb-1" style={{ color: "#AEAEB2" }}>角色口播</p>
                                    <p style={{ color: "#444444" }} className="leading-snug">{shot.spokenText || "无角色口播"}</p>
                                  </div>
                                  <div>
                                    <p className="mb-1" style={{ color: "#AEAEB2" }}>旁白/画外音</p>
                                    <p style={{ color: "#444444" }} className="leading-snug">{shot.voiceoverText || "无旁白"}</p>
                                  </div>
                                  <div>
                                    <p className="mb-1" style={{ color: "#AEAEB2" }}>字幕文案</p>
                                    <p style={{ color: "#444444" }} className="leading-snug">{shot.subtitleText || "无字幕"}</p>
                                  </div>
                                  <div>
                                    <p className="mb-1" style={{ color: "#AEAEB2" }}>情绪</p>
                                    <p style={{ color: seg.color, fontWeight: 600 }}>{shot.emotion}</p>
                                  </div>
                                  <div>
                                    <p className="mb-1" style={{ color: "#AEAEB2" }}>镜头 / 构图 / 运动</p>
                                    <p style={{ color: "#444444" }} className="leading-snug">{[shot.camera, shot.framing, shot.cameraMovement].filter(Boolean).join(" / ") || "—"}</p>
                                  </div>
                                </div>
                                {(shot.sceneDescription ||
                                  shot.subjectDescription ||
                                  shot.cameraDescription ||
                                  shot.visualStyleInstruction ||
                                  shot.generationPrompt ||
                                  shot.sourceSellingPoint ||
                                  shot.mustShow?.length ||
                                  shot.mustAvoid?.length) && (
                                  <details className="rounded-lg px-2 py-2" style={{ background: "#fff", border: "1px solid #EAEAEA" }}>
                                    <summary className="cursor-pointer text-[11px] font-semibold" style={{ color: "#6E6E73" }}>
                                      结构化槽位与 Prompt
                                    </summary>
                                    <div className="mt-2 space-y-2 text-[11px] leading-snug" style={{ color: "#444444" }}>
                                      {shot.sceneDescription && (
                                        <p><span style={{ color: "#AEAEB2" }}>场景 </span>{shot.sceneDescription}</p>
                                      )}
                                      {shot.subjectDescription && (
                                        <p><span style={{ color: "#AEAEB2" }}>主体 </span>{shot.subjectDescription}</p>
                                      )}
                                      {shot.cameraDescription && (
                                        <p><span style={{ color: "#AEAEB2" }}>镜头 </span>{shot.cameraDescription}</p>
                                      )}
                                      {shot.imagePrompt && (
                                        <p><span style={{ color: "#AEAEB2" }}>画面提示词 </span>{shot.imagePrompt}</p>
                                      )}
                                      {shot.visualStyleInstruction && (
                                        <p><span style={{ color: "#AEAEB2" }}>视觉风格 </span>{shot.visualStyleInstruction}</p>
                                      )}
                                      {shot.marketLocalizationDetail && (
                                        <p><span style={{ color: "#AEAEB2" }}>市场本地化 </span>{shot.marketLocalizationDetail}</p>
                                      )}
                                      {shot.generationPrompt && (
                                        <p><span style={{ color: "#AEAEB2" }}>生成提示词 </span>{shot.generationPrompt}</p>
                                      )}
                                      {shot.sourceSellingPoint && (
                                        <p><span style={{ color: "#AEAEB2" }}>产品卖点 </span>{shot.sourceSellingPoint}</p>
                                      )}
                                      {shot.mustShow?.length ? (
                                        <p><span style={{ color: "#AEAEB2" }}>必须出现 </span>{shot.mustShow.join('；')}</p>
                                      ) : null}
                                      {shot.mustAvoid?.length ? (
                                        <p><span style={{ color: "#AEAEB2" }}>避免出现 </span>{shot.mustAvoid.join('；')}</p>
                                      ) : null}
                                    </div>
                                  </details>
                                )}
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
                        disabled={videoGenerateDisabled}
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
  seg: Step4SegmentItem;
  vStatus: "idle" | "queued" | "running" | "completed" | "failed";
  rProgress: Step4RenderProgress | null;
  onGenerateVideo: (id: number) => void;
  disabled?: boolean;
}

function SegmentGenerateArea({ seg, vStatus, rProgress, onGenerateVideo, disabled = false }: GenerateAreaProps) {
  if ((vStatus === "queued" || vStatus === "running") && !rProgress) {
    return (
      <div className="rounded-xl overflow-hidden" style={{ background: "#F7F8FA", border: `1px solid ${seg.color}25` }}>
        <div className="flex items-center gap-2.5 px-3 py-2.5">
          <div className="w-5 h-5 flex items-center justify-center rounded-full shrink-0" style={{ background: `${seg.color}12` }}>
            <i className="ri-loader-4-line text-[11px] animate-spin" style={{ color: seg.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold truncate" style={{ color: "#1D1D1F" }}>
              视频生成中…
            </p>
            <p className="text-[10px] mt-0.5 truncate" style={{ color: "#8E8E93" }}>
              请等待后端处理完成后自动刷新
            </p>
          </div>
        </div>
      </div>
    );
  }

  if ((vStatus === "queued" || vStatus === "running") && rProgress) {
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

  if (vStatus === "completed") {
    return (
      <div className="flex gap-2">
        <div
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[12px] font-medium"
          style={{ background: "rgba(4,120,87,0.07)", color: "#047857", border: "1px solid rgba(4,120,87,0.2)" }}
        >
          <i className="ri-checkbox-circle-fill text-[12px]" />
          {SHORT_DRAMA_UI.stepFour.videoGeneratedLabel}
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onGenerateVideo(seg.id)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] whitespace-nowrap transition-colors duration-150"
          style={{
            background: disabled ? "#F5F5F7" : "#F7F8FA",
            color: disabled ? "#AEAEB2" : "#444444",
            border: "1px solid #EAEAEA",
            cursor: disabled ? "not-allowed" : "pointer",
          }}
          onMouseEnter={(e) => {
            if (disabled) return;
            (e.currentTarget as HTMLElement).style.background = "#EAEAEA";
          }}
          onMouseLeave={(e) => {
            if (disabled) return;
            (e.currentTarget as HTMLElement).style.background = "#F7F8FA";
          }}
        >
          <i className="ri-refresh-line text-[11px]" />
          重新生成
        </button>
      </div>
    );
  }

  if (vStatus === "failed") {
    return (
      <div className="flex gap-2">
        <div
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[12px] font-medium"
          style={{ background: "rgba(220,38,38,0.08)", color: "#B91C1C", border: "1px solid rgba(220,38,38,0.2)" }}
        >
          <i className="ri-close-circle-fill text-[12px]" />
          生成失败
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onGenerateVideo(seg.id)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] whitespace-nowrap transition-colors duration-150"
          style={{
            background: disabled ? "#F5F5F7" : "#F7F8FA",
            color: disabled ? "#AEAEB2" : "#444444",
            border: "1px solid #EAEAEA",
            cursor: disabled ? "not-allowed" : "pointer",
          }}
        >
          <i className="ri-refresh-line text-[11px]" />
          重试
        </button>
      </div>
    );
  }

  /* idle */
  return (
    <div className="flex gap-2">
      <button
        type="button"
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] cursor-pointer whitespace-nowrap transition-colors duration-150"
        style={{ background: "#F7F8FA", color: "#444444", border: "1px solid #EAEAEA" }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#EAEAEA"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#F7F8FA"; }}
      >
        <i className="ri-edit-line text-[11px]" />
        编辑
      </button>
      <button
        type="button"
        disabled={disabled}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] whitespace-nowrap transition-colors duration-150"
        style={{
          background: disabled ? "#F5F5F7" : "#F7F8FA",
          color: disabled ? "#AEAEB2" : "#444444",
          border: "1px solid #EAEAEA",
          cursor: disabled ? "not-allowed" : "pointer",
        }}
        onMouseEnter={(e) => {
          if (disabled) return;
          (e.currentTarget as HTMLElement).style.background = "#EAEAEA";
        }}
        onMouseLeave={(e) => {
          if (disabled) return;
          (e.currentTarget as HTMLElement).style.background = "#F7F8FA";
        }}
      >
        <i className="ri-refresh-line text-[11px]" />
        重新生成
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onGenerateVideo(seg.id)}
        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-semibold whitespace-nowrap transition-all duration-200"
        style={{
          background: disabled ? "#EAEAEA" : "#1D1D1F",
          color: disabled ? "#AEAEB2" : "#ffffff",
          border: `1px solid ${disabled ? "#EAEAEA" : "#1D1D1F"}`,
          cursor: disabled ? "not-allowed" : "pointer",
        }}
        onMouseEnter={(e) => {
          if (disabled) return;
          (e.currentTarget as HTMLElement).style.background = "#374151";
        }}
        onMouseLeave={(e) => {
          if (disabled) return;
          (e.currentTarget as HTMLElement).style.background = "#1D1D1F";
        }}
      >
        <i className="ri-video-add-line text-[11px]" />
        生成视频
      </button>
    </div>
  );
}

/* ── New Segment Editor ── */
function NewSegmentEditor({ seg }: { seg: Step4SegmentItem }) {
  const [goal, setGoal] = useState("");
  const [duration, setDuration] = useState("10s");
  const [scene, setScene] = useState("");
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-3">
        <i className="ri-loader-4-line animate-spin text-[24px]" style={{ color: seg.color }} />
        <p className="text-[13px]" style={{ color: "#444444" }}>正在准备片段脚本...</p>
        <p className="text-[11px]" style={{ color: "#8E8E93" }}>请稍候</p>
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
