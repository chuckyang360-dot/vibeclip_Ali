import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  createFreeCreationSegment,
  generateFreeCreationSegment,
  getFreeCreationProject,
  mergeFreeCreationProject,
  updateFreeCreationSegment,
  uploadFreeCreationAsset,
  type FreeCreationAsset,
  type FreeCreationInputAsset,
  type FreeCreationProject,
  type FreeCreationSegment,
} from '@/services/freeCreationApi';
import { SDWorkflowNav } from '../short-drama/components/SDWorkflowNav';
import { ri } from '../short-drama/utils/shortDramaHelpers';

const modelOptions = [
  { label: 'Seedance 2.0', value: 'doubao-seedance-2-0-260128' },
  { label: 'Seedance 2.0 Fast', value: 'doubao-seedance-2-0-fast-260128' },
];
const ratioOptions = ['9:16', '16:9', '1:1', '3:4'];
const durationOptions = [4, 5, 8, 11, 15];
const colors = ['#B45309', '#DC2626', '#047857', '#334155', '#9333EA', '#0F766E'];

function parseId(raw?: string): number | null {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

function toInputAsset(asset: FreeCreationAsset): FreeCreationInputAsset {
  return {
    type: asset.type,
    url: asset.url,
    storage_key: asset.storage_key,
    file_name: asset.file_name,
    mime_type: asset.mime_type,
    file_size: asset.file_size,
    role: asset.role,
    label: asset.label,
  };
}

function modelLabel(value: string): string {
  return modelOptions.find((m) => m.value === value)?.label || value || 'Seedance 2.0';
}

function assetIcon(type: string): string {
  if (type === 'video') return 'ri-movie-2-line';
  if (type === 'audio') return 'ri-volume-up-line';
  return 'ri-image-line';
}

function statusText(status: string): string {
  const s = status.toLowerCase();
  if (s === 'completed') return '已完成';
  if (s === 'running') return '生成中';
  if (s === 'queued') return '排队中';
  if (s === 'failed') return '失败';
  return '待生成';
}

export function FreeCreationVideoPage() {
  const navigate = useNavigate();
  const { projectId: projectIdRaw } = useParams();
  const projectId = parseId(projectIdRaw);
  const [project, setProject] = useState<FreeCreationProject | null>(null);
  const [activeSegmentId, setActiveSegmentId] = useState<number | null>(null);
  const [draftPrompt, setDraftPrompt] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewTarget, setPreviewTarget] = useState<'segment' | 'final'>('segment');
  const [mentionOpen, setMentionOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);

  const activeSegment = useMemo(() => {
    const rows = project?.segments || [];
    return rows.find((s) => s.id === activeSegmentId) || rows[0] || null;
  }, [activeSegmentId, project?.segments]);

  useEffect(() => {
    setDraftPrompt(activeSegment?.prompt || '');
    setMentionOpen(false);
  }, [activeSegment?.id]);

  const allSegmentsReady = Boolean(project?.segments.length) && project!.segments.every((s) => Boolean(s.video_url));
  const activeColor = activeSegment ? colors[(activeSegment.segment_index - 1) % colors.length] : '#B45309';
  const previewUrl = previewTarget === 'final' ? project?.final_video_url : activeSegment?.video_url;

  const refresh = async () => {
    if (!projectId) return;
    const data = await getFreeCreationProject(projectId);
    setProject(data);
    setActiveSegmentId((prev) => prev || data.segments[0]?.id || null);
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!projectId) {
        setError('自由创作项目 ID 无效。');
        setLoading(false);
        return;
      }
      try {
        const data = await getFreeCreationProject(projectId);
        if (cancelled) return;
        setProject(data);
        setActiveSegmentId(data.segments[0]?.id || null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '项目加载失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    if (!project) return;
    const active = project.segments.some((s) => ['queued', 'running'].includes(s.status.toLowerCase()));
    const merging = ['queued', 'running'].includes(project.final_render_status.toLowerCase());
    if (!active && !merging) return;
    const id = window.setInterval(() => {
      void refresh();
    }, 3000);
    return () => window.clearInterval(id);
  }, [project]);

  const patchActive = async (patch: Partial<FreeCreationSegment> & { input_assets?: FreeCreationInputAsset[] }): Promise<FreeCreationSegment | null> => {
    if (!activeSegment) return null;
    setBusy(true);
    setError(null);
    try {
      const next = await updateFreeCreationSegment(activeSegment.id, {
        title: patch.title,
        prompt: patch.prompt,
        model: patch.model,
        ratio: patch.ratio,
        resolution: patch.resolution,
        duration: patch.duration,
        generate_audio: patch.generate_audio,
        watermark: patch.watermark,
        assets: patch.input_assets,
      });
      setProject((prev) => {
        if (!prev) return prev;
        return { ...prev, segments: prev.segments.map((s) => (s.id === next.id ? next : s)) };
      });
      return next;
    } catch (e) {
      setError(e instanceof Error ? e.message : '片段保存失败');
      return null;
    } finally {
      setBusy(false);
    }
  };

  const persistActivePrompt = async (): Promise<FreeCreationSegment | null> => {
    if (!activeSegment) return null;
    if (draftPrompt === activeSegment.prompt) return activeSegment;
    return patchActive({ prompt: draftPrompt });
  };

  const handleUpload = async (files: FileList | null) => {
    if (!projectId || !files?.length) return;
    setBusy(true);
    setError(null);
    try {
      await Promise.all(Array.from(files).map((file) => uploadFreeCreationAsset(projectId, file)));
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : '素材上传失败');
    } finally {
      setBusy(false);
    }
  };

  const toggleAsset = async (asset: FreeCreationAsset) => {
    if (!activeSegment) return;
    const exists = activeSegment.input_assets.some((a) => a.url === asset.url);
    const next = exists
      ? activeSegment.input_assets.filter((a) => a.url !== asset.url)
      : [...activeSegment.input_assets, toInputAsset(asset)];
    await patchActive({ input_assets: next });
  };

  const handlePromptChange = (value: string) => {
    setDraftPrompt(value);
    setMentionOpen(value.endsWith('@'));
  };

  const insertMentionAsset = async (asset: FreeCreationAsset) => {
    if (!activeSegment) return;
    const label = asset.label || asset.file_name || `@素材${asset.id}`;
    const current = draftPrompt || '';
    const atIndex = current.lastIndexOf('@');
    const prompt =
      atIndex >= 0
        ? `${current.slice(0, atIndex)}${label} ${current.slice(atIndex + 1)}`
        : `${current}${current.endsWith(' ') || !current ? '' : ' '}${label} `;
    const exists = activeSegment.input_assets.some((a) => a.url === asset.url);
    const input_assets = exists ? activeSegment.input_assets : [...activeSegment.input_assets, toInputAsset(asset)];
    setDraftPrompt(prompt);
    setMentionOpen(false);
    await patchActive({ prompt, input_assets });
    window.setTimeout(() => promptRef.current?.focus(), 0);
  };

  const addSegment = async () => {
    if (!projectId) return;
    setBusy(true);
    setError(null);
    try {
      const seg = await createFreeCreationSegment(projectId, {
        title: `片段 ${(project?.segments.length || 0) + 1}`,
        prompt: '',
        model: activeSegment?.model || 'doubao-seedance-2-0-260128',
        ratio: activeSegment?.ratio || '9:16',
        resolution: '720p',
        duration: activeSegment?.duration || 5,
        generate_audio: activeSegment?.generate_audio ?? true,
        watermark: false,
      });
      await refresh();
      setActiveSegmentId(seg.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : '新增片段失败');
    } finally {
      setBusy(false);
    }
  };

  const generateActive = async () => {
    if (!activeSegment) return;
    setBusy(true);
    setError(null);
    try {
      const saved = await persistActivePrompt();
      if (draftPrompt.trim() && !saved) return;
      await generateFreeCreationSegment(activeSegment.id);
      await refresh();
      setPreviewTarget('segment');
    } catch (e) {
      setError(e instanceof Error ? e.message : '片段生成失败');
    } finally {
      setBusy(false);
    }
  };

  const mergeProject = async () => {
    if (!projectId) return;
    setBusy(true);
    setError(null);
    try {
      await mergeFreeCreationProject(projectId);
      await refresh();
      setPreviewTarget('final');
    } catch (e) {
      setError(e instanceof Error ? e.message : '合成失败');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F8FA]">
        <SDWorkflowNav currentStep={4} workflowMode="free_creation" />
        <main className="flex min-h-screen items-center justify-center text-[14px] text-[#8E8E93]">自由创作项目加载中</main>
      </div>
    );
  }

  if (error && !project) {
    return (
      <div className="min-h-screen bg-[#F7F8FA]">
        <SDWorkflowNav currentStep={4} workflowMode="free_creation" />
        <main className="flex min-h-screen flex-col items-center justify-center gap-4 text-[14px] text-[#8E8E93]">
          <p>{error}</p>
          <button type="button" onClick={() => navigate('/short-drama/create?mode=free_creation')} className="rounded-lg bg-[#1D1D1F] px-4 py-2 text-white">
            返回自由创作
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F8FA]" style={{ fontFamily: "'Inter', sans-serif" }}>
      <SDWorkflowNav
        currentStep={4}
        projectId={projectId}
        projectName={project?.project_name}
        workflowMode="free_creation"
      />
      <main className="grid h-screen grid-cols-[260px_minmax(0,1fr)_320px] pt-14">
        <aside className="min-h-0 border-r border-[#E5E5EA] bg-[#F7F8FA] px-4 py-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[13px] font-black text-[#6E6E73]">项目素材库</h2>
            <button type="button" onClick={() => fileRef.current?.click()} className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E5E5EA] bg-white text-[#6E6E73]">
              <i className={ri('ri-add-line', 'text-[15px]')} aria-hidden />
            </button>
          </div>
          <input ref={fileRef} type="file" multiple accept="image/*,video/*,audio/*" className="hidden" onChange={(e) => void handleUpload(e.target.files)} />
          <div className="space-y-2 overflow-y-auto">
            {project?.assets.length ? project.assets.map((asset) => {
              const selected = activeSegment?.input_assets.some((a) => a.url === asset.url);
              return (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => void toggleAsset(asset)}
                  className={`flex w-full items-center gap-3 rounded-lg border bg-white p-3 text-left transition ${selected ? 'border-[#1D1D1F]' : 'border-[#E5E5EA] hover:border-[#B9C0CE]'}`}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#F2F4F8] text-[#6E6E73]">
                    <i className={ri(assetIcon(asset.type), 'text-[16px]')} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-black text-[#1D1D1F]">{asset.label || asset.file_name}</span>
                    <span className="block truncate text-[11px] text-[#8E8E93]">{asset.file_name}</span>
                  </span>
                  {selected ? <i className={ri('ri-check-line', 'text-[15px] text-[#047857]')} aria-hidden /> : null}
                </button>
              );
            }) : (
              <button type="button" onClick={() => fileRef.current?.click()} className="flex h-28 w-full flex-col items-center justify-center rounded-xl border border-dashed border-[#D6DCE8] bg-white text-[12px] text-[#8E8E93]">
                <i className={ri('ri-upload-cloud-2-line', 'mb-2 text-[22px]')} aria-hidden />
                上传参考素材
              </button>
            )}
          </div>
        </aside>

        <section className="flex min-h-0 flex-col bg-white">
          <div className="border-b border-[#E5E5EA] px-8 py-5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-widest text-[#8E8E93]">Free Creation · Video</p>
                <h1 className="mt-2 text-[26px] font-black text-[#1D1D1F]">自由创作片段</h1>
              </div>
              <button
                type="button"
                onClick={() => void generateActive()}
                disabled={busy || !draftPrompt.trim()}
                className="flex items-center gap-2 rounded-xl bg-[#1D1D1F] px-5 py-2.5 text-[13px] font-bold text-white disabled:bg-[#D1D5DB]"
              >
                <i className={ri(activeSegment?.status === 'running' ? 'ri-loader-4-line animate-spin' : 'ri-magic-line', 'text-[14px]')} aria-hidden />
                {activeSegment?.video_url ? '重新生成' : '生成当前片段'}
              </button>
            </div>
            {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800">{error}</p> : null}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
            {activeSegment ? (
              <article className="rounded-2xl border bg-[#F7F8FA] p-5" style={{ borderColor: `${activeColor}55` }}>
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg text-[14px] font-black" style={{ background: `${activeColor}18`, color: activeColor }}>
                      S{activeSegment.segment_index}
                    </span>
                    <div>
                      <input
                        value={activeSegment.title}
                        onChange={(e) => void patchActive({ title: e.target.value })}
                        className="h-8 w-[320px] rounded-md border border-transparent bg-transparent px-2 text-[18px] font-black text-[#1D1D1F] outline-none hover:border-[#E5E5EA] focus:border-[#1D1D1F] focus:bg-white"
                      />
                      <p className="text-[12px] text-[#8E8E93]">{statusText(activeSegment.status)}</p>
                      {activeSegment.error_message ? (
                        <p className="mt-1 max-w-[620px] break-words text-[12px] text-red-700">
                          {activeSegment.error_message}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="mb-4 grid grid-cols-4 gap-3">
                  <label className="text-[12px] font-bold text-[#6E6E73]">
                    模型
                    <select value={activeSegment.model} onChange={(e) => void patchActive({ model: e.target.value })} className="mt-1 h-10 w-full rounded-lg border border-[#E5E5EA] bg-white px-3 text-[#1D1D1F]">
                      {modelOptions.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                  </label>
                  <label className="text-[12px] font-bold text-[#6E6E73]">
                    比例
                    <select value={activeSegment.ratio} onChange={(e) => void patchActive({ ratio: e.target.value })} className="mt-1 h-10 w-full rounded-lg border border-[#E5E5EA] bg-white px-3 text-[#1D1D1F]">
                      {ratioOptions.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </label>
                  <label className="text-[12px] font-bold text-[#6E6E73]">
                    时长
                    <select value={activeSegment.duration} onChange={(e) => void patchActive({ duration: Number(e.target.value) })} className="mt-1 h-10 w-full rounded-lg border border-[#E5E5EA] bg-white px-3 text-[#1D1D1F]">
                      {durationOptions.map((d) => <option key={d} value={d}>{d}s</option>)}
                    </select>
                  </label>
                  <label className="flex items-end gap-2 pb-2 text-[12px] font-bold text-[#6E6E73]">
                    <input type="checkbox" checked={activeSegment.generate_audio} onChange={(e) => void patchActive({ generate_audio: e.target.checked })} className="h-4 w-4 accent-[#1D1D1F]" />
                    输出声音
                  </label>
                </div>

                <label className="block text-[12px] font-bold text-[#6E6E73]">
                  Prompt
                  <div className="relative mt-2">
                    <textarea
                      ref={promptRef}
                      value={draftPrompt}
                      onChange={(e) => handlePromptChange(e.target.value)}
                      onBlur={() => {
                        window.setTimeout(() => setMentionOpen(false), 160);
                        void persistActivePrompt();
                      }}
                      rows={7}
                      className="w-full resize-none rounded-xl border border-[#E5E5EA] bg-white p-4 text-[14px] leading-7 text-[#1D1D1F] outline-none focus:border-[#1D1D1F]"
                      placeholder="输入当前片段的画面、动作、风格和素材引用要求。输入 @ 可引用素材。"
                    />
                    {mentionOpen ? (
                      <div className="absolute left-4 top-12 z-20 w-[260px] rounded-xl border border-[#E5E5EA] bg-white p-2 shadow-[0_18px_42px_rgba(15,23,42,0.16)]">
                        {project?.assets.length ? project.assets.map((asset) => (
                          <button
                            key={asset.id}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => void insertMentionAsset(asset)}
                            className="flex h-14 w-full items-center gap-3 rounded-lg px-2 text-left hover:bg-[#F2F4F8]"
                          >
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-[#F2F4F8] text-[#6E6E73]">
                              {asset.type === 'image' ? (
                                <img src={asset.url} alt={asset.label || asset.file_name || 'asset'} className="h-full w-full object-cover" />
                              ) : (
                                <i className={ri(assetIcon(asset.type), 'text-[17px]')} aria-hidden />
                              )}
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-[15px] font-black text-[#1D1D1F]">{asset.label || asset.file_name}</span>
                              <span className="block truncate text-[11px] font-normal text-[#8E8E93]">{asset.file_name}</span>
                            </span>
                          </button>
                        )) : (
                          <div className="px-3 py-4 text-[12px] font-normal text-[#8E8E93]">
                            还没有可引用素材，请先从左侧上传。
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                </label>

                <div className="mt-5">
                  <p className="mb-2 text-[12px] font-bold text-[#6E6E73]">当前片段引用素材</p>
                  <div className="flex flex-wrap gap-2">
                    {activeSegment.input_assets.length ? activeSegment.input_assets.map((asset) => (
                      <span key={asset.url} title={asset.url} className="inline-flex items-center gap-2 rounded-lg border border-[#E5E5EA] bg-white px-3 py-2 text-[12px] text-[#444444]">
                        <i className={ri(assetIcon(asset.type), 'text-[14px]')} aria-hidden />
                        {asset.label || asset.file_name || asset.type}
                        <span className="text-[#047857]">已绑定</span>
                      </span>
                    )) : <span className="text-[12px] text-[#AEAEB2]">未引用素材，可从左侧素材库选择。</span>}
                  </div>
                </div>
              </article>
            ) : null}
          </div>

          <div className="border-t border-[#E5E5EA] bg-[#F7F8FA] px-6 py-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[13px] font-black text-[#8E8E93]">
                <i className={ri('ri-timeline-view', 'text-[14px]')} aria-hidden />
                时间轴
                <span className="rounded-full bg-[#EAEAEA] px-2 py-0.5 text-[11px]">{project?.segments.length || 0} 个片段</span>
              </div>
              <button type="button" onClick={() => void mergeProject()} disabled={busy || !allSegmentsReady} className="rounded-xl bg-[#1D1D1F] px-5 py-2 text-[12.5px] font-bold text-white disabled:bg-[#D1D5DB]">
                合成完整视频
              </button>
            </div>
            <div className="flex gap-2">
              {project?.segments.map((seg) => {
                const c = colors[(seg.segment_index - 1) % colors.length];
                const active = seg.id === activeSegment?.id;
                return (
                  <button key={seg.id} type="button" onClick={() => setActiveSegmentId(seg.id)} className="h-11 min-w-[132px] flex-1 rounded-lg border px-3 text-left text-[12px] font-bold" style={{ borderColor: active ? `${c}88` : '#E5E5EA', background: active ? `${c}12` : '#fff', color: active ? c : '#6E6E73' }}>
                    <span className="block truncate">S{seg.segment_index} · {seg.title || '未命名'}</span>
                    <span className="text-[10px] font-normal text-[#AEAEB2]">{seg.duration}s · {statusText(seg.status)}</span>
                  </button>
                );
              })}
              <button type="button" onClick={() => void addSegment()} disabled={busy} className="h-11 min-w-[150px] rounded-lg border border-dashed border-[#C7C7CC] bg-white px-3 text-[12px] font-bold text-[#6E6E73] disabled:opacity-50">
                <i className={ri('ri-add-circle-line', 'mr-1 text-[14px]')} aria-hidden />
                手动新增片段
              </button>
            </div>
          </div>
        </section>

        <aside className="border-l border-[#E5E5EA] bg-[#F7F8FA] px-4 py-5">
          <h2 className="mb-4 text-[13px] font-black text-[#6E6E73]">视频预览</h2>
          <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl bg-white p-1">
            <button type="button" onClick={() => setPreviewTarget('segment')} className={`h-9 rounded-lg text-[12px] font-bold ${previewTarget === 'segment' ? 'bg-[#1D1D1F] text-white' : 'text-[#6E6E73]'}`}>当前片段</button>
            <button type="button" onClick={() => setPreviewTarget('final')} className={`h-9 rounded-lg text-[12px] font-bold ${previewTarget === 'final' ? 'bg-[#1D1D1F] text-white' : 'text-[#6E6E73]'}`}>最终成片</button>
          </div>
          <div className="flex aspect-[9/16] w-full items-center justify-center overflow-hidden rounded-xl bg-[#111] text-center text-[13px] text-[#8E8E93]">
            {previewUrl ? (
              <video src={previewUrl} controls className="h-full w-full object-contain" />
            ) : (
              <div className="px-8">
                <i className={ri('ri-video-line', 'mb-3 block text-[30px] text-white/80')} aria-hidden />
                {previewTarget === 'final' ? '合成完成后可预览最终成片' : '生成当前片段后可预览'}
              </div>
            )}
          </div>
          <div className="mt-4 rounded-xl border border-[#E5E5EA] bg-white p-4">
            <p className="text-[11px] text-[#8E8E93]">{previewTarget === 'final' ? '最终成片' : '当前片段'}</p>
            <p className="mt-1 truncate text-[15px] font-black" style={{ color: activeColor }}>
              {previewTarget === 'final' ? project?.project_name : activeSegment?.title}
            </p>
            {activeSegment ? (
              <p className="mt-2 text-[12px] text-[#8E8E93]">
                {modelLabel(activeSegment.model)} · {activeSegment.ratio} · {activeSegment.duration}s
              </p>
            ) : null}
            {activeSegment?.error_message ? (
              <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] leading-5 text-red-800">
                {activeSegment.error_message}
              </p>
            ) : null}
          </div>
        </aside>
      </main>
    </div>
  );
}
