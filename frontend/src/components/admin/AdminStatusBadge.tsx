const tone: Record<string, string> = {
  success: 'bg-emerald-500/15 text-emerald-200 ring-emerald-500/30',
  failed: 'bg-red-500/15 text-red-200 ring-red-500/30',
  error: 'bg-red-500/15 text-red-200 ring-red-500/30',
  running: 'bg-amber-500/15 text-amber-200 ring-amber-500/30',
  queued: 'bg-sky-500/15 text-sky-200 ring-sky-500/30',
  completed: 'bg-emerald-500/15 text-emerald-200 ring-emerald-500/30',
  normal: 'bg-zinc-500/15 text-zinc-200 ring-zinc-500/30',
  disabled: 'bg-rose-500/15 text-rose-200 ring-rose-500/30',
  default: 'bg-violet-500/15 text-violet-200 ring-violet-500/30',
};

export function AdminStatusBadge({ status }: { status: string }) {
  const key = status?.toLowerCase?.() || 'default';
  const cls = tone[key] || tone.default;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${cls}`}>
      {status}
    </span>
  );
}
