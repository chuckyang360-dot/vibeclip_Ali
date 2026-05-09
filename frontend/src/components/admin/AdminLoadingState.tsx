export function AdminLoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-2xl border border-white/10 bg-zinc-950/40 p-10 text-sm text-zinc-400">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
      <span>{label}</span>
    </div>
  );
}
