import type { StoryBlueprintProductionVm } from '../utils/shortDramaAdapters';
import { StoryBlueprintAssetSpecsSection } from './StoryBlueprintAssetSpecsSection';
import { StoryBlueprintDialogueSection } from './StoryBlueprintDialogueSection';
import { StoryBlueprintSubtitleSection } from './StoryBlueprintSubtitleSection';
import { StoryBlueprintVideoSpecsSection } from './StoryBlueprintVideoSpecsSection';
import { StoryBlueprintCollapsibleSubSection } from './storyBlueprintDisplay';

type Props = {
  production: StoryBlueprintProductionVm;
};

function subtitleSummary(production: StoryBlueprintProductionVm): string {
  const sub = production.subtitle;
  if (!sub.present) return '尚未生成字幕策略';
  if (sub.rawText) return sub.rawText.slice(0, 80);
  const enabled = sub.rows.find((r) => r.label === '是否启用')?.value;
  const lang = sub.rows.find((r) => r.label === '字幕语言')?.value;
  return [enabled === '是' ? '字幕已启用' : '不使用字幕', lang].filter(Boolean).join(' · ');
}

export function StoryBlueprintProductionSection({ production }: Props) {
  const assetNames = production.assetSpecs
    .slice(0, 4)
    .map((s) => s.name)
    .join('、');
  const videoTitles = production.videoSpecs
    .slice(0, 3)
    .map((s) => (s.segmentTitle !== '—' ? s.segmentTitle : '视频段'))
    .join('、');
  const dialoguePreview = production.dialogueItems[0]?.text?.slice(0, 60) ?? '';

  return (
    <div>
      <StoryBlueprintCollapsibleSubSection
        label="资产生成规格"
        icon="ri-image-add-line"
        color="#6366f1"
        count={production.assetSpecs.length || null}
        hint="即将进入 S3 生成，非已生成内容"
        summary={assetNames ? `${production.assetSpecs.length} 项 · ${assetNames}` : undefined}
      >
        <StoryBlueprintAssetSpecsSection specs={production.assetSpecs} />
      </StoryBlueprintCollapsibleSubSection>

      <StoryBlueprintCollapsibleSubSection
        label="视频生成规格"
        icon="ri-film-line"
        color="#D97706"
        count={production.videoSpecs.length || null}
        hint="即将进入 S4 生成，非已生成内容"
        summary={videoTitles ? `${production.videoSpecs.length} 段 · ${videoTitles}` : undefined}
      >
        <StoryBlueprintVideoSpecsSection specs={production.videoSpecs} />
      </StoryBlueprintCollapsibleSubSection>

      <StoryBlueprintCollapsibleSubSection
        label="字幕策略"
        icon="ri-closed-captioning-line"
        color="#0891b2"
        summary={subtitleSummary(production)}
      >
        <StoryBlueprintSubtitleSection subtitle={production.subtitle} />
      </StoryBlueprintCollapsibleSubSection>

      <StoryBlueprintCollapsibleSubSection
        label="旁白 / 对白"
        icon="ri-speak-line"
        color="#059669"
        count={production.dialogueItems.length || null}
        summary={
          production.dialogueItems.length
            ? `${production.dialogueItems.length} 条 · ${dialoguePreview}${dialoguePreview.length >= 60 ? '…' : ''}`
            : undefined
        }
      >
        <StoryBlueprintDialogueSection items={production.dialogueItems} />
      </StoryBlueprintCollapsibleSubSection>
    </div>
  );
}
