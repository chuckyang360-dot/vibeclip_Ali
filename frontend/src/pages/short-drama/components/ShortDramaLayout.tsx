import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { UserMenuDropdown } from '../../../components/UserMenuDropdown';
import { VibeClipLogo } from './VibeClipLogo';

type HeaderMode = 'landing' | 'workflow';

type ShortDramaLayoutProps = {
  children: ReactNode;
  /** landing: anchor links + primary CTA; workflow: minimal tool header */
  headerMode?: HeaderMode;
};

export function ShortDramaLayout({ children, headerMode: _headerMode = 'workflow' }: ShortDramaLayoutProps) {
  const { isAuthenticated } = useAuth();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-white text-[#1D1D1F]">
      <header
        className="fixed top-0 left-0 right-0 z-50 flex h-14 items-center justify-between px-6 transition-all duration-300 backdrop-blur-md lg:px-10"
        style={{
          background: scrolled ? 'rgba(255,255,255,0.98)' : 'rgba(255,255,255,0.82)',
          borderBottom: '1px solid #E5E5EA',
          boxShadow: scrolled ? '0 2px 12px rgba(0,0,0,0.06)' : '0 1px 0 rgba(0,0,0,0.04)',
        }}
      >
        <Link to="/" className="flex items-center gap-2 cursor-pointer group" style={{ textDecoration: 'none' }}>
          <VibeClipLogo />
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          <Link to="/" className="px-3.5 py-1.5 text-[13.5px] font-medium rounded-lg whitespace-nowrap bg-[#F5F5F7] text-[#1D1D1F]">
            首页
          </Link>
          <a href="/#workflow" className="px-3.5 py-1.5 text-[13.5px] font-medium rounded-lg whitespace-nowrap text-[#8E8E93] hover:bg-[#F5F5F7] hover:text-[#1D1D1F]" style={{ textDecoration: 'none' }}>
            流程
          </a>
          <a href="/#cases" className="px-3.5 py-1.5 text-[13.5px] font-medium rounded-lg whitespace-nowrap text-[#8E8E93] hover:bg-[#F5F5F7] hover:text-[#1D1D1F]" style={{ textDecoration: 'none' }}>
            案例
          </a>
          <Link to="/projects" className="px-3.5 py-1.5 text-[13.5px] font-medium rounded-lg whitespace-nowrap text-[#8E8E93] hover:bg-[#F5F5F7] hover:text-[#1D1D1F]">
            项目管理
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <UserMenuDropdown />
          ) : (
            <>
              <Link to="/login" className="px-3.5 py-1.5 text-[13px] font-medium rounded-lg text-[#444444] hover:bg-[#F5F5F7]">
                登录
              </Link>
              <Link to="/register" className="px-3.5 py-1.5 text-[13px] font-medium rounded-lg bg-[#1D1D1F] text-white">
                注册
              </Link>
            </>
          )}
        </div>
      </header>

      <div className="pt-14">{children}</div>
    </div>
  );
}
