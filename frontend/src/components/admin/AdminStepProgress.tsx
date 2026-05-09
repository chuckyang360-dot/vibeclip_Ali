export function AdminStepProgress({
  steps,
}: {
  steps: { step: string; label: string; status: string; error_message?: string | null }[];
}) {
  return (
    <div className="flex items-start gap-0">
      {steps.map((s, i) => (
        <div key={s.step} className="flex min-w-0 flex-1 items-center">
          <div className="flex flex-col items-center">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs ${
                s.status === 'completed'
                  ? 'bg-emerald-500 text-white'
                  : s.status === 'processing'
                    ? 'bg-indigo-500 text-white'
                    : s.status === 'error'
                      ? 'bg-rose-500 text-white'
                      : 'bg-gray-200 text-gray-500'
              }`}
            >
              {i + 1}
            </div>
            <span className="mt-1.5 whitespace-nowrap text-xs font-medium text-gray-700">{s.label}</span>
            {s.error_message ? <span className="mt-0.5 max-w-[100px] truncate text-xs text-rose-500">{s.error_message}</span> : null}
          </div>
          {i < steps.length - 1 ? <div className="mx-1 mt-[-16px] h-0.5 flex-1 rounded-full bg-gray-200" /> : null}
        </div>
      ))}
    </div>
  );
}
