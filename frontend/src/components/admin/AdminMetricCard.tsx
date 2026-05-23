export function AdminMetricCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 sm:p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="mb-1 truncate text-[11px] text-gray-500 sm:text-xs">{label}</p>
          <p className="truncate text-lg font-bold text-gray-900 sm:text-xl">{value}</p>
          {hint ? <p className="mt-1 text-xs text-gray-400">{hint}</p> : null}
        </div>
        {icon ? (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-50 sm:h-9 sm:w-9">
            <i className={`${icon} text-sm text-gray-500 sm:text-base`} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
