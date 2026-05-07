import { useState } from 'react';
import type { ProductInputDraft } from '@/types/shortDrama';
import { ri, sdColors } from '../utils/shortDramaHelpers';

type Props = {
  draft: ProductInputDraft;
  setDraft: (next: ProductInputDraft | ((prev: ProductInputDraft) => ProductInputDraft)) => void;
};

export function ProductInputForm({ draft, setDraft }: Props) {
  const [spInput, setSpInput] = useState('');
  const [scenarioInput, setScenarioInput] = useState('');
  const inputCls =
    'w-full rounded-lg border border-[#EAEAEA] bg-[#F7F8FA] px-3 py-2.5 text-[13px] outline-none transition-colors focus:border-[#1D1D1F] focus:bg-white';

  const addSellingPoint = (raw: string) => {
    const t = raw.trim();
    if (!t) return;
    setDraft((prev) => ({ ...prev, sellingPointsRaw: [...prev.sellingPointsRaw, t] }));
  };

  const removeSellingPoint = (idx: number) => {
    setDraft((prev) => ({ ...prev, sellingPointsRaw: prev.sellingPointsRaw.filter((_, i) => i !== idx) }));
  };

  const addUsageScenario = (raw: string) => {
    const t = raw.trim();
    if (!t) return;
    setDraft((prev) => ({ ...prev, usageScenariosRaw: [...prev.usageScenariosRaw, t] }));
  };

  const removeUsageScenario = (idx: number) => {
    setDraft((prev) => ({ ...prev, usageScenariosRaw: prev.usageScenariosRaw.filter((_, i) => i !== idx) }));
  };

  const toDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('读取图片失败'));
      reader.readAsDataURL(file);
    });

  const onUploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const dataUrls = await Promise.all(Array.from(files).map((f) => toDataUrl(f)));
    setDraft((prev) => {
      const base = prev.productImages.length;
      const next = dataUrls.map((url, idx) => ({
        imageUrl: url,
        imageOrder: base + idx,
        isMainImage: prev.productImages.length === 0 && idx === 0,
        imageCaptionRaw: '',
      }));
      return { ...prev, productImages: [...prev.productImages, ...next] };
    });
  };

  const removeImage = (idx: number) => {
    setDraft((prev) => {
      const after = prev.productImages.filter((_, i) => i !== idx);
      if (after.length > 0 && !after.some((i) => i.isMainImage)) {
        after[0] = { ...after[0], isMainImage: true };
      }
      return { ...prev, productImages: after.map((x, i) => ({ ...x, imageOrder: i })) };
    });
  };

  const setMainImage = (idx: number) => {
    setDraft((prev) => ({
      ...prev,
      productImages: prev.productImages.map((img, i) => ({ ...img, isMainImage: i === idx })),
    }));
  };

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-[#EAEAEA] bg-white p-6">
        <h2 className="mb-5 flex items-center gap-2 text-[13px] font-bold text-[#444444]">
          <span
            className="flex h-6 w-6 items-center justify-center rounded-lg"
            style={{ background: sdColors.surface2 }}
          >
            <i className={ri('ri-information-line', 'text-[12px] text-[#1D1D1F]')} aria-hidden />
          </span>
          基础信息
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-[#6E6E73]">产品名称 *</label>
            <input
              className={inputCls}
              value={draft.productNameRaw}
              onChange={(e) => setDraft((p) => ({ ...p, productNameRaw: e.target.value }))}
              placeholder="例如：夏季轻薄连衣裙"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-[#6E6E73]">品牌名称</label>
            <input
              className={inputCls}
              value={draft.brandRaw}
              onChange={(e) => setDraft((p) => ({ ...p, brandRaw: e.target.value }))}
              placeholder="例如：NordHome"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-[#6E6E73]">目标用户</label>
            <input
              className={inputCls}
              value={draft.targetUsersRaw}
              onChange={(e) => setDraft((p) => ({ ...p, targetUsersRaw: e.target.value }))}
              placeholder="例如：通勤女性、宝妈"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-[#6E6E73]">产品分类</label>
            <input
              className={inputCls}
              value={draft.productCategoryRaw}
              onChange={(e) => setDraft((p) => ({ ...p, productCategoryRaw: e.target.value }))}
              placeholder="例如：女装 / 家居清洁 / 个护"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-[#6E6E73]">价格/价格带</label>
            <input
              className={inputCls}
              value={draft.priceRaw}
              onChange={(e) => setDraft((p) => ({ ...p, priceRaw: e.target.value }))}
              placeholder="例如：￥199-299"
            />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[#EAEAEA] bg-white p-6">
        <h2 className="mb-5 flex items-center gap-2 text-[13px] font-bold text-[#444444]">
          <span
            className="flex h-6 w-6 items-center justify-center rounded-lg"
            style={{ background: sdColors.surface2 }}
          >
            <i className={ri('ri-file-list-3-line', 'text-[12px] text-[#1D1D1F]')} aria-hidden />
          </span>
          产品描述
        </h2>
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-[12px] font-medium text-[#6E6E73]">核心卖点</label>
            <div className="mb-2 flex flex-wrap gap-2">
              {draft.sellingPointsRaw.map((sp, idx) => (
                <span
                  key={`${sp}-${idx}`}
                  className="flex items-center gap-1.5 rounded-lg border border-[#E5E5EA] bg-[#F5F5F7] px-3 py-1.5 text-[12px] text-[#1D1D1F]"
                >
                  {sp}
                  <button type="button" onClick={() => removeSellingPoint(idx)} className="text-[#8E8E93]">
                    <i className={ri('ri-close-line', 'text-[11px]')} aria-hidden />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                className={inputCls}
                value={spInput}
                onChange={(e) => setSpInput(e.target.value)}
                placeholder="输入卖点，回车添加"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addSellingPoint(spInput);
                    setSpInput('');
                  }
                }}
              />
              <button
                type="button"
                className="whitespace-nowrap rounded-lg border border-[#EAEAEA] bg-[#F5F5F7] px-4 py-2.5 text-[13px] font-medium text-[#444444] hover:bg-[#1D1D1F] hover:text-white"
                onClick={() => {
                  addSellingPoint(spInput);
                  setSpInput('');
                }}
              >
                添加
              </button>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-[#6E6E73]">使用场景</label>
            <div className="mb-2 flex flex-wrap gap-2">
              {draft.usageScenariosRaw.map((sp, idx) => (
                <span key={`${sp}-${idx}`} className="flex items-center gap-1.5 rounded-lg border border-[#E5E5EA] bg-[#F5F5F7] px-3 py-1.5 text-[12px] text-[#1D1D1F]">
                  {sp}
                  <button type="button" onClick={() => removeUsageScenario(idx)} className="text-[#8E8E93]">
                    <i className={ri('ri-close-line', 'text-[11px]')} aria-hidden />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                className={inputCls}
                value={scenarioInput}
                onChange={(e) => setScenarioInput(e.target.value)}
                placeholder="输入场景，回车添加"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addUsageScenario(scenarioInput);
                    setScenarioInput('');
                  }
                }}
              />
              <button type="button" className="whitespace-nowrap rounded-lg border border-[#EAEAEA] bg-[#F5F5F7] px-4 py-2.5 text-[13px] font-medium text-[#444444] hover:bg-[#1D1D1F] hover:text-white" onClick={() => { addUsageScenario(scenarioInput); setScenarioInput(''); }}>
                添加
              </button>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-[#6E6E73]">补充说明</label>
            <textarea
              className={`${inputCls} resize-none`}
              rows={2}
              value={draft.extraNotesRaw}
              onChange={(e) => setDraft((p) => ({ ...p, extraNotesRaw: e.target.value }))}
              placeholder="例如：请优先突出质感、细节和真实使用动作"
            />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[#EAEAEA] bg-white p-6">
        <h2 className="mb-5 flex items-center gap-2 text-[13px] font-bold text-[#444444]">
          <span
            className="flex h-6 w-6 items-center justify-center rounded-lg"
            style={{ background: sdColors.surface2 }}
          >
            <i className={ri('ri-image-add-line', 'text-[12px] text-[#1D1D1F]')} aria-hidden />
          </span>
          图片资料（多图）
        </h2>
        <label className="mb-4 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[#EAEAEA] bg-[#F7F8FA] px-4 py-2 text-[12px] text-[#444444]">
          <i className={ri('ri-upload-2-line', 'text-[13px]')} aria-hidden />
          上传产品图
          <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => void onUploadFiles(e.target.files)} />
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {draft.productImages.map((img, idx) => (
            <div key={`${img.imageUrl}-${idx}`} className="rounded-xl border border-[#EAEAEA] p-3">
              <img src={img.imageUrl} alt={`product-${idx}`} className="mb-2 h-36 w-full rounded-lg object-cover" />
              <div className="mb-2 flex items-center gap-2">
                <button type="button" className={`rounded px-2 py-1 text-[11px] ${img.isMainImage ? 'bg-[#1D1D1F] text-white' : 'bg-[#F5F5F7] text-[#444444]'}`} onClick={() => setMainImage(idx)}>
                  {img.isMainImage ? '主图' : '设为主图'}
                </button>
                <button type="button" className="rounded bg-[#FEF2F2] px-2 py-1 text-[11px] text-[#B91C1C]" onClick={() => removeImage(idx)}>
                  删除
                </button>
              </div>
              <input
                className={inputCls}
                value={img.imageCaptionRaw}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    productImages: prev.productImages.map((item, i) =>
                      i === idx ? { ...item, imageCaptionRaw: e.target.value } : item,
                    ),
                  }))
                }
                placeholder="图片说明（可选）"
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
