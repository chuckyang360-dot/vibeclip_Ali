import { ReactNode } from 'react';

export function AdminFilterBar({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-gray-200 bg-white p-4"><div className="flex flex-wrap items-end gap-3">{children}</div></div>;
}
