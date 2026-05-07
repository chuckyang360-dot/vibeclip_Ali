import type { SegmentPlanItem } from '@/types/shortDrama';
import { ri, sdColors, sdFontHeading } from '../utils/shortDramaHelpers';

type Props = {
  segment: SegmentPlanItem;
};

export function SegmentPlanCard({ segment }: Props) {
  return (
    <article
      className="rounded-2xl border border-[#EAEAEA] bg-white p-5 transition-shadow duration-200 hover:shadow-[0_8px_28px_rgba(0,0,0,0.05)] sm:p-6"
      style={{ borderColor: '#EAEAEA' }}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[12px] font-bold"
            style={{ background: `${segment.accentColor}12`, color: segment.accentColor }}
            aria-hidden
          >
            S{segment.id}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[15px] font-bold" style={{ ...sdFontHeading, color: sdColors.ink }}>
                {segment.title}
              </h3>
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={{ background: `${segment.accentColor}10`, color: segment.accentColor }}
              >
                {segment.segmentLabel}
              </span>
            </div>
            <p className="mt-1 text-[12px] text-[#8E8E93]">
              <i className={ri('ri-time-line', 'mr-1 text-[11px] align-middle')} aria-hidden />
              {segment.duration}
            </p>
          </div>
        </div>
        {segment.tags?.length ? (
          <div className="flex flex-wrap justify-end gap-1.5">
            {segment.tags.map((t) => (
              <span
                key={t}
                className="rounded-full border border-[#EAEAEA] bg-[#F5F5F7] px-2 py-0.5 text-[10px] text-[#6E6E73]"
              >
                {t}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <dl className="grid gap-4 sm:grid-cols-3">
        <div>
          <dt className="mb-1 text-[11px] font-medium text-[#8E8E93]">目标</dt>
          <dd className="text-[12.5px] leading-relaxed text-[#444444]">{segment.goal}</dd>
        </div>
        <div>
          <dt className="mb-1 text-[11px] font-medium text-[#8E8E93]">产品露出方式</dt>
          <dd className="text-[12.5px] font-semibold leading-relaxed" style={{ color: segment.accentColor }}>
            {segment.productExposureMode}
          </dd>
        </div>
        <div className="sm:col-span-1">
          <dt className="mb-1 text-[11px] font-medium text-[#8E8E93]">剧情说明</dt>
          <dd className="text-[12.5px] leading-relaxed text-[#444444]">{segment.summary}</dd>
        </div>
      </dl>
    </article>
  );
}
