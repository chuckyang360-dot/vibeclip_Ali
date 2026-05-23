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
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2 text-[11px] text-gray-400 sm:hidden">
        <span>横向滑动查看完整数据</span>
        <i className="ri-arrow-left-right-line text-sm" />
      </div>
      <div className="overflow-x-auto [-webkit-overflow-scrolling:touch]">
        <table className="min-w-[760px] border-collapse text-left text-sm lg:min-w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60 text-xs font-medium text-gray-500">
              {headers.map((h) => (
                <th key={h} className="whitespace-nowrap px-4 py-3 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 text-gray-700 [&_td]:align-top">{children}</tbody>
        </table>
      </div>
    </div>
  );
}
