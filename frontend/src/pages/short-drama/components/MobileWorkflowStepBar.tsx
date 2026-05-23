import { ri } from '../utils/shortDramaHelpers';

const STEP_LABELS = ['创作意图', '商品理解', '剧本生成', '资产管理', '视频生成'];

type MobileWorkflowStepBarProps = {
  currentStep: number;
};

export function MobileWorkflowStepBar({ currentStep }: MobileWorkflowStepBarProps) {
  return (
    <div className="md:hidden border-b border-[#EAEAEA] bg-white px-4 py-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#8E8E93]">
          STEP {String(currentStep).padStart(2, '0')}
        </span>
        <span className="text-[12px] font-semibold text-[#1D1D1F]">{STEP_LABELS[currentStep] || '工作流'}</span>
      </div>
      <div className="grid grid-cols-5 gap-1">
        {STEP_LABELS.map((label, index) => {
          const active = index === currentStep;
          const done = index < currentStep;
          return (
            <div
              key={label}
              className="flex h-8 items-center justify-center rounded-lg"
              style={{
                background: active ? '#1D1D1F' : done ? 'rgba(4,120,87,0.08)' : '#F5F5F7',
                color: active ? '#ffffff' : done ? '#047857' : '#AEAEB2',
              }}
              title={label}
            >
              {done ? <i className={ri('ri-check-line', 'text-[13px]')} aria-hidden /> : <span className="text-[11px] font-bold">{index}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
