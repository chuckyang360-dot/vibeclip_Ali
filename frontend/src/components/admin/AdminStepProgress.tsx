export function AdminStepProgress({
  steps,
}: {
  steps: { step: string; label: string; status: string; error_message?: string | null }[];
}) {
  return (
    <div className="space-y-3">
      {steps.map((s, i) => (
        <div key={s.step} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${
                s.status === 'completed'
                  ? 'bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-500/40'
                  : 'bg-zinc-800 text-zinc-300 ring-1 ring-white/10'
              }`}
            >
              {i + 1}
            </div>
            {i < steps.length - 1 ? <div className="mt-1 h-8 w-px bg-white/10" /> : null}
          </div>
          <div className="flex-1 pb-4">
            <p className="text-xs font-medium text-zinc-400">
              {s.step} · {s.label}
            </p>
            <p className="mt-1 text-sm text-white">{s.status}</p>
            {s.error_message ? <p className="mt-1 text-xs text-red-300">{s.error_message}</p> : null}
          </div>
        </div>
      ))}
    </div>
  );
}
