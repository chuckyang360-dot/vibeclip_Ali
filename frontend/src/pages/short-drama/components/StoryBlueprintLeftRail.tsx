import type { StoryBlueprintGlobalField, StoryBlueprintSettingRow } from '@/types/shortDrama';
import { sdColors } from '../utils/shortDramaHelpers';

type Props = {
  settings: StoryBlueprintSettingRow[];
  globalFields: StoryBlueprintGlobalField[];
  className?: string;
};

export function StoryBlueprintLeftRail({ settings, globalFields, className = '' }: Props) {
  return (
    <aside
      className={`hidden shrink-0 flex-col overflow-y-auto border-[#EAEAEA] bg-[#F7F8FA] p-6 pt-10 lg:flex lg:w-64 lg:border-r ${className}`}
    >
      <div className="mb-6">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[#AEAEB2]">创作提示</p>
        <p className="mb-3 text-[11px] leading-relaxed text-[#8E8E93]">
          这些信息来自 S0 创作意图，只作为 AI 理解方向的参考。
        </p>
        <div>
          {settings.map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between gap-3 py-2.5"
              style={{ borderBottom: '1px solid #F0F0F0' }}
            >
              <span className="text-[12px] text-[#8E8E93]">{item.label}</span>
              <span className="text-right text-[12px] font-medium text-[#444444]">{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      {globalFields.length ? (
        <div>
          <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[#AEAEB2]">AI 创作理解</p>
          <div className="space-y-3 rounded-xl bg-white p-3" style={{ border: `1px solid ${sdColors.border}` }}>
            {globalFields.map((item) => (
              <div key={item.label}>
                <p className="mb-0.5 text-[10px]" style={{ color: '#AEAEB2' }}>
                  {item.label}
                </p>
                <p
                  className="overflow-hidden text-[12px] font-medium leading-snug text-[#444444]"
                  style={{
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                  }}
                  title={item.value}
                >
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </aside>
  );
}
