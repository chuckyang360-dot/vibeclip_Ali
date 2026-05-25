import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getUser } from '../../services/api';
import { SDWorkflowNav } from './components/SDWorkflowNav';
import {
  ShortDramaApiError,
  createShortDramaProject,
  getShortDramaProject,
  prepareShortDramaScriptImport,
  saveShortDramaCreativeIntent,
} from '@/services/shortDramaApi';
import type { CreativeIntentInputDto } from '@/types/shortDramaApi';
import { useShortDramaProject } from './hooks/useShortDramaProject';
import { MobileBottomActionBar } from './components/MobileBottomActionBar';
import { ri } from './utils/shortDramaHelpers';
import { withProjectQuery } from './utils/shortDramaRoutes';

const platformOptions = ['TikTok', '抖音', '小红书', 'Amazon', 'Instagram', 'YouTube'];
const durationOptions = ['15s', '30s', '45s', '60s'];
const aspectRatioOptions = ['9:16', '16:9'];
const mobileIdeaTemplates = [
  '给这个商品做一条 TikTok 种草短剧，突出真实使用场景和购买理由。',
  '做一条 30 秒竖屏广告，开头要有强 Hook，结尾引导下单。',
  '把商品卖点包装成生活痛点解决方案，不要太像硬广。',
];

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

function projectNameFromIntent(text: string): string {
  const cleaned = text.trim().replace(/\s+/g, ' ');
  return cleaned ? cleaned.slice(0, 28) : '未命名 VibeClip 项目';
}

function Chip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="cursor-pointer whitespace-nowrap rounded-full border px-3 py-1 text-[11.5px] font-medium transition-all duration-150"
      style={{
        borderColor: active ? '#1D1D1F' : '#E5E5EA',
        background: active ? '#1D1D1F' : '#F5F5F7',
        color: active ? '#ffffff' : '#6E6E73',
      }}
    >
      {children}
    </button>
  );
}

export function ShortDramaCreateProjectPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setSession } = useShortDramaProject();
  const routedProjectId = useMemo(() => parseProjectId(searchParams), [searchParams]);
  const [projectId, setProjectId] = useState<number | null>(routedProjectId);
  const [intent, setIntent] = useState<CreativeIntentInputDto>(emptyIntent);
  const [inputMode, setInputMode] = useState<'intent' | 'script_import'>('intent');
  const [scriptText, setScriptText] = useState('');
  const [scriptFileName, setScriptFileName] = useState('');
  const [strictScriptMode, setStrictScriptMode] = useState(false);
  const [optionalOpen, setOptionalOpen] = useState(false);
  const [intentFocused, setIntentFocused] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const user = getUser();
  const canSubmit = Boolean(
    user &&
    !submitting &&
    (inputMode === 'script_import' ? scriptText.trim().length >= 4 : intent.intent_text.trim()),
  );
  const canSaveDraft = inputMode === 'intent' && canSubmit;
  const hasHints = Boolean(
    intent.platform_hints.length > 0 ||
    intent.duration_hint ||
    intent.aspect_ratio_hint,
  );

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
          setInputMode('script_import');
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

  const ensureProject = async (): Promise<number> => {
    if (projectId) return projectId;
    if (!user) throw new Error('请先登录后再创建项目。');
    const seedText = inputMode === 'script_import' ? scriptText.trim().slice(0, 280) : intent.intent_text.trim();
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

  const handleNext = async () => {
    if (!user) {
      setSubmitError('请先登录后再创建项目。');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      if (inputMode === 'script_import') {
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
        const nextPath = withProjectQuery('/short-drama/product-input', id);
        navigate(nextPath);
      }
    } catch (e) {
      const msg = e instanceof ShortDramaApiError ? e.message : e instanceof Error ? e.message : '创建失败';
      setSubmitError(msg);
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

  return (
    <div className="min-h-screen bg-[#F7F8FA]" style={{ fontFamily: "'Inter', sans-serif" }}>
      <SDWorkflowNav
        currentStep={0}
        projectId={projectId}
        allowSaveAndLeave={false}
        workflowMode={inputMode === 'script_import' ? 'script_import' : 'standard'}
      />
      <div className="pt-[112px] md:pt-14">
        <main className="mx-auto max-w-2xl px-4 pb-28 pt-7 md:px-5 md:py-10">
          <header className="mb-5 text-left md:mb-6 md:text-center">
            <span
              className="mb-3 inline-block rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-widest"
              style={{ color: '#8E8E93', background: '#EAEAEA' }}
            >
              S0 · 创作意图
            </span>
            <h1
              className="mb-0 text-[28px] font-black md:text-[28px]"
              style={{ fontFamily: "'Syne', sans-serif", color: '#1D1D1F', lineHeight: 1.25 }}
            >
              先说目标，<br className="md:hidden" />AI 再补全方案。
            </h1>
            <p className="mt-3 text-[13px] leading-relaxed text-[#8E8E93] md:hidden">
              一句话就能创建项目，平台、时长和比例可以稍后再调。
            </p>
          </header>

          <section className="mb-4 md:hidden">
            <p className="mb-2 text-[12px] font-semibold text-[#6E6E73]">快速套用</p>
            <div className="flex snap-x gap-2 overflow-x-auto pb-1">
              {mobileIdeaTemplates.map((text) => (
                <button
                  key={text}
                  type="button"
                  onClick={() => setIntent((prev) => ({ ...prev, intent_text: text }))}
                  className="min-w-[245px] snap-start rounded-2xl border border-[#EAEAEA] bg-white p-3 text-left text-[12.5px] leading-relaxed text-[#444444]"
                >
                  {text}
                </button>
              ))}
            </div>
          </section>

          <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl border border-[#E5E5EA] bg-white p-1">
            <button
              type="button"
              onClick={() => setInputMode('intent')}
              className="flex h-9 items-center justify-center gap-1.5 rounded-xl text-[12.5px] font-semibold transition-colors"
              style={{
                background: inputMode === 'intent' ? '#1D1D1F' : 'transparent',
                color: inputMode === 'intent' ? '#fff' : '#6E6E73',
              }}
            >
              <i className={ri('ri-quill-pen-line', 'text-[13px]')} aria-hidden />
              描述想法
            </button>
            <button
              type="button"
              onClick={() => setInputMode('script_import')}
              className="flex h-9 items-center justify-center gap-1.5 rounded-xl text-[12.5px] font-semibold transition-colors"
              style={{
                background: inputMode === 'script_import' ? '#1D1D1F' : 'transparent',
                color: inputMode === 'script_import' ? '#fff' : '#6E6E73',
              }}
            >
              <i className={ri('ri-file-upload-line', 'text-[13px]')} aria-hidden />
              导入剧本
            </button>
          </div>

          {inputMode === 'intent' ? (
          <section
            className="mb-3 overflow-hidden rounded-2xl transition-all duration-300"
            style={{
              background: '#ffffff',
              border: `1.5px solid ${intentFocused ? '#1D1D1F' : '#E5E5EA'}`,
            }}
          >
            <div className="flex flex-wrap items-center gap-2 px-5 pb-1 pt-4">
              <label className="text-[13px] font-bold" style={{ color: '#444444' }}>
                描述你的创作想法
              </label>
              <span className="hidden text-[12px] md:inline" style={{ color: '#AEAEB2' }}>
                一句话也可以，越具体越好。
              </span>
            </div>
            <textarea
              value={intent.intent_text}
              onChange={(e) => setIntent((p) => ({ ...p, intent_text: e.target.value }))}
              onFocus={() => setIntentFocused(true)}
              onBlur={() => setIntentFocused(false)}
              rows={6}
              placeholder="例如：我想给这个鼻毛器做一个适合 TikTok 的欧美风短剧，感觉真实一点，不要太像硬广，突出便携、安全、不尴尬。"
              className="w-full resize-none px-5 pb-4 pt-2 text-[14.5px] leading-relaxed outline-none"
              style={{ color: '#1D1D1F', background: 'transparent' }}
            />
            <div
              className="flex items-center justify-between px-5 py-2.5"
              style={{ borderTop: '1px solid #F0F0F0' }}
            >
              <span className="text-[11px]" style={{ color: '#C7C7CC' }}>
                {intent.intent_text.length} 字
              </span>
              {intent.intent_text.length > 0 ? (
                <span className="flex items-center gap-1 text-[11px]" style={{ color: '#047857' }}>
                  <i className={ri('ri-checkbox-circle-fill', 'text-[12px]')} aria-hidden />
                  已填写
                </span>
              ) : null}
            </div>
          </section>
          ) : (
            <section
              className="mb-3 overflow-hidden rounded-2xl transition-all duration-300"
              style={{
                background: '#ffffff',
                border: `1.5px solid ${intentFocused ? '#1D1D1F' : '#E5E5EA'}`,
              }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 px-5 pb-2 pt-4">
                <div className="flex min-w-0 items-center gap-2">
                  <label className="text-[13px] font-bold" style={{ color: '#444444' }}>
                    剧本导入
                  </label>
                  {scriptFileName ? (
                    <span className="truncate text-[11px]" style={{ color: '#8E8E93' }}>
                      {scriptFileName}
                    </span>
                  ) : null}
                </div>
                <label
                  className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#E5E5EA] bg-[#F7F8FA] px-3 py-1.5 text-[11.5px] font-semibold text-[#444444]"
                >
                  <i className={ri('ri-upload-2-line', 'text-[12px]')} aria-hidden />
                  上传 pmt
                  <input
                    type="file"
                    accept=".pmt,.txt,.md,.json"
                    className="hidden"
                    onChange={(e) => void handleScriptFile(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
              <textarea
                value={scriptText}
                onChange={(e) => setScriptText(e.target.value)}
                onFocus={() => setIntentFocused(true)}
                onBlur={() => setIntentFocused(false)}
                rows={9}
                placeholder="粘贴你的剧本、分镜、口播稿或 prompt 模板。AI 会先解析并补足可生成视频所需的片段结构，然后直接进入视频生成页。"
                className="w-full resize-none px-5 pb-4 pt-2 text-[14px] leading-relaxed outline-none"
                style={{ color: '#1D1D1F', background: 'transparent' }}
              />
              <div className="flex items-center justify-between gap-3 px-5 py-2.5" style={{ borderTop: '1px solid #F0F0F0' }}>
                <label className="flex cursor-pointer items-center gap-2 text-[11.5px]" style={{ color: '#6E6E73' }}>
                  <input
                    type="checkbox"
                    checked={strictScriptMode}
                    onChange={(e) => setStrictScriptMode(e.target.checked)}
                    className="h-3.5 w-3.5 accent-[#1D1D1F]"
                  />
                  尽量严格按原文
                </label>
                <span className="text-[11px]" style={{ color: '#C7C7CC' }}>
                  {scriptText.length} 字
                </span>
              </div>
            </section>
          )}

          <section
            className="mb-5 overflow-hidden rounded-2xl"
            style={{ background: '#ffffff', border: '1px solid #E5E5EA' }}
          >
            <button
              type="button"
              onClick={() => setOptionalOpen((v) => !v)}
              className="flex w-full cursor-pointer items-center justify-between px-5 py-3.5 transition-colors duration-150"
              style={{ background: 'transparent' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#FAFAFA';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <div className="flex items-center gap-2">
                <i className={ri('ri-magic-line', 'text-[12px]')} style={{ color: '#AEAEB2' }} aria-hidden />
                <span className="text-[12.5px] font-semibold" style={{ color: '#6E6E73' }}>
                  可选提示信息
                </span>
                {hasHints && !optionalOpen ? (
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    style={{ background: '#1D1D1F', color: '#fff' }}
                  >
                    已选 {[
                      intent.platform_hints.length > 0 ? `${intent.platform_hints.length} 平台` : '',
                      intent.duration_hint,
                      intent.aspect_ratio_hint,
                    ].filter(Boolean).join(' · ')}
                  </span>
                ) : null}
                {!hasHints ? (
                  <span className="hidden text-[11px] sm:inline" style={{ color: '#C7C7CC' }}>
                    · 只作为 AI 理解方向的参考，不会成为固定规则。
                  </span>
                ) : null}
              </div>
              <i
                className={ri(optionalOpen ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line', 'text-[15px]')}
                style={{ color: '#AEAEB2' }}
                aria-hidden
              />
            </button>

            {optionalOpen ? (
              <div className="space-y-5 px-5 pb-5 pt-2" style={{ borderTop: '1px solid #F0F0F0' }}>
                <div>
                  <p className="mb-2 text-[12px] font-semibold" style={{ color: '#6E6E73' }}>
                    参考平台
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {platformOptions.map((p) => (
                      <Chip
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
                      </Chip>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div>
                    <p className="mb-2 text-[12px] font-semibold" style={{ color: '#6E6E73' }}>
                      大概时长
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {durationOptions.map((p) => (
                        <Chip
                          key={p}
                          active={intent.duration_hint === p}
                          onClick={() => setIntent((prev) => ({ ...prev, duration_hint: prev.duration_hint === p ? '' : p }))}
                        >
                          {p}
                        </Chip>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-[12px] font-semibold" style={{ color: '#6E6E73' }}>
                      画面比例
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {aspectRatioOptions.map((p) => (
                        <Chip
                          key={p}
                          active={intent.aspect_ratio_hint === p}
                          onClick={() => setIntent((prev) => ({ ...prev, aspect_ratio_hint: prev.aspect_ratio_hint === p ? '' : p }))}
                        >
                          {p}
                        </Chip>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </section>

          <p className="mb-4 text-center text-[11.5px]" style={{ color: '#C7C7CC' }}>
            这些信息只是帮助 AI 理解你的创作意图，不会变成固定规则。
          </p>

          {!user ? (
            <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12.5px] text-amber-900">
              未检测到登录用户，无法调用创建项目接口。请先前往登录页完成登录。
            </p>
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
              className="flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-xl px-5 py-2.5 text-[13px] font-medium transition-all duration-200 disabled:cursor-not-allowed"
              style={{ background: '#ffffff', color: canSaveDraft ? '#6E6E73' : '#AEAEB2', border: '1px solid #E5E5EA' }}
              onMouseEnter={(e) => {
                if (canSaveDraft) e.currentTarget.style.background = '#F5F5F7';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#ffffff';
              }}
            >
              <i className={ri('ri-save-line', 'text-[13px]')} aria-hidden />
              保存草稿
            </button>
            <button
              type="button"
              onClick={() => void handleNext()}
              disabled={!canSubmit}
              className="flex items-center gap-2 whitespace-nowrap rounded-xl px-7 py-2.5 text-[13.5px] font-semibold transition-all duration-200 disabled:cursor-not-allowed"
              style={{
                background: canSubmit ? '#1D1D1F' : '#F0F0F0',
                color: canSubmit ? '#ffffff' : '#AEAEB2',
                cursor: canSubmit ? 'pointer' : 'not-allowed',
              }}
              onMouseEnter={(e) => {
                if (canSubmit) e.currentTarget.style.background = '#374151';
              }}
              onMouseLeave={(e) => {
                if (canSubmit) e.currentTarget.style.background = '#1D1D1F';
              }}
            >
              {submitting ? (
                <>
                  <i className={ri('ri-loader-4-line', 'animate-spin text-[13px]')} aria-hidden />
                  {inputMode === 'script_import' ? '解析剧本中…' : '创建项目中…'}
                </>
              ) : (
                <>
                  {inputMode === 'script_import' ? '解析剧本并生成视频' : '下一步：上传商品'}
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
              disabled={!canSubmit}
              className="flex h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-[13.5px] font-semibold disabled:cursor-not-allowed"
              style={{
                background: canSubmit ? '#1D1D1F' : '#F0F0F0',
                color: canSubmit ? '#ffffff' : '#AEAEB2',
              }}
            >
              {submitting ? (
                <>
                  <i className={ri('ri-loader-4-line', 'animate-spin text-[13px]')} aria-hidden />
                  {inputMode === 'script_import' ? '解析中…' : '创建中…'}
                </>
              ) : (
                <>
                  {inputMode === 'script_import' ? '解析并进入 S4' : '下一步'}
                  <i className={ri('ri-arrow-right-line', 'text-[13px]')} aria-hidden />
                </>
              )}
            </button>
          </MobileBottomActionBar>
        </main>
      </div>
    </div>
  );
}
