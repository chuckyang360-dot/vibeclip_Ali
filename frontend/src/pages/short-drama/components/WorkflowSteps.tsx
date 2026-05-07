import { Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import type { WorkflowStepItem } from '@/types/shortDrama';
import { ri, sdColors, sdFontHeading } from '../utils/shortDramaHelpers';

type Props = {
  steps: WorkflowStepItem[];
};

export function WorkflowSteps({ steps }: Props) {
  const navigate = useNavigate();

  return (
    <div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch lg:gap-3">
        {steps.map((step, idx) => (
          <Fragment key={step.id}>
            <div className="flex min-w-0 flex-1 flex-col">
              <div
                className="flex h-full flex-col rounded-2xl p-5 transition-all duration-300 hover:-translate-y-1"
                style={{ background: '#F7F8FA', border: '1px solid #EAEAEA' }}
              >
                <div className="mb-4 flex items-center gap-2">
                  <span
                    className="text-[11px] font-bold tracking-wider"
                    style={{ color: step.accentColor }}
                  >
                    {step.num}
                  </span>
                  <div
                    className="flex h-7 w-7 items-center justify-center rounded-lg"
                    style={{ background: `${step.accentColor}10` }}
                  >
                    <i className={ri(step.icon, 'text-[14px]')} style={{ color: step.accentColor }} aria-hidden />
                  </div>
                </div>
                <h3
                  className="mb-2 text-[14px] font-bold"
                  style={{ ...sdFontHeading, color: sdColors.ink }}
                >
                  {step.title}
                </h3>
                <p className="flex-1 text-[12px] leading-relaxed" style={{ color: '#8E8E93' }}>
                  {step.description}
                </p>
              </div>
            </div>
            {idx < steps.length - 1 ? (
              <div className="hidden shrink-0 items-center justify-center self-center lg:flex" aria-hidden>
                <i className={ri('ri-arrow-right-line', 'text-[16px]')} style={{ color: '#D1D1D6' }} />
              </div>
            ) : null}
          </Fragment>
        ))}
      </div>

      <div className="mt-12 text-center">
        <button
          type="button"
          onClick={() => navigate('/short-drama/create')}
          className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl px-8 py-3.5 text-[14px] font-semibold text-white transition-colors duration-200 hover:bg-[#374151]"
          style={{ background: sdColors.ink }}
        >
          <i className={ri('ri-add-circle-line', 'text-[14px]')} aria-hidden />
          立即开始创建
        </button>
      </div>
    </div>
  );
}
