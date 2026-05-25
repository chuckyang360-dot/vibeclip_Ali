import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { useAuth } from '@/contexts/AuthContext';
import { ShortDramaApiError, analyzeReferenceVideo, getReferenceVideo, uploadReferenceVideo } from '@/services/shortDramaApi';
import type { ReferenceVideoAnalysisJson, ReferenceVideoDto } from '@/types/shortDramaApi';
import { ri, sdColors, sdFontHeading } from './utils/shortDramaHelpers';

type SectionKey =
  | 'script_reading'
  | 'shooting_method'
  | 'actual_script_structure'
  | 'characters'
  | 'product_presentation'
  | 'shot_breakdown'
  | 'video_prompt';

const SECTIONS: { key: SectionKey; label: string; desc: string; icon: string }[] = [
  { key: 'script_reading', label: '剧本解读', desc: '这个视频在讲什么', icon: 'ri-file-text-line' },
  { key: 'shooting_method', label: '拍摄方法', desc: '视频是怎么拍的', icon: 'ri-camera-lens-line' },
  { key: 'actual_script_structure', label: '剧本结构', desc: '视频内容的叙事层次', icon: 'ri-node-tree' },
  { key: 'characters', label: '人物设定', desc: '人物身份、动作与情绪', icon: 'ri-user-voice-line' },
  { key: 'product_presentation', label: '产品呈现', desc: '产品出现和展示方式', icon: 'ri-box-3-line' },
  { key: 'shot_breakdown', label: '分镜拆解', desc: '逐镜头拆解拍摄要点', icon: 'ri-film-line' },
  { key: 'video_prompt', label: '视频 PMT', desc: '可复制的视频生成提示词', icon: 'ri-sparkling-line' },
];

const SUPPORTED_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/mpeg', 'video/avi', 'video/x-flv', 'video/wmv', 'video/3gpp'];

function formatBytes(size: number): string {
  if (!Number.isFinite(size) || size <= 0) return '0 MB';
  const mb = size / 1024 / 1024;
  if (mb < 1024) return `${mb.toFixed(mb >= 100 ? 0 : 1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

function formatDuration(seconds?: number | null): string {
  if (seconds == null || seconds < 0) return '未知时长';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function textify(value: unknown): string {
  if (value == null || value === '') return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    return value.map(textify).filter(Boolean).join('\n');
  }
  if (isRecord(value)) {
    return Object.entries(value)
      .map(([key, v]) => {
        const body = textify(v);
        return body ? `${key}: ${body}` : '';
      })
      .filter(Boolean)
      .join('\n');
  }
  return String(value);
}

function labelFor(key: string): string {
  const labels: Record<string, string> = {
    summary: '内容概述',
    core_message: '核心表达',
    emotional_tone: '情绪氛围',
    audience_takeaway: '观众记忆点',
    overall_style: '整体拍法',
    camera: '镜头语言',
    lighting: '光线色彩',
    composition: '构图',
    editing: '剪辑',
    sound: '声音字幕',
    structure_type: '结构类型',
    is_marketing_structure: '是否营销结构',
    segments: '结构段落',
    notes: '说明',
    full_prompt: '完整 Prompt',
    short_prompt: '精简 Prompt',
    negative_prompt: 'Negative Prompt',
    style_keywords: '风格关键词',
  };
  return labels[key] || key;
}

function ObjectBlock({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="space-y-3">
      {Object.entries(data).map(([key, value]) => {
        if (value == null || value === '' || (Array.isArray(value) && value.length === 0)) return null;
        return (
          <div key={key} className="rounded-lg border border-[#EAEAEA] bg-white p-4">
            <div className="mb-2 text-[12px] font-bold text-[#6E6E73]">{labelFor(key)}</div>
            <ValueBlock value={value} />
          </div>
        );
      })}
    </div>
  );
}

function ValueBlock({ value }: { value: unknown }) {
  if (Array.isArray(value)) {
    if (!value.length) return <p className="text-[13px] text-[#8E8E93]">暂无内容</p>;
    return (
      <div className="space-y-2">
        {value.map((item, index) => (
          <div key={index} className="rounded-lg bg-[#F7F8FA] p-3 text-[13px] leading-relaxed text-[#333333]">
            {isRecord(item) ? <ObjectBlock data={item} /> : <p className="whitespace-pre-wrap">{textify(item)}</p>}
          </div>
        ))}
      </div>
    );
  }
  if (isRecord(value)) return <ObjectBlock data={value} />;
  return <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-[#333333]">{textify(value) || '暂无内容'}</p>;
}

function sectionValue(analysis: ReferenceVideoAnalysisJson | null | undefined, key: SectionKey): unknown {
  if (!analysis) return null;
  return analysis[key];
}

function sectionCopyText(analysis: ReferenceVideoAnalysisJson | null | undefined, key: SectionKey): string {
  const section = SECTIONS.find((x) => x.key === key);
  return [`# ${section?.label || key}`, textify(sectionValue(analysis, key))].filter(Boolean).join('\n\n');
}

export function ShortDramaVideoAnalysisPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [video, setVideo] = useState<ReferenceVideoDto | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string>('');
  const [active, setActive] = useState<SectionKey>('script_reading');
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const rawId = Number(searchParams.get('video_id') || 0);
    if (!rawId) return;
    let cancelled = false;
    void (async () => {
      setError(null);
      try {
        const existing = await getReferenceVideo(rawId);
        if (cancelled) return;
        setVideo(existing);
      } catch (e) {
        if (!cancelled) setError(e instanceof ShortDramaApiError ? e.message : e instanceof Error ? e.message : '加载视频解析失败');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  const analysis = video?.analysis_json || null;
  const canAnalyze = video != null && !uploading && !analyzing;
  const currentValue = sectionValue(analysis, active);
  const statusText = uploading
    ? '上传中'
    : analyzing || video?.analysis_status === 'processing'
      ? '解析中'
      : video?.analysis_status === 'success'
        ? '解析完成'
        : video?.analysis_status === 'failed'
          ? '解析失败'
          : video
            ? '待解析'
            : '等待上传';

  const handleFile = async (file?: File) => {
    if (!file) return;
    if (!SUPPORTED_TYPES.includes(file.type)) {
      setError('暂不支持该视频格式，请上传 MP4、MOV、WebM 等常见视频格式。');
      return;
    }
    setUploading(true);
    setAnalyzing(false);
    setError(null);
    setVideo(null);
    if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    const preview = URL.createObjectURL(file);
    setLocalPreviewUrl(preview);
    try {
      const uploaded = await uploadReferenceVideo(file, user?.id ?? null);
      setVideo(uploaded);
      setUploading(false);
      setAnalyzing(true);
      const analyzed = await analyzeReferenceVideo(uploaded.id);
      setVideo(analyzed.video);
    } catch (e) {
      setError(e instanceof ShortDramaApiError ? e.message : e instanceof Error ? e.message : '视频上传或解析失败');
    } finally {
      setUploading(false);
      setAnalyzing(false);
    }
  };

  const copyCurrent = async () => {
    const text = sectionCopyText(analysis, active);
    if (!text.trim()) return;
    await navigator.clipboard.writeText(text);
    setCopied(active);
    window.setTimeout(() => setCopied(null), 1400);
  };

  const copyAll = async () => {
    const text = SECTIONS.map((s) => sectionCopyText(analysis, s.key)).join('\n\n');
    if (!text.trim()) return;
    await navigator.clipboard.writeText(text);
    setCopied('all');
    window.setTimeout(() => setCopied(null), 1400);
  };

  const meta = useMemo(() => {
    if (!video) return [];
    return [
      video.original_filename,
      formatBytes(video.file_size),
      formatDuration(video.duration_seconds),
      statusText,
    ].filter(Boolean);
  }, [video, statusText]);

  return (
    <div className="min-h-screen bg-[#F7F8FA] text-[#1D1D1F]">
      <Navbar />
      <main className="mx-auto max-w-[1440px] px-5 pb-8 pt-20 lg:px-8">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <Link to="/" className="mb-3 inline-flex items-center gap-1 text-[12px] font-semibold text-[#6E6E73]">
              <i className={ri('ri-arrow-left-line', 'text-[14px]')} aria-hidden />
              返回首页
            </Link>
            <h1 style={sdFontHeading} className="text-[30px] font-black leading-tight md:text-[42px]">
              视频解构
            </h1>
            <p className="mt-2 text-[13px] text-[#6E6E73]">
              上传参考视频，拆出它真实的剧本结构、拍摄方法、人物、产品露出、分镜和视频 PMT。
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#1D1D1F] px-4 text-[13px] font-bold text-white"
            >
              <i className={ri('ri-upload-cloud-2-line', 'text-[15px]')} aria-hidden />
              上传视频
            </button>
            {analysis && (
              <button
                type="button"
                onClick={copyAll}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#E1E1E6] bg-white px-4 text-[13px] font-bold text-[#333333]"
              >
                <i className={ri('ri-file-copy-line', 'text-[15px]')} aria-hidden />
                {copied === 'all' ? '已复制' : '复制全部'}
              </button>
            )}
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="video/mp4,video/quicktime,video/webm,video/mpeg,video/avi,video/x-flv,video/wmv,video/3gpp"
          className="hidden"
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-medium text-red-700">
            {error}
          </div>
        )}

        <div className="grid min-h-[calc(100vh-190px)] gap-5 lg:grid-cols-[minmax(420px,0.95fr)_minmax(520px,1.05fr)]">
          <section className="flex min-h-[520px] flex-col overflow-hidden rounded-xl border border-[#E5E5EA] bg-[#111111]">
            <div className="flex h-11 items-center justify-between border-b border-white/10 px-4 text-white">
              <div className="flex items-center gap-2 text-[13px] font-bold">
                <i className={ri('ri-video-line', 'text-[16px]')} aria-hidden />
                视频内容
              </div>
              <span className="text-[12px] text-white/58">{statusText}</span>
            </div>
            <div className="relative flex flex-1 items-center justify-center bg-black">
              {localPreviewUrl || video?.public_url ? (
                <video src={localPreviewUrl || video?.public_url} controls className="h-full max-h-[calc(100vh-270px)] w-full object-contain" />
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mx-6 flex max-w-sm flex-col items-center rounded-xl border border-dashed border-white/18 bg-white/[0.06] px-8 py-10 text-center text-white"
                >
                  <i className={ri('ri-upload-cloud-2-line', 'mb-4 text-[34px] text-white/76')} aria-hidden />
                  <span className="text-[17px] font-black">上传一个参考视频</span>
                  <span className="mt-2 text-[12px] leading-relaxed text-white/56">支持 MP4、MOV、WebM 等常见视频格式。</span>
                </button>
              )}
              {(uploading || analyzing) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/68 text-white backdrop-blur-sm">
                  <i className={ri('ri-loader-4-line', 'animate-spin text-[28px]')} aria-hidden />
                  <p className="mt-3 text-[13px] font-semibold">{uploading ? '正在上传视频…' : '正在解析视频…'}</p>
                </div>
              )}
            </div>
            {meta.length > 0 && (
              <div className="flex flex-wrap gap-2 border-t border-white/10 px-4 py-3">
                {meta.map((item) => (
                  <span key={item} className="rounded-full bg-white/8 px-2.5 py-1 text-[11px] font-semibold text-white/58">
                    {item}
                  </span>
                ))}
              </div>
            )}
          </section>

          <section className="grid min-h-[520px] overflow-hidden rounded-xl border border-[#E5E5EA] bg-white lg:grid-cols-[196px_minmax(0,1fr)]">
            <aside className="border-b border-[#EAEAEA] bg-[#FAFAFA] p-3 lg:border-b-0 lg:border-r">
              <div className="mb-3 px-2 text-[11px] font-bold uppercase tracking-wider text-[#8E8E93]">解析内容</div>
              <div className="space-y-1.5">
                {SECTIONS.map((item) => {
                  const selected = item.key === active;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setActive(item.key)}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors"
                      style={{ background: selected ? '#1D1D1F' : 'transparent', color: selected ? '#ffffff' : '#444444' }}
                    >
                      <i className={ri(item.icon, 'shrink-0 text-[17px]')} aria-hidden />
                      <span className="min-w-0">
                        <span className="block text-[13px] font-black">{item.label}</span>
                        <span className="mt-0.5 block truncate text-[11px]" style={{ color: selected ? 'rgba(255,255,255,0.58)' : '#8E8E93' }}>
                          {item.desc}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </aside>

            <div className="flex min-h-0 flex-col">
              <div className="flex h-14 shrink-0 items-center justify-between border-b border-[#EAEAEA] px-5">
                <div>
                  <h2 className="text-[16px] font-black" style={sdFontHeading}>
                    {SECTIONS.find((s) => s.key === active)?.label}
                  </h2>
                  <p className="text-[11px] text-[#8E8E93]">{SECTIONS.find((s) => s.key === active)?.desc}</p>
                </div>
                <button
                  type="button"
                  onClick={copyCurrent}
                  disabled={!analysis}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#E1E1E6] bg-white px-3 text-[12px] font-bold text-[#333333] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <i className={ri('ri-file-copy-line', 'text-[14px]')} aria-hidden />
                  {copied === active ? '已复制' : '复制'}
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-5">
                {uploading ? (
                  <div className="flex h-full min-h-[360px] flex-col items-center justify-center text-center">
                    <i className={ri('ri-loader-4-line', 'animate-spin text-[28px] text-[#1D1D1F]')} aria-hidden />
                    <p className="mt-4 text-[14px] font-bold">正在上传视频</p>
                    <p className="mt-2 text-[12px] text-[#8E8E93]">上传完成后会自动开始解析。</p>
                  </div>
                ) : !video ? (
                  <div className="flex h-full min-h-[360px] flex-col items-center justify-center text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#F5F5F7]" style={{ color: sdColors.ink }}>
                      <i className={ri('ri-movie-2-line', 'text-[26px]')} aria-hidden />
                    </div>
                    <p className="mt-4 text-[15px] font-black">先上传视频</p>
                    <p className="mt-2 max-w-sm text-[12px] leading-relaxed text-[#8E8E93]">
                      上传完成后，将在这里展示视频的结构化拆解结果。
                    </p>
                  </div>
                ) : analyzing || video.analysis_status === 'processing' ? (
                  <div className="flex h-full min-h-[360px] flex-col items-center justify-center text-center">
                    <i className={ri('ri-loader-4-line', 'animate-spin text-[28px] text-[#1D1D1F]')} aria-hidden />
                    <p className="mt-4 text-[14px] font-bold">正在解析这个视频</p>
                    <p className="mt-2 text-[12px] text-[#8E8E93]">请稍候，解析结果很快就会展示在这里。</p>
                  </div>
                ) : analysis ? (
                  currentValue ? <ValueBlock value={currentValue} /> : <p className="text-[13px] text-[#8E8E93]">该模块暂无解析内容。</p>
                ) : (
                  <div className="flex h-full min-h-[360px] flex-col items-center justify-center text-center">
                    <p className="text-[14px] font-bold">{video.analysis_status === 'failed' ? '解析失败' : '等待解析'}</p>
                    <p className="mt-2 max-w-sm text-[12px] leading-relaxed text-[#8E8E93]">
                      {video.error_message || '点击重新解析后会再次尝试解析该视频。'}
                    </p>
                    <button
                      type="button"
                      disabled={!canAnalyze}
                      onClick={async () => {
                        if (!video) return;
                        setAnalyzing(true);
                        setError(null);
                        try {
                          const analyzed = await analyzeReferenceVideo(video.id);
                          setVideo(analyzed.video);
                        } catch (e) {
                          setError(e instanceof ShortDramaApiError ? e.message : e instanceof Error ? e.message : '视频解析失败');
                        } finally {
                          setAnalyzing(false);
                        }
                      }}
                      className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-[#1D1D1F] px-4 text-[13px] font-bold text-white disabled:opacity-50"
                    >
                      <i className={ri('ri-refresh-line', 'text-[15px]')} aria-hidden />
                      重新解析
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
