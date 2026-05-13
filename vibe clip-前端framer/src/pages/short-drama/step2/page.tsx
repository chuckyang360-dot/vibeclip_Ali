import { useState } from "react";
import { useNavigate } from "react-router-dom";
import SDSharedNav from "@/pages/short-drama/components/SDSharedNav";

interface Segment {
  id: number;
  name: string;
  goal: string;
  duration: string;
  productPlacement: string;
  synopsis: string;
  color: string;
}

const INITIAL_SCRIPT = {
  title: "《新家第一天》",
  premise: "一位年轻女性独自搬入新公寓，面对空荡荡的空间感到迷茫，最终通过精心挑选的北欧家具找到了属于自己的生活节奏。",
  hook: "女主凌晨三点独坐空荡荡的新公寓地板，手机里播放着前男友发来的嘲讽消息：「你一个人能怎么办」",
  conflict: "面对陌生的城市、空荡荡的房间和内心的自我怀疑，女主试图用家具填满空间，却始终觉得哪里不对——是缺少家的感觉，还是缺少某个人？",
  twist: "朋友来访惊呼「你这里怎么这么美」，女主看着满室温暖的北欧木质光影，第一次意识到：原来家不是某个人，而是你对生活的态度。",
  resolution: "女主在日落时分泡一杯咖啡，坐在餐桌旁发出去一条消息：「我过得很好。」镜头拉远，整个公寓在暖光中完整呈现。",
};

const SEGMENTS: Segment[] = [
  { id: 1, name: "Hook", goal: "制造情绪共鸣，引发观众好奇", duration: "0-12s", productPlacement: "隐性 / 空间背景", synopsis: "深夜独坐空房，手机通知，情绪低落，强烈代入感", color: "#B45309" },
  { id: 2, name: "Conflict", goal: "强化情绪冲突，建立产品需求感", duration: "12-40s", productPlacement: "产品选购过程自然植入", synopsis: "探索家居市场，对比不同风格，价值观碰撞与选择困惑", color: "#DC2626" },
  { id: 3, name: "Twist & Resolution", goal: "产品价值揭示，情绪正向升华", duration: "40-60s", productPlacement: "全品类完整亮相", synopsis: "朋友惊讶，女主意识到转变，品牌价值主张自然呈现", color: "#047857" },
];

