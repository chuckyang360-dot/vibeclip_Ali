import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProductInputForm } from './components/ProductInputForm';
import { ReparseStrategyDialog } from './components/ReparseStrategyDialog';
import { SDWorkflowNav } from './components/SDWorkflowNav';
import { useEffectiveShortDramaProjectId } from './hooks/useEffectiveShortDramaProjectId';
import { useProductParse } from './hooks/useProductParse';
import { getShortDramaPipeline, getShortDramaProject, touchShortDramaProjectStep, updateShortDramaProductContext } from '@/services/shortDramaApi';
import type { ProductInputDraft, ProductPreviewSummary } from '@/types/shortDrama';
import type { ProductImageUnderstandingDto } from '@/types/shortDramaApi';
import {
  buildNeedsAttentionMessages,
  normalizeImageUnderstanding,
  sanitizeAvoidIssueLine,
  sanitizePreviewForConfirm,
} from './utils/productUnderstandingDisplay';
import {
  mapDraftToProductInputPayload,
  normalizedJsonToProductPreview,
  pipelineRawInputsToDraft,
  previewToProductContextPayload,
} from './utils/shortDramaAdapters';
import { SHORT_DRAMA_UI } from './utils/shortDramaUiCopy';
import { ri, sdColors, sdFontHeading } from './utils/shortDramaHelpers';
import { withProjectQuery } from './utils/shortDramaRoutes';
import { touchProjectNameFromPipeline } from './utils/shortDramaStorage';
import { workflowNavProjectName } from './utils/workflowProjectName';
import { getUserFriendlyParseError, normalizeProductParseError } from './utils/productParseErrors';
import { getCachedShortDramaPipeline, setCachedShortDramaPipeline } from './utils/shortDramaPipelineCache';
import {
  PRODUCT_PARSE_UPSTREAM_UNAVAILABLE_MESSAGE,
  PRODUCT_PARSE_UPSTREAM_UNAVAILABLE_TITLE,
} from './utils/productParseErrors';

const emptyDraft: ProductInputDraft = {
  productNameRaw: '',
  productCategoryRaw: '',
  brandRaw: '',
  priceRaw: '',
  targetUsersRaw: '',
  sellingPointsRaw: [],
  usageScenariosRaw: [],
  extraNotesRaw: '',
  productImages: [],
};

const idlePreview: ProductPreviewSummary = {
  productName: '',
  productCategory: '',
  brandName: '',
  productSummary: '',
  coreSellingPoints: [],
  targetUsers: [],
  usageScenarios: [],
  visualFeatures: [],
  productForm: '',
  keyFunctions: [],
  emotionalValue: [],
  suitableStoryAngles: [],
  userPainPoints: [],
  visualRiskNotes: [],
  consistencyNotes: [],
  immutableStructureConstraints: [],
  extractedFromImages: [],
  parseConfidence: 0,
  sourceTrace: {},
  fieldMeta: {},
  status: 'idle',
};

const fieldInputCls =
  'w-full rounded-lg border border-[#EAEAEA] bg-[#F7F8FA] px-3 py-2 text-[13px] outline-none transition-colors focus:border-[#1D1D1F] focus:bg-white';

function touchFieldMeta(): { edited_by_user: true; edited_at: string } {
  return { edited_by_user: true, edited_at: new Date().toISOString() };
}

