import { createContext, useContext, useMemo, useState } from 'react';
import { AdminLocale, tAdmin } from '../i18n/adminI18n';

const KEY = 'admin_locale';

type Ctx = {
  locale: AdminLocale;
  setLocale: (v: AdminLocale) => void;
  toggleLocale: () => void;
  t: (key: string) => string;
};

const AdminLocaleContext = createContext<Ctx | null>(null);

function getInitialLocale(): AdminLocale {
  const value = localStorage.getItem(KEY);
  return value === 'en' ? 'en' : 'zh';
}

export function AdminLocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<AdminLocale>(getInitialLocale);

  const setLocale = (v: AdminLocale) => {
    localStorage.setItem(KEY, v);
    setLocaleState(v);
  };

  const value = useMemo<Ctx>(
    () => ({
      locale,
      setLocale,
      toggleLocale: () => setLocale(locale === 'zh' ? 'en' : 'zh'),
      t: (key: string) => tAdmin(locale, key),
    }),
    [locale],
  );

  return <AdminLocaleContext.Provider value={value}>{children}</AdminLocaleContext.Provider>;
}

export function useAdminLocale() {
  const ctx = useContext(AdminLocaleContext);
  if (!ctx) {
    throw new Error('useAdminLocale must be used within AdminLocaleProvider');
  }
  return ctx;
}
