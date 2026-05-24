import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useEffect, useState } from 'react';
import { AdminLocaleProvider, useAdminLocale } from '../../contexts/AdminLocaleContext';

const nav = [
  { to: '/admin', key: 'dashboard', icon: 'ri-dashboard-line', end: true },
  { to: '/admin/users', key: 'users', icon: 'ri-user-3-line' },
  { to: '/admin/projects', key: 'projects', icon: 'ri-folder-line' },
  { to: '/admin/api-logs', key: 'apiLogs', icon: 'ri-server-line' },
  { to: '/admin/credits', key: 'credits', icon: 'ri-coin-line' },
  { to: '/admin/logs', key: 'adminLogs', icon: 'ri-shield-check-line' },
  { to: '/admin/model-config', key: 'modelConfig', icon: 'ri-robot-2-line' },
  { to: '/admin/settings', key: 'settings', icon: 'ri-settings-3-line' },
];

const mobileNavGroups = [
  { label: '常用', items: nav.slice(0, 4) },
  { label: '财务', items: nav.slice(4, 5) },
  { label: '审计', items: nav.slice(5, 6) },
  { label: '系统', items: nav.slice(6) },
];

function titleKeyFromPath(pathname: string): string {
  if (pathname === '/admin') return 'dashboard';
  if (pathname.startsWith('/admin/users')) return 'users';
  if (pathname.startsWith('/admin/projects')) return 'projects';
  if (pathname.startsWith('/admin/api-logs')) return 'apiLogs';
  if (pathname.startsWith('/admin/credits')) return 'credits';
  if (pathname.startsWith('/admin/logs')) return 'adminLogs';
  if (pathname.startsWith('/admin/model-config')) return 'modelConfig';
  if (pathname.startsWith('/admin/settings')) return 'settings';
  return 'admin';
}

function AdminLayoutInner() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const { locale, toggleLocale, t } = useAdminLocale();
  const title = t(titleKeyFromPath(location.pathname));
  const [timeRange, setTimeRange] = useState('Today');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileMenuOpen]);

  const handleLogout = () => {
    logout();
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <aside className="fixed left-0 top-0 z-50 hidden h-screen w-56 flex-col bg-slate-900 text-white lg:flex">
        <div className="flex h-14 items-center border-b border-slate-700/50 px-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
            <i className="ri-film-line text-sm text-white" />
          </div>
          <span className="ml-3 truncate text-sm font-semibold tracking-tight">Vibe Clip Admin</span>
        </div>
        <nav className="flex-1 space-y-1 px-2 py-3">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center rounded-lg px-3 py-2.5 text-sm transition ${
                  isActive ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`
              }
            >
              <span className="flex h-5 w-5 items-center justify-center">
                <i className={`${item.icon} text-base`} />
              </span>
              <span className="ml-3">{t(item.key)}</span>
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-700/50 px-3 py-3 text-xs text-slate-400">
          <div className="truncate text-sm text-slate-200">{user?.email}</div>
          <button type="button" onClick={handleLogout} className="mt-3 w-full rounded-lg border border-slate-600 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800">
            {t('logout')}
          </button>
        </div>
      </aside>

      <div className="min-h-screen lg:ml-56">
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-gray-200 bg-white px-3 sm:px-4 lg:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white lg:hidden"
              aria-label="打开后台导航"
            >
              <i className="ri-menu-2-line text-lg" />
            </button>
            <div className="min-w-0">
              <p className="hidden text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400 sm:block lg:hidden">Admin</p>
              <h1 className="truncate text-base font-semibold text-gray-900">{title}</h1>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 lg:gap-3">
            <div className="hidden items-center rounded-lg bg-gray-100 p-0.5 md:flex">
              {['Today', '7D', '30D', 'Custom'].map((item) => (
                <button
                  key={item}
                  onClick={() => setTimeRange(item)}
                  className={`rounded-md px-3 py-1 text-xs font-medium ${timeRange === item ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  {item === 'Today' ? t('today') : item === '7D' ? t('day7') : item === '30D' ? t('day30') : t('custom')}
                </button>
              ))}
            </div>
            <div className="relative hidden md:block">
              <i className="ri-search-line pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-gray-400" />
              <input className="w-52 rounded-lg border border-gray-200 bg-gray-50 py-1.5 pl-8 pr-3 text-xs" placeholder={t('searchPlaceholder')} />
            </div>
            <button
              onClick={toggleLocale}
              className="rounded-md bg-gray-100 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200 sm:px-2 sm:py-1"
            >
              {locale === 'zh' ? 'EN' : '中'}
            </button>
            <button className="hidden h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-600 sm:flex">
              <i className="ri-notification-3-line text-sm" />
            </button>
            <div className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-gray-50 sm:px-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-600">
                {(user?.name || user?.email || '?').slice(0, 1).toUpperCase()}
              </div>
              <span className="hidden text-xs font-medium text-gray-700 sm:block">{t('admin')}</span>
            </div>
          </div>
        </header>
        <main className="p-3 pb-5 sm:p-4 sm:pb-6 lg:p-5">
          <Outlet />
        </main>
      </div>

      <div className={`fixed inset-0 z-[70] lg:hidden ${mobileMenuOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
        <button
          type="button"
          className={`absolute inset-0 bg-slate-950/45 transition-opacity ${mobileMenuOpen ? 'opacity-100' : 'opacity-0'}`}
          aria-label="关闭后台导航"
          onClick={() => setMobileMenuOpen(false)}
        />
        <aside
          className={`absolute left-0 top-0 flex h-full w-[82vw] max-w-[320px] flex-col bg-slate-950 text-white shadow-2xl transition-transform duration-200 ${
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex h-14 items-center justify-between border-b border-white/10 px-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600">
                <i className="ri-film-line text-sm text-white" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold tracking-tight">Vibe Clip Admin</p>
                <p className="mt-0.5 truncate text-[11px] text-slate-400">{user?.email || t('admin')}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white"
              aria-label="关闭后台导航"
            >
              <i className="ri-close-line text-xl" />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-4">
            {mobileNavGroups.map((group) => (
              <div key={group.label} className="mb-5 last:mb-0">
                <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{group.label}</p>
                <div className="space-y-1">
                  {group.items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) =>
                        `flex items-center rounded-xl px-3 py-3 text-sm font-medium transition ${
                          isActive ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white'
                        }`
                      }
                    >
                      <span className="flex h-5 w-5 items-center justify-center">
                        <i className={`${item.icon} text-lg`} />
                      </span>
                      <span className="ml-3">{t(item.key)}</span>
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}
          </nav>

          <div className="border-t border-white/10 px-4 pb-[calc(env(safe-area-inset-bottom)+14px)] pt-3">
            <button
              type="button"
              onClick={handleLogout}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-700 text-sm font-semibold text-slate-200 hover:bg-white/10"
            >
              <i className="ri-logout-box-r-line text-base" />
              {t('logout')}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

export function AdminLayout() {
  return (
    <AdminLocaleProvider>
      <AdminLayoutInner />
    </AdminLocaleProvider>
  );
}
