import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SDWorkflowNav } from './components/SDWorkflowNav';
import { MobileBottomActionBar } from './components/MobileBottomActionBar';
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
import { handleApiInsufficientCredits } from '@/utils/insufficientCredits';

type BriefStatus = 'idle' | 'loading' | 'ready' | 'error';

const emptyProductInput: ProductInputDto = {
  product_images: [],
  product_note: '',
  product_url: '',
};

const placeholderItems = [
  { icon: 'ri-box-3-line', label: '商品是什么', desc: '商品类型、核心功能和产品定位' },
  { icon: 'ri-eye-line', label: '商品长什么样', desc: '外观、材质、结构和视觉特征' },
  { icon: 'ri-user-heart-line', label: '用户为什么需要它', desc: '真实需求场景和购买动机' },
  { icon: 'ri-map-pin-line', label: '适合什么生活场景', desc: '具体使用时机和生活情境' },
  { icon: 'ri-camera-line', label: '哪些视觉特征需要保留', desc: '品牌感、质感和视觉亮点' },
  { icon: 'ri-forbid-line', label: '哪些表达方式应该避免', desc: '禁止方向和风格边界' },
];

const briefSectionMeta = [
  { title: '创作目标', icon: 'ri-focus-3-line', accent: '#B45309', bg: 'rgba(180,83,9,0.05)', border: 'rgba(180,83,9,0.12)' },
  { title: '商品理解', icon: 'ri-box-3-line', accent: '#047857', bg: 'rgba(4,120,87,0.05)', border: 'rgba(4,120,87,0.12)' },
  { title: '表达方向', icon: 'ri-heart-pulse-line', accent: '#334155', bg: 'rgba(51,65,85,0.05)', border: 'rgba(51,65,85,0.12)' },
  { title: '视觉方向', icon: 'ri-camera-lens-line', accent: '#92400E', bg: 'rgba(146,64,14,0.04)', border: 'rgba(146,64,14,0.12)' },
  { title: '需要避免', icon: 'ri-forbid-2-line', accent: '#DC2626', bg: 'rgba(220,38,38,0.04)', border: 'rgba(220,38,38,0.12)' },
  { title: '不确定信息', icon: 'ri-question-line', accent: '#6B7280', bg: 'rgba(107,114,128,0.04)', border: 'rgba(107,114,128,0.12)' },
] as const;

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

function PlaceholderLines({ count = 2 }: { count?: number }) {
  return (
    <div className="mt-1.5 space-y-1.5">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-full"
          style={{ height: '7px', background: '#EAEAEA', width: i === count - 1 ? '60%' : '100%' }}
        />
      ))}
    </div>
  );
}

