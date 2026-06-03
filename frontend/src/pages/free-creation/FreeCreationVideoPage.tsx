import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  cancelFreeCreationSegment,
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
const resolutionOptions = ['480p', '720p', '1080p'];
const durationOptions = [4, 5, 8, 11, 15];
const colors = ['#B45309', '#DC2626', '#047857', '#334155', '#9333EA', '#0F766E'];

type LibraryAsset = FreeCreationInputAsset & {
  id: string;
  displayName: string;
  subLabel: string;
  source: 'upload' | 'segment_video';
  sourceSegmentId?: number;
  sourceSegmentIndex?: number;
  thumbnailUrl?: string;
};

function parseId(raw?: string): number | null {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

function toInputAsset(asset: FreeCreationAsset): FreeCreationInputAsset {
  return {
    type: asset.type,
    url: asset.url,
    preview_url: asset.preview_url,
    storage_key: asset.storage_key,
    file_name: asset.file_name,
    mime_type: asset.mime_type,
    file_size: asset.file_size,
    role: asset.role,
    label: asset.label,
  };
}

function libraryToInputAsset(asset: LibraryAsset): FreeCreationInputAsset {
  return {
    type: asset.type,
    url: asset.url,
    preview_url: asset.preview_url,
    storage_key: asset.storage_key,
    file_name: asset.file_name,
    mime_type: asset.mime_type,
    file_size: asset.file_size,
    role: asset.role,
    label: asset.label,
  };
}

function toLibraryAsset(asset: FreeCreationAsset): LibraryAsset {
  return {
    ...toInputAsset(asset),
    id: `asset-${asset.id}`,
    displayName: asset.label || asset.file_name || `素材 ${asset.id}`,
    subLabel: asset.file_name || asset.type,
    source: 'upload',
  };
}

function segmentVideoAsset(segment: FreeCreationSegment): LibraryAsset | null {
  if (!segment.video_url) return null;
  if (['queued', 'running'].includes(segment.status.toLowerCase())) return null;
  return {
    id: `segment-video-${segment.id}`,
    type: 'video',
    url: segment.video_url,
    preview_url: segment.video_preview_url || segment.video_url,
    file_name: `片段${segment.segment_index}-${segment.title || '生成视频'}.mp4`,
    role: 'reference_video',
    label: `@片段${segment.segment_index}视频`,
    displayName: `@片段${segment.segment_index}视频`,
    subLabel: segment.title || `片段 ${segment.segment_index} 生成视频`,
    source: 'segment_video',
    sourceSegmentId: segment.id,
    sourceSegmentIndex: segment.segment_index,
    thumbnailUrl: segment.last_frame_preview_url || segment.last_frame_url || undefined,
  };
}

function canUseAssetForSegment(asset: LibraryAsset, segment: FreeCreationSegment): boolean {
  if (asset.source !== 'segment_video') return true;
  return Boolean(asset.sourceSegmentIndex && asset.sourceSegmentIndex < segment.segment_index);
}

function uploadToInputAsset(upload: Awaited<ReturnType<typeof uploadFreeCreationAsset>>): FreeCreationInputAsset {
  return {
    type: upload.asset_type,
    url: upload.url,
    preview_url: upload.preview_url,
    storage_key: upload.storage_key,
    file_name: upload.file_name,
    mime_type: upload.mime_type,
    file_size: upload.file_size,
    role: upload.role,
    label: upload.label,
  };
}

function keepStablePreviewUrl<T extends { url: string; preview_url?: string }>(prev: T | undefined, next: T): T {
  if (prev?.url === next.url && prev.preview_url && next.preview_url && prev.preview_url !== next.preview_url) {
    return { ...next, preview_url: prev.preview_url };
  }
  return next;
}

function isGeneratingStatus(status: string | undefined): boolean {
  return ['queued', 'running'].includes((status || '').toLowerCase());
}

function stabilizeProjectMediaUrls(prev: FreeCreationProject | null, next: FreeCreationProject): FreeCreationProject {
  if (!prev) return next;
  const prevAssets = new Map(prev.assets.map((asset) => [asset.id, asset]));
  const prevSegments = new Map(prev.segments.map((segment) => [segment.id, segment]));
  const finalCompletedAfterGeneration = isGeneratingStatus(prev.final_render_status) && next.final_render_status.toLowerCase() === 'completed';
  return {
    ...next,
    final_video_preview_url:
      !finalCompletedAfterGeneration && prev.final_video_url === next.final_video_url && prev.final_video_preview_url && next.final_video_preview_url
        ? prev.final_video_preview_url
        : next.final_video_preview_url,
    assets: next.assets.map((asset) => keepStablePreviewUrl(prevAssets.get(asset.id), asset)),
    segments: next.segments.map((segment) => {
      const prevSegment = prevSegments.get(segment.id);
      const completedAfterGeneration = isGeneratingStatus(prevSegment?.status) && segment.status.toLowerCase() === 'completed';
      return {
        ...segment,
        video_preview_url:
          !completedAfterGeneration && prevSegment?.video_url === segment.video_url && prevSegment.video_preview_url && segment.video_preview_url
            ? prevSegment.video_preview_url
            : segment.video_preview_url,
        last_frame_preview_url:
          !completedAfterGeneration && prevSegment?.last_frame_url === segment.last_frame_url && prevSegment.last_frame_preview_url && segment.last_frame_preview_url
            ? prevSegment.last_frame_preview_url
            : segment.last_frame_preview_url,
        input_assets: segment.input_assets.map((asset) => {
          const prevAsset = prevSegment?.input_assets.find((item) => item.url === asset.url);
          return keepStablePreviewUrl(prevAsset, asset);
        }),
      };
    }),
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

function AssetThumbnail({ asset }: { asset: LibraryAsset }) {
  const src = asset.preview_url || asset.url;
  if (asset.type === 'image') {
    return (
      <img
        src={src}
        alt={asset.displayName}
        className="h-full w-full object-cover"
        loading="lazy"
      />
    );
  }

  if (asset.type === 'video') {
    if (asset.thumbnailUrl) {
      return (
        <img
          src={asset.thumbnailUrl}
          alt={asset.displayName}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      );
    }

    return (
      <video
        src={src}
        className="h-full w-full object-cover"
        muted
        playsInline
        preload="metadata"
      />
    );
  }

  return (
    <span className="flex h-full w-full items-center justify-center text-[#6E6E73]">
      <i className={ri(assetIcon(asset.type), 'text-[16px]')} aria-hidden />
    </span>
  );
}

function statusText(status: string): string {
  const s = status.toLowerCase();
  if (s === 'completed') return '已完成';
  if (s === 'running') return '生成中';
  if (s === 'queued') return '排队中';
  if (s === 'cancelled') return '已终止';
  if (s === 'failed') return '失败';
  return '待生成';
}

export function FreeCreationVideoPage() {
  const navigate = useNavigate();
  const { projectId: projectIdRaw } = useParams();
  const projectId = parseId(projectIdRaw);
  const [project, setProject] = useState<FreeCreationProject | null>(null);
  const [activeSegmentId, setActiveSegmentId] = useState<number | null>(null);
  const [draftPrompts, setDraftPrompts] = useState<Record<number, string>>({});
  const [expandedSegmentIds, setExpandedSegmentIds] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewTarget, setPreviewTarget] = useState<'segment' | 'final'>('segment');
  const [mentionOpenSegmentId, setMentionOpenSegmentId] = useState<number | null>(null);
  const [uploadTargetSegmentId, setUploadTargetSegmentId] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const segmentFileRef = useRef<HTMLInputElement>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);

  const activeSegment = useMemo(() => {
    const rows = project?.segments || [];
    return rows.find((s) => s.id === activeSegmentId) || rows[0] || null;
  }, [activeSegmentId, project?.segments]);

  useEffect(() => {
    if (!project?.segments.length) return;
    setDraftPrompts((prev) => {
      const next = { ...prev };
      project.segments.forEach((seg) => {
        if (next[seg.id] == null) next[seg.id] = seg.prompt || '';
      });
      return next;
    });
    setExpandedSegmentIds((prev) => {
      if (Object.keys(prev).length) return prev;
      const first = project.segments[0];
      return first ? { [first.id]: true } : prev;
    });
  }, [project?.segments]);

  const allSegmentsReady = Boolean(project?.segments.length) && project!.segments.every((s) => Boolean(s.video_url));
  const activeColor = activeSegment ? colors[(activeSegment.segment_index - 1) % colors.length] : '#B45309';
  const previewUrl = previewTarget === 'final'
    ? (project?.final_video_preview_url || project?.final_video_url)
    : (activeSegment?.video_preview_url || activeSegment?.video_url);
  const activeStatus = activeSegment?.status.toLowerCase() || 'idle';
  const previewGenerating = previewTarget === 'segment' && ['queued', 'running'].includes(activeStatus);
  const libraryAssets = useMemo<LibraryAsset[]>(() => {
    const uploads = (project?.assets || []).map(toLibraryAsset);
    const segmentVideos = (project?.segments || [])
      .map(segmentVideoAsset)
      .filter((asset): asset is LibraryAsset => Boolean(asset));
    return [...uploads, ...segmentVideos];
  }, [project?.assets, project?.segments]);
  const activeLibraryAssets = useMemo(() => {
    if (!activeSegment) return libraryAssets;
    return libraryAssets.filter((asset) => canUseAssetForSegment(asset, activeSegment));
  }, [activeSegment, libraryAssets]);
  const getSegmentLibraryAssets = (segment: FreeCreationSegment): LibraryAsset[] =>
    libraryAssets.filter((asset) => canUseAssetForSegment(asset, segment));

  const refresh = async () => {
    if (!projectId) return;
    const data = await getFreeCreationProject(projectId);
    setProject((prev) => stabilizeProjectMediaUrls(prev, data));
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
        setProject((prev) => stabilizeProjectMediaUrls(prev, data));
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

  const patchSegment = async (segment: FreeCreationSegment, patch: Partial<FreeCreationSegment> & { input_assets?: FreeCreationInputAsset[] }): Promise<FreeCreationSegment | null> => {
    setBusy(true);
    setError(null);
    try {
      const next = await updateFreeCreationSegment(segment.id, {
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
      if (patch.prompt != null) {
        setDraftPrompts((prev) => ({ ...prev, [next.id]: next.prompt || '' }));
      }
      return next;
    } catch (e) {
      setError(e instanceof Error ? e.message : '片段保存失败');
      return null;
    } finally {
      setBusy(false);
    }
  };

  const patchActive = async (patch: Partial<FreeCreationSegment> & { input_assets?: FreeCreationInputAsset[] }): Promise<FreeCreationSegment | null> => {
    if (!activeSegment) return null;
    return patchSegment(activeSegment, patch);
  };

  const persistSegmentPrompt = async (segment: FreeCreationSegment): Promise<FreeCreationSegment | null> => {
    const prompt = draftPrompts[segment.id] ?? segment.prompt ?? '';
    if (prompt === segment.prompt) return segment;
    return patchSegment(segment, { prompt });
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

  const toggleAsset = async (asset: LibraryAsset) => {
    if (!activeSegment) return;
    const exists = activeSegment.input_assets.some((a) => a.url === asset.url);
    const next = exists
      ? activeSegment.input_assets.filter((a) => a.url !== asset.url)
      : [...activeSegment.input_assets, libraryToInputAsset(asset)];
    await patchActive({ input_assets: next });
  };

  const toggleSegmentAsset = async (segment: FreeCreationSegment, asset: LibraryAsset) => {
    const exists = segment.input_assets.some((a) => a.url === asset.url);
    const next = exists
      ? segment.input_assets.filter((a) => a.url !== asset.url)
      : [...segment.input_assets, libraryToInputAsset(asset)];
    await patchSegment(segment, { input_assets: next });
  };

  const handlePromptChange = (segmentId: number, value: string) => {
    setDraftPrompts((prev) => ({ ...prev, [segmentId]: value }));
    setMentionOpenSegmentId(value.endsWith('@') ? segmentId : null);
  };

  const insertMentionAsset = async (segment: FreeCreationSegment, asset: LibraryAsset) => {
    const label = asset.label || asset.displayName || asset.file_name || '@素材';
    const current = draftPrompts[segment.id] ?? segment.prompt ?? '';
    const atIndex = current.lastIndexOf('@');
    const prompt =
      atIndex >= 0
        ? `${current.slice(0, atIndex)}${label} ${current.slice(atIndex + 1)}`
        : `${current}${current.endsWith(' ') || !current ? '' : ' '}${label} `;
    const exists = segment.input_assets.some((a) => a.url === asset.url);
    const input_assets = exists ? segment.input_assets : [...segment.input_assets, libraryToInputAsset(asset)];
    setDraftPrompts((prev) => ({ ...prev, [segment.id]: prompt }));
    setMentionOpenSegmentId(null);
    await patchSegment(segment, { prompt, input_assets });
    window.setTimeout(() => promptRef.current?.focus(), 0);
  };

  const uploadForSegment = async (files: FileList | null) => {
    if (!projectId || !files?.length || !uploadTargetSegmentId) return;
    const segment = project?.segments.find((s) => s.id === uploadTargetSegmentId);
    if (!segment) return;
    setBusy(true);
    setError(null);
    try {
      const uploaded = await Promise.all(Array.from(files).map((file) => uploadFreeCreationAsset(projectId, file)));
      const input_assets = [...segment.input_assets, ...uploaded.map(uploadToInputAsset)];
      await patchSegment(segment, { input_assets });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : '素材上传失败');
    } finally {
      setUploadTargetSegmentId(null);
      setBusy(false);
      if (segmentFileRef.current) segmentFileRef.current.value = '';
    }
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

  const generateSegment = async (segment: FreeCreationSegment) => {
    setBusy(true);
    setError(null);
    try {
      setActiveSegmentId(segment.id);
      setExpandedSegmentIds((prev) => ({ ...prev, [segment.id]: true }));
      const prompt = draftPrompts[segment.id] ?? segment.prompt ?? '';
      const saved = await persistSegmentPrompt(segment);
      if (prompt.trim() && !saved) return;
      await generateFreeCreationSegment(segment.id);
      setProject((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          segments: prev.segments.map((s) => (
            s.id === segment.id
              ? {
                  ...s,
                  status: 'running',
                  error_message: '',
                  video_url: '',
                  video_preview_url: '',
                  last_frame_url: '',
                  last_frame_preview_url: '',
                }
              : s
          )),
        };
      });
      await refresh();
      setPreviewTarget('segment');
    } catch (e) {
      setError(e instanceof Error ? e.message : '片段生成失败');
    } finally {
      setBusy(false);
    }
  };

  const cancelSegment = async (segment: FreeCreationSegment) => {
    setBusy(true);
    setError(null);
    try {
      const next = await cancelFreeCreationSegment(segment.id);
      setProject((prev) => {
        if (!prev) return prev;
        return { ...prev, segments: prev.segments.map((s) => (s.id === next.id ? next : s)) };
      });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : '终止生成失败');
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
            {activeLibraryAssets.length ? activeLibraryAssets.map((asset) => {
              const selected = activeSegment?.input_assets.some((a) => a.url === asset.url);
              return (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => void toggleAsset(asset)}
                  className={`flex w-full items-center gap-3 rounded-lg border bg-white p-3 text-left transition ${selected ? 'border-[#1D1D1F]' : 'border-[#E5E5EA] hover:border-[#B9C0CE]'}`}
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-[#F2F4F8]">
                    <AssetThumbnail asset={asset} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-black text-[#1D1D1F]">{asset.displayName}</span>
                    <span className="block truncate text-[11px] text-[#8E8E93]">{asset.subLabel}</span>
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
            </div>
            {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800">{error}</p> : null}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
            <input ref={segmentFileRef} type="file" multiple accept="image/*,video/*,audio/*" className="hidden" onChange={(e) => void uploadForSegment(e.target.files)} />
            <div className="space-y-3">
              {project?.segments.map((seg) => {
                const c = colors[(seg.segment_index - 1) % colors.length];
                const active = seg.id === activeSegment?.id;
                const expanded = !!expandedSegmentIds[seg.id];
                const draft = draftPrompts[seg.id] ?? seg.prompt ?? '';
                const generating = ['queued', 'running'].includes(seg.status.toLowerCase());
                const segmentLibraryAssets = getSegmentLibraryAssets(seg);
                return (
                  <article
                    key={seg.id}
                    className="overflow-hidden rounded-2xl border transition-all"
                    style={{ borderColor: active ? `${c}55` : '#E5E5EA', background: active ? '#fff' : '#F7F8FA', boxShadow: active ? `0 2px 12px ${c}12` : 'none' }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setActiveSegmentId(seg.id);
                        setPreviewTarget('segment');
                        setExpandedSegmentIds((prev) => ({ ...prev, [seg.id]: !prev[seg.id] }));
                      }}
                      className="flex w-full items-center justify-between gap-3 p-4 text-left"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[13px] font-black" style={{ background: `${c}18`, color: c }}>
                          S{seg.segment_index}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-[16px] font-black text-[#1D1D1F]">{seg.title || `片段 ${seg.segment_index}`}</p>
                          <p className="truncate text-[12px] text-[#8E8E93]">
                            {modelLabel(seg.model)} · {seg.ratio} · {seg.resolution || '720p'} · {seg.duration}s · {statusText(seg.status)}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {generating ? <i className={ri('ri-loader-4-line animate-spin', 'text-[14px]')} style={{ color: c }} aria-hidden /> : null}
                        {!generating && seg.video_url ? <i className={ri('ri-checkbox-circle-fill', 'text-[14px] text-[#047857]')} aria-hidden /> : null}
                        <i className={ri(expanded ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line', 'text-[18px] text-[#AEAEB2]')} aria-hidden />
                      </div>
                    </button>

                    {expanded ? (
                      <div className="space-y-4 px-4 pb-4">
                        <div className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-3 rounded-xl border border-[#EAEAEA] bg-[#FAFAFB] p-3">
                          <label className="text-[12px] font-bold text-[#6E6E73]">
                            模型
                            <select
                              value={seg.model}
                              onChange={(e) => {
                                const model = e.target.value;
                                void patchSegment(seg, {
                                  model,
                                  resolution: model.includes('fast') && seg.resolution === '1080p' ? '720p' : seg.resolution,
                                });
                              }}
                              className="mt-1 h-10 w-full rounded-lg border border-[#E5E5EA] bg-white px-3 text-[#1D1D1F]"
                            >
                              {modelOptions.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                            </select>
                          </label>
                          <label className="text-[12px] font-bold text-[#6E6E73]">
                            比例
                            <select value={seg.ratio} onChange={(e) => void patchSegment(seg, { ratio: e.target.value })} className="mt-1 h-10 w-full rounded-lg border border-[#E5E5EA] bg-white px-3 text-[#1D1D1F]">
                              {ratioOptions.map((r) => <option key={r} value={r}>{r}</option>)}
                            </select>
                          </label>
                          <label className="text-[12px] font-bold text-[#6E6E73]">
                            分辨率
                            <select value={seg.resolution || '720p'} onChange={(e) => void patchSegment(seg, { resolution: e.target.value })} className="mt-1 h-10 w-full rounded-lg border border-[#E5E5EA] bg-white px-3 text-[#1D1D1F]">
                              {resolutionOptions.map((r) => <option key={r} value={r} disabled={seg.model.includes('fast') && r === '1080p'}>{r}</option>)}
                            </select>
                          </label>
                          <label className="text-[12px] font-bold text-[#6E6E73]">
                            时长
                            <select value={seg.duration} onChange={(e) => void patchSegment(seg, { duration: Number(e.target.value) })} className="mt-1 h-10 w-full rounded-lg border border-[#E5E5EA] bg-white px-3 text-[#1D1D1F]">
                              {durationOptions.map((d) => <option key={d} value={d}>{d}s</option>)}
                            </select>
                          </label>
                          <label className="flex items-end gap-2 pb-2 text-[12px] font-bold text-[#6E6E73]">
                            <input type="checkbox" checked={seg.generate_audio} onChange={(e) => void patchSegment(seg, { generate_audio: e.target.checked })} className="h-4 w-4 accent-[#1D1D1F]" />
                            输出声音
                          </label>
                        </div>

                        <label className="block text-[12px] font-bold text-[#6E6E73]">
                          Prompt
                          <div className="relative mt-2">
                            <textarea
                              ref={active ? promptRef : undefined}
                              value={draft}
                              onChange={(e) => handlePromptChange(seg.id, e.target.value)}
                              onBlur={() => {
                                window.setTimeout(() => setMentionOpenSegmentId(null), 160);
                                void persistSegmentPrompt(seg);
                              }}
                              rows={6}
                              className="w-full resize-none rounded-xl border border-[#E5E5EA] bg-white p-4 text-[14px] leading-7 text-[#1D1D1F] outline-none focus:border-[#1D1D1F]"
                              placeholder="输入当前片段的画面、动作、风格和素材引用要求。输入 @ 可引用素材。"
                            />
                            {mentionOpenSegmentId === seg.id ? (
                              <div className="absolute left-4 top-12 z-20 w-[260px] rounded-xl border border-[#E5E5EA] bg-white p-2 shadow-[0_18px_42px_rgba(15,23,42,0.16)]">
                                {segmentLibraryAssets.length ? segmentLibraryAssets.map((asset) => (
                                  <button
                                    key={asset.id}
                                    type="button"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => void insertMentionAsset(seg, asset)}
                                    className="flex h-14 w-full items-center gap-3 rounded-lg px-2 text-left hover:bg-[#F2F4F8]"
                                  >
                                    <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-[#F2F4F8] text-[#6E6E73]">
                                      {asset.type === 'image' ? (
                                        <img src={asset.preview_url || asset.url} alt={asset.label || asset.file_name || 'asset'} className="h-full w-full object-cover" />
                                      ) : (
                                        <i className={ri(assetIcon(asset.type), 'text-[17px]')} aria-hidden />
                                      )}
                                    </span>
                                    <span className="min-w-0">
                                      <span className="block truncate text-[15px] font-black text-[#1D1D1F]">{asset.displayName}</span>
                                      <span className="block truncate text-[11px] font-normal text-[#8E8E93]">{asset.subLabel}</span>
                                    </span>
                                  </button>
                                )) : (
                                  <div className="px-3 py-4 text-[12px] font-normal text-[#8E8E93]">
                                    还没有可引用素材，请先上传，或生成前序片段后再引用。
                                  </div>
                                )}
                              </div>
                            ) : null}
                          </div>
                        </label>

                        <div className="rounded-xl border border-[#EAEAEA] bg-[#FAFAFB] p-3">
                          <div className="mb-2 flex items-center justify-between">
                            <p className="text-[12px] font-bold text-[#6E6E73]">当前片段引用素材</p>
                            <button
                              type="button"
                              onClick={() => {
                                setUploadTargetSegmentId(seg.id);
                                segmentFileRef.current?.click();
                              }}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E5EA] bg-white px-3 py-1.5 text-[12px] font-bold text-[#444444]"
                            >
                              <i className={ri('ri-upload-cloud-2-line', 'text-[14px]')} aria-hidden />
                              上传素材
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {seg.input_assets.length ? seg.input_assets.map((asset) => (
                              <span key={asset.url} title={asset.url} className="inline-flex items-center gap-2 rounded-lg border border-[#E5E5EA] bg-white px-3 py-2 text-[12px] text-[#444444]">
                                <i className={ri(assetIcon(asset.type), 'text-[14px]')} aria-hidden />
                                {asset.label || asset.file_name || asset.type}
                                <span className="text-[#047857]">已绑定</span>
                              </span>
                            )) : <span className="text-[12px] text-[#AEAEB2]">未引用素材，可从左侧素材库选择，或直接上传到当前片段。</span>}
                          </div>
                          {segmentLibraryAssets.length ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {segmentLibraryAssets.map((asset) => {
                                const selected = seg.input_assets.some((a) => a.url === asset.url);
                                return (
                                  <button
                                    key={asset.id}
                                    type="button"
                                    onClick={() => void toggleSegmentAsset(seg, asset)}
                                    className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-[12px] font-bold ${selected ? 'border-[#1D1D1F] bg-white text-[#1D1D1F]' : 'border-[#E5E5EA] bg-white text-[#6E6E73]'}`}
                                  >
                                    <i className={ri(assetIcon(asset.type), 'text-[14px]')} aria-hidden />
                                    {asset.displayName}
                                    {selected ? <i className={ri('ri-check-line', 'text-[14px] text-[#047857]')} aria-hidden /> : null}
                                  </button>
                                );
                              })}
                            </div>
                          ) : null}
                        </div>

                        <div className="flex items-center justify-end gap-3">
                          {seg.error_message ? <p className="mr-auto max-w-[560px] break-words text-[12px] text-red-700">{seg.error_message}</p> : null}
                          {generating ? (
                            <button
                              type="button"
                              onClick={() => void cancelSegment(seg)}
                              disabled={busy}
                              className="flex items-center gap-2 rounded-xl border border-[#FCA5A5] bg-white px-4 py-2.5 text-[13px] font-bold text-[#B91C1C] disabled:opacity-50"
                            >
                              <i className={ri('ri-stop-circle-line', 'text-[14px]')} aria-hidden />
                              终止生成
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => void generateSegment(seg)}
                            disabled={busy || generating || !(draft || '').trim()}
                            className="flex items-center gap-2 rounded-xl bg-[#1D1D1F] px-5 py-2.5 text-[13px] font-bold text-white disabled:bg-[#D1D5DB]"
                          >
                            <i className={ri(generating ? 'ri-loader-4-line animate-spin' : seg.video_url ? 'ri-refresh-line' : 'ri-magic-line', 'text-[14px]')} aria-hidden />
                            {generating ? '生成中...' : seg.video_url ? '重新生成' : '生成视频'}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
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
          <div className="relative flex aspect-[9/16] w-full items-center justify-center overflow-hidden rounded-xl bg-[#111] text-center text-[13px] text-[#8E8E93]">
            {previewGenerating ? (
              <div className="px-8">
                <i className={ri('ri-loader-4-line animate-spin', 'mb-3 block text-[30px] text-white/80')} aria-hidden />
                <p className="font-bold text-white/85">视频正在生成中，请稍等</p>
                <p className="mt-2 text-[11px] text-white/50">生成完成后会自动刷新当前片段预览</p>
              </div>
            ) : previewUrl ? (
              <video key={`${previewTarget}-${previewUrl}`} src={previewUrl} controls className="h-full w-full object-contain" />
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
