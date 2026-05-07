import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const displayName =
    (user as { username?: string } | null)?.username ||
    user?.name ||
    user?.email?.split('@')[0] ||
    '账号';

  const handleMenuNavigate = (path: string) => {
    setMenuOpen(false);
    navigate(path);
  };

  useEffect(() => {
    if (!menuOpen) return;
    const onClickOutside = (event: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [menuOpen]);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    setMenuOpen(false);
    logout();
    navigate('/');
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-16 border-b border-[#EAEAEA] bg-white shadow-[0_1px_8px_rgba(0,0,0,0.06)] transition-shadow duration-300 lg:h-[68px]">
      <div className="mx-auto flex h-full max-w-[1280px] items-center justify-between px-6 lg:px-10">
        <div className="flex min-w-0 items-center gap-3 shrink-0">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm font-bold">
              VC
            </div>
            <span className="text-xl font-bold text-gray-900 tracking-tight">VibeClip / 维播</span>
          </Link>
        </div>

        <nav className="flex items-center justify-center gap-2">
          <Link
            to="/"
            className={`rounded-lg px-3.5 py-1.5 text-[13.5px] font-medium ${
              location.pathname === '/'
                ? 'text-[#7B61FF] bg-[rgba(123,97,255,0.07)]'
                : 'text-[#444444] hover:bg-[#F7F8FA]'
            }`}
          >
            首页
          </Link>
          <Link
            to="/#workflow"
            className="rounded-lg px-3.5 py-1.5 text-[13.5px] font-medium text-[#444444] hover:bg-[#F7F8FA]"
          >
            流程
          </Link>
          <Link
            to="/#cases"
            className="rounded-lg px-3.5 py-1.5 text-[13.5px] font-medium text-[#444444] hover:bg-[#F7F8FA]"
          >
            案例
          </Link>
          <Link
            to="/short-drama/projects"
            className={`rounded-lg px-3.5 py-1.5 text-[13.5px] font-medium ${
              location.pathname.startsWith('/short-drama/projects')
                ? 'text-[#7B61FF] bg-[rgba(123,97,255,0.07)]'
                : 'text-[#444444] hover:bg-[#F7F8FA]'
            }`}
          >
            项目管理
          </Link>
        </nav>

        <div className="flex shrink-0 items-center gap-2.5">
          {isAuthenticated ? (
            <>
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setMenuOpen((v) => !v)}
                  className="flex h-9 max-w-[220px] items-center gap-2 rounded-lg border border-[#EAEAEA] px-3 text-[13px] font-medium text-[#111111] transition-colors hover:bg-[#F7F8FA]"
                >
                  <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[rgba(123,97,255,0.12)] text-[11px] font-semibold text-[#7B61FF]">
                    {displayName.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="truncate">{displayName}</span>
                  <span className={`ml-1 text-[10px] text-[#888888] transition-transform ${menuOpen ? 'rotate-180' : ''}`}>
                    ▼
                  </span>
                </button>

                {menuOpen ? (
                  <div className="absolute right-0 z-50 mt-2 w-[220px] rounded-xl border border-[#EAEAEA] bg-white p-1.5 shadow-md">
                    <button
                      type="button"
                      onClick={() => handleMenuNavigate('/short-drama/create')}
                      className="block w-full rounded-lg px-3 py-2 text-left text-[13px] text-[#444444] transition-colors hover:bg-[rgba(123,97,255,0.08)] hover:text-[#7B61FF]"
                    >
                      新建项目
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMenuNavigate('/short-drama/projects')}
                      className="block w-full rounded-lg px-3 py-2 text-left text-[13px] text-[#444444] transition-colors hover:bg-[rgba(123,97,255,0.08)] hover:text-[#7B61FF]"
                    >
                      项目管理
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMenuNavigate('/account/settings')}
                      className="block w-full rounded-lg px-3 py-2 text-left text-[13px] text-[#444444] transition-colors hover:bg-[rgba(123,97,255,0.08)] hover:text-[#7B61FF]"
                    >
                      账户设置
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMenuNavigate('/pricing')}
                      className="block w-full rounded-lg px-3 py-2 text-left text-[13px] text-[#444444] transition-colors hover:bg-[rgba(123,97,255,0.08)] hover:text-[#7B61FF]"
                    >
                      升级计划
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMenuNavigate('/billing')}
                      className="block w-full rounded-lg px-3 py-2 text-left text-[13px] text-[#444444] transition-colors hover:bg-[rgba(123,97,255,0.08)] hover:text-[#7B61FF]"
                    >
                      账单
                    </button>
                    <div className="my-1 border-t border-[#EAEAEA]" />
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="block w-full rounded-lg px-3 py-2 text-left text-[13px] text-red-500 transition-colors hover:bg-red-50"
                    >
                      退出登录
                    </button>
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="flex h-8 items-center rounded-lg border border-[#EAEAEA] px-3 text-[13px] leading-none text-[#666666] transition-colors hover:bg-[rgba(123,97,255,0.06)] hover:text-[#7B61FF]"
              >
                登录
              </Link>
              <Link
                to="/register"
                className="flex h-8 items-center rounded-lg px-3 text-[13px] font-medium leading-none text-white transition-colors"
                style={{ background: '#111827' }}
              >
                注册
              </Link>
              <Link
                to="/register"
                className="flex h-8 items-center rounded-lg border border-[#111827] px-3 text-[13px] font-medium leading-none text-[#111827] transition-colors hover:bg-[#111827] hover:text-white"
              >
                开始创建
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
