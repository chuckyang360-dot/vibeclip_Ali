import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getUser } from '../../services/api';
import {
  createFreeCreationProject,
  updateFreeCreationSegment,
  uploadFreeCreationAsset,
  type FreeCreationInputAsset,
} from '@/services/freeCreationApi';
import { SDWorkflowNav } from './components/SDWorkflowNav';
import {
  ShortDramaApiError,
  createShortDramaProject,
  getShortDramaProject,
  prepareShortDramaScriptImport,
  saveShortDramaCreativeIntent,
  uploadReferenceVideo,
} from '@/services/shortDramaApi';
import type { CreativeIntentInputDto } from '@/types/shortDramaApi';
import { useShortDramaProject } from './hooks/useShortDramaProject';
import { MobileBottomActionBar } from './components/MobileBottomActionBar';
import {
  CreationTypeDropdown,
  S0PromptShell,
  ToolbarButton,
  type S0CreationType,
} from './components/S0CreationWorkbench';
import {
  VirtualAvatarPicker,
  type VirtualAvatar,
  virtualAvatarToInputAsset,
} from '../free-creation/virtualAvatarLibrary';
import { ri } from './utils/shortDramaHelpers';
import { withProjectQuery } from './utils/shortDramaRoutes';

const platformOptions = ['TikTok', '抖音', '小红书', 'Amazon', 'Instagram', 'YouTube'];
const durationOptions = ['15s', '30s', '45s', '60s'];
const aspectRatioOptions = ['9:16', '16:9'];
const freeResolutionOptions = ['480p', '720p', '1080p'];
type HintPanel = 'platform' | 'ratio' | 'duration' | 'free_model' | 'free_ratio' | 'free_resolution' | 'free_duration' | null;
type ActiveHintPanel = Exclude<HintPanel, null>;

const emptyIntent: CreativeIntentInputDto = {
  intent_text: '',
  platform_hints: [],
  duration_hint: '',
  aspect_ratio_hint: '',
};

