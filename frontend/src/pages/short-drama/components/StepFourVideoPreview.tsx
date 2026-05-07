import { useEffect, useRef } from "react";
import type { Step4RenderProgress, Step4VideoStatusMap } from '@/types/shortDrama';
import { NEUTRAL_VERTICAL_POSTER } from '../utils/shortDramaMedia';
import { SHORT_DRAMA_UI } from '../utils/shortDramaUiCopy';

interface VideoPreviewProps {
  projectId?: number | null;
  segmentId: number;
  videoStatus: Step4VideoStatusMap;
  renderProgress: Step4RenderProgress | null;
  onRegenerate: (id: number) => void;
  /** 覆盖 Framer 静态标题 / 色条 */
  displayName?: string;
  accentColor?: string;
  /** 占位与生成中底图 */
  posterUrl?: string;
  /** 当前片段可播放地址（绝对 URL） */
  videoSrc?: string | null;
  regenerateDisabled?: boolean;
  /** 右侧预览：片段 / 最终成片 */
  previewTarget?: "segment" | "final";
  onPreviewTargetChange?: (t: "segment" | "final") => void;
  finalVideoSrc?: string | null;
  finalRenderError?: string | null;
  /** 后端 segment_id，用于播放器 key 与调试日志 */
  segmentBackendKey?: string | null;
  /** pipeline 原始相对路径（未 resolve） */
  segmentVideoUrlRaw?: string | null;
  finalVideoUrlRaw?: string | null;
}

const PHASE_ICONS: Record<string, string> = {
  analyzing: "ri-search-eye-line",
  keyframes: "ri-film-line",
  shot_: "ri-clapperboard-line",
  grading: "ri-palette-line",
  audio: "ri-music-2-line",
  encoding: "ri-upload-cloud-2-line",
};

function getPhaseKey(phase: string): string {
  if (phase.startsWith("shot_")) return "shot_";
  return phase;
}

