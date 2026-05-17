import type { StoryBlueprintVideoSpecVm } from '../utils/shortDramaAdapters';
import { CollapsibleBlueprintCard, FramerEmptyCentered, PromptMonoBlock, SpecFieldBox, truncateBlueprintSummary } from './storyBlueprintDisplay';

const COLORS = ['#B45309', '#DC2626', '#047857', '#6366f1', '#0891b2', '#D97706'];

function VideoSpecCard({ spec, index }: { spec: StoryBlueprintVideoSpecVm; index: number }) {
  const color = COLORS[index % COLORS.length];
  const summary = truncateBlueprintSummary(spec.videoPrompt, 96);

  const camera = spec.extraFields.find((f) => f.label.includes('镜头'))?.value;
  const motion = spec.extraFields.find((f) => f.label.includes('运动') || f.label.includes('动作'))?.value;
  const visualStyle = spec.extraFields.find((f) => f.label.includes('视觉'))?.value;
  const reference = spec.extraFields.find((f) => f.label.includes('参考'))?.value;
  const negative = spec.extraFields.find((f) => f.label.includes('负向') || f.label.includes('避免'))?.value;
  const hasExtra = Boolean(camera || motion || visualStyle || reference || negative);

  const durationMeta =
    spec.durationLabel !== '—' ? (
      <span
        className="shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium"
        style={{ background: '#F5F5F7', color: '#8E8E93', borderLeft: `2px solid ${color}50` }}
      >
        {spec.durationLabel}
      </span>
    ) : null;

  const ratioMeta =
    spec.aspectRatio !== '—' ? (
      <span className="shrink-0 rounded-md px-2 py-0.5 text-[10px] font-medium" style={{ background: '#F5F5F7', color: '#8E8E93' }}>
        {spec.aspectRatio}
      </span>
    ) : null;

  return (
    <CollapsibleBlueprintCard
      accentColor={color}
      indexLabel={index + 1}
      title={spec.segmentTitle !== '—' ? spec.segmentTitle : `视频段 ${index + 1}`}
      meta={
        <>
          {durationMeta}
          {ratioMeta}
        </>
      }
      summary={summary || '暂无视频 Prompt'}
      className="rounded-2xl"
    >
      {spec.videoPrompt ? (
        <div>
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: '#AEAEB2' }}>
            视频生成 Prompt
          </p>
          <PromptMonoBlock text={spec.videoPrompt} />
        </div>
      ) : null}
      {hasExtra ? (
        <div className="mt-3 grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2">
          {camera ? <SpecFieldBox icon="ri-camera-line" label="镜头运动" value={camera} /> : null}
          {motion ? <SpecFieldBox icon="ri-walk-line" label="画面动态" value={motion} /> : null}
          {visualStyle ? <SpecFieldBox icon="ri-palette-line" label="视觉风格" value={visualStyle} /> : null}
          {reference ? <SpecFieldBox icon="ri-image-line" label="参考资产" value={reference} /> : null}
          {negative ? (
            <div className="sm:col-span-2">
              <SpecFieldBox icon="ri-prohibited-line" label="避免内容" value={negative} warning />
            </div>
          ) : null}
        </div>
      ) : null}
    </CollapsibleBlueprintCard>
  );
}

type Props = { specs: StoryBlueprintVideoSpecVm[] };

export function StoryBlueprintVideoSpecsSection({ specs }: Props) {
  if (!specs.length) {
    return <FramerEmptyCentered icon="ri-film-line" message="尚未生成视频规格。重新生成蓝图后将在此显示。" />;
  }
  return (
    <div className="space-y-3">
      {specs.map((spec, idx) => (
        <VideoSpecCard key={`${spec.segmentId}-${idx}`} spec={spec} index={idx} />
      ))}
    </div>
  );
}
