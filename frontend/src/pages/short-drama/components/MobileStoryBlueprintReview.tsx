import type { StoryBlueprintPageSegmentVm, StoryBlueprintProductionVm } from '../utils/shortDramaAdapters';
import { ri } from '../utils/shortDramaHelpers';
import { truncateBlueprintSummary } from './storyBlueprintDisplay';

type MobileStoryBlueprintReviewProps = {
  script: {
    title: string;
    summary: string;
    scriptStructureType: string;
    structureRhythm: string;
    structureReason: string;
    sections: Array<{ title?: string; content?: string }>;
  };
  segments: StoryBlueprintPageSegmentVm[];
  production: StoryBlueprintProductionVm;
  regenerateDisabled?: boolean;
  regenerateLabel: string;
  onRegenerate: () => void;
};

const MOBILE_TABS = [
  { href: '#mobile-story-summary', label: '摘要' },
  { href: '#mobile-story-segments', label: '分段' },
  { href: '#mobile-story-assets', label: '生产' },
] as const;

function textOrFallback(value: string | null | undefined, fallback = '待补充'): string {
  const text = String(value || '').trim();
  return text && text !== '—' ? text : fallback;
}

function MobileInfoCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: string;
}) {
  return (
    <div className="rounded-2xl border border-[#EAEAEA] bg-white p-4">
      <div className="mb-2 flex items-center gap-2 text-[#8E8E93]">
        <i className={ri(icon, 'text-[14px]')} aria-hidden />
        <span className="text-[11px] font-bold uppercase tracking-[0.14em]">{label}</span>
      </div>
      <p className="text-[13px] leading-relaxed text-[#444444]">{value}</p>
    </div>
  );
}

