import { DemoCaseConfig } from "@/mocks/demoCases";

interface Props {
  demo: DemoCaseConfig;
  onNext: () => void;
  onPrev: () => void;
}

export default function DemoStep1({ demo, onNext, onPrev }: Props) {
  const { step1 } = demo;

  const inputStyle = {
    background: "#F7F8FA",
    border: "1px solid #EAEAEA",
    color: "#1D1D1F",
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <div className="mb-8">
        <span className="text-[11px] font-bold tracking-widest uppercase" style={{ color: "#8E8E93" }}>STEP 01</span>
        <h1 className="text-2xl font-black mt-1" style={{ fontFamily: "'Syne', sans-serif", color: "#1D1D1F" }}>
          产品信息输入
        </h1>
        <p className="text-[13px] mt-1" style={{ color: "#8E8E93" }}>以下是 {demo.title} 的产品信息配置</p>
      </div>

      {/* Block 1: Basic info */}
      <section className="mb-4 p-6 rounded-2xl" style={{ background: "#ffffff", border: "1px solid #EAEAEA" }}>
        <h2 className="text-[13px] font-bold mb-5 flex items-center gap-2" style={{ color: "#444444" }}>
          <div className="w-6 h-6 flex items-center justify-center rounded-lg" style={{ background: "#F5F5F7" }}>
            <i className="ri-information-line text-[12px]" style={{ color: "#1D1D1F" }} />
          </div>
          基础信息
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { label: "产品名称", value: step1.productName },
            { label: "品牌名称", value: step1.brandName },
            { label: "目标用户", value: step1.targetUser },
            { label: "产品分类", value: step1.category },
          ].map((field) => (
            <div key={field.label}>
              <label className="block text-[12px] font-medium mb-1.5" style={{ color: "#6E6E73" }}>{field.label}</label>
              <div className="w-full px-3 py-2.5 rounded-lg text-[13px]" style={inputStyle}>
                {field.value}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4">
          <label className="block text-[12px] font-medium mb-2" style={{ color: "#6E6E73" }}>目标市场</label>
          <div className="flex flex-wrap gap-2">
            {["北美", "欧洲", "东南亚", "中东", "日本/韩国", "澳大利亚", "全球"].map((m) => (
              <div
                key={m}
                className="px-3 py-1.5 rounded-lg text-[12px] font-medium whitespace-nowrap"
                style={{
                  background: step1.targetMarket.includes(m) ? "#1D1D1F" : "#F7F8FA",
                  border: `1px solid ${step1.targetMarket.includes(m) ? "#1D1D1F" : "#EAEAEA"}`,
                  color: step1.targetMarket.includes(m) ? "#ffffff" : "#6E6E73",
                }}
              >
                {m}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Block 2: Product description */}
      <section className="mb-4 p-6 rounded-2xl" style={{ background: "#ffffff", border: "1px solid #EAEAEA" }}>
        <h2 className="text-[13px] font-bold mb-5 flex items-center gap-2" style={{ color: "#444444" }}>
          <div className="w-6 h-6 flex items-center justify-center rounded-lg" style={{ background: "#F5F5F7" }}>
            <i className="ri-file-list-3-line text-[12px]" style={{ color: "#1D1D1F" }} />
          </div>
          产品描述
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-[12px] font-medium mb-2" style={{ color: "#6E6E73" }}>核心卖点</label>
            <div className="flex flex-wrap gap-2">
              {step1.sellingPoints.map((sp) => (
                <span
                  key={sp}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px]"
                  style={{ background: "#F5F5F7", color: "#1D1D1F", border: "1px solid #E5E5EA" }}
                >
                  {sp}
                </span>
              ))}
            </div>
          </div>
          {[
            { label: "使用场景", value: step1.useScene },
            { label: "品牌调性", value: step1.brandTone },
          ].map((field) => (
            <div key={field.label}>
              <label className="block text-[12px] font-medium mb-1.5" style={{ color: "#6E6E73" }}>{field.label}</label>
              <div className="w-full px-3 py-2.5 rounded-lg text-[13px] leading-relaxed" style={inputStyle}>
                {field.value}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Block 3: Uploaded images */}
      <section className="mb-6 p-6 rounded-2xl" style={{ background: "#ffffff", border: "1px solid #EAEAEA" }}>
        <h2 className="text-[13px] font-bold mb-5 flex items-center gap-2" style={{ color: "#444444" }}>
          <div className="w-6 h-6 flex items-center justify-center rounded-lg" style={{ background: "#F5F5F7" }}>
            <i className="ri-image-add-line text-[12px]" style={{ color: "#1D1D1F" }} />
          </div>
          产品图片
        </h2>
        <div className="grid grid-cols-5 gap-3">
          {step1.imgs.map((src, idx) => (
            <div
              key={idx}
              className="relative w-full aspect-square rounded-xl overflow-hidden"
              style={{ border: "1px solid #EAEAEA" }}
            >
              <img src={src} alt="" className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
      </section>

      {/* AI Parse Result */}
      <section className="mb-6 rounded-2xl overflow-hidden" style={{ border: "1px solid #EAEAEA", background: "#ffffff" }}>
        <div
          className="flex items-center gap-3 px-6 py-4"
          style={{ background: "#F5F5F7", borderBottom: "1px solid #EAEAEA" }}
        >
          <div className="w-7 h-7 flex items-center justify-center rounded-lg" style={{ background: "#1D1D1F" }}>
            <i className="ri-sparkling-2-line text-[13px] text-white" />
          </div>
          <span className="text-[13px] font-bold" style={{ color: "#1D1D1F" }}>AI 解析结果</span>
          <span
            className="ml-auto flex items-center gap-1.5 text-[11.5px] font-medium px-2.5 py-1 rounded-full"
            style={{ background: "rgba(4,120,87,0.08)", color: "#047857", border: "1px solid rgba(4,120,87,0.18)" }}
          >
            <i className="ri-checkbox-circle-line text-[13px]" />
            解析完成
          </span>
        </div>
        <div className="p-6 space-y-6">
          <div>
            <p className="text-[11px] font-bold mb-2.5 uppercase tracking-wider" style={{ color: "#8E8E93" }}>产品摘要</p>
            <p className="text-[13.5px] leading-relaxed p-4 rounded-xl" style={{ color: "#444444", background: "#F7F8FA", border: "1px solid #EAEAEA" }}>
              {step1.parsedSummary}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {[
              { label: "卖点提炼", items: step1.parsedSellingPoints, color: "#B45309", bg: "rgba(180,83,9,0.06)", borderC: "rgba(180,83,9,0.15)" },
              { label: "场景关键词", items: step1.parsedSceneKeywords, color: "#047857", bg: "rgba(4,120,87,0.06)", borderC: "rgba(4,120,87,0.15)" },
              { label: "风格关键词", items: step1.parsedStyleKeywords, color: "#334155", bg: "rgba(51,65,85,0.06)", borderC: "rgba(51,65,85,0.15)" },
            ].map((block) => (
              <div key={block.label} className="p-4 rounded-xl" style={{ background: block.bg, border: `1px solid ${block.borderC}` }}>
                <p className="text-[11px] font-bold mb-3 uppercase tracking-wider" style={{ color: block.color }}>
                  {block.label}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {block.items.map((item) => (
                    <span
                      key={item}
                      className="text-[11.5px] px-2.5 py-1 rounded-full font-medium"
                      style={{ background: "rgba(255,255,255,0.7)", color: block.color, border: `1px solid ${block.borderC}` }}
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="flex items-center justify-between gap-4">
        <button
          onClick={onPrev}
          className="flex items-center gap-2 px-5 py-3 rounded-xl text-[13.5px] cursor-pointer whitespace-nowrap transition-all duration-200"
          style={{ background: "#ffffff", color: "#444444", border: "1px solid #EAEAEA" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#F5F5F7"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#ffffff"; }}
        >
          <i className="ri-arrow-left-line text-[13px]" />
          上一步
        </button>
        <button
          onClick={onNext}
          className="flex items-center gap-2 px-7 py-3 rounded-xl text-[14px] font-semibold cursor-pointer transition-all duration-200 whitespace-nowrap"
          style={{ background: "#1D1D1F", color: "#ffffff" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#374151"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#1D1D1F"; }}
        >
          查看剧本大纲
          <i className="ri-arrow-right-line text-[13px]" />
        </button>
      </div>
    </div>
  );
}
