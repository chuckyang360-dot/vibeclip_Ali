import type { ReactNode } from 'react';
import { ChevronDown, Check, FileInput, Film, PenLine, Sparkles } from 'lucide-react';

export type S0CreationType = 'intent' | 'script_import' | 'video_analysis' | 'free_creation';

export const s0CreationTypes: Array<{
  id: S0CreationType;
  label: string;
  icon: typeof PenLine;
}> = [
  { id: 'intent', label: '描述想法', icon: PenLine },
  { id: 'script_import', label: '导入剧本', icon: FileInput },
  { id: 'video_analysis', label: '视频解构', icon: Film },
  { id: 'free_creation', label: '自由创作', icon: Sparkles },
];

export function S0PromptShell({
  eyebrow = 'S0 · 创作意图',
  title,
  subtitle,
  className = 'max-w-[880px]',
  children,
}: {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`mx-auto w-full ${className}`}>
      <header className="mb-7 text-left md:text-center">
        <span className="mb-3 inline-flex rounded-full bg-[#EAEAEA] px-3 py-1 text-[11px] font-black uppercase tracking-widest text-[#8E8E93]">
          {eyebrow}
        </span>
        <h1
          className="text-[30px] font-black leading-tight text-[#1D1D1F] md:text-[36px]"
          style={{ fontFamily: "'Syne', sans-serif" }}
        >
          {title}
        </h1>
        {subtitle ? <p className="mt-3 text-[13px] leading-6 text-[#8E8E93]">{subtitle}</p> : null}
      </header>
      {children}
    </section>
  );
}

export function ToolbarButton({
  children,
  active = false,
  onClick,
  disabled = false,
}: {
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-[13px] font-black transition disabled:cursor-not-allowed disabled:opacity-45 ${
        active
          ? 'border-[#1D1D1F] bg-[#1D1D1F] text-white'
          : 'border-[#E5E5EA] bg-white text-[#444444] hover:border-[#B9C0CE] hover:bg-[#F7F8FA]'
      }`}
    >
      {children}
    </button>
  );
}

export function CreationTypeDropdown({
  active,
  open,
  onOpenChange,
  onSelect,
}: {
  active: S0CreationType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (type: S0CreationType) => void;
}) {
  const current = s0CreationTypes.find((item) => item.id === active) || s0CreationTypes[0];
  const CurrentIcon = current.icon;
  return (
    <div className="relative">
      <ToolbarButton active onClick={() => onOpenChange(!open)}>
        <CurrentIcon className="h-4 w-4" />
        {current.label}
        <ChevronDown className={`h-4 w-4 transition ${open ? 'rotate-180' : ''}`} />
      </ToolbarButton>
      {open ? (
        <div className="absolute bottom-[calc(100%+10px)] left-0 z-20 w-[210px] rounded-xl border border-[#E5E5EA] bg-white p-2 shadow-[0_18px_42px_rgba(15,23,42,0.16)]">
          <div className="px-2 pb-2 pt-1 text-[12px] font-bold text-[#8E8E93]">创作类型</div>
          <div className="space-y-1">
            {s0CreationTypes.map((item) => {
              const Icon = item.icon;
              const selected = item.id === active;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSelect(item.id);
                    onOpenChange(false);
                  }}
                  className={`flex h-11 w-full items-center justify-between rounded-lg px-3 text-left text-[14px] font-black ${
                    selected ? 'bg-[#F2F4F8] text-[#1D1D1F]' : 'text-[#444444] hover:bg-[#F7F8FA]'
                  }`}
                >
                  <span className="inline-flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </span>
                  {selected ? <Check className="h-4 w-4" /> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
