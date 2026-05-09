export function AdminEmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-zinc-950/30 px-8 py-12 text-center">
      <p className="text-sm font-medium text-zinc-200">{title}</p>
      {description ? <p className="mt-2 text-xs text-zinc-500">{description}</p> : null}
    </div>
  );
}
