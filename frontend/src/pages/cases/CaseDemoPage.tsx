import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { UserMenuDropdown } from '../../components/UserMenuDropdown';
import { DEMO_CASES, type DemoCase } from '../short-drama/data/demoCases';
import { DemoCreate } from './components/DemoCreate';
import { DemoOverview } from './components/DemoOverview';
import { DemoStep1 } from './components/DemoStep1';
import { DemoStep2 } from './components/DemoStep2';
import { DemoStep3 } from './components/DemoStep3';

type TabKey = 'create' | 'step1' | 'step2' | 'step3' | 'overview';

const TABS: Array<{ key: TabKey; label: string; icon: string }> = [
  { key: 'create', label: 'S0 项目设置', icon: 'ri-file-add-line' },
  { key: 'step1', label: 'S1 内容理解', icon: 'ri-upload-cloud-2-line' },
  { key: 'step2', label: 'S2 策略与脚本', icon: 'ri-pen-nib-line' },
  { key: 'step3', label: 'S3 图片资产', icon: 'ri-image-2-line' },
  { key: 'overview', label: 'S4 视频生成', icon: 'ri-film-line' },
];

export function CaseDemoPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabKey>('create');
  const demo: DemoCase | undefined = DEMO_CASES.find((c: DemoCase) => c.id === caseId);

  if (!demo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F8FA] px-6">
        <div className="text-center">
          <p className="text-[18px] font-semibold text-[#1D1D1F]">案例不存在</p>
          <p className="mt-2 text-[13px] text-[#8E8E93]">该案例已下线或链接错误。</p>
          <button
            onClick={() => navigate('/#cases')}
            className="mt-5 rounded-xl bg-[#1D1D1F] px-5 py-2.5 text-[13px] font-semibold text-white"
          >
            返回案例区
          </button>
        </div>
      </div>
    );
  }

  const currentTabIndex = TABS.findIndex((t) => t.key === activeTab);

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F8FA]">
      <header className="fixed top-0 left-0 right-0 z-50 flex h-14 items-center justify-between border-b border-[#EAEAEA] bg-[rgba(255,255,255,0.96)] px-6 lg:px-10 backdrop-blur-md">
        <div className="flex min-w-0 items-center gap-3">
          <button onClick={() => navigate('/')} className="flex items-center gap-2">
            <div className="w-7 h-7 flex items-center justify-center rounded-lg bg-[linear-gradient(135deg,#7C3AED,#A78BFA)]">
              <i className="ri-film-line text-[13px] text-white" />
            </div>
            <span className="hidden text-[14px] font-bold sm:block text-[#1D1D1F]">VibeClip</span>
          </button>
          <span className="text-[#D1D1D6]">/</span>
          <span className="text-[12px] text-[#8E8E93]">行业案例演示</span>
          <span className="text-[#D1D1D6]">/</span>
          <span className="max-w-[220px] truncate text-[12px] font-semibold text-[#1D1D1F]">{demo.title}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/short-drama/create')}
            className="hidden sm:flex items-center gap-1.5 rounded-lg bg-[#1D1D1F] px-4 py-1.5 text-[12.5px] font-semibold text-white"
          >
            <i className="ri-add-circle-line text-[12px]" />
            使用此模板创建项目
          </button>
          <UserMenuDropdown />
        </div>
      </header>

      <div className="pt-14 border-b border-[#EAEAEA] bg-white">
        <div className="px-6 lg:px-10 py-5 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="w-14 h-14 overflow-hidden rounded-xl shrink-0">
            <img src={demo.img} alt={demo.title} className="h-full w-full object-cover object-top" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <span className="rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ background: `${demo.color}10`, color: demo.color, border: `1px solid ${demo.color}25` }}>
                {demo.genre}
              </span>
              <span className="text-[11px] text-[#8E8E93]">{demo.industry} · {demo.market}</span>
            </div>
            <h1 className="text-[18px] font-black text-[#1D1D1F]">{demo.title}</h1>
            <p className="line-clamp-1 text-[12px] text-[#6E6E73]">{demo.desc}</p>
          </div>
        </div>
        <div className="border-t border-[#F5F5F7] px-6 lg:px-10 overflow-x-auto">
          <div className="flex items-center">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="flex shrink-0 items-center gap-2 border-b-2 px-4 py-3.5 text-[13px] font-medium"
                style={{ color: activeTab === tab.key ? '#1D1D1F' : '#8E8E93', borderBottomColor: activeTab === tab.key ? '#1D1D1F' : 'transparent' }}
              >
                <i className={`${tab.icon} text-[13px]`} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="border-b border-[rgba(180,83,9,0.1)] bg-[rgba(180,83,9,0.04)] px-6 lg:px-10 py-2.5 text-[11.5px] text-[#B45309]">
        <i className="ri-lock-line mr-1.5 text-[12px]" />
        这是 Vibe Clip 的行业案例演示，仅供展示，不会创建真实项目。
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'create' && <DemoCreate demo={demo} onNext={() => setActiveTab('step1')} />}
        {activeTab === 'step1' && <DemoStep1 demo={demo} onNext={() => setActiveTab('step2')} onPrev={() => setActiveTab('create')} />}
        {activeTab === 'step2' && <DemoStep2 demo={demo} onNext={() => setActiveTab('step3')} onPrev={() => setActiveTab('step1')} />}
        {activeTab === 'step3' && <DemoStep3 demo={demo} onNext={() => setActiveTab('overview')} onPrev={() => setActiveTab('step2')} />}
        {activeTab === 'overview' && <DemoOverview demo={demo} onPrev={() => setActiveTab('step3')} />}
      </div>

      <div className="border-t border-[#EAEAEA] bg-white px-6 lg:px-10 py-3 flex items-center justify-between">
        <button
          onClick={() => (currentTabIndex > 0 ? setActiveTab(TABS[currentTabIndex - 1].key) : navigate('/#cases'))}
          className="rounded-xl border border-[#EAEAEA] bg-[#F7F8FA] px-5 py-2.5 text-[13px] text-[#444444]"
        >
          {currentTabIndex === 0 ? '返回案例区' : '上一步'}
        </button>
        <button
          onClick={() => (currentTabIndex < TABS.length - 1 ? setActiveTab(TABS[currentTabIndex + 1].key) : navigate('/short-drama/create'))}
          className="rounded-xl bg-[#1D1D1F] px-5 py-2.5 text-[13px] font-semibold text-white"
        >
          {currentTabIndex < TABS.length - 1 ? '下一步' : '使用此模板创建项目'}
        </button>
      </div>
    </div>
  );
}
