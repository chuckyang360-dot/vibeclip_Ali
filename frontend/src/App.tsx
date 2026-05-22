import { Routes, Route, Navigate } from 'react-router-dom';
import { AdminLayout } from './components/admin/AdminLayout';
import { AdminRouteGuard } from './components/admin/AdminRouteGuard';
import { AdminApiLogsPage } from './pages/admin/AdminApiLogsPage';
import { AdminCreditsPage } from './pages/admin/AdminCreditsPage';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminModelConfigPage } from './pages/admin/AdminModelConfigPage';
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
import { BillingPage } from './pages/billing/BillingPage';
import { BillingPlansPage } from './pages/billing/BillingPlansPage';
import { BillingCheckoutPage } from './pages/billing/BillingCheckoutPage';
import { BillingSuccessPage } from './pages/billing/BillingSuccessPage';
import { BillingFailedPage } from './pages/billing/BillingFailedPage';
import { BillingProcessingPage } from './pages/billing/BillingProcessingPage';
import { BillingCreditsPage } from './pages/billing/BillingCreditsPage';
import { BillingResultPage } from './pages/billing/BillingResultPage';
import { SimplePlaceholderPage } from './pages/placeholders/SimplePlaceholderPage';
import { PricingPage } from './pages/pricing/PricingPage';
import { CaseDemoPage } from './pages/cases/CaseDemoPage';
import { AuthProvider } from './contexts/AuthContext';

export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<ShortDramaLandingPage />} />
        <Route path="/workflow" element={<Navigate to="/#workflow" replace />} />
        <Route path="/cases" element={<Navigate to="/#cases" replace />} />
        <Route path="/cases/:caseId" element={<CaseDemoPage />} />
        <Route path="/short-drama" element={<Navigate to="/short-drama/projects" replace />} />
        <Route path="/short-drama/projects" element={<ShortDramaProjectsPage />} />
        <Route path="/short-drama/projects/:projectId" element={<ShortDramaProjectEntryPage />} />
        <Route path="/short-drama/projects/:projectId/step-1" element={<ShortDramaProductInputPage />} />
        <Route path="/short-drama/projects/:projectId/step-2" element={<ShortDramaStoryBlueprintPage />} />
        <Route path="/short-drama/projects/:projectId/step-3" element={<ShortDramaAssetsPage />} />
        <Route path="/short-drama/projects/:projectId/step-4" element={<ShortDramaStepFourPage />} />
        <Route path="/short-drama/projects/:projectId/overview" element={<ShortDramaOverviewPage />} />
        <Route path="/projects" element={<ShortDramaProjectsPage />} />
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
        <Route path="/billing/plans" element={<BillingPlansPage />} />
        <Route path="/billing/checkout" element={<BillingCheckoutPage />} />
        <Route path="/billing/success" element={<BillingSuccessPage />} />
        <Route path="/billing/failed" element={<BillingFailedPage />} />
        <Route path="/billing/processing" element={<BillingProcessingPage />} />
        <Route path="/billing/result" element={<BillingResultPage />} />
        <Route path="/billing/credits" element={<BillingCreditsPage />} />
        <Route path="/help" element={<SimplePlaceholderPage title="帮助文档" />} />
        <Route path="/tutorials" element={<SimplePlaceholderPage title="使用教程" />} />
        <Route path="/faq" element={<SimplePlaceholderPage title="常见问题" />} />
        <Route path="/terms" element={<SimplePlaceholderPage title="服务协议" />} />
        <Route path="/privacy" element={<SimplePlaceholderPage title="隐私政策" />} />
        <Route
          path="/subscription-terms"
          element={<SimplePlaceholderPage title="订阅条款" />}
        />
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
          <Route path="model-config" element={<AdminModelConfigPage />} />
          <Route path="settings" element={<AdminSettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