function LoadingDots() {
  return (
    <div className="flex flex-col items-center justify-center gap-5 py-14">
      <div className="flex gap-1.5">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-2 w-2 rounded-full"
            style={{ background: '#1D1D1F', animation: `vcBounce 1.2s ease-in-out ${i * 0.15}s infinite` }}
          />
        ))}
      </div>
      <p className="text-[12.5px] text-[#8E8E93]">AI 正在理解你的商品和创作意图…</p>
      <style>{`
        @keyframes vcBounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.3; }
          40% { transform: translateY(-8px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function BriefSection({ title, children }: { title: string; children: string | string[] }) {
  const meta = briefSectionMeta.find((x) => x.title === title) ?? briefSectionMeta[0];
  const items = Array.isArray(children) ? children : textList(children);
  const single = !Array.isArray(children) ? String(children || '').trim() : '';
  return (
    <div className="rounded-xl p-3.5" style={{ background: meta.bg, border: `1px solid ${meta.border}` }}>
      <div className="mb-1.5 flex items-center gap-2">
        <i className={ri(meta.icon, 'text-[12px]')} style={{ color: meta.accent }} aria-hidden />
        <p className="text-[10.5px] font-bold uppercase tracking-wider" style={{ color: meta.accent }}>{title}</p>
      </div>
      {items.length > 1 ? (
        <ul className="space-y-1 text-[12.5px] leading-relaxed text-[#444444]">
          {items.map((item) => (
            <li key={item}>- {item}</li>
          ))}
        </ul>
      ) : (
        <p className="text-[12.5px] leading-relaxed text-[#444444]">{single || items[0] || '暂未明确'}</p>
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
  const [noteFocused, setNoteFocused] = useState(false);
  const [urlFocused, setUrlFocused] = useState(false);
  const productImageInputRef = useRef<HTMLInputElement>(null);
  const productCameraInputRef = useRef<HTMLInputElement>(null);
  const productGalleryInputRef = useRef<HTMLInputElement>(null);
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
      if (e instanceof ShortDramaApiError && e.isInsufficientCredits) {
        handleApiInsufficientCredits(e.status, e.detail, navigate);
        return;
      }
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
      <div className="pt-[112px] md:pt-14">
        <main className="mx-auto max-w-[1200px] px-4 pb-28 pt-7 md:px-5 md:py-8 lg:px-8">
          <header className="mb-5 md:mb-7">
            <span className="mb-2 inline-block rounded-full bg-[#EAEAEA] px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-[#8E8E93]">
              S1 · 商品理解
            </span>
            <h1 className="mb-1 text-2xl font-black" style={{ ...sdFontHeading, color: sdColors.ink }}>
              上传商品，先生成理解
            </h1>
            <p className="text-[13.5px] text-[#8E8E93]">
              上传商品图片，补充少量信息，让 AI 理解这个商品适合怎么被表达。
            </p>
          </header>

          <div className="flex flex-col items-start gap-6 lg:flex-row">
            <section className="w-full space-y-4 lg:flex-1">
              <div className="rounded-2xl border border-[#E5E5EA] bg-white p-5">
                <div className="mb-4 flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#F5F5F7]">
                    <i className={ri('ri-image-add-line', 'text-[12px] text-[#1D1D1F]')} aria-hidden />
                  </div>
                  <p className="text-[13px] font-bold text-[#444444]">上传商品图片</p>
                </div>
                <input
                  ref={productImageInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) void addFiles(e.target.files);
                    e.currentTarget.value = '';
                  }}
                />
                <input
                  ref={productCameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) void addFiles(e.target.files);
                    e.currentTarget.value = '';
                  }}
                />
                <input
                  ref={productGalleryInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) void addFiles(e.target.files);
                    e.currentTarget.value = '';
                  }}
                />

                <div className="mb-4 grid grid-cols-2 gap-3 md:hidden">
                  <button
                    type="button"
                    onClick={() => productCameraInputRef.current?.click()}
                    className="flex h-24 flex-col items-center justify-center gap-2 rounded-2xl bg-[#1D1D1F] text-white"
                  >
                    <i className={ri('ri-camera-line', 'text-[24px]')} aria-hidden />
                    <span className="text-[13px] font-semibold">拍照上传</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => productGalleryInputRef.current?.click()}
                    className="flex h-24 flex-col items-center justify-center gap-2 rounded-2xl border border-[#EAEAEA] bg-[#F7F8FA] text-[#444444]"
                  >
                    <i className={ri('ri-image-line', 'text-[24px]')} aria-hidden />
                    <span className="text-[13px] font-semibold">从相册选</span>
                  </button>
                </div>

                {input.product_images.length === 0 ? (
                  <div
                    role="button"
                    tabIndex={0}
                    className="relative cursor-pointer overflow-hidden rounded-2xl transition-all duration-200"
                    style={{
                      background: isDragging ? 'rgba(29,29,31,0.04)' : 'linear-gradient(145deg, #FAFAFA 0%, #F4F4F6 100%)',
                      border: `2px dashed ${isDragging ? '#1D1D1F' : '#D9D9DF'}`,
                      minHeight: '200px',
                    }}
                    onClick={() => productImageInputRef.current?.click()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') productImageInputRef.current?.click();
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
                    <div className="flex flex-col items-center justify-center px-8 py-12 text-center">
                      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#E8E8EC] bg-[#F0F0F3]">
                        <i className={ri('ri-image-add-line', 'text-[24px] text-[#AEAEB2]')} aria-hidden />
                      </div>
                      <p className="mb-1.5 text-[14px] font-semibold text-[#444444]">点击上传商品图片</p>
                      <p className="mb-4 text-[12.5px] text-[#AEAEB2]">电脑端也可以拖拽文件到这里</p>
                      <div className="inline-flex items-center gap-2 rounded-xl border border-[#E5E5EA] bg-white px-4 py-2 text-[12.5px] font-medium text-[#444444]">
                        <i className={ri('ri-folder-open-line', 'text-[13px]')} aria-hidden />
                        选择图片
                      </div>
                      <p className="mt-4 text-[11px] text-[#C7C7CC]">建议上传 1-5 张清晰图片 · 支持 JPG PNG WEBP</p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {input.product_images.map((img, idx) => (
                      <div key={`${idx}-${img.url.slice(0, 24)}`} className="group relative aspect-square overflow-hidden rounded-xl border border-[#E5E5EA]">
                        <img src={img.url} alt={`product-${idx + 1}`} className="h-full w-full object-cover object-top" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-all duration-200 group-hover:bg-black/30">
                          <button
                            type="button"
                            onClick={() => removeImage(idx)}
                            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full opacity-100 transition-opacity duration-200 md:opacity-0 md:group-hover:opacity-100"
                            style={{ background: 'rgba(255,255,255,0.9)' }}
                          >
                            <i className={ri('ri-delete-bin-line', 'text-[13px] text-[#DC2626]')} aria-hidden />
                          </button>
                        </div>
                      </div>
                    ))}
                    {input.product_images.length < 5 ? (
                      <button
                        type="button"
                        onClick={() => productImageInputRef.current?.click()}
                        className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-2 rounded-xl transition-all duration-200"
                        style={{ border: '2px dashed #D9D9DF', background: '#FAFAFA' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = '#1D1D1F';
                          e.currentTarget.style.background = '#F5F5F7';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = '#D9D9DF';
                          e.currentTarget.style.background = '#FAFAFA';
                        }}
                      >
                        <i className={ri('ri-add-line', 'text-[20px] text-[#AEAEB2]')} aria-hidden />
                        <span className="text-[10px] text-[#AEAEB2]">添加图片</span>
                      </button>
                    ) : null}
                    </div>
                    <p className="text-[11px] text-[#C7C7CC]">已上传 {input.product_images.length}/5 张 · 点按图片上的按钮可删除</p>
                  </div>
                )}
              </div>

              <div
                className="rounded-2xl bg-white p-5 transition-colors duration-200"
                style={{ border: `1.5px solid ${noteFocused ? '#1D1D1F' : '#E5E5EA'}` }}
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#F5F5F7]">
                      <i className={ri('ri-file-text-line', 'text-[12px] text-[#1D1D1F]')} aria-hidden />
                    </div>
                    <p className="text-[13px] font-bold text-[#444444]">补充商品信息</p>
                  </div>
                  <span className="text-[11px] text-[#C7C7CC]">可选</span>
                </div>
                <textarea
                  rows={4}
                  className="w-full resize-none bg-transparent text-[13.5px] leading-relaxed text-[#1D1D1F] outline-none"
                  value={input.product_note}
                  onChange={(e) => setInput((p) => ({ ...p, product_note: e.target.value }))}
                  onFocus={() => setNoteFocused(true)}
                  onBlur={() => setNoteFocused(false)}
                  placeholder="例如：这是一款便携式鼻毛器，想突出安全、方便、适合出差。也可以粘贴商品详情、卖点、适用人群。"
                />
              </div>

              <div
                className="rounded-2xl bg-white p-5 transition-colors duration-200"
                style={{ border: `1.5px solid ${urlFocused ? '#1D1D1F' : '#E5E5EA'}` }}
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#F5F5F7]">
                      <i className={ri('ri-links-line', 'text-[12px] text-[#1D1D1F]')} aria-hidden />
                    </div>
                    <p className="text-[13px] font-bold text-[#444444]">商品链接</p>
                  </div>
                  <span className="text-[11px] text-[#C7C7CC]">可选</span>
                </div>
                <input
                  className="w-full bg-transparent text-[13.5px] text-[#1D1D1F] outline-none"
                  value={input.product_url}
                  onChange={(e) => setInput((p) => ({ ...p, product_url: e.target.value }))}
                  onFocus={() => setUrlFocused(true)}
                  onBlur={() => setUrlFocused(false)}
                  placeholder="粘贴 Amazon / TEMU / 淘宝 / 1688 / 独立站商品链接"
                />
                <p className="mt-2 text-[11px] text-[#C7C7CC]">当前可作为商品资料保存，后续可用于扩展解析。</p>
              </div>
            </section>

            <aside className="w-full shrink-0 lg:sticky lg:top-20 lg:w-[400px]">
              <div className="min-h-0 lg:min-h-[560px]">
                <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-[#E5E5EA] bg-white lg:min-h-[560px]">
                  <div className="shrink-0 border-b border-[#F0F0F0] px-5 pb-4 pt-5">
                    <div className="mb-2 flex items-center gap-2.5">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#E5E5EA] bg-[#F5F5F7]">
                        <i className={ri('ri-sparkling-2-line', 'text-[14px] text-[#1D1D1F]')} aria-hidden />
                      </div>
                      <div className="flex-1">
                        <p className="text-[13px] font-bold leading-none text-[#1D1D1F]">AI 创作理解</p>
                      </div>
                      {briefStatus === 'ready' ? (
                        <span className="flex items-center gap-1 rounded-full border border-[rgba(5,150,105,0.15)] bg-[rgba(5,150,105,0.08)] px-2.5 py-1 text-[11px] font-medium text-[#047857]">
                          <i className={ri('ri-checkbox-circle-line', 'text-[12px]')} aria-hidden />
                          已生成
                        </span>
                      ) : null}
                    </div>
                    <p className="text-[12px] leading-relaxed text-[#8E8E93]">
                      AI 会结合上一步的创作意图和当前商品信息，生成后续剧本创作的基础理解。
                    </p>
                  </div>

                  <div className="flex-1 overflow-y-auto">
                    {briefStatus === 'loading' ? (
                      <LoadingDots />
                    ) : briefStatus === 'ready' && brief ? (
                      <div className="space-y-3 p-5">
                        <BriefSection title="创作目标">{brief.user_goal || ''}</BriefSection>
                        <BriefSection title="商品理解">{briefText(productUnderstanding)}</BriefSection>
                        <BriefSection title="表达方向">{briefText(interpretation.core_direction)}</BriefSection>
                        <BriefSection title="视觉方向">{briefText(interpretation.visual_direction)}</BriefSection>
                        <BriefSection title="需要避免">{avoid}</BriefSection>
                        <BriefSection title="不确定信息">{textList(brief.uncertainties)}</BriefSection>
                      </div>
                    ) : (
                      <div className="p-5">
                        <p className="mb-4 text-[12px] text-[#AEAEB2]">
                          上传商品并点击分析后，AI 会把你的创作意图和商品信息整理成一份创作理解。
                        </p>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:block lg:space-y-4">
                          {placeholderItems.map((g) => (
                            <div key={g.label} className="flex gap-3">
                              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#EAEAEA] bg-[#F7F8FA]">
                                <i className={ri(g.icon, 'text-[12px] text-[#C7C7CC]')} aria-hidden />
                              </div>
                              <div className="flex-1">
                                <p className="mb-0.5 text-[12px] font-semibold text-[#C7C7CC]">{g.label}</p>
                                <p className="text-[11px] text-[#D1D1D6]">{g.desc}</p>
                                <PlaceholderLines count={2} />
                              </div>
                            </div>
                          ))}
                        </div>
                        {briefStatus === 'error' && error ? (
                          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">
                            {error}
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>

                  {briefStatus !== 'ready' ? (
                  <div className="shrink-0 border-t border-[#F0F0F0] px-5 pb-5 pt-3">
                    {briefStatus === 'loading' ? (
                      <div className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#F5F5F7] py-3 text-[13px] text-[#8E8E93]">
                        <i className={ri('ri-loader-4-line', 'animate-spin text-[14px]')} aria-hidden />
                        AI 正在分析中…
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void runAnalysis()}
                        disabled={!canAnalyze}
                        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl py-3 text-[13.5px] font-semibold text-white transition-all duration-200 disabled:cursor-not-allowed disabled:bg-[#EAEAEA] disabled:text-[#AEAEB2]"
                        style={{ background: canAnalyze ? '#1D1D1F' : undefined }}
                        onMouseEnter={(e) => {
                          if (canAnalyze) e.currentTarget.style.background = '#374151';
                        }}
                        onMouseLeave={(e) => {
                          if (canAnalyze) e.currentTarget.style.background = '#1D1D1F';
                        }}
                      >
                        <i className={ri('ri-sparkling-2-line', 'text-[14px]')} aria-hidden />
                        分析商品并生成创作理解
                      </button>
                    )}
                  </div>
                  ) : null}
                </div>
              </div>
            </aside>
          </div>

          {error && briefStatus !== 'error' ? (
            <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">{error}</p>
          ) : null}

          <div className="mt-8 hidden items-center justify-between border-t border-[#E5E5EA] pt-6 md:flex">
            <button
              type="button"
              onClick={() => navigate(withProjectQuery('/short-drama/create', projectId))}
              className="flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-xl border border-[#E5E5EA] bg-white px-5 py-2.5 text-[13px] font-medium text-[#6E6E73] transition-all duration-200 hover:bg-[#F5F5F7]"
            >
              <i className={ri('ri-arrow-left-line', 'text-[12px]')} aria-hidden />
              返回创作意图
            </button>
            {canContinue ? (
              <button
                type="button"
                onClick={() => void saveAndContinue()}
                className="flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-xl bg-[#1D1D1F] px-6 py-2.5 text-[13.5px] font-semibold text-white transition-all duration-200 hover:bg-[#374151]"
              >
                <i className={ri('ri-arrow-right-line', 'text-[13px]')} aria-hidden />
                进入剧本生成
              </button>
            ) : briefStatus === 'loading' ? (
              <div className="flex items-center gap-2 whitespace-nowrap rounded-xl bg-[#F5F5F7] px-6 py-2.5 text-[13px] text-[#8E8E93]">
                <i className={ri('ri-loader-4-line', 'animate-spin text-[14px]')} aria-hidden />
                AI 分析中…
              </div>
            ) : (
              <button
                type="button"
                onClick={() => void runAnalysis()}
                disabled={!canAnalyze}
                className="flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-xl px-6 py-2.5 text-[13.5px] font-semibold text-white transition-all duration-200 disabled:cursor-not-allowed disabled:bg-[#EAEAEA] disabled:text-[#AEAEB2]"
                style={{ background: canAnalyze ? sdColors.ink : undefined }}
              >
                <i className={ri('ri-sparkling-2-line', 'text-[13px]')} aria-hidden />
                分析商品并生成创作理解
              </button>
            )}
          </div>
          <MobileBottomActionBar>
            <button
              type="button"
              onClick={() => navigate(withProjectQuery('/short-drama/create', projectId))}
              className="flex h-11 shrink-0 items-center justify-center rounded-xl border border-[#E5E5EA] bg-white px-4 text-[13px] font-medium text-[#6E6E73]"
              aria-label="返回创作意图"
            >
              <i className={ri('ri-arrow-left-line', 'text-[14px]')} aria-hidden />
            </button>
            {canContinue ? (
              <button
                type="button"
                onClick={() => void saveAndContinue()}
                className="flex h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-[#1D1D1F] px-4 text-[13.5px] font-semibold text-white"
              >
                进入剧本生成
                <i className={ri('ri-arrow-right-line', 'text-[13px]')} aria-hidden />
              </button>
            ) : briefStatus === 'loading' ? (
              <div className="flex h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-[#F5F5F7] px-4 text-[13px] text-[#8E8E93]">
                <i className={ri('ri-loader-4-line', 'animate-spin text-[14px]')} aria-hidden />
                AI 分析中…
              </div>
            ) : (
              <button
                type="button"
                onClick={() => void runAnalysis()}
                disabled={!canAnalyze}
                className="flex h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-[13.5px] font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#EAEAEA] disabled:text-[#AEAEB2]"
                style={{ background: canAnalyze ? sdColors.ink : undefined }}
              >
                <i className={ri('ri-sparkling-2-line', 'text-[13px]')} aria-hidden />
                生成理解
              </button>
            )}
          </MobileBottomActionBar>
        </main>
      </div>
    </div>
  );
}
