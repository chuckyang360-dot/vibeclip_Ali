import { Routes, Route, Navigate } from 'react-router-dom';
import { AdminLayout } from './components/admin/AdminLayout';
import { AdminRouteGuard } from './components/admin/AdminRouteGuard';
import { AdminApiLogsPage } from './pages/admin/AdminApiLogsPage';
import { AdminCreditsPage } from './pages/admin/AdminCreditsPage';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminOperationLogsPage } from './pages/admin/AdminOperationLogsPage';
import { AdminProjectDetailPage } from './pages/admin/AdminProjectDetailPage';
import { AdminProjectsPage } from './pages/admin/AdminProjectsPage';
import { AdminSettingsPage } from './pages/admin/AdminSettingsPage';
import { AdminUserDetailPage } from './pages/admin/AdminUserDetailPage';
import { AdminUsersPage } from './pages/admin/AdminUsersPage';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import ShortDramaLandingPage from './pages/short-drama';
import { ShortDramaCreateProjectPage } from './pages/short-drama/CreateProjectPage';
import { ShortDramaProductInputPage } from './pages/short-drama/ProductInputPage';
import { ShortDramaProjectEntryPage } from './pages/short-drama/ProjectEntryPage';
import { ShortDramaProjectsPage } from './pages/short-drama/ProjectsPage';
import { ShortDramaStoryBlueprintPage } from './pages/short-drama/StoryBlueprintPage';
import { ShortDramaAssetsPage } from './pages/short-drama/AssetsPage';
import { ShortDramaStepFourPage } from './pages/short-drama/StepFourPage';
import { ShortDramaOverviewPage } from './pages/short-drama/OverviewPage';
import { AccountSettingsPage } from './pages/account/AccountSettingsPage';
import { PricingPage } from './pages/pricing/PricingPage';
import { BillingPage } from './pages/billing/BillingPage';
import { AuthProvider } from './contexts/AuthContext';

export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<ShortDramaLandingPage />} />
        <Route path="/workflow" element={<Navigate to="/#workflow" replace />} />
        <Route path="/cases" element={<Navigate to="/#cases" replace />} />
        <Route path="/short-drama" element={<Navigate to="/short-drama/projects" replace />} />
        <Route path="/short-drama/projects" element={<ShortDramaProjectsPage />} />
        <Route path="/short-drama/projects/:projectId" element={<ShortDramaProjectEntryPage />} />
        <Route path="/short-drama/projects/:projectId/step-1" element={<ShortDramaProductInputPage />} />
        <Route path="/short-drama/projects/:projectId/step-2" element={<ShortDramaStoryBlueprintPage />} />
        <Route path="/short-drama/projects/:projectId/step-3" element={<ShortDramaAssetsPage />} />
        <Route path="/short-drama/projects/:projectId/step-4" element={<ShortDramaStepFourPage />} />
        <Route path="/short-drama/projects/:projectId/overview" element={<ShortDramaOverviewPage />} />
        <Route path="/short-drama/create" element={<ShortDramaCreateProjectPage />} />
        <Route path="/short-drama/product-input" element={<ShortDramaProductInputPage />} />
        <Route path="/short-drama/story-blueprint" element={<ShortDramaStoryBlueprintPage />} />
        <Route path="/short-drama/assets" element={<ShortDramaAssetsPage />} />
        <Route path="/short-drama/step4" element={<ShortDramaStepFourPage />} />
        <Route path="/short-drama/overview" element={<ShortDramaOverviewPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/account/settings" element={<AccountSettingsPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/billing" element={<BillingPage />} />
        <Route
          path="/admin"
          element={
            <AdminRouteGuard>
              <AdminLayout />
            </AdminRouteGuard>
          }
        >
          <Route index element={<AdminDashboardPage />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="users/:id" element={<AdminUserDetailPage />} />
          <Route path="projects" element={<AdminProjectsPage />} />
          <Route path="projects/:id" element={<AdminProjectDetailPage />} />
          <Route path="api-logs" element={<AdminApiLogsPage />} />
          <Route path="credits" element={<AdminCreditsPage />} />
          <Route path="logs" element={<AdminOperationLogsPage />} />
          <Route path="settings" element={<AdminSettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