export function StepFourVideoPreview({
  projectId = null,
  segmentId,
  videoStatus,
  renderProgress,
  onRegenerate,
  displayName,
  accentColor,
  posterUrl,
  videoSrc,
  regenerateDisabled = false,
  previewTarget = "segment",
  onPreviewTargetChange,
  finalVideoSrc,
  finalRenderError,
  segmentBackendKey = null,
  segmentVideoUrlRaw = null,
  finalVideoUrlRaw = null,
}: VideoPreviewProps) {
  const styleRef = useRef(false);
  const info = {
    name: displayName ?? "—",
    color: accentColor ?? "#8E8E93",
    img: posterUrl ?? NEUTRAL_VERTICAL_POSTER,
  };
  const status = videoStatus[segmentId] || "idle";

  const effectiveSrc =
    previewTarget === "final" ? (finalVideoSrc || null) : (videoSrc || null);
  const effectiveStatus = previewTarget === "final" ? (finalVideoSrc ? "completed" : "idle") : status;
  const videoKey = `${previewTarget}-${segmentId}-${segmentBackendKey ?? "local"}-${effectiveSrc ?? ""}`;

  useEffect(() => {
    console.info("[FRONT_SEGMENT_PREVIEW_BIND]", {
      project_id: projectId,
      active_segment_id: segmentId,
      preview_target: previewTarget,
      raw_video_url: previewTarget === "final" ? finalVideoUrlRaw : segmentVideoUrlRaw,
      resolved_video_url: effectiveSrc ?? "",
      video_key: videoKey,
    });
  }, [projectId, segmentId, previewTarget, effectiveSrc, segmentVideoUrlRaw, finalVideoUrlRaw, videoKey]);

  useEffect(() => {
    if (styleRef.current) return;
    const id = "sd-vp-keyframes";
    if (document.getElementById(id)) { styleRef.current = true; return; }
    const el = document.createElement("style");
    el.id = id;
    el.textContent = `
      @keyframes sd-vp-scanpulse {
        0%, 100% { opacity: 0.9; box-shadow: 0 0 6px 1px rgba(255,255,255,0.5); }
        50%       { opacity: 1;   box-shadow: 0 0 14px 3px rgba(255,255,255,0.9); }
      }
      @keyframes sd-vp-badge-blink {
        0%, 100% { opacity: 1; }
        50%       { opacity: 0.65; }
      }
      @keyframes sd-vp-done-in {
        from { opacity: 0; transform: scale(0.85); }
        to   { opacity: 1; transform: scale(1); }
      }
    `;
    document.head.appendChild(el);
    styleRef.current = true;
  }, []);

  /* Build phase list from progress */
  const buildPhaseList = (prog: Step4RenderProgress) => {
    const result: Array<{ key: string; label: string; icon: string; state: "done" | "active" | "pending" }> = [];
    const ph = prog.phase;

    const staticPhases = [
      { key: "analyzing", label: "分析脚本与镜头设定" },
      { key: "keyframes", label: "生成关键帧序列" },
    ];

    for (let i = 1; i <= prog.totalShots; i++) {
      staticPhases.push({ key: `shot_${i}`, label: `渲染镜头 ${i} / ${prog.totalShots}` });
    }

    staticPhases.push(
      { key: "grading", label: "调色与光效合成" },
      { key: "audio", label: "生成音轨与字幕" },
      { key: "encoding", label: "压缩输出 MP4" },
    );

    let pastCurrent = false;
    for (const p of staticPhases) {
      const isActive = p.key === ph;
      const isDone = !isActive && !pastCurrent;
      if (isActive) pastCurrent = true;
      const iconKey = getPhaseKey(p.key);
      result.push({
        key: p.key,
        label: p.label,
        icon: PHASE_ICONS[iconKey] || PHASE_ICONS["shot_"],
        state: isActive ? "active" : isDone ? "done" : "pending",
      });
    }
    return result;
  };

  const percent = renderProgress?.percent ?? 0;
  const currentFrame = Math.round((percent / 100) * (renderProgress?.totalFrames ?? 360));
  const totalFrames = renderProgress?.totalFrames ?? 360;
  const estRemaining = Math.ceil(((100 - percent) / 100) * ((renderProgress?.totalShots ?? 3) * 0.95 + 2.5));

  return (
    <aside
      className="hidden xl:flex flex-col w-72 shrink-0 p-5 overflow-y-auto"
      style={{ borderLeft: "1px solid #EAEAEA", background: "#F7F8FA" }}
    >
      <h3 className="text-[11px] font-bold uppercase tracking-widest mb-2 shrink-0" style={{ color: "#8E8E93" }}>
        视频预览
      </h3>
      {onPreviewTargetChange && (
        <div className="flex gap-1 mb-3 text-[10px] font-semibold shrink-0">
          <button
            type="button"
            onClick={() => onPreviewTargetChange("segment")}
            className="flex-1 py-1.5 rounded-lg transition-colors"
            style={{
              background: previewTarget === "segment" ? "#1D1D1F" : "#ffffff",
              color: previewTarget === "segment" ? "#ffffff" : "#6E6E73",
              border: "1px solid #EAEAEA",
            }}
          >
            当前片段
          </button>
          <button
            type="button"
            onClick={() => onPreviewTargetChange("final")}
            className="flex-1 py-1.5 rounded-lg transition-colors"
            style={{
              background: previewTarget === "final" ? "#1D1D1F" : "#ffffff",
              color: previewTarget === "final" ? "#ffffff" : "#6E6E73",
              border: "1px solid #EAEAEA",
            }}
          >
            最终成片
          </button>
        </div>
      )}
      <p className="text-[10px] mb-2 leading-snug shrink-0" style={{ color: "#8E8E93" }}>
        {previewTarget === "final"
          ? finalRenderError
            ? `最终成片合成失败：${finalRenderError}`
            : finalVideoSrc
              ? "最终成片可预览"
              : "最终成片尚未合成"
          : status === "queued" || status === "running"
            ? "当前片段生成中，请稍候"
            : status === "failed"
              ? "当前片段生成失败，可在左侧重试"
            : videoSrc
              ? "当前片段视频可预览"
              : "当前片段尚未生成视频"}
      </p>

      {/* ── Video frame ── */}
      <div
        className="relative w-full rounded-xl overflow-hidden mb-4 shrink-0"
        style={{ aspectRatio: "9/16", background: "#111111", border: "1px solid #E5E5EA" }}
      >
        {/* IDLE */}
        {effectiveStatus === "idle" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 flex items-center justify-center rounded-full" style={{ background: "#ffffff", border: "1px solid #EAEAEA" }}>
              <i className="ri-video-line text-[20px]" style={{ color: "#AEAEB2" }} />
            </div>
            <p className="text-[11px] text-center max-w-[140px] leading-relaxed" style={{ color: "#AEAEB2" }}>
              {previewTarget === "final" ? "合成完整视频后可在此预览" : "在左侧片段上点击「生成视频」"}
            </p>
          </div>
        )}

        {/* GENERATING — 无本地进度时简化为等待态 */}
        {(effectiveStatus === "queued" || effectiveStatus === "running") && !renderProgress && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3" style={{ background: "#1a1a1c" }}>
            <img
              src={info.img}
              alt=""
              className="absolute inset-0 w-full h-full object-cover object-top opacity-35"
              style={{ filter: "blur(10px)" }}
            />
            <div className="relative z-[1] w-12 h-12 flex items-center justify-center rounded-full" style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)" }}>
              <i className="ri-loader-4-line text-[22px] animate-spin text-white" />
            </div>
            <p className="relative z-[1] text-[11px] text-center max-w-[150px] leading-relaxed" style={{ color: "rgba(255,255,255,0.85)" }}>
              正在生成视频，请稍候…
            </p>
          </div>
        )}

        {/* GENERATING — cinematic progressive reveal（保留 mock 阶段动画，当有 renderProgress 时） */}
        {(effectiveStatus === "queued" || effectiveStatus === "running") && renderProgress && (
          <>
            {/* Blurred / dark base */}
            <img
              src={info.img}
              alt=""
              className="absolute inset-0 w-full h-full object-cover object-top"
              style={{ filter: "blur(8px) brightness(0.22) saturate(0.15)" }}
            />

            {/* Sharp rendered portion (reveals top-to-bottom) */}
            <img
              src={info.img}
              alt=""
              className="absolute inset-0 w-full h-full object-cover object-top"
              style={{
                clipPath: `inset(0 0 ${100 - percent}% 0)`,
                transition: "clip-path 0.55s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            />

            {/* Scan line at the boundary */}
            {percent > 1 && percent < 99 && (
              <div
                className="absolute left-0 right-0 pointer-events-none"
                style={{
                  top: `${percent}%`,
                  height: "2px",
                  background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.95) 20%, rgba(255,255,255,0.95) 80%, transparent)",
                  animation: "sd-vp-scanpulse 0.9s ease-in-out infinite",
                  marginTop: "-1px",
                }}
              />
            )}

            {/* Top-left: RENDERING badge */}
            <div
              className="absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2 py-1 rounded-full"
              style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)" }}
            >
              <div
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: info.color, animation: "sd-vp-badge-blink 0.8s ease-in-out infinite" }}
              />
              <span className="text-[9.5px] font-bold tracking-wider" style={{ color: "#ffffff" }}>
                RENDERING
              </span>
            </div>

            {/* Top-right: percent */}
            <div
              className="absolute top-2.5 right-2.5 px-2 py-1 rounded-full"
              style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)" }}
            >
              <span className="text-[10px] font-bold tabular-nums" style={{ color: info.color }}>
                {percent}%
              </span>
            </div>

            {/* Bottom: frame counter */}
            <div
              className="absolute bottom-0 left-0 right-0 px-3 py-2 flex items-center justify-between"
              style={{ background: "linear-gradient(to top, rgba(0,0,0,0.85), transparent)" }}
            >
              <span className="text-[9.5px] font-mono tabular-nums" style={{ color: "rgba(255,255,255,0.7)" }}>
                Frame {currentFrame.toString().padStart(4, "0")}
              </span>
              <span className="text-[9.5px] font-mono tabular-nums" style={{ color: "rgba(255,255,255,0.4)" }}>
                / {totalFrames}
              </span>
            </div>
          </>
        )}

        {/* DONE */}
        {effectiveStatus === "completed" && (
          <>
            {effectiveSrc ? (
              <video
                key={videoKey}
                src={effectiveSrc}
                className="w-full h-full object-cover object-top"
                controls
                playsInline
                poster={info.img}
                style={{ animation: "sd-vp-done-in 0.4s ease-out forwards" }}
                onLoadedMetadata={(e) => {
                  const media = e.currentTarget;
                  console.info("[FRONT_SEGMENT_PREVIEW_LOADED]", {
                    project_id: projectId,
                    active_segment_id: segmentId,
                    resolved_video_url: effectiveSrc ?? "",
                    current_time: media.currentTime,
                    duration: Number.isFinite(media.duration) ? media.duration : null,
                  });
                }}
                onError={(e) => {
                  const media = e.currentTarget;
                  const err = media.error;
                  console.error("[FRONT_SEGMENT_PREVIEW_ERROR]", {
                    project_id: projectId,
                    active_segment_id: segmentId,
                    resolved_video_url: effectiveSrc ?? "",
                    media_error_code: err?.code ?? null,
                    media_error_message: err?.message ?? "video element load failed",
                  });
                }}
              />
            ) : (
              <>
                <img
                  src={info.img}
                  alt="preview"
                  className="w-full h-full object-cover object-top"
                  style={{ animation: "sd-vp-done-in 0.4s ease-out forwards" }}
                />
                <div className="absolute inset-0 bg-black/0 hover:bg-black/30 transition-all duration-200 cursor-pointer flex items-center justify-center opacity-0 hover:opacity-100">
                  <div className="w-12 h-12 flex items-center justify-center rounded-full bg-white/85 backdrop-blur-sm">
                    <i className="ri-play-fill text-[22px] ml-0.5" style={{ color: "#1D1D1F" }} />
                  </div>
                </div>
              </>
            )}
            <div className="absolute top-2.5 left-2.5 pointer-events-none">
              <span
                className="text-[10px] font-semibold px-2 py-1 rounded-full"
                style={{ background: "rgba(4,120,87,0.85)", color: "#ffffff" }}
              >
                <i className="ri-checkbox-circle-fill text-[10px] mr-1" />
                {previewTarget === "final" ? "最终成片" : SHORT_DRAMA_UI.done.segmentBadge}
              </span>
            </div>
          </>
        )}
      </div>

      {/* ── Segment info ── */}
      <div className="mb-3 px-3 py-2.5 rounded-xl shrink-0" style={{ background: "#ffffff", border: "1px solid #EAEAEA" }}>
        <p className="text-[11px] mb-0.5" style={{ color: "#8E8E93" }}>当前片段</p>
        <p className="text-[13px] font-bold" style={{ color: info.color }}>{info.name}</p>
      </div>

      {/* ── Generating progress detail ── */}
      {(effectiveStatus === "queued" || effectiveStatus === "running") && renderProgress && (
        <div className="mb-3 rounded-xl overflow-hidden shrink-0" style={{ background: "#ffffff", border: "1px solid #EAEAEA" }}>
          {/* Progress bar */}
          <div className="px-4 pt-4 pb-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-semibold" style={{ color: "#1D1D1F" }}>
                {renderProgress.phaseLabel}
              </span>
              <span className="text-[11px] font-mono tabular-nums" style={{ color: "#6E6E73" }}>
                {renderProgress.percent}%
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "#F0F0F5" }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${renderProgress.percent}%`,
                  background: `linear-gradient(90deg, ${info.color}, ${info.color}99)`,
                  transition: "width 0.55s cubic-bezier(0.4, 0, 0.2, 1)",
                }}
              />
            </div>
            <p className="text-[10px] mt-1.5 text-right" style={{ color: "#AEAEB2" }}>
              预计剩余约 {estRemaining} 秒
            </p>
          </div>

          {/* Phase checklist */}
          <div style={{ borderTop: "1px solid #F5F5F7" }}>
            {buildPhaseList(renderProgress).map((ph) => (
              <div
                key={ph.key}
                className="flex items-center gap-2.5 px-4 py-2"
                style={{ borderBottom: "1px solid #F5F5F7" }}
              >
                {/* State indicator */}
                <div className="w-4 h-4 flex items-center justify-center shrink-0">
                  {ph.state === "done" && (
                    <i className="ri-checkbox-circle-fill text-[13px]" style={{ color: "#047857" }} />
                  )}
                  {ph.state === "active" && (
                    <i className="ri-loader-4-line text-[13px] animate-spin" style={{ color: info.color }} />
                  )}
                  {ph.state === "pending" && (
                    <div className="w-3 h-3 rounded-full" style={{ border: "1.5px solid #D1D1D6" }} />
                  )}
                </div>
                {/* Icon + label */}
                <i
                  className={`${ph.icon} text-[11px] shrink-0`}
                  style={{
                    color: ph.state === "done" ? "#047857" : ph.state === "active" ? info.color : "#AEAEB2",
                  }}
                />
                <span
                  className="text-[11.5px] flex-1 truncate"
                  style={{
                    color: ph.state === "done" ? "#6E6E73" : ph.state === "active" ? "#1D1D1F" : "#AEAEB2",
                    fontWeight: ph.state === "active" ? 600 : 400,
                  }}
                >
                  {ph.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Actions ── */}
      <div className="space-y-2 mt-auto">
        {previewTarget === "segment" && status === "completed" && (
          <>
            <button
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-[12.5px] font-medium cursor-pointer transition-all duration-200 whitespace-nowrap"
              style={{ background: "rgba(4,120,87,0.08)", color: "#047857", border: "1px solid rgba(4,120,87,0.2)" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(4,120,87,0.15)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(4,120,87,0.08)"; }}
            >
              <i className="ri-download-cloud-line text-[12px]" />
              下载片段
            </button>
            <button
              type="button"
              disabled={regenerateDisabled}
              onClick={() => onRegenerate(segmentId)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-[12.5px] transition-all duration-200 whitespace-nowrap"
              style={{
                background: regenerateDisabled ? "#F5F5F7" : "#F7F8FA",
                color: regenerateDisabled ? "#AEAEB2" : "#444444",
                border: "1px solid #EAEAEA",
                cursor: regenerateDisabled ? "not-allowed" : "pointer",
              }}
              onMouseEnter={(e) => {
                if (regenerateDisabled) return;
                (e.currentTarget as HTMLElement).style.background = "#EAEAEA";
              }}
              onMouseLeave={(e) => {
                if (regenerateDisabled) return;
                (e.currentTarget as HTMLElement).style.background = "#F7F8FA";
              }}
            >
              <i className="ri-refresh-line text-[12px]" />
              重新生成
            </button>
          </>
        )}
      </div>
    </aside>
  );
}
