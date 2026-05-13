import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import Badge from "@/components/base/Badge";
import DetailDrawer from "@/components/base/DetailDrawer";
import { apiLogs } from "@/mocks/apiLogs";
import type { ApiLog } from "@/mocks/apiLogs";

function StatusBadge({ status }: { status: ApiLog["status"] }) {
  const { t } = useTranslation(["common"]);
  const map: Record<string, Parameters<typeof Badge>[0]["variant"]> = {
    Success: "green",
    Failed: "red",
    Timeout: "orange",
    "Rate Limited": "yellow",
  };
  const labelMap: Record<string, string> = {
    Success: t("common:status_success"),
    Failed: t("common:status_failed"),
    Timeout: t("common:status_timeout"),
    "Rate Limited": t("common:status_rate_limited"),
  };
  return <Badge label={labelMap[status]} variant={map[status]} />;
}

function HttpStatusBadge({ code }: { code: number }) {
  const isSuccess = code >= 200 && code < 300;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${isSuccess ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
      {code}
    </span>
  );
}

export default function ApiLogsPage() {
  const { t } = useTranslation(["common", "apiLogs"]);
  const [search, setSearch] = useState("");
  const [providerFilter, setProviderFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedLog, setSelectedLog] = useState<ApiLog | null>(null);

  const stats = useMemo(() => {
    const today = apiLogs.length;
    const success = apiLogs.filter((l) => l.status === "Success").length;
    const failed = apiLogs.filter((l) => l.status !== "Success").length;
    const rateLimited = apiLogs.filter((l) => l.status === "Rate Limited").length;
    const totalCost = apiLogs.reduce((sum, l) => {
      const cost = parseFloat(l.estimatedCost.replace("$", ""));
      return sum + cost;
    }, 0);
    const avgDuration =
      apiLogs.reduce((sum, l) => {
        const sec = parseFloat(l.duration.replace("s", ""));
        return sum + sec;
      }, 0) / apiLogs.length;

    return {
      total: today,
      successRate: ((success / today) * 100).toFixed(1),
      failureRate: ((failed / today) * 100).toFixed(1),
      avgLatency: `${avgDuration.toFixed(1)}s`,
      cost: `$${totalCost.toFixed(2)}`,
      rateLimitErrors: rateLimited,
    };
  }, []);

  const filteredLogs = useMemo(() => {
    return apiLogs.filter((log) => {
      const matchSearch =
        !search ||
        log.id.toLowerCase().includes(search.toLowerCase()) ||
        log.user.toLowerCase().includes(search.toLowerCase()) ||
        log.project.toLowerCase().includes(search.toLowerCase()) ||
        log.businessType.toLowerCase().includes(search.toLowerCase());
      const matchProvider = providerFilter === "All" || log.provider === providerFilter;
      const matchStatus = statusFilter === "All" || log.status === statusFilter;
      return matchSearch && matchProvider && matchStatus;
    });
  }, [search, providerFilter, statusFilter]);

  const statCards = [
    { labelKey: "apiLogs:api_calls_today", value: stats.total.toString(), icon: "ri-server-line" },
    { labelKey: "apiLogs:success_rate", value: `${stats.successRate}%`, icon: "ri-check-double-line" },
    { labelKey: "apiLogs:failure_rate", value: `${stats.failureRate}%`, icon: "ri-close-circle-line" },
    { labelKey: "apiLogs:avg_latency", value: stats.avgLatency, icon: "ri-time-line" },
    { labelKey: "apiLogs:est_cost_today", value: stats.cost, icon: "ri-money-cny-box-line" },
    { labelKey: "apiLogs:rate_limit_errors", value: stats.rateLimitErrors.toString(), icon: "ri-alarm-warning-line" },
  ];

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {statCards.map((stat, idx) => (
          <div key={idx} className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-gray-500 mb-1">{t(stat.labelKey)}</p>
                <p className="text-lg font-bold text-gray-900">{stat.value}</p>
              </div>
              <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-50">
                <i className={`${stat.icon} text-gray-500 text-sm`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center text-gray-400">
              <i className="ri-search-line text-sm" />
            </span>
            <input
              type="text"
              placeholder={t("apiLogs:search_placeholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={providerFilter}
              onChange={(e) => setProviderFilter(e.target.value)}
              className="px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="All">{t("common:label_all_providers")}</option>
              <option value="xAI">xAI</option>
              <option value="Gemini">Gemini</option>
              <option value="Cloudflare R2">Cloudflare R2</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="All">{t("common:label_all_status")}</option>
              <option value="Success">{t("common:status_success")}</option>
              <option value="Failed">{t("common:status_failed")}</option>
              <option value="Timeout">{t("common:status_timeout")}</option>
              <option value="Rate Limited">{t("common:status_rate_limited")}</option>
            </select>
          </div>
        </div>
      </div>

      {/* API Logs Table */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">{t("apiLogs:api_call_id")}</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">{t("apiLogs:provider")}</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">{t("apiLogs:model")}</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">{t("apiLogs:business_type")}</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">{t("apiLogs:user")}</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">{t("apiLogs:project")}</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">{t("apiLogs:status")}</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">{t("apiLogs:http_status")}</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500">{t("apiLogs:duration")}</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500">{t("apiLogs:est_cost")}</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">{t("apiLogs:error_message")}</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">{t("apiLogs:created_at")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => (
                <tr
                  key={log.id}
                  className="border-b border-gray-50 hover:bg-gray-50/50 cursor-pointer"
                  onClick={() => setSelectedLog(log)}
                >
                  <td className="px-4 py-2.5 text-xs font-mono text-indigo-600">{log.id}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-600">{log.provider}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-600">{log.model}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-600 font-mono">{log.businessType}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-600 font-mono">{log.user}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-600">{log.project}</td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={log.status} />
                  </td>
                  <td className="px-4 py-2.5">
                    <HttpStatusBadge code={log.httpStatus} />
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-600 text-right">{log.duration}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-900 font-medium text-right">{log.estimatedCost}</td>
                  <td className="px-4 py-2.5 text-xs text-rose-600 max-w-xs truncate">{log.errorMessage !== "-" ? log.errorMessage : "-"}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{log.createdAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredLogs.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-gray-400">{t("apiLogs:no_logs")}</div>
        )}
      </div>

      {/* API Detail Drawer */}
      <DetailDrawer
        isOpen={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title={selectedLog?.id || t("apiLogs:drawer_title")}
      >
        {selectedLog && (
          <div className="space-y-5">
            <div>
              <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-wider mb-2">{t("apiLogs:request_summary")}</h4>
              <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">{t("apiLogs:provider")}</span>
                  <span className="text-gray-900 font-medium">{selectedLog.provider}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">{t("apiLogs:model")}</span>
                  <span className="text-gray-900 font-medium">{selectedLog.model}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">{t("apiLogs:business_type")}</span>
                  <span className="text-gray-900 font-medium font-mono">{selectedLog.businessType}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">{t("apiLogs:user")}</span>
                  <span className="text-gray-900 font-medium font-mono">{selectedLog.user}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">{t("apiLogs:project")}</span>
                  <span className="text-gray-900 font-medium">{selectedLog.project}</span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-wider mb-2">{t("apiLogs:response_summary")}</h4>
              <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">{t("apiLogs:status")}</span>
                  <span className="text-gray-900 font-medium">
                    {selectedLog.status} ({selectedLog.httpStatus})
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">{t("apiLogs:duration")}</span>
                  <span className="text-gray-900 font-medium">{selectedLog.duration}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">{t("apiLogs:est_cost")}</span>
                  <span className="text-gray-900 font-medium">{selectedLog.estimatedCost}</span>
                </div>
              </div>
            </div>

            {selectedLog.errorMessage !== "-" && (
              <div>
                <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-wider mb-2">{t("apiLogs:error_detail")}</h4>
                <div className="bg-rose-50 border border-rose-200 rounded-lg p-3">
                  <p className="text-xs text-rose-700">{selectedLog.errorMessage}</p>
                </div>
              </div>
            )}

            <div>
              <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-wider mb-2">{t("apiLogs:related_info")}</h4>
              <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">{t("apiLogs:credit_transaction")}</span>
                  <span className="text-gray-900 font-medium font-mono">TXN-00588</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">{t("apiLogs:created_at")}</span>
                  <span className="text-gray-900 font-medium">{selectedLog.createdAt}</span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-wider mb-2">{t("apiLogs:request_body")}</h4>
              <div className="bg-gray-100 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <i className="ri-eye-off-line text-gray-400 text-xs" />
                  <span className="text-xs text-gray-400">{t("apiLogs:redacted")}</span>
                </div>
                <div className="h-16 bg-gray-200 rounded animate-pulse" />
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-wider mb-2">{t("apiLogs:response_body")}</h4>
              <div className="bg-gray-100 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <i className="ri-eye-off-line text-gray-400 text-xs" />
                  <span className="text-xs text-gray-400">{t("apiLogs:redacted")}</span>
                </div>
                <div className="h-16 bg-gray-200 rounded animate-pulse" />
              </div>
            </div>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}