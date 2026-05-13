import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import Badge from "@/components/base/Badge";
import {
  dashboardStats,
  userGrowthData,
  projectVideoData,
  apiCostData,
  apiHealthItems,
  topErrorTypes,
  failedTasks,
  highConsumptionUsers,
} from "@/mocks/dashboard";
import type { FailedTask, HighConsumptionUser } from "@/mocks/dashboard";

const TASK_TYPE_MAP: Record<string, string> = {
  Asset: "dashboard:task_type_asset",
  Video: "dashboard:task_type_video",
  API: "dashboard:task_type_api",
};

function StatCard({ stat }: { stat: (typeof dashboardStats)[0] }) {
  const { t } = useTranslation(["common", "dashboard"]);
  const isPositive = stat.change >= 0;
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-500 mb-1">{t(stat.labelKey)}</p>
          <p className="text-xl font-bold text-gray-900">{stat.value}</p>
          <div className="flex items-center gap-1 mt-1">
            <span className="w-3 h-3 flex items-center justify-center">
              <i
                className={`${isPositive ? "ri-arrow-up-line" : "ri-arrow-down-line"} text-xs ${isPositive ? "text-emerald-600" : "text-rose-600"}`}
              />
            </span>
            <span
              className={`text-xs font-medium ${isPositive ? "text-emerald-600" : "text-rose-600"}`}
            >
              {isPositive ? "+" : ""}
              {stat.change}%
            </span>
            <span className="text-xs text-gray-400">{t("common:label_vs_yesterday")}</span>
          </div>
        </div>
        <div className="w-9 h-9 flex items-center justify-center rounded-lg bg-gray-50">
          <i className={`${stat.icon} text-gray-500 text-base`} />
        </div>
      </div>
    </div>
  );
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">{title}</h3>
      <div className="h-56">{children}</div>
    </div>
  );
}

