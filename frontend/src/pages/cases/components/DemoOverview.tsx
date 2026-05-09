import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { DemoCaseConfig } from '../../short-drama/data/demoCases';

interface Props {
  demo: DemoCaseConfig;
  onPrev: () => void;
}

export function DemoOverview({ demo, onPrev }: Props) {
  const navigate = useNavigate();
  const { overview } = demo;
  const [playingSegment, setPlayingSegment] = useState<number | null>(null);
  const handlePlay = (id: number) => {
    setPlayingSegment(id);
    setTimeout(() => setPlayingSegment(null), 1200);
  };
  return (
    <div className="bg-[#F7F8FA] px-6 py-10 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-3xl font-black text-[#1D1D1F]">S4 视频生成</h1>
        <p className="mt-2 text-[13px] text-[#6E6E73]">成片摘要、分段视频与技术参数（演示只读）</p>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-1">
            <div className="rounded-2xl border border-[#EAEAEA] bg-white p-5">
              <h3 className="text-[12px] font-bold tracking-wider text-[#8E8E93]">成片摘要</h3>
              <p className="mt-3 text-[13px] leading-relaxed text-[#444444]">{overview.plotSummary}</p>
            </div>
          </div>

          <div className="space-y-5 lg:col-span-2">
            <div className="rounded-2xl border border-[#EAEAEA] bg-white p-5">
              <h3 className="mb-4 text-[12px] font-bold tracking-wider text-[#8E8E93]">分段预览</h3>
              <div className="grid grid-cols-3 gap-4">
                {overview.segments.map((seg) => (
                  <div key={seg.id}>
                    <button
                      onClick={() => handlePlay(seg.id)}
                      className="relative mb-2 w-full overflow-hidden rounded-xl border"
                      style={{ aspectRatio: '9/16', borderColor: `${seg.color}25` }}
                    >
                      <img src={seg.img} alt={seg.name} className="h-full w-full object-cover object-top" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="rounded-full bg-white/80 p-2.5">
                          <i className={playingSegment === seg.id ? 'ri-loader-4-line animate-spin text-[14px]' : 'ri-play-fill text-[14px]'} />
                        </span>
                      </div>
                    </button>
                    <p className="text-[12px] font-semibold" style={{ color: seg.color }}>{seg.name}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-[rgba(4,120,87,0.2)] bg-[rgba(4,120,87,0.04)] p-5">
              <h3 className="text-[13px] font-bold text-[#1D1D1F]">最终成片信息</h3>
              <div className="mt-4 flex gap-4">
                <img src={overview.finalImg} alt="final" className="w-28 rounded-xl border border-[rgba(4,120,87,0.25)] object-cover" style={{ aspectRatio: '9/16' }} />
                <div className="flex-1 space-y-2 text-[12px]">
                  <div className="flex justify-between"><span className="text-[#8E8E93]">总时长</span><span className="text-[#1D1D1F]">{overview.duration}</span></div>
                  <div className="flex justify-between"><span className="text-[#8E8E93]">分辨率</span><span className="text-[#1D1D1F]">{overview.resolution}</span></div>
                  <div className="flex justify-between"><span className="text-[#8E8E93]">帧率</span><span className="text-[#1D1D1F]">{overview.fps}</span></div>
                  <div className="flex justify-between"><span className="text-[#8E8E93]">平台</span><span className="text-[#1D1D1F]">{demo.platform}</span></div>
                </div>
              </div>
              <div className="mt-4 rounded-xl border border-[#EAEAEA] bg-[#F5F5F7] py-3 text-center text-[13px] font-semibold text-[#8E8E93]">
                展示模式 · 不可下载 / 不可生成
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex items-center justify-between border-t border-[#EAEAEA] pt-6">
          <button onClick={onPrev} className="rounded-xl border border-[#EAEAEA] bg-white px-5 py-3 text-[13.5px] text-[#444444]">上一步</button>
          <button onClick={() => navigate('/short-drama/create')} className="rounded-xl bg-[#1D1D1F] px-7 py-3 text-[14px] font-semibold text-white">使用此模板创建项目</button>
        </div>
      </div>
    </div>
  );
}
