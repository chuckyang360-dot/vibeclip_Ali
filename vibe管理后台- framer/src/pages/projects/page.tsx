import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Badge from "@/components/base/Badge";
import { projects } from "@/mocks/projects";
import type { Project } from "@/mocks/projects";

function ProjectStatusBadge({ status }: { status: Project["status"] }) {
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

function StepBadge({ step }: { step: Project["currentStep"] }) {
  const colorMap: Record<string, string> = {
    S0: "bg-gray-100 text-gray-600",
    S1: "bg-sky-50 text-sky-700",
    S2: "bg-indigo-50 text-indigo-700",
    S3: "bg-violet-50 text-violet-700",
    S4: "bg-emerald-50 text-emerald-700",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${colorMap[step]}`}>
      {step}
    </span>
  );
}

export default function ProjectsPage() {
  const navigate = useNavigate();
  const { t } = useTranslation(["common", "projects"]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [stepFilter, setStepFilter] = useState("All");

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const matchSearch =
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.id.toLowerCase().includes(search.toLowerCase()) ||
        p.user.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "All" || p.status === statusFilter;
      const matchStep = stepFilter === "All" || p.currentStep === stepFilter;
      return matchSearch && matchStatus && matchStep;
    });
  }, [search, statusFilter, stepFilter]);

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
              placeholder={t("projects:search_placeholder")}
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
              <option value="Draft">{t("common:status_draft")}</option>
              <option value="Processing">{t("common:status_processing")}</option>
              <option value="Completed">{t("common:status_completed")}</option>
              <option value="Error">{t("common:status_error")}</option>
            </select>

            <select
              value={stepFilter}
              onChange={(e) => setStepFilter(e.target.value)}
              className="px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="All">{t("common:label_all_steps")}</option>
              <option value="S0">S0</option>
              <option value="S1">S1</option>
              <option value="S2">S2</option>
              <option value="S3">S3</option>
              <option value="S4">S4</option>
            </select>
          </div>
        </div>
      </div>

      {/* Projects Table */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">{t("projects:project_id")}</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">{t("projects:project_name")}</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">{t("projects:user")}</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">{t("projects:current_step")}</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">{t("projects:status")}</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500">{t("projects:assets")}</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500">{t("projects:videos")}</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500">{t("projects:credits_used")}</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500">{t("projects:api_calls")}</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">{t("projects:last_error")}</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">{t("projects:created_at")}</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">{t("projects:updated_at")}</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">{t("projects:actions")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects.map((project) => (
                <tr key={project.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-4 py-2.5 text-xs font-mono text-gray-700">
                    <button
                      onClick={() => navigate(`/projects/${project.id}`)}
                      className="text-indigo-600 hover:text-indigo-700 hover:underline"
                    >
                      {project.id}
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-900 font-medium">{project.name}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-600 font-mono">{project.user}</td>
                  <td className="px-4 py-2.5">
                    <StepBadge step={project.currentStep} />
                  </td>
                  <td className="px-4 py-2.5">
                    <ProjectStatusBadge status={project.status} />
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-600 text-right">{project.assets}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-600 text-right">{project.videos}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-900 font-medium text-right">
                    {project.creditsUsed.toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-600 text-right">{project.apiCalls}</td>
                  <td className="px-4 py-2.5 text-xs text-rose-600 max-w-xs truncate">{project.lastError !== "-" ? project.lastError : "-"}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{project.createdAt}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{project.updatedAt}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => navigate(`/projects/${project.id}`)}
                        className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-gray-100 text-gray-500"
                        title={t("projects:tooltip_view")}
                      >
                        <i className="ri-eye-line text-xs" />
                      </button>
                      <button className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-gray-100 text-gray-500" title={t("projects:tooltip_retry")}>
                        <i className="ri-restart-line text-xs" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredProjects.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-gray-400">{t("projects:no_projects")}</div>
        )}
      </div>
    </div>
  );
}