import { useState } from 'react';
import type { DemoCase } from '../../short-drama/data/demoCases';

interface Props {
  demo: DemoCase;
  onNext: () => void;
  onPrev: () => void;
}

export function DemoStep2({ demo, onNext, onPrev }: Props) {
  const { step2 } = demo;
  const [expandedSeg, setExpandedSeg] = useState<number | null>(null);
  return (
    <div className="flex min-h-[calc(100vh-200px)]">
      <aside className="hidden w-64 shrink-0 overflow-y-auto border-r border-[#EAEAEA] bg-[#F7F8FA] p-6 pt-10 lg:flex">
        <div>
          <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[#AEAEB2]">项目设置</p>
          {[
            { label: '时长', value: demo.create.duration },
            { label: '形式', value: demo.create.format === 'single' ? '单条广告' : '系列短剧' },
            { label: '视觉', value: demo.create.visualStyle },
            { label: '比例', value: demo.create.ratio },
            { label: '市场', value: demo.step1.targetMarket.join(' · ') },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between border-b border-[#F0F0F0] py-2.5">
              <span className="text-[12px] text-[#8E8E93]">{item.label}</span>
              <span className="text-[12px] font-medium text-[#444444]">{item.value}</span>
            </div>
          ))}
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-6 lg:p-8">
        <h1 className="text-2xl font-black text-[#1D1D1F]">S2 策略与脚本</h1>
        <div className="mt-6 space-y-3">
          {[
            { label: '剧集标题', value: step2.title },
            { label: '故事前提', value: step2.premise },
            { label: '钩子 Hook', value: step2.hook },
            { label: '核心冲突', value: step2.conflict },
            { label: '反转 Twist', value: step2.twist },
            { label: '结尾 Resolution', value: step2.resolution },
          ].map((field) => (
            <div key={field.label} className="rounded-2xl border border-[#EAEAEA] bg-white p-5">
              <span className="text-[12px] font-bold tracking-wider text-[#8E8E93]">{field.label}</span>
              <p className="mt-2 text-[13.5px] leading-relaxed text-[#444444]">{field.value}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 space-y-3">
          {step2.segments.map((seg: DemoCase["step2"]["segments"][number]) => (
            <div
              key={seg.id}
              className="cursor-pointer rounded-2xl border bg-white p-5"
              style={{ borderColor: expandedSeg === seg.id ? `${seg.color}40` : '#EAEAEA' }}
              onClick={() => setExpandedSeg(expandedSeg === seg.id ? null : seg.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg text-[12px] font-bold" style={{ background: `${seg.color}10`, color: seg.color }}>
                    S{seg.id}
                  </div>
                  <span className="text-[14px] font-bold text-[#1D1D1F]">{seg.name}</span>
                </div>
                <i className={expandedSeg === seg.id ? 'ri-arrow-up-s-line text-[#AEAEB2]' : 'ri-arrow-down-s-line text-[#AEAEB2]'} />
              </div>
              {expandedSeg === seg.id ? (
                <div className="mt-4 grid grid-cols-1 gap-3 text-[12px] md:grid-cols-3">
                  <div><p className="text-[#8E8E93]">目标</p><p className="text-[#444444]">{seg.goal}</p></div>
                  <div><p className="text-[#8E8E93]">产品露出</p><p style={{ color: seg.color }}>{seg.productPlacement}</p></div>
                  <div><p className="text-[#8E8E93]">剧情概要</p><p className="text-[#444444]">{seg.synopsis}</p></div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
        <div className="mt-6 flex items-center justify-between border-t border-[#EAEAEA] pt-6">
          <button onClick={onPrev} className="rounded-xl border border-[#EAEAEA] bg-[#F7F8FA] px-5 py-3 text-[13.5px] text-[#444444]">上一步</button>
          <button onClick={onNext} className="rounded-xl bg-[#1D1D1F] px-7 py-3 text-[14px] font-semibold text-white">查看 S3 图片资产</button>
        </div>
      </main>
    </div>
  );
}
