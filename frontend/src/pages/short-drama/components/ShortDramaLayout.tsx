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
  const isPublicLanding = _headerMode === 'landing' && !isAuthenticated;
  const darkOverlayHeader = isPublicLanding && !scrolled;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-white text-[#1D1D1F]">
      <header
        className="fixed top-0 left-0 right-0 z-50 flex h-14 items-center justify-between px-4 transition-all duration-300 backdrop-blur-md md:px-6 lg:px-10"
        style={{
          background: darkOverlayHeader ? 'rgba(8,8,10,0.18)' : scrolled ? 'rgba(255,255,255,0.98)' : 'rgba(255,255,255,0.82)',
          borderBottom: darkOverlayHeader ? '1px solid rgba(255,255,255,0.14)' : '1px solid #E5E5EA',
          boxShadow: darkOverlayHeader ? 'none' : scrolled ? '0 2px 12px rgba(0,0,0,0.06)' : '0 1px 0 rgba(0,0,0,0.04)',
        }}
      >
        <Link to="/" className="flex items-center gap-2 cursor-pointer group" style={{ textDecoration: 'none' }}>
          <VibeClipLogo tone={darkOverlayHeader ? 'light' : 'dark'} />
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          <Link
            to="/"
            className="px-3.5 py-1.5 text-[13.5px] font-medium rounded-lg whitespace-nowrap"
            style={{
              background: darkOverlayHeader ? 'rgba(255,255,255,0.14)' : '#F5F5F7',
              color: darkOverlayHeader ? '#ffffff' : '#1D1D1F',
            }}
          >
            首页
          </Link>
          <a href="/#workflow" className="px-3.5 py-1.5 text-[13.5px] font-medium rounded-lg whitespace-nowrap hover:bg-[#F5F5F7] hover:text-[#1D1D1F]" style={{ textDecoration: 'none', color: darkOverlayHeader ? 'rgba(255,255,255,0.68)' : '#8E8E93' }}>
            流程
          </a>
          <a href="/#cases" className="px-3.5 py-1.5 text-[13.5px] font-medium rounded-lg whitespace-nowrap hover:bg-[#F5F5F7] hover:text-[#1D1D1F]" style={{ textDecoration: 'none', color: darkOverlayHeader ? 'rgba(255,255,255,0.68)' : '#8E8E93' }}>
            案例
          </a>
          <Link to="/projects" className="px-3.5 py-1.5 text-[13.5px] font-medium rounded-lg whitespace-nowrap hover:bg-[#F5F5F7] hover:text-[#1D1D1F]" style={{ color: darkOverlayHeader ? 'rgba(255,255,255,0.68)' : '#8E8E93' }}>
            项目管理
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <UserMenuDropdown />
          ) : (
            <>
              <Link
                to="/login"
                className="px-2.5 py-1.5 text-[13px] font-medium rounded-lg hover:bg-[#F5F5F7] md:px-3.5"
                style={{ color: darkOverlayHeader ? 'rgba(255,255,255,0.82)' : '#444444' }}
              >
                登录
              </Link>
              <Link
                to="/register"
                className="px-3 py-1.5 text-[13px] font-medium rounded-lg md:px-3.5"
                style={{
                  background: darkOverlayHeader ? '#ffffff' : '#1D1D1F',
                  color: darkOverlayHeader ? '#111111' : '#ffffff',
                }}
              >
                注册
              </Link>
            </>
          )}
        </div>
      </header>

      <div className={isPublicLanding ? '' : 'pt-14'}>{children}</div>
    </div>
  );
}
