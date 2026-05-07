import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUser } from '../../services/api';
import { createFlowSidebarSteps, defaultProjectDraft } from './data/mockShortDrama';
import { ProjectCreateForm } from './components/ProjectCreateForm';
import { SDWorkflowNav } from './components/SDWorkflowNav';
import { ShortDramaApiError, createShortDramaProject } from '@/services/shortDramaApi';
import type { NarrativeStyle, ShortDramaProjectDraft } from '@/types/shortDrama';
import { normalizeTargetMarket } from './utils/projectLocales';
import { useShortDramaProject } from './hooks/useShortDramaProject';
import { ri, sdColors, sdFontHeading } from './utils/shortDramaHelpers';
import { withProjectQuery } from './utils/shortDramaRoutes';

export function ShortDramaCreateProjectPage() {
  const navigate = useNavigate();
  const { setSession } = useShortDramaProject();
  const [draft, setDraft] = useState<ShortDramaProjectDraft>(defaultProjectDraft);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const setNarrativeStyle = (v: NarrativeStyle) => {
    setDraft((prev) => ({ ...prev, narrativeStyle: v }));
  };

  const user = getUser();
  const canSubmit = Boolean(draft.projectName.trim() && user && !submitting);

  const handleNext = async () => {
    console.info('[S0_CREATE_CLICK]', { has_user: Boolean(user), project_name_len: draft.projectName.trim().length });
    if (!user) {
      setSubmitError('请先登录后再创建项目。');
      return;
    }
    const requestBody = {
      user_id: user.id,
      project_name: draft.projectName.trim(),
      duration: draft.duration,
      format: draft.format,
      style: draft.narrativeStyle || 'light_conflict',
      visual_style: draft.visualStyle,
      aspect_ratio: draft.aspectRatio,
      target_market: normalizeTargetMarket(draft.targetMarket),
      marketing_goal: draft.marketingGoal || 'brand_seeding',
      target_audience: draft.targetAudience || '',
      brand_tone: draft.brandTone || 'natural',
      creative_intent: draft.creativeIntent || '',
      creative_brief: draft.creativeBrief || '',
    };
    console.info('[S0_CREATE_REQUEST]', {
      user_id: requestBody.user_id,
      has_project_name: Boolean(requestBody.project_name),
      duration: requestBody.duration,
      format: requestBody.format,
      visual_style: requestBody.visual_style,
      aspect_ratio: requestBody.aspect_ratio,
      target_market: requestBody.target_market,
      marketing_goal: requestBody.marketing_goal,
      brand_tone: requestBody.brand_tone,
    });
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await createShortDramaProject(requestBody);
      const p = res.project;
      console.info('[S0_CREATE_SUCCESS]', { project_id: p.id, project_name: p.project_name });
      setSession(p.id, p.project_name);
      const nextPath = withProjectQuery('/short-drama/product-input', p.id);
      console.info('[S0_CREATE_NAVIGATE]', { project_id: p.id, to: nextPath });
      navigate(nextPath);
    } catch (e) {
      const msg = e instanceof ShortDramaApiError ? e.message : e instanceof Error ? e.message : '创建失败';
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "'Inter', sans-serif" }}>
      <SDWorkflowNav allowSaveAndLeave={false} />
      <div className="flex min-h-screen pt-14">
        <aside
          className="hidden w-72 shrink-0 flex-col border-r border-[#EAEAEA] bg-[#F7F8FA] p-8 pt-10 lg:flex"
        >
          <div className="mb-8">
            <div
              className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#E5E5EA] bg-[#F5F5F7] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-[#6E6E73]"
            >
              <i className={ri('ri-add-circle-line', 'text-[12px]')} aria-hidden />
              新建项目
            </div>
            <h2 className="mb-3 text-xl font-black" style={{ ...sdFontHeading, color: sdColors.ink }}>
              创建 VibeClip 项目
            </h2>
            <p className="text-[13px] leading-relaxed text-[#8E8E93]">
              设置基础参数，系统将根据这些设定规划剧情节奏与视觉风格。
            </p>
          </div>
          <div className="space-y-1">
            {createFlowSidebarSteps.map((s) => (
              <div
                key={s.title}
                className="flex items-start gap-3 rounded-xl p-3 transition-colors"
                style={{
                  background: s.step === 0 ? '#ffffff' : 'transparent',
                  border: s.step === 0 ? '1px solid #EAEAEA' : '1px solid transparent',
                }}
              >
                <div
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                  style={{ background: s.step === 0 ? sdColors.ink : '#EAEAEA' }}
                >
                  <i
                    className={ri(s.icon, 'text-[13px]')}
                    style={{ color: s.step === 0 ? '#ffffff' : '#8E8E93' }}
                    aria-hidden
                  />
                </div>
                <div>
                  <p
                    className="text-[12.5px] font-semibold"
                    style={{ color: s.step === 0 ? sdColors.ink : '#8E8E93' }}
                  >
                    {s.title}
                  </p>
                  <p className="text-[11px] text-[#AEAEB2]">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </aside>

        <main className="max-w-[680px] flex-1 overflow-y-auto p-6 lg:p-12">
          <div className="mb-8">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#8E8E93]">新建项目</span>
            <h1 className="mt-1 text-2xl font-black" style={{ ...sdFontHeading, color: sdColors.ink }}>
              创建 VibeClip 项目
            </h1>
          </div>

          <ProjectCreateForm
            projectName={draft.projectName}
            setProjectName={(v) => setDraft((p) => ({ ...p, projectName: v }))}
            duration={draft.duration}
            setDuration={(v) => setDraft((p) => ({ ...p, duration: v }))}
            format={draft.format}
            setFormat={(v) => setDraft((p) => ({ ...p, format: v }))}
            narrativeStyle={draft.narrativeStyle}
            setNarrativeStyle={setNarrativeStyle}
            visualStyle={draft.visualStyle}
            setVisualStyle={(v) => setDraft((p) => ({ ...p, visualStyle: v }))}
            aspectRatio={draft.aspectRatio}
            setAspectRatio={(v) => setDraft((p) => ({ ...p, aspectRatio: v }))}
            targetMarket={draft.targetMarket}
            setTargetMarket={(v) => setDraft((p) => ({ ...p, targetMarket: v }))}
            marketingGoal={draft.marketingGoal}
            setMarketingGoal={(v) => setDraft((p) => ({ ...p, marketingGoal: v }))}
            targetAudience={draft.targetAudience}
            setTargetAudience={(v) => setDraft((p) => ({ ...p, targetAudience: v }))}
            brandTone={draft.brandTone}
            setBrandTone={(v) => setDraft((p) => ({ ...p, brandTone: v }))}
            creativeIntent={draft.creativeIntent}
            setCreativeIntent={(v) => setDraft((p) => ({ ...p, creativeIntent: v }))}
            creativeBrief={draft.creativeBrief}
            setCreativeBrief={(v) => setDraft((p) => ({ ...p, creativeBrief: v }))}
          />

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

          <div className="mt-10 flex items-center justify-between border-t border-[#EAEAEA] pt-8">
            <button
              type="button"
              onClick={() => navigate('/short-drama')}
              className="flex items-center gap-2 whitespace-nowrap rounded-xl border border-[#EAEAEA] bg-[#F7F8FA] px-5 py-3 text-[13.5px] text-[#444444] transition-colors hover:bg-[#EAEAEA]"
            >
              <i className={ri('ri-arrow-left-line', 'text-[13px]')} aria-hidden />
              返回
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
                  下一步：输入产品信息
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
