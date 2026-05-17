import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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

const PMT_FIELD_KEY = 'pmt';

type LightboxField = {
  key: string;
  label: string;
  value: string;
  icon: string;
  isPmt?: boolean;
  multiline?: boolean;
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

function readTypeField(asset: AssetInteractionEntity, keys: string[]): string {
  const tf = asset.typeFields ?? {};
  for (const key of keys) {
    const raw = tf[key];
    const text = formatDisplayValue(raw, '');
    if (text && text !== '—') return text;
  }
  return '';
}

function displayOrDash(value: string): string {
  const t = value.trim();
  return t ? t : '—';
}

function segmentDisplay(asset: AssetInteractionEntity): string {
  const fromTf = readTypeField(asset, [
    'segment',
    'segments',
    'linked_segments',
    'appearance_segments',
    'corresponding_segment',
  ]);
  if (fromTf) return fromTf;
  const nf = formatDisplayValue(asset.narrativeFunctionLabel, '');
  if (nf && nf !== '—') return nf;
  const ss = asset.structureSummary;
  if (!ss) return '—';
  const parts = [ss.sceneStage, ss.sceneForm].map((x) => formatDisplayValue(x, '')).filter((x) => x && x !== '—');
  return parts.length ? parts.join(' · ') : '—';
}

function styleDisplay(asset: AssetInteractionEntity): string {
  const fromTf = readTypeField(asset, [
    'visual_style',
    'style',
    'product_style',
    'visual_style_constraints',
    'market_visual_constraints',
  ]);
  if (fromTf) return fromTf;
  const anchor = formatDisplayValue(asset.structureSummary?.visualAnchor, '');
  return anchor && anchor !== '—' ? anchor : '—';
}

function buildFields(asset: AssetInteractionEntity, promptDraft: string): LightboxField[] {
  const name = displayOrDash(formatDisplayValue(asset.name, ''));
  const typeLbl = displayOrDash(formatDisplayValue(asset.assetTypeLabel || asset.typeLabel, ''));

  if (asset.kind === 'character') {
    const tagsJoined = (asset.tags ?? []).filter(Boolean).join(' · ');
    return [
      { key: 'name', label: '资产名称', value: name, icon: 'ri-user-star-line' },
      { key: 'role', label: '角色定位', value: typeLbl, icon: 'ri-user-line' },
      {
        key: 'voice',
        label: '音色风格',
        value: displayOrDash(
          formatDisplayValue(
            asset.voiceStyle || readTypeField(asset, ['voice_profile', 'voice_style', 'personality']),
            '',
          ),
        ),
        icon: 'ri-mic-line',
      },
      { key: 'tags', label: '标签', value: tagsJoined ? tagsJoined : '—', icon: 'ri-price-tag-3-line' },
      { key: 'segments', label: '出镜片段', value: segmentDisplay(asset), icon: 'ri-film-line' },
      { key: 'style', label: '视觉风格', value: styleDisplay(asset), icon: 'ri-palette-line' },
      {
        key: PMT_FIELD_KEY,
        label: '角色描述 / PMT',
        value: promptDraft || '—',
        icon: 'ri-file-text-line',
        isPmt: true,
        multiline: true,
      },
    ];
  }

  if (asset.kind === 'scene') {
    return [
      { key: 'name', label: '资产名称', value: name, icon: 'ri-landscape-line' },
      { key: 'type', label: '场景类型', value: typeLbl, icon: 'ri-map-pin-line' },
      {
        key: 'lighting',
        label: '光线设定',
        value: displayOrDash(readTypeField(asset, ['lighting', 'lighting_setup', 'light'])),
        icon: 'ri-sun-line',
      },
      {
        key: 'mood',
        label: '情绪氛围',
        value: displayOrDash(readTypeField(asset, ['mood', 'emotion', 'atmosphere'])),
        icon: 'ri-emotion-line',
      },
      {
        key: 'camera',
        label: '推荐镜头',
        value: displayOrDash(readTypeField(asset, ['camera', 'camera_hint', 'recommended_camera', 'shot_type'])),
        icon: 'ri-camera-line',
      },
      { key: 'segment', label: '对应片段', value: segmentDisplay(asset), icon: 'ri-film-line' },
      {
        key: PMT_FIELD_KEY,
        label: '场景描述 / PMT',
        value: promptDraft || '—',
        icon: 'ri-file-text-line',
        isPmt: true,
        multiline: true,
      },
    ];
  }

  return [
    { key: 'name', label: '资产名称', value: name, icon: 'ri-archive-line' },
    {
      key: 'placement',
      label: '出镜方式',
      value: displayOrDash(
        formatDisplayValue(
          asset.productUsage || readTypeField(asset, ['product_usage', 'usage_mode', 'placement']),
          '',
        ),
      ),
      icon: 'ri-camera-line',
    },
    { key: 'style', label: '产品风格', value: styleDisplay(asset), icon: 'ri-palette-line' },
    { key: 'segment', label: '对应片段', value: segmentDisplay(asset), icon: 'ri-film-line' },
    {
      key: PMT_FIELD_KEY,
      label: '镜头定位 / PMT',
      value: promptDraft || '—',
      icon: 'ri-focus-3-line',
      isPmt: true,
      multiline: true,
    },
  ];
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
  const overlayRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [displayDescription, setDisplayDescription] = useState('');
  const [initialPromptDraft, setInitialPromptDraft] = useState('');
  const [promptDraft, setPromptDraft] = useState('');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());
  const [regenKeys, setRegenKeys] = useState<Set<string>>(new Set());
  const [activeImgIdx, setActiveImgIdx] = useState(0);

  useEffect(() => {
    if (!asset) {
      setVisible(false);
      return;
    }
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
      String(tf.image_description ?? tf.display_description ?? asset.description ?? ''),
    );
    setDisplayDescription(imageDescription || '—');
    const naturalFallback = cleanEditableAssetPrompt(
      String(tf.display_description ?? tf.image_description ?? asset.description ?? ''),
    );
    const normalizedPrompt = cleanEditableAssetPrompt(
      looksLikeEngineeringPrompt(rawPreferred) && naturalFallback ? naturalFallback : rawPreferred,
    );
    setInitialPromptDraft(normalizedPrompt);
    setPromptDraft(normalizedPrompt);
    setEditingKey(null);
    setSavedKeys(new Set());
    setRegenKeys(new Set());
    const imgs = asset.images ?? [];
    const idx = imgs.findIndex((x) => x.id === asset.selectedImageId);
    setActiveImgIdx(idx >= 0 ? idx : 0);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setVisible(true));
    });
  }, [asset]);

  useEffect(() => {
    if (!asset) return undefined;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [asset]);

  const payload = useMemo<AssetEditorPayload | null>(() => {
    if (!asset) return null;
    return { currentImagePrompt: cleanEditableAssetPrompt(promptDraft) };
  }, [asset, promptDraft]);

  const isDirty = cleanEditableAssetPrompt(promptDraft) !== cleanEditableAssetPrompt(initialPromptDraft);

  useEffect(() => {
    onPromptDirtyChange?.(isDirty);
  }, [isDirty, onPromptDirtyChange]);

  const images = asset?.images ?? [];
  const selectedImage = images.find((x) => x.id === asset?.selectedImageId) ?? images[0];
  const previewSrc = selectedImage?.imageUrl ?? asset?.imageUrl ?? null;

  useEffect(() => {
    if (!asset) return;
    const idx = images.findIndex((x) => x.id === asset.selectedImageId);
    if (idx >= 0) setActiveImgIdx(idx);
  }, [asset, asset?.selectedImageId, images]);

  const fields = useMemo(
    () => (asset ? buildFields(asset, promptDraft) : []),
    [asset, promptDraft],
  );

  const selectImageAt = useCallback(
    (idx: number) => {
      if (!images.length) return;
      const clamped = Math.max(0, Math.min(idx, images.length - 1));
      setActiveImgIdx(clamped);
      const row = images[clamped];
      if (row) onSelectImage?.(row.id);
    },
    [images, onSelectImage],
  );

  const commitTopSave = useCallback(async () => {
    if (!payload) return;
    await onSaveAllNormal(payload);
    setInitialPromptDraft(cleanEditableAssetPrompt(promptDraft));
    setSavedKeys(new Set([PMT_FIELD_KEY]));
    setTimeout(() => {
      setSavedKeys((prev) => {
        const next = new Set(prev);
        next.delete(PMT_FIELD_KEY);
        return next;
      });
    }, 2000);
  }, [onSaveAllNormal, payload, promptDraft]);

  const commitPmtSave = useCallback(async () => {
    if (!payload) return;
    const nextPrompt = cleanEditableAssetPrompt(editingValue);
    setPromptDraft(nextPrompt);
    const nextPayload = { currentImagePrompt: nextPrompt };
    await onSaveAllNormal(nextPayload);
    setInitialPromptDraft(nextPrompt);
    setEditingKey(null);
    setSavedKeys(new Set([PMT_FIELD_KEY]));
    setTimeout(() => {
      setSavedKeys((prev) => {
        const next = new Set(prev);
        next.delete(PMT_FIELD_KEY);
        return next;
      });
    }, 2000);
  }, [editingValue, onSaveAllNormal, payload]);

  const commitPmtRegen = useCallback(async () => {
    if (!payload) return;
    const nextPrompt = cleanEditableAssetPrompt(promptDraft);
    if (!nextPrompt) return;
    const nextPayload = { currentImagePrompt: nextPrompt };
    setEditingKey(null);
    await onRegeneratePrompt(nextPayload);
    setRegenKeys(new Set([PMT_FIELD_KEY]));
    setTimeout(() => {
      setRegenKeys((prev) => {
        const next = new Set(prev);
        next.delete(PMT_FIELD_KEY);
        return next;
      });
    }, 3000);
  }, [onRegeneratePrompt, payload, promptDraft]);

  const startEdit = useCallback((field: LightboxField) => {
    if (!field.isPmt) return;
    setEditingKey(field.key);
    setEditingValue(field.key === PMT_FIELD_KEY ? promptDraft : field.value);
  }, [promptDraft]);

  const cancelEdit = useCallback(() => {
    setPromptDraft(initialPromptDraft);
    setEditingKey(null);
    setEditingValue('');
  }, [initialPromptDraft]);

  useEffect(() => {
    if (!asset) return undefined;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editingKey) cancelEdit();
        else onClose();
      }
      if (images.length > 1 && !editingKey) {
        if (e.key === 'ArrowLeft') selectImageAt(activeImgIdx - 1);
        if (e.key === 'ArrowRight') selectImageAt(activeImgIdx + 1);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [asset, editingKey, activeImgIdx, images.length, cancelEdit, onClose, selectImageAt]);

  if (!asset || !payload) return null;

  const isPortrait = asset.kind === 'character';
  const typeIcon =
    asset.kind === 'character'
      ? 'ri-user-star-line'
      : asset.kind === 'scene'
        ? 'ri-landscape-line'
        : 'ri-archive-line';
  const subtitle = displayOrDash(formatDisplayValue(asset.assetTypeLabel || asset.typeLabel, ''));
  const descText = displayOrDash(formatDisplayValue(displayDescription || asset.description || '', ''));
  const tags = (asset.tags ?? []).filter(Boolean);
  const canAddImage = (asset.imageCount ?? images.length) < (asset.imageLimit ?? 6);
  const hasMultiple = images.length > 1;
  const currentImg = images[activeImgIdx]?.imageUrl ?? previewSrc;
  const showMainImage = Boolean(currentImg) && !regenerating;

  const isDev = import.meta.env.DEV;
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

  const saveDisabled = saving || regenerating || !isDirty;
  const actionDisabled = saving || regenerating;
  const hasPromptDraft = Boolean(cleanEditableAssetPrompt(promptDraft));
  const regenDisabled = actionDisabled || !hasPromptDraft;


  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 md:p-8"
      style={{
        background: visible ? "rgba(0,0,0,0.52)" : "rgba(0,0,0,0)",
        backdropFilter: visible ? "blur(12px)" : "blur(0px)",
        transition: "background 0.3s ease, backdrop-filter 0.3s ease",
      }}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div
        className="relative flex max-h-[92vh] w-full flex-col overflow-hidden"
        style={{
          maxWidth: isPortrait ? "900px" : "1040px",
          background: "#ffffff",
          borderRadius: "20px",
          border: "1px solid #EAEAEA",
          opacity: visible ? 1 : 0,
          transform: visible ? "scale(1) translateY(0)" : "scale(0.94) translateY(16px)",
          transition: "opacity 0.28s ease, transform 0.28s cubic-bezier(0.16,1,0.3,1)",
        }}
      >
        {/* ── Global action bar ── */}
        <div
          className="flex shrink-0 items-center justify-between px-5 py-3.5"
          style={{ background: "rgba(255,255,255,0.97)", borderBottom: "1px solid #F0F0F5", zIndex: 10 }}
        >
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 flex items-center justify-center rounded-lg shrink-0" style={{ background: "#F5F5F7" }}>
              <i className={`${typeIcon} text-[11px]`} style={{ color: "#8E8E93" }} />
            </div>
            <span className="text-[12.5px] font-semibold" style={{ color: "#1D1D1F" }}>{asset.name}</span>
            <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: "#F5F5F7", color: "#8E8E93" }}>{subtitle}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg text-[12px] font-medium cursor-pointer transition-colors whitespace-nowrap"
              style={{ background: "#F5F5F7", color: "#444444", border: "1px solid #EAEAEA" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#EAEAEA"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#F5F5F7"; }}
            >
              关闭
            </button>
            <button
              type="button"
              disabled={saveDisabled}
              onClick={() => void commitTopSave()}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[12px] font-medium cursor-pointer transition-colors whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50"
              style={{ background: "#1D1D1F", color: "#ffffff" }}
              onMouseEnter={(e) => {
                if (!saveDisabled) (e.currentTarget as HTMLElement).style.background = "#374151";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "#1D1D1F";
              }}
            >
              <i className="ri-save-line text-[11px]" />
              {saving ? "保存中…" : "保存"}
            </button>
          </div>
        </div>

        {/* ── Body: side-by-side ── */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
          {/* Image panel */}
          <div
            className="flex min-h-0 shrink-0 flex-col overflow-hidden"
            style={{
              width: isPortrait ? "min(320px, 38%)" : "min(400px, 42%)",
              background: "#F5F5F7",
              borderRight: "1px solid #EAEAEA",
            }}
          >
            {/* Main image */}
            <div
              className="relative flex items-center justify-center overflow-hidden"
              style={{
                flex: 1,
                minHeight: isPortrait ? "360px" : "260px",
                maxHeight: isPortrait ? "calc(92vh - 200px)" : "340px",
                background: "#F5F5F7",
              }}
            >
              {regenerating ? (
                <div className="flex flex-col items-center justify-center gap-2 px-3">
                  <i className="ri-loader-4-line animate-spin text-2xl text-[#1D1D1F]" aria-hidden />
                  <span className="text-center text-[12px] text-[#6E6E73]">正在重新生成图像…</span>
                </div>
              ) : showMainImage ? (
                <img
                  src={currentImg!}
                  alt={asset.name}
                  className="w-full h-full transition-opacity duration-200"
                  style={{ objectFit: "contain" }}
                />
              ) : (
                <div className="px-3 text-center text-[13px] text-[#8E8E93]">暂无预览图</div>
              )}
              {hasMultiple ? (
                <>
                  <button
                    type="button"
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-full cursor-pointer transition-all"
                    style={{
                      background: activeImgIdx === 0 ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.9)",
                      border: "1px solid rgba(0,0,0,0.08)",
                      opacity: activeImgIdx === 0 ? 0.4 : 1,
                    }}
                    disabled={activeImgIdx === 0}
                    onClick={() => selectImageAt(activeImgIdx - 1)}
                  >
                    <i className="ri-arrow-left-s-line text-[14px]" style={{ color: "#1D1D1F" }} />
                  </button>
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-full cursor-pointer transition-all"
                    style={{
                      background: activeImgIdx === images.length - 1 ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.9)",
                      border: "1px solid rgba(0,0,0,0.08)",
                      opacity: activeImgIdx === images.length - 1 ? 0.4 : 1,
                    }}
                    disabled={activeImgIdx === images.length - 1}
                    onClick={() => selectImageAt(activeImgIdx + 1)}
                  >
                    <i className="ri-arrow-right-s-line text-[14px]" style={{ color: "#1D1D1F" }} />
                  </button>
                  {/* Counter badge */}
                  <div
                    className="absolute bottom-2.5 right-2.5 text-[10px] font-semibold px-2 py-1 rounded-full"
                    style={{ background: "rgba(0,0,0,0.5)", color: "#ffffff" }}
                  >
                    {activeImgIdx + 1} / {images.length}
                  </div>
                </>
              ) : null}
            </div>

            {hasMultiple ? (
              <div
                className="flex gap-1.5 p-2.5 overflow-x-auto"
                style={{ borderTop: "1px solid #EAEAEA", background: "#FAFAFA" }}
              >
                {images.map((imgRow, idx) => (
                  <button
                    key={imgRow.id}
                    type="button"
                    onClick={() => selectImageAt(idx)}
                    className="relative shrink-0 w-12 h-12 rounded-lg overflow-hidden cursor-pointer transition-all"
                    style={{
                      border: activeImgIdx === idx ? "2px solid #1D1D1F" : "2px solid transparent",
                      opacity: activeImgIdx === idx ? 1 : 0.6,
                    }}
                  >
                    <img src={imgRow.imageUrl} alt="" className="w-full h-full" style={{ objectFit: "cover" }} />
                    <span className="absolute bottom-0 right-0 rounded-tl bg-black/65 px-1 text-[9px] leading-[1.4] text-white">
                      {imgRow.sourceType === 'reference' ? '参考' : imgRow.sourceType === 'uploaded' ? '上传' : '生成'}
                    </span>
                  </button>
                ))}
                {canAddImage && onAddImage ? (
                  <button
                    type="button"
                    disabled={imageAnalyzing}
                    onClick={onAddImage}
                    className="shrink-0 w-12 h-12 rounded-lg flex items-center justify-center cursor-pointer transition-all disabled:opacity-50"
                    style={{ border: "1.5px dashed #D1D1D6", background: "#F5F5F7" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#1D1D1F"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#D1D1D6"; }}
                  >
                    <i className="ri-add-line text-[14px]" style={{ color: "#AEAEB2" }} />
                  </button>
                ) : null}
              </div>
            ) : null}
            {imageAnalyzing ? (
              <div className="px-3 py-2 text-[11px] text-[#6E6E73]" style={{ borderTop: "1px solid #EAEAEA", background: "#FAFAFA" }}>
                <i className="ri-loader-4-line mr-1 inline-block animate-spin" aria-hidden />
                正在分析参考图…
              </div>
            ) : null}
            {!hasMultiple && canAddImage && onAddImage ? (
              <button
                type="button"
                disabled={imageAnalyzing}
                onClick={onAddImage}
                className="flex w-full items-center justify-center gap-1.5 border-0 py-2.5 cursor-pointer transition-colors disabled:opacity-50"
                style={{ borderTop: "1px solid #EAEAEA", background: "#FAFAFA" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#F0F0F5"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#FAFAFA"; }}
              >
                <i className="ri-image-add-line text-[12px]" style={{ color: "#AEAEB2" }} />
                <span className="text-[11px]" style={{ color: "#AEAEB2" }}>添加更多图片</span>
              </button>
            ) : null}
          </div>

          {/* Info / edit panel */}
          <div
            className="min-h-0 min-w-0 flex-1 overflow-y-auto"
            style={{ padding: "22px 26px" }}
          >
            {/* Description */}
            <div className="mb-5">
              <p className="text-[10.5px] font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "#AEAEB2" }}>描述</p>
              <p className="text-[13px] leading-relaxed" style={{ color: "#444444" }}>{descText}</p>
            </div>

            {/* Tags */}
            {tags && tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-5">
                {tags.map((tag) => (
                  <span key={tag} className="text-[11px] px-2.5 py-1 rounded-full" style={{ background: "#F0F0F5", color: "#444444" }}>
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Editable fields */}
            {fields && fields.length > 0 && (
              <div className="rounded-xl" style={{ border: "1px solid #EAEAEA" }}>
                {fields.map((field, idx) => {
                  const isEditing = editingKey === field.key;
                  const isSaved = savedKeys.has(field.key);
                  const isRegen = regenKeys.has(field.key);
                  const isLast = idx === fields!.length - 1;

                  return (
                    <div key={field.key} style={{ borderBottom: isLast ? "none" : "1px solid #F5F5F7" }}>
                      {!isEditing && (
                        <div
                          className={`flex items-start gap-3 px-4 py-3 transition-colors group ${field.isPmt ? "cursor-pointer" : "cursor-default"}`}
                          style={{ background: isSaved || isRegen ? "#F0FFF7" : "#ffffff" }}
                          onClick={() => field.isPmt && startEdit(field)}
                          onMouseEnter={(e) => { if (!isSaved && !isRegen) (e.currentTarget as HTMLElement).style.background = "#F9F9FB"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = isSaved || isRegen ? "#F0FFF7" : "#ffffff"; }}
                        >
                          <div className="w-7 h-7 flex items-center justify-center rounded-lg shrink-0 mt-0.5" style={{ background: "#F5F5F7" }}>
                            <i className={`${field.icon} text-[12px]`} style={{ color: "#8E8E93" }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <p className="text-[10.5px]" style={{ color: "#AEAEB2" }}>{field.label}</p>
                              {field.isPmt && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: "#FFF4E6", color: "#D97706" }}>PMT</span>
                              )}
                              {(isSaved || isRegen) && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: "#DCFCE7", color: "#16A34A" }}>
                                  {isRegen ? "已触发重新生成" : "已保存"}
                                </span>
                              )}
                            </div>
                            <p className="text-[12.5px] font-medium break-words" style={{ color: "#1D1D1F" }}>{field.value}</p>
                          </div>
                          {field.isPmt ? (
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1">
                              <i className="ri-pencil-line text-[11px]" style={{ color: "#AEAEB2" }} />
                            </div>
                          ) : null}
                        </div>
                      )}

                      {isEditing && (
                        <div className="px-4 py-3" style={{ background: "#F9F9FB" }}>
                          <div className="flex items-center gap-1.5 mb-2">
                            <div className="w-5 h-5 flex items-center justify-center rounded-md shrink-0" style={{ background: "#F0F0F5" }}>
                              <i className={`${field.icon} text-[10px]`} style={{ color: "#8E8E93" }} />
                            </div>
                            <p className="text-[10.5px] font-semibold" style={{ color: "#444444" }}>{field.label}</p>
                            {field.isPmt && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: "#FFF4E6", color: "#D97706" }}>PMT</span>
                            )}
                          </div>
                          {field.multiline ? (
                            <textarea
                              className="w-full text-[12.5px] rounded-lg px-3 py-2.5 outline-none resize-none"
                              style={{ background: "#ffffff", border: "1.5px solid #1D1D1F", color: "#1D1D1F", minHeight: "80px" }}
                              value={editingValue}
                              onChange={(e) => { const v = e.target.value; setEditingValue(v); setPromptDraft(v); }}
                              autoFocus
                            />
                          ) : (
                            <input
                              className="w-full text-[12.5px] rounded-lg px-3 py-2 outline-none"
                              style={{ background: "#ffffff", border: "1.5px solid #1D1D1F", color: "#1D1D1F" }}
                              value={editingValue}
                              onChange={(e) => { const v = e.target.value; setEditingValue(v); setPromptDraft(v); }}
                              autoFocus
                            />
                          )}
                          <div className="mt-2.5 flex flex-wrap items-center justify-end gap-2">
                            <button
                              type="button"
                              disabled={actionDisabled}
                              onClick={cancelEdit}
                              className="px-3 py-1.5 rounded-lg text-[11.5px] cursor-pointer transition-colors whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50"
                              style={{ background: "#F5F5F7", color: "#444444", border: "1px solid #EAEAEA" }}
                              onMouseEnter={(e) => {
                                if (!actionDisabled) (e.currentTarget as HTMLElement).style.background = "#EAEAEA";
                              }}
                              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#F5F5F7"; }}
                            >
                              取消
                            </button>
                            {field.isPmt ? (
                              <>
                                <button
                                  type="button"
                                  disabled={saveDisabled}
                                  onClick={() => void commitPmtSave()}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11.5px] font-medium cursor-pointer transition-colors whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50"
                                  style={{ background: "#1D1D1F", color: "#ffffff" }}
                                  onMouseEnter={(e) => {
                                    if (!saveDisabled) (e.currentTarget as HTMLElement).style.background = "#374151";
                                  }}
                                  onMouseLeave={(e) => {
                                    (e.currentTarget as HTMLElement).style.background = "#1D1D1F";
                                  }}
                                >
                                  <i className="ri-save-line text-[11px]" />
                                  {saving ? "保存中…" : "保存"}
                                </button>
                                <button
                                  type="button"
                                  disabled={regenDisabled}
                                  onClick={() => void commitPmtRegen()}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11.5px] font-medium cursor-pointer transition-colors whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50"
                                  style={{ background: "#D97706", color: "#ffffff" }}
                                  onMouseEnter={(e) => {
                                    if (!regenDisabled) (e.currentTarget as HTMLElement).style.background = "#B45309";
                                  }}
                                  onMouseLeave={(e) => {
                                    (e.currentTarget as HTMLElement).style.background = "#D97706";
                                  }}
                                >
                                  <i
                                    className={`${regenerating ? "ri-loader-4-line animate-spin" : "ri-refresh-line"} text-[11px]`}
                                    aria-hidden
                                  />
                                  {regenerating ? "生成中…" : "重新生成"}
                                </button>
                              </>
                            ) : null}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {isDev ? (
              <details className="mt-4 rounded-lg border border-dashed border-[#EAEAEA] bg-[#FAFAFA] p-3 text-[11px] text-[#6E6E73]">
                <summary className="cursor-pointer font-medium text-[#444444]">DEV · 调试信息</summary>
                <div className="mt-2 space-y-2">
                  {providerPromptSnapshot ? (
                    <p>
                      <span className="font-medium">provider snapshot：</span>
                      {providerPromptSnapshot}
                    </p>
                  ) : null}
                  {basePromptRaw ? (
                    <pre className="max-h-24 overflow-auto whitespace-pre-wrap break-words rounded bg-white p-2">
                      base_prompt: {basePromptRaw}
                    </pre>
                  ) : null}
                  {providerPromptRaw ? (
                    <pre className="max-h-24 overflow-auto whitespace-pre-wrap break-words rounded bg-white p-2">
                      provider_prompt: {providerPromptRaw}
                    </pre>
                  ) : null}
                  {promptSnapshotRaw ? (
                    <pre className="max-h-24 overflow-auto whitespace-pre-wrap break-words rounded bg-white p-2">
                      prompt_snapshot: {promptSnapshotRaw}
                    </pre>
                  ) : null}
                  {providerParamsText ? (
                    <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-words rounded bg-white p-2">
                      provider_params: {providerParamsText}
                    </pre>
                  ) : null}
                  {typeFieldsText ? (
                    <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded bg-white p-2">
                      type_fields: {typeFieldsText}
                    </pre>
                  ) : null}
                  {debugMetaText ? (
                    <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-words rounded bg-white p-2">
                      meta: {debugMetaText}
                    </pre>
                  ) : null}
                </div>
              </details>
            ) : null}
            <p className="text-center text-[11px] mt-5" style={{ color: "#C7C7CC" }}>
              点击 PMT 字段可编辑 · ESC 取消编辑 / 关闭
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
