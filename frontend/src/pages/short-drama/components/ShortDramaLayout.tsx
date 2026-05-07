import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { sdColors } from '../utils/shortDramaHelpers';
import { VibeClipLogo } from './VibeClipLogo';

type HeaderMode = 'landing' | 'workflow';

type ShortDramaLayoutProps = {
  children: ReactNode;
  /** landing: anchor links + primary CTA; workflow: minimal tool header */
  headerMode?: HeaderMode;
};

export function ShortDramaLayout({ children, headerMode = 'workflow' }: ShortDramaLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const isProjectsPage = location.pathname.startsWith('/short-drama/projects');
  const landingAnchorBase = location.pathname === '/short-drama' ? '' : '/short-drama';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

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
            onClick={() => navigate('/short-drama')}
            className="flex cursor-pointer items-center gap-2 rounded-lg text-left transition-transform hover:scale-[1.02]"
          >
            <VibeClipLogo />
            <span className="hidden rounded px-1.5 py-0.5 text-[11px] font-semibold text-[#6B7280] md:inline">
              Vibe Clip · 维播
            </span>
          </button>
        </div>

        {headerMode === 'landing' ? (
          <nav className="hidden items-center gap-6 md:flex">
            {[
              ['能力', '#sd-capabilities'],
              ['流程', '#sd-workflow'],
              ['案例', '#sd-audience'],
            ].map(([label, hash]) => (
              <a
                key={hash}
                href={`${landingAnchorBase}${hash}`}
                className="whitespace-nowrap text-[13px] font-medium text-[#8E8E93] transition-colors hover:text-[#1D1D1F]"
              >
                {label}
              </a>
            ))}
          </nav>
        ) : (
          <div className="hidden text-[12px] font-medium text-[#8E8E93] md:block">AI 商品营销短视频工作台</div>
        )}

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <Link
            to="/short-drama/projects"
            className="whitespace-nowrap text-[13px] text-[#8E8E93] transition-colors hover:text-[#1D1D1F]"
          >
            项目列表
          </Link>
          {headerMode === 'landing' ? (
            <Link
              to="/short-drama/projects"
              onClick={() => console.info('[FRONT_PROJECT_MANAGEMENT_NAV_CLICK]', { location: 'short_drama_header' })}
              className="whitespace-nowrap rounded-md px-2 py-1 text-[13px] transition-colors"
              style={{
                color: isProjectsPage ? '#1D1D1F' : '#8E8E93',
                background: isProjectsPage ? '#F5F5F7' : 'transparent',
                fontWeight: isProjectsPage ? 600 : 400,
                pointerEvents: isProjectsPage ? 'none' : 'auto',
              }}
            >
              项目管理
            </Link>
          ) : null}
          {headerMode === 'landing' ? (
            <Link
              to="/short-drama/create"
              className="whitespace-nowrap rounded-lg px-4 py-2 text-[13px] font-semibold text-white transition-colors"
              style={{ background: sdColors.ink }}
            >
              开始创建
            </Link>
          ) : null}
        </div>
      </header>

      <div className="pt-[72px]">{children}</div>
    </div>
  );
}
