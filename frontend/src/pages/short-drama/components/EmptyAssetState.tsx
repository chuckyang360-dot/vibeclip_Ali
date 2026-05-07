import { ri, sdColors, sdFontHeading } from '../utils/shortDramaHelpers';

type Props = {
  title: string;
  hint: string;
};

export function EmptyAssetState({ title, hint }: Props) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#EAEAEA] bg-[#FAFAFB] px-6 py-16 text-center"
    >
      <div
        className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl"
        style={{ background: sdColors.surface2, border: `1px solid ${sdColors.border}` }}
      >
        <i className={ri('ri-image-2-line', 'text-[22px] text-[#AEAEB2]')} aria-hidden />
      </div>
      <p className="text-[14px] font-semibold" style={{ ...sdFontHeading, color: sdColors.ink }}>
        {title}
      </p>
      <p className="mt-1 max-w-sm text-[13px] text-[#8E8E93]">{hint}</p>
    </div>
  );
}