export default function Step2Page() {
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [script, setScript] = useState(INITIAL_SCRIPT);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [editedSegment, setEditedSegment] = useState<number | null>(null);

  const handleRegenerate = () => {
    setIsRegenerating(true);
    setTimeout(() => setIsRegenerating(false), 2000);
  };

  const scriptFields: Array<{ key: keyof typeof INITIAL_SCRIPT; label: string; icon: string }> = [
    { key: "title", label: "剧集标题", icon: "ri-quill-pen-line" },
    { key: "premise", label: "故事前提 Premise", icon: "ri-book-open-line" },
    { key: "hook", label: "钩子 Hook", icon: "ri-anchor-line" },
    { key: "conflict", label: "核心冲突 Conflict", icon: "ri-sword-line" },
    { key: "twist", label: "反转 Twist", icon: "ri-exchange-funds-line" },
    { key: "resolution", label: "结尾 Resolution", icon: "ri-flag-line" },
  ];

  return (
    <div className="min-h-screen" style={{ background: "#ffffff", fontFamily: "'Inter', sans-serif" }}>
      <SDSharedNav currentStep={2} projectName="北欧家居欧洲市场短剧" />
      <div className="flex min-h-screen pt-14">
        {/* Left sidebar */}
        <aside
          className="hidden lg:flex flex-col w-64 shrink-0 p-6 pt-10 overflow-y-auto"
          style={{ borderRight: "1px solid #EAEAEA", background: "#F7F8FA" }}
        >
          <div className="mb-6">
            <p className="text-[10px] uppercase tracking-widest mb-3 font-bold" style={{ color: "#AEAEB2" }}>项目设置</p>
            {[
              { label: "时长", value: "60s" },
              { label: "形式", value: "单条广告" },
              { label: "风格", value: "情绪 · 反转" },
              { label: "视觉", value: "写实电影感" },
              { label: "比例", value: "9:16" },
              { label: "市场", value: "欧洲" },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between py-2.5"
                style={{ borderBottom: "1px solid #F0F0F0" }}
              >
                <span className="text-[12px]" style={{ color: "#8E8E93" }}>{item.label}</span>
                <span className="text-[12px] font-medium" style={{ color: "#444444" }}>{item.value}</span>
              </div>
            ))}
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-widest mb-3 font-bold" style={{ color: "#AEAEB2" }}>全局设定</p>
            <div className="p-3 rounded-xl space-y-3" style={{ background: "#ffffff", border: "1px solid #EAEAEA" }}>
              {[
                { label: "主角", value: "年轻都市女性" },
                { label: "核心情绪", value: "孤独 → 自信" },
                { label: "POV", value: "第三人称观察" },
                { label: "叙事节奏", value: "快-中-慢压缩" },
              ].map((item) => (
                <div key={item.label}>
                  <p className="text-[10px] mb-0.5" style={{ color: "#AEAEB2" }}>{item.label}</p>
                  <p className="text-[12px] font-medium" style={{ color: "#444444" }}>{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Center: Script main panel */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <span className="text-[11px] font-bold tracking-widest uppercase" style={{ color: "#8E8E93" }}>STEP 02</span>
              <h1 className="text-2xl font-black mt-0.5" style={{ fontFamily: "'Syne', sans-serif", color: "#1D1D1F" }}>
                剧本大纲
              </h1>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleRegenerate}
                disabled={isRegenerating}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-[12.5px] font-medium cursor-pointer transition-all duration-200 whitespace-nowrap"
                style={{ background: "#F7F8FA", color: "#444444", border: "1px solid #EAEAEA" }}
                onMouseEnter={(e) => { if (!isRegenerating) (e.currentTarget as HTMLElement).style.background = "#EAEAEA"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#F7F8FA"; }}
              >
                <i className={`${isRegenerating ? "ri-loader-4-line animate-spin" : "ri-refresh-line"} text-[12px]`} />
                重新生成
              </button>
              <button
                onClick={() => setIsEditing(isEditing ? null : "all")}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-[12.5px] font-medium cursor-pointer transition-all duration-200 whitespace-nowrap"
                style={{ background: isEditing ? "#1D1D1F" : "#F7F8FA", color: isEditing ? "#ffffff" : "#444444", border: "1px solid #EAEAEA" }}
                onMouseEnter={(e) => { if (!isEditing) (e.currentTarget as HTMLElement).style.background = "#EAEAEA"; }}
                onMouseLeave={(e) => { if (!isEditing) (e.currentTarget as HTMLElement).style.background = "#F7F8FA"; }}
              >
                <i className="ri-edit-line text-[12px]" />
                手动编辑
              </button>
            </div>
          </div>

          {/* Script fields */}
          <div className="space-y-3 mb-8">
            {scriptFields.map((field) => (
              <div
                key={field.key}
                className="p-5 rounded-2xl transition-all duration-200"
                style={{
                  background: "#ffffff",
                  border: isEditing === field.key ? "1.5px solid #1D1D1F" : "1px solid #EAEAEA",
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 flex items-center justify-center rounded-lg" style={{ background: "#F5F5F7" }}>
                      <i className={`${field.icon} text-[12px]`} style={{ color: "#1D1D1F" }} />
                    </div>
                    <span className="text-[12px] font-bold uppercase tracking-wider" style={{ color: "#8E8E93" }}>
                      {field.label}
                    </span>
                  </div>
                  <button
                    onClick={() => setIsEditing(isEditing === field.key ? null : field.key)}
                    className="w-6 h-6 flex items-center justify-center rounded-md cursor-pointer transition-all duration-150"
                    style={{ color: "#AEAEB2" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#F5F5F7"; (e.currentTarget as HTMLElement).style.color = "#1D1D1F"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "#AEAEB2"; }}
                  >
                    <i className="ri-edit-line text-[12px]" />
                  </button>
                </div>
                {isEditing === field.key ? (
                  <textarea
                    value={script[field.key]}
                    onChange={(e) => setScript((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    rows={field.key === "title" ? 1 : 3}
                    className="w-full px-3 py-2.5 rounded-lg text-[13.5px] outline-none resize-none transition-all"
                    style={{ background: "#F7F8FA", border: "1px solid #EAEAEA", color: "#1D1D1F" }}
                  />
                ) : (
                  <p
                    className="leading-relaxed"
                    style={{
                      color: "#444444",
                      fontFamily: field.key === "title" ? "'Syne', sans-serif" : "'Inter', sans-serif",
                      fontWeight: field.key === "title" ? 800 : 400,
                      fontSize: field.key === "title" ? "18px" : "13.5px",
                    }}
                  >
                    {script[field.key]}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Segment plan */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-5 h-5 flex items-center justify-center rounded-md" style={{ background: "#F5F5F7" }}>
                <i className="ri-layout-row-line text-[12px]" style={{ color: "#1D1D1F" }} />
              </div>
              <h3 className="text-[13px] font-bold uppercase tracking-wider" style={{ color: "#444444" }}>
                Segment Plan
              </h3>
            </div>
            <div className="space-y-3">
              {SEGMENTS.map((seg) => (
                <div
                  key={seg.id}
                  className="p-5 rounded-2xl cursor-pointer transition-all duration-200"
                  style={{
                    background: "#ffffff",
                    border: editedSegment === seg.id ? `1.5px solid ${seg.color}40` : "1px solid #EAEAEA",
                    boxShadow: editedSegment === seg.id ? `0 2px 12px ${seg.color}10` : "none",
                  }}
                  onClick={() => setEditedSegment(editedSegment === seg.id ? null : seg.id)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 flex items-center justify-center rounded-lg shrink-0 text-[12px] font-bold"
                        style={{ background: `${seg.color}10`, color: seg.color }}
                      >
                        S{seg.id}
                      </div>
                      <div>
                        <span className="text-[14px] font-bold" style={{ color: "#1D1D1F" }}>{seg.name}</span>
                        <span className="ml-2 text-[11px]" style={{ color: "#8E8E93" }}>{seg.duration}</span>
                      </div>
                    </div>
                    <i
                      className={editedSegment === seg.id ? "ri-arrow-up-s-line" : "ri-arrow-down-s-line"}
                      style={{ color: "#AEAEB2" }}
                    />
                  </div>
                  {editedSegment === seg.id && (
                    <div className="grid grid-cols-3 gap-3 mt-4 text-[12px]">
                      <div>
                        <p className="mb-1" style={{ color: "#8E8E93" }}>目标</p>
                        <p className="leading-snug" style={{ color: "#444444" }}>{seg.goal}</p>
                      </div>
                      <div>
                        <p className="mb-1" style={{ color: "#8E8E93" }}>产品露出</p>
                        <p style={{ color: seg.color, fontWeight: 600 }}>{seg.productPlacement}</p>
                      </div>
                      <div>
                        <p className="mb-1" style={{ color: "#8E8E93" }}>剧情概要</p>
                        <p className="leading-snug" style={{ color: "#444444" }}>{seg.synopsis}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Bottom CTA */}
          <div
            className="flex items-center justify-between pt-6"
            style={{ borderTop: "1px solid #EAEAEA" }}
          >
            <button
              onClick={() => navigate("/step1")}
              className="flex items-center gap-2 px-5 py-3 rounded-xl text-[13.5px] cursor-pointer whitespace-nowrap transition-all duration-200"
              style={{ background: "#F7F8FA", color: "#444444", border: "1px solid #EAEAEA" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#EAEAEA"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#F7F8FA"; }}
            >
              <i className="ri-arrow-left-line text-[13px]" />
              上一步
            </button>
            <button
              onClick={() => navigate("/step3")}
              className="flex items-center gap-2 px-7 py-3 rounded-xl text-[14px] font-semibold cursor-pointer transition-all duration-200 whitespace-nowrap"
              style={{ background: "#1D1D1F", color: "#ffffff" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#374151"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#1D1D1F"; }}
            >
              确认进入角色和场景
              <i className="ri-arrow-right-line text-[13px]" />
            </button>
          </div>
        </main>

        {/* Right sidebar */}
        <aside
          className="hidden xl:flex flex-col w-64 shrink-0 p-6 pt-10 overflow-y-auto"
          style={{ borderLeft: "1px solid #EAEAEA", background: "#F7F8FA" }}
        >
          <h3 className="text-[12px] font-bold mb-5 uppercase tracking-wider" style={{ color: "#8E8E93" }}>结构分析</h3>
          <div className="space-y-3">
            {[
              { label: "叙事节奏", value: "快 → 中 → 缓压收", icon: "ri-pulse-line", color: "#B45309" },
              { label: "情绪弧线", value: "失落 → 探索 → 升华", icon: "ri-emotion-line", color: "#DC2626" },
              { label: "广告密度", value: "低 · 中 · 高", icon: "ri-bar-chart-2-line", color: "#047857" },
              { label: "Hook 强度", value: "★★★★★", icon: "ri-star-line", color: "#B45309" },
            ].map((item) => (
              <div
                key={item.label}
                className="p-3.5 rounded-xl"
                style={{ background: "#ffffff", border: "1px solid #EAEAEA" }}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <i className={`${item.icon} text-[12px]`} style={{ color: item.color }} />
                  <span className="text-[11px]" style={{ color: "#8E8E93" }}>{item.label}</span>
                </div>
                <p className="text-[13px] font-semibold" style={{ color: "#1D1D1F" }}>{item.value}</p>
              </div>
            ))}
          </div>
          <div
            className="mt-5 p-3.5 rounded-xl"
            style={{ background: "rgba(4,120,87,0.06)", border: "1px solid rgba(4,120,87,0.2)" }}
          >
            <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: "#047857" }}>结构评估</p>
            <p className="text-[12px] leading-relaxed" style={{ color: "#444444" }}>
              剧情结构完整，Hook 设计具有强情绪共鸣，建议 S2 段落适当缩短以保持节奏感。
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
