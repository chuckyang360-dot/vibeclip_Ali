import type { ReactNode } from 'react';

type MobileBottomActionBarProps = {
  children: ReactNode;
};

export function MobileBottomActionBar({ children }: MobileBottomActionBarProps) {
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-[#EAEAEA] bg-white/95 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur">
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}
