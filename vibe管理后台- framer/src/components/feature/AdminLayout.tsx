import { Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Sidebar from "@/components/feature/Sidebar";
import Header from "@/components/feature/Header";

const pageTitleKeys: Record<string, string> = {
  "/": "dashboard:page_title",
  "/users": "users:page_title",
  "/projects": "projects:page_title",
  "/api-logs": "apiLogs:page_title",
  "/credits": "credits:page_title",
  "/admin-logs": "adminLogs:page_title",
  "/settings": "settings:page_title",
};

export default function AdminLayout() {
  const location = useLocation();
  const { t } = useTranslation();

  const exactKey = pageTitleKeys[location.pathname];
  let title: string;
  if (exactKey) {
    title = t(exactKey);
  } else if (location.pathname.startsWith("/users/")) {
    title = t("userDetail:page_title");
  } else if (location.pathname.startsWith("/projects/")) {
    title = t("projectDetail:page_title");
  } else {
    title = t("dashboard:page_title");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <div className="ml-56 min-h-screen">
        <Header title={title} />
        <main className="p-5">
          <Outlet />
        </main>
      </div>
    </div>
  );
}