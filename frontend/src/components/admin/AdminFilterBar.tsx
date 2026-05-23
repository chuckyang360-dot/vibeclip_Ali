import { ReactNode } from 'react';

export function AdminFilterBar({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end [&_button]:h-10 [&_button]:w-full sm:[&_button]:w-auto [&_input]:h-10 [&_input]:w-full sm:[&_input]:min-w-[160px] sm:[&_input]:w-auto [&_label]:w-full sm:[&_label]:w-auto [&_select]:h-10 [&_select]:w-full sm:[&_select]:min-w-[150px] sm:[&_select]:w-auto">
        {children}
      </div>
    </div>
  );
}
