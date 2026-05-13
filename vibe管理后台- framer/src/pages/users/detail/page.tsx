import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Badge from "@/components/base/Badge";
import MetricCard from "@/components/base/MetricCard";
import Tabs from "@/components/base/Tabs";
import CreditAdjustmentModal from "@/components/base/CreditAdjustmentModal";
import ConfirmationModal from "@/components/base/ConfirmationModal";
import {
  userProjects,
  userCreditTransactions,
  userApiUsages,
  userAdminNotes,
} from "@/mocks/userDetail";
import type { UserProject, UserApiUsage } from "@/mocks/userDetail";

function ProjectStatusBadge({ status }: { status: UserProject["status"] }) {
  const { t } = useTranslation(["common"]);
  const map: Record<string, Parameters<typeof Badge>[0]["variant"]> = {
    Draft: "gray",
    Processing: "blue",
    Completed: "green",
    Error: "red",
  };
  const labelMap: Record<string, string> = {
    Draft: t("common:status_draft"),
    Processing: t("common:status_processing"),
    Completed: t("common:status_completed"),
    Error: t("common:status_error"),
  };
  return <Badge label={labelMap[status]} variant={map[status]} />;
}

function ApiStatusBadge({ status }: { status: UserApiUsage["status"] }) {
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

function TransactionTypeBadge({ type }: { type: string }) {
  const { t } = useTranslation(["credits"]);
  const map: Record<string, Parameters<typeof Badge>[0]["variant"]> = {
    subscription_grant: "blue",
    admin_grant: "indigo",
    admin_deduct: "red",
    asset_generation_consume: "orange",
    video_generation_consume: "orange",
    refund: "green",
    adjustment: "yellow",
  };
  const labelMap: Record<string, string> = {
    subscription_grant: t("credits:type_subscription_grant"),
    admin_grant: t("credits:type_admin_grant"),
    admin_deduct: t("credits:type_admin_deduct"),
    asset_generation_consume: t("credits:type_asset_consume"),
    video_generation_consume: t("credits:type_video_consume"),
    refund: t("credits:type_refund"),
    adjustment: t("credits:type_adjustment"),
  };
  return <Badge label={labelMap[type] || type} variant={map[type] || "gray"} />;
}

export default function UserDetailPage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation(["common", "userDetail"]);
  const [grantOpen, setGrantOpen] = useState(false);
  const [deductOpen, setDeductOpen] = useState(false);
  const [disableConfirmOpen, setDisableConfirmOpen] = useState(false);
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false);
  const [userStatus, setUserStatus] = useState("Normal");
  const [creditBalance, setCreditBalance] = useState(45000);

  const handleGrantCredits = (amount: number) => {
    setCreditBalance((prev) => prev + amount);
  };

  const handleDeductCredits = (amount: number) => {
    setCreditBalance((prev) => Math.max(0, prev - amount));
  };

  return (
    <div className="space-y-4">
      {/* Back + User Header */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate("/users")}
          className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-gray-100 text-gray-500"
        >
          <i className="ri-arrow-left-line text-sm" />
        </button>
        <span className="text-sm text-gray-500">{t("userDetail:back_to_users")}</span>
        <span className="text-sm text-gray-400">/</span>
        <span className="text-sm font-medium text-gray-900">{userId || "USR-10001"}</span>
      </div>

      {/* User Info Card */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 flex items-center justify-center rounded-full bg-indigo-100 flex-shrink-0">
              <i className="ri-user-line text-indigo-600 text-lg" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-base font-semibold text-gray-900">marketing@bigbrand.com</h2>
                <Badge label={t("common:status_normal")} variant="green" />
                <Badge label={t("common:subscription_paid")} variant="blue" />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1 text-xs text-gray-500">
                <div>
                  <span className="text-gray-400">{t("userDetail:user_id")}: </span>
                  <span className="font-mono text-gray-700">{userId || "USR-10001"}</span>
                </div>
                <div>
                  <span className="text-gray-400">{t("userDetail:username")}: </span>
                  <span className="text-gray-700">bigbrand_mkt</span>
                </div>
                <div>
                  <span className="text-gray-400">{t("userDetail:registered")}: </span>
                  <span className="text-gray-700">2026-01-15 09:30</span>
                </div>
                <div>
                  <span className="text-gray-400">{t("userDetail:last_login")}: </span>
                  <span className="text-gray-700">2026-05-09 14:20</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setGrantOpen(true)}
              className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg flex items-center gap-1.5 whitespace-nowrap"
            >
              <span className="w-3.5 h-3.5 flex items-center justify-center">
                <i className="ri-add-circle-line text-xs" />
              </span>
              {t("userDetail:action_grant")}
            </button>
            <button
              onClick={() => setDeductOpen(true)}
              className="px-3 py-1.5 text-xs font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg flex items-center gap-1.5 whitespace-nowrap"
            >
              <span className="w-3.5 h-3.5 flex items-center justify-center">
                <i className="ri-subtract-line text-xs" />
              </span>
              {t("userDetail:action_deduct")}
            </button>
            {userStatus === "Normal" ? (
              <button
                onClick={() => setDisableConfirmOpen(true)}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg flex items-center gap-1.5 whitespace-nowrap"
              >
                <span className="w-3.5 h-3.5 flex items-center justify-center">
                  <i className="ri-forbid-line text-xs" />
                </span>
                {t("userDetail:action_disable")}
              </button>
            ) : (
              <button
                onClick={() => setRestoreConfirmOpen(true)}
                className="px-3 py-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg flex items-center gap-1.5 whitespace-nowrap"
              >
                <span className="w-3.5 h-3.5 flex items-center justify-center">
                  <i className="ri-check-double-line text-xs" />
                </span>
                {t("userDetail:action_restore")}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard label={t("userDetail:total_projects")} value="156" icon="ri-folder-line" />
        <MetricCard label={t("userDetail:total_assets")} value="890" icon="ri-image-line" />
        <MetricCard label={t("userDetail:total_videos")} value="312" icon="ri-video-line" />
        <MetricCard label={t("userDetail:credits_granted")} value="125,000" icon="ri-coin-line" />
        <MetricCard label={t("userDetail:credits_consumed")} value="78,900" icon="ri-coins-line" />
        <MetricCard label={t("userDetail:api_cost")} value="$2,450.80" icon="ri-money-cny-box-line" />
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg border border-gray-200">
        <Tabs
          tabs={[
            { key: "projects", label: t("userDetail:tab_projects") },
            { key: "transactions", label: t("userDetail:tab_transactions") },
            { key: "api", label: t("userDetail:tab_api") },
            { key: "notes", label: t("userDetail:tab_notes") },
          ]}
        >
          {(activeTab) => (
            <div className="px-4 pb-4">
              {activeTab === "projects" && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">{t("userDetail:project_id")}</th>
                        <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">{t("userDetail:project_name")}</th>
                        <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">{t("userDetail:current_step")}</th>
                        <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">{t("userDetail:status")}</th>
                        <th className="text-right px-3 py-2.5 text-xs font-medium text-gray-500">{t("userDetail:assets")}</th>
                        <th className="text-right px-3 py-2.5 text-xs font-medium text-gray-500">{t("userDetail:videos")}</th>
                        <th className="text-right px-3 py-2.5 text-xs font-medium text-gray-500">{t("userDetail:credits_used")}</th>
                        <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">{t("userDetail:updated_at")}</th>
                        <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">{t("userDetail:action")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {userProjects.map((p) => (
                        <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                          <td className="px-3 py-2.5 text-xs font-mono text-gray-700">{p.id}</td>
                          <td className="px-3 py-2.5 text-xs text-gray-900 font-medium">{p.name}</td>
                          <td className="px-3 py-2.5 text-xs text-gray-600">{p.currentStep}</td>
                          <td className="px-3 py-2.5"><ProjectStatusBadge status={p.status} /></td>
                          <td className="px-3 py-2.5 text-xs text-gray-600 text-right">{p.assets}</td>
                          <td className="px-3 py-2.5 text-xs text-gray-600 text-right">{p.videos}</td>
                          <td className="px-3 py-2.5 text-xs text-gray-900 font-medium text-right">{p.creditsUsed.toLocaleString()}</td>
                          <td className="px-3 py-2.5 text-xs text-gray-500">{p.updatedAt}</td>
                          <td className="px-3 py-2.5">
                            <button
                              onClick={() => navigate(`/projects/${p.id}`)}
                              className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-gray-100 text-gray-500"
                            >
                              <i className="ri-eye-line text-xs" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === "transactions" && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">{t("userDetail:transaction_id")}</th>
                        <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">{t("userDetail:transaction_type")}</th>
                        <th className="text-right px-3 py-2.5 text-xs font-medium text-gray-500">{t("userDetail:amount")}</th>
                        <th className="text-right px-3 py-2.5 text-xs font-medium text-gray-500">{t("userDetail:balance_before")}</th>
                        <th className="text-right px-3 py-2.5 text-xs font-medium text-gray-500">{t("userDetail:balance_after")}</th>
                        <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">{t("userDetail:related_object")}</th>
                        <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">{t("userDetail:operator")}</th>
                        <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">{t("userDetail:note")}</th>
                        <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">{t("userDetail:created_at")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {userCreditTransactions.map((t2) => (
                        <tr key={t2.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                          <td className="px-3 py-2.5 text-xs font-mono text-gray-700">{t2.id}</td>
                          <td className="px-3 py-2.5"><TransactionTypeBadge type={t2.type} /></td>
                          <td className={`px-3 py-2.5 text-xs font-medium text-right ${t2.amount > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                            {t2.amount > 0 ? "+" : ""}{t2.amount.toLocaleString()}
                          </td>
                          <td className="px-3 py-2.5 text-xs text-gray-600 text-right">{t2.balanceBefore.toLocaleString()}</td>
                          <td className="px-3 py-2.5 text-xs text-gray-900 font-medium text-right">{t2.balanceAfter.toLocaleString()}</td>
                          <td className="px-3 py-2.5 text-xs text-gray-600 font-mono">{t2.relatedObject}</td>
                          <td className="px-3 py-2.5 text-xs text-gray-600">{t2.operator}</td>
                          <td className="px-3 py-2.5 text-xs text-gray-600 max-w-[150px] truncate" title={t2.note}>{t2.note}</td>
                          <td className="px-3 py-2.5 text-xs text-gray-500">{t2.createdAt}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === "api" && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">{t("userDetail:api_id")}</th>
                        <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">{t("userDetail:provider")}</th>
                        <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">{t("userDetail:business_type")}</th>
                        <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">{t("userDetail:model")}</th>
                        <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">{t("userDetail:api_status")}</th>
                        <th className="text-right px-3 py-2.5 text-xs font-medium text-gray-500">{t("userDetail:cost")}</th>
                        <th className="text-right px-3 py-2.5 text-xs font-medium text-gray-500">{t("userDetail:duration")}</th>
                        <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">{t("userDetail:created_at")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {userApiUsages.map((api) => (
                        <tr key={api.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                          <td className="px-3 py-2.5 text-xs font-mono text-gray-700">{api.id}</td>
                          <td className="px-3 py-2.5 text-xs text-gray-600">{api.provider}</td>
                          <td className="px-3 py-2.5 text-xs text-gray-600 font-mono">{api.businessType}</td>
                          <td className="px-3 py-2.5 text-xs text-gray-600">{api.model}</td>
                          <td className="px-3 py-2.5"><ApiStatusBadge status={api.status} /></td>
                          <td className="px-3 py-2.5 text-xs text-gray-900 font-medium text-right">{api.cost}</td>
                          <td className="px-3 py-2.5 text-xs text-gray-600 text-right">{api.duration}</td>
                          <td className="px-3 py-2.5 text-xs text-gray-500">{api.createdAt}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === "notes" && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">{t("userDetail:operator")}</th>
                        <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">{t("userDetail:action")}</th>
                        <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">{t("userDetail:before")}</th>
                        <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">{t("userDetail:after")}</th>
                        <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">{t("userDetail:reason")}</th>
                        <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">{t("userDetail:created_at")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {userAdminNotes.map((note, idx) => (
                        <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50/50">
                          <td className="px-3 py-2.5 text-xs text-gray-600">{note.operator}</td>
                          <td className="px-3 py-2.5 text-xs text-gray-900 font-medium">{note.action}</td>
                          <td className="px-3 py-2.5 text-xs text-gray-500">{note.before}</td>
                          <td className="px-3 py-2.5 text-xs text-gray-700">{note.after}</td>
                          <td className="px-3 py-2.5 text-xs text-gray-600">{note.reason}</td>
                          <td className="px-3 py-2.5 text-xs text-gray-500">{note.createdAt}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </Tabs>
      </div>

      {/* Modals */}
      <CreditAdjustmentModal
        isOpen={grantOpen}
        onClose={() => setGrantOpen(false)}
        type="grant"
        userEmail="marketing@bigbrand.com"
        currentBalance={creditBalance}
        onSubmit={(amount, reason) => {
          handleGrantCredits(amount);
        }}
      />
      <CreditAdjustmentModal
        isOpen={deductOpen}
        onClose={() => setDeductOpen(false)}
        type="deduct"
        userEmail="marketing@bigbrand.com"
        currentBalance={creditBalance}
        onSubmit={(amount, reason) => {
          handleDeductCredits(amount);
        }}
      />
      <ConfirmationModal
        isOpen={disableConfirmOpen}
        onClose={() => setDisableConfirmOpen(false)}
        onConfirm={() => {
          setUserStatus("Disabled");
          setDisableConfirmOpen(false);
        }}
        title={t("userDetail:modal_disable_title")}
        message={t("userDetail:modal_disable_message")}
        confirmLabel={t("userDetail:modal_disable_confirm")}
        confirmVariant="danger"
      />
      <ConfirmationModal
        isOpen={restoreConfirmOpen}
        onClose={() => setRestoreConfirmOpen(false)}
        onConfirm={() => {
          setUserStatus("Normal");
          setRestoreConfirmOpen(false);
        }}
        title={t("userDetail:modal_restore_title")}
        message={t("userDetail:modal_restore_message")}
        confirmLabel={t("userDetail:modal_restore_confirm")}
        confirmVariant="primary"
      />
    </div>
  );
}