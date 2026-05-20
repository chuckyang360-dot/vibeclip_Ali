import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SDWorkflowNav } from './components/SDWorkflowNav';
import { StoryBlueprintLeftRail } from './components/StoryBlueprintLeftRail';
import { StoryBlueprintRightRail } from './components/StoryBlueprintRightRail';
import { StoryBlueprintStructureSection } from './components/StoryBlueprintStructureSection';
import { StoryBlueprintSegmentTimeline } from './components/StoryBlueprintSegmentTimeline';
import { StoryBlueprintProductionSection } from './components/StoryBlueprintProductionSection';
import { StoryBlueprintBeatsSection } from './components/StoryBlueprintBeatsSection';
import {
  CollapsibleBlueprintCard,
  StoryBlueprintAnchorNav,
  StoryBlueprintSectionDivider,
  truncateBlueprintSummary,
} from './components/storyBlueprintDisplay';
import type { StoryBlueprintProductionVm } from './utils/shortDramaAdapters';
import { useEffectiveShortDramaProjectId } from './hooks/useEffectiveShortDramaProjectId';
import { useStoryBlueprint } from './hooks/useStoryBlueprint';
import type { StoryBlueprintPageSegmentVm } from './utils/shortDramaAdapters';
import { storyBlueprintDtoToPageView } from './utils/shortDramaAdapters';
import {
  buildStoryBlueprintLeftRailsFromPipeline,
  deriveStoryStructureAnalysis,
  deriveStoryBlueprintOverallEval,
  isStoryPipelineLockedForRegenerate,
  STORY_REGENERATE_LOCKED_TITLE,
} from './utils/storyBlueprintDerived';
import { SHORT_DRAMA_UI } from './utils/shortDramaUiCopy';
import { workflowNavProjectName } from './utils/workflowProjectName';
import { withProjectQuery } from './utils/shortDramaRoutes';
import { workflowFooterNextButtonClass, workflowFooterPrevButtonClass } from './utils/workflowFooterNav';
import { ri, sdColors, sdFontHeading } from './utils/shortDramaHelpers';
import { touchShortDramaProjectStep } from '@/services/shortDramaApi';

/** 本地调试 Creative Blueprint v2 摘要；正式与默认页面须保持 false。 */
const SHOW_CREATIVE_BLUEPRINT_DEBUG = false;

const EMPTY_VM = storyBlueprintDtoToPageView(null);

function hasDisplayValue(value: string | undefined | null): value is string {
  const text = String(value || '').trim();
  return Boolean(text && text !== '—');
}

function StoryBlueprintSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="h-20 rounded-2xl" style={{ background: '#F0F0F0' }} />
        <div className="h-20 rounded-2xl" style={{ background: '#F0F0F0' }} />
      </div>
      <div className="h-24 rounded-2xl" style={{ background: '#F5F5F7' }} />
      <div className="h-28 rounded-2xl" style={{ background: '#F5F5F7' }} />
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-20 rounded-2xl" style={{ background: '#F5F5F7' }} />
      ))}
    </div>
  );
}

function requiredVisualElementsDisplay(seg: StoryBlueprintPageSegmentVm): string {
  if (hasDisplayValue(seg.visualElementsSummary)) return seg.visualElementsSummary;
  if (seg.expectedAssets.length) return seg.expectedAssets.join('、');
  return '—';
}

function segmentDetailRows(seg: StoryBlueprintPageSegmentVm): Array<{ label: string; value: string; accent?: boolean; wide?: boolean }> {
  return [
    { label: '段落目标', value: seg.goal },
    { label: '产品露出', value: seg.productPlacement, accent: true },
    { label: '段落概要', value: seg.synopsis, wide: true },
    { label: '阶段名', value: seg.name },
    { label: '段落职责', value: seg.segmentRole },
    { label: '所需视觉元素', value: requiredVisualElementsDisplay(seg) },
    { label: '转场到下一段', value: seg.transitionToNext, wide: true },
    { label: '关键信息', value: seg.keyMessage },
    { label: '情绪状态', value: seg.emotionalState },
    { label: '画面需求', value: seg.visualRequirement },
    { label: '产品功能露出', value: seg.productFeature },
    { label: '用户触发点', value: seg.targetUserTrigger },
  ].filter((item) => hasDisplayValue(item.value));
}

