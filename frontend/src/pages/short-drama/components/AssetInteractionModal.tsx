import { useEffect, useMemo, useState } from 'react';

export type AssetKind = 'character' | 'scene' | 'product';

export type AssetInteractionEntity = {
  id: number;
  kind: AssetKind;
  name: string;
  typeLabel: string;
  narrativeFunctionLabel?: string;
  description: string;
  prompt: string;
  imageUrl: string | null;
  sourceLabel: '系统生成' | '用户上传' | '用户参考图';
  voiceStyle?: string;
  productUsage?: string;
  assetTypeLabel?: string;
  imageCount?: number;
  imageLimit?: number;
  images?: { id: number; imageUrl: string; isCover: boolean; label?: string; sourceType?: 'generated' | 'uploaded' | 'reference' }[];
  referenceImages?: { id: number; fileUrl: string; fileName?: string }[];
  selectedImageId?: number | null;
  tags?: string[];
  typeFields?: Record<string, unknown>;
  rawSnapshot?: Record<string, unknown>;
  structureSummary?: {
    sceneStage: string;
    sceneForm: string;
    visualAnchor: string;
    variantCount: string;
    source: string;
  };
};

export type AssetEditorPayload = {
  currentImagePrompt: string;
};

type Props = {
  asset: AssetInteractionEntity | null;
  saving: boolean;
  regenerating: boolean;
  imageAnalyzing?: boolean;
  onClose: () => void;
  onSaveAllNormal: (payload: AssetEditorPayload) => Promise<void>;
  onRegeneratePrompt: (payload: AssetEditorPayload) => Promise<void>;
  onSelectImage?: (imageId: number) => void;
  onAddImage?: () => void;
  onPromptDirtyChange?: (dirty: boolean) => void;
};

function formatDisplayValue(value: unknown, fallback = '—'): string {
  if (value == null) return fallback;
  if (typeof value === 'string') {
    const text = value.trim();
    if (!text) return fallback;
    if (
      text.includes("{'display':") ||
      text.includes('"display"') ||
      text.includes('source_trace') ||
      text.includes('field_meta') ||
      text.includes('conflict:') ||
      text.includes('brand:') ||
      text.includes('raw_')
    ) {
      return fallback;
    }
    return text;
  }
  if (Array.isArray(value)) {
    const out = value.map((item) => formatDisplayValue(item, '')).filter(Boolean);
    return out.length ? out.join('、') : fallback;
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.display === 'string' && record.display.trim()) return record.display.trim();
    if (typeof record.description === 'string' && record.description.trim()) return record.description.trim();
    return fallback;
  }
  return String(value);
}

