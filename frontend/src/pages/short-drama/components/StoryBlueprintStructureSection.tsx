import { CollapsibleBlueprintCard, truncateBlueprintSummary } from './storyBlueprintDisplay';

type Props = {
  structureType: string;
  structureRhythm: string;
  designReason: string;
};

/** Framer ScriptStructureSection：剧本结构 + 结构节奏 + 设计原因（默认折叠）。 */
export function StoryBlueprintStructureSection({ structureType, structureRhythm, designReason }: Props) {
  const hasStructure = Boolean(structureType.trim());
  const hasRhythm = Boolean(structureRhythm.trim());

  return (
    <div className="mb-4 space-y-3">
      {(hasStructure || hasRhythm) && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {hasStructure ? (
            <CollapsibleBlueprintCard
              title="剧本结构"
              summary={structureType}
              accentColor="#1D1D1F"
            >
              <p className="text-[15px] font-bold leading-tight" style={{ color: '#1D1D1F' }}>
                {structureType}
              </p>
            </CollapsibleBlueprintCard>
          ) : null}
          {hasRhythm ? (
            <CollapsibleBlueprintCard
              title="结构节奏"
              summary={structureRhythm}
              accentColor="#6366f1"
            >
              <p className="text-[15px] font-bold leading-tight" style={{ color: '#1D1D1F' }}>
                {structureRhythm}
              </p>
            </CollapsibleBlueprintCard>
          ) : null}
        </div>
      )}

      <CollapsibleBlueprintCard
        title="设计原因"
        summary={designReason.trim() ? truncateBlueprintSummary(designReason, 96) : '暂无设计说明'}
        accentColor="#8E8E93"
        statusBadge={
          designReason.trim()
            ? { label: '已填写', tone: 'ready' }
            : { label: '待补充', tone: 'warn' }
        }
      >
        {designReason.trim() ? (
          <p className="text-[13px] leading-relaxed" style={{ color: '#444444' }}>
            {designReason}
          </p>
        ) : (
          <p className="text-[13px]" style={{ color: '#AEAEB2' }}>
            暂无设计说明
          </p>
        )}
      </CollapsibleBlueprintCard>
    </div>
  );
}
