import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getUser } from '../../services/api';
import { SDWorkflowNav } from './components/SDWorkflowNav';
import {
  ShortDramaApiError,
  createShortDramaProject,
  getShortDramaProject,
  saveShortDramaCreativeIntent,
} from '@/services/shortDramaApi';
import type { CreativeIntentInputDto } from '@/types/shortDramaApi';
import { useShortDramaProject } from './hooks/useShortDramaProject';
import { ri, sdColors, sdFontHeading } from './utils/shortDramaHelpers';
import { withProjectQuery } from './utils/shortDramaRoutes';

const platformOptions = ['TikTok', '抖音', '小红书', 'Amazon', 'Instagram', 'YouTube'];
const durationOptions = ['15s', '30s', '45s', '60s'];
const aspectRatioOptions = ['9:16', '16:9'];

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
      className="rounded-full border px-4 py-2 text-[13px] font-medium transition-all"
      style={{
        borderColor: active ? '#1D1D1F' : '#E5E5EA',
        background: active ? '#1D1D1F' : '#F7F8FA',
        color: active ? '#ffffff' : '#444444',
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
  const [optionalOpen, setOptionalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const user = getUser();
  const canSubmit = Boolean(intent.intent_text.trim() && user && !submitting);

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
    const res = await createShortDramaProject({
      user_id: user.id,
      project_name: projectNameFromIntent(intent.intent_text),
      duration: intent.duration_hint || undefined,
      aspect_ratio: intent.aspect_ratio_hint || undefined,
      creative_intent: intent.intent_text.trim(),
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
      const id = await persistIntent();
      const nextPath = withProjectQuery('/short-drama/product-input', id);
      navigate(nextPath);
    } catch (e) {
      const msg = e instanceof ShortDramaApiError ? e.message : e instanceof Error ? e.message : '创建失败';
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const saveDraft = async () => {
    if (!canSubmit) return;
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
      <SDWorkflowNav currentStep={0} projectId={projectId} allowSaveAndLeave={false} />
      <div className="pt-14">
        <main className="mx-auto max-w-3xl px-5 py-12 lg:py-16">
          <header className="mb-8 text-center">
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#8E8E93]">S0 创作意图</span>
            <h1 className="mx-auto mt-3 max-w-xl text-4xl font-black leading-tight" style={{ ...sdFontHeading, color: sdColors.ink }}>
              先告诉 AI，<br />你想做什么视频。
            </h1>
          </header>

          <section className="rounded-[28px] border border-[#EAEAEA] bg-white p-6 shadow-[0_18px_60px_rgba(0,0,0,0.06)] sm:p-8">
            <div>
              <label className="mb-2 block text-[15px] font-bold text-[#1D1D1F]">描述你的创作想法</label>
              <p className="mb-4 text-[13px] text-[#8E8E93]">一句话也可以，越具体越好。</p>
              <textarea
                className="min-h-[180px] w-full resize-none rounded-3xl border border-[#E5E5EA] bg-[#FAFAFA] px-5 py-4 text-[15px] leading-relaxed text-[#1D1D1F] outline-none transition-colors placeholder:text-[#AEAEB2] focus:border-[#1D1D1F] focus:bg-white"
                value={intent.intent_text}
                onChange={(e) => setIntent((p) => ({ ...p, intent_text: e.target.value }))}
                placeholder="例如：我想给这个鼻毛器做一个适合 TikTok 的欧美风短剧，感觉真实一点，不要太像硬广，突出便携、安全、不尴尬。"
              />
            </div>

            <section className="mt-6 rounded-3xl border border-[#EAEAEA] bg-[#F7F8FA]">
              <button
                type="button"
                onClick={() => setOptionalOpen((v) => !v)}
                className="flex w-full items-center justify-between px-5 py-4 text-left"
              >
                <span>
                  <span className="block text-[15px] font-bold text-[#1D1D1F]">可选提示信息</span>
                  <span className="mt-1 block text-[12.5px] text-[#8E8E93]">只作为 AI 理解方向的参考，不会成为固定规则。</span>
                </span>
                <i className={ri(optionalOpen ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line', 'text-[18px] text-[#8E8E93]')} aria-hidden />
              </button>
              {optionalOpen ? (
                <div className="space-y-5 border-t border-[#EAEAEA] px-5 py-5">
                  <div>
                    <p className="mb-3 text-[13px] font-semibold text-[#444444]">参考平台</p>
                    <div className="flex flex-wrap gap-2">
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
                  <div>
                    <p className="mb-3 text-[13px] font-semibold text-[#444444]">大概时长</p>
                    <div className="flex flex-wrap gap-2">
                      {durationOptions.map((p) => (
                        <Chip key={p} active={intent.duration_hint === p} onClick={() => setIntent((prev) => ({ ...prev, duration_hint: prev.duration_hint === p ? '' : p }))}>
                          {p}
                        </Chip>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-3 text-[13px] font-semibold text-[#444444]">画面比例</p>
                    <div className="flex flex-wrap gap-2">
                      {aspectRatioOptions.map((p) => (
                        <Chip key={p} active={intent.aspect_ratio_hint === p} onClick={() => setIntent((prev) => ({ ...prev, aspect_ratio_hint: prev.aspect_ratio_hint === p ? '' : p }))}>
                          {p}
                        </Chip>
                      ))}
                    </div>
                  </div>
                  <p className="rounded-2xl bg-white px-4 py-3 text-[12.5px] leading-relaxed text-[#8E8E93]">
                    这些信息只是帮助 AI 理解你的创作意图，不会变成固定规则。
                  </p>
                </div>
              ) : null}
            </section>
          </section>

          {!user ? (
            <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
              未检测到登录用户，无法调用创建项目接口。请先前往登录页完成登录。
            </p>
          ) : null}
          {submitError ? (
            <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">
              {submitError}
            </p>
          ) : null}

          <div className="mt-8 flex items-center justify-between">
            <button
              type="button"
              onClick={() => void saveDraft()}
              disabled={!canSubmit}
              className="flex items-center gap-2 whitespace-nowrap rounded-xl border border-[#EAEAEA] bg-white px-5 py-3 text-[13.5px] text-[#444444] transition-colors hover:bg-[#F5F5F7] disabled:cursor-not-allowed disabled:text-[#AEAEB2]"
            >
              <i className={ri('ri-save-line', 'text-[13px]')} aria-hidden />
              保存草稿
            </button>
            <button
              type="button"
              onClick={() => void handleNext()}
              disabled={!canSubmit}
              className="flex items-center gap-2 whitespace-nowrap rounded-xl px-7 py-3 text-[14px] font-semibold transition-colors disabled:cursor-not-allowed"
              style={{
                background: canSubmit ? sdColors.ink : '#F5F5F7',
                color: canSubmit ? '#ffffff' : '#AEAEB2',
              }}
            >
              {submitting ? (
                <>
                  <i className={ri('ri-loader-4-line', 'animate-spin text-[13px]')} aria-hidden />
                  创建项目中…
                </>
              ) : (
                <>
                  下一步：上传商品
                  <i className={ri('ri-arrow-right-line', 'text-[13px]')} aria-hidden />
                </>
              )}
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}
