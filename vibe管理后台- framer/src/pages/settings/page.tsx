import { useTranslation } from "react-i18next";

export default function SettingsPage() {
  const { t } = useTranslation(["common", "settings"]);

  return (
    <div className="space-y-4">
      {/* Credit Rules */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-indigo-50">
            <i className="ri-coin-line text-indigo-600 text-sm" />
          </div>
          <h2 className="text-sm font-semibold text-gray-900">{t("settings:credit_rules_title")}</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-400 mb-1">{t("settings:asset_cost")}</p>
            <p className="text-sm font-medium text-gray-900">{t("settings:credits_per_asset", { cost: 300 })}</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-400 mb-1">{t("settings:video_cost")}</p>
            <p className="text-sm font-medium text-gray-900">{t("settings:credits_per_video", { cost: 500 })}</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-400 mb-1">{t("settings:refund_policy")}</p>
            <p className="text-sm font-medium text-gray-900">{t("settings:auto_refund")}</p>
          </div>
        </div>
      </div>

      {/* API Providers */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-emerald-50">
            <i className="ri-server-line text-emerald-600 text-sm" />
          </div>
          <h2 className="text-sm font-semibold text-gray-900">{t("settings:api_providers_title")}</h2>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-sm text-gray-900 font-medium">{t("settings:xai")}</span>
              <span className="text-xs text-gray-500">{t("settings:xai_models")}</span>
            </div>
            <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              {t("settings:status_operational")}
            </span>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-sm text-gray-900 font-medium">{t("settings:gemini")}</span>
              <span className="text-xs text-gray-500">{t("settings:gemini_models")}</span>
            </div>
            <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              {t("settings:status_operational")}
            </span>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-sm text-gray-900 font-medium">{t("settings:r2")}</span>
              <span className="text-xs text-gray-500">{t("settings:r2_desc")}</span>
            </div>
            <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              {t("settings:status_operational")}
            </span>
          </div>
        </div>
      </div>

      {/* Admin Roles */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-amber-50">
            <i className="ri-shield-user-line text-amber-600 text-sm" />
          </div>
          <h2 className="text-sm font-semibold text-gray-900">{t("settings:admin_roles_title")}</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                {t("settings:role_super_admin")}
              </span>
            </div>
            <p className="text-xs text-gray-500">{t("settings:role_super_admin_desc")}</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                {t("settings:role_operator")}
              </span>
            </div>
            <p className="text-xs text-gray-500">{t("settings:role_operator_desc")}</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                {t("settings:role_viewer")}
              </span>
            </div>
            <p className="text-xs text-gray-500">{t("settings:role_viewer_desc")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}