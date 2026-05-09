import { useState } from 'react';
import { useNavigate, Link, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getPostAuthRedirect } from '../utils/authRedirect';
import { VibeClipLogo } from './short-drama/components/VibeClipLogo';

export function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    if (password.length < 6) {
      setError('密码至少需要 6 个字符');
      return;
    }

    setLoading(true);

    try {
      await register(name, email, password);
      const redirectTo = getPostAuthRedirect(searchParams, location.state);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F8FA]">
      <header className="h-14 px-6 lg:px-10 flex items-center justify-between border-b border-[#EAEAEA] bg-[rgba(255,255,255,0.96)] backdrop-blur-md">
        <Link to="/" className="flex items-center gap-2" style={{ textDecoration: 'none' }}>
          <VibeClipLogo />
        </Link>
        <Link to="/" className="text-[13px] font-medium text-[#8E8E93] hover:text-[#1D1D1F]">返回首页</Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-[400px]">
          <div className="bg-white rounded-2xl p-7 md:p-8 border border-[#EAEAEA]" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
            <div className="text-center mb-7">
              <h1 className="text-[24px] font-black text-[#1D1D1F]">注册 VibeClip</h1>
              <p className="text-[13px] mt-2 text-[#8E8E93]">开始你的 AI 内容视频生成工作流</p>
            </div>

          {error && (
              <div className="mb-4 rounded-lg bg-[#FEF2F2] px-3 py-2 flex items-center gap-2">
                <i className="ri-error-warning-line text-[14px] text-[#EF4444]" />
                <p className="text-[12.5px] text-[#DC2626]">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[12.5px] font-semibold mb-1.5 text-[#1D1D1F]">用户名</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="请输入用户名"
                  className="w-full px-4 py-2.5 rounded-xl text-[13.5px] outline-none transition-all duration-200 border border-[#EAEAEA] bg-[#FAFAFA] focus:border-[#7C3AED] focus:bg-white"
                  disabled={loading}
                  required
                />
              </div>

              <div>
                <label className="block text-[12.5px] font-semibold mb-1.5 text-[#1D1D1F]">邮箱</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="请输入邮箱地址"
                  className="w-full px-4 py-2.5 rounded-xl text-[13.5px] outline-none transition-all duration-200 border border-[#EAEAEA] bg-[#FAFAFA] focus:border-[#7C3AED] focus:bg-white"
                  disabled={loading}
                  required
                />
              </div>

              <div>
                <label className="block text-[12.5px] font-semibold mb-1.5 text-[#1D1D1F]">密码</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="至少 6 个字符"
                  className="w-full px-4 py-2.5 rounded-xl text-[13.5px] outline-none transition-all duration-200 border border-[#EAEAEA] bg-[#FAFAFA] focus:border-[#7C3AED] focus:bg-white"
                  disabled={loading}
                  required
                />
              </div>

              <div>
                <label className="block text-[12.5px] font-semibold mb-1.5 text-[#1D1D1F]">确认密码</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="请再次输入密码"
                  className="w-full px-4 py-2.5 rounded-xl text-[13.5px] outline-none transition-all duration-200 border border-[#EAEAEA] bg-[#FAFAFA] focus:border-[#7C3AED] focus:bg-white"
                  disabled={loading}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl text-[14px] font-bold text-white bg-[#1D1D1F] disabled:opacity-70"
              >
                {loading ? '注册中...' : '注册'}
              </button>
            </form>

            <p className="text-center text-[13px] mt-6 text-[#8E8E93]">
              已有账号？{' '}
              <Link to="/login" state={location.state} className="font-semibold text-[#7C3AED] hover:text-[#5B21B6]">
                立即登录
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