function serializeDebugValue(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function cleanEditableAssetPrompt(raw: string): string {
  return String(raw || '').trim();
}

function looksLikeEngineeringPrompt(raw: string): boolean {
  const text = String(raw || '').trim().toLowerCase();
  if (!text) return false;
  return (
    text.includes('single coherent location') ||
    text.includes('single location only') ||
    text.includes('no collage') ||
    text.includes('no split-screen') ||
    text.includes('no multiple panels') ||
    text.includes('no montage') ||
    text.includes('no grid layout') ||
    text.includes('one coherent reusable background environment')
  );
}

const EXECUTION_PATTERNS: RegExp[] = [
  /scene identity normalized to reusable location:\s*/gi,
  /removed plot\/action term:\s*/gi,
  /single coherent location:\s*/gi,
  /single location only/gi,
  /no collage/gi,
  /no split-screen/gi,
  /no multiple panels/gi,
  /no montage/gi,
  /no grid layout/gi,
  /no grid\b/gi,
  /one coherent reusable background environment/gi,
  /product appearance cannot be altered[^,.。;；]*/gi,
  /\bmust remain\b/gi,
  /ensure positive healthy outcomes[^,.。;；]*/gi,
  /avoid graphic dental problems[^,.。;；]*/gi,
  /no group photo/gi,
  /no contact sheet/gi,
  /no character sheet[^,.。;；]*/gi,
  /character sheet with multiple variants/gi,
  /\bone single person only\b/gi,
  /\bno multiple people\b/gi,
  /provider prompt/gi,
  /prompt_snapshot/gi,
  /market constraints?/gi,
  /visual style constraints?/gi,
  /market_visual_constraints/gi,
  /visual_style_constraints/gi,
  /provider_params/gi,
];

function cleanupMainDisplayText(value: unknown): string {
  let text = formatDisplayValue(value, '').trim();
  if (!text) return '';
  for (const pattern of EXECUTION_PATTERNS) text = text.replace(pattern, ' ');
  text = text.replace(/\s+/g, ' ').replace(/[;；,，]\s*[;；,，]+/g, '，').trim();
  if (!text) return '';
  const letters = (text.match(/[A-Za-z]/g) || []).length;
  const zh = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  if (letters > 24 && zh === 0) return '';
  return text;
}

export function AssetInteractionModal({
  asset,
  saving,
  regenerating,
  imageAnalyzing = false,
  onClose,
  onSaveAllNormal,
  onRegeneratePrompt,
  onSelectImage,
  onAddImage,
  onPromptDirtyChange,
}: Props) {
  const [displayDescription, setDisplayDescription] = useState('');
  const [initialPromptDraft, setInitialPromptDraft] = useState('');
  const [promptDraft, setPromptDraft] = useState('');

  useEffect(() => {
    if (!asset) return;
    const rawPreferred = String(
      asset.rawSnapshot?.base_prompt ??
      (asset.typeFields?.image_prompt as string | undefined) ??
      (asset.typeFields?.visual_prompt as string | undefined) ??
      asset.prompt ??
      asset.rawSnapshot?.prompt_snapshot ??
      asset.rawSnapshot?.provider_prompt ??
      asset.description ??
      '',
    );
    const tf = asset.typeFields ?? {};
    const imageDescription = cleanupMainDisplayText(
      String(
        tf.image_description ??
          tf.display_description ??
          asset.description ??
          '',
      ),
    );
    setDisplayDescription(imageDescription || '—');
    const naturalFallback = cleanEditableAssetPrompt(
      String(
        tf.display_description ??
        tf.image_description ??
        asset.description ??
        '',
      ),
    );
    const normalizedPrompt = cleanEditableAssetPrompt(
      looksLikeEngineeringPrompt(rawPreferred) && naturalFallback ? naturalFallback : rawPreferred,
    );
    setInitialPromptDraft(normalizedPrompt);
    setPromptDraft(normalizedPrompt);
  }, [asset]);

  const payload = useMemo<AssetEditorPayload | null>(() => {
    if (!asset) return null;
    return { currentImagePrompt: cleanEditableAssetPrompt(promptDraft) };
  }, [asset, promptDraft]);

  const isDirty = cleanEditableAssetPrompt(promptDraft) !== cleanEditableAssetPrompt(initialPromptDraft);

  useEffect(() => {
    onPromptDirtyChange?.(isDirty);
  }, [isDirty, onPromptDirtyChange]);

  if (!asset || !payload) return null;

  const images = asset.images ?? [];
  const selectedImage = images.find((x) => x.id === asset.selectedImageId) ?? images[0];
  const previewSrc = selectedImage?.imageUrl ?? asset.imageUrl;
  const canAddImage = (asset.imageCount ?? images.length) < (asset.imageLimit ?? 6);
  const rowClass = 'rounded-xl border border-[#EAEAEA] bg-white px-3 py-2.5';
  const isDev = import.meta.env.DEV;
  const positionLabel =
    asset.kind === 'character'
      ? '角色定位'
      : asset.kind === 'scene'
        ? '场景定位'
        : asset.kind === 'product'
          ? '商品定位'
          : '定位';

  const descriptionLabel = '画面说明';
  const imageStatusLabel = previewSrc
    ? `已有图片（${asset.imageCount ?? images.length} 张）`
    : '待生成图片';
  const providerPromptSnapshot = formatDisplayValue(
    asset.rawSnapshot?.prompt_snapshot ?? asset.rawSnapshot?.provider_prompt ?? asset.rawSnapshot?.base_prompt,
    '',
  );
  const basePromptRaw = formatDisplayValue(asset.rawSnapshot?.base_prompt ?? asset.prompt, '');
  const providerPromptRaw = formatDisplayValue(asset.rawSnapshot?.provider_prompt, '');
  const promptSnapshotRaw = formatDisplayValue(asset.rawSnapshot?.prompt_snapshot, '');
  const providerParamsText = serializeDebugValue(asset.rawSnapshot?.provider_params);
  const typeFieldsText = serializeDebugValue(asset.typeFields);
  const debugMetaText = serializeDebugValue(asset.rawSnapshot?.meta ?? asset.rawSnapshot);

  const valueTextClass = 'mt-1 text-[13px] leading-relaxed text-[#444444] whitespace-pre-wrap break-words';

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/35 p-4">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-[#EAEAEA] bg-white lg:flex-row">
        <div className="flex h-[min(36vh,280px)] w-full shrink-0 flex-col border-b border-[#D8DADF] bg-[#E4E6EA] lg:h-auto lg:w-[min(42%,420px)] lg:border-b-0 lg:border-r lg:border-[#D8DADF]">
          <div className="flex min-h-0 flex-1 items-center justify-center">
            {regenerating ? (
              <div className="flex flex-col items-center justify-center gap-2 px-3">
                <i className="ri-loader-4-line animate-spin text-2xl text-[#1D1D1F]" aria-hidden />
                <span className="text-center text-[12px] text-[#6E6E73]">正在重新生成图像…</span>
              </div>
            ) : previewSrc ? (
              <img src={previewSrc} alt={asset.name} className="block max-h-full max-w-full object-contain object-center" />
            ) : (
              <div className="px-3 text-center text-[13px] text-[#8E8E93]">暂无预览图</div>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap gap-2 border-t border-[#D8DADF] bg-[#F5F5F7] p-3">
            {images.map((img) => (
              <button
                key={img.id}
                type="button"
                className={`relative h-12 w-12 overflow-hidden rounded border ${img.id === selectedImage?.id ? 'border-[#1D1D1F]' : 'border-[#EAEAEA]'}`}
                onClick={() => onSelectImage?.(img.id)}
                title={img.sourceType === 'reference' ? '用户参考图' : img.sourceType === 'uploaded' ? '用户上传' : '系统生成'}
              >
                <img src={img.imageUrl} alt={img.label ?? 'thumb'} className="h-full w-full object-cover" />
                <span className="absolute bottom-0 right-0 rounded-tl bg-black/65 px-1 text-[9px] leading-[1.4] text-white">
                  {img.sourceType === 'reference' ? '参考图' : img.sourceType === 'uploaded' ? '上传' : '生成'}
                </span>
              </button>
            ))}
            {canAddImage ? (
              <button
                type="button"
                disabled={imageAnalyzing}
                onClick={onAddImage}
                className="flex h-12 w-12 items-center justify-center rounded border border-dashed border-[#B8BBC2] bg-white text-[24px] leading-none text-[#6E6E73] disabled:opacity-50"
              >
                +
              </button>
            ) : null}
            {imageAnalyzing ? (
              <div className="flex h-12 items-center px-2 text-[11px] text-[#6E6E73]">正在分析参考图...</div>
            ) : null}
          </div>
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex shrink-0 items-center justify-between border-b border-[#EAEAEA] px-5 py-4">
            <h3 className="text-[18px] font-black text-[#1D1D1F]">资产详情</h3>
            <button type="button" onClick={onClose} className="rounded-lg border border-[#EAEAEA] px-3 py-1.5 text-[12px] text-[#444444]">
              关闭
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <div className="flex flex-col gap-3">
              <div className={rowClass}>
                <div className="text-[11px] font-medium text-[#8E8E93]">名称</div>
                <div className={valueTextClass}>{formatDisplayValue(asset.name || '', '—')}</div>
              </div>
              <div className={rowClass}>
                <div className="text-[11px] font-medium text-[#8E8E93]">{positionLabel}</div>
                <div className={valueTextClass}>{formatDisplayValue(asset.assetTypeLabel || asset.typeLabel || '', '—')}</div>
              </div>
              <div className={rowClass}>
                <div className="text-[11px] font-medium text-[#8E8E93]">{descriptionLabel}</div>
                <div className={valueTextClass}>{formatDisplayValue(displayDescription || '', '—')}</div>
              </div>
              <div className={rowClass}>
                <div className="text-[11px] font-medium text-[#8E8E93]">当前图片状态</div>
                <div className={valueTextClass}>{imageStatusLabel}</div>
              </div>
              <div className={rowClass}>
                <div className="text-[11px] font-medium text-[#8E8E93]">图片生成提示词</div>
                <p className="mt-1 text-[11px] leading-relaxed text-[#AEAEB2]">
                  修改这里后，点击“重新生成图片”，系统会按这段描述生成新的资产图。
                </p>
                <textarea
                  value={promptDraft}
                  onChange={(e) => setPromptDraft(e.target.value)}
                  rows={5}
                  className="mt-2 w-full rounded-lg border border-[#EAEAEA] px-3 py-2 text-[13px]"
                />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={saving || regenerating}
                    onClick={() => void onRegeneratePrompt(payload)}
                    className="rounded-lg bg-[#1D1D1F] px-3 py-2 text-[12px] font-medium text-white disabled:opacity-50"
                  >
                    {regenerating ? '生成中…' : '重新生成图片'}
                  </button>
                </div>
              </div>
              <div className={rowClass}>
                <div className="text-[11px] font-medium text-[#8E8E93]">图片来源</div>
                <div className={valueTextClass}>{asset.sourceLabel}</div>
              </div>

              {isDev ? (
                <details className={rowClass}>
                  <summary className="cursor-pointer text-[11px] font-medium text-[#8E8E93]">开发调试信息</summary>
                  <div className="mt-2 space-y-2 text-[11px] text-[#6E6E73]">
                    {basePromptRaw ? (
                      <div>
                        <div className="font-medium text-[#8E8E93]">原始 base_prompt</div>
                        <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded border border-[#EAEAEA] bg-white p-2 text-[11px] text-[#444444]">
                          {basePromptRaw}
                        </pre>
                      </div>
                    ) : null}
                    {providerPromptRaw ? (
                      <div>
                        <div className="font-medium text-[#8E8E93]">原始 provider prompt</div>
                        <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded border border-[#EAEAEA] bg-white p-2 text-[11px] text-[#444444]">
                          {providerPromptRaw}
                        </pre>
                      </div>
                    ) : null}
                    {promptSnapshotRaw ? (
                      <div>
                        <div className="font-medium text-[#8E8E93]">原始 prompt_snapshot</div>
                        <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded border border-[#EAEAEA] bg-white p-2 text-[11px] text-[#444444]">
                          {promptSnapshotRaw}
                        </pre>
                      </div>
                    ) : null}
                    {!promptSnapshotRaw && providerPromptSnapshot ? (
                      <div>
                        <div className="font-medium text-[#8E8E93]">Provider 提示快照</div>
                        <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded border border-[#EAEAEA] bg-white p-2 text-[11px] text-[#444444]">
                          {providerPromptSnapshot}
                        </pre>
                      </div>
                    ) : null}
                    {providerParamsText ? (
                      <div>
                        <div className="font-medium text-[#8E8E93]">Provider 参数</div>
                        <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded border border-[#EAEAEA] bg-white p-2 text-[11px] text-[#444444]">
                          {providerParamsText}
                        </pre>
                      </div>
                    ) : null}
                    {typeFieldsText ? (
                      <div>
                        <div className="font-medium text-[#8E8E93]">type_fields</div>
                        <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded border border-[#EAEAEA] bg-white p-2 text-[11px] text-[#444444]">
                          {typeFieldsText}
                        </pre>
                      </div>
                    ) : null}
                    {debugMetaText ? (
                      <div>
                        <div className="font-medium text-[#8E8E93]">其他元数据</div>
                        <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded border border-[#EAEAEA] bg-white p-2 text-[11px] text-[#444444]">
                          {debugMetaText}
                        </pre>
                      </div>
                    ) : null}
                    {!basePromptRaw && !providerPromptRaw && !promptSnapshotRaw && !providerPromptSnapshot && !providerParamsText && !typeFieldsText && !debugMetaText ? (
                      <p className="text-[11px] text-[#AEAEB2]">暂无调试数据</p>
                    ) : null}
                  </div>
                </details>
              ) : null}
            </div>
          </div>

          <div className="shrink-0 border-t border-[#EAEAEA] bg-white px-5 py-4">
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                disabled={saving || regenerating || !isDirty}
                className="rounded-xl bg-[#1D1D1F] py-3 text-[13px] font-semibold text-white disabled:opacity-50"
                onClick={() => {
                  void onSaveAllNormal(payload);
                  setInitialPromptDraft(cleanEditableAssetPrompt(promptDraft));
                }}
              >
                {saving ? '保存中…' : '保存提示词'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

