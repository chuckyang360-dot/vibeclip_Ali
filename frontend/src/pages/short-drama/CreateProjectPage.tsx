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
import { ri } from './utils/shortDramaHelpers';
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
  const [optionalOpen, setOptionalOpen] = useState(false);
  const [intentFocused, setIntentFocused] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const user = getUser();
  const canSubmit = Boolean(intent.intent_text.trim() && user && !submitting);
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
        <main className="mx-auto max-w-2xl px-5 py-10">
          <header className="mb-6 text-center">
            <span
              className="mb-3 inline-block rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-widest"
              style={{ color: '#8E8E93', background: '#EAEAEA' }}
            >
              S0 · 创作意图
            </span>
            <h1
              className="mb-0 text-[28px] font-black"
              style={{ fontFamily: "'Syne', sans-serif", color: '#1D1D1F', lineHeight: 1.25 }}
            >
              先告诉 AI，<br />你想做什么视频。
            </h1>
          </header>

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
              <span className="text-[12px]" style={{ color: '#AEAEB2' }}>
                一句话也可以，越具体越好。
              </span>
            </div>
            <textarea
              value={intent.intent_text}
              onChange={(e) => setIntent((p) => ({ ...p, intent_text: e.target.value }))}
              onFocus={() => setIntentFocused(true)}
              onBlur={() => setIntentFocused(false)}
              rows={4}
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
                  <span className="text-[11px]" style={{ color: '#C7C7CC' }}>
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

                <div className="grid grid-cols-2 gap-5">
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

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => void saveDraft()}
              disabled={!canSubmit}
              className="flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-xl px-5 py-2.5 text-[13px] font-medium transition-all duration-200 disabled:cursor-not-allowed"
              style={{ background: '#ffffff', color: canSubmit ? '#6E6E73' : '#AEAEB2', border: '1px solid #E5E5EA' }}
              onMouseEnter={(e) => {
                if (canSubmit) e.currentTarget.style.background = '#F5F5F7';
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
