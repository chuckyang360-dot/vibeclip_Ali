import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SDWorkflowNav } from './components/SDWorkflowNav';
import { useEffectiveShortDramaProjectId } from './hooks/useEffectiveShortDramaProjectId';
import {
  ShortDramaApiError,
  generateShortDramaCreativeBrief,
  getShortDramaPipeline,
  getShortDramaProject,
  saveShortDramaProductInput,
} from '@/services/shortDramaApi';
import type { CreativeBriefDto, ProductInputDto, ProductInputImageDto } from '@/types/shortDramaApi';
import { ri, sdColors, sdFontHeading } from './utils/shortDramaHelpers';
import { withProjectQuery } from './utils/shortDramaRoutes';
import { touchProjectNameFromPipeline } from './utils/shortDramaStorage';
import { workflowNavProjectName } from './utils/workflowProjectName';

type BriefStatus = 'idle' | 'loading' | 'ready' | 'error';

const emptyProductInput: ProductInputDto = {
  product_images: [],
  product_note: '',
  product_url: '',
};

const placeholderItems = [
  ['商品是什么', '商品类型、核心功能和产品定位'],
  ['商品长什么样', '外观、材质、结构和视觉特征'],
  ['用户为什么需要它', '真实需求场景和购买动机'],
  ['适合什么生活场景', '具体使用时机和生活情境'],
  ['哪些视觉特征需要保留', '品牌感、质感和视觉亮点'],
  ['哪些表达方式应该避免', '禁止方向和风格边界'],
];

function serializeProductInput(input: ProductInputDto): string {
  return JSON.stringify({
    product_images: input.product_images.map((img, idx) => ({
      url: img.url || '',
      image_order: img.image_order ?? idx,
      is_main_image: Boolean(img.is_main_image),
      image_caption_raw: img.image_caption_raw || '',
    })),
    product_note: input.product_note || '',
    product_url: input.product_url || '',
  });
}

function toDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('读取图片失败'));
    reader.readAsDataURL(file);
  });
}

function textList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((x) => String(x).trim()).filter(Boolean);
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
}

function briefText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) return textList(value).join('；');
  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).map(briefText).filter(Boolean).join('；');
  }
  return '';
}

