export function AdminTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 border-b border-white/10 pb-2">
      {tabs.map((t) => {
        const on = t.id === active;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${
              on
                ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/25'
                : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-100'
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