/**
 * Framer step2：三栏密度 / 剧集卡 / SegmentTimeline / 制作检查样式 + 线上真实字段与 pipeline 派生。
 */
export function ShortDramaStoryBlueprintPage() {
  const navigate = useNavigate();
  const { effectiveProjectId: projectId, projectName, refreshSession } = useEffectiveShortDramaProjectId();
  const {
    pipeline,
    pipelineLoading,
    pipelineError,
    generate,
    generateLoading,
    generateError,
  } = useStoryBlueprint(projectId);

  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [script, setScript] = useState(EMPTY_VM.script);
  const [segments, setSegments] = useState<StoryBlueprintPageSegmentVm[]>(EMPTY_VM.segments);
  const [production, setProduction] = useState<StoryBlueprintProductionVm>(EMPTY_VM.production);
  const [isDirty, setIsDirty] = useState(false);
  const [staleBannerDismissed, setStaleBannerDismissed] = useState(false);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    const raw = pipeline?.story_blueprint?.blueprint;
    if (!raw) return;
    const vm = storyBlueprintDtoToPageView(raw);
    setScript(vm.script);
    setSegments(vm.segments);
    setProduction(vm.production);
    setIsDirty(false);
  }, [pipeline]);

  const hasBlueprint = Boolean(pipeline?.story_blueprint?.blueprint && Object.keys(pipeline.story_blueprint.blueprint).length);
  const step2Stale = pipeline?.project?.step_status?.step_2 === 'stale';
  const creativeBrief = pipeline?.creative_brief ?? pipeline?.project?.creative_brief_structured ?? null;
  const hasCreativeBrief = Boolean(creativeBrief && Object.keys(creativeBrief).length);

  const blueprintRaw = pipeline?.story_blueprint?.blueprint;
  const creativeBlueprintV2Debug = useMemo(() => {
    if (!SHOW_CREATIVE_BLUEPRINT_DEBUG) return null;
    if (!blueprintRaw) return null;
    const hasSpecs =
      Array.isArray(blueprintRaw.asset_generation_specs) && blueprintRaw.asset_generation_specs.length > 0;
    if (blueprintRaw.blueprint_schema_version !== 'creative_blueprint_v2' && !hasSpecs) return null;
    const n = (v: unknown) => (Array.isArray(v) ? v.length : 0);
    return {
      version: String(blueprintRaw.blueprint_schema_version || '—'),
      characters: n(blueprintRaw.characters),
      scenes: n(blueprintRaw.scenes),
      product_assets: n(blueprintRaw.product_assets),
      asset_generation_specs: n(blueprintRaw.asset_generation_specs),
      video_generation_specs: n(blueprintRaw.video_generation_specs),
    };
  }, [blueprintRaw, SHOW_CREATIVE_BLUEPRINT_DEBUG]);

  const storyRegenerateLocked = isStoryPipelineLockedForRegenerate(pipeline);
  const generateDisabledReason = !hasCreativeBrief ? '请先完成商品理解并生成 AI 创作理解。' : storyRegenerateLocked ? STORY_REGENERATE_LOCKED_TITLE : undefined;

  const handleRegenerate = () => {
    if (storyRegenerateLocked || !hasCreativeBrief) return;
    void generate();
  };

  const displayName = workflowNavProjectName({
    pipelineProjectName: pipeline?.project?.project_name,
    sessionProjectName: projectName,
  });

  const leftRails = useMemo(() => buildStoryBlueprintLeftRailsFromPipeline(pipeline), [pipeline]);

  const rightAnalysis = useMemo(() => deriveStoryStructureAnalysis(pipeline), [pipeline]);
  const overallEval = useMemo(() => deriveStoryBlueprintOverallEval(pipeline), [pipeline]);

  const missingProject = projectId == null;

  const reloadBlueprintFromPipeline = () => {
    const raw = pipeline?.story_blueprint?.blueprint;
    if (!raw) return;
    const vm = storyBlueprintDtoToPageView(raw);
    setScript(vm.script);
    setSegments(vm.segments);
    setProduction(vm.production);
    setIsDirty(false);
  };

  const handleCancelEdit = () => {
    reloadBlueprintFromPipeline();
    setIsEditing(null);
  };

  const handleSegmentFieldChange = (segId: number, label: string, value: string) => {
    const fieldMap: Record<string, keyof StoryBlueprintPageSegmentVm | 'expectedAssetsJoin'> = {
      段落目标: 'goal',
      段落概要: 'synopsis',
      产品露出: 'productPlacement',
      情绪状态: 'emotionalState',
      关键信息: 'keyMessage',
      段落职责: 'segmentRole',
      画面需求: 'visualRequirement',
      所需视觉元素: 'expectedAssetsJoin',
      '转场到下一段': 'transitionToNext',
    };
    const key = fieldMap[label];
    if (!key) return;
    setSegments((prev) =>
      prev.map((seg) => {
        if (seg.id !== segId) return seg;
        if (key === 'expectedAssetsJoin') {
          const expectedAssets = value.split(/[、,，]/).map((s) => s.trim()).filter(Boolean);
          return {
            ...seg,
            expectedAssets,
            visualElementsSummary: expectedAssets.length ? expectedAssets.join('、') : '—',
          };
        }
        return { ...seg, [key]: value };
      }),
    );
    setIsDirty(true);
  };

  useEffect(() => {
    if (!pipeline || projectId == null) return;
    console.info('[FRONT_PROJECT_DATA_RESTORED]', { project_id: projectId, page: 'step_2' });
  }, [pipeline, projectId]);

  useEffect(() => {
    if (!step2Stale || projectId == null) return;
    console.info('[FRONT_STEP_STALE_BANNER_SHOWN]', { project_id: projectId, step: 'step_2' });
  }, [step2Stale, projectId]);

  useEffect(() => {
    console.info('[FRONT_DIRTY_STATE_CHANGED]', { project_id: projectId ?? null, step: 'step_2', dirty: isDirty });
  }, [isDirty, projectId]);

  const saveDraft = async (intent: 'save_draft' | 'before_exit'): Promise<boolean> => {
    if (projectId == null) return false;
    try {
      await touchShortDramaProjectStep(projectId, {
        step: 'step_2',
        save_intent: intent === 'before_exit' ? 'before_exit' : 'save_draft',
      });
      setIsDirty(false);
      return true;
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '保存失败，请稍后重试');
      return false;
    }
  };

  const baseScriptFields: Array<{ key: 'title' | 'summary'; label: string; icon: string }> = [
    { key: 'title', label: '剧集标题', icon: 'ri-movie-2-line' },
    { key: 'summary', label: '创作摘要', icon: 'ri-file-text-line' },
  ];
  const visibleBaseScriptFields = baseScriptFields.filter((field) => hasDisplayValue(script[field.key]));
  const showTitleInEpisodeCard = visibleBaseScriptFields.some((f) => f.key === 'title');
  const showSummaryInEpisodeCard = visibleBaseScriptFields.some((f) => f.key === 'summary');
  const showUnifiedEpisodeCard = hasBlueprint && (showTitleInEpisodeCard || showSummaryInEpisodeCard);

  return (
    <div className="min-h-screen" style={{ background: '#F7F7F8', fontFamily: "'Inter', sans-serif" }}>
      <SDWorkflowNav
        currentStep={2}
        projectName={displayName}
        projectId={projectId}
        isDirty={isDirty}
        onSaveDraft={saveDraft}
      />
      <div className="flex min-h-screen pt-14">
        <StoryBlueprintLeftRail
          settings={leftRails.settings}
          metaRows={leftRails.metaRows}
          globalFields={leftRails.globalFields}
          inputSources={leftRails.inputSources}
        />

        <main className="min-h-0 flex-1 overflow-y-auto p-6 lg:p-8">
          {missingProject ? (
            <div
              className="mb-6 overflow-hidden rounded-2xl px-6 py-5 text-[13px]"
              role="alert"
              style={{ background: '#FFFBEB', border: '1px solid #fde68a', color: '#92400e' }}
            >
              <p className="font-semibold">{SHORT_DRAMA_UI.productInput.missingTitle}</p>
              <p className="mt-1 opacity-90">{SHORT_DRAMA_UI.noProject.body}</p>
              <button
                type="button"
                onClick={() => navigate('/short-drama/create')}
                className="mt-3 rounded-xl px-5 py-2.5 text-[12.5px] font-semibold text-white transition-colors"
                style={{ background: '#1D1D1F' }}
              >
                {SHORT_DRAMA_UI.noProject.cta}
              </button>
            </div>
          ) : null}

          {!missingProject && pipelineLoading ? (
            <div
              className="mb-4 flex items-center gap-2 rounded-xl border border-[#EAEAEA] px-4 py-3 text-[13px]"
              style={{ background: '#FAFAFA', color: '#8E8E93' }}
            >
              <i className={ri('ri-loader-4-line animate-spin text-[16px] text-[#1D1D1F]')} aria-hidden />
              {SHORT_DRAMA_UI.storyPage.loadingPipeline}
            </div>
          ) : null}

          {step2Stale && hasBlueprint && !staleBannerDismissed ? (
            <div
              className="mb-5 flex items-center gap-3 rounded-xl px-4 py-3"
              style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e' }}
            >
              <i className={ri('ri-error-warning-line text-[14px] shrink-0')} aria-hidden />
              <div className="flex-1 text-[12px]">
                创作意图或商品理解已更新，当前剧本可能已过期。建议重新生成以获取最新结果。
              </div>
              <button
                type="button"
                onClick={() => void handleRegenerate()}
                className="cursor-pointer whitespace-nowrap text-[11px] font-semibold underline underline-offset-2"
              >
                重新生成
              </button>
              <button
                type="button"
                onClick={() => setStaleBannerDismissed(true)}
                className="flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center"
                style={{ color: '#B45309' }}
                aria-label="关闭提示"
              >
                <i className={ri('ri-close-line text-[13px]')} aria-hidden />
              </button>
            </div>
          ) : null}

          {!missingProject && pipelineError ? (
            <div
              className="mb-4 flex flex-col items-center rounded-2xl border border-red-200 bg-red-50 px-6 py-8 text-center text-[13px] text-red-800"
              role="alert"
            >
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FEF2F2]">
                <i className={ri('ri-error-warning-line text-[24px] text-[#DC2626]')} aria-hidden />
              </div>
              <p>{pipelineError}</p>
            </div>
          ) : null}

          {!missingProject && generateError ? (
            <div
              className="mb-4 flex flex-col items-center rounded-2xl border border-red-200 bg-red-50 px-6 py-8 text-center text-[13px] text-red-800"
              role="alert"
            >
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FEF2F2]">
                <i className={ri('ri-error-warning-line text-[24px] text-[#DC2626]')} aria-hidden />
              </div>
              <p>{generateError}</p>
            </div>
          ) : null}

          {!missingProject && !pipelineLoading && !hasBlueprint ? (
            <div
              className="mb-6 flex flex-col items-center rounded-2xl px-8 py-10 text-center text-[13px]"
              style={{ border: '1px dashed #EAEAEA', background: '#FAFAFA', color: '#444444' }}
            >
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F5F5F7]">
                <i className={ri('ri-file-text-line text-[24px] text-[#AEAEB2]')} aria-hidden />
              </div>
              <p className="font-semibold text-[#1D1D1F]">尚未生成剧本</p>
              <p className="mt-2 text-[#8E8E93]">当前还没有剧本大纲，请先生成。</p>
              {!hasCreativeBrief ? (
                <p className="mt-4 max-w-md rounded-xl border px-4 py-2.5 text-[12.5px]" style={{ borderColor: '#fde68a', background: '#FFFBEB', color: '#92400e' }}>
                  请先完成商品理解并生成 AI 创作理解。
                </p>
              ) : null}
              <button
                type="button"
                onClick={() => void generate()}
                disabled={generateLoading || storyRegenerateLocked || !hasCreativeBrief}
                title={generateDisabledReason}
                className="mt-6 flex cursor-pointer items-center gap-2 rounded-xl px-6 py-3 text-[13.5px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                style={{ background: '#1D1D1F' }}
              >
                {generateLoading ? (
                  <i className={ri('ri-loader-4-line animate-spin')} aria-hidden />
                ) : (
                  <i className={ri('ri-sparkling-2-line')} aria-hidden />
                )}
                {generateLoading ? SHORT_DRAMA_UI.storyPage.generating : SHORT_DRAMA_UI.storyPage.generateCta}
              </button>
            </div>
          ) : null}

          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#AEAEB2' }}>
                STEP 02
              </span>
              <h1 className="mt-0.5 text-[22px] font-black" style={{ fontFamily: "'Syne', sans-serif", color: sdColors.ink }}>
                剧本生成
              </h1>
              <p className="mt-1 max-w-xl text-[12.5px]" style={{ color: '#8E8E93' }}>
                AI 已根据创作意图与商品理解生成短剧生产蓝图，确认后将进入资产管理。
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              {isEditing === 'all' ? (
                <>
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg px-4 py-2 text-[12.5px] font-medium transition-colors"
                    style={{ background: '#F7F8FA', color: '#444444', border: '1px solid #EAEAEA' }}
                  >
                    <i className={ri('ri-close-line text-[12px]')} aria-hidden />
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditing(null)}
                    className="flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg px-4 py-2 text-[12.5px] font-medium text-white transition-colors"
                    style={{ background: '#1D1D1F' }}
                  >
                    <i className={ri('ri-save-line text-[12px]')} aria-hidden />
                    保存修改
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleRegenerate}
                    disabled={generateLoading || missingProject || !hasBlueprint || storyRegenerateLocked || !hasCreativeBrief}
                    title={generateDisabledReason}
                    className="flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-[12.5px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                    style={{
                      background: '#ffffff',
                      color: '#444444',
                      border: '1px solid #EAEAEA',
                      opacity: generateLoading ? 0.85 : 1,
                    }}
                  >
                    <i
                      className={ri(generateLoading ? 'ri-loader-4-line animate-spin' : 'ri-refresh-line', 'text-[12px]')}
                      aria-hidden
                    />
                    {generateLoading ? '生成中…' : '重新生成'}
                  </button>
                  {hasBlueprint ? (
                    <button
                      type="button"
                      onClick={() => setIsEditing('all')}
                      disabled={generateLoading}
                      className="flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg border border-[#EAEAEA] px-4 py-2 text-[12.5px] font-medium transition-colors disabled:opacity-60"
                      style={{ background: '#ffffff', color: '#444444', border: '1px solid #EAEAEA' }}
                    >
                      <i className={ri('ri-edit-line text-[12px]')} aria-hidden />
                      手动编辑
                    </button>
                  ) : null}
                </>
              )}
            </div>
          </div>

          {isEditing === 'all' && hasBlueprint ? (
            <div
              className="mb-5 flex items-center gap-2 rounded-xl px-4 py-2.5 text-[12px]"
              style={{ background: '#FFFBEB', border: '1px solid #fde68a', color: '#92400e' }}
            >
              <i className={ri('ri-edit-circle-line')} aria-hidden />
              <span>当前处于手动编辑模式。修改完成后点击「保存修改」，或点击「取消」放弃更改（保存项目见顶栏）。</span>
            </div>
          ) : null}

          {creativeBlueprintV2Debug ? (
            <details className="mb-6 rounded-xl border border-dashed border-[#C7C7CC] bg-[#FAFAFA] px-4 py-3 text-[12.5px] text-[#444444]">
              <summary className="cursor-pointer select-none font-semibold text-[#1D1D1F]">Creative Blueprint v2（调试）</summary>
              <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-[#8E8E93]">blueprint_schema_version</dt>
                  <dd className="font-mono text-[12px] text-[#1D1D1F]">{creativeBlueprintV2Debug.version}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-[#8E8E93]">characters</dt>
                  <dd>{creativeBlueprintV2Debug.characters}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-[#8E8E93]">scenes</dt>
                  <dd>{creativeBlueprintV2Debug.scenes}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-[#8E8E93]">product_assets</dt>
                  <dd>{creativeBlueprintV2Debug.product_assets}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-[#8E8E93]">asset_generation_specs</dt>
                  <dd>{creativeBlueprintV2Debug.asset_generation_specs}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-[#8E8E93]">video_generation_specs</dt>
                  <dd>{creativeBlueprintV2Debug.video_generation_specs}</dd>
                </div>
              </dl>
            </details>
          ) : null}

          {hasBlueprint ? (
            generateLoading ? (
              <StoryBlueprintSkeleton />
            ) : (
            <>
              <StoryBlueprintAnchorNav />

              <StoryBlueprintSectionDivider
                id="layer-1"
                layer={1}
                title="故事理解"
                desc="剧本结构 · 叙事节奏 · 剧集摘要 · 故事节拍"
                icon="ri-book-open-line"
              />
              <StoryBlueprintStructureSection
                structureType={script.scriptStructureType}
                structureRhythm={script.structureRhythm}
                designReason={script.structureReason}
              />

              {showUnifiedEpisodeCard ? (
                <CollapsibleBlueprintCard
                  className="mb-1"
                  title={showTitleInEpisodeCard ? script.title || '剧集标题' : '创作摘要'}
                  badge="剧集信息"
                  summary={showSummaryInEpisodeCard ? truncateBlueprintSummary(script.summary, 96) : undefined}
                  accentColor="#1D1D1F"
                >
                  {showTitleInEpisodeCard ? (
                    <div className="mb-4">
                      <div className="mb-2 flex items-start justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <div className="flex h-5 w-5 items-center justify-center rounded-md bg-[#F5F5F7]">
                            <i className={ri('ri-movie-2-line text-[11px] text-[#8E8E93]')} aria-hidden />
                          </div>
                          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#AEAEB2' }}>
                            剧集标题
                          </span>
                        </div>
                        {isEditing !== 'all' ? (
                        <button
                          type="button"
                          onClick={() => setIsEditing(isEditing === 'title' ? null : 'title')}
                          className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md transition-colors"
                          style={{
                            color: isEditing === 'title' ? '#1D1D1F' : '#AEAEB2',
                            background: isEditing === 'title' ? '#F5F5F7' : 'transparent',
                          }}
                        >
                          <i className={ri('ri-edit-line text-[12px]')} aria-hidden />
                        </button>
                        ) : null}
                      </div>
                      {isEditing === 'title' || isEditing === 'all' ? (
                        <textarea
                          value={script.title}
                          onChange={(e) => {
                            setScript((prev) => ({ ...prev, title: e.target.value }));
                            setIsDirty(true);
                          }}
                          rows={1}
                          className="w-full resize-none rounded-xl px-3 py-2 text-[20px] font-black outline-none"
                          style={{
                            background: '#F7F8FA',
                            border: '1px solid #EAEAEA',
                            color: '#1D1D1F',
                            fontFamily: "'Syne', sans-serif",
                          }}
                        />
                      ) : (
                        <h2 className="text-[22px] font-black leading-tight" style={{ ...sdFontHeading, color: sdColors.ink }}>
                          {script.title}
                        </h2>
                      )}
                    </div>
                  ) : null}
                  {showSummaryInEpisodeCard ? (
                    <div>
                      <div className="mb-2 flex items-start justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <div className="flex h-5 w-5 items-center justify-center rounded-md bg-[#F0F0F0]">
                            <i className={ri('ri-file-text-line text-[11px] text-[#8E8E93]')} aria-hidden />
                          </div>
                          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#AEAEB2' }}>
                            创作摘要
                          </span>
                        </div>
                        {isEditing !== 'all' ? (
                        <button
                          type="button"
                          onClick={() => setIsEditing(isEditing === 'summary' ? null : 'summary')}
                          className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md transition-colors"
                          style={{
                            color: isEditing === 'summary' ? '#1D1D1F' : '#AEAEB2',
                            background: isEditing === 'summary' ? '#F5F5F7' : 'transparent',
                          }}
                        >
                          <i className={ri('ri-edit-line text-[12px]')} aria-hidden />
                        </button>
                        ) : null}
                      </div>
                      {isEditing === 'summary' || isEditing === 'all' ? (
                        <textarea
                          value={script.summary}
                          onChange={(e) => {
                            setScript((prev) => ({ ...prev, summary: e.target.value }));
                            setIsDirty(true);
                          }}
                          rows={3}
                          className="w-full resize-none rounded-xl border border-[#EAEAEA] bg-white px-3 py-2 text-[13.5px] text-[#444444] outline-none"
                        />
                      ) : (
                        <p className="text-[13.5px] leading-relaxed text-[#444444]">{script.summary}</p>
                      )}
                    </div>
                  ) : null}
                </CollapsibleBlueprintCard>
              ) : null}

              <div
                className="mb-8 rounded-[20px] p-5"
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #EAE7E3',
                  boxShadow: '0 8px 24px rgba(16, 24, 40, 0.04)',
                }}
              >
                <StoryBlueprintBeatsSection
                  beatsSectionTitle={script.beatsSectionTitle}
                  usesStoryBeats={script.usesStoryBeats}
                  sections={script.sections}
                  isEditingAll={isEditing === 'all'}
                  onSectionContentChange={(idx, content) => {
                    setScript((prev) => ({
                      ...prev,
                      sections: prev.sections.map((item, itemIdx) => (itemIdx === idx ? { ...item, content } : item)),
                    }));
                    setIsDirty(true);
                  }}
                />
              </div>


              <StoryBlueprintSectionDivider
                id="layer-2"
                layer={2}
                title="执行分段"
                desc="可生产视频段落 · 默认摘要 + 展开完整字段"
                icon="ri-scissors-cut-line"
              />
              <div className="mb-8">
                <StoryBlueprintSegmentTimeline
                  segments={segments}
                  isEditingAll={isEditing === 'all'}
                  detailRowsFor={segmentDetailRows}
                  onSegmentFieldChange={handleSegmentFieldChange}
                  showSectionHeader
                />
              </div>

              <StoryBlueprintSectionDivider
                id="layer-3"
                layer={3}
                title="生产准备"
                desc="资产规格 · 视频规格 · 字幕策略 · 旁白对白"
                icon="ri-settings-4-line"
              />
              <StoryBlueprintProductionSection production={production} />
            </>
            )
          ) : null}


          {hasBlueprint && !generateLoading ? (
            <div
              className="mt-2 flex items-center justify-between border-t pt-6"
              style={{ borderTop: '1px solid #EAEAEA' }}
            >
              <button
                type="button"
                onClick={() => navigate(withProjectQuery('/short-drama/product-input', projectId))}
                className={workflowFooterPrevButtonClass}
              >
                <i className={ri('ri-arrow-left-line text-[13px]')} aria-hidden />
                <span>上一步：商品理解</span>
              </button>
              <button
                type="button"
                onClick={() => navigate(withProjectQuery('/short-drama/assets', projectId))}
                className={workflowFooterNextButtonClass}
              >
                <span>下一步：资产管理</span>
                <i className={ri('ri-arrow-right-line text-[13px]')} aria-hidden />
              </button>
            </div>
          ) : null}
        </main>

        <StoryBlueprintRightRail sections={rightAnalysis.sections} overallEval={overallEval} />
      </div>
    </div>
  );
}
