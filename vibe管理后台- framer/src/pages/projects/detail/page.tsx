import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Badge from "@/components/base/Badge";
import MetricCard from "@/components/base/MetricCard";
import Tabs from "@/components/base/Tabs";
import StepProgress from "@/components/base/StepProgress";
import {
  projectSteps,
  projectAssets,
  projectVideos,
  projectApiLogs,
  projectErrors,
  projectSettings,
} from "@/mocks/projectDetail";
import type { ProjectAsset, ProjectVideo, ProjectApiLog, ProjectError } from "@/mocks/projectDetail";

function AssetStatusBadge({ status }: { status: ProjectAsset["status"] }) {
  const { t } = useTranslation(["common"]);
  const map: Record<string, Parameters<typeof Badge>[0]["variant"]> = {
    Ready: "green",
    Processing: "yellow",
    Error: "red",
  };
  const labelMap: Record<string, string> = {
    Ready: t("common:status_ready"),
    Processing: t("common:status_processing"),
    Error: t("common:status_error"),
  };
  return <Badge label={labelMap[status]} variant={map[status]} />;
}

function VideoStatusBadge({ status }: { status: ProjectVideo["status"] }) {
  const { t } = useTranslation(["common"]);
  const map: Record<string, Parameters<typeof Badge>[0]["variant"]> = {
    Ready: "green",
    Processing: "yellow",
    Error: "red",
  };
  const labelMap: Record<string, string> = {
    Ready: t("common:status_ready"),
    Processing: t("common:status_processing"),
    Error: t("common:status_error"),
  };
  return <Badge label={labelMap[status]} variant={map[status]} />;
}

