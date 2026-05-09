import { ReactNode } from 'react';

export function AdminFilterBar({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-white/10 bg-zinc-900/40 p-4">{children}</div>
  );
}
