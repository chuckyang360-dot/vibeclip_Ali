import type { RouteObject } from "react-router-dom";
import NotFound from "@/pages/NotFound";
import AdminLayout from "@/components/feature/AdminLayout";
import DashboardPage from "@/pages/dashboard/page";
import UsersPage from "@/pages/users/page";
import UserDetailPage from "@/pages/users/detail/page";
import ProjectsPage from "@/pages/projects/page";
import ProjectDetailPage from "@/pages/projects/detail/page";
import ApiLogsPage from "@/pages/apiLogs/page";
import CreditsPage from "@/pages/credits/page";
import AdminLogsPage from "@/pages/adminLogs/page";
import SettingsPage from "@/pages/settings/page";

const routes: RouteObject[] = [
  {
    path: "/",
    element: <AdminLayout />,
    children: [
      { path: "/", element: <DashboardPage /> },
      { path: "/users", element: <UsersPage /> },
      { path: "/users/:userId", element: <UserDetailPage /> },
      { path: "/projects", element: <ProjectsPage /> },
      { path: "/projects/:projectId", element: <ProjectDetailPage /> },
      { path: "/api-logs", element: <ApiLogsPage /> },
      { path: "/credits", element: <CreditsPage /> },
      { path: "/admin-logs", element: <AdminLogsPage /> },
      { path: "/settings", element: <SettingsPage /> },
    ],
  },
  {
    path: "*",
    element: <NotFound />,
  },
];

export default routes;