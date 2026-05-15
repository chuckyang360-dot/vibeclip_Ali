import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SDWorkflowNav } from './components/SDWorkflowNav';
import { StoryBlueprintLeftRail } from './components/StoryBlueprintLeftRail';
import { StoryBlueprintRightRail } from './components/StoryBlueprintRightRail';
import { useEffectiveShortDramaProjectId } from './hooks/useEffectiveShortDramaProjectId';
import { useStoryBlueprint } from './hooks/useStoryBlueprint';
import type { StoryBlueprintPageSegmentVm } from './utils/shortDramaAdapters';
import { storyBlueprintDtoToPageView } from './utils/shortDramaAdapters';
import {
  buildStoryBlueprintLeftRailsFromPipeline,
  deriveStoryStructureAnalysis,
  isStoryPipelineLockedForRegenerate,
  STORY_REGENERATE_LOCKED_TITLE,
} from './utils/storyBlueprintDerived';
import { SHORT_DRAMA_UI } from './utils/shortDramaUiCopy';
import { workflowNavProjectName } from './utils/workflowProjectName';
import { withProjectQuery } from './utils/shortDramaRoutes';
import { touchShortDramaProjectStep } from '@/services/shortDramaApi';

/** 本地调试 Creative Blueprint v2 摘要；正式与默认页面须保持 false。 */
const SHOW_CREATIVE_BLUEPRINT_DEBUG = false;

const EMPTY_VM = storyBlueprintDtoToPageView(null);

function hasDisplayValue(value: string | undefined | null): value is string {
  const text = String(value || '').trim();
  return Boolean(text && text !== '—');
}

function segmentDetailRows(seg: StoryBlueprintPageSegmentVm): Array<{ label: string; value: string; accent?: boolean; wide?: boolean }> {
  return [
    { label: '阶段名', value: seg.stageName },
    { label: '目标', value: seg.goal },
    { label: '产品露出', value: seg.productPlacement, accent: true },
    { label: '关键信息', value: seg.keyMessage },
    { label: '剧情概要', value: seg.synopsis },
    { label: '段落职责', value: seg.segmentRole },
    { label: '情绪状态', value: seg.emotionalState },
    { label: '预期资产', value: seg.expectedAssets.join('、') },
    { label: '转场到下一段', value: seg.transitionToNext, wide: true },
  ].filter((item) => hasDisplayValue(item.value));
}

