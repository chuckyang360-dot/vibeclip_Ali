import type { ReactNode } from 'react';
import { sdColors, sdFontHeading } from '../utils/shortDramaHelpers';

type Props = {
  stepLabel: string;
  title: string;
  subtitle: string;
  trailing?: ReactNode;
};

export function AssetsSectionHeader({ stepLabel, title, subtitle, trailing }: Props) {
  return (
    <div className="flex flex-col gap-4 border-b border-[#EAEAEA] bg-white py-6 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <span className="text-[11px] font-bold uppercase tracking-widest text-[#8E8E93]">{stepLabel}</span>
        <h1 className="mt-0.5 text-2xl font-black" style={{ ...sdFontHeading, color: sdColors.ink }}>
          {title}
        </h1>
        <p className="mt-1 max-w-xl text-[13px] text-[#8E8E93]">{subtitle}</p>
      </div>
      {trailing}
    </div>
  );
}
