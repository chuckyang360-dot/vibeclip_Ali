import type { StoryBlueprintAnalysisSection } from '@/types/shortDrama';
import { ri, sdColors, sdFontHeading } from '../utils/shortDramaHelpers';

type Props = {
  sections: StoryBlueprintAnalysisSection[];
  className?: string;
};

export function StoryBlueprintRightRail({ sections, className = '' }: Props) {
  return (
    <aside
      className={`hidden shrink-0 flex-col overflow-y-auto border-[#EAEAEA] bg-[#F7F8FA] p-6 pt-10 xl:flex xl:w-64 xl:border-l ${className}`}
    >
      <h3 className="mb-5 text-[12px] font-bold uppercase tracking-wider text-[#8E8E93]">结构分析</h3>
      <div className="space-y-3">
        {sections.map((section) => (
          <div
            key={section.key}
            className="rounded-xl bg-white p-3.5"
            style={{ border: `1px solid ${sdColors.border}` }}
          >
            <div className="mb-1.5 flex items-center gap-2">
              <i className={ri(section.icon, 'text-[12px]')} style={{ color: section.color }} aria-hidden />
              <span className="text-[11px] text-[#8E8E93]">{section.title}</span>
            </div>
            <div className="space-y-1.5">
              {section.fields.map((field) => (
                <div key={`${section.key}-${field.label}`}>
                  <p className="text-[11px] text-[#8E8E93]">{field.label}</p>
                  <p className="text-[13px] font-semibold leading-relaxed" style={{ ...sdFontHeading, color: sdColors.ink }}>
                    {field.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
