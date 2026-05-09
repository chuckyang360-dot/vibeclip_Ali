import type { DemoCaseConfig } from '../../short-drama/data/demoCases';

interface Props {
  demo: DemoCaseConfig;
  onNext: () => void;
  onPrev: () => void;
}

export function DemoStep1({ demo, onNext, onPrev }: Props) {
  const { step1 } = demo;
  const inputStyle = { background: '#F7F8FA', border: '1px solid #EAEAEA', color: '#1D1D1F' } as const;
  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-black text-[#1D1D1F]">S1 内容理解</h1>
      <p className="mt-1 text-[13px] text-[#8E8E93]">以下是 {demo.title} 的产品输入与识别结果</p>
      <section className="mt-6 rounded-2xl border border-[#EAEAEA] bg-white p-6">
        <h2 className="mb-5 text-[13px] font-bold text-[#444444]">基础信息</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[{ label: '产品名称', value: step1.productName }, { label: '品牌名称', value: step1.brandName }, { label: '目标用户', value: step1.targetUser }, { label: '产品分类', value: step1.category }].map((field) => (
            <div key={field.label}>
              <label className="mb-1.5 block text-[12px] font-medium text-[#6E6E73]">{field.label}</label>
              <div className="rounded-lg px-3 py-2.5 text-[13px]" style={inputStyle}>{field.value}</div>
            </div>
          ))}
        </div>
      </section>
      <section className="mt-4 rounded-2xl border border-[#EAEAEA] bg-white p-6">
        <h2 className="mb-5 text-[13px] font-bold text-[#444444]">产品描述</h2>
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-[12px] font-medium text-[#6E6E73]">核心卖点</label>
            <div className="flex flex-wrap gap-2">
              {step1.sellingPoints.map((sp) => (
                <span key={sp} className="rounded-lg border border-[#E5E5EA] bg-[#F5F5F7] px-3 py-1.5 text-[12px] text-[#1D1D1F]">{sp}</span>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-[#6E6E73]">使用场景</label>
            <div className="rounded-lg px-3 py-2.5 text-[13px]" style={inputStyle}>{step1.useScene}</div>
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-[#6E6E73]">品牌调性</label>
            <div className="rounded-lg px-3 py-2.5 text-[13px]" style={inputStyle}>{step1.brandTone}</div>
          </div>
        </div>
      </section>
      <section className="mt-4 rounded-2xl border border-[#EAEAEA] bg-white p-6">
        <h2 className="mb-5 text-[13px] font-bold text-[#444444]">产品图片</h2>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {step1.imgs.map((src, idx) => (
            <div key={idx} className="aspect-square overflow-hidden rounded-xl border border-[#EAEAEA]">
              <img src={src} alt="" className="h-full w-full object-cover" />
            </div>
          ))}
        </div>
      </section>
      <section className="mt-4 overflow-hidden rounded-2xl border border-[#EAEAEA] bg-white">
        <div className="flex items-center gap-3 border-b border-[#EAEAEA] bg-[#F5F5F7] px-6 py-4">
          <span className="text-[13px] font-bold text-[#1D1D1F]">AI 识别结果</span>
        </div>
        <div className="space-y-6 p-6">
          <p className="rounded-xl border border-[#EAEAEA] bg-[#F7F8FA] p-4 text-[13.5px] leading-relaxed text-[#444444]">{step1.parsedSummary}</p>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            {[{ label: '卖点提炼', items: step1.parsedSellingPoints }, { label: '场景关键词', items: step1.parsedSceneKeywords }, { label: '风格关键词', items: step1.parsedStyleKeywords }].map((block) => (
              <div key={block.label} className="rounded-xl border border-[#EAEAEA] bg-[#F7F8FA] p-4">
                <p className="mb-3 text-[11px] font-bold tracking-wider text-[#8E8E93]">{block.label}</p>
                <div className="flex flex-wrap gap-1.5">
                  {block.items.map((item) => (
                    <span key={item} className="rounded-full border border-[#EAEAEA] bg-white px-2.5 py-1 text-[11.5px] text-[#444444]">{item}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      <div className="mt-6 flex items-center justify-between">
        <button onClick={onPrev} className="rounded-xl border border-[#EAEAEA] bg-white px-5 py-3 text-[13.5px] text-[#444444]">上一步</button>
        <button onClick={onNext} className="rounded-xl bg-[#1D1D1F] px-7 py-3 text-[14px] font-semibold text-white">查看 S2 策略与脚本</button>
      </div>
    </div>
  );
}
