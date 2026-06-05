import { useState } from 'react';
import type { FreeCreationInputAsset } from '@/services/freeCreationApi';
import { ri } from '../short-drama/utils/shortDramaHelpers';

export type VirtualAvatarGender = '女' | '男' | '其他';

export type VirtualAvatar = {
  id: string;
  assetUri: string;
  previewUrl: string;
  name: string;
  country: string;
  gender: VirtualAvatarGender;
  age: number;
  ageGroup: string;
  occupation: string;
  tags: string[];
  bio: string;
};

const VIRTUAL_AVATAR_PLACEHOLDER =
  'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 480 640%22%3E%3Crect width=%22480%22 height=%22640%22 fill=%22%23F2F4F8%22/%3E%3Ccircle cx=%22240%22 cy=%22218%22 r=%2288%22 fill=%22%23D6DCE8%22/%3E%3Cpath d=%22M112 520c18-94 86-150 128-150s110 56 128 150%22 fill=%22%23D6DCE8%22/%3E%3C/svg%3E';

export const virtualAvatars: VirtualAvatar[] = [
  {
    id: 'asset-20260310030618-88hlb',
    assetUri: 'asset://asset-20260310030618-88hlb',
    previewUrl: VIRTUAL_AVATAR_PLACEHOLDER,
    name: '国风美甲师',
    country: '中国',
    gender: '女',
    age: 18,
    ageGroup: '18-24',
    occupation: '美甲师',
    tags: ['中国', '女', '18岁', '美甲师', '国风', '茶铺'],
    bio: '她说话总带笑，是老巷里开美甲小铺的十八岁姑娘，常给客人做印着瘦金体小字、淡茶芽的国风款式，闲时就泡杯烘青茶守铺翻纹样帖，收工了总约小姐妹搓半小时麻将再回家。',
  },
  {
    id: 'asset-20260401123823-6d4x2',
    assetUri: 'asset://asset-20260401123823-6d4x2',
    previewUrl: VIRTUAL_AVATAR_PLACEHOLDER,
    name: '中式美妆博主',
    country: '中国',
    gender: '女',
    age: 26,
    ageGroup: '25-34',
    occupation: '网红/主播',
    tags: ['中国', '女', '26岁', '网红/主播', '美妆博主', 'KOL'],
    bio: '26 岁沪上杭籍美妆博主，是手握 3 个国际顶奢美妆品牌年度合作的独立内容创作者，也是中式美学妆造赛道的标杆型 KOL。日常要么泡在影棚打磨高定妆造选题、和奢牌研发团队共创限定彩妆线的色号，要么受邀去时尚院校做中式美妆审美脉络的分享。',
  },
];

export function virtualAvatarToInputAsset(avatar: VirtualAvatar, label: string): FreeCreationInputAsset {
  return {
    type: 'image',
    url: avatar.assetUri,
    preview_url: avatar.previewUrl,
    storage_key: `virtual-avatar/${avatar.id}`,
    file_name: `${avatar.name}.png`,
    mime_type: 'image/asset-uri',
    file_size: 0,
    role: 'reference_image',
    label,
  };
}

type FilterValue = '全部' | string;

function uniqueValues(key: keyof Pick<VirtualAvatar, 'gender' | 'country' | 'ageGroup'>): string[] {
  return Array.from(new Set(virtualAvatars.map((avatar) => avatar[key]).filter(Boolean))).sort();
}

function FilterButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-8 rounded-lg border px-3 text-[12px] font-bold transition ${
        active ? 'border-[#1D1D1F] bg-[#1D1D1F] text-white' : 'border-[#E5E5EA] bg-white text-[#6E6E73] hover:text-[#1D1D1F]'
      }`}
    >
      {children}
    </button>
  );
}

function FilterRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: FilterValue;
  onChange: (value: FilterValue) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-9 shrink-0 text-[12px] font-black text-[#8E8E93]">{label}</span>
      <FilterButton active={value === '全部'} onClick={() => onChange('全部')}>全部</FilterButton>
      {options.map((option) => (
        <FilterButton key={option} active={value === option} onClick={() => onChange(option)}>
          {option}
        </FilterButton>
      ))}
    </div>
  );
}

export function VirtualAvatarPicker({
  open,
  onClose,
  onSelect,
  selectedAssetUris = [],
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (avatar: VirtualAvatar) => void;
  selectedAssetUris?: string[];
}) {
  const [gender, setGender] = useState<FilterValue>('全部');
  const [country, setCountry] = useState<FilterValue>('全部');
  const [ageGroup, setAgeGroup] = useState<FilterValue>('全部');

  if (!open) return null;

  const rows = virtualAvatars.filter((avatar) => (
    (gender === '全部' || avatar.gender === gender) &&
    (country === '全部' || avatar.country === country) &&
    (ageGroup === '全部' || avatar.ageGroup === ageGroup)
  ));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 py-6" role="dialog" aria-modal="true">
      <div className="flex max-h-[88vh] w-full max-w-[960px] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_80px_rgba(15,23,42,0.28)]">
        <div className="flex items-center justify-between border-b border-[#E5E5EA] px-5 py-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-widest text-[#8E8E93]">Virtual Avatar Library</p>
            <h2 className="mt-1 text-[20px] font-black text-[#1D1D1F]">虚拟人像库</h2>
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#E5E5EA] text-[#6E6E73] hover:bg-[#F7F8FA]" aria-label="关闭人像库">
            <i className={ri('ri-close-line', 'text-[17px]')} aria-hidden />
          </button>
        </div>

        <div className="border-b border-[#F0F0F0] px-5 py-4">
          <div className="grid gap-3 md:grid-cols-3">
            <FilterRow label="性别" options={uniqueValues('gender')} value={gender} onChange={setGender} />
            <FilterRow label="国家" options={uniqueValues('country')} value={country} onChange={setCountry} />
            <FilterRow label="年龄" options={uniqueValues('ageGroup')} value={ageGroup} onChange={setAgeGroup} />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-[#F7F8FA] p-5">
          {rows.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((avatar) => {
                const selected = selectedAssetUris.includes(avatar.assetUri);
                return (
                  <article key={avatar.id} className="overflow-hidden rounded-xl border border-[#E5E5EA] bg-white">
                    <div className="aspect-[3/4] bg-[#F2F4F8]">
                      <img src={avatar.previewUrl} alt={avatar.name} className="h-full w-full object-cover" loading="lazy" />
                    </div>
                    <div className="space-y-3 p-4">
                      <div>
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="text-[16px] font-black text-[#1D1D1F]">{avatar.name}</h3>
                          {selected ? <span className="rounded-full bg-[#EAF8EF] px-2 py-1 text-[11px] font-bold text-[#047857]">已选</span> : null}
                        </div>
                        <p className="mt-1 truncate text-[12px] text-[#6E6E73]">{avatar.country} · {avatar.gender} · {avatar.age}岁 · {avatar.occupation}</p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {avatar.tags.slice(0, 5).map((tag) => (
                          <span key={tag} className="rounded-md bg-[#F2F4F8] px-2 py-1 text-[11px] font-bold text-[#6E6E73]">{tag}</span>
                        ))}
                      </div>
                      <p className="line-clamp-3 min-h-[60px] text-[12px] leading-5 text-[#444444]">{avatar.bio}</p>
                      <button
                        type="button"
                        onClick={() => onSelect(avatar)}
                        className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#1D1D1F] text-[13px] font-bold text-white"
                      >
                        <i className={ri('ri-user-add-line', 'text-[15px]')} aria-hidden />
                        {selected ? '再次引用' : '使用人像'}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-[#D6DCE8] bg-white text-[13px] font-bold text-[#8E8E93]">
              没有匹配的人像素材
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
