import type { AssetsTabId } from '@/types/shortDrama';
import { ri, sdColors } from '../utils/shortDramaHelpers';

const TAB_DEF: Array<{ id: AssetsTabId; label: string; icon: string }> = [
  { id: 'characters', label: '角色', icon: 'ri-user-star-line' },
  { id: 'scenes', label: '场景', icon: 'ri-landscape-line' },
  { id: 'productAssets', label: '产品资产', icon: 'ri-archive-line' },
];

type Props = {
  active: AssetsTabId;
  onChange: (id: AssetsTabId) => void;
  counts: Record<AssetsTabId, number>;
};

export function AssetsTabs({ active, onChange, counts }: Props) {
  return (
    <div
      className="inline-flex gap-1 rounded-xl p-1"
      style={{ background: '#F5F5F7', border: `1px solid ${sdColors.border}` }}
    >
      {TAB_DEF.map((tab) => {
        const isOn = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-medium transition-all duration-200 sm:px-5"
            style={{
              background: isOn ? '#ffffff' : 'transparent',
              color: isOn ? sdColors.ink : '#8E8E93',
              border: isOn ? `1px solid ${sdColors.border}` : '1px solid transparent',
              boxShadow: isOn ? '0 1px 4px rgba(0,0,0,0.06)' : 'none',
            }}
          >
            <i className={ri(tab.icon, 'text-[13px]')} aria-hidden />
            {tab.label}
            <span
              className="rounded-full px-1.5 py-0.5 text-[11px]"
              style={{
                background: isOn ? '#F5F5F7' : '#EAEAEA',
                color: isOn ? '#444444' : '#8E8E93',
              }}
            >
              {counts[tab.id]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
