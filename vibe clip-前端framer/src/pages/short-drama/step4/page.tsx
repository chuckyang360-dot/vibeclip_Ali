import { useState } from "react";
import { useNavigate } from "react-router-dom";
import SDSharedNav from "@/pages/short-drama/components/SDSharedNav";
import AssetLibrary from "./components/AssetLibrary";
import SegmentPanel from "./components/SegmentPanel";
import VideoPreview from "./components/VideoPreview";
import Timeline from "./components/Timeline";
import type { SegmentItem, VideoStatusMap, RenderProgressMap } from "./types";

const SEGMENT_COLORS = ["#B45309", "#DC2626", "#047857", "#334155", "#9333EA", "#0F766E"];

const INITIAL_SEGMENTS: SegmentItem[] = [
  {
    id: 1, name: "S1 · Hook", duration: "0-12s", goal: "制造情绪共鸣，Hook 住观众",
    characters: ["林晓"], scene: "空旷公寓", placement: "无", color: "#B45309",
    shots: [
      { id: 1, desc: "脚踩在空旷公寓地板，特写脚", action: "缓慢踱步，俯视镜头", dialogue: "（无台词，环境音）", emotion: "孤独", duration: "3s" },
      { id: 2, desc: "女主坐在地板，侧脸望窗外夜景", action: "静止，微风发丝", dialogue: "「终于，只剩我自己了」", emotion: "迷茫", duration: "4s" },
      { id: 3, desc: "手机屏幕特写，通知内容", action: "手指滑动消息", dialogue: "「你一个人能怎么办」", emotion: "受刺激", duration: "5s" },
    ],
  },
  {
    id: 2, name: "S2 · Conflict", duration: "12-40s", goal: "建立需求感，产品探索植入",
    characters: ["林晓"], scene: "家居展厅", placement: "展厅场景中自然浏览", color: "#DC2626",
    shots: [
      { id: 1, desc: "展厅全景，女主进入，感受空间", action: "跟拍入场，眼神好奇", dialogue: "「也许，是时候认真对待这个新开始」", emotion: "好奇", duration: "5s" },
      { id: 2, desc: "餐桌特写，女主手触摸木纹", action: "慢镜，手指滑过质感", dialogue: "「天然实木，像是有温度的」", emotion: "感受", duration: "8s" },
      { id: 3, desc: "沙发区，女主试坐感受", action: "优雅坐下，闭眼感受", dialogue: "（无）", emotion: "满足", duration: "7s" },
      { id: 4, desc: "多产品快切展示", action: "跳切节奏，产品特写", dialogue: "（背景音乐升起）", emotion: "期待", duration: "8s" },
    ],
  },
  {
    id: 3, name: "S3 · Resolution", duration: "40-60s", goal: "情绪升华，品牌价值呈现",
    characters: ["林晓", "Sarah"], scene: "完整新家", placement: "全品类自然陈列亮相", color: "#047857",
    shots: [
      { id: 1, desc: "完整公寓全景，温暖金色光线", action: "镜头从门口缓推进", dialogue: "「Oh my god！」", emotion: "惊喜", duration: "5s" },
      { id: 2, desc: "林晓回头微笑，自信神情", action: "自然转身，眼神坚定", dialogue: "「是不是很像我？」", emotion: "自信", duration: "4s" },
      { id: 3, desc: "黄金时段光线中女主与家的特写", action: "慢镜，情绪高潮", dialogue: "「家，是你对生活的态度」", emotion: "升华", duration: "6s" },
      { id: 4, desc: "品牌 Logo 淡入，产品信息展示", action: "简洁淡出收场", dialogue: "（字幕）NordHome", emotion: "品牌", duration: "5s" },
    ],
  },
];

/* Parse "12-40s" → 28, "15s" → 15, else → 15 */
function parseDurationSeconds(str: string): number {
  const range = str.match(/(\d+)-(\d+)s/);
  if (range) return parseInt(range[2]) - parseInt(range[1]);
  const single = str.match(/(\d+)s/);
  if (single) return parseInt(single[1]);
  return 15;
}

