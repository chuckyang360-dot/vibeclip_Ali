import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ShortDramaLayout } from '../short-drama/components/ShortDramaLayout';

export function AccountSettingsPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  const username = (user as { username?: string } | null)?.username || user?.name || '-';
  const email = user?.email || '-';
  const userId = user?.id ?? '-';

  return (
    <ShortDramaLayout headerMode="landing">
      <div className="min-h-screen bg-[#F7F8FA] px-6 py-10">
        <div className="mx-auto max-w-[1100px]">
          <h1 className="text-2xl font-black text-[#1D1D1F]">账户设置</h1>
          <p className="mt-2 text-[14px] text-[#6E6E73]">管理你的 Vibe Clip 账号信息与基础偏好。</p>

          <div className="mt-6 grid grid-cols-1 gap-4">
            <section className="rounded-2xl border border-[#EAEAEA] bg-white p-6 shadow-sm">
              <h2 className="text-[16px] font-bold text-[#1D1D1F]">账号信息</h2>
              <div className="mt-4 space-y-2 text-[14px] text-[#444444]">
                <p>用户名：{username}</p>
                <p>邮箱：{email}</p>
                <p>用户 ID：{userId}</p>
                <p>当前登录状态：{isAuthenticated ? '已登录' : '未登录'}</p>
              </div>
            </section>

            <section className="rounded-2xl border border-[#EAEAEA] bg-white p-6 shadow-sm">
              <h2 className="text-[16px] font-bold text-[#1D1D1F]">使用偏好</h2>
              <div className="mt-4 space-y-2 text-[14px] text-[#444444]">
                <p>默认语言：中文</p>
                <p>默认工作区：Vibe Clip</p>
                <p>通知偏好：暂未开放</p>
              </div>
            </section>

            <section className="rounded-2xl border border-[#EAEAEA] bg-white p-6 shadow-sm">
              <h2 className="text-[16px] font-bold text-[#1D1D1F]">安全</h2>
              <div className="mt-4 space-y-2 text-[14px] text-[#444444]">
                <p>密码修改：暂未开放</p>
                <p>登录设备：暂未开放</p>
              </div>
            </section>
          </div>

          <button
            type="button"
            onClick={() => navigate('/short-drama/projects')}
            className="mt-6 rounded-lg bg-[#1D1D1F] px-4 py-2 text-[13px] font-semibold text-white"
          >
            返回项目管理
          </button>
        </div>
      </div>
    </ShortDramaLayout>
  );
}
