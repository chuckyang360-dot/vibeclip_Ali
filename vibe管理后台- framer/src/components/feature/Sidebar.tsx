import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

interface NavItem {
  labelKey: string;
  path: string;
  icon: string;
}

const navItems: NavItem[] = [
  { labelKey: "sidebar_dashboard", path: "/", icon: "ri-dashboard-line" },
  { labelKey: "sidebar_users", path: "/users", icon: "ri-user-3-line" },
  { labelKey: "sidebar_projects", path: "/projects", icon: "ri-folder-line" },
  { labelKey: "sidebar_apiLogs", path: "/api-logs", icon: "ri-server-line" },
  { labelKey: "sidebar_credits", path: "/credits", icon: "ri-coin-line" },
  { labelKey: "sidebar_adminLogs", path: "/admin-logs", icon: "ri-shield-check-line" },
  { labelKey: "sidebar_settings", path: "/settings", icon: "ri-settings-3-line" },
];

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation(["common"]);

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <aside className="fixed left-0 top-0 h-screen w-56 bg-slate-900 text-white flex flex-col z-50">
      <div className="h-14 flex items-center px-4 border-b border-slate-700/50">
        <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-indigo-600 flex-shrink-0">
          <i className="ri-film-line text-white text-sm" />
        </div>
        <span className="ml-3 text-sm font-semibold tracking-tight truncate">
          {t("common:sidebar_title")}
        </span>
      </div>

      <nav className="flex-1 py-3 px-2 space-y-1">
        {navItems.map((item) => {
          const active = isActive(item.path);
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center rounded-lg px-3 py-2.5 text-sm transition-colors whitespace-nowrap ${active ? "bg-indigo-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"}`}
            >
              <span className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                <i className={`${item.icon} text-base`} />
              </span>
              <span className="ml-3">{t(`common:${item.labelKey}`)}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}