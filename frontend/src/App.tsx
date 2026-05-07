import { Routes, Route, Navigate } from 'react-router-dom';
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
import { AuthProvider } from './contexts/AuthContext';

export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/short-drama/projects" replace />} />
        <Route path="/short-drama" element={<ShortDramaLandingPage />} />
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
        <Route path="*" element={<Navigate to="/short-drama/projects" replace />} />
      </Routes>
    </AuthProvider>
  );
}