function buildRenderSequence(seg: SegmentItem) {
  const shotCount = Math.max(seg.shots.length, 1);
  const durationSec = parseDurationSeconds(seg.duration);
  const totalFrames = durationSec * 24;

  type PhaseStep = { key: string; label: string; percent: number; shot: number; delay: number };
  const steps: PhaseStep[] = [];
  let delay = 0;

  const push = (key: string, label: string, percent: number, shot: number, dur: number) => {
    steps.push({ key, label, percent, shot, delay });
    delay += dur;
  };

  push("analyzing", "分析脚本与镜头设定", 5, 0, 650);
  push("keyframes", "生成关键帧序列", 18, 0, 900);

  const perShot = Math.floor(60 / shotCount);
  for (let i = 1; i <= shotCount; i++) {
    push(`shot_${i}`, `渲染镜头 ${i} / ${shotCount}`, 18 + i * perShot, i, 950);
  }

  push("grading", "调色与光效合成", 85, 0, 850);
  push("audio", "生成音轨与字幕", 93, 0, 700);
  push("encoding", "压缩输出 MP4", 99, 0, 700);

  return { steps, totalDuration: delay + 450, totalFrames, shotCount };
}

export default function Step4Page() {
  const navigate = useNavigate();
  const [segments, setSegments] = useState<SegmentItem[]>(INITIAL_SEGMENTS);
  const [activeSegment, setActiveSegment] = useState(1);
  const [videoStatus, setVideoStatus] = useState<VideoStatusMap>({ 1: "idle", 2: "idle", 3: "idle" });
  const [renderProgress, setRenderProgress] = useState<RenderProgressMap>({});
  const [isComposing, setIsComposing] = useState(false);

  const runRenderSequence = (segId: number, seg: SegmentItem) => {
    const { steps, totalDuration, totalFrames, shotCount } = buildRenderSequence(seg);

    setVideoStatus((prev) => ({ ...prev, [segId]: "generating" }));

    steps.forEach(({ key, label, percent, shot, delay }) => {
      setTimeout(() => {
        setRenderProgress((prev) => ({
          ...prev,
          [segId]: { phase: key, phaseLabel: label, percent, currentShot: shot, totalShots: shotCount, totalFrames },
        }));
      }, delay);
    });

    setTimeout(() => {
      setVideoStatus((prev) => ({ ...prev, [segId]: "done" }));
      setRenderProgress((prev) => {
        const next = { ...prev };
        delete next[segId];
        return next;
      });
    }, totalDuration);
  };

  const handleGenerateVideo = (segId: number) => {
    const seg = segments.find((s) => s.id === segId);
    if (!seg) return;
    runRenderSequence(segId, seg);
  };

  const handleRegenerate = (segId: number) => {
    const seg = segments.find((s) => s.id === segId);
    if (!seg) return;
    runRenderSequence(segId, seg);
  };

  const handleAddSegment = () => {
    const newId = Math.max(...segments.map((s) => s.id)) + 1;
    const colorIndex = segments.length % SEGMENT_COLORS.length;
    const newSegment: SegmentItem = {
      id: newId,
      name: `S${newId} · 新片段`,
      duration: "待定",
      goal: "请填写片段目标",
      characters: [],
      scene: "待设定",
      placement: "待设定",
      color: SEGMENT_COLORS[colorIndex],
      isNew: true,
      shots: [],
    };
    setSegments((prev) => [...prev, newSegment]);
    setVideoStatus((prev) => ({ ...prev, [newId]: "idle" }));
    setActiveSegment(newId);
    setTimeout(() => {
      document.getElementById(`segment-${newId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  };

  const handleCompose = () => {
    const allDone = segments.every((s) => videoStatus[s.id] === "done");
    if (allDone) {
      setIsComposing(true);
      setTimeout(() => {
        setIsComposing(false);
        navigate("/overview");
      }, 3200);
    }
  };

  const doneCount = segments.filter((s) => videoStatus[s.id] === "done").length;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#ffffff", fontFamily: "'Inter', sans-serif" }}>
      <SDSharedNav currentStep={4} projectName="北欧家居欧洲市场短剧" />

      {/* Composing overlay */}
      {isComposing && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ background: "rgba(255,255,255,0.92)", backdropFilter: "blur(8px)" }}>
          <div className="text-center">
            <div className="w-20 h-20 flex items-center justify-center rounded-full mx-auto mb-6 relative" style={{ background: "#F5F5F7", border: "1px solid #EAEAEA" }}>
              <div className="absolute inset-0 rounded-full animate-ping opacity-10" style={{ background: "#1D1D1F" }} />
              <i className="ri-film-line text-[32px]" style={{ color: "#1D1D1F" }} />
            </div>
            <h3 className="text-xl font-bold mb-2" style={{ fontFamily: "'Syne', sans-serif", color: "#1D1D1F" }}>
              正在合成完整视频
            </h3>
            <p className="text-[14px]" style={{ color: "#8E8E93" }}>正在合并所有片段，生成完整广告短剧...</p>
          </div>
        </div>
      )}

      {/* Main workspace */}
      <div className="flex flex-1 pt-14" style={{ minHeight: "calc(100vh - 56px)" }}>
        <AssetLibrary />

        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Header */}
          <div className="px-5 pt-5 pb-3 flex items-center justify-between shrink-0" style={{ borderBottom: "1px solid #EAEAEA", background: "#ffffff" }}>
            <div>
              <span className="text-[11px] font-bold tracking-widest uppercase" style={{ color: "#8E8E93" }}>STEP 04</span>
              <h1 className="text-xl font-black mt-0.5" style={{ fontFamily: "'Syne', sans-serif", color: "#1D1D1F" }}>片段脚本</h1>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[12px]" style={{ color: "#8E8E93" }}>{doneCount} / {segments.length} 片段已生成</span>
              <div className="flex gap-1">
                {segments.map((s) => (
                  <div
                    key={s.id}
                    className="w-2 h-2 rounded-full"
                    style={{
                      background: videoStatus[s.id] === "done" ? "#047857" : videoStatus[s.id] === "generating" ? "#B45309" : "#EAEAEA",
                      transition: "background 0.3s",
                    }}
                  />
                ))}
              </div>
              <button
                onClick={() => segments.forEach((s, i) => setTimeout(() => handleGenerateVideo(s.id), i * 600))}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11.5px] cursor-pointer whitespace-nowrap transition-all duration-200"
                style={{ background: "#F7F8FA", color: "#444444", border: "1px solid #EAEAEA" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#1D1D1F"; (e.currentTarget as HTMLElement).style.color = "#ffffff"; (e.currentTarget as HTMLElement).style.borderColor = "#1D1D1F"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#F7F8FA"; (e.currentTarget as HTMLElement).style.color = "#444444"; (e.currentTarget as HTMLElement).style.borderColor = "#EAEAEA"; }}
              >
                <i className="ri-video-add-line text-[11px]" />
                全部生成
              </button>
            </div>
          </div>

          <SegmentPanel
            segments={segments}
            activeSegment={activeSegment}
            videoStatus={videoStatus}
            renderProgressMap={renderProgress}
            onSegmentChange={setActiveSegment}
            onGenerateVideo={(id) => { setActiveSegment(id); handleGenerateVideo(id); }}
          />

          <Timeline
            segments={segments}
            videoStatus={videoStatus}
            activeSegment={activeSegment}
            onSegmentClick={setActiveSegment}
            onAddSegment={handleAddSegment}
            onCompose={handleCompose}
          />
        </div>

        <VideoPreview
          segmentId={activeSegment}
          videoStatus={videoStatus}
          renderProgress={renderProgress[activeSegment] ?? null}
          onRegenerate={handleRegenerate}
        />
      </div>

      {/* Bottom nav */}
      <div className="px-6 py-3 flex items-center justify-between" style={{ background: "#F7F8FA", borderTop: "1px solid #EAEAEA" }}>
        <button
          onClick={() => navigate("/step3")}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] cursor-pointer whitespace-nowrap transition-all duration-200"
          style={{ background: "#ffffff", color: "#444444", border: "1px solid #EAEAEA" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#EAEAEA"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#ffffff"; }}
        >
          <i className="ri-arrow-left-line text-[12px]" />
          上一步
        </button>
        <button
          onClick={handleCompose}
          className="flex items-center gap-2 px-7 py-2.5 rounded-xl text-[13.5px] font-semibold text-white cursor-pointer transition-all duration-200 whitespace-nowrap"
          style={{ background: "#1D1D1F" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#374151"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#1D1D1F"; }}
        >
          <i className="ri-film-line text-[13px]" />
          合成并查看完整视频
          <i className="ri-arrow-right-line text-[12px]" />
        </button>
      </div>
    </div>
  );
}
