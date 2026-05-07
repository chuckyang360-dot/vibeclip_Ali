import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { sdColors } from '../utils/shortDramaHelpers';
import { VibeClipLogo } from './VibeClipLogo';

type HeaderMode = 'landing' | 'workflow';

type ShortDramaLayoutProps = {
  children: ReactNode;
  /** landing: anchor links + primary CTA; workflow: minimal tool header */
  headerMode?: HeaderMode;
};

export function ShortDramaLayout({ children, headerMode: _headerMode = 'workflow' }: ShortDramaLayoutProps) {
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const displayName =
    (user as { username?: string } | null)?.username ||
    user?.name ||
    user?.email?.split('@')[0] ||
    '账号';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

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

  const handleMenuNavigate = (path: string) => {
    setMenuOpen(false);
    navigate(path);
  };

  const handleLogout = () => {
    setMenuOpen(false);
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-white" style={{ color: sdColors.ink }}>
      <header
        className="fixed top-0 left-0 right-0 z-50 flex h-[72px] items-center justify-between px-6 transition-all duration-300 backdrop-blur-md lg:px-10"
        style={{
          background: scrolled ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.86)',
          borderBottom: '1px solid rgba(0,0,0,0.06)',
          boxShadow: '0 8px 24px rgba(15, 23, 42, 0.04)',
        }}
      >
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex cursor-pointer items-center gap-2 rounded-lg text-left transition-transform hover:scale-[1.02]"
          >
            <VibeClipLogo />
          </button>
        </div>

        <nav className="hidden items-center gap-6 md:flex">
          <Link to="/" className="whitespace-nowrap text-[13px] font-medium text-[#8E8E93] transition-colors hover:text-[#1D1D1F]">
            首页
          </Link>
          <a href="/#workflow" className="whitespace-nowrap text-[13px] font-medium text-[#8E8E93] transition-colors hover:text-[#1D1D1F]">
            流程
          </a>
          <a href="/#cases" className="whitespace-nowrap text-[13px] font-medium text-[#8E8E93] transition-colors hover:text-[#1D1D1F]">
            案例
          </a>
          <Link
            to="/short-drama/projects"
            className="whitespace-nowrap text-[13px] font-medium text-[#8E8E93] transition-colors hover:text-[#1D1D1F]"
          >
            项目管理
          </Link>
        </nav>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
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
                className="whitespace-nowrap rounded-lg border border-[#EAEAEA] px-3 py-1.5 text-[13px] text-[#8E8E93] transition-colors hover:text-[#1D1D1F]"
              >
                登录
              </Link>
              <Link
                to="/register"
                className="whitespace-nowrap rounded-lg border border-[#EAEAEA] px-3 py-1.5 text-[13px] text-[#8E8E93] transition-colors hover:text-[#1D1D1F]"
              >
                注册
              </Link>
              <Link
                to="/register"
                className="whitespace-nowrap rounded-lg px-4 py-2 text-[13px] font-semibold text-white transition-colors"
                style={{ background: sdColors.ink }}
              >
                开始创建
              </Link>
            </>
          )}
        </div>
      </header>

      <div className="pt-[72px]">{children}</div>
    </div>
  );
}
