import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUp,
  AtSign,
  Box,
  ChevronDown,
  Clock3,
  Film,
  Image as ImageIcon,
  Library,
  Music,
  Plus,
  SlidersHorizontal,
  Sparkles,
  Upload,
  UserRound,
  Video,
  WandSparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ShortDramaLayout } from '../short-drama/components/ShortDramaLayout';
import {
  createAdMaterialTask,
  getAdMaterialTask,
  listAdMaterialTasks,
  listAdMaterialTemplates,
  uploadAdMaterialAsset,
  type AdMaterialInputAsset,
  type AdMaterialTask,
  type AdMaterialTemplate,
  type AdMaterialUpload,
} from '../../services/adMaterialsApi';

type TabKey = 'studio' | 'templates';
type ReferencePanelKey = 'templates' | 'materials' | 'avatars' | 'mine';

type IndexedUpload = AdMaterialUpload & {
  refLabel: string;
  role: AdMaterialInputAsset['role'];
};

const ratioOptions = ['adaptive', '9:16', '3:4', '1:1', '4:3', '16:9', '21:9'];
const durationOptions = [4, 5, 8, 11, 15];
const resolutionOptions = ['480p', '720p', '1080p'];
const modelOptions = [
  { id: 'doubao-seedance-2-0-260128', label: 'Seedance 2.0' },
  { id: 'doubao-seedance-2-0-fast-260128', label: 'Seedance 2.0 Fast' },
];
const referenceModes = [
  { id: 'reference', label: '参考生成', description: '参考画面、主体、动作与声音' },
  { id: 'edit', label: '精准改写', description: '保留参考结构，替换商品或局部' },
  { id: 'extend', label: '续写扩展', description: '延续参考视频的运动与节奏' },
] as const;

const sourceTabs: Array<{ id: ReferencePanelKey; label: string; icon: typeof Library }> = [
  { id: 'templates', label: '模板库', icon: Library },
  { id: 'materials', label: '素材库', icon: ImageIcon },
  { id: 'avatars', label: '虚拟人像库', icon: UserRound },
  { id: 'mine', label: '我的', icon: Film },
];

function statusLabel(status: string): string {
  if (status === 'queued') return '排队中';
  if (status === 'running') return '生成中';
  if (status === 'succeeded') return '已完成';
  if (status === 'failed') return '失败';
  if (status === 'expired') return '已超时';
  return status;
}

function indexedUploads(uploads: AdMaterialUpload[]): IndexedUpload[] {
  let image = 0;
  let video = 0;
  let audio = 0;
  return uploads.map((upload) => {
    if (upload.asset_type === 'video') {
      video += 1;
      return { ...upload, refLabel: `@视频${video}`, role: 'reference_video' };
    }
    if (upload.asset_type === 'audio') {
      audio += 1;
      return { ...upload, refLabel: `@音频${audio}`, role: 'reference_audio' };
    }
    image += 1;
    return { ...upload, refLabel: `@图片${image}`, role: 'reference_image' };
  });
}

function defaultPrompt(): string {
  return '参考 @图片1 中的商品，生成一条适合电商投流的短视频。镜头1：商品在干净明亮的场景中出现，镜头缓慢推近；镜头2：展示商品细节和质感；镜头3：突出核心卖点，画面简洁高级。整体高清自然，避免无关 Logo、水印和乱码字幕。';
}

function promptTokenCount(prompt: string): number {
  return Math.max(1, Math.ceil(prompt.trim().length / 4));
}

function uploadIcon(type: AdMaterialUpload['asset_type']) {
  if (type === 'video') return Video;
  if (type === 'audio') return Music;
  if (type === 'avatar') return UserRound;
  return ImageIcon;
}

