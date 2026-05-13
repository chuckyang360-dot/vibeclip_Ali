import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import Badge from "@/components/base/Badge";
import MetricCard from "@/components/base/MetricCard";
import Tabs from "@/components/base/Tabs";
import CreditAdjustmentModal from "@/components/base/CreditAdjustmentModal";
import ConfirmationModal from "@/components/base/ConfirmationModal";
import { creditAccounts, creditTransactionsAll, creditStats } from "@/mocks/creditData";

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

export default function CreditsPage() {
  const { t } = useTranslation(["common", "credits"]);
  const [grantModalOpen, setGrantModalOpen] = useState(false);
  const [deductModalOpen, setDeductModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [searchAccount, setSearchAccount] = useState("");
  const [searchTxn, setSearchTxn] = useState("");
  const [manualAmount, setManualAmount] = useState("");
  const [manualReason, setManualReason] = useState("");
  const [manualAction, setManualAction] = useState<"grant" | "deduct">("grant");

  const filteredAccounts = useMemo(() => {
    if (!searchAccount) return creditAccounts;
    const q = searchAccount.toLowerCase();
    return creditAccounts.filter(
      (a) => a.user.toLowerCase().includes(q) || a.email.toLowerCase().includes(q)
    );
  }, [searchAccount]);

  const filteredTransactions = useMemo(() => {
    if (!searchTxn) return creditTransactionsAll;
    const q = searchTxn.toLowerCase();
    return creditTransactionsAll.filter(
      (t) =>
        t.user.toLowerCase().includes(q) ||
        t.email.toLowerCase().includes(q) ||
        t.type.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q)
    );
  }, [searchTxn]);

  const handleManualSubmit = () => {
    const amount = parseInt(manualAmount, 10);
    if (amount > 0 && manualReason.trim()) {
      setConfirmConfig({
        title: t("credits:confirm_title"),
        message: t(`credits:confirm_${manualAction}`, { amount: amount.toLocaleString(), reason: manualReason }),
        onConfirm: () => {
          setManualAmount("");
          setManualReason("");
          setConfirmOpen(false);
        },
      });
      setConfirmOpen(true);
    }
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard label={t("credits:total_granted")} value={creditStats.totalGranted.toLocaleString()} icon="ri-coin-line" />
        <MetricCard label={t("credits:total_consumed")} value={creditStats.totalConsumed.toLocaleString()} icon="ri-coins-line" />
        <MetricCard label={t("credits:total_refunded")} value={creditStats.totalRefunded.toLocaleString()} icon="ri-refund-2-line" />
        <MetricCard label={t("credits:current_balance_total")} value={creditStats.currentBalanceTotal.toLocaleString()} icon="ri-wallet-3-line" />
        <MetricCard label={t("credits:admin_adjustments_today")} value={creditStats.adminAdjustmentsToday.toString()} icon="ri-tools-line" />
        <MetricCard label={t("credits:consumed_today")} value={creditStats.creditsConsumedToday.toLocaleString()} icon="ri-fire-line" />
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg border border-gray-200">
        <Tabs
          tabs={[
            { key: "accounts", label: t("credits:tab_accounts") },
            { key: "transactions", label: t("credits:tab_transactions") },
            { key: "adjustment", label: t("credits:tab_adjustment") },
          ]}
        >
          {(activeTab) => (
            <div className="px-4 pb-4">
              {activeTab === "accounts" && (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <div className="relative max-w-sm">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center text-gray-400">
                        <i className="ri-search-line text-sm" />
                      </span>
                      <input
                        type="text"
                        placeholder={t("credits:accounts_search")}
                        value={searchAccount}
                        onChange={(e) => setSearchAccount(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      />
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">{t("credits:user")}</th>
                          <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">{t("credits:email")}</th>
                          <th className="text-right px-3 py-2.5 text-xs font-medium text-gray-500">{t("credits:current_balance")}</th>
                          <th className="text-right px-3 py-2.5 text-xs font-medium text-gray-500">{t("credits:total_granted")}</th>
                          <th className="text-right px-3 py-2.5 text-xs font-medium text-gray-500">{t("credits:total_consumed")}</th>
                          <th className="text-right px-3 py-2.5 text-xs font-medium text-gray-500">{t("credits:total_refunded")}</th>
                          <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">{t("credits:updated_at")}</th>
                          <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">{t("credits:actions")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAccounts.map((acc) => (
                          <tr key={acc.user} className="border-b border-gray-50 hover:bg-gray-50/50">
                            <td className="px-3 py-2.5 text-xs font-mono text-gray-700">{acc.user}</td>
                            <td className="px-3 py-2.5 text-xs text-gray-600">{acc.email}</td>
                            <td className="px-3 py-2.5 text-xs text-gray-900 font-medium text-right">{acc.currentBalance.toLocaleString()}</td>
                            <td className="px-3 py-2.5 text-xs text-gray-600 text-right">{acc.totalGranted.toLocaleString()}</td>
                            <td className="px-3 py-2.5 text-xs text-gray-600 text-right">{acc.totalConsumed.toLocaleString()}</td>
                            <td className="px-3 py-2.5 text-xs text-gray-600 text-right">{acc.totalRefunded.toLocaleString()}</td>
                            <td className="px-3 py-2.5 text-xs text-gray-500">{acc.updatedAt}</td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => { setSelectedUser(acc.user); setGrantModalOpen(true); }}
                                  className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-gray-100 text-gray-500"
                                  title={t("credits:tooltip_grant")}
                                >
                                  <i className="ri-add-circle-line text-xs text-indigo-600" />
                                </button>
                                <button
                                  onClick={() => { setSelectedUser(acc.user); setDeductModalOpen(true); }}
                                  className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-gray-100 text-gray-500"
                                  title={t("credits:tooltip_deduct")}
                                >
                                  <i className="ri-subtract-line text-xs text-rose-600" />
                                </button>
                                <button className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-gray-100 text-gray-500" title={t("credits:tooltip_view_txn")}>
                                  <i className="ri-eye-line text-xs" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {activeTab === "transactions" && (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <div className="relative max-w-sm">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center text-gray-400">
                        <i className="ri-search-line text-sm" />
                      </span>
                      <input
                        type="text"
                        placeholder={t("credits:txn_search")}
                        value={searchTxn}
                        onChange={(e) => setSearchTxn(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      />
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">{t("credits:transaction_id")}</th>
                          <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">{t("credits:user")}</th>
                          <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">{t("credits:transaction_type")}</th>
                          <th className="text-right px-3 py-2.5 text-xs font-medium text-gray-500">{t("credits:amount")}</th>
                          <th className="text-right px-3 py-2.5 text-xs font-medium text-gray-500">{t("credits:balance_before")}</th>
                          <th className="text-right px-3 py-2.5 text-xs font-medium text-gray-500">{t("credits:balance_after")}</th>
                          <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">{t("credits:related_object")}</th>
                          <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">{t("credits:operator")}</th>
                          <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">{t("credits:note")}</th>
                          <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">{t("credits:created_at")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTransactions.map((t2) => (
                          <tr key={t2.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                            <td className="px-3 py-2.5 text-xs font-mono text-gray-700">{t2.id}</td>
                            <td className="px-3 py-2.5 text-xs text-gray-600">{t2.user}</td>
                            <td className="px-3 py-2.5"><TransactionTypeBadge type={t2.type} /></td>
                            <td className={`px-3 py-2.5 text-xs font-medium text-right ${t2.amount > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                              {t2.amount > 0 ? "+" : ""}{t2.amount.toLocaleString()}
                            </td>
                            <td className="px-3 py-2.5 text-xs text-gray-600 text-right">{t2.balanceBefore.toLocaleString()}</td>
                            <td className="px-3 py-2.5 text-xs text-gray-900 font-medium text-right">{t2.balanceAfter.toLocaleString()}</td>
                            <td className="px-3 py-2.5 text-xs text-gray-600 font-mono">{t2.relatedObject}</td>
                            <td className="px-3 py-2.5 text-xs text-gray-600">{t2.operator}</td>
                            <td className="px-3 py-2.5 text-xs text-gray-600 max-w-[120px] truncate" title={t2.note}>{t2.note}</td>
                            <td className="px-3 py-2.5 text-xs text-gray-500">{t2.createdAt}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {activeTab === "adjustment" && (
                <div className="max-w-lg mx-auto">
                  <div className="bg-gray-50 rounded-lg p-5 border border-gray-200">
                    <h4 className="text-sm font-semibold text-gray-900 mb-4">{t("credits:adjustment_title")}</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">{t("credits:select_user")}</label>
                        <select className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500">
                          <option>user_8842 - marketing@bigbrand.com</option>
                          <option>user_1034 - admin@shopplus.com</option>
                          <option>user_5567 - creative@trendy.co</option>
                          <option>user_2201 - ops@megastore.io</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">{t("credits:current_balance")}</label>
                        <input
                          type="text"
                          value="45,000"
                          disabled
                          className="w-full px-3 py-2 text-sm bg-gray-100 border border-gray-200 rounded-lg text-gray-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">{t("credits:action")}</label>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setManualAction("grant")}
                            className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg border whitespace-nowrap ${manualAction === "grant" ? "bg-indigo-50 border-indigo-300 text-indigo-700" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                          >
                            {t("credits:action_grant")}
                          </button>
                          <button
                            onClick={() => setManualAction("deduct")}
                            className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg border whitespace-nowrap ${manualAction === "deduct" ? "bg-rose-50 border-rose-300 text-rose-700" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                          >
                            {t("credits:action_deduct")}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">{t("credits:amount")}</label>
                        <input
                          type="number"
                          min="1"
                          placeholder={t("credits:amount_placeholder")}
                          value={manualAmount}
                          onChange={(e) => setManualAmount(e.target.value)}
                          className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">{t("credits:reason")}</label>
                        <textarea
                          placeholder={t("credits:reason_placeholder")}
                          value={manualReason}
                          onChange={(e) => setManualReason(e.target.value)}
                          maxLength={500}
                          rows={3}
                          className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
                        />
                        <p className="text-xs text-gray-400 mt-1 text-right">{manualReason.length}/500</p>
                      </div>
                      <button
                        onClick={handleManualSubmit}
                        disabled={!manualAmount || !manualReason.trim()}
                        className={`w-full px-4 py-2.5 text-sm font-medium text-white rounded-lg whitespace-nowrap ${manualAction === "grant" ? "bg-indigo-600 hover:bg-indigo-700" : "bg-rose-600 hover:bg-rose-700"} disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {manualAction === "grant" ? t("credits:action_grant") : t("credits:action_deduct")}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </Tabs>
      </div>

      {/* Modals */}
      <CreditAdjustmentModal
        isOpen={grantModalOpen}
        onClose={() => setGrantModalOpen(false)}
        type="grant"
        userEmail={selectedUser ? creditAccounts.find(a => a.user === selectedUser)?.email || "" : ""}
        currentBalance={selectedUser ? creditAccounts.find(a => a.user === selectedUser)?.currentBalance || 0 : 0}
        onSubmit={(amount, reason) => console.log("Grant", selectedUser, amount, reason)}
      />
      <CreditAdjustmentModal
        isOpen={deductModalOpen}
        onClose={() => setDeductModalOpen(false)}
        type="deduct"
        userEmail={selectedUser ? creditAccounts.find(a => a.user === selectedUser)?.email || "" : ""}
        currentBalance={selectedUser ? creditAccounts.find(a => a.user === selectedUser)?.currentBalance || 0 : 0}
        onSubmit={(amount, reason) => console.log("Deduct", selectedUser, amount, reason)}
      />
      {confirmConfig && (
        <ConfirmationModal
          isOpen={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          onConfirm={confirmConfig.onConfirm}
          title={confirmConfig.title}
          message={confirmConfig.message}
          confirmLabel={t("common:action_confirm")}
          confirmVariant="danger"
        />
      )}
    </div>
  );
}