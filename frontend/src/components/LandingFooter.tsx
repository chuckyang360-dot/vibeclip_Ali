import { Link } from 'react-router-dom';
import { VibeClipLogo } from '../pages/short-drama/components/VibeClipLogo';

const linkClass = 'text-[13px] text-[#6E6E73] transition-colors hover:text-[#1D1D1F] hover:text-[#7B61FF]';

export function LandingFooter() {
  return (
    <footer className="border-t border-[#EAEAEA] bg-[#FAFAFA]">
      <div className="mx-auto max-w-6xl px-6 py-14 lg:px-10">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <VibeClipLogo />
            </div>
            <p className="max-w-xs text-[12.5px] leading-relaxed text-[#8E8E93]">
              AI 内容视频生成工作台，让创作、营销和内容生产更高效。
            </p>
          </div>

          <div>
            <h3 className="mb-4 text-[12px] font-bold uppercase tracking-wider text-[#AEAEB2]">产品</h3>
            <ul className="flex flex-col gap-3">
              <li>
                <Link to="/" className={linkClass}>
                  首页
                </Link>
              </li>
              <li>
                <a href="/#workflow" className={linkClass}>
                  流程
                </a>
              </li>
              <li>
                <a href="/#cases" className={linkClass}>
                  案例
                </a>
              </li>
              <li>
                <Link to="/projects" className={linkClass}>
                  项目管理
                </Link>
              </li>
              <li>
                <Link to="/billing/plans" className={linkClass}>
                  升级计划
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-4 text-[12px] font-bold uppercase tracking-wider text-[#AEAEB2]">支持</h3>
            <ul className="flex flex-col gap-3">
              <li>
                <Link to="/help" className={linkClass}>
                  帮助文档
                </Link>
              </li>
              <li>
                <Link to="/tutorials" className={linkClass}>
                  使用教程
                </Link>
              </li>
              <li>
                <Link to="/faq" className={linkClass}>
                  常见问题
                </Link>
              </li>
              <li>
                <Link to="/account/settings" className={linkClass}>
                  账户设置
                </Link>
              </li>
              <li>
                <Link to="/billing" className={linkClass}>
                  账单管理
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-4 text-[12px] font-bold uppercase tracking-wider text-[#AEAEB2]">商务合作</h3>
            <p className="mb-3 text-[13px] font-medium text-[#444444]">联系人：杨阳</p>
            <p className="mb-2">
              <span className="text-[13px] text-[#444444]">邮箱：</span>
              <a href="mailto:chuckyang360@gmail.com" className={`${linkClass} break-all`}>
                chuckyang360@gmail.com
              </a>
            </p>
            <p className="mb-4">
              <span className="text-[13px] text-[#444444]">电话：</span>
              <a href="tel:15990150310" className={linkClass}>
                15990150310
              </a>
            </p>
            <p className="text-[12px] leading-relaxed text-[#8E8E93]">欢迎品牌、渠道、服务商与内容团队合作</p>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-[#EAEAEA] pt-8 md:flex-row md:items-center md:justify-between">
          <p className="text-[12px] text-[#AEAEB2]">© 2026 VibeClip. All rights reserved.</p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Link to="/terms" className="text-[12px] text-[#8E8E93] transition-colors hover:text-[#7B61FF]">
              服务协议
            </Link>
            <Link to="/privacy" className="text-[12px] text-[#8E8E93] transition-colors hover:text-[#7B61FF]">
              隐私政策
            </Link>
            <Link to="/subscription-terms" className="text-[12px] text-[#8E8E93] transition-colors hover:text-[#7B61FF]">
              订阅条款
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
