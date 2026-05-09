import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { AdminLoadingState } from './AdminLoadingState';

function isAdminRole(role: string | undefined) {
  return role === 'admin' || role === 'super_admin';
}

export function AdminRouteGuard({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 p-8">
        <AdminLoadingState label="Checking access…" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!isAdminRole(user?.role)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-6 text-center">
        <p className="text-sm font-semibold text-white">403 — Admin access required</p>
        <p className="mt-2 max-w-md text-sm text-zinc-400">
          Your account does not have administrator privileges. If you believe this is a mistake, contact a super admin.
        </p>
        <a href="/" className="mt-6 text-sm font-medium text-violet-400 hover:text-violet-300">
          Back to home
        </a>
      </div>
    );
  }

  return <>{children}</>;
}
