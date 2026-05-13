import { useState, useMemo } from "react";

interface TableColumn<T> {
  key: string;
  header: string;
  width?: string;
  align?: "left" | "center" | "right";
  render?: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  searchPlaceholder?: string;
  searchFields?: string[];
  emptyText?: string;
  actions?: (row: T) => React.ReactNode;
}

export default function DataTable<T>({
  columns,
  data,
  keyExtractor,
  searchPlaceholder = "Search...",
  searchFields,
  emptyText = "No data found",
  actions,
}: DataTableProps<T>) {
  const [search, setSearch] = useState("");

  const filteredData = useMemo(() => {
    if (!search || !searchFields) return data;
    const q = search.toLowerCase();
    return data.filter((row) =>
      searchFields.some((field) => {
        const val = (row as Record<string, unknown>)[field];
        return val !== undefined && String(val).toLowerCase().includes(q);
      })
    );
  }, [data, search, searchFields]);

  const alignClass = (align?: string) => {
    switch (align) {
      case "right": return "text-right";
      case "center": return "text-center";
      default: return "text-left";
    }
  };

  return (
    <div>
      {searchFields && (
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="relative max-w-sm">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center text-gray-400">
              <i className="ri-search-line text-sm" />
            </span>
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-2.5 text-xs font-medium text-gray-500 ${alignClass(col.align)}`}
                  style={col.width ? { width: col.width } : undefined}
                >
                  {col.header}
                </th>
              ))}
              {actions && (
                <th className="px-4 py-2.5 text-xs font-medium text-gray-500 text-left">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {filteredData.map((row) => (
              <tr key={keyExtractor(row)} className="border-b border-gray-50 hover:bg-gray-50/50">
                {columns.map((col) => (
                  <td key={col.key} className={`px-4 py-2.5 ${alignClass(col.align)}`}>
                    {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? "-")}
                  </td>
                ))}
                {actions && (
                  <td className="px-4 py-2.5">{actions(row)}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filteredData.length === 0 && (
        <div className="px-4 py-8 text-center text-sm text-gray-400">{emptyText}</div>
      )}
    </div>
  );
}