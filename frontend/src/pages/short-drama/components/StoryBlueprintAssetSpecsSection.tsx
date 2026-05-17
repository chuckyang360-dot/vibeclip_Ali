import { useState } from 'react';
import type { StoryBlueprintAssetSpecVm } from '../utils/shortDramaAdapters';
import { ri } from '../utils/shortDramaHelpers';
import { CollapsibleBlueprintCard, FramerEmptyCentered, PromptMonoBlock, truncateBlueprintSummary } from './storyBlueprintDisplay';

const TYPE_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  character: { label: '角色资产', icon: 'ri-user-smile-line', color: '#6366f1' },
  scene: { label: '场景资产', icon: 'ri-landscape-line', color: '#0891b2' },
  product: { label: '产品资产', icon: 'ri-box-3-line', color: '#059669' },
};

function AssetCard({ spec }: { spec: StoryBlueprintAssetSpecVm }) {
  const [promptOpen, setPromptOpen] = useState(false);
  const cfg = TYPE_CONFIG[spec.assetKind] ?? { label: spec.assetKindLabel, icon: 'ri-image-line', color: '#8E8E93' };
  const purposeLabel =
    spec.assetKind === 'character' ? '角色定位' : spec.assetKind === 'scene' ? '场景用途' : spec.assetKind === 'product' ? '产品用途' : '资产用途';
  const summary = truncateBlueprintSummary(spec.description || spec.purpose, 88);

  return (
    <CollapsibleBlueprintCard
      title={spec.name}
      badge={cfg.label}
      summary={summary || `${purposeLabel}待补充`}
      accentColor={cfg.color}
    >
      {spec.purpose && spec.purpose !== '—' ? (
        <p className="mb-2 text-[11px]" style={{ color: '#8E8E93' }}>
          {purposeLabel}：{spec.purpose}
        </p>
      ) : null}
      {spec.description && spec.description !== '—' ? (
        <p className="mb-3 text-[12px] leading-relaxed" style={{ color: '#444444' }}>
          {spec.description}
        </p>
      ) : null}
      {spec.segmentRefs ? (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {spec.segmentRefs.split('、').map((seg) => (
            <span
              key={seg}
              className="whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{ background: `${cfg.color}0c`, color: cfg.color, border: `1px solid ${cfg.color}20` }}
            >
              {seg}
            </span>
          ))}
        </div>
      ) : null}
      {spec.prompt ? (
        <div style={{ borderTop: '1px solid #F5F5F7' }} className="pt-3">
          <button
            type="button"
            onClick={() => setPromptOpen((v) => !v)}
            className="flex cursor-pointer items-center gap-1.5 text-[11px] transition-colors"
            style={{ color: '#8E8E93' }}
          >
            <i className={promptOpen ? ri('ri-arrow-up-s-line text-[13px]') : ri('ri-arrow-down-s-line text-[13px]')} aria-hidden />
            <i className={ri('ri-image-ai-line text-[11px]')} aria-hidden />
            {promptOpen ? '收起生成 Prompt' : '查看生成 Prompt'}
          </button>
          {promptOpen ? (
            <div className="mt-2">
              <PromptMonoBlock text={spec.prompt} />
            </div>
          ) : null}
        </div>
      ) : null}
    </CollapsibleBlueprintCard>
  );
}

function AssetGroup({ kind, specs }: { kind: string; specs: StoryBlueprintAssetSpecVm[] }) {
  const cfg = TYPE_CONFIG[kind] ?? { label: kind, icon: 'ri-image-line', color: '#8E8E93' };
  const [collapsed, setCollapsed] = useState(true);
  const namesPreview = truncateBlueprintSummary(specs.map((s) => s.name).join('、'), 72);
  if (!specs.length) return null;

  return (
    <div className="mb-4">
      <button type="button" onClick={() => setCollapsed((v) => !v)} className="mb-2.5 flex w-full cursor-pointer flex-col gap-0.5 text-left">
        <div className="flex w-full items-center gap-2">
          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md" style={{ background: `${cfg.color}12` }}>
            <i className={ri(`${cfg.icon} text-[10px]`)} style={{ color: cfg.color }} aria-hidden />
          </div>
          <span className="text-[12px] font-bold" style={{ color: '#444444' }}>
            {cfg.label}
          </span>
          <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ background: `${cfg.color}12`, color: cfg.color }}>
            {specs.length}
          </span>
          <i className={`ml-auto ${collapsed ? ri('ri-arrow-down-s-line text-[14px]') : ri('ri-arrow-up-s-line text-[14px]')} text-[#AEAEB2]`} aria-hidden />
        </div>
        {collapsed && namesPreview ? (
          <p className="truncate pl-7 text-[11px]" style={{ color: '#AEAEB2' }}>
            {namesPreview}
          </p>
        ) : null}
      </button>
      {!collapsed ? (
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
          {specs.map((spec) => (
            <AssetCard key={`${spec.assetKind}-${spec.name}-${spec.prompt.slice(0, 12)}`} spec={spec} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

type Props = { specs: StoryBlueprintAssetSpecVm[] };

export function StoryBlueprintAssetSpecsSection({ specs }: Props) {
  if (!specs.length) {
    return <FramerEmptyCentered icon="ri-image-add-line" message="尚未生成资产规格。重新生成蓝图后将在此显示。" />;
  }
  const characters = specs.filter((s) => s.assetKind === 'character');
  const scenes = specs.filter((s) => s.assetKind === 'scene');
  const products = specs.filter((s) => s.assetKind === 'product');
  const other = specs.filter((s) => !['character', 'scene', 'product'].includes(s.assetKind));

  return (
    <div>
      <AssetGroup kind="character" specs={characters} />
      <AssetGroup kind="scene" specs={scenes} />
      <AssetGroup kind="product" specs={products} />
      {other.length ? (
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
          {other.map((spec) => (
            <AssetCard key={`other-${spec.name}`} spec={spec} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
