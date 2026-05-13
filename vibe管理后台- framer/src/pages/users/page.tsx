import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Badge from "@/components/base/Badge";
import { users } from "@/mocks/users";
import type { User } from "@/mocks/users";

function UserStatusBadge({ status }: { status: User["status"] }) {
  const { t } = useTranslation(["common"]);
  const map: Record<string, Parameters<typeof Badge>[0]["variant"]> = {
    Normal: "green",
    Disabled: "gray",
    Risk: "orange",
  };
  const labelMap: Record<string, string> = {
    Normal: t("common:status_normal"),
    Disabled: t("common:status_disabled"),
    Risk: t("common:status_risk"),
  };
  return <Badge label={labelMap[status]} variant={map[status]} />;
}

function SubscriptionBadge({ sub }: { sub: User["subscription"] }) {
  const { t } = useTranslation(["common"]);
  const map: Record<string, Parameters<typeof Badge>[0]["variant"]> = {
    Free: "gray",
    Paid: "blue",
    Expired: "orange",
    Canceled: "red",
  };
  const labelMap: Record<string, string> = {
    Free: t("common:subscription_free"),
    Paid: t("common:subscription_paid"),
    Expired: t("common:subscription_expired"),
    Canceled: t("common:subscription_canceled"),
  };
  return <Badge label={labelMap[sub]} variant={map[sub]} />;
}

export default function UsersPage() {
  const navigate = useNavigate();
  const { t } = useTranslation(["common", "users"]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [subFilter, setSubFilter] = useState("All");

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchSearch =
        !search ||
        u.email.toLowerCase().includes(search.toLowerCase()) ||
        u.username.toLowerCase().includes(search.toLowerCase()) ||
        u.id.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "All" || u.status === statusFilter;
      const matchSub = subFilter === "All" || u.subscription === subFilter;
      return matchSearch && matchStatus && matchSub;
    });
  }, [search, statusFilter, subFilter]);

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
              placeholder={t("users:search_placeholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="All">{t("common:label_all_status")}</option>
              <option value="Normal">{t("common:status_normal")}</option>
              <option value="Disabled">{t("common:status_disabled")}</option>
              <option value="Risk">{t("common:status_risk")}</option>
            </select>

            <select
              value={subFilter}
              onChange={(e) => setSubFilter(e.target.value)}
              className="px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="All">{t("common:label_all_subscriptions")}</option>
              <option value="Free">{t("common:subscription_free")}</option>
              <option value="Paid">{t("common:subscription_paid")}</option>
              <option value="Expired">{t("common:subscription_expired")}</option>
              <option value="Canceled">{t("common:subscription_canceled")}</option>
            </select>

            <button className="px-3 py-2 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 flex items-center gap-1.5 whitespace-nowrap">
              <span className="w-3.5 h-3.5 flex items-center justify-center">
                <i className="ri-download-line text-xs" />
              </span>
              {t("common:action_export")}
            </button>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">{t("users:user_id")}</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">{t("users:email")}</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">{t("users:username")}</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">{t("users:registered_at")}</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">{t("users:last_login")}</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">{t("users:status")}</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">{t("users:subscription")}</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500">{t("users:credit_balance")}</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500">{t("users:projects")}</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500">{t("users:assets")}</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500">{t("users:videos")}</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500">{t("users:api_cost_7d")}</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">{t("users:actions")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-4 py-2.5 text-xs font-mono text-gray-700">
                    <button
                      onClick={() => navigate(`/users/${user.id}`)}
                      className="text-indigo-600 hover:text-indigo-700 hover:underline"
                    >
                      {user.id}
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-600">{user.email}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-600">{user.username}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{user.registeredAt}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{user.lastLogin}</td>
                  <td className="px-4 py-2.5">
                    <UserStatusBadge status={user.status} />
                  </td>
                  <td className="px-4 py-2.5">
                    <SubscriptionBadge sub={user.subscription} />
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-900 font-medium text-right">
                    {user.creditBalance.toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-600 text-right">{user.projects}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-600 text-right">{user.assets}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-600 text-right">{user.videos}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-900 font-medium text-right">{user.apiCost7D}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => navigate(`/users/${user.id}`)}
                        className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-gray-100 text-gray-500"
                        title={t("users:tooltip_view")}
                      >
                        <i className="ri-eye-line text-xs" />
                      </button>
                      <button className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-gray-100 text-gray-500" title={t("users:tooltip_grant")}>
                        <i className="ri-coin-line text-xs" />
                      </button>
                      <button className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-gray-100 text-gray-500" title={t("users:tooltip_disable")}>
                        <i className="ri-forbid-line text-xs" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredUsers.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-gray-400">{t("users:no_users")}</div>
        )}
      </div>
    </div>
  );
}