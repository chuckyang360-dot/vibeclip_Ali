const tone: Record<string, string> = {
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  failed: 'bg-rose-50 text-rose-700 border-rose-200',
  error: 'bg-rose-50 text-rose-700 border-rose-200',
  running: 'bg-amber-50 text-amber-700 border-amber-200',
  queued: 'bg-sky-50 text-sky-700 border-sky-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  normal: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  disabled: 'bg-gray-100 text-gray-600 border-gray-200',
  default: 'bg-indigo-50 text-indigo-700 border-indigo-200',
};

export function AdminStatusBadge({ status }: { status: string }) {
  const key = status?.toLowerCase?.() || 'default';
  const cls = tone[key] || tone.default;
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}
