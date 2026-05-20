import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getUserDisplayName, membershipLabelFromUser } from '../../utils/userAccount';
import { ShortDramaLayout } from '../short-drama/components/ShortDramaLayout';

function noopMsg() {
  window.alert('暂未开放');
}

export function AccountSettingsPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'preference' | 'security'>('profile');
  const username = getUserDisplayName(user) || '未设置';
  const email = user?.email || '-';
  const userId = user?.id ?? '-';
  const registered =
    user?.created_at && !Number.isNaN(Date.parse(user.created_at))
      ? new Date(user.created_at).toLocaleString('zh-CN', { dateStyle: 'medium' })
      : '暂未记录';
  const accountType = membershipLabelFromUser(user);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const tabs = [
    { key: 'profile' as const, label: '账号信息', icon: 'ri-user-3-line' },
    { key: 'preference' as const, label: '使用偏好', icon: 'ri-settings-3-line' },
    { key: 'security' as const, label: '安全', icon: 'ri-shield-keyhole-line' },
  ];

  const profileFields = [
    { label: '用户名', value: username, editable: true },
    { label: '邮箱', value: email, editable: true },
    { label: '用户 ID', value: userId, editable: false },
    { label: '当前登录状态', value: isAuthenticated ? '已登录' : '未登录', editable: false },
    { label: '账号类型', value: accountType, editable: false },
    { label: '注册时间', value: registered, editable: false },
  ];

  const preferenceFields = [
    { label: '默认语言', value: '中文', editable: true },
    { label: '默认工作区', value: 'Vibe Clip', editable: false },
    { label: '默认视频比例', value: '9:16', editable: true },
    { label: '默认内容类型', value: '内容视频生成', editable: true },
    { label: '通知偏好', value: '暂未开放', editable: false },
  ];

  const securityFields = [
    { label: '密码修改', value: '暂未开放', editable: false },
    { label: '登录设备', value: '暂未开放', editable: false },
    { label: '第三方登录', value: '暂未开放', editable: false },
    { label: '账号状态', value: '正常', editable: false },
  ];

  const fieldsByTab = {
    profile: profileFields,
    preference: preferenceFields,
    security: securityFields,
  };
  const currentFields = fieldsByTab[activeTab];

  return (
    <ShortDramaLayout headerMode="landing">
      <div className="min-h-screen bg-[#F7F8FA] px-6 py-10">
        <div className="mx-auto max-w-[960px]">
          <div className="mb-8">
            <h1 className="text-[26px] font-black text-[#1D1D1F]">账户设置</h1>
            <p className="mt-1 text-[13.5px] text-[#8E8E93]">管理你的 Vibe Clip 账号信息与基础偏好</p>
          </div>

          <div className="flex flex-col gap-6 lg:flex-row">
            <div className="w-full shrink-0 space-y-1 lg:w-[200px]">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-[13.5px] font-medium transition-all duration-200"
                  style={{
                    background: activeTab === tab.key ? '#F5F3FF' : 'transparent',
                    color: activeTab === tab.key ? '#7C3AED' : '#6E6E73',
                  }}
                >
                  <i className={`${tab.icon} text-[15px]`} />
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex-1 space-y-5">
              <div className="rounded-2xl overflow-hidden border border-[#EAEAEA] bg-white">
                <div className="px-6 py-4 border-b border-[#F0F0F5]">
                  <h2 className="text-[14px] font-bold text-[#1D1D1F]">{tabs.find((t) => t.key === activeTab)?.label}</h2>
                </div>
                <div className="px-6 py-5">
                  {currentFields.map((field, idx) => (
                    <div
                      key={field.label}
                      className="flex items-center justify-between py-3.5"
                      style={{ borderBottom: idx < currentFields.length - 1 ? '1px solid #F0F0F5' : 'none' }}
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <span className="w-[100px] shrink-0 text-[13px] text-[#8E8E93]">{field.label}</span>
                        <span className="truncate text-[13.5px] font-medium text-[#1D1D1F]">{field.value}</span>
                      </div>
                      {field.editable ? (
                        <button
                          type="button"
                          onClick={noopMsg}
                          className="shrink-0 rounded-lg border border-[#EAEAEA] bg-[#F5F5F7] px-3 py-1 text-[12px] font-medium text-[#6E6E73]"
                        >
                          修改
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl overflow-hidden border border-[#EAEAEA] bg-white">
                <div className="px-6 py-4 border-b border-[#F0F0F5]">
                  <h2 className="text-[14px] font-bold text-[#DC2626]">危险操作</h2>
                </div>
                <div className="px-6 py-5 space-y-3">
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-[13.5px] font-medium text-[#1D1D1F]">退出登录</p>
                      <p className="mt-0.5 text-[12px] text-[#8E8E93]">退出当前账号，返回首页</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="rounded-xl border border-[#FECACA] bg-transparent px-4 py-2 text-[13px] font-semibold text-[#DC2626]"
                    >
                      退出登录
                    </button>
                  </div>
                  <div className="h-px bg-[#F0F0F5]" />
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-[13.5px] font-medium text-[#AEAEB2]">注销账号</p>
                      <p className="mt-0.5 text-[12px] text-[#C7C7CC]">暂未开放</p>
                    </div>
                    <button
                      type="button"
                      disabled
                      className="cursor-not-allowed rounded-xl border border-[#EAEAEA] bg-[#F5F5F7] px-4 py-2 text-[13px] font-medium text-[#C7C7CC]"
                    >
                      暂未开放
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => navigate('/projects')}
                className="rounded-xl bg-[#1D1D1F] px-5 py-2.5 text-[13px] font-semibold text-white"
              >
                返回项目管理
              </button>
            </div>
          </div>
        </div>
      </div>
    </ShortDramaLayout>
  );
}
