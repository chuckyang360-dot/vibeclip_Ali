import { useState } from "react";
import { useNavigate } from "react-router-dom";
import SDSharedNav from "@/pages/short-drama/components/SDSharedNav";

const MARKETS = ["北美", "欧洲", "东南亚", "中东", "日本/韩国", "澳大利亚", "全球"];
const CATEGORIES = ["家居生活", "美妆护肤", "女装服饰", "男装配件", "3C 数码", "运动健康", "宠物用品", "食品饮料", "珠宝配饰"];

interface ParsedResult {
  summary: string;
  sellingPoints: string[];
  sceneKeywords: string[];
  styleKeywords: string[];
}

const MOCK_PARSED: ParsedResult = {
  summary: "北欧极简风格家居品牌，主打天然木质材料与斯堪的纳维亚设计语言，目标消费群体为 25-40 岁欧洲高收入家庭。",
  sellingPoints: ["天然实木，可持续材料认证", "北欧设计师联名款", "60 天免费退换服务", "模块化组装，适配多种空间"],
  sceneKeywords: ["温暖家居", "北欧光线", "简洁空间", "自然纹理", "日式侘寂感"],
  styleKeywords: ["情绪化", "生活方式", "高级感", "温暖克制"],
};

const mockImgs = [
  "https://readdy.ai/api/search-image?query=minimalist%20scandinavian%20wooden%20furniture%20product%20shot%20white%20background%20clean%20professional%20light%20oak%20texture%20table%20chair%20lifestyle%20interior%20design%20brand%20product%20photography%20natural%20material&width=160&height=160&seq=s1img01&orientation=squarish",
  "https://readdy.ai/api/search-image?query=cozy%20nordic%20home%20interior%20decor%20warm%20lighting%20wooden%20shelves%20plants%20minimalist%20living%20room%20lifestyle%20photography%20professional%20advertisement%20clean%20elegant&width=160&height=160&seq=s1img02&orientation=squarish",
  "https://readdy.ai/api/search-image?query=scandinavian%20bedroom%20furniture%20details%20close%20up%20wood%20grain%20texture%20natural%20material%20premium%20product%20craftsmanship%20white%20background%20studio%20photography&width=160&height=160&seq=s1img03&orientation=squarish",
];

