import type { CapabilityCard as CapabilityCardType } from '@/types/shortDrama';
import { ri, sdColors, sdFontHeading } from '../utils/shortDramaHelpers';

type Props = {
  cards: CapabilityCardType[];
};

export function CapabilityCards({ cards }: Props) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <article
          key={c.id}
          className="flex h-full flex-col gap-4 rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1"
          style={{ background: '#ffffff', border: '1px solid #EAEAEA' }}
        >
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ background: `${c.accentColor}10` }}
          >
            <i className={ri(c.icon, 'text-[18px]')} style={{ color: c.accentColor }} aria-hidden />
          </div>
          <div className="min-h-0 flex-1">
            <h3
              className="mb-2 text-[15px] font-bold"
              style={{ ...sdFontHeading, color: sdColors.ink }}
            >
              {c.title}
            </h3>
            <p className="text-[12.5px] leading-relaxed" style={{ color: '#6E6E73' }}>
              {c.description}
            </p>
          </div>
          <div className="mt-auto flex flex-wrap gap-1.5">
            {c.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full px-2 py-1 text-[10px] font-medium"
                style={{ background: `${c.accentColor}10`, color: c.accentColor }}
              >
                {tag}
              </span>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}
