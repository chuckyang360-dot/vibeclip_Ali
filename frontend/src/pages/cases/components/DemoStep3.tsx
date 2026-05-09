import { useState } from 'react';
import type { DemoCase } from '../../short-drama/data/demoCases';

type TabType = 'characters' | 'scenes' | 'assets';
interface Props { demo: DemoCase; onNext: () => void; onPrev: () => void; }

export function DemoStep3({ demo, onNext, onPrev }: Props) {
  const { step3 } = demo;
  const [activeTab, setActiveTab] = useState<TabType>('characters');
  return (
    <div className="bg-white px-6 lg:px-10 py-7">
      <h1 className="text-2xl font-black text-[#1D1D1F]">S3 图片资产</h1>
      <div className="mt-5 inline-flex rounded-xl border border-[#EAEAEA] bg-[#F5F5F7] p-1">
        {[
          { key: 'characters', label: `角色 (${step3.characters.length})` },
          { key: 'scenes', label: `场景 (${step3.scenes.length})` },
          { key: 'assets', label: `产品资产 (${step3.products.length})` },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as TabType)}
            className="rounded-lg px-5 py-2 text-[13px] font-medium"
            style={{ background: activeTab === tab.key ? '#fff' : 'transparent', color: activeTab === tab.key ? '#1D1D1F' : '#8E8E93' }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'characters' ? (
        <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
          {step3.characters.map((char: DemoCase["step3"]["characters"][number]) => (
            <div key={char.id} className="overflow-hidden rounded-2xl border border-[#EAEAEA] bg-white">
              <img src={char.img} alt={char.name} className="h-52 w-full object-contain bg-[#F5F5F7]" />
              <div className="p-4">
                <h3 className="text-[15px] font-bold text-[#1D1D1F]">{char.name}</h3>
                <p className="mt-1 text-[12px] text-[#6E6E73]">{char.desc}</p>
              </div>
            </div>
          ))}
        </div>
      ) : null}
      {activeTab === 'scenes' ? (
        <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {step3.scenes.map((scene: DemoCase["step3"]["scenes"][number]) => (
            <div key={scene.id} className="overflow-hidden rounded-2xl border border-[#EAEAEA] bg-white">
              <img src={scene.img} alt={scene.name} className="h-48 w-full object-cover" />
              <div className="p-4">
                <h3 className="text-[14px] font-bold text-[#1D1D1F]">{scene.name}</h3>
                <p className="mt-1 text-[12px] text-[#6E6E73]">{scene.desc}</p>
              </div>
            </div>
          ))}
        </div>
      ) : null}
      {activeTab === 'assets' ? (
        <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
          {step3.products.map((asset: DemoCase["step3"]["products"][number]) => (
            <div key={asset.id} className="overflow-hidden rounded-2xl border border-[#EAEAEA] bg-white">
              <img src={asset.img} alt={asset.name} className="h-44 w-full object-cover" />
              <div className="p-4">
                <h3 className="text-[14px] font-bold text-[#1D1D1F]">{asset.name}</h3>
                <p className="mt-1 text-[12px] text-[#6E6E73]">{asset.placement}</p>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-10 flex items-center justify-between border-t border-[#EAEAEA] pt-6">
        <button onClick={onPrev} className="rounded-xl border border-[#EAEAEA] bg-[#F7F8FA] px-5 py-3 text-[13.5px] text-[#444444]">上一步</button>
        <button onClick={onNext} className="rounded-xl bg-[#1D1D1F] px-7 py-3 text-[14px] font-semibold text-white">查看 S4 视频生成</button>
      </div>
    </div>
  );
}
