import { ReactNode } from 'react';

export function AdminDetailDrawer({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-label="Close" onClick={onClose} />
      <aside className="relative z-10 flex h-full w-full max-w-lg flex-col border-l border-white/10 bg-zinc-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h2 className="text-sm font-semibold text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-xs text-zinc-400 hover:bg-white/5 hover:text-white"
          >
            Close
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 text-sm text-zinc-300">{children}</div>
      </aside>
    </div>
  );
}
