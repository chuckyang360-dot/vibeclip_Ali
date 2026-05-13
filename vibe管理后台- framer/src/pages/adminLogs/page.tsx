import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import Badge from "@/components/base/Badge";
import { adminLogs } from "@/mocks/adminLogData";

function ActionBadge({ action }: { action: string }) {
  const { t } = useTranslation(["adminLogs"]);
  const map: Record<string, Parameters<typeof Badge>[0]["variant"]> = {
    grant_credits: "green",
    deduct_credits: "red",
    disable_user: "red",
    restore_user: "green",
    update_user_note: "blue",
    mark_asset_abnormal: "orange",
    mark_video_abnormal: "orange",
    adjustment: "yellow",
  };
  const labelMap: Record<string, string> = {
    grant_credits: t("adminLogs:action_grant_credits"),
    deduct_credits: t("adminLogs:action_deduct_credits"),
    disable_user: t("adminLogs:action_disable_user"),
    restore_user: t("adminLogs:action_restore_user"),
    update_user_note: t("adminLogs:action_update_note"),
    mark_asset_abnormal: t("adminLogs:action_mark_asset"),
    mark_video_abnormal: t("adminLogs:action_mark_video"),
    adjustment: t("adminLogs:action_adjustment"),
  };
  return <Badge label={labelMap[action] || action} variant={map[action] || "gray"} />;
}

export default function AdminLogsPage() {
  const { t } = useTranslation(["common", "adminLogs"]);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("All");
  const [targetTypeFilter, setTargetTypeFilter] = useState("All");

  const filteredLogs = useMemo(() => {
    return adminLogs.filter((log) => {
      const matchSearch =
        !search ||
        log.id.toLowerCase().includes(search.toLowerCase()) ||
        log.operator.toLowerCase().includes(search.toLowerCase()) ||
        log.targetId.toLowerCase().includes(search.toLowerCase()) ||
        log.reason.toLowerCase().includes(search.toLowerCase());
      const matchAction = actionFilter === "All" || log.action === actionFilter;
      const matchTarget = targetTypeFilter === "All" || log.targetType === targetTypeFilter;
      return matchSearch && matchAction && matchTarget;
    });
  }, [search, actionFilter, targetTypeFilter]);

  const uniqueActions = Array.from(new Set(adminLogs.map((l) => l.action)));
  const uniqueTargetTypes = Array.from(new Set(adminLogs.map((l) => l.targetType)));

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center text-gray-400">
              <i className="ri-search-line text-sm" />
            </span>
            <input
              type="text"
              placeholder={t("adminLogs:search_placeholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="All">{t("common:label_all_actions")}</option>
              {uniqueActions.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>

            <select
              value={targetTypeFilter}
              onChange={(e) => setTargetTypeFilter(e.target.value)}
              className="px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="All">{t("common:label_all_target_types")}</option>
              {uniqueTargetTypes.map((t2) => (
                <option key={t2} value={t2}>{t2}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">{t("adminLogs:log_id")}</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">{t("adminLogs:operator")}</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">{t("adminLogs:action")}</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">{t("adminLogs:target_type")}</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">{t("adminLogs:target_id")}</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">{t("adminLogs:before")}</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">{t("adminLogs:after")}</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">{t("adminLogs:reason")}</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">{t("adminLogs:ip")}</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">{t("adminLogs:created_at")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => (
                <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-4 py-2.5 text-xs font-mono text-gray-700">{log.id}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-600">{log.operator}</td>
                  <td className="px-4 py-2.5"><ActionBadge action={log.action} /></td>
                  <td className="px-4 py-2.5 text-xs text-gray-600">{log.targetType}</td>
                  <td className="px-4 py-2.5 text-xs font-mono text-gray-700">{log.targetId}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{log.before}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-700">{log.after}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-600 max-w-[150px] truncate" title={log.reason}>{log.reason}</td>
                  <td className="px-4 py-2.5 text-xs font-mono text-gray-500">{log.ip}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{log.createdAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredLogs.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-gray-400">{t("adminLogs:no_logs")}</div>
        )}
      </div>
    </div>
  );
}