/**
 * Framer `step2/page.tsx` 映射（布局 / 三栏 / 字段卡片 / Segment 折叠 / 交互位置一致）。
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
  const [editedSegment, setEditedSegment] = useState<number | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    const raw = pipeline?.story_blueprint?.blueprint;
    if (!raw) return;
    const vm = storyBlueprintDtoToPageView(raw);
    setScript(vm.script);
    setSegments(vm.segments);
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

  const missingProject = projectId == null;

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
    { key: 'title', label: '剧集标题', icon: 'ri-quill-pen-line' },
    { key: 'summary', label: '创作摘要', icon: 'ri-book-open-line' },
  ];
  const visibleBaseScriptFields = baseScriptFields.filter((field) => hasDisplayValue(script[field.key]));
  const structureCards = [
    { label: 'AI 选择的结构类型', value: script.scriptStructureType },
    { label: '结构节奏', value: script.structureRhythm },
  ].filter((item) => hasDisplayValue(item.value));

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "'Inter', sans-serif" }}>
      <SDWorkflowNav
        currentStep={2}
        projectName={displayName}
        projectId={projectId}
        isDirty={isDirty}
        onSaveDraft={saveDraft}
      />
      <div className="flex min-h-screen pt-14">
        <StoryBlueprintLeftRail settings={leftRails.settings} globalFields={leftRails.globalFields} />

        <main className="min-h-0 flex-1 overflow-y-auto p-6 lg:p-8">
          {missingProject ? (
            <div
              className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-[13px] text-amber-950"
              role="alert"
            >
              <p className="font-semibold">{SHORT_DRAMA_UI.productInput.missingTitle}</p>
              <p className="mt-1 text-amber-900/90">{SHORT_DRAMA_UI.noProject.body}</p>
              <button
                type="button"
                onClick={() => navigate('/short-drama/create')}
                className="mt-3 rounded-lg bg-amber-900 px-4 py-2 text-[12px] font-medium text-white"
              >
                {SHORT_DRAMA_UI.noProject.cta}
              </button>
            </div>
          ) : null}

          {!missingProject && pipelineLoading ? (
            <div className="mb-4 flex items-center gap-2 text-[13px] text-[#8E8E93]">
              <i className="ri-loader-4-line animate-spin text-[16px] text-[#1D1D1F]" aria-hidden />
              {SHORT_DRAMA_UI.storyPage.loadingPipeline}
            </div>
          ) : null}

          {step2Stale && hasBlueprint ? (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
              AI 创作理解已更新，当前剧本需要重新生成。
            </div>
          ) : null}

          {!missingProject && pipelineError ? (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800" role="alert">
              {pipelineError}
            </div>
          ) : null}

          {!missingProject && generateError ? (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800" role="alert">
              {generateError}
            </div>
          ) : null}

          {!missingProject && !pipelineLoading && !hasBlueprint ? (
            <div className="mb-6 rounded-2xl border border-[#EAEAEA] bg-[#F7F8FA] px-5 py-4 text-[13px] text-[#444444]">
              <p className="font-semibold text-[#1D1D1F]">尚未生成剧本</p>
              <p className="mt-1 text-[#8E8E93]">当前还没有剧本大纲，请先生成。</p>
              {!hasCreativeBrief ? (
                <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900">
                  请先完成商品理解并生成 AI 创作理解。
                </p>
              ) : null}
              <button
                type="button"
                onClick={() => void generate()}
                disabled={generateLoading || storyRegenerateLocked || !hasCreativeBrief}
                title={generateDisabledReason}
                className="mt-4 flex items-center gap-2 rounded-xl bg-[#1D1D1F] px-5 py-2.5 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {generateLoading ? (
                  <i className="ri-loader-4-line animate-spin text-[14px]" aria-hidden />
                ) : (
                  <i className="ri-sparkling-2-line text-[14px]" aria-hidden />
                )}
                {generateLoading ? SHORT_DRAMA_UI.storyPage.generating : SHORT_DRAMA_UI.storyPage.generateCta}
              </button>
            </div>
          ) : null}

          <div className="mb-6 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#8E8E93]">STEP 02</span>
              <h1 className="mt-0.5 text-2xl font-black text-[#1D1D1F]" style={{ fontFamily: "'Syne', sans-serif" }}>
                剧本大纲
              </h1>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleRegenerate}
                disabled={generateLoading || missingProject || !hasBlueprint || storyRegenerateLocked || !hasCreativeBrief}
                title={generateDisabledReason}
                className="flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg border border-[#EAEAEA] bg-[#F7F8FA] px-4 py-2 text-[12.5px] font-medium text-[#444444] transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60"
                onMouseEnter={(e) => {
                  if (!generateLoading && hasBlueprint && !storyRegenerateLocked && hasCreativeBrief)
                    (e.currentTarget as HTMLButtonElement).style.background = '#EAEAEA';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = '#F7F8FA';
                }}
              >
                <i
                  className={`${generateLoading ? 'ri-loader-4-line animate-spin' : 'ri-refresh-line'} text-[12px]`}
                  aria-hidden
                />
                重新生成
              </button>
              {hasBlueprint ? (
              <button
                type="button"
                onClick={() => setIsEditing(isEditing ? null : 'all')}
                className="flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg border border-[#EAEAEA] px-4 py-2 text-[12.5px] font-medium transition-all duration-200"
                style={{
                  background: isEditing ? '#1D1D1F' : '#F7F8FA',
                  color: isEditing ? '#ffffff' : '#444444',
                }}
                onMouseEnter={(e) => {
                  if (!isEditing) (e.currentTarget as HTMLButtonElement).style.background = '#EAEAEA';
                }}
                onMouseLeave={(e) => {
                  if (!isEditing) (e.currentTarget as HTMLButtonElement).style.background = '#F7F8FA';
                }}
              >
                <i className="ri-edit-line text-[12px]" aria-hidden />
                手动编辑
              </button>
              ) : null}
            </div>
          </div>

          {creativeBlueprintV2Debug ? (
            <details className="mb-6 rounded-xl border border-dashed border-[#C7C7CC] bg-[#FAFAFA] px-4 py-3 text-[12.5px] text-[#444444]">
              <summary className="cursor-pointer select-none font-semibold text-[#1D1D1F]">
                Creative Blueprint v2（调试）
              </summary>
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
          <div className="mb-8 space-y-3">
            {structureCards.length ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {structureCards.map((item) => (
                <div key={item.label} className="rounded-2xl border border-[#EAEAEA] bg-white p-5">
                  <p className="mb-1 text-[12px] font-bold uppercase tracking-wider text-[#8E8E93]">{item.label}</p>
                  <p className="text-[14px] font-semibold text-[#1D1D1F]">{item.value}</p>
                </div>
              ))}
            </div>
            ) : null}
            {hasDisplayValue(script.structureReason) ? (
            <div className="rounded-2xl border border-[#EAEAEA] bg-white p-5">
              <p className="mb-1 text-[12px] font-bold uppercase tracking-wider text-[#8E8E93]">设计原因</p>
              <p className="text-[13.5px] leading-relaxed text-[#444444]">{script.structureReason}</p>
            </div>
            ) : null}
            {visibleBaseScriptFields.map((field) => (
              <div
                key={field.key}
                className="rounded-2xl p-5 transition-all duration-200"
                style={{
                  background: '#ffffff',
                  border: isEditing === field.key ? '1.5px solid #1D1D1F' : '1px solid #EAEAEA',
                }}
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#F5F5F7]">
                      <i className={`${field.icon} text-[12px] text-[#1D1D1F]`} aria-hidden />
                    </div>
                    <span className="text-[12px] font-bold uppercase tracking-wider text-[#8E8E93]">
                      {field.label}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsEditing(isEditing === field.key ? null : field.key)}
                    className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md transition-all duration-150 text-[#AEAEB2]"
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background = '#F5F5F7';
                      (e.currentTarget as HTMLButtonElement).style.color = '#1D1D1F';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                      (e.currentTarget as HTMLButtonElement).style.color = '#AEAEB2';
                    }}
                  >
                    <i className="ri-edit-line text-[12px]" aria-hidden />
                  </button>
                </div>
                {isEditing === field.key ? (
                  <textarea
                    value={script[field.key]}
                    onChange={(e) => {
                      setScript((prev) => ({ ...prev, [field.key]: e.target.value }));
                      setIsDirty(true);
                    }}
                    rows={field.key === 'title' ? 1 : 3}
                    className="w-full resize-none rounded-lg px-3 py-2.5 text-[13.5px] text-[#1D1D1F] outline-none transition-all"
                    style={{ background: '#F7F8FA', border: '1px solid #EAEAEA' }}
                  />
                ) : (
                  <p
                    className="leading-relaxed"
                    style={{
                      color: '#444444',
                      fontFamily: field.key === 'title' ? "'Syne', sans-serif" : "'Inter', sans-serif",
                      fontWeight: field.key === 'title' ? 800 : 400,
                      fontSize: field.key === 'title' ? '18px' : '13.5px',
                    }}
                  >
                    {script[field.key]}
                  </p>
                )}
              </div>
            ))}
            {script.sections.map((section, idx) => (
              <div
                key={section.key}
                className="rounded-2xl p-5 transition-all duration-200"
                style={{
                  background: '#ffffff',
                  border: isEditing === section.key ? '1.5px solid #1D1D1F' : '1px solid #EAEAEA',
                }}
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#F5F5F7]">
                      <i className={`${section.icon} text-[12px] text-[#1D1D1F]`} aria-hidden />
                    </div>
                    <span className="text-[12px] font-bold uppercase tracking-wider text-[#8E8E93]">{section.label}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsEditing(isEditing === section.key ? null : section.key)}
                    className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md transition-all duration-150 text-[#AEAEB2]"
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background = '#F5F5F7';
                      (e.currentTarget as HTMLButtonElement).style.color = '#1D1D1F';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                      (e.currentTarget as HTMLButtonElement).style.color = '#AEAEB2';
                    }}
                  >
                    <i className="ri-edit-line text-[12px]" aria-hidden />
                  </button>
                </div>
                {isEditing === section.key ? (
                  <textarea
                    value={section.content}
                    onChange={(e) => {
                      const nextContent = e.target.value;
                      setScript((prev) => ({
                        ...prev,
                        sections: prev.sections.map((item, itemIdx) =>
                          itemIdx === idx ? { ...item, content: nextContent } : item,
                        ),
                      }));
                      setIsDirty(true);
                    }}
                    rows={3}
                    className="w-full resize-none rounded-lg px-3 py-2.5 text-[13.5px] text-[#1D1D1F] outline-none transition-all"
                    style={{ background: '#F7F8FA', border: '1px solid #EAEAEA' }}
                  />
                ) : (
                  <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-[#444444]">{section.content}</p>
                )}
              </div>
            ))}
          </div>
          ) : null}

          {hasBlueprint && segments.length ? (
          <div className="mb-8">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-5 w-5 items-center justify-center rounded-md bg-[#F5F5F7]">
                <i className="ri-layout-row-line text-[12px] text-[#1D1D1F]" aria-hidden />
              </div>
              <h3 className="text-[13px] font-bold uppercase tracking-wider text-[#444444]">段落计划</h3>
            </div>
            <div className="space-y-3">
              {segments.map((seg) => (
                <div
                  key={seg.id}
                  role="button"
                  tabIndex={0}
                  className="cursor-pointer rounded-2xl p-5 transition-all duration-200"
                  style={{
                    background: '#ffffff',
                    border: editedSegment === seg.id ? `1.5px solid ${seg.color}40` : '1px solid #EAEAEA',
                    boxShadow: editedSegment === seg.id ? `0 2px 12px ${seg.color}10` : 'none',
                  }}
                  onClick={() => setEditedSegment(editedSegment === seg.id ? null : seg.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ')
                      setEditedSegment(editedSegment === seg.id ? null : seg.id);
                  }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[12px] font-bold"
                        style={{ background: `${seg.color}10`, color: seg.color }}
                      >
                        S{seg.id}
                      </div>
                      <div>
                        <span className="text-[14px] font-bold text-[#1D1D1F]">{seg.name}</span>
                        {hasDisplayValue(seg.stageName) ? (
                          <span className="ml-2 rounded-full bg-[#F5F5F7] px-2 py-0.5 text-[10px] text-[#6E6E73]">{seg.stageName}</span>
                        ) : null}
                        {hasDisplayValue(seg.duration) ? (
                          <span className="ml-2 text-[11px] text-[#8E8E93]">{seg.duration}</span>
                        ) : null}
                      </div>
                    </div>
                    <i
                      className={editedSegment === seg.id ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'}
                      style={{ color: '#AEAEB2' }}
                      aria-hidden
                    />
                  </div>
                  {editedSegment === seg.id ? (
                    <div className="mt-4 grid grid-cols-2 gap-3 text-[12px] lg:grid-cols-3">
                      {segmentDetailRows(seg).map((item) => (
                        <div key={`${seg.id}-${item.label}`} className={item.wide ? 'lg:col-span-3' : undefined}>
                          <p className="mb-1 text-[#8E8E93]">{item.label}</p>
                          <p className={item.accent ? 'font-semibold' : 'leading-snug text-[#444444]'} style={item.accent ? { color: seg.color } : undefined}>
                            {item.value}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
          ) : null}

          {hasBlueprint ? (
          <div className="flex items-center justify-between pt-6" style={{ borderTop: '1px solid #EAEAEA' }}>
            <button
              type="button"
              onClick={() => navigate(withProjectQuery('/short-drama/product-input', projectId))}
              className="flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-xl border border-[#EAEAEA] bg-[#F7F8FA] px-5 py-3 text-[13.5px] text-[#444444] transition-all duration-200"
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = '#EAEAEA';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = '#F7F8FA';
              }}
            >
              <i className="ri-arrow-left-line text-[13px]" aria-hidden />
              上一步
            </button>
            <button
              type="button"
              onClick={() => navigate(withProjectQuery('/short-drama/assets', projectId))}
              className="flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-xl bg-[#1D1D1F] px-7 py-3 text-[14px] font-semibold text-white transition-all duration-200"
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = '#374151';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = '#1D1D1F';
              }}
            >
              确认进入角色和场景
              <i className="ri-arrow-right-line text-[13px]" aria-hidden />
            </button>
          </div>
          ) : null}
        </main>

        <StoryBlueprintRightRail
          sections={rightAnalysis.sections}
        />
      </div>
    </div>
  );
}