function parseProjectId(searchParams: URLSearchParams): number | null {
  const raw = searchParams.get('projectId') ?? searchParams.get('project_id');
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

function parseMode(searchParams: URLSearchParams): S0CreationType {
  const mode = searchParams.get('mode');
  if (mode === 'script_import' || mode === 'video_analysis' || mode === 'free_creation') return mode;
  return 'intent';
}

function projectNameFromIntent(text: string): string {
  const cleaned = text.trim().replace(/\s+/g, ' ');
  return cleaned ? cleaned.slice(0, 28) : '未命名 VibeClip 项目';
}

function hintSummary(intent: CreativeIntentInputDto): string {
  const rows = [
    intent.platform_hints.length ? `${intent.platform_hints.length} 平台` : '',
    intent.aspect_ratio_hint,
    intent.duration_hint,
  ].filter(Boolean);
  return rows.length ? rows.join(' · ') : '未设置';
}

function ToggleOption({
  active,
  children,
  disabled = false,
  onClick,
}: {
  active: boolean;
  children: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg border px-3 py-2 text-[12.5px] font-bold transition ${
        active ? 'border-[#1D1D1F] bg-[#1D1D1F] text-white' : 'border-[#E5E5EA] bg-[#F7F8FA] text-[#6E6E73] hover:text-[#1D1D1F]'
      } disabled:cursor-not-allowed disabled:border-[#E5E5EA] disabled:bg-[#F7F8FA] disabled:text-[#C7C7CC]`}
    >
      {children}
    </button>
  );
}

function VerticalOption({
  active,
  children,
  disabled = false,
  icon,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  disabled?: boolean;
  icon?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex h-11 w-full items-center justify-between rounded-lg px-3 text-left text-[14px] font-black transition disabled:cursor-not-allowed disabled:text-[#C7C7CC] ${
        active ? 'bg-[#F2F4F8] text-[#1D1D1F]' : 'text-[#444444] hover:bg-[#F7F8FA]'
      }`}
    >
      <span className="inline-flex min-w-0 items-center gap-2">
        {icon ? <i className={ri(icon, 'text-[16px]')} aria-hidden /> : null}
        <span className="truncate">{children}</span>
      </span>
      {active ? <i className={ri('ri-check-line', 'text-[16px]')} aria-hidden /> : null}
    </button>
  );
}

function FreeDropdown({
  children,
  title,
  widthClass = 'w-[180px]',
}: {
  children: ReactNode;
  title: string;
  widthClass?: string;
}) {
  return (
    <div className={`absolute bottom-[calc(100%+10px)] left-1/2 z-20 -translate-x-1/2 rounded-xl border border-[#E5E5EA] bg-white p-2 shadow-[0_18px_42px_rgba(15,23,42,0.16)] ${widthClass}`}>
      <p className="px-2 pb-2 pt-1 text-[12px] font-bold text-[#8E8E93]">{title}</p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

export function ShortDramaCreateProjectPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { setSession } = useShortDramaProject();
  const routedProjectId = useMemo(() => parseProjectId(searchParams), [searchParams]);
  const [projectId, setProjectId] = useState<number | null>(routedProjectId);
  const [creationType, setCreationType] = useState<S0CreationType>(() => parseMode(searchParams));
  const [intent, setIntent] = useState<CreativeIntentInputDto>(emptyIntent);
  const [scriptText, setScriptText] = useState('');
  const [scriptFileName, setScriptFileName] = useState('');
  const [strictScriptMode, setStrictScriptMode] = useState(false);
  const [freePrompt, setFreePrompt] = useState('');
  const [freeRatio, setFreeRatio] = useState('9:16');
  const [freeModel, setFreeModel] = useState('Seedance 2.0');
  const [freeResolution, setFreeResolution] = useState('720p');
  const [freeDuration, setFreeDuration] = useState('5s');
  const [freeAudio, setFreeAudio] = useState(true);
  const [freeFiles, setFreeFiles] = useState<File[]>([]);
  const [freeVirtualAvatars, setFreeVirtualAvatars] = useState<VirtualAvatar[]>([]);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const [freeMentionOpen, setFreeMentionOpen] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);
  const [hintPanel, setHintPanel] = useState<HintPanel>(null);
  const [focused, setFocused] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [videoUploading, setVideoUploading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const scriptFileRef = useRef<HTMLInputElement>(null);
  const videoFileRef = useRef<HTMLInputElement>(null);
  const freeFileRef = useRef<HTMLInputElement>(null);
  const freePromptRef = useRef<HTMLTextAreaElement>(null);

  const user = getUser();
  const canSubmitProject = Boolean(
    user &&
    !submitting &&
    (creationType === 'script_import' ? scriptText.trim().length >= 4 : creationType === 'intent' ? intent.intent_text.trim() : false),
  );
  const canPrimaryAction = creationType === 'video_analysis' ? !videoUploading : creationType === 'free_creation' ? Boolean(user && !submitting && freePrompt.trim()) : canSubmitProject;
  const canSaveDraft = creationType === 'intent' && canSubmitProject;
  const workflowMode = creationType === 'script_import' || creationType === 'video_analysis' || creationType === 'free_creation' ? creationType : 'standard';
  const indexedFreeFiles = useMemo(() => {
    let image = 0;
    let video = 0;
    let audio = 0;
    return freeFiles.map((file) => {
      const type = file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'audio' : 'image';
      if (type === 'video') video += 1;
      else if (type === 'audio') audio += 1;
      else image += 1;
      const label = type === 'video' ? `@视频${video}` : type === 'audio' ? `@音频${audio}` : `@图片${image}`;
      return { file, type, label };
    });
  }, [freeFiles]);
  const freeImageFileCount = indexedFreeFiles.filter((item) => item.type === 'image').length;
  const indexedFreeVirtualAvatars = useMemo(() => (
    freeVirtualAvatars.map((avatar, index) => ({
      avatar,
      label: `@图片${freeImageFileCount + index + 1}`,
    }))
  ), [freeImageFileCount, freeVirtualAvatars]);
  const freeReferenceCount = freeFiles.length + freeVirtualAvatars.length;

  const toggleHintPanel = (panel: ActiveHintPanel) => {
    setTypeOpen(false);
    setHintPanel((prev) => (prev === panel ? null : panel));
  };

  useEffect(() => {
    setCreationType(parseMode(searchParams));
  }, [searchParams]);

  useEffect(() => {
    if (freeModel === 'Seedance 2.0 Fast' && freeResolution === '1080p') {
      setFreeResolution('720p');
    }
  }, [freeModel, freeResolution]);

  useEffect(() => {
    if (routedProjectId == null) return;
    setProjectId(routedProjectId);
    let cancelled = false;
    void (async () => {
      try {
        const project = await getShortDramaProject(routedProjectId);
        if (cancelled) return;
        if (project.creative_intent_input) {
          setIntent({
            intent_text: project.creative_intent_input.intent_text || '',
            platform_hints: project.creative_intent_input.platform_hints || [],
            duration_hint: project.creative_intent_input.duration_hint || '',
            aspect_ratio_hint: project.creative_intent_input.aspect_ratio_hint || '',
          });
        }
        if (project.workflow_mode === 'script_import' && project.script_import) {
          setCreationType('script_import');
          setScriptText(project.script_import.source?.raw_text || '');
          setScriptFileName(project.script_import.source?.file_name || '');
        }
        setSession(project.id, project.project_name);
      } catch {
        if (!cancelled) setProjectId(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [routedProjectId, setSession]);

  const selectCreationType = (type: S0CreationType) => {
    setCreationType(type);
    setHintPanel(null);
    const next = new URLSearchParams(searchParams);
    next.set('mode', type);
    setSearchParams(next, { replace: true });
  };

  const ensureProject = async (): Promise<number> => {
    if (projectId) return projectId;
    if (!user) throw new Error('请先登录后再创建项目。');
    const seedText = creationType === 'script_import' ? scriptText.trim().slice(0, 280) : intent.intent_text.trim();
    const res = await createShortDramaProject({
      user_id: user.id,
      project_name: projectNameFromIntent(seedText),
      duration: intent.duration_hint || undefined,
      aspect_ratio: intent.aspect_ratio_hint || undefined,
      creative_intent: seedText,
    });
    const p = res.project;
    setProjectId(p.id);
    setSession(p.id, p.project_name);
    return p.id;
  };

  const persistIntent = async (): Promise<number> => {
    const id = await ensureProject();
    await saveShortDramaCreativeIntent(id, {
      ...intent,
      intent_text: intent.intent_text.trim(),
    });
    return id;
  };

  const freeModelId = (label: string): string => {
    if (label === 'Seedance 2.0 Fast') return 'doubao-seedance-2-0-fast-260128';
    return 'doubao-seedance-2-0-260128';
  };

  const freeDurationSeconds = (label: string): number => {
    const n = Number.parseInt(label, 10);
    return Number.isFinite(n) && n > 0 ? n : 5;
  };

  const handleFreeCreationStart = async () => {
    if (!user) {
      setSubmitError('请先登录后再创建项目。');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const project = await createFreeCreationProject({
        title: projectNameFromIntent(freePrompt),
        prompt: freePrompt.trim(),
        model: freeModelId(freeModel),
        ratio: freeRatio === '智能比例' ? '9:16' : freeRatio,
        resolution: freeResolution,
        duration: freeDurationSeconds(freeDuration),
        generate_audio: freeAudio,
        watermark: false,
      });
      const firstSegment = project.segments[0];
      if ((freeFiles.length || freeVirtualAvatars.length) && firstSegment) {
        const uploaded = await Promise.all(freeFiles.map((file) => uploadFreeCreationAsset(project.id, file)));
        const assets: FreeCreationInputAsset[] = uploaded.map((item) => ({
          type: item.asset_type,
          url: item.url,
          storage_key: item.storage_key,
          file_name: item.file_name,
          mime_type: item.mime_type,
          file_size: item.file_size,
          role: item.role,
          label: item.label,
        }));
        indexedFreeVirtualAvatars.forEach(({ avatar, label }) => {
          assets.push(virtualAvatarToInputAsset(avatar, label));
        });
        await updateFreeCreationSegment(firstSegment.id, { assets });
      }
      navigate(`/free-creation/projects/${project.id}/video`);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : '自由创作项目创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleNext = async () => {
    if (!user) {
      setSubmitError('请先登录后再创建项目。');
      return;
    }
    if (creationType === 'free_creation') {
      await handleFreeCreationStart();
      return;
    }
    if (creationType === 'video_analysis') {
      videoFileRef.current?.click();
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      if (creationType === 'script_import') {
        const effectiveIntent = scriptText.trim().slice(0, 240) || '剧本导入项目';
        const id = await ensureProject();
        await saveShortDramaCreativeIntent(id, {
          ...intent,
          intent_text: intent.intent_text.trim() || effectiveIntent,
        });
        await prepareShortDramaScriptImport(id, {
          raw_text: scriptText.trim(),
          file_name: scriptFileName,
          platform_hints: intent.platform_hints,
          duration_hint: intent.duration_hint,
          aspect_ratio_hint: intent.aspect_ratio_hint,
          strict_mode: strictScriptMode,
        });
        navigate(withProjectQuery('/short-drama/step4', id));
      } else {
        const id = await persistIntent();
        navigate(withProjectQuery('/short-drama/product-input', id));
      }
    } catch (e) {
      setSubmitError(e instanceof ShortDramaApiError ? e.message : e instanceof Error ? e.message : '创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleScriptFile = async (file: File | null) => {
    if (!file) return;
    setSubmitError(null);
    setScriptFileName(file.name);
    try {
      const text = await file.text();
      setScriptText(text);
    } catch {
      setSubmitError('文件读取失败，请改用粘贴剧本内容。');
    }
  };

  const handleVideoFile = async (file: File | null) => {
    if (!file) return;
    setSubmitError(null);
    setVideoUploading(true);
    try {
      const uploaded = await uploadReferenceVideo(file, user?.id ?? null);
      navigate(`/short-drama/video-analysis?video_id=${uploaded.id}`);
    } catch (e) {
      setSubmitError(e instanceof ShortDramaApiError ? e.message : e instanceof Error ? e.message : '视频上传失败');
    } finally {
      setVideoUploading(false);
    }
  };

  const handleFreeFiles = (files: FileList | null) => {
    if (!files?.length) return;
    setFreeFiles((prev) => [...prev, ...Array.from(files)].slice(0, 12));
    setSubmitError(null);
  };

  const handleFreePromptChange = (value: string) => {
    setFreePrompt(value);
    setFreeMentionOpen(value.endsWith('@'));
  };

  const insertFreeMention = (label: string) => {
    const atIndex = freePrompt.lastIndexOf('@');
    const next =
      atIndex >= 0
        ? `${freePrompt.slice(0, atIndex)}${label} ${freePrompt.slice(atIndex + 1)}`
        : `${freePrompt}${freePrompt.endsWith(' ') || !freePrompt ? '' : ' '}${label} `;
    setFreePrompt(next);
    setFreeMentionOpen(false);
    window.setTimeout(() => freePromptRef.current?.focus(), 0);
  };

  const selectFreeVirtualAvatar = (avatar: VirtualAvatar) => {
    const exists = freeVirtualAvatars.some((item) => item.assetUri === avatar.assetUri);
    const nextIndex = exists
      ? freeVirtualAvatars.findIndex((item) => item.assetUri === avatar.assetUri)
      : freeVirtualAvatars.length;
    if (!exists) {
      setFreeVirtualAvatars((prev) => [...prev, avatar]);
    }
    insertFreeMention(`@图片${freeImageFileCount + nextIndex + 1}`);
    setAvatarPickerOpen(false);
  };

  const saveDraft = async () => {
    if (!canSaveDraft) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await persistIntent();
    } catch (e) {
      setSubmitError(e instanceof ShortDramaApiError ? e.message : e instanceof Error ? e.message : '保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  const showStandardHints = creationType === 'intent' || creationType === 'script_import';
  const titleCopy = {
    intent: '描述你的创作想法',
    script_import: '导入剧本，快速生成视频',
    video_analysis: '上传视频，拆解创作方法',
    free_creation: '自由创作，创意无限',
  }[creationType];
  const subtitleCopy = {
    intent: '告诉 AI 你的目标、风格和方向，后续再补充商品信息。',
    script_import: '粘贴或上传剧本，AI 会解析分镜并进入视频生成流程。',
    video_analysis: '上传参考视频，拆出剧本结构、拍摄方法和分镜提示词。',
    free_creation: '输入 prompt，也可以添加参考素材，直接生成视频。',
  }[creationType];
  const submitLabel = creationType === 'script_import' ? '解析剧本并生成视频' : creationType === 'video_analysis' ? '下一步：开始解析' : creationType === 'free_creation' ? '下一步：生成视频' : '下一步：上传商品';

  return (
    <div className="min-h-screen bg-[#F7F8FA]" style={{ fontFamily: "'Inter', sans-serif" }}>
      <SDWorkflowNav
        currentStep={0}
        projectId={projectId}
        allowSaveAndLeave={false}
        workflowMode={workflowMode}
      />
      <div className="pt-[112px] md:pt-14">
        <main className="mx-auto max-w-5xl px-4 pb-28 pt-7 md:px-5 md:py-10">
          <S0PromptShell
            eyebrow="S0 · 创作意图"
            title={titleCopy}
            subtitle={subtitleCopy}
            className="max-w-[940px]"
          >
            <section
              className="relative mb-5 overflow-visible rounded-2xl bg-white transition-all duration-200"
              style={{ border: `1.5px solid ${focused ? '#1D1D1F' : '#E5E5EA'}` }}
            >
              <div className="flex min-h-[168px] gap-4 px-5 pt-5">
                {(creationType === 'script_import' || creationType === 'video_analysis' || creationType === 'free_creation') && (
                  <button
                    type="button"
                    onClick={() => {
                      if (creationType === 'script_import') scriptFileRef.current?.click();
                      if (creationType === 'video_analysis') videoFileRef.current?.click();
                      if (creationType === 'free_creation') freeFileRef.current?.click();
                    }}
                    disabled={false}
                    className="mt-1 flex h-20 w-16 shrink-0 rotate-[-7deg] items-center justify-center rounded-lg border border-dashed border-[#D6DCE8] bg-[#F7F8FA] text-[30px] font-light text-[#8E8E93] disabled:cursor-default"
                    aria-label={creationType === 'script_import' ? '上传 pmt' : '上传视频'}
                  >
                    +
                  </button>
                )}

                {creationType === 'video_analysis' ? (
                  <div className="flex min-h-[120px] flex-1 items-start pt-2 text-[15px] leading-8 text-[#A4ACBD]">
                    {videoUploading ? '视频上传中，上传完成后进入解析页面。' : '请上传您的视频，开始解析'}
                  </div>
                ) : (
                  <div className="relative flex-1">
                  <textarea
                    ref={creationType === 'free_creation' ? freePromptRef : undefined}
                    value={creationType === 'script_import' ? scriptText : creationType === 'free_creation' ? freePrompt : intent.intent_text}
                    onChange={(e) => {
                      if (creationType === 'script_import') setScriptText(e.target.value);
                      else if (creationType === 'free_creation') handleFreePromptChange(e.target.value);
                      else setIntent((p) => ({ ...p, intent_text: e.target.value }));
                    }}
                    onFocus={() => setFocused(true)}
                    onBlur={() => {
                      setFocused(false);
                      window.setTimeout(() => setFreeMentionOpen(false), 160);
                    }}
                    rows={4}
                    placeholder={
                      creationType === 'script_import'
                        ? '粘贴你的剧本、分镜、口播稿或 prompt 模板。'
                        : creationType === 'free_creation'
                          ? '上传参考素材，输入文字或 @ 参考内容，自由组合图、文、音、视频多元素。'
                          : '例如：我想给这个鼻毛器做一个适合 TikTok 的欧美风短剧，感觉真实一点，不要太像硬广，突出便携、安全、不尴尬。'
                    }
                    className="min-h-[120px] w-full resize-none bg-transparent text-[15px] leading-8 text-[#1D1D1F] outline-none placeholder:text-[#A4ACBD]"
                  />
                  {creationType === 'free_creation' && freeMentionOpen ? (
                    <div className="absolute left-0 top-11 z-30 w-[280px] rounded-xl border border-[#E5E5EA] bg-white p-2 shadow-[0_18px_42px_rgba(15,23,42,0.16)]">
                      {indexedFreeFiles.length || indexedFreeVirtualAvatars.length ? (
                        <>
                          {indexedFreeFiles.map(({ file, type, label }) => (
                        <button
                          key={`${label}-${file.name}-${file.size}`}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => insertFreeMention(label)}
                          className="flex h-14 w-full items-center gap-3 rounded-lg px-2 text-left hover:bg-[#F2F4F8]"
                        >
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#F2F4F8] text-[#6E6E73]">
                            <i className={ri(type === 'video' ? 'ri-movie-2-line' : type === 'audio' ? 'ri-volume-up-line' : 'ri-image-line', 'text-[17px]')} aria-hidden />
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-[15px] font-black text-[#1D1D1F]">{label}</span>
                            <span className="block truncate text-[11px] font-normal text-[#8E8E93]">{file.name}</span>
                          </span>
                        </button>
                          ))}
                          {indexedFreeVirtualAvatars.map(({ avatar, label }) => (
                            <button
                              key={`${label}-${avatar.id}`}
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => insertFreeMention(label)}
                              className="flex h-14 w-full items-center gap-3 rounded-lg px-2 text-left hover:bg-[#F2F4F8]"
                            >
                              <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-[#F2F4F8]">
                                <img src={avatar.previewUrl} alt={avatar.name} className="h-full w-full object-cover" />
                              </span>
                              <span className="min-w-0">
                                <span className="block truncate text-[15px] font-black text-[#1D1D1F]">{label}</span>
                                <span className="block truncate text-[11px] font-normal text-[#8E8E93]">{avatar.name} · {avatar.country} · {avatar.gender}</span>
                              </span>
                            </button>
                          ))}
                        </>
                      ) : (
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setFreeMentionOpen(false);
                            setAvatarPickerOpen(true);
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-3 text-left text-[12.5px] font-bold text-[#6E6E73] hover:bg-[#F2F4F8]"
                        >
                          <i className={ri('ri-user-search-line', 'text-[15px]')} aria-hidden />
                          打开人像库
                        </button>
                      )}
                    </div>
                  ) : null}
                  </div>
                )}
              </div>

              <div className="border-t border-[#F0F0F0] px-5 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <CreationTypeDropdown
                    active={creationType}
                    open={typeOpen}
                    onOpenChange={(open) => {
                      setTypeOpen(open);
                      if (open) setHintPanel(null);
                    }}
                    onSelect={selectCreationType}
                  />

                  {showStandardHints && (
                    <>
                      <ToolbarButton onClick={() => toggleHintPanel('platform')}>
                        <i className={ri('ri-global-line', 'text-[15px]')} aria-hidden />
                        参考平台
                        <span className="text-[#8E8E93]">{intent.platform_hints.length ? intent.platform_hints.join('/') : ''}</span>
                      </ToolbarButton>
                      <ToolbarButton onClick={() => toggleHintPanel('ratio')}>
                        <i className={ri('ri-aspect-ratio-line', 'text-[15px]')} aria-hidden />
                        画面比例
                        <span className="text-[#8E8E93]">{intent.aspect_ratio_hint || ''}</span>
                      </ToolbarButton>
                      <ToolbarButton onClick={() => toggleHintPanel('duration')}>
                        <i className={ri('ri-time-line', 'text-[15px]')} aria-hidden />
                        大概时长
                        <span className="text-[#8E8E93]">{intent.duration_hint || ''}</span>
                      </ToolbarButton>
                    </>
                  )}

                  {creationType === 'script_import' && (
                    <label className="ml-1 flex cursor-pointer items-center gap-2 text-[12px] font-bold text-[#6E6E73]">
                      <input
                        type="checkbox"
                        checked={strictScriptMode}
                        onChange={(e) => setStrictScriptMode(e.target.checked)}
                        className="h-3.5 w-3.5 accent-[#1D1D1F]"
                      />
                      严格按原文
                    </label>
                  )}

                  {creationType === 'free_creation' && (
                    <>
                      <div className="relative">
                        <ToolbarButton onClick={() => toggleHintPanel('free_model')}>
                          <i className={ri('ri-box-3-line', 'text-[15px]')} aria-hidden />
                          {freeModel}
                        </ToolbarButton>
                        {hintPanel === 'free_model' ? (
                          <FreeDropdown title="模型" widthClass="w-[236px]">
                            {['Seedance 2.0', 'Seedance 2.0 Fast'].map((p) => (
                              <VerticalOption
                                key={p}
                                active={freeModel === p}
                                icon="ri-box-3-line"
                                onClick={() => {
                                  setFreeModel(p);
                                  setHintPanel(null);
                                }}
                              >
                                {p}
                              </VerticalOption>
                            ))}
                          </FreeDropdown>
                        ) : null}
                      </div>
                      <div className="relative">
                        <ToolbarButton onClick={() => toggleHintPanel('free_ratio')}>
                          <i className={ri('ri-aspect-ratio-line', 'text-[15px]')} aria-hidden />
                          {freeRatio}
                        </ToolbarButton>
                        {hintPanel === 'free_ratio' ? (
                          <FreeDropdown title="比例" widthClass="w-[176px]">
                            {['智能比例', '9:16', '16:9', '1:1', '3:4'].map((p) => (
                              <VerticalOption
                                key={p}
                                active={freeRatio === p}
                                icon="ri-aspect-ratio-line"
                                onClick={() => {
                                  setFreeRatio(p);
                                  setHintPanel(null);
                                }}
                              >
                                {p}
                              </VerticalOption>
                            ))}
                          </FreeDropdown>
                        ) : null}
                      </div>
                      <div className="relative">
                        <ToolbarButton onClick={() => toggleHintPanel('free_resolution')}>
                          <i className={ri('ri-hd-line', 'text-[15px]')} aria-hidden />
                          {freeResolution}
                        </ToolbarButton>
                        {hintPanel === 'free_resolution' ? (
                          <FreeDropdown title="分辨率" widthClass="w-[160px]">
                            {freeResolutionOptions.map((p) => {
                              const disabled = freeModel === 'Seedance 2.0 Fast' && p === '1080p';
                              return (
                                <VerticalOption
                                  key={p}
                                  active={freeResolution === p}
                                  disabled={disabled}
                                  icon="ri-hd-line"
                                  onClick={() => {
                                    setFreeResolution(p);
                                    setHintPanel(null);
                                  }}
                                >
                                  {p}
                                </VerticalOption>
                              );
                            })}
                          </FreeDropdown>
                        ) : null}
                      </div>
                      <div className="relative">
                        <ToolbarButton onClick={() => toggleHintPanel('free_duration')}>
                          <i className={ri('ri-time-line', 'text-[15px]')} aria-hidden />
                          {freeDuration}
                        </ToolbarButton>
                        {hintPanel === 'free_duration' ? (
                          <FreeDropdown title="时长" widthClass="w-[148px]">
                            {['4s', '5s', '8s', '11s', '15s'].map((p) => (
                              <VerticalOption
                                key={p}
                                active={freeDuration === p}
                                icon="ri-time-line"
                                onClick={() => {
                                  setFreeDuration(p);
                                  setHintPanel(null);
                                }}
                              >
                                {p}
                              </VerticalOption>
                            ))}
                          </FreeDropdown>
                        ) : null}
                      </div>
                      <ToolbarButton active={freeAudio} onClick={() => setFreeAudio((v) => !v)}>
                        <i className={ri(freeAudio ? 'ri-volume-up-line' : 'ri-volume-mute-line', 'text-[15px]')} aria-hidden />
                        {freeAudio ? '输出声音' : '无声'}
                      </ToolbarButton>
                      <ToolbarButton onClick={() => setAvatarPickerOpen(true)}>
                        <i className={ri('ri-user-search-line', 'text-[15px]')} aria-hidden />
                        人像库{freeVirtualAvatars.length ? ` ${freeVirtualAvatars.length}` : ''}
                      </ToolbarButton>
                      <ToolbarButton onClick={() => {
                        if (freeReferenceCount) setFreeMentionOpen((v) => !v);
                        else freeFileRef.current?.click();
                      }}>
                        <i className={ri('ri-at-line', 'text-[15px]')} aria-hidden />
                        引用{freeReferenceCount ? ` ${freeReferenceCount}` : ''}
                      </ToolbarButton>
                    </>
                  )}

                  <span className="ml-auto text-[12px] text-[#C7C7CC]">
                    {creationType === 'script_import' ? scriptText.length : creationType === 'free_creation' ? freePrompt.length : intent.intent_text.length} 字
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleNext()}
                    disabled={!canPrimaryAction}
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-[#1D1D1F] text-white disabled:bg-[#D1D5DB]"
                    aria-label={submitLabel}
                  >
                    <i className={ri(submitting ? 'ri-loader-4-line' : 'ri-arrow-up-line', `${submitting ? 'animate-spin ' : ''}text-[18px]`)} aria-hidden />
                  </button>
                </div>
              </div>

              {hintPanel && !hintPanel.startsWith('free_') ? (
                <div className="absolute bottom-[74px] left-5 z-10 w-full max-w-[520px] rounded-xl border border-[#E5E5EA] bg-white p-4 shadow-[0_18px_42px_rgba(15,23,42,0.16)]">
                  {hintPanel === 'platform' && (
                    <>
                      <p className="mb-3 text-[12px] font-black text-[#8E8E93]">参考平台</p>
                      <div className="flex flex-wrap gap-2">
                        {platformOptions.map((p) => (
                          <ToggleOption
                            key={p}
                            active={intent.platform_hints.includes(p)}
                            onClick={() =>
                              setIntent((prev) => ({
                                ...prev,
                                platform_hints: prev.platform_hints.includes(p)
                                  ? prev.platform_hints.filter((x) => x !== p)
                                  : [...prev.platform_hints, p],
                              }))
                            }
                          >
                            {p}
                          </ToggleOption>
                        ))}
                      </div>
                    </>
                  )}
                  {hintPanel === 'ratio' && (
                    <>
                      <p className="mb-3 text-[12px] font-black text-[#8E8E93]">画面比例</p>
                      <div className="flex flex-wrap gap-2">
                        {aspectRatioOptions.map((p) => (
                          <ToggleOption key={p} active={intent.aspect_ratio_hint === p} onClick={() => setIntent((prev) => ({ ...prev, aspect_ratio_hint: prev.aspect_ratio_hint === p ? '' : p }))}>
                            {p}
                          </ToggleOption>
                        ))}
                      </div>
                    </>
                  )}
                  {hintPanel === 'duration' && (
                    <>
                      <p className="mb-3 text-[12px] font-black text-[#8E8E93]">大概时长</p>
                      <div className="flex flex-wrap gap-2">
                        {durationOptions.map((p) => (
                          <ToggleOption key={p} active={intent.duration_hint === p} onClick={() => setIntent((prev) => ({ ...prev, duration_hint: prev.duration_hint === p ? '' : p }))}>
                            {p}
                          </ToggleOption>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              ) : null}
            </section>

            <input
              ref={scriptFileRef}
              type="file"
              accept=".pmt,.txt,.md,.json"
              className="hidden"
              onChange={(e) => void handleScriptFile(e.target.files?.[0] ?? null)}
            />
            <input
              ref={videoFileRef}
              type="file"
              accept="video/mp4,video/quicktime,video/webm,video/mpeg,video/avi,video/x-flv,video/wmv,video/3gpp"
              className="hidden"
              onChange={(e) => void handleVideoFile(e.target.files?.[0] ?? null)}
            />
            <input
              ref={freeFileRef}
              type="file"
              multiple
              accept="image/*,video/*,audio/*"
              className="hidden"
              onChange={(e) => handleFreeFiles(e.target.files)}
            />

            <p className="mb-4 text-center text-[11.5px] text-[#C7C7CC]">
              {showStandardHints ? `可选提示信息：${hintSummary(intent)}，只作为 AI 理解方向的参考。` : creationType === 'video_analysis' ? '上传后进入独立的视频解构链路。' : '自由创作会进入独立视频生成页面，不会跳转到描述想法链路。'}
            </p>

            {!user && creationType !== 'video_analysis' ? (
              <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12.5px] text-amber-900">
                未检测到登录用户，无法调用创建项目接口。请先前往登录页完成登录。
              </p>
            ) : null}
            {scriptFileName && creationType === 'script_import' ? (
              <p className="mb-3 rounded-xl border border-[#E5E5EA] bg-white px-4 py-3 text-[12.5px] text-[#6E6E73]">
                已载入：{scriptFileName}
              </p>
            ) : null}
            {freeFiles.length && creationType === 'free_creation' ? (
              <div className="mb-3 rounded-xl border border-[#E5E5EA] bg-white px-4 py-3 text-[12.5px] text-[#6E6E73]">
                已选择 {freeFiles.length} 个参考素材：
                <span className="ml-1 text-[#1D1D1F]">
                  {freeFiles.map((file) => file.name).join('、')}
                </span>
              </div>
            ) : null}
            {submitError ? (
              <p className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[12.5px] text-red-800">
                {submitError}
              </p>
            ) : null}

            <div className="hidden items-center justify-between gap-3 md:flex">
              <button
                type="button"
                onClick={() => void saveDraft()}
                disabled={!canSaveDraft}
                className="flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-xl border border-[#E5E5EA] bg-white px-5 py-2.5 text-[13px] font-medium text-[#6E6E73] transition disabled:cursor-not-allowed disabled:text-[#AEAEB2]"
              >
                <i className={ri('ri-save-line', 'text-[13px]')} aria-hidden />
                保存草稿
              </button>
              <button
                type="button"
                onClick={() => void handleNext()}
                disabled={!canPrimaryAction}
                className="flex items-center gap-2 whitespace-nowrap rounded-xl px-7 py-2.5 text-[13.5px] font-semibold transition disabled:cursor-not-allowed"
                style={{
                  background: canPrimaryAction ? '#1D1D1F' : '#F0F0F0',
                  color: canPrimaryAction ? '#ffffff' : '#AEAEB2',
                }}
              >
                {submitting ? (
                  <>
                    <i className={ri('ri-loader-4-line', 'animate-spin text-[13px]')} aria-hidden />
                    {creationType === 'script_import' ? '解析剧本中…' : '创建项目中…'}
                  </>
                ) : (
                  <>
                    {submitLabel}
                    <i className={ri('ri-arrow-right-line', 'text-[13px]')} aria-hidden />
                  </>
                )}
              </button>
            </div>

            <MobileBottomActionBar>
              <button
                type="button"
                onClick={() => void saveDraft()}
                disabled={!canSaveDraft}
                className="flex h-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-[#E5E5EA] bg-white px-4 text-[13px] font-medium text-[#6E6E73] disabled:cursor-not-allowed disabled:text-[#AEAEB2]"
                aria-label="保存草稿"
              >
                <i className={ri('ri-save-line', 'text-[15px]')} aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => void handleNext()}
                disabled={!canPrimaryAction}
                className="flex h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-[13.5px] font-semibold disabled:cursor-not-allowed"
                style={{
                  background: canPrimaryAction ? '#1D1D1F' : '#F0F0F0',
                  color: canPrimaryAction ? '#ffffff' : '#AEAEB2',
                }}
              >
                {submitting ? (
                  <>
                    <i className={ri('ri-loader-4-line', 'animate-spin text-[13px]')} aria-hidden />
                    {creationType === 'script_import' ? '解析中…' : '创建中…'}
                  </>
                ) : (
                  <>
                    {creationType === 'intent' ? '下一步' : submitLabel}
                    <i className={ri('ri-arrow-right-line', 'text-[13px]')} aria-hidden />
                  </>
                )}
              </button>
            </MobileBottomActionBar>
          </S0PromptShell>
        </main>
      </div>
      <VirtualAvatarPicker
        open={avatarPickerOpen}
        onClose={() => setAvatarPickerOpen(false)}
        onSelect={selectFreeVirtualAvatar}
        selectedAssetUris={freeVirtualAvatars.map((avatar) => avatar.assetUri)}
      />
    </div>
  );
}