function ProgressBar({
  percentage,
  color,
}: {
  percentage: number;
  color: string;
}) {
  const { t } = useTranslation(["common"]);
  return (
    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full ${color}`}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}

function TaskStatusBadge({ status }: { status: FailedTask["status"] }) {
  const { t } = useTranslation(["common"]);
  const map: Record<string, { variant: Parameters<typeof Badge>[0]["variant"]; labelKey: string }> = {
    Failed: { variant: "red", labelKey: "status_failed" },
    Processing: { variant: "yellow", labelKey: "status_processing" },
    Stuck: { variant: "orange", labelKey: "status_stuck" },
    Completed: { variant: "green", labelKey: "status_completed" },
  };
  const cfg = map[status];
  return <Badge label={t(`common:${cfg.labelKey}`)} variant={cfg.variant} />;
}

function RiskBadge({ level }: { level: HighConsumptionUser["riskLevel"] }) {
  const { t } = useTranslation(["common"]);
  const map: Record<string, { key: string; variant: Parameters<typeof Badge>[0]["variant"] }> = {
    Low: { key: "label_low", variant: "green" },
    Medium: { key: "label_medium", variant: "yellow" },
    High: { key: "label_high", variant: "orange" },
    Critical: { key: "label_critical", variant: "red" },
  };
  const cfg = map[level];
  return <Badge label={t(`common:${cfg.key}`)} variant={cfg.variant} />;
}

export default function DashboardPage() {
  const { t } = useTranslation(["common", "dashboard"]);
  const [taskFilter, setTaskFilter] = useState("All");
  const taskFilters = [
    { key: "All", label: t("common:all") },
    { key: "Failed", label: t("common:status_failed") },
    { key: "Stuck", label: t("common:status_stuck") },
    { key: "Processing", label: t("common:status_processing") },
  ];

  const filteredTasks =
    taskFilter === "All"
      ? failedTasks
      : failedTasks.filter((t) => t.status === taskFilter);

  return (
    <div className="space-y-5">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {dashboardStats.map((stat, idx) => (
          <StatCard key={idx} stat={stat} />
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard title={t("dashboard:chart_user_growth")}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={userGrowthData}>
              <defs>
                <linearGradient id="colorUser" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#9ca3af" />
              <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
              <Tooltip
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#4f46e5"
                strokeWidth={2}
                fill="url(#colorUser)"
                name={t("dashboard:chart_new_users")}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={t("dashboard:chart_project_video")}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={projectVideoData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#9ca3af" />
              <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
              <Tooltip
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="value" name={t("dashboard:chart_projects")} fill="#4f46e5" radius={[3, 3, 0, 0]} />
              <Bar dataKey="value2" name={t("dashboard:chart_videos")} fill="#0ea5e9" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={t("dashboard:chart_api_cost")}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={apiCostData}>
              <defs>
                <linearGradient id="colorApi" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#9ca3af" />
              <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
              <Tooltip
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#10b981"
                strokeWidth={2}
                fill="url(#colorApi)"
                name={t("dashboard:chart_api_calls")}
              />
              <Area
                type="monotone"
                dataKey="value2"
                stroke="#f59e0b"
                strokeWidth={2}
                fill="none"
                name={t("dashboard:chart_cost_usd")}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* API Health + Errors */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">{t("dashboard:api_health_title")}</h3>
          <div className="space-y-4">
            {apiHealthItems.map((item, idx) => (
              <div key={idx}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-gray-600">{item.name}</span>
                  <span className="text-xs font-medium text-gray-900">
                    {item.value}
                  </span>
                </div>
                <ProgressBar
                  percentage={item.percentage}
                  color={
                    item.status === "good"
                      ? "bg-emerald-500"
                      : item.status === "warning"
                        ? "bg-amber-500"
                        : "bg-rose-500"
                  }
                />
                <p className="text-xs text-gray-400 mt-0.5">
                  {t("dashboard:of_total", { percent: item.percentage })}
                </p>
              </div>
            ))}
            <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge label={`${t("dashboard:success_rate")} 99.2%`} variant="green" />
                <Badge label={`${t("dashboard:failure_rate")} 0.8%`} variant="red" />
              </div>
              <span className="text-xs text-gray-400">{t("dashboard:total_calls", { count: "24,567" })}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">{t("dashboard:top_errors_title")}</h3>
          <div className="space-y-3">
            {topErrorTypes.map((err, idx) => (
              <div key={idx}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-600">{err.type}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-900">
                      {err.count}
                    </span>
                    <span className="text-xs text-gray-400">({err.percentage}%)</span>
                  </div>
                </div>
                <ProgressBar percentage={err.percentage} color="bg-rose-400" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Failed Tasks Table */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">{t("dashboard:failed_tasks_title")}</h3>
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
            {taskFilters.map((f) => (
              <button
                key={f.key}
                onClick={() => setTaskFilter(f.key)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${taskFilter === f.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">{t("dashboard:task_id")}</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">{t("dashboard:task_type")}</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">{t("dashboard:task_user")}</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">{t("dashboard:task_project")}</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">{t("dashboard:task_status")}</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">{t("dashboard:task_duration")}</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">{t("dashboard:task_error")}</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">{t("dashboard:task_created_at")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map((task) => (
                <tr key={task.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-4 py-2.5 text-xs font-mono text-gray-700">{task.id}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-600">{t(TASK_TYPE_MAP[task.type] || task.type)}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-600 font-mono">{task.user}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-600">{task.project}</td>
                  <td className="px-4 py-2.5">
                    <TaskStatusBadge status={task.status} />
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-600">{task.duration}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-600 max-w-xs truncate">{task.error}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{task.createdAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* High Consumption Users Table */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">{t("dashboard:high_consumption_title")}</h3>
          <button className="text-xs text-indigo-600 font-medium hover:text-indigo-700 flex items-center gap-1">
            {t("common:action_view_all")}
            <span className="w-3 h-3 flex items-center justify-center">
              <i className="ri-arrow-right-line text-xs" />
            </span>
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">{t("common:label_user")}</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">{t("common:label_email")}</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500">{t("dashboard:credits_today")}</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500">{t("dashboard:api_cost_today")}</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500">{t("common:label_projects")}</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500">{t("common:label_videos")}</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">{t("dashboard:risk_level")}</th>
              </tr>
            </thead>
            <tbody>
              {highConsumptionUsers.map((user, idx) => (
                <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-4 py-2.5 text-xs font-mono text-gray-700">{user.user}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-600">{user.email}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-900 font-medium text-right">
                    {user.creditsToday.toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-900 font-medium text-right">
                    {user.apiCostToday}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-600 text-right">{user.projects}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-600 text-right">{user.videos}</td>
                  <td className="px-4 py-2.5">
                    <RiskBadge level={user.riskLevel} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}