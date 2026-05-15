import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ri } from '../utils/shortDramaHelpers';
import { withProjectQuery } from '../utils/shortDramaRoutes';
import { VibeClipLogo } from './VibeClipLogo';

const STEPS = [
  { label: '创作意图', path: '/short-drama/create', step: 0 },
  { label: '商品理解', path: '/short-drama/product-input', step: 1 },
  { label: '剧本生成', path: '/short-drama/story-blueprint', step: 2 },
  { label: '资产管理', path: '/short-drama/assets', step: 3 },
  { label: '视频生成', path: '/short-drama/step4', step: 4 },
] as const;

export type SDWorkflowNavProps = {
  /** Framer：无 currentStep 时不渲染中部步骤条（如创建项目页） */
  currentStep?: number;
  projectName?: string;
  /** 步骤间跳转时附带 ?projectId= */
  projectId?: number | null;
  isDirty?: boolean;
  onSaveDraft?: (intent: 'save_draft' | 'before_exit') => Promise<boolean>;
  /** S0 创建页可关闭保存/离开动作，防止链路串线 */
  allowSaveAndLeave?: boolean;
};

/**
 * Framer `SDSharedNav.tsx` 映射：布局 / 步骤展示 / 项目名称 / 右侧按钮位置一致。
 */
export function SDWorkflowNav({
  currentStep,
  projectName,
  projectId,
  isDirty = false,
  onSaveDraft,
  allowSaveAndLeave = true,
}: SDWorkflowNavProps) {
  const navigate = useNavigate();
  const [dialog, setDialog] = useState<null | 'leave' | 'save'>(null);

  const handleLeaveHomeClick = () => {
    if (!isDirty) {
      navigate('/');
      return;
    }
    console.info('[FRONT_LEAVE_CONFIRM_SHOWN]', { project_id: projectId ?? null, step: currentStep ?? null });
    setDialog('leave');
  };

  const handleSaveProjectClick = () => {
    console.info('[FRONT_SAVE_PROJECT_CONFIRM_SHOWN]', { project_id: projectId ?? null, step: currentStep ?? null });
    setDialog('save');
  };

  const confirmSaveDraft = async (intent: 'save_draft' | 'before_exit') => {
    if (!onSaveDraft) {
      if (intent === 'save_draft') navigate('/short-drama/projects');
      else navigate('/');
      return;
    }
    const ok = await onSaveDraft(intent);
    if (!ok) {
      window.alert('保存失败，请稍后重试。');
      return;
    }
    if (intent === 'before_exit') {
      console.info('[S0_SAVE_AND_LEAVE_SUCCESS]', { project_id: projectId ?? null, step: currentStep ?? null });
      console.info('[FRONT_SAVE_AND_EXIT_HOME]', { project_id: projectId ?? null, step: currentStep ?? null });
      navigate('/');
      return;
    }
    console.info('[FRONT_SAVE_PROJECT_AND_BACK_SUCCESS]', { project_id: projectId ?? null, step: currentStep ?? null });
    navigate('/short-drama/projects');
  };

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50"
      style={{
        background: '#ffffff',
        borderBottom: '1px solid #EAEAEA',
        boxShadow: '0 1px 6px rgba(0,0,0,0.05)',
      }}
    >
      <div className="mx-auto flex h-14 items-center justify-between px-6 lg:px-10" style={{ maxWidth: '1440px' }}>
        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/short-drama')}
            className="group flex cursor-pointer items-center gap-2"
          >
            <span className="transition-transform duration-200 group-hover:scale-105">
              <VibeClipLogo compact />
            </span>
            <span className="whitespace-nowrap text-[14px] font-bold text-[#1D1D1F]">
              VibeClip
            </span>
          </button>

          {projectName ? (
            <>
              <span className="text-[14px] text-[#AEAEB2]">/</span>
              <span className="max-w-[160px] truncate whitespace-nowrap text-[13px] text-[#8E8E93]">
                {projectName}
              </span>
            </>
          ) : null}
        </div>

        {currentStep !== undefined ? (
          <div className="hidden items-center gap-1 md:flex">
            {STEPS.map((s, idx) => {
              const isActive = s.step === currentStep;
              const isDone = s.step < currentStep;
              return (
                <div key={s.step} className="flex items-center">
                  <button
                    type="button"
                    onClick={() => isDone && navigate(withProjectQuery(s.path, projectId))}
                    className="flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-all duration-200"
                    style={{
                      cursor: isDone ? 'pointer' : isActive ? 'default' : 'not-allowed',
                      background: isActive ? '#1D1D1F' : isDone ? 'rgba(5,150,105,0.08)' : 'transparent',
                      color: isActive ? '#ffffff' : isDone ? '#047857' : '#AEAEB2',
                    }}
                    onMouseEnter={(e) => {
                      if (isDone) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(5,150,105,0.14)';
                    }}
                    onMouseLeave={(e) => {
                      if (isDone) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(5,150,105,0.08)';
                    }}
                  >
                    <span
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                      style={{
                        background: isActive ? 'rgba(255,255,255,0.2)' : isDone ? '#047857' : '#F5F5F7',
                        color: isActive ? '#fff' : isDone ? '#fff' : '#AEAEB2',
                      }}
                    >
                      {isDone ? <i className={ri('ri-check-line', 'text-[10px]')} aria-hidden /> : s.step}
                    </span>
                    {s.label}
                  </button>
                  {idx < STEPS.length - 1 ? (
                    <i className={ri('ri-arrow-right-s-line', 'mx-0.5 text-[14px] text-[#D1D1D6]')} aria-hidden />
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={handleLeaveHomeClick}
            className="flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-[12.5px] transition-all duration-200"
            style={{ color: '#8E8E93', background: 'transparent' }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = '#1D1D1F';
              (e.currentTarget as HTMLButtonElement).style.background = '#F7F8FA';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = '#8E8E93';
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
            }}
          >
            <i className={ri('ri-home-4-line', 'text-[13px]')} aria-hidden />
            <span className="hidden lg:inline">返回官网</span>
          </button>
          <button
            type="button"
            onClick={handleSaveProjectClick}
            disabled={!allowSaveAndLeave}
            className="flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#EAEAEA] bg-[#F7F8FA] px-4 py-1.5 text-[12.5px] font-medium text-[#444444] transition-all duration-200"
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = '#EAEAEA';
              (e.currentTarget as HTMLButtonElement).style.color = '#1D1D1F';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = '#F7F8FA';
              (e.currentTarget as HTMLButtonElement).style.color = '#444444';
            }}
          >
            <i className={ri('ri-save-line', 'text-[12px]')} aria-hidden />
            保存项目
          </button>
        </div>
      </div>
      {dialog ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/35 px-4">
          <div className="w-full max-w-md rounded-2xl border border-[#EAEAEA] bg-white p-5 shadow-xl">
            {dialog === 'leave' ? (
              <>
                <h3 className="text-[17px] font-bold text-[#1D1D1F]">离开当前项目？</h3>
                <p className="mt-2 text-[13px] text-[#6E6E73]">当前项目有未保存修改，离开后可能丢失本次修改。</p>
                <div className="mt-5 flex items-center justify-end gap-2">
                  <button type="button" onClick={() => setDialog(null)} className="rounded-lg border border-[#EAEAEA] px-3.5 py-2 text-[12.5px]">取消</button>
                  <button
                    type="button"
                    onClick={() => {
                      console.info('[FRONT_EXIT_HOME_WITHOUT_SAVE]', { project_id: projectId ?? null, step: currentStep ?? null });
                      setDialog(null);
                      navigate('/');
                    }}
                    className="rounded-lg border border-[#EAEAEA] bg-[#F7F8FA] px-3.5 py-2 text-[12.5px]"
                  >
                    放弃修改并离开
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      console.info('[S0_SAVE_AND_LEAVE_CLICK]', { project_id: projectId ?? null, step: currentStep ?? null });
                      setDialog(null);
                      void confirmSaveDraft('before_exit');
                    }}
                    className="rounded-lg bg-[#1D1D1F] px-3.5 py-2 text-[12.5px] font-semibold text-white"
                  >
                    保存并离开
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-[17px] font-bold text-[#1D1D1F]">保存当前项目？</h3>
                <p className="mt-2 text-[13px] text-[#6E6E73]">保存后将回到项目管理页，你可以之后继续编辑。</p>
                <div className="mt-5 flex items-center justify-end gap-2">
                  <button type="button" onClick={() => setDialog(null)} className="rounded-lg border border-[#EAEAEA] px-3.5 py-2 text-[12.5px]">取消</button>
                  <button
                    type="button"
                    onClick={() => {
                      setDialog(null);
                      void confirmSaveDraft('save_draft');
                    }}
                    className="rounded-lg bg-[#1D1D1F] px-3.5 py-2 text-[12.5px] font-semibold text-white"
                  >
                    保存并返回
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
}
