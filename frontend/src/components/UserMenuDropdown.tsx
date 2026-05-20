import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getUserDisplayName, membershipLabelFromUser } from '../utils/userAccount';

export function UserMenuDropdown() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const displayName = getUserDisplayName(user);
  const membershipLabel = membershipLabelFromUser(user);
  const avatarChar = displayName.charAt(0).toUpperCase();

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  const go = (path: string) => {
    setOpen(false);
    navigate(path);
  };
  const groups: Array<Array<{ label: string; icon: string; action: () => void; danger?: boolean }>> = [
    [
      { label: '新建项目', icon: 'ri-add-circle-line', action: () => go('/short-drama/create') },
      { label: '项目管理', icon: 'ri-folder-line', action: () => go('/projects') },
    ],
    [
      { label: '账户设置', icon: 'ri-user-settings-line', action: () => go('/account/settings') },
      { label: '升级计划', icon: 'ri-vip-crown-line', action: () => go('/billing/plans') },
      { label: '账单', icon: 'ri-bill-line', action: () => go('/billing') },
    ],
    [
      {
        label: '退出登录',
        icon: 'ri-logout-box-r-line',
        danger: true,
        action: () => {
          setOpen(false);
          logout();
          navigate('/');
        },
      },
    ],
  ];

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-xl cursor-pointer transition-all duration-200 whitespace-nowrap"
        style={{ background: open ? '#F5F3FF' : 'transparent', border: '1px solid transparent' }}
        onMouseEnter={(e) => {
          if (!open) (e.currentTarget as HTMLElement).style.background = '#F5F3FF';
        }}
        onMouseLeave={(e) => {
          if (!open) (e.currentTarget as HTMLElement).style.background = 'transparent';
        }}
      >
        {user?.picture ? (
          <img src={user.picture} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
        ) : (
          <div className="w-7 h-7 flex items-center justify-center rounded-full shrink-0 bg-[#7C3AED]">
            <span className="text-white text-[12px] font-semibold">{avatarChar}</span>
          </div>
        )}
        <span className="text-[13px] font-medium hidden sm:inline text-[#1D1D1F]">{displayName}</span>
        <i className={`ri-arrow-down-s-line text-[14px] transition-transform duration-200 ${open ? 'rotate-180' : ''}`} style={{ color: '#8E8E93' }} />
      </button>

      {open ? (
        <div
          className="absolute right-0 top-full mt-2 w-[240px] rounded-2xl z-50 overflow-hidden"
          style={{ background: '#fff', border: '1px solid #EAEAEA', boxShadow: '0 8px 32px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)' }}
        >
          <div className="px-4 py-3.5 flex items-center gap-3 border-b border-[#F0F0F5]">
            <div className="w-9 h-9 flex items-center justify-center rounded-full shrink-0 bg-[#7C3AED]">
              <span className="text-white text-[14px] font-semibold">{avatarChar}</span>
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold truncate text-[#1D1D1F]">{displayName}</p>
              <p className="text-[11px] text-[#8E8E93]">{membershipLabel}</p>
            </div>
          </div>
          <div className="py-2">
            {groups.map((group, idx) => (
              <div key={idx}>
                {idx > 0 ? <div className="mx-3 my-1.5 h-px bg-[#F0F0F5]" /> : null}
                {group.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={item.action}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] cursor-pointer transition-colors duration-150 whitespace-nowrap text-left"
                    style={{ color: item.danger ? '#DC2626' : '#444444' }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background = item.danger ? '#FEF2F2' : '#F5F3FF';
                      (e.currentTarget as HTMLElement).style.color = item.danger ? '#B91C1C' : '#1D1D1F';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = 'transparent';
                      (e.currentTarget as HTMLElement).style.color = item.danger ? '#DC2626' : '#444444';
                    }}
                  >
                    <div className="w-4 h-4 flex items-center justify-center shrink-0">
                      <i className={`${item.icon} text-[15px]`} style={{ color: item.danger ? '#EF4444' : '#8E8E93' }} />
                    </div>
                    {item.label}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