export default function Step1Page() {
  const navigate = useNavigate();
  const [productName, setProductName] = useState("");
  const [category, setCategory] = useState("");
  const [brandName, setBrandName] = useState("");
  const [targetMarket, setTargetMarket] = useState<string[]>([]);
  const [targetUser, setTargetUser] = useState("");
  const [sellingPoints, setSellingPoints] = useState<string[]>(["天然实木材质", "北欧极简设计"]);
  const [newSP, setNewSP] = useState("");
  const [useScene, setUseScene] = useState("");
  const [brandTone, setBrandTone] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [parsed, setParsed] = useState<ParsedResult | null>(null);

  const toggleMarket = (m: string) => {
    setTargetMarket((prev) => prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]);
  };

  const addSP = () => {
    if (newSP.trim()) { setSellingPoints((p) => [...p, newSP.trim()]); setNewSP(""); }
  };
  const removeSP = (idx: number) => setSellingPoints((p) => p.filter((_, i) => i !== idx));

  const handleParse = () => {
    setIsParsing(true);
    setParsed(null);
    setTimeout(() => { setIsParsing(false); setParsed(MOCK_PARSED); }, 2200);
  };

  const inputStyle = {
    background: "#F7F8FA",
    border: "1px solid #EAEAEA",
    color: "#1D1D1F",
  };

  const focusStyle = {
    border: "1px solid #1D1D1F",
    background: "#ffffff",
  };

  const blurStyle = {
    border: "1px solid #EAEAEA",
    background: "#F7F8FA",
  };

  return (
    <div className="min-h-screen" style={{ background: "#F7F8FA", fontFamily: "'Inter', sans-serif" }}>
      <SDSharedNav currentStep={1} projectName="北欧家居欧洲市场短剧" />
      <div className="pt-14">
        <div className="max-w-3xl mx-auto px-6 py-10">
          {/* Page header */}
          <div className="mb-8">
            <span className="text-[11px] font-bold tracking-widest uppercase" style={{ color: "#8E8E93" }}>STEP 01</span>
            <h1 className="text-2xl font-black mt-1" style={{ fontFamily: "'Syne', sans-serif", color: "#1D1D1F" }}>
              产品信息输入
            </h1>
            <p className="text-[13px] mt-1" style={{ color: "#8E8E93" }}>填写越详细，AI 生成的剧情越精准</p>
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
                { label: "产品名称 *", value: productName, setter: setProductName, placeholder: "例如：Fjord 实木餐桌" },
                { label: "品牌名称", value: brandName, setter: setBrandName, placeholder: "例如：NordHome" },
                { label: "目标用户", value: targetUser, setter: setTargetUser, placeholder: "例如：25-40岁欧洲都市家庭" },
              ].map((field) => (
                <div key={field.label}>
                  <label className="block text-[12px] font-medium mb-1.5" style={{ color: "#6E6E73" }}>{field.label}</label>
                  <input
                    value={field.value}
                    onChange={(e) => field.setter(e.target.value)}
                    placeholder={field.placeholder}
                    className="w-full px-3 py-2.5 rounded-lg text-[13px] outline-none transition-all duration-200"
                    style={inputStyle}
                    onFocus={(e) => Object.assign(e.currentTarget.style, focusStyle)}
                    onBlur={(e) => Object.assign(e.currentTarget.style, blurStyle)}
                  />
                </div>
              ))}
              <div>
                <label className="block text-[12px] font-medium mb-1.5" style={{ color: "#6E6E73" }}>产品分类</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg text-[13px] outline-none cursor-pointer"
                  style={{ ...inputStyle, color: category ? "#1D1D1F" : "#AEAEB2" }}
                >
                  <option value="" disabled>选择分类</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-[12px] font-medium mb-2" style={{ color: "#6E6E73" }}>目标市场（可多选）</label>
              <div className="flex flex-wrap gap-2">
                {MARKETS.map((m) => (
                  <button
                    key={m}
                    onClick={() => toggleMarket(m)}
                    className="px-3 py-1.5 rounded-lg text-[12px] font-medium cursor-pointer transition-all duration-150 whitespace-nowrap"
                    style={{
                      background: targetMarket.includes(m) ? "#1D1D1F" : "#F7F8FA",
                      border: `1px solid ${targetMarket.includes(m) ? "#1D1D1F" : "#EAEAEA"}`,
                      color: targetMarket.includes(m) ? "#ffffff" : "#6E6E73",
                    }}
                  >
                    {m}
                  </button>
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
                <div className="flex flex-wrap gap-2 mb-2">
                  {sellingPoints.map((sp, idx) => (
                    <span
                      key={idx}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px]"
                      style={{ background: "#F5F5F7", color: "#1D1D1F", border: "1px solid #E5E5EA" }}
                    >
                      {sp}
                      <button onClick={() => removeSP(idx)} className="cursor-pointer" style={{ color: "#8E8E93" }}>
                        <i className="ri-close-line text-[11px]" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    value={newSP}
                    onChange={(e) => setNewSP(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") addSP(); }}
                    placeholder="输入卖点，回车添加"
                    className="flex-1 px-3 py-2.5 rounded-lg text-[13px] outline-none"
                    style={inputStyle}
                    onFocus={(e) => Object.assign(e.currentTarget.style, focusStyle)}
                    onBlur={(e) => Object.assign(e.currentTarget.style, blurStyle)}
                  />
                  <button
                    onClick={addSP}
                    className="px-4 py-2.5 rounded-lg text-[13px] font-medium cursor-pointer whitespace-nowrap transition-colors"
                    style={{ background: "#F5F5F7", color: "#444444", border: "1px solid #EAEAEA" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#1D1D1F"; (e.currentTarget as HTMLElement).style.color = "#ffffff"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#F5F5F7"; (e.currentTarget as HTMLElement).style.color = "#444444"; }}
                  >
                    添加
                  </button>
                </div>
              </div>
              {[
                { label: "使用场景", value: useScene, setter: setUseScene, placeholder: "例如：周末家庭聚餐、北欧风居家改造、搬入新家" },
                { label: "品牌调性", value: brandTone, setter: setBrandTone, placeholder: "例如：温暖、自然、克制、可持续、高级感" },
              ].map((field) => (
                <div key={field.label}>
                  <label className="block text-[12px] font-medium mb-1.5" style={{ color: "#6E6E73" }}>{field.label}</label>
                  <textarea
                    value={field.value}
                    onChange={(e) => field.setter(e.target.value)}
                    placeholder={field.placeholder}
                    rows={2}
                    className="w-full px-3 py-2.5 rounded-lg text-[13px] outline-none resize-none"
                    style={inputStyle}
                    onFocus={(e) => Object.assign(e.currentTarget.style, focusStyle)}
                    onBlur={(e) => Object.assign(e.currentTarget.style, blurStyle)}
                  />
                </div>
              ))}
            </div>
          </section>

          {/* Block 3: Upload */}
          <section className="mb-6 p-6 rounded-2xl" style={{ background: "#ffffff", border: "1px solid #EAEAEA" }}>
            <h2 className="text-[13px] font-bold mb-5 flex items-center gap-2" style={{ color: "#444444" }}>
              <div className="w-6 h-6 flex items-center justify-center rounded-lg" style={{ background: "#F5F5F7" }}>
                <i className="ri-image-add-line text-[12px]" style={{ color: "#1D1D1F" }} />
              </div>
              资料上传
            </h2>
            <div className="grid grid-cols-5 gap-3 mb-4">
              {mockImgs.map((src, idx) => (
                <div
                  key={idx}
                  className="relative w-full aspect-square rounded-xl overflow-hidden group cursor-pointer"
                  style={{ border: "1px solid #EAEAEA" }}
                >
                  <img src={src} alt="" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-all duration-200 flex items-center justify-center">
                    <i className="ri-zoom-in-line text-white text-[18px] opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                  </div>
                </div>
              ))}
              <button
                className="aspect-square rounded-xl flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all duration-200"
                style={{ border: "1.5px dashed #D1D1D6", background: "#F7F8FA" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#1D1D1F"; (e.currentTarget as HTMLElement).style.background = "#F5F5F7"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#D1D1D6"; (e.currentTarget as HTMLElement).style.background = "#F7F8FA"; }}
              >
                <i className="ri-add-line text-[20px]" style={{ color: "#AEAEB2" }} />
                <span className="text-[10px]" style={{ color: "#AEAEB2" }}>上传</span>
              </button>
              <button
                className="aspect-square rounded-xl flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all duration-200"
                style={{ border: "1.5px dashed #D1D1D6", background: "#F7F8FA" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#1D1D1F"; (e.currentTarget as HTMLElement).style.background = "#F5F5F7"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#D1D1D6"; (e.currentTarget as HTMLElement).style.background = "#F7F8FA"; }}
              >
                <i className="ri-add-line text-[20px]" style={{ color: "#AEAEB2" }} />
                <span className="text-[10px]" style={{ color: "#AEAEB2" }}>上传</span>
              </button>
            </div>
            <div className="flex gap-3">
              {["上传企业介绍资料", "上传产品详情截图"].map((label) => (
                <button
                  key={label}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[12.5px] cursor-pointer transition-all duration-200 whitespace-nowrap"
                  style={{ border: "1.5px dashed #D1D1D6", background: "#F7F8FA", color: "#8E8E93" }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = "#1D1D1F";
                    (e.currentTarget as HTMLElement).style.color = "#1D1D1F";
                    (e.currentTarget as HTMLElement).style.background = "#F5F5F7";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = "#D1D1D6";
                    (e.currentTarget as HTMLElement).style.color = "#8E8E93";
                    (e.currentTarget as HTMLElement).style.background = "#F7F8FA";
                  }}
                >
                  <i className="ri-file-upload-line text-[14px]" />
                  {label}
                </button>
              ))}
            </div>
          </section>

          {/* Parse CTA */}
          <div className="flex justify-center mb-6">
            <button
              onClick={handleParse}
              disabled={isParsing}
              className="flex items-center gap-2.5 px-8 py-3.5 rounded-xl text-[14px] font-semibold cursor-pointer transition-all duration-200 whitespace-nowrap"
              style={{ background: isParsing ? "#F5F5F7" : "#1D1D1F", color: isParsing ? "#8E8E93" : "#ffffff", border: "none" }}
              onMouseEnter={(e) => { if (!isParsing) (e.currentTarget as HTMLElement).style.background = "#374151"; }}
              onMouseLeave={(e) => { if (!isParsing) (e.currentTarget as HTMLElement).style.background = "#1D1D1F"; }}
            >
              {isParsing ? (
                <><i className="ri-loader-4-line animate-spin text-[14px]" />AI 正在解析产品信息...</>
              ) : (
                <><i className="ri-sparkling-2-line text-[14px]" />解析产品信息</>
              )}
            </button>
          </div>

          {/* AI Parse Result Panel */}
          {(isParsing || parsed) && (
            <section
              className="mb-6 rounded-2xl overflow-hidden transition-all duration-300"
              style={{ border: "1px solid #EAEAEA", background: "#ffffff" }}
            >
              {/* Panel header */}
              <div
                className="flex items-center gap-3 px-6 py-4"
                style={{ background: "#F5F5F7", borderBottom: "1px solid #EAEAEA" }}
              >
                <div className="w-7 h-7 flex items-center justify-center rounded-lg" style={{ background: "#1D1D1F" }}>
                  <i className="ri-sparkling-2-line text-[13px] text-white" />
                </div>
                <span className="text-[13px] font-bold" style={{ color: "#1D1D1F" }}>AI 解析结果</span>
                {parsed && (
                  <span
                    className="ml-auto flex items-center gap-1.5 text-[11.5px] font-medium px-2.5 py-1 rounded-full"
                    style={{ background: "rgba(4,120,87,0.08)", color: "#047857", border: "1px solid rgba(4,120,87,0.18)" }}
                  >
                    <i className="ri-checkbox-circle-line text-[13px]" />
                    解析完成
                  </span>
                )}
              </div>

              {/* Loading state */}
              {isParsing && (
                <div className="px-6 py-10 flex flex-col items-center gap-4">
                  <div className="flex gap-1.5 items-center">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className="w-1.5 h-1.5 rounded-full"
                        style={{
                          background: "#1D1D1F",
                          animation: `pulse 1.2s ease-in-out ${i * 0.15}s infinite`,
                          opacity: 0.4,
                        }}
                      />
                    ))}
                  </div>
                  <p className="text-[13px]" style={{ color: "#8E8E93" }}>AI 正在理解产品信息，提炼关键内容...</p>
                </div>
              )}

              {/* Parsed result */}
              {parsed && (
                <div className="p-6 space-y-6">
                  {/* Summary */}
                  <div>
                    <p className="text-[11px] font-bold mb-2.5 uppercase tracking-wider" style={{ color: "#8E8E93" }}>产品摘要</p>
                    <p className="text-[13.5px] leading-relaxed p-4 rounded-xl" style={{ color: "#444444", background: "#F7F8FA", border: "1px solid #EAEAEA" }}>
                      {parsed.summary}
                    </p>
                  </div>

                  {/* Keywords grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                    {[
                      { label: "卖点提炼", items: parsed.sellingPoints, color: "#B45309", bg: "rgba(180,83,9,0.06)", borderC: "rgba(180,83,9,0.15)" },
                      { label: "场景关键词", items: parsed.sceneKeywords, color: "#047857", bg: "rgba(4,120,87,0.06)", borderC: "rgba(4,120,87,0.15)" },
                      { label: "风格关键词", items: parsed.styleKeywords, color: "#334155", bg: "rgba(51,65,85,0.06)", borderC: "rgba(51,65,85,0.15)" },
                    ].map((block) => (
                      <div
                        key={block.label}
                        className="p-4 rounded-xl"
                        style={{ background: block.bg, border: `1px solid ${block.borderC}` }}
                      >
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
              )}
            </section>
          )}

          {/* Bottom navigation */}
          <div className="flex items-center justify-between gap-4">
            <button
              onClick={() => navigate("/create")}
              className="flex items-center gap-2 px-5 py-3 rounded-xl text-[13.5px] cursor-pointer whitespace-nowrap transition-all duration-200"
              style={{ background: "#ffffff", color: "#444444", border: "1px solid #EAEAEA" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#F5F5F7"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#ffffff"; }}
            >
              <i className="ri-arrow-left-line text-[13px]" />
              返回
            </button>
            <button
              onClick={() => navigate("/step2")}
              className="flex items-center gap-2 px-7 py-3 rounded-xl text-[14px] font-semibold cursor-pointer transition-all duration-200 whitespace-nowrap"
              style={{ background: "#1D1D1F", color: "#ffffff" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#374151"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#1D1D1F"; }}
            >
              下一步：生成剧本
              <i className="ri-arrow-right-line text-[13px]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
