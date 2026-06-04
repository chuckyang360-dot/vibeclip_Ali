import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { UserMenuDropdown } from './UserMenuDropdown';
import { VibeClipLogo } from '../pages/short-drama/components/VibeClipLogo';

export function Navbar() {
  const location = useLocation();
  const { isAuthenticated } = useAuth();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 border-b border-[#E5E5EA] bg-[rgba(255,255,255,0.96)] backdrop-blur-md">
      <div className="flex h-full w-full items-center justify-between px-6 lg:px-10">
        <div className="flex min-w-0 shrink-0 items-center gap-2">
          <Link to="/" className="flex items-center gap-2 group">
            <VibeClipLogo />
          </Link>
        </div>

        <nav className="hidden items-center justify-center gap-1 md:flex">
          <Link
            to="/"
            className={`rounded-lg px-3.5 py-1.5 text-[13.5px] font-medium ${location.pathname === '/' ? 'bg-[#F5F5F7] text-[#1D1D1F]' : 'text-[#8E8E93] hover:bg-[#F5F5F7] hover:text-[#1D1D1F]'
            }`}
          >
            首页
          </Link>
          <Link
            to="/#workflow"
            className="rounded-lg px-3.5 py-1.5 text-[13.5px] font-medium text-[#8E8E93] hover:bg-[#F5F5F7] hover:text-[#1D1D1F]"
          >
            流程
          </Link>
          <Link
            to="/#cases"
            className="rounded-lg px-3.5 py-1.5 text-[13.5px] font-medium text-[#8E8E93] hover:bg-[#F5F5F7] hover:text-[#1D1D1F]"
          >
            案例
          </Link>
          <Link
            to="/projects"
            className={`rounded-lg px-3.5 py-1.5 text-[13.5px] font-medium ${
              location.pathname === '/projects' || location.pathname.startsWith('/short-drama/projects')
                ? 'bg-[#F5F5F7] text-[#1D1D1F]'
                : 'text-[#8E8E93] hover:bg-[#F5F5F7] hover:text-[#1D1D1F]'
            }`}
          >
            项目管理
          </Link>
          <Link
            to="/short-drama/video-analysis"
            className={`rounded-lg px-3.5 py-1.5 text-[13.5px] font-medium ${
              location.pathname === '/short-drama/video-analysis'
                ? 'bg-[#F5F5F7] text-[#1D1D1F]'
                : 'text-[#8E8E93] hover:bg-[#F5F5F7] hover:text-[#1D1D1F]'
            }`}
          >
            视频解构
          </Link>
          <Link
            to="/ad-materials"
            className={`rounded-lg px-3.5 py-1.5 text-[13.5px] font-medium ${
              location.pathname === '/ad-materials'
                ? 'bg-[#F5F5F7] text-[#1D1D1F]'
                : 'text-[#8E8E93] hover:bg-[#F5F5F7] hover:text-[#1D1D1F]'
            }`}
          >
            模板专区
          </Link>
        </nav>

        <div className="flex shrink-0 items-center gap-2">
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
      </div>
    </header>
  );
}
