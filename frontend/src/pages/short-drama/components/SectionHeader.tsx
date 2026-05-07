import type { CSSProperties } from 'react';
import { sdColors, sdFontHeading } from '../utils/shortDramaHelpers';

export type SectionEyebrowVariant = 'pillSolid' | 'pillOutline';

type SectionHeaderProps = {
  eyebrow?: string;
  /** Matches Framer: gray pill vs muted outline pill */
  eyebrowVariant?: SectionEyebrowVariant;
  title: string;
  subtitle?: string;
  /** Framer uses max-w-xl (capabilities) or max-w-lg (workflow / audience) */
  subtitleMaxWidthClass?: string;
  className?: string;
};

export function SectionHeader({
  eyebrow,
  eyebrowVariant = 'pillSolid',
  title,
  subtitle,
  subtitleMaxWidthClass = 'max-w-xl',
  className = '',
}: SectionHeaderProps) {
  const pillBase =
    'inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-5 text-[11px] font-semibold tracking-[0.2em] uppercase';
  const pillStyle: CSSProperties =
    eyebrowVariant === 'pillOutline'
      ? { background: '#F5F5F7', color: '#6E6E73', border: '1px solid #EAEAEA' }
      : { background: '#EAEAEA', color: '#6E6E73' };

  return (
    <div className={`text-center mb-16 ${className}`}>
      {eyebrow ? (
        <div className={pillBase} style={pillStyle}>
          {eyebrow}
        </div>
      ) : null}
      <h2
        className="text-3xl lg:text-4xl font-black mb-4 leading-tight tracking-[-0.03em]"
        style={{ ...sdFontHeading, color: sdColors.ink }}
      >
        {title}
      </h2>
      {subtitle ? (
        <p
          className={`mx-auto text-[15px] leading-relaxed ${subtitleMaxWidthClass}`}
          style={{ color: '#8E8E93' }}
        >
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}