function BriefSection({ title, children }: { title: string; children: string | string[] }) {
  const items = Array.isArray(children) ? children : textList(children);
  const single = !Array.isArray(children) ? String(children || '').trim() : '';
  return (
    <div className="rounded-2xl border border-[#EAEAEA] bg-[#FAFAFA] px-4 py-3">
      <p className="text-[12px] font-bold text-[#1D1D1F]">{title}</p>
      {items.length > 1 ? (
        <ul className="mt-2 space-y-1.5 text-[12.5px] leading-relaxed text-[#6E6E73]">
          {items.map((item) => (
            <li key={item}>- {item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[12.5px] leading-relaxed text-[#6E6E73]">{single || items[0] || '暂未明确'}</p>
      )}
    </div>
  );
}

export function ShortDramaProductInputPage() {
  const navigate = useNavigate();
  const { effectiveProjectId: projectId, projectName, refreshSession } = useEffectiveShortDramaProjectId();
  const [input, setInput] = useState<ProductInputDto>(emptyProductInput);
  const [brief, setBrief] = useState<CreativeBriefDto | null>(null);
  const [briefStatus, setBriefStatus] = useState<BriefStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [navTitle, setNavTitle] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const lastSavedProductInputRef = useRef<string>(serializeProductInput(emptyProductInput));

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    if (projectId == null) return;
    let cancelled = false;
    void (async () => {
      try {
        const p = await getShortDramaProject(projectId);
        if (cancelled) return;
        setNavTitle(p.project_name);
        touchProjectNameFromPipeline(projectId, p.project_name);
        if (p.product_input) {
          setInput(p.product_input);
          lastSavedProductInputRef.current = serializeProductInput(p.product_input);
        }
        if (p.creative_brief_structured) {
          setBrief(p.creative_brief_structured);
          setBriefStatus('ready');
        }
      } catch {
        if (!cancelled) setNavTitle(null);
      }
      try {
        const pipe = await getShortDramaPipeline(projectId);
        if (cancelled) return;
        if (pipe.product_input) {
          setInput(pipe.product_input);
          lastSavedProductInputRef.current = serializeProductInput(pipe.product_input);
        }
        if (pipe.creative_brief) {
          setBrief(pipe.creative_brief);
          setBriefStatus('ready');
        }
      } catch {
        // 项目详情已能支撑页面，pipeline 失败不阻塞输入。
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const displayName = workflowNavProjectName({ fetchedProjectName: navTitle, sessionProjectName: projectName });
  const hasProductInput = useMemo(
    () => input.product_images.length > 0 || Boolean(input.product_note.trim()),
    [input.product_images.length, input.product_note],
  );
  const canAnalyze = projectId != null && hasProductInput && briefStatus !== 'loading' && !isSaving;
  const canContinue = projectId != null && briefStatus === 'ready' && brief != null;
  const productInputChanged = serializeProductInput(input) !== lastSavedProductInputRef.current;

  const addFiles = async (files: FileList | File[]) => {
    const accepted = Array.from(files).filter((f) => ['image/jpeg', 'image/png', 'image/webp'].includes(f.type));
    if (!accepted.length) return;
    const urls = await Promise.all(accepted.map(toDataUrl));
    setInput((prev) => {
      const base = prev.product_images.length;
      const next: ProductInputImageDto[] = urls.map((url, idx) => ({
        url,
        image_order: base + idx,
        is_main_image: base === 0 && idx === 0,
        image_caption_raw: '',
      }));
      return { ...prev, product_images: [...prev.product_images, ...next] };
    });
  };

  const removeImage = (idx: number) => {
    setInput((prev) => ({
      ...prev,
      product_images: prev.product_images
        .filter((_, i) => i !== idx)
        .map((img, order) => ({ ...img, image_order: order, is_main_image: order === 0 })),
    }));
  };

  const persistProductInput = async () => {
    if (projectId == null) return;
    if (!productInputChanged) return;
    setIsSaving(true);
    setError(null);
    try {
      await saveShortDramaProductInput(projectId, input);
      lastSavedProductInputRef.current = serializeProductInput(input);
    } catch (e) {
      setError(e instanceof ShortDramaApiError ? e.message : e instanceof Error ? e.message : '保存失败');
      throw e;
    } finally {
      setIsSaving(false);
    }
  };

  const runAnalysis = async () => {
    if (projectId == null || !hasProductInput) return;
    setBriefStatus('loading');
    setError(null);
    try {
      await persistProductInput();
      const res = await generateShortDramaCreativeBrief(projectId);
      setBrief(res.creative_brief);
      setBriefStatus('ready');
    } catch (e) {
      setBriefStatus('error');
      setError(e instanceof ShortDramaApiError ? e.message : e instanceof Error ? e.message : 'AI 创作理解生成失败');
    }
  };

  const saveAndContinue = async () => {
    if (!canContinue || projectId == null) return;
    if (productInputChanged) await persistProductInput();
    navigate(withProjectQuery('/short-drama/story-blueprint', projectId));
  };

  const productUnderstanding = brief?.product_understanding ?? {};
  const creativeIntent = brief?.creative_intent ?? {};
  const interpretation = brief?.ai_interpretation ?? {};
  const avoid = textList(creativeIntent.avoid).concat(textList(productUnderstanding.avoid_notes));

  return (
    <div className="min-h-screen bg-[#F7F8FA]" style={{ fontFamily: "'Inter', sans-serif" }}>
      <SDWorkflowNav
        currentStep={1}
        projectName={displayName}
        projectId={projectId}
        isDirty={briefStatus !== 'ready'}
        onSaveDraft={async () => {
          try {
            await persistProductInput();
            return true;
          } catch {
            return false;
          }
        }}
      />
      <div className="pt-14">
        <main className="mx-auto max-w-6xl px-5 py-10">
          <header className="mb-8">
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#8E8E93]">S1 商品理解</span>
            <h1 className="mt-2 text-3xl font-black" style={{ ...sdFontHeading, color: sdColors.ink }}>
              告诉 AI，这个商品是什么
            </h1>
            <p className="mt-2 text-[14px] text-[#8E8E93]">
              上传商品图片，补充少量信息，让 AI 理解这个商品适合怎么被表达。
            </p>
          </header>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
            <section className="space-y-5">
              <div className="rounded-[28px] border border-[#EAEAEA] bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-end justify-between">
                  <div>
                    <h2 className="text-[16px] font-bold text-[#1D1D1F]">上传商品图片</h2>
                    <p className="mt-1 text-[12.5px] text-[#8E8E93]">建议上传 1-5 张，支持 JPG / PNG / WEBP。</p>
                  </div>
                  <span className="rounded-full bg-[#F5F5F7] px-3 py-1 text-[11px] text-[#8E8E93]">
                    {input.product_images.length} 张
                  </span>
                </div>
                <label
                  className="flex min-h-[190px] cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed px-6 py-8 text-center transition-colors"
                  style={{
                    borderColor: isDragging ? '#1D1D1F' : '#D1D1D6',
                    background: isDragging ? '#F5F5F7' : '#FAFAFA',
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    void addFiles(e.dataTransfer.files);
                  }}
                >
                  <i className={ri('ri-upload-cloud-2-line', 'mb-3 text-[30px] text-[#1D1D1F]')} aria-hidden />
                  <p className="text-[14px] font-semibold text-[#1D1D1F]">拖拽图片到这里，或点击上传</p>
                  <p className="mt-1 text-[12.5px] text-[#8E8E93]">商品主图、包装、细节图都可以</p>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files) void addFiles(e.target.files);
                      e.currentTarget.value = '';
                    }}
                  />
                </label>
                {input.product_images.length ? (
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {input.product_images.map((img, idx) => (
                      <div key={`${idx}-${img.url.slice(0, 24)}`} className="group relative overflow-hidden rounded-2xl border border-[#EAEAEA] bg-[#F7F8FA]">
                        <img src={img.url} alt={`product-${idx + 1}`} className="h-32 w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeImage(idx)}
                          className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-1 text-[11px] text-[#B91C1C] shadow-sm"
                        >
                          删除
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="rounded-[28px] border border-[#EAEAEA] bg-white p-6 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-[16px] font-bold text-[#1D1D1F]">补充商品信息</h2>
                  <span className="text-[12px] text-[#AEAEB2]">可选</span>
                </div>
                <textarea
                  className="min-h-[140px] w-full resize-none rounded-2xl border border-[#E5E5EA] bg-[#FAFAFA] px-4 py-3 text-[14px] leading-relaxed outline-none transition-colors focus:border-[#1D1D1F] focus:bg-white"
                  value={input.product_note}
                  onChange={(e) => setInput((p) => ({ ...p, product_note: e.target.value }))}
                  placeholder="例如：这是一款便携式鼻毛器，想突出安全、方便、适合出差。也可以粘贴商品详情、卖点、适用人群。"
                />
                <input
                  className="mt-4 w-full rounded-2xl border border-[#E5E5EA] bg-[#FAFAFA] px-4 py-3 text-[13px] outline-none transition-colors focus:border-[#1D1D1F] focus:bg-white"
                  value={input.product_url}
                  onChange={(e) => setInput((p) => ({ ...p, product_url: e.target.value }))}
                  placeholder="粘贴 Amazon / TEMU / 淘宝 / 1688 / 独立站商品链接，可选"
                />
              </div>
            </section>

            <aside className="rounded-[28px] border border-[#EAEAEA] bg-white p-6 shadow-sm">
              <h2 className="text-[17px] font-black text-[#1D1D1F]">AI 创作理解</h2>
              <p className="mt-2 text-[13px] leading-relaxed text-[#8E8E93]">
                AI 会结合上一步的创作意图和当前商品信息，生成后续剧本创作的基础理解。
              </p>

              {briefStatus === 'loading' ? (
                <div className="mt-6 space-y-3">
                  {[1, 2, 3, 4, 5, 6].map((x) => (
                    <div key={x} className="h-16 animate-pulse rounded-2xl bg-[#F5F5F7]" />
                  ))}
                </div>
              ) : briefStatus === 'ready' && brief ? (
                <div className="mt-6 space-y-3">
                  <BriefSection title="创作目标">{brief.user_goal || ''}</BriefSection>
                  <BriefSection title="商品理解">{briefText(productUnderstanding)}</BriefSection>
                  <BriefSection title="表达方向">{briefText(interpretation.core_direction)}</BriefSection>
                  <BriefSection title="视觉方向">{briefText(interpretation.visual_direction)}</BriefSection>
                  <BriefSection title="需要避免">{avoid}</BriefSection>
                  <BriefSection title="不确定信息">{textList(brief.uncertainties)}</BriefSection>
                </div>
              ) : (
                <div className="mt-6 space-y-3">
                  {placeholderItems.map(([title, body]) => (
                    <div key={title} className="rounded-2xl border border-[#EAEAEA] bg-[#FAFAFA] px-4 py-3">
                      <p className="text-[12px] font-bold text-[#1D1D1F]">{title}</p>
                      <p className="mt-1 text-[12.5px] text-[#8E8E93]">{body}</p>
                    </div>
                  ))}
                </div>
              )}

              {briefStatus === 'error' && error ? (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">
                  {error}
                </div>
              ) : null}
            </aside>
          </div>

          {error && briefStatus !== 'error' ? (
            <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">{error}</p>
          ) : null}

          <div className="mt-8 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => navigate(withProjectQuery('/short-drama/create', projectId))}
                className="rounded-xl border border-[#EAEAEA] bg-white px-5 py-3 text-[13.5px] text-[#444444] hover:bg-[#F5F5F7]"
              >
                返回创作意图
              </button>
              <button
                type="button"
                onClick={() => void persistProductInput()}
                disabled={projectId == null || isSaving}
                className="rounded-xl border border-[#EAEAEA] bg-white px-5 py-3 text-[13.5px] text-[#444444] hover:bg-[#F5F5F7] disabled:cursor-not-allowed disabled:text-[#AEAEB2]"
              >
                保存草稿
              </button>
            </div>
            {canContinue ? (
              <button
                type="button"
                onClick={() => void saveAndContinue()}
                className="rounded-xl bg-[#1D1D1F] px-7 py-3 text-[14px] font-semibold text-white hover:bg-[#374151]"
              >
                保存并进入剧本生成
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void runAnalysis()}
                disabled={!canAnalyze}
                className="inline-flex items-center justify-center gap-2 rounded-xl px-7 py-3 text-[14px] font-semibold transition-colors disabled:cursor-not-allowed disabled:bg-[#EAEAEA] disabled:text-[#AEAEB2]"
                style={{ background: canAnalyze ? sdColors.ink : undefined, color: canAnalyze ? '#ffffff' : undefined }}
              >
                <i className={ri(briefStatus === 'loading' ? 'ri-loader-4-line' : 'ri-sparkling-2-line', briefStatus === 'loading' ? 'animate-spin text-[14px]' : 'text-[14px]')} aria-hidden />
                {briefStatus === 'loading' ? '分析中…' : '分析商品并生成创作理解'}
              </button>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
