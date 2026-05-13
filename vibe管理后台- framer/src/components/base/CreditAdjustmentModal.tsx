import { useState } from "react";
import { useTranslation } from "react-i18next";
import Modal from "./Modal";

interface CreditAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: "grant" | "deduct";
  userEmail: string;
  currentBalance: number;
  onSubmit: (amount: number, reason: string) => void;
}

export default function CreditAdjustmentModal({
  isOpen,
  onClose,
  type,
  userEmail,
  currentBalance,
  onSubmit,
}: CreditAdjustmentModalProps) {
  const { t } = useTranslation(["common", "userDetail"]);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  const handleSubmit = () => {
    const num = parseInt(amount, 10);
    if (num > 0 && reason.trim()) {
      onSubmit(num, reason.trim());
      setAmount("");
      setReason("");
      onClose();
    }
  };

  const title = type === "grant" ? t("userDetail:modal_grant_title") : t("userDetail:modal_deduct_title");
  const btnColor = type === "grant" ? "bg-indigo-600 hover:bg-indigo-700" : "bg-rose-600 hover:bg-rose-700";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 whitespace-nowrap"
          >
            {t("common:modal_cancel")}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!amount || !reason.trim()}
            className={`px-4 py-2 text-xs font-medium text-white rounded-lg whitespace-nowrap ${btnColor} disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {type === "grant" ? t("userDetail:modal_confirm_grant") : t("userDetail:modal_confirm_deduct")}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">{t("userDetail:modal_user_email")}</label>
          <input
            type="text"
            value={userEmail}
            disabled
            className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg text-gray-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">{t("userDetail:modal_current_balance")}</label>
          <input
            type="text"
            value={currentBalance.toLocaleString()}
            disabled
            className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg text-gray-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">{t("userDetail:modal_amount")}</label>
          <input
            type="number"
            min="1"
            placeholder={t("userDetail:modal_amount_placeholder")}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">{t("userDetail:modal_reason")}</label>
          <textarea
            placeholder={t("userDetail:modal_reason_placeholder")}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            rows={3}
            className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
          />
          <p className="text-xs text-gray-400 mt-1 text-right">{reason.length}/500</p>
        </div>
      </div>
    </Modal>
  );
}