export function MobileStoryBlueprintReview({
  script,
  segments,
  production,
  regenerateDisabled = false,
  regenerateLabel,
  onRegenerate,
}: MobileStoryBlueprintReviewProps) {
  const primaryBeats = script.sections.slice(0, 4);
  const assetPreview = production.assetSpecs
    .slice(0, 3)
    .map((item) => item.name)
    .filter(Boolean)
    .join('、');
  const videoPreview = production.videoSpecs
    .slice(0, 3)
    .map((item) => (item.segmentTitle !== '—' ? item.segmentTitle : '视频段'))
    .join('、');

  return (
    <div className="md:hidden">
      <section className="rounded-[28px] bg-[#111111] p-5 text-white shadow-[0_16px_42px_rgba(15,23,42,0.16)]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <span className="rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-white/55">
            Story Review
          </span>
          <button
            type="button"
            onClick={onRegenerate}
            disabled={regenerateDisabled}
            className="flex h-9 items-center gap-1.5 rounded-xl bg-white/10 px-3 text-[12px] font-semibold text-white disabled:opacity-45"
          >
            <i className={ri(regenerateLabel.includes('中') ? 'ri-loader-4-line animate-spin' : 'ri-refresh-line', 'text-[13px]')} aria-hidden />
            {regenerateLabel}
          </button>
        </div>
        <h1 className="text-[26px] font-black leading-tight tracking-normal">
          {textOrFallback(script.title, '剧本已生成')}
        </h1>
        <p className="mt-4 text-[13px] leading-relaxed text-white/64">
          {truncateBlueprintSummary(textOrFallback(script.summary, 'AI 已生成短剧生产蓝图，请确认分段和生产规格。'), 120)}
        </p>
        <div className="mt-5 grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-white/10 p-3">
            <p className="text-[20px] font-black">{segments.length}</p>
            <p className="mt-1 text-[11px] text-white/52">剧情段落</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-3">
            <p className="text-[20px] font-black">{production.assetSpecs.length}</p>
            <p className="mt-1 text-[11px] text-white/52">资产规格</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-3">
            <p className="text-[20px] font-black">{production.videoSpecs.length}</p>
            <p className="mt-1 text-[11px] text-white/52">视频段</p>
          </div>
        </div>
      </section>

      <nav className="sticky top-[112px] z-20 -mx-4 mt-4 border-y border-[#EAEAEA] bg-[#F7F7F8]/95 px-4 py-2 backdrop-blur">
        <div className="flex gap-2 overflow-x-auto">
          {MOBILE_TABS.map((tab) => (
            <a
              key={tab.href}
              href={tab.href}
              className="shrink-0 rounded-full border border-[#EAEAEA] bg-white px-4 py-2 text-[12px] font-semibold text-[#444444]"
            >
              {tab.label}
            </a>
          ))}
        </div>
      </nav>

      <section id="mobile-story-summary" className="scroll-mt-40 pt-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[16px] font-bold text-[#1D1D1F]">故事理解</h2>
          <span className="text-[12px] text-[#8E8E93]">确认方向即可</span>
        </div>
        <div className="space-y-3">
          <MobileInfoCard label="结构" icon="ri-layout-2-line" value={textOrFallback(script.scriptStructureType)} />
          <MobileInfoCard label="节奏" icon="ri-pulse-line" value={textOrFallback(script.structureRhythm)} />
          <MobileInfoCard label="设计原因" icon="ri-lightbulb-flash-line" value={textOrFallback(script.structureReason)} />
        </div>

        {primaryBeats.length ? (
          <div className="mt-4 rounded-2xl border border-[#EAEAEA] bg-white p-4">
            <h3 className="text-[14px] font-bold text-[#1D1D1F]">故事节拍</h3>
            <div className="mt-3 space-y-3">
              {primaryBeats.map((beat, index) => (
                <div key={`${beat.title || 'beat'}-${index}`} className="border-t border-[#F0F0F0] pt-3 first:border-t-0 first:pt-0">
                  <p className="text-[12px] font-bold text-[#1D1D1F]">{beat.title || `节拍 ${index + 1}`}</p>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-[#6E6E73]">
                    {textOrFallback(beat.content, '暂无说明')}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <section id="mobile-story-segments" className="scroll-mt-40 pt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[16px] font-bold text-[#1D1D1F]">执行分段</h2>
          <span className="text-[12px] text-[#8E8E93]">{segments.length} 段</span>
        </div>
        <div className="space-y-3">
          {segments.map((seg, index) => (
            <article key={seg.id} className="overflow-hidden rounded-2xl border border-[#EAEAEA] bg-white">
              <div className="flex items-start gap-3 p-4">
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-black"
                  style={{ background: `${seg.color}14`, color: seg.color }}
                >
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[14px] font-bold text-[#1D1D1F]">{seg.name || `段落 ${index + 1}`}</h3>
                    {seg.duration && seg.duration !== '—' ? (
                      <span className="rounded-full bg-[#F5F5F7] px-2 py-0.5 text-[10px] font-semibold text-[#8E8E93]">{seg.duration}</span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-[12.5px] leading-relaxed text-[#444444]">
                    {textOrFallback(seg.synopsis || seg.goal, '暂无段落概要')}
                  </p>
                  <div className="mt-3 grid grid-cols-1 gap-2">
                    <p className="rounded-xl bg-[#F7F8FA] px-3 py-2 text-[12px] leading-relaxed text-[#6E6E73]">
                      <span className="font-semibold text-[#1D1D1F]">产品露出：</span>
                      {textOrFallback(seg.productPlacement, '待定')}
                    </p>
                    <p className="rounded-xl bg-[#F7F8FA] px-3 py-2 text-[12px] leading-relaxed text-[#6E6E73]">
                      <span className="font-semibold text-[#1D1D1F]">关键信息：</span>
                      {textOrFallback(seg.keyMessage, '待补充')}
                    </p>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="mobile-story-assets" className="scroll-mt-40 pt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[16px] font-bold text-[#1D1D1F]">生产准备</h2>
          <span className="text-[12px] text-[#8E8E93]">下一步生成资产</span>
        </div>
        <div className="grid grid-cols-1 gap-3">
          <MobileInfoCard
            label="资产规格"
            icon="ri-image-add-line"
            value={assetPreview ? `${production.assetSpecs.length} 项：${assetPreview}` : '尚未生成资产规格'}
          />
          <MobileInfoCard
            label="视频规格"
            icon="ri-film-line"
            value={videoPreview ? `${production.videoSpecs.length} 段：${videoPreview}` : '尚未生成视频规格'}
          />
          <MobileInfoCard
            label="字幕对白"
            icon="ri-speak-line"
            value={`${production.subtitle.present ? '有字幕策略' : '未启用字幕'} · ${production.dialogueItems.length || 0} 条旁白/对白`}
          />
        </div>
      </section>
    </div>
  );
}
