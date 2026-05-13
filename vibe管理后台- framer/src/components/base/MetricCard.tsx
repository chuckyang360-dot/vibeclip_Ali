import Badge from "@/components/base/Badge";

interface MetricCardProps {
  label: string;
  value: string;
  change?: number;
  icon: string;
  suffix?: string;
}

export default function MetricCard({ label, value, change, icon, suffix }: MetricCardProps) {
  const hasChange = change !== undefined;
  const isPositive = hasChange && change >= 0;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-500 mb-1">{label}</p>
          <p className="text-xl font-bold text-gray-900">
            {value}
            {suffix && <span className="text-sm font-normal text-gray-500 ml-0.5">{suffix}</span>}
          </p>
          {hasChange && (
            <div className="flex items-center gap-1 mt-1">
              <span className="w-3 h-3 flex items-center justify-center">
                <i
                  className={`${isPositive ? "ri-arrow-up-line" : "ri-arrow-down-line"} text-xs ${isPositive ? "text-emerald-600" : "text-rose-600"}`}
                />
              </span>
              <span className={`text-xs font-medium ${isPositive ? "text-emerald-600" : "text-rose-600"}`}>
                {isPositive ? "+" : ""}{change}%
              </span>
              <span className="text-xs text-gray-400">vs yesterday</span>
            </div>
          )}
        </div>
        <div className="w-9 h-9 flex items-center justify-center rounded-lg bg-gray-50">
          <i className={`${icon} text-gray-500 text-base`} />
        </div>
      </div>
    </div>
  );
}