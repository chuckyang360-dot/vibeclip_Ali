import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import * as api from '../services/api';
import type { AuthUser } from '../services/api';

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (data: { user: AuthUser; access_token: string }) => void;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const t = api.getToken();
    if (!t) return;
    try {
      const u = await api.fetchCurrentUser();
      setUser(u);
      api.setUser(u);
    } catch {
      setToken(null);
      setUser(null);
      api.removeToken();
      api.removeUser();
    }
  }, []);

  // Load auth state from localStorage on mount; refresh profile for role/status
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const storedToken = api.getToken();
      const storedUser = api.getUser();
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(storedUser);
        try {
          const u = await api.fetchCurrentUser();
          if (!cancelled) {
            setUser(u);
            api.setUser(u);
          }
        } catch {
          if (!cancelled) {
            setToken(null);
            setUser(null);
            api.removeToken();
            api.removeUser();
          }
        }
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback((data: { user: AuthUser; access_token: string }) => {
    setToken(data.access_token);
    setUser(data.user);
    api.setToken(data.access_token);
    api.setUser(data.user);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    api.removeToken();
    api.removeUser();
  }, []);

  const register = useCallback(async (name: string, email: string, password: string): Promise<void> => {
    const response = await api.register(name, email, password);
    login({ user: response.user, access_token: response.access_token });
  }, [login]);

  const contextValue = useMemo(
    () => ({ user, token, isAuthenticated: !!token, loading, login, register, logout, refreshUser }),
    [user, token, loading, login, register, logout, refreshUser],
  );

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
