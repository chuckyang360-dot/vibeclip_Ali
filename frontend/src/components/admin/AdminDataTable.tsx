import { ReactNode } from 'react';

export function AdminDataTable({
  headers,
  children,
  empty,
}: {
  headers: string[];
  children: ReactNode;
  empty?: boolean;
}) {
  if (empty) {
    return null;
  }
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/50 shadow-[0_24px_80px_-48px_rgba(0,0,0,0.9)]">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-zinc-900/60 text-xs uppercase tracking-wide text-zinc-500">
              {headers.map((h) => (
                <th key={h} className="whitespace-nowrap px-4 py-3 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-zinc-200">{children}</tbody>
        </table>
      </div>
    </div>
  );
}