export function AdMaterialsPage() {
  const { isAuthenticated } = useAuth();
  const [tab, setTab] = useState<TabKey>('studio');
  const [referencePanel, setReferencePanel] = useState<ReferencePanelKey>('materials');
  const [templates, setTemplates] = useState<AdMaterialTemplate[]>([]);
  const [uploads, setUploads] = useState<AdMaterialUpload[]>([]);
  const [tasks, setTasks] = useState<AdMaterialTask[]>([]);
  const [activeTask, setActiveTask] = useState<AdMaterialTask | null>(null);
  const [prompt, setPrompt] = useState(defaultPrompt());
  const [ratio, setRatio] = useState('adaptive');
  const [duration, setDuration] = useState(5);
  const [resolution, setResolution] = useState('720p');
  const [model, setModel] = useState(modelOptions[0].id);
  const [generateAudio, setGenerateAudio] = useState(true);
  const [referenceMode, setReferenceMode] = useState<'reference' | 'edit' | 'extend'>('reference');
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [showReferencePicker, setShowReferencePicker] = useState(false);
  const promptRef = useRef<HTMLTextAreaElement | null>(null);

  const refs = useMemo(() => indexedUploads(uploads), [uploads]);
  const selectedModel = modelOptions.find((item) => item.id === model) || modelOptions[0];

  useEffect(() => {
    listAdMaterialTemplates().then(setTemplates).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    listAdMaterialTasks().then(setTasks).catch(() => undefined);
  }, [isAuthenticated]);

  useEffect(() => {
    if (!activeTask || !['queued', 'running'].includes(activeTask.status)) return undefined;
    const timer = window.setInterval(async () => {
      try {
        const fresh = await getAdMaterialTask(activeTask.id);
        setActiveTask(fresh);
        setTasks((prev) => [fresh, ...prev.filter((task) => task.id !== fresh.id)]);
      } catch (e) {
        setError(e instanceof Error ? e.message : '任务状态查询失败');
      }
    }, 3000);
    return () => window.clearInterval(timer);
  }, [activeTask]);

  function insertRef(label: string) {
    const textarea = promptRef.current;
    const token = `${label} `;
    if (!textarea) {
      setPrompt((value) => `${value}${token}`);
      return;
    }
    const start = textarea.selectionStart ?? prompt.length;
    const end = textarea.selectionEnd ?? prompt.length;
    const next = `${prompt.slice(0, start)}${token}${prompt.slice(end)}`;
    setPrompt(next);
    window.requestAnimationFrame(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + token.length;
    });
    setShowReferencePicker(false);
  }

  function onPromptChange(value: string) {
    setPrompt(value);
    setShowReferencePicker(value.endsWith('@') || /(^|\s)@$/.test(value));
  }

  async function onUpload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setError('');
    try {
      const uploaded: AdMaterialUpload[] = [];
      for (const file of Array.from(files)) {
        uploaded.push(await uploadAdMaterialAsset(file));
      }
      setUploads((prev) => [...prev, ...uploaded]);
    } catch (e) {
      setError(e instanceof Error ? e.message : '上传失败');
    } finally {
      setUploading(false);
    }
  }

  async function submitStudio() {
    setError('');
    if (!prompt.trim()) {
      setError('请输入生成提示词。');
      return;
    }
    if (model.includes('fast') && resolution === '1080p') {
      setError('Seedance 2.0 Fast 不支持 1080p。');
      return;
    }
    setSubmitting(true);
    try {
      const task = await createAdMaterialTask({
        mode: 'product_video',
        template_id: '',
        title: prompt.slice(0, 32) || '素材制作',
        prompt_text: prompt,
        product_name: '',
        selling_points: '',
        channel: referenceMode,
        style: '',
        edit_instruction: '',
        assets: refs.map((upload) => ({
          type: upload.asset_type,
          url: upload.url,
          role: upload.role,
          label: upload.refLabel,
        })),
        ratio,
        resolution,
        duration,
        generate_audio: generateAudio,
        watermark: false,
        return_last_frame: true,
        model,
      });
      setActiveTask(task);
      setTasks((prev) => [task, ...prev]);
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建任务失败');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ShortDramaLayout>
      <main className="min-h-screen bg-[#F7F8FC] px-5 py-8 md:px-10">
        <div className="mx-auto max-w-[1480px]">
          <div className="mb-8">
            <h1 className="text-[34px] font-black text-[#1D1D1F]">投流素材</h1>
            <p className="mt-2 text-[15px] text-[#667085]">模板复刻与 Seedance 多模态素材制作</p>
          </div>

          <div className="mb-7 flex w-fit rounded-xl border border-[#E1E5EE] bg-white p-1 shadow-sm">
            {tab === 'studio' ? (
              <button
                onClick={() => setTab('templates')}
                className="flex items-center gap-2 rounded-lg px-7 py-3 text-[15px] font-black text-[#1D1D1F]"
              >
                <i className="ri-layout-grid-line" />
                模板专区
              </button>
            ) : (
              <button
                onClick={() => setTab('studio')}
                className="flex items-center gap-2 rounded-lg px-7 py-3 text-[15px] font-black text-[#1D1D1F]"
              >
                <i className="ri-sparkling-2-line" />
                素材制作
              </button>
            )}
          </div>

          {tab === 'templates' ? (
            <section className="rounded-2xl border border-[#E1E5EE] bg-white p-6 shadow-sm">
              <div className="mb-6">
                <h2 className="text-xl font-black text-[#1D1D1F]">模板专区</h2>
                <p className="mt-2 text-[15px] text-[#1D1D1F]">同款制作流程稍后接入</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {templates.map((template) => (
                  <article key={template.id} className="rounded-xl border border-[#E1E5EE] bg-[#FAFBFE] p-5">
                    <h3 className="text-[16px] font-black text-[#1D1D1F]">{template.name}</h3>
                    <div className="mt-2 text-sm text-[#1D1D1F]">{template.category} · {template.default_duration}s · {template.default_ratio}</div>
                    <p className="mt-4 min-h-16 text-[15px] leading-7 text-[#1D1D1F]">{template.description}</p>
                    <button className="mt-5 inline-flex items-center gap-2 rounded-lg border border-[#9DB7FF] bg-white px-4 py-2 text-[15px] font-bold text-[#1D1D1F]">
                      <i className="ri-play-circle-line" />
                      查看模板
                    </button>
                  </article>
                ))}
              </div>
            </section>
          ) : (
            <>
              <section className="rounded-2xl border border-[#DFE5F2] bg-white p-5 shadow-[0_18px_45px_rgba(27,39,76,0.08)] md:p-7">
                <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h2 className="text-[24px] font-black text-[#1D1D1F]">素材制作</h2>
                    <p className="mt-2 text-[15px] leading-7 text-[#667085]">
                      上传最多 12 个参考内容，输入 @ 可锚定图片、视频、音频或虚拟人像，组合生成新投流视频。
                    </p>
                  </div>
                  <div className="flex h-10 items-center gap-2 rounded-lg border border-[#E6EAF3] bg-[#F9FAFD] px-3 text-[14px] font-bold text-[#475467]">
                    <Sparkles className="h-4 w-4 text-[#00A6B8]" />
                    {promptTokenCount(prompt)} tokens
                  </div>
                </div>

                <div className="mb-4 flex flex-wrap gap-2">
                  {sourceTabs.map((item) => {
                    const Icon = item.icon;
                    const active = referencePanel === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setReferencePanel(item.id)}
                        className={`inline-flex h-10 items-center gap-2 rounded-lg border px-4 text-[14px] font-black transition ${
                          active
                            ? 'border-[#1D1D1F] bg-[#1D1D1F] text-white'
                            : 'border-[#DEE4F0] bg-white text-[#667085] hover:border-[#AEB7CC] hover:text-[#1D1D1F]'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {item.label}
                      </button>
                    );
                  })}
                </div>

                <div className="rounded-xl border border-[#DDE4F2] bg-[#FBFCFF] p-4">
                  <div className="grid gap-4 lg:grid-cols-[190px_minmax(0,1fr)]">
                    <div>
                      <label className="flex h-[132px] cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-[#C9D2E6] bg-white text-[#667085] transition hover:border-[#00A6B8] hover:text-[#1D1D1F]">
                        <Plus className="h-7 w-7" />
                        <span className="mt-3 text-[15px] font-black">{uploading ? '上传中' : '参考内容'}</span>
                        <span className="mt-1 text-[13px]">图片/视频/音频</span>
                        <input type="file" multiple accept="image/*,video/*,audio/*" className="hidden" onChange={(e) => onUpload(e.target.files)} disabled={!isAuthenticated || uploading || refs.length >= 12} />
                      </label>
                      <div className="mt-3 flex items-center justify-between text-[13px] font-bold text-[#667085]">
                        <span>{referencePanel === 'materials' ? '本地上传素材' : '可用素材入口'}</span>
                        <span>{refs.length}/12</span>
                      </div>
                    </div>

                    <div className="relative min-h-[230px]">
                      <textarea
                        ref={promptRef}
                        value={prompt}
                        onChange={(e) => onPromptChange(e.target.value)}
                        onFocus={() => prompt.endsWith('@') && setShowReferencePicker(true)}
                        className="h-[230px] w-full resize-none rounded-lg border border-transparent bg-transparent px-2 py-1 text-[18px] leading-9 text-[#1D1D1F] outline-none placeholder:text-[#A4ACBD]"
                        placeholder="上传参考素材，输入文字或 @ 参考内容，自由组合图、文、音、视频多元素。例：参考 @图片1 的商品和 @视频1 的动作，生成一条自然高级的电商投流视频。"
                      />

                      {showReferencePicker && (
                        <div className="absolute left-2 top-12 z-10 w-full max-w-[420px] rounded-xl border border-[#DDE4F2] bg-white p-2 shadow-[0_18px_42px_rgba(15,23,42,0.14)]">
                          {refs.length ? (
                            refs.map((upload) => {
                              const Icon = uploadIcon(upload.asset_type);
                              return (
                                <button
                                  key={upload.storage_key}
                                  onClick={() => insertRef(upload.refLabel)}
                                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-[#F3F6FB]"
                                >
                                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#EAF7F8] text-[#007A86]">
                                    <Icon className="h-4 w-4" />
                                  </span>
                                  <span className="min-w-0">
                                    <span className="block text-[14px] font-black text-[#1D1D1F]">{upload.refLabel}</span>
                                    <span className="block truncate text-[13px] text-[#667085]">{upload.file_name}</span>
                                  </span>
                                </button>
                              );
                            })
                          ) : (
                            <div className="px-3 py-4 text-[14px] leading-6 text-[#667085]">上传参考内容后，可用 @图片1、@视频1、@音频1 快速锚定。</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {!!refs.length && (
                    <div className="mt-4 flex flex-wrap gap-2 border-t border-[#E6EAF3] pt-4">
                      {refs.map((upload) => {
                        const Icon = uploadIcon(upload.asset_type);
                        return (
                          <button
                            key={upload.storage_key}
                            onClick={() => insertRef(upload.refLabel)}
                            className="inline-flex h-10 max-w-[260px] items-center gap-2 rounded-lg border border-[#DDE4F2] bg-white px-3 text-[13px] font-bold text-[#1D1D1F] hover:border-[#00A6B8]"
                          >
                            <Icon className="h-4 w-4 shrink-0 text-[#00A6B8]" />
                            <span className="shrink-0">{upload.refLabel}</span>
                            <span className="truncate font-normal text-[#667085]">{upload.file_name}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <label className="relative inline-flex h-11 items-center rounded-lg border border-[#DDE4F2] bg-white pl-3 pr-9 text-[15px] font-bold text-[#1D1D1F]">
                      <WandSparkles className="mr-2 h-4 w-4 text-[#00A6B8]" />
                      <select value={referenceMode} onChange={(e) => setReferenceMode(e.target.value as typeof referenceMode)} className="appearance-none bg-transparent outline-none">
                        {referenceModes.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 text-[#667085]" />
                    </label>

                    <label className="relative inline-flex h-11 items-center rounded-lg border border-[#DDE4F2] bg-white pl-3 pr-9 text-[15px] font-bold text-[#1D1D1F]">
                      <Box className="mr-2 h-4 w-4 text-[#475467]" />
                      <select value={model} onChange={(e) => setModel(e.target.value)} className="appearance-none bg-transparent outline-none">
                        {modelOptions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 text-[#667085]" />
                    </label>

                    <label className="relative inline-flex h-11 items-center rounded-lg border border-[#DDE4F2] bg-white pl-3 pr-9 text-[15px] font-bold text-[#1D1D1F]">
                      <AtSign className="mr-2 h-4 w-4 text-[#00A6B8]" />
                      <select value={ratio} onChange={(e) => setRatio(e.target.value)} className="appearance-none bg-transparent outline-none">
                        {ratioOptions.map((item) => <option key={item} value={item}>{item === 'adaptive' ? '智能比例' : item}</option>)}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 text-[#667085]" />
                    </label>

                    <label className="relative inline-flex h-11 items-center rounded-lg border border-[#DDE4F2] bg-white pl-3 pr-9 text-[15px] font-bold text-[#1D1D1F]">
                      <SlidersHorizontal className="mr-2 h-4 w-4 text-[#475467]" />
                      <select value={resolution} onChange={(e) => setResolution(e.target.value)} className="appearance-none bg-transparent outline-none">
                        {resolutionOptions.map((item) => <option key={item} disabled={model.includes('fast') && item === '1080p'}>{item}</option>)}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 text-[#667085]" />
                    </label>

                    <label className="relative inline-flex h-11 items-center rounded-lg border border-[#DDE4F2] bg-white pl-3 pr-9 text-[15px] font-bold text-[#1D1D1F]">
                      <Clock3 className="mr-2 h-4 w-4 text-[#475467]" />
                      <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="appearance-none bg-transparent outline-none">
                        {durationOptions.map((item) => <option key={item} value={item}>{item}s</option>)}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 text-[#667085]" />
                    </label>

                    <button
                      onClick={() => setGenerateAudio((v) => !v)}
                      className={`inline-flex h-11 items-center gap-2 rounded-lg border px-4 text-[15px] font-bold ${
                        generateAudio ? 'border-[#8CA3FF] bg-[#F0F3FF] text-[#384BD8]' : 'border-[#DDE4F2] bg-white text-[#667085]'
                      }`}
                    >
                      {generateAudio ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                      {generateAudio ? '输出声音' : '无声视频'}
                    </button>

                    <button
                      onClick={() => refs[0] ? insertRef(refs[0].refLabel) : setShowReferencePicker((value) => !value)}
                      className="inline-flex h-11 items-center gap-2 rounded-lg border border-[#DDE4F2] bg-white px-4 text-[15px] font-bold text-[#1D1D1F]"
                    >
                      <AtSign className="h-4 w-4 text-[#00A6B8]" />
                      引用
                    </button>

                    <div className="ml-auto flex items-center gap-3">
                      <div className="hidden text-right text-[13px] leading-5 text-[#667085] md:block">
                        <div>{selectedModel.label} · {ratio === 'adaptive' ? '智能比例' : ratio}</div>
                        <div>{resolution} · {duration}s · {generateAudio ? '含声音' : '无声'}</div>
                      </div>
                      <button
                        onClick={submitStudio}
                        disabled={!isAuthenticated || submitting || uploading}
                        aria-label="生成视频"
                        className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1D1D1F] text-white shadow-[0_10px_24px_rgba(29,29,31,0.22)] transition hover:bg-[#00A6B8] disabled:bg-[#C7C7CC]"
                      >
                        {submitting ? <Upload className="h-5 w-5 animate-pulse" /> : <ArrowUp className="h-6 w-6" />}
                      </button>
                    </div>
                  </div>
                </div>

                {error && <div className="mt-4 rounded-lg bg-[#FFF2F2] px-3 py-2 text-sm text-[#B42318]">{error}</div>}
              </section>

              <section className="mt-7 rounded-2xl border border-[#E1E5EE] bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-xl font-black text-[#1D1D1F]">生成结果</h2>
                  {activeTask && <span className="text-sm font-bold text-[#1D1D1F]">{statusLabel(activeTask.status)}</span>}
                </div>
                {activeTask ? (
                  <div>
                    {activeTask.video_url && <video src={activeTask.video_url} controls className="w-full max-w-xl rounded-xl bg-black" />}
                    {activeTask.error_message && <div className="text-sm text-[#B42318]">{activeTask.error_message}</div>}
                    {activeTask.video_url && <a href={activeTask.video_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex rounded-lg bg-[#1D1D1F] px-4 py-2 text-sm font-bold text-white">打开视频</a>}
                  </div>
                ) : (
                  <div className="rounded-xl bg-[#FAFBFE] p-5 text-[15px] leading-7 text-[#667085]">
                    生成后会在这里显示任务状态和最终视频。火山临时链接会由后端立即转存到 R2。
                  </div>
                )}
                {!!tasks.length && (
                  <div className="mt-5 grid gap-2">
                    {tasks.slice(0, 5).map((task) => (
                      <button key={task.id} onClick={() => setActiveTask(task)} className="rounded-lg bg-[#FAFBFE] px-3 py-2 text-left text-sm">
                        {task.title || `任务 #${task.id}`} · {statusLabel(task.status)}
                      </button>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </main>
    </ShortDramaLayout>
  );
}
