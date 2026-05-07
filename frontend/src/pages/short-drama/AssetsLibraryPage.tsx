import { useCallback, useEffect, useMemo, useState } from 'react';
import { SDWorkflowNav } from './components/SDWorkflowNav';
import { useEffectiveShortDramaProjectId } from './hooks/useEffectiveShortDramaProjectId';
import {
  createShortDramaAssetLibrary,
  deleteShortDramaAssetLibrary,
  deleteShortDramaAssetLibraryImage,
  getShortDramaAssetLibraryDetail,
  listShortDramaAssetLibrary,
  regenerateShortDramaAssetLibrary,
  setShortDramaAssetLibraryCover,
  ShortDramaApiError,
  updateShortDramaAssetLibrary,
} from '@/services/shortDramaApi';
import type { AssetLibraryItemDto } from '@/types/shortDramaApi';

type Tab = 'character' | 'scene' | 'product';

const TAB_LABEL: Record<Tab, string> = {
  character: '角色',
  scene: '场景',
  product: '产品',
};

function toDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.readAsDataURL(file);
  });
}

export function ShortDramaAssetsLibraryPage() {
  const { effectiveProjectId, projectName } = useEffectiveShortDramaProjectId();
  const [activeTab, setActiveTab] = useState<Tab>('character');
  const [listMap, setListMap] = useState<Record<Tab, AssetLibraryItemDto[]>>({ character: [], scene: [], product: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<AssetLibraryItemDto | null>(null);
  const [selectedImageId, setSelectedImageId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [createPrompt, setCreatePrompt] = useState('');
  const [createCount, setCreateCount] = useState(4);
  const [createVariant, setCreateVariant] = useState('');
  const [createTypeFields, setCreateTypeFields] = useState('');
  const [createRefFiles, setCreateRefFiles] = useState<File[]>([]);
  const [regenCount, setRegenCount] = useState(1);
  const [regenVariant, setRegenVariant] = useState('');

  const reload = useCallback(async () => {
    if (effectiveProjectId == null) return;
    setLoading(true);
    setError(null);
    try {
      const [c, s, p] = await Promise.all([
        listShortDramaAssetLibrary(effectiveProjectId, 'character'),
        listShortDramaAssetLibrary(effectiveProjectId, 'scene'),
        listShortDramaAssetLibrary(effectiveProjectId, 'product'),
      ]);
      setListMap({ character: c.assets, scene: s.assets, product: p.assets });
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [effectiveProjectId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const activeList = listMap[activeTab];
  const selectedImage = useMemo(
    () => detail?.images.find((img) => img.id === selectedImageId) ?? detail?.images[0] ?? null,
    [detail, selectedImageId],
  );

  const openDetail = useCallback(
    async (assetId: number) => {
      if (effectiveProjectId == null) return;
      const row = await getShortDramaAssetLibraryDetail(effectiveProjectId, assetId);
      setDetail(row);
      setSelectedImageId(row.cover_image_id ?? row.images[0]?.id ?? null);
      setRegenCount(1);
      setRegenVariant('');
    },
    [effectiveProjectId],
  );

  const onCreate = useCallback(async () => {
    if (effectiveProjectId == null || !createName.trim()) return;
    try {
      const refs = await Promise.all(
        createRefFiles.map(async (f) => ({
          file_name: f.name,
          file_url: await toDataUrl(f),
        })),
      );
      const typeFields = createTypeFields.trim() ? JSON.parse(createTypeFields) : {};
      await createShortDramaAssetLibrary({
        project_id: effectiveProjectId,
        asset_type: activeTab,
        name: createName.trim(),
        description: createDesc.trim(),
        base_prompt: createPrompt.trim(),
        generate_count: createCount,
        variant_directions: createVariant
          .split(/[,，]/)
          .map((x) => x.trim())
          .filter(Boolean),
        reference_images: refs,
        type_fields: typeFields,
      });
      setShowCreate(false);
      setCreateName('');
      setCreateDesc('');
      setCreatePrompt('');
      setCreateCount(4);
      setCreateVariant('');
      setCreateTypeFields('');
      setCreateRefFiles([]);
      await reload();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '创建失败');
    }
  }, [activeTab, createCount, createDesc, createName, createPrompt, createRefFiles, createTypeFields, createVariant, effectiveProjectId, reload]);

  const onRegenerate = useCallback(async () => {
    if (effectiveProjectId == null || detail == null) return;
    try {
      await regenerateShortDramaAssetLibrary({
        project_id: effectiveProjectId,
        asset_id: detail.id,
        generate_count: regenCount,
        variant_directions: regenVariant
          .split(/[,，]/)
          .map((x) => x.trim())
          .filter(Boolean),
        reuse_reference_images: true,
      });
      await reload();
      await openDetail(detail.id);
    } catch (e) {
      const msg = e instanceof ShortDramaApiError ? e.message : e instanceof Error ? e.message : '补图失败';
      window.alert(msg);
    }
  }, [detail, effectiveProjectId, openDetail, regenCount, regenVariant, reload]);

  return (
    <div className="min-h-screen bg-white">
      <SDWorkflowNav currentStep={3} projectName={projectName ?? undefined} projectId={effectiveProjectId} />
      <div className="px-6 pt-20 lg:px-10">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-[#1D1D1F]">角色与场景资产</h1>
            <p className="text-sm text-[#6E6E73]">资产主体 + 多变体图（每资产最多 6 张）</p>
          </div>
          <button className="rounded-lg bg-[#1D1D1F] px-4 py-2 text-sm text-white" onClick={() => setShowCreate(true)} type="button">
            添加{TAB_LABEL[activeTab]}
          </button>
        </div>
        <div className="mb-4 flex gap-2">
          {(['character', 'scene', 'product'] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setActiveTab(t)}
              className={`rounded-lg px-4 py-2 text-sm ${activeTab === t ? 'bg-[#1D1D1F] text-white' : 'bg-[#F5F5F7] text-[#444]'}`}
            >
              {TAB_LABEL[t]} ({listMap[t].length})
            </button>
          ))}
        </div>
        {loading ? <div className="text-sm text-[#8E8E93]">加载中…</div> : null}
        {error ? <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {activeList.map((asset) => (
            <div key={asset.id} className="rounded-xl border border-[#EAEAEA] bg-white p-3">
              <div className="mb-2 h-40 overflow-hidden rounded-lg bg-[#F5F5F7]">
                {asset.cover_image?.image_url ? <img src={asset.cover_image.image_url} className="h-full w-full object-cover" alt={asset.name} /> : null}
              </div>
              <div className="mb-1 flex items-center justify-between">
                <h3 className="font-semibold text-[#1D1D1F]">{asset.name}</h3>
                <span className="text-xs text-[#6E6E73]">{asset.image_count}/6</span>
              </div>
              <p className="mb-2 text-xs text-[#6E6E73]">{asset.description || '暂无描述'}</p>
              <div className="mb-2 flex gap-1">
                {asset.images.slice(0, 3).map((img) => (
                  <img key={img.id} src={img.image_url} className="h-10 w-10 rounded border border-[#EAEAEA] object-cover" alt={img.variant_label ?? 'thumb'} />
                ))}
                {asset.has_reference_images ? <span className="ml-1 text-xs text-[#0A7]">有参考图</span> : null}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => void openDetail(asset.id)}>
                  查看详情
                </button>
                <button
                  type="button"
                  className="rounded border px-2 py-1 text-xs"
                  onClick={async () => {
                    if (!effectiveProjectId) return;
                    const name = window.prompt('新名称', asset.name);
                    if (name == null) return;
                    await updateShortDramaAssetLibrary(asset.id, { project_id: effectiveProjectId, name });
                    await reload();
                  }}
                >
                  编辑
                </button>
                <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => void openDetail(asset.id)}>
                  再生成
                </button>
                <button
                  type="button"
                  className="rounded border border-red-200 px-2 py-1 text-xs text-red-600"
                  onClick={async () => {
                    if (!effectiveProjectId) return;
                    if (!window.confirm('确认删除整个资产？')) return;
                    await deleteShortDramaAssetLibrary(effectiveProjectId, asset.id);
                    await reload();
                  }}
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showCreate ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white p-4">
            <h3 className="mb-3 text-lg font-bold">添加{TAB_LABEL[activeTab]}资产</h3>
            <div className="grid gap-2">
              <input className="rounded border px-3 py-2 text-sm" placeholder="名称" value={createName} onChange={(e) => setCreateName(e.target.value)} />
              <textarea className="rounded border px-3 py-2 text-sm" placeholder="描述" value={createDesc} onChange={(e) => setCreateDesc(e.target.value)} />
              <textarea className="rounded border px-3 py-2 text-sm" placeholder="Base Prompt" value={createPrompt} onChange={(e) => setCreatePrompt(e.target.value)} />
              <input className="rounded border px-3 py-2 text-sm" placeholder="变体方向（逗号分隔）" value={createVariant} onChange={(e) => setCreateVariant(e.target.value)} />
              <textarea
                className="rounded border px-3 py-2 text-sm"
                placeholder='类型字段 JSON，如 {"appearance":"..."}'
                value={createTypeFields}
                onChange={(e) => setCreateTypeFields(e.target.value)}
              />
              <label className="text-xs text-[#6E6E73]">生成数量：{createCount}</label>
              <input type="range" min={1} max={6} value={createCount} onChange={(e) => setCreateCount(Number(e.target.value))} />
              <input type="file" multiple accept="image/*" onChange={(e) => setCreateRefFiles(Array.from(e.target.files || []))} />
              <div className="text-xs text-[#6E6E73]">参考图数量：{createRefFiles.length}</div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="rounded border px-3 py-1.5 text-sm" onClick={() => setShowCreate(false)} type="button">取消</button>
              <button className="rounded bg-[#1D1D1F] px-3 py-1.5 text-sm text-white" onClick={() => void onCreate()} type="button">创建并生成</button>
            </div>
          </div>
        </div>
      ) : null}

      {detail ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="flex h-[85vh] w-full max-w-6xl overflow-hidden rounded-xl bg-white">
            <div className="flex w-1/2 flex-col border-r p-3">
              <div className="flex-1 rounded bg-[#F5F5F7]">
                {selectedImage ? <img src={selectedImage.image_url} alt={detail.name} className="h-full w-full object-contain" /> : null}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {detail.images.map((img) => (
                  <button key={img.id} type="button" className={`h-14 w-14 overflow-hidden rounded border ${selectedImageId === img.id ? 'border-black' : 'border-[#EAEAEA]'}`} onClick={() => setSelectedImageId(img.id)}>
                    <img src={img.image_url} alt={img.variant_label ?? 'thumb'} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
            <div className="flex w-1/2 flex-col gap-3 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">{detail.name}</h3>
                <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => setDetail(null)}>关闭</button>
              </div>
              <div className="text-xs text-[#6E6E73]">类型：{detail.asset_type} | 来源：{detail.source} | 图片：{detail.image_count}/6</div>
              <textarea
                className="min-h-[80px] rounded border px-3 py-2 text-sm"
                value={detail.description ?? ''}
                onChange={(e) => setDetail({ ...detail, description: e.target.value })}
              />
              <textarea className="min-h-[80px] rounded border px-3 py-2 text-sm" value={detail.base_prompt ?? ''} onChange={(e) => setDetail({ ...detail, base_prompt: e.target.value })} />
              <div className="text-xs text-[#6E6E73]">参考图：{detail.reference_images.length}（不计入 6 张上限）</div>
              <div className="flex flex-wrap gap-2">
                {detail.reference_images.map((r) => (
                  <img key={r.id} src={r.file_url} alt={r.file_name ?? 'reference'} className="h-12 w-12 rounded border object-cover" />
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="rounded border px-2 py-1 text-xs"
                  onClick={async () => {
                    if (!effectiveProjectId || !selectedImage) return;
                    await setShortDramaAssetLibraryCover(detail.id, { project_id: effectiveProjectId, image_id: selectedImage.id });
                    await openDetail(detail.id);
                    await reload();
                  }}
                >
                  设为封面
                </button>
                <button
                  type="button"
                  className="rounded border border-red-200 px-2 py-1 text-xs text-red-600"
                  onClick={async () => {
                    if (!effectiveProjectId || !selectedImage) return;
                    await deleteShortDramaAssetLibraryImage(effectiveProjectId, selectedImage.id);
                    await openDetail(detail.id);
                    await reload();
                  }}
                >
                  删除当前图
                </button>
                <button
                  type="button"
                  className="rounded border px-2 py-1 text-xs"
                  onClick={async () => {
                    if (!effectiveProjectId) return;
                    await updateShortDramaAssetLibrary(detail.id, {
                      project_id: effectiveProjectId,
                      name: detail.name,
                      description: detail.description ?? '',
                      base_prompt: detail.base_prompt ?? '',
                    });
                    await reload();
                  }}
                >
                  保存主信息
                </button>
                <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => void onRegenerate()}>
                  补图（再生成）
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input type="number" min={1} max={6} value={regenCount} onChange={(e) => setRegenCount(Number(e.target.value || 1))} className="rounded border px-2 py-1 text-xs" />
                <input value={regenVariant} onChange={(e) => setRegenVariant(e.target.value)} className="rounded border px-2 py-1 text-xs" placeholder="补图方向（逗号分隔）" />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

