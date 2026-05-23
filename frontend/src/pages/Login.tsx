import { useState } from 'react';
import { useNavigate, Link, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import * as api from '../services/api';
import { getPostAuthRedirect } from '../utils/authRedirect';
import { VibeClipLogo } from './short-drama/components/VibeClipLogo';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login: authLogin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await api.login(email, password);
      if (result.user && result.access_token) {
        authLogin(result);
        const redirectTo = getPostAuthRedirect(searchParams, location.state);
        navigate(redirectTo, { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0B0D] md:bg-[#F7F8FA]">
      <header className="fixed top-0 left-0 right-0 z-50 h-14 px-4 md:px-6 lg:px-10 flex items-center justify-between border-b border-[#EAEAEA] bg-white/92 backdrop-blur-md">
        <Link to="/" className="flex items-center gap-2" style={{ textDecoration: 'none' }}>
          <VibeClipLogo />
        </Link>
        <Link to="/" className="text-[13px] font-medium text-[#8E8E93] hover:text-[#1D1D1F]">返回首页</Link>
      </header>

      <main className="min-h-screen md:grid md:grid-cols-[1.05fr_0.95fr]">
        <section className="relative flex min-h-[38vh] items-end overflow-hidden px-4 pb-8 pt-24 md:min-h-screen md:px-10 md:pb-16 lg:px-14">
          <img
            src="https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=1600&q=82"
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-72"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,7,9,0.28)_0%,rgba(7,7,9,0.88)_76%)] md:bg-[linear-gradient(90deg,rgba(7,7,9,0.92)_0%,rgba(7,7,9,0.56)_100%)]" />
          <div className="relative z-10 max-w-xl text-white">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/16 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white/74 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              VibeClip 工作台
            </div>
            <h1 className="text-[34px] font-black leading-[1.02] md:text-[58px]">
              继续生成你的产品短片
            </h1>
            <p className="mt-4 max-w-md text-[14px] leading-relaxed text-white/66 md:text-[16px]">
              登录后回到项目进度，继续完成产品理解、剧本、资产、视频生成和成片交付。
            </p>
          </div>
        </section>

        <section className="-mt-6 rounded-t-[28px] bg-[#F7F8FA] px-4 pb-8 pt-5 md:mt-0 md:flex md:items-center md:justify-center md:rounded-none md:px-8 md:pt-20">
          <div className="w-full max-w-[420px]">
            <div className="rounded-[24px] border border-[#EAEAEA] bg-white p-5 shadow-[0_18px_48px_rgba(15,23,42,0.10)] md:p-8 md:shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
              <div className="mb-6 text-left md:mb-7 md:text-center">
                <h2 className="text-[26px] font-black leading-tight text-[#1D1D1F] md:text-[24px]">登录 VibeClip</h2>
                <p className="mt-2 text-[13px] leading-relaxed text-[#8E8E93]">继续创建你的 AI 产品营销视频项目</p>
            </div>

            {error && (
              <div className="mb-4 flex items-start gap-2 rounded-xl bg-[#FEF2F2] px-3 py-2.5">
                <i className="ri-error-warning-line text-[14px] text-[#EF4444]" />
                <p className="text-[12.5px] leading-relaxed text-[#DC2626]">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5 md:space-y-4">
              <div>
                <label className="block text-[12.5px] font-semibold mb-1.5 text-[#1D1D1F]">邮箱</label>
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="请输入邮箱地址"
                  className="h-12 w-full rounded-xl border border-[#EAEAEA] bg-[#FAFAFA] px-4 text-[15px] outline-none transition-all duration-200 focus:border-[#1D1D1F] focus:bg-white md:h-[44px] md:text-[13.5px]"
                  disabled={loading}
                  autoComplete="email"
                  required
                />
              </div>

              <div>
                <label className="block text-[12.5px] font-semibold mb-1.5 text-[#1D1D1F]">密码</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="输入你的密码"
                  className="h-12 w-full rounded-xl border border-[#EAEAEA] bg-[#FAFAFA] px-4 text-[15px] outline-none transition-all duration-200 focus:border-[#1D1D1F] focus:bg-white md:h-[44px] md:text-[13.5px]"
                  disabled={loading}
                  autoComplete="current-password"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-2 h-12 w-full rounded-xl bg-[#1D1D1F] text-[15px] font-bold text-white disabled:opacity-70 md:h-[46px] md:text-[14px]"
              >
                {loading ? '登录中...' : '登录'}
              </button>
            </form>

            <p className="mt-6 text-center text-[13px] text-[#8E8E93]">
              还没有账号？{' '}
              <Link to="/register" state={location.state} className="font-semibold text-[#1D1D1F]">
                立即注册
              </Link>
            </p>
          </div>
        </div>
        </section>
      </main>
    </div>
  );
}