function ApiStatusBadge({ status }: { status: ProjectApiLog["status"] }) {
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

function ErrorStatusBadge({ status }: { status: ProjectError["status"] }) {
  const { t } = useTranslation(["common"]);
  const map: Record<string, Parameters<typeof Badge>[0]["variant"]> = {
    Resolved: "green",
    Pending: "yellow",
    Critical: "red",
  };
  const labelMap: Record<string, string> = {
    Resolved: t("common:status_resolved"),
    Pending: t("common:status_pending"),
    Critical: t("common:status_critical"),
  };
  return <Badge label={labelMap[status]} variant={map[status]} />;
}

export default function ProjectDetailPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation(["common", "projectDetail"]);
  const [currentStep, setCurrentStep] = useState("S3");

  return (
    <div className="space-y-4">
      {/* Back + Project Header */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate("/projects")}
          className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-gray-100 text-gray-500"
        >
          <i className="ri-arrow-left-line text-sm" />
        </button>
        <span className="text-sm text-gray-500">{t("projectDetail:back_to_projects")}</span>
        <span className="text-sm text-gray-400">/</span>
        <span className="text-sm font-medium text-gray-900">{projectId || "PRJ-2026001"}</span>
      </div>

      {/* Project Info Card */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-base font-semibold text-gray-900">Summer Sale Promo</h2>
              <Badge label={t("common:status_processing")} variant="blue" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1 text-xs text-gray-500">
              <div>
                <span className="text-gray-400">{t("projectDetail:project_id")}: </span>
                <span className="font-mono text-gray-700">{projectId || "PRJ-2026001"}</span>
              </div>
              <div>
                <span className="text-gray-400">{t("projectDetail:user")}: </span>
                <span className="text-gray-700">marketing@bigbrand.com</span>
              </div>
              <div>
                <span className="text-gray-400">{t("projectDetail:created_at")}: </span>
                <span className="text-gray-700">2026-05-09 08:30</span>
              </div>
              <div>
                <span className="text-gray-400">{t("projectDetail:updated_at")}: </span>
                <span className="text-gray-700">2026-05-09 14:20</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg flex items-center gap-1.5 whitespace-nowrap">
              <span className="w-3.5 h-3.5 flex items-center justify-center">
                <i className="ri-restart-line text-xs" />
              </span>
              {t("projectDetail:retry_step")}
            </button>
          </div>
        </div>

        {/* Step Progress */}
        <StepProgress steps={projectSteps} />
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label={t("projectDetail:current_step")} value={currentStep} icon="ri-stack-line" />
        <MetricCard label={t("projectDetail:status")} value={t("common:status_processing")} icon="ri-loader-2-line" />
        <MetricCard label={t("projectDetail:credits_used")} value="4,500" icon="ri-coin-line" />
        <MetricCard label={t("projectDetail:api_cost")} value="$0.89" icon="ri-money-cny-box-line" />
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg border border-gray-200">
        <Tabs
          tabs={[
            { key: "overview", label: t("projectDetail:tab_overview") },
            { key: "assets", label: t("projectDetail:tab_assets") },
            { key: "videos", label: t("projectDetail:tab_videos") },
            { key: "api", label: t("projectDetail:tab_api") },
            { key: "errors", label: t("projectDetail:tab_errors") },
          ]}
        >
          {(activeTab) => (
            <div className="px-4 pb-4">
              {activeTab === "overview" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(projectSettings).map(([key, value]) => (
                    <div key={key} className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">
                        {t(`projectDetail:overview_${key}`)}
                      </p>
                      <p className="text-sm text-gray-900 font-medium">{value}</p>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === "assets" && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">{t("projectDetail:asset_id")}</th>
                        <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">{t("projectDetail:asset_type")}</th>
                        <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">{t("projectDetail:asset_preview")}</th>
                        <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">{t("projectDetail:asset_status")}</th>
                        <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">{t("projectDetail:asset_prompt")}</th>
                        <th className="text-right px-3 py-2.5 text-xs font-medium text-gray-500">{t("projectDetail:asset_credits")}</th>
                        <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">{t("projectDetail:asset_created")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {projectAssets.map((a) => (
                        <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                          <td className="px-3 py-2.5 text-xs font-mono text-gray-700">{a.id}</td>
                          <td className="px-3 py-2.5 text-xs text-gray-600">{a.type}</td>
                          <td className="px-3 py-2.5 text-xs text-gray-900 font-medium">{a.preview}</td>
                          <td className="px-3 py-2.5"><AssetStatusBadge status={a.status} /></td>
                          <td className="px-3 py-2.5 text-xs text-gray-600 max-w-[200px] truncate" title={a.prompt}>{a.prompt}</td>
                          <td className="px-3 py-2.5 text-xs text-gray-900 font-medium text-right">{a.creditsUsed}</td>
                          <td className="px-3 py-2.5 text-xs text-gray-500">{a.createdAt}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === "videos" && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">{t("projectDetail:video_id")}</th>
                        <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">{t("projectDetail:video_type")}</th>
                        <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">{t("projectDetail:video_preview")}</th>
                        <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">{t("projectDetail:video_status")}</th>
                        <th className="text-right px-3 py-2.5 text-xs font-medium text-gray-500">{t("projectDetail:video_duration")}</th>
                        <th className="text-right px-3 py-2.5 text-xs font-medium text-gray-500">{t("projectDetail:video_credits")}</th>
                        <th className="text-right px-3 py-2.5 text-xs font-medium text-gray-500">{t("projectDetail:video_api_cost")}</th>
                        <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">{t("projectDetail:video_error")}</th>
                        <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">{t("projectDetail:video_created")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {projectVideos.map((v) => (
                        <tr key={v.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                          <td className="px-3 py-2.5 text-xs font-mono text-gray-700">{v.id}</td>
                          <td className="px-3 py-2.5 text-xs text-gray-600">{v.type}</td>
                          <td className="px-3 py-2.5 text-xs text-gray-900 font-medium">{v.preview}</td>
                          <td className="px-3 py-2.5"><VideoStatusBadge status={v.status} /></td>
                          <td className="px-3 py-2.5 text-xs text-gray-600 text-right">{v.duration}</td>
                          <td className="px-3 py-2.5 text-xs text-gray-900 font-medium text-right">{v.creditsUsed}</td>
                          <td className="px-3 py-2.5 text-xs text-gray-900 font-medium text-right">{v.apiCost}</td>
                          <td className="px-3 py-2.5 text-xs text-rose-600 max-w-[150px] truncate">{v.error !== "-" ? v.error : "-"}</td>
                          <td className="px-3 py-2.5 text-xs text-gray-500">{v.createdAt}</td>
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
                        <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">{t("projectDetail:api_id")}</th>
                        <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">{t("projectDetail:provider")}</th>
                        <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">{t("projectDetail:business_type")}</th>
                        <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">{t("projectDetail:model")}</th>
                        <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">{t("projectDetail:api_status")}</th>
                        <th className="text-right px-3 py-2.5 text-xs font-medium text-gray-500">{t("projectDetail:cost")}</th>
                        <th className="text-right px-3 py-2.5 text-xs font-medium text-gray-500">{t("projectDetail:duration")}</th>
                        <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">{t("projectDetail:created_at")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {projectApiLogs.map((api) => (
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

              {activeTab === "errors" && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">{t("projectDetail:error_time")}</th>
                        <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">{t("projectDetail:error_step")}</th>
                        <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">{t("projectDetail:error_type")}</th>
                        <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">{t("projectDetail:error_message")}</th>
                        <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">{t("projectDetail:related_api")}</th>
                        <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">{t("projectDetail:error_status")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {projectErrors.map((err, idx) => (
                        <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50/50">
                          <td className="px-3 py-2.5 text-xs text-gray-500">{err.time}</td>
                          <td className="px-3 py-2.5 text-xs text-gray-600">{err.step}</td>
                          <td className="px-3 py-2.5 text-xs text-gray-900 font-medium">{err.errorType}</td>
                          <td className="px-3 py-2.5 text-xs text-rose-600">{err.errorMessage}</td>
                          <td className="px-3 py-2.5 text-xs text-gray-600 font-mono">{err.relatedApi}</td>
                          <td className="px-3 py-2.5"><ErrorStatusBadge status={err.status} /></td>
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
    </div>
  );
}