function ChipField({
  label,
  values,
  onChange,
  placeholder,
}: {
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
}) {
  const [pending, setPending] = useState('');
  const add = () => {
    const t = pending.trim();
    if (!t) return;
    onChange([...values, t]);
    setPending('');
  };
  return (
    <div>
      {label ? <div className="mb-1.5 text-[12px] font-medium text-[#6E6E73]">{label}</div> : null}
      <div className="mb-2 flex min-h-[32px] flex-wrap gap-2">
        {values.map((x, idx) => (
          <span
            key={`${idx}-${x.slice(0, 24)}`}
            className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[#E5E5EA] bg-[#F5F5F7] px-3 py-1 text-[12px] text-[#1D1D1F]"
          >
            <span className="truncate">{x}</span>
            <button
              type="button"
              className="shrink-0 text-[#8E8E93] hover:text-[#B91C1C]"
              onClick={() => onChange(values.filter((_, i) => i !== idx))}
              aria-label="删除"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          className={fieldInputCls}
          value={pending}
          onChange={(e) => setPending(e.target.value)}
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
        />
        <button
          type="button"
          className="shrink-0 rounded-lg border border-[#EAEAEA] bg-[#F5F5F7] px-3 py-2 text-[12px] font-medium text-[#444444] hover:bg-[#1D1D1F] hover:text-white"
          onClick={add}
        >
          添加
        </button>
      </div>
    </div>
  );
}

export function ShortDramaProductInputPage() {
  const navigate = useNavigate();
  const { effectiveProjectId: projectId, projectName, refreshSession } = useEffectiveShortDramaProjectId();
  const { parseSafe } = useProductParse();
  const [draft, setDraft] = useState<ProductInputDraft>(emptyDraft);
  const [preview, setPreview] = useState<ProductPreviewSummary>(idlePreview);
  const [isParsing, setIsParsing] = useState(false);
  const [isRawDirty, setIsRawDirty] = useState(false);
  const [isParsedDirty, setIsParsedDirty] = useState(false);
  const [parseVersion, setParseVersion] = useState(0);
  const [pipelineLoading, setPipelineLoading] = useState(false);
  const [navTitle, setNavTitle] = useState<string | null>(null);
  const [isReparseDialogOpen, setIsReparseDialogOpen] = useState(false);
  const [lastParseError, setLastParseError] = useState<string | null>(null);
  const [isServiceUnavailableDialogOpen, setIsServiceUnavailableDialogOpen] = useState(false);
  const [imageUnderstanding, setImageUnderstanding] = useState<ProductImageUnderstandingDto | null>(null);
  const [showAvoidIssuesEditor, setShowAvoidIssuesEditor] = useState(false);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    if (projectId == null) return;
    let cancelled = false;
    void (async () => {
      try {
        const p = await getShortDramaProject(projectId);
        if (!cancelled) {
          setNavTitle(p.project_name);
          touchProjectNameFromPipeline(projectId, p.project_name);
        }
      } catch {
        if (!cancelled) setNavTitle(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    if (projectId == null) return;
    let cancelled = false;
    const hydrateFromPipeline = (pipe: Awaited<ReturnType<typeof getShortDramaPipeline>>) => {
      const pc = pipe.product_context;
      let draftForSanitize: ProductInputDraft = emptyDraft;
      if (pc?.raw_inputs) {
        const d = pipelineRawInputsToDraft(pc.raw_inputs);
        if (d) {
          setDraft(d);
          draftForSanitize = d;
        }
      }
      const iu = normalizeImageUnderstanding(pc?.image_understanding) ?? null;
      setImageUnderstanding(iu);
      if (pc?.normalized) {
        const p = normalizedJsonToProductPreview(pc.normalized);
        if (p) setPreview(sanitizePreviewForConfirm(p, iu, draftForSanitize));
      }
      if (typeof pc?.version === 'number') setParseVersion(pc.version);
    };
    const cached = getCachedShortDramaPipeline(projectId);
    if (cached) {
      console.info('[CACHE_PIPELINE_HIT]', { projectId, sourcePage: 'step1' });
      hydrateFromPipeline(cached);
      setPipelineLoading(false);
    } else {
      console.info('[CACHE_PIPELINE_MISS]', { projectId, sourcePage: 'step1' });
      setPipelineLoading(true);
    }
    void (async () => {
      try {
        const startedAt = performance.now();
        const pipe = await getShortDramaPipeline(projectId);
        if (cancelled) return;
        setCachedShortDramaPipeline(projectId, pipe);
        hydrateFromPipeline(pipe);
        console.info('[CACHE_PIPELINE_REFRESH_SUCCESS]', {
          projectId,
          sourcePage: 'step1',
          durationMs: Math.round(performance.now() - startedAt),
        });
      } catch (e) {
        console.warn('[CACHE_PIPELINE_REFRESH_ERROR]', {
          projectId,
          sourcePage: 'step1',
          error: e instanceof Error ? e.message : String(e),
        });
      } finally {
        if (!cancelled && !cached) setPipelineLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const parseDirty = isRawDirty && preview.status === 'ready';
  const hasUserEditedParsedFields = Object.values(preview.fieldMeta || {}).some((m) => Boolean(m?.edited_by_user));
  const missingProject = projectId == null;
  const canGoStoryStep = !missingProject && preview.status === 'ready';
  const displayName = workflowNavProjectName({ fetchedProjectName: navTitle, sessionProjectName: projectName });
  const friendlyParseError = lastParseError ? getUserFriendlyParseError(lastParseError) : null;
  const needsAttention = useMemo(
    () => (preview.status === 'ready' ? buildNeedsAttentionMessages(imageUnderstanding, draft, preview) : []),
    [preview, draft, imageUnderstanding],
  );
  const safeAvoidIssues = useMemo(
    () => (preview.visualRiskNotes ?? []).map((x) => sanitizeAvoidIssueLine(x)).filter(Boolean),
    [preview.visualRiskNotes],
  );
  const shouldShowAvoidIssues = safeAvoidIssues.length > 0 || showAvoidIssuesEditor;

  const runParse = async (mode: 'replace_all' | 'preserve_user_edited') => {
    if (projectId == null) return;
    console.info('[S1_PARSE_CLICK_PAYLOAD]', {
      project_id: projectId,
      reparse_mode: mode,
      payload: mapDraftToProductInputPayload(draft),
    });
    setIsParsing(true);
    setPreview((p) => ({ ...p, status: 'parsing', errorMessage: undefined }));
    const result = await parseSafe(projectId, draft, mode);
    const next = result.preview;
    if (next.status === 'ready') {
      const iu = result.imageUnderstanding ?? null;
      setImageUnderstanding(iu);
      setPreview(sanitizePreviewForConfirm(next, iu, draft));
      setLastParseError(null);
      setIsServiceUnavailableDialogOpen(false);
    } else {
      setPreview(next);
      setImageUnderstanding(null);
      const normalized = normalizeProductParseError(next.errorMessage || '产品解析失败，请检查输入内容或稍后重试。');
      if (normalized === PRODUCT_PARSE_UPSTREAM_UNAVAILABLE_MESSAGE) {
        console.warn('[S1_PARSE_UPSTREAM_UNAVAILABLE_UI]', { project_id: projectId, raw_error: next.errorMessage || '' });
        setIsServiceUnavailableDialogOpen(true);
        setLastParseError(null);
      } else {
        setLastParseError(normalized);
        setIsServiceUnavailableDialogOpen(false);
      }
    }
    setIsParsing(false);
    setIsReparseDialogOpen(false);
    if (next.status === 'ready') {
      setIsRawDirty(false);
      setIsParsedDirty(false);
      setParseVersion((v) => v + 1);
    }
  };

  const handleParse = async () => {
    if (projectId == null) return;
    if (isRawDirty && hasUserEditedParsedFields) {
      setIsReparseDialogOpen(true);
      return;
    }
    await runParse('replace_all');
  };

  const persistEditedContextIfNeeded = async () => {
    if (projectId == null || preview.status !== 'ready' || !isParsedDirty) return;
    const iu = imageUnderstanding;
    const d = draft;
    const saved = await updateShortDramaProductContext(projectId, previewToProductContextPayload(preview));
    const parsed = normalizedJsonToProductPreview(saved.product_context);
    if (parsed) setPreview(sanitizePreviewForConfirm(parsed, iu, d));
    setParseVersion(saved.version);
    setIsParsedDirty(false);
  };

  const saveDraft = async (intent: 'save_draft' | 'before_exit'): Promise<boolean> => {
    if (projectId == null) return false;
    const nextResult = await parseSafe(projectId, draft, 'replace_all');
    const next = nextResult.preview;
    if (next.status !== 'ready') {
      setImageUnderstanding(null);
      const normalized = normalizeProductParseError(next.errorMessage || '产品解析失败，请检查输入内容或稍后重试。');
      if (normalized === PRODUCT_PARSE_UPSTREAM_UNAVAILABLE_MESSAGE) {
        console.warn('[S1_SAVE_DRAFT_PARSE_UNAVAILABLE]', { project_id: projectId, raw_error: next.errorMessage || '' });
        setIsServiceUnavailableDialogOpen(true);
        setLastParseError(null);
      } else {
        setLastParseError(normalized);
      }
      return false;
    }
    const iu = nextResult.imageUnderstanding ?? null;
    setImageUnderstanding(iu);
    setPreview(sanitizePreviewForConfirm(next, iu, draft));
    await persistEditedContextIfNeeded();
    await touchShortDramaProjectStep(projectId, { step: 'step_1', save_intent: intent === 'before_exit' ? 'before_exit' : 'save_draft' });
    setIsRawDirty(false);
    setIsParsedDirty(false);
    setLastParseError(null);
    setIsServiceUnavailableDialogOpen(false);
    return true;
  };

  return (
    <div className="min-h-screen bg-[#F7F8FA]" style={{ fontFamily: "'Inter', sans-serif" }}>
      <ReparseStrategyDialog
        open={isReparseDialogOpen}
        loading={isParsing}
        editedFieldCount={Object.values(preview.fieldMeta || {}).filter((m) => Boolean(m?.edited_by_user)).length}
        currentVersion={parseVersion}
        isRawDirty={isRawDirty}
        onClose={() => setIsReparseDialogOpen(false)}
        onReplaceAll={() => void runParse('replace_all')}
        onPreserveEdited={() => void runParse('preserve_user_edited')}
      />
      {isServiceUnavailableDialogOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/35 px-4">
          <div className="w-full max-w-md rounded-2xl border border-[#EAEAEA] bg-white p-5 shadow-xl">
            <h3 className="text-[17px] font-bold text-[#1D1D1F]">{PRODUCT_PARSE_UPSTREAM_UNAVAILABLE_TITLE}</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-[#6E6E73]">{PRODUCT_PARSE_UPSTREAM_UNAVAILABLE_MESSAGE}</p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsServiceUnavailableDialogOpen(false)}
                className="rounded-lg border border-[#EAEAEA] px-3.5 py-2 text-[12.5px]"
              >
                关闭
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsServiceUnavailableDialogOpen(false);
                  void handleParse();
                }}
                className="rounded-lg bg-[#1D1D1F] px-3.5 py-2 text-[12.5px] font-semibold text-white"
              >
                重新解析
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <SDWorkflowNav currentStep={1} projectName={displayName} projectId={projectId} isDirty={isRawDirty || isParsedDirty} onSaveDraft={saveDraft} />
      <div className="pt-14">
        <div className="mx-auto max-w-4xl px-6 py-10">
          <header className="mb-6">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#8E8E93]">STEP 01</span>
            <h1 className="mt-1 text-2xl font-black" style={{ ...sdFontHeading, color: sdColors.ink }}>商品信息</h1>
            <p className="mt-1 text-[13px] text-[#8E8E93]">填写并确认产品信息，用于生成剧本与视觉资产。</p>
          </header>

          {missingProject ? (
            <div className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-[13px] text-amber-950" role="alert">
              <p className="font-semibold">{SHORT_DRAMA_UI.productInput.missingTitle}</p>
              <p className="mt-1 text-amber-900/90">{SHORT_DRAMA_UI.productInput.missingBody}</p>
            </div>
          ) : pipelineLoading ? (
            <p className="mb-4 text-[12px] text-[#AEAEB2]">正在同步项目资料…</p>
          ) : null}

          <div className="mb-4 rounded-xl border border-[#EAEAEA] bg-white px-4 py-3 text-[12px] text-[#6E6E73]">
            {parseDirty ? <span className="text-[#B45309]">上方资料已变更，请重新点击「解析产品信息」后再核对确认区。</span> : null}
            {!parseDirty && preview.status !== 'ready' ? <span>填写原始输入后点击「解析产品信息」，即可在下方核对确认。</span> : null}
            {!parseDirty && preview.status === 'ready' ? <span>请核对下方「产品信息确认」是否准确。</span> : null}
            {isParsedDirty ? <span className="ml-2 text-[#0F766E]">确认区内容已修改</span> : null}
          </div>

          <h2 className="mb-3 text-[15px] font-bold text-[#1D1D1F]">原始输入</h2>
          <ProductInputForm draft={draft} setDraft={(updater) => { setDraft(updater); setIsRawDirty(true); }} />

          <div className="mt-8 flex justify-center">
            <button type="button" onClick={() => void handleParse()} disabled={isParsing || missingProject} className="flex items-center justify-center gap-2 rounded-xl px-8 py-3.5 text-[14px] font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:bg-[#F5F5F7] disabled:text-[#8E8E93]" style={{ background: isParsing || missingProject ? undefined : sdColors.ink }}>
              <i className={ri(isParsing ? 'ri-loader-4-line' : 'ri-sparkling-2-line', isParsing ? 'animate-spin text-[14px]' : 'text-[14px]')} aria-hidden />
              {isParsing ? '解析中…' : '解析产品信息'}
            </button>
          </div>
          {friendlyParseError ? (
            <div className="mt-3 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-3 text-[12px] text-[#B91C1C]">
              {friendlyParseError.title ? (
                <p className="font-semibold">{friendlyParseError.title}</p>
              ) : (
                <p>解析失败：{friendlyParseError.message}</p>
              )}
              {friendlyParseError.title ? (
                <p className="mt-1 leading-relaxed">{friendlyParseError.message}</p>
              ) : null}
              {friendlyParseError.suggestions?.length ? (
                <ol className="mt-2 list-decimal space-y-1 pl-5">
                  {friendlyParseError.suggestions.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ol>
              ) : null}
            </div>
          ) : null}

          <section className="mt-10 rounded-2xl border border-[#EAEAEA] bg-white p-6 shadow-sm">
            <h2 className="text-[17px] font-bold text-[#1D1D1F]">产品信息确认</h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[#6E6E73]">
              请确认以下信息是否准确，确认后用于生成剧本和视觉资产。
            </p>

            {preview.status !== 'ready' ? (
              <p className="mt-6 rounded-xl border border-dashed border-[#E5E5EA] bg-[#FAFAFA] px-4 py-8 text-center text-[13px] text-[#8E8E93]">
                完成原始输入并点击「解析产品信息」后，将在此处展示可编辑的确认项。
              </p>
            ) : (
              <div className="mt-6 space-y-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-[12px] font-medium text-[#6E6E73]">产品名称</label>
                    <input
                      className={fieldInputCls}
                      value={preview.productName}
                      onChange={(e) => {
                        const v = e.target.value;
                        setPreview((p) => ({
                          ...p,
                          productName: v,
                          fieldMeta: { ...p.fieldMeta, product_name: touchFieldMeta() },
                        }));
                        setDraft((d) => ({ ...d, productNameRaw: v }));
                        setIsParsedDirty(true);
                      }}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[12px] font-medium text-[#6E6E73]">产品品类</label>
                    <input
                      className={fieldInputCls}
                      value={preview.productCategory}
                      onChange={(e) => {
                        const v = e.target.value;
                        setPreview((p) => ({
                          ...p,
                          productCategory: v,
                          fieldMeta: { ...p.fieldMeta, product_category: touchFieldMeta() },
                        }));
                        setDraft((d) => ({ ...d, productCategoryRaw: v }));
                        setIsParsedDirty(true);
                      }}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[12px] font-medium text-[#6E6E73]">品牌</label>
                    <input
                      className={fieldInputCls}
                      value={preview.brandName}
                      onChange={(e) => {
                        const v = e.target.value;
                        setPreview((p) => ({
                          ...p,
                          brandName: v,
                          fieldMeta: { ...p.fieldMeta, brand_name: touchFieldMeta() },
                        }));
                        setDraft((d) => ({ ...d, brandRaw: v }));
                        setIsParsedDirty(true);
                      }}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[12px] font-medium text-[#6E6E73]">价格</label>
                    <input
                      className={fieldInputCls}
                      value={draft.priceRaw}
                      onChange={(e) => {
                        const v = e.target.value;
                        setDraft((d) => ({ ...d, priceRaw: v }));
                        setIsRawDirty(true);
                      }}
                    />
                  </div>
                </div>

                <ChipField
                  label="目标用户"
                  values={preview.targetUsers}
                  placeholder="输入后添加，例如：上班族"
                  onChange={(next) => {
                    setPreview((p) => ({
                      ...p,
                      targetUsers: next,
                      fieldMeta: { ...p.fieldMeta, target_users: touchFieldMeta() },
                    }));
                    setDraft((d) => ({ ...d, targetUsersRaw: next.join('、') }));
                    setIsParsedDirty(true);
                  }}
                />

                <ChipField
                  label="核心卖点"
                  values={preview.coreSellingPoints}
                  placeholder="输入卖点后添加"
                  onChange={(next) => {
                    setPreview((p) => ({
                      ...p,
                      coreSellingPoints: next,
                      fieldMeta: { ...p.fieldMeta, core_selling_points: touchFieldMeta() },
                    }));
                    setDraft((d) => ({ ...d, sellingPointsRaw: next }));
                    setIsParsedDirty(true);
                  }}
                />

                <ChipField
                  label="使用场景"
                  values={preview.usageScenarios}
                  placeholder="输入场景后添加"
                  onChange={(next) => {
                    setPreview((p) => ({
                      ...p,
                      usageScenarios: next,
                      fieldMeta: { ...p.fieldMeta, usage_scenarios: touchFieldMeta() },
                    }));
                    setDraft((d) => ({ ...d, usageScenariosRaw: next }));
                    setIsParsedDirty(true);
                  }}
                />

                <ChipField
                  label="外观与包装要点"
                  values={preview.visualFeatures}
                  placeholder="仅展示可读的中文要点；可在此增删"
                  onChange={(next) => {
                    setPreview((p) => ({
                      ...p,
                      visualFeatures: next,
                      fieldMeta: { ...p.fieldMeta, visual_features: touchFieldMeta() },
                    }));
                    setIsParsedDirty(true);
                  }}
                />

                {shouldShowAvoidIssues ? (
                  <ChipField
                    label="生成注意事项"
                    values={safeAvoidIssues}
                    placeholder="例如：夸大宣传、易误导表述等"
                    onChange={(next) => {
                      const cleaned = next.map((x) => sanitizeAvoidIssueLine(x)).filter(Boolean);
                      setPreview((p) => ({
                        ...p,
                        visualRiskNotes: cleaned,
                        fieldMeta: { ...p.fieldMeta, visual_risk_notes: touchFieldMeta() },
                      }));
                      setShowAvoidIssuesEditor(cleaned.length > 0);
                      setIsParsedDirty(true);
                    }}
                  />
                ) : (
                  <div>
                    <button
                      type="button"
                      className="rounded-lg border border-[#EAEAEA] bg-[#F5F5F7] px-3 py-2 text-[12px] font-medium text-[#444444] hover:bg-[#1D1D1F] hover:text-white"
                      onClick={() => setShowAvoidIssuesEditor(true)}
                    >
                      添加生成注意事项
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>

          {needsAttention.length > 0 ? (
            <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/95 p-5 shadow-sm">
              <h3 className="text-[15px] font-bold text-amber-950">需要确认的信息</h3>
              <ul className="mt-4 space-y-3">
                {needsAttention.map((line, idx) => (
                  <li
                    key={idx}
                    className="rounded-xl border border-amber-100/90 bg-white px-4 py-3 text-[13px] leading-relaxed text-amber-950"
                  >
                    {line}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <div className="mt-10 flex flex-col justify-between gap-4 border-t border-[#EAEAEA] pt-8 sm:flex-row sm:items-center">
            <button type="button" onClick={() => navigate('/short-drama/create')} className="flex items-center justify-center gap-2 rounded-xl border border-[#EAEAEA] bg-white px-5 py-3 text-[13.5px] text-[#444444] transition-colors hover:bg-[#F5F5F7]">
              <i className={ri('ri-arrow-left-line', 'text-[13px]')} aria-hidden />
              返回
            </button>
            <button type="button" disabled={!canGoStoryStep} onClick={() => void (async () => { await persistEditedContextIfNeeded(); canGoStoryStep && navigate(withProjectQuery('/short-drama/story-blueprint', projectId)); })()} className={`flex items-center justify-center gap-2 rounded-xl px-7 py-3 text-[14px] font-semibold transition-colors disabled:cursor-not-allowed disabled:bg-[#EAEAEA] disabled:text-[#AEAEB2] ${canGoStoryStep ? 'bg-[#1D1D1F] text-white hover:bg-[#374151]' : 'bg-[#F5F5F7] text-[#AEAEB2]'}`}>
              下一步：生成剧本
              <i className={ri('ri-arrow-right-line', 'text-[13px]')} aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
