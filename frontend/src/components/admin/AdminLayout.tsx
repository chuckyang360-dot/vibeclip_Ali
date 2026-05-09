import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const nav = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/users', label: 'Users' },
  { to: '/admin/projects', label: 'Projects' },
  { to: '/admin/api-logs', label: 'API Logs' },
  { to: '/admin/credits', label: 'Credits' },
  { to: '/admin/logs', label: 'Admin Logs' },
  { to: '/admin/settings', label: 'Settings' },
];

function titleFromPath(pathname: string): string {
  if (pathname === '/admin') return 'Dashboard';
  if (pathname.startsWith('/admin/users')) return 'Users';
  if (pathname.startsWith('/admin/projects')) return 'Projects';
  if (pathname.startsWith('/admin/api-logs')) return 'API Logs';
  if (pathname.startsWith('/admin/credits')) return 'Credits';
  if (pathname.startsWith('/admin/logs')) return 'Admin Logs';
  if (pathname.startsWith('/admin/settings')) return 'Settings';
  return 'Admin';
}

export function AdminLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const title = titleFromPath(location.pathname);

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100">
      <aside className="hidden w-64 flex-shrink-0 flex-col border-r border-white/10 bg-zinc-950/80 px-4 py-6 lg:flex">
        <div className="px-2 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Vibe Clip</div>
        <div className="mt-2 px-2 text-sm font-semibold text-white">Admin Console</div>
        <nav className="mt-8 flex flex-col gap-1">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `rounded-xl px-3 py-2 text-sm font-medium transition ${
                  isActive ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/20' : 'text-zinc-400 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto border-t border-white/10 pt-4 text-xs text-zinc-500">
          Signed in as
          <div className="mt-1 truncate text-sm text-zinc-200">{user?.email}</div>
          <button
            type="button"
            onClick={() => {
              logout();
              window.location.href = '/';
            }}
            className="mt-3 w-full rounded-lg border border-white/10 py-2 text-xs font-medium text-zinc-300 hover:bg-white/5"
          >
            Log out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 bg-zinc-950/70 px-4 py-4 backdrop-blur lg:px-8">
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">Overview</p>
            <h1 className="text-lg font-semibold text-white">{title}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="hidden rounded-full border border-white/10 bg-zinc-900/60 px-4 py-2 text-xs text-zinc-400 md:block">
              UTC+8 day boundaries (see API)
            </div>
            <div className="hidden rounded-full border border-white/10 bg-zinc-900/60 px-4 py-2 text-xs text-zinc-500 md:block">
              Search (visual)
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-xs font-bold text-white">
              {(user?.name || user?.email || '?').slice(0, 1).toUpperCase()}
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto px-4 py-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
