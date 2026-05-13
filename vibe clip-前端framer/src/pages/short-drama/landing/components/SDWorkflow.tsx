import { useNavigate } from "react-router-dom";

const STEPS = [
  { num: "01", title: "产品输入", desc: "上传产品信息、图片资料，AI 自动解析卖点与品牌调性", icon: "ri-upload-cloud-2-line", color: "#B45309" },
  { num: "02", title: "剧本大纲", desc: "生成 Hook·冲突·反转·结尾完整结构，分段规划节奏", icon: "ri-file-text-line", color: "#DC2626" },
  { num: "03", title: "角色场景", desc: "生成角色设定与场景图，构建可复用的视觉资产库", icon: "ri-user-star-line", color: "#047857" },
  { num: "04", title: "片段视频", desc: "逐镜头脚本 + AI 视频生成，支持多段合成与导出", icon: "ri-movie-2-line", color: "#334155" },
  { num: "05", title: "导出结果", desc: "下载视频、导出脚本和分镜文档，一键完成交付", icon: "ri-download-cloud-line", color: "#1D1D1F" },
];

export default function SDWorkflow() {
  const navigate = useNavigate();

  return (
    <section className="py-24 px-6" style={{ background: "#ffffff" }}>
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-5 text-[11px] font-semibold tracking-widest uppercase"
            style={{ background: "#F5F5F7", color: "#6E6E73", border: "1px solid #EAEAEA" }}
          >
            Workflow
          </div>
          <h2
            className="text-3xl lg:text-4xl font-black mb-4"
            style={{ fontFamily: "'Syne', sans-serif", color: "#1D1D1F" }}
          >
            5 步完成一部短剧广告
          </h2>
          <p className="max-w-lg mx-auto text-[15px]" style={{ color: "#8E8E93" }}>
            结构化工作流，每一步都有清晰产出，团队协作无摩擦
          </p>
        </div>

        {/* Steps */}
        <div className="flex flex-col lg:flex-row items-stretch gap-3">
          {STEPS.map((step, idx) => (
            <div key={step.num} className="flex lg:flex-col items-center flex-1 gap-2">
              <div
                className="rounded-2xl p-5 w-full flex-1 flex flex-col transition-all duration-300 hover:-translate-y-1"
                style={{ background: "#F7F8FA", border: "1px solid #EAEAEA" }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <span
                    className="text-[11px] font-bold tracking-wider"
                    style={{ color: step.color }}
                  >
                    {step.num}
                  </span>
                  <div
                    className="w-7 h-7 flex items-center justify-center rounded-lg"
                    style={{ background: `${step.color}10` }}
                  >
                    <i className={`${step.icon} text-[14px]`} style={{ color: step.color }} />
                  </div>
                </div>
                <h3
                  className="text-[14px] font-bold mb-2"
                  style={{ fontFamily: "'Syne', sans-serif", color: "#1D1D1F" }}
                >
                  {step.title}
                </h3>
                <p className="text-[12px] leading-relaxed flex-1" style={{ color: "#8E8E93" }}>{step.desc}</p>
              </div>
              {/* Arrow */}
              {idx < STEPS.length - 1 && (
                <i className="ri-arrow-right-line text-[16px] shrink-0 hidden lg:block" style={{ color: "#D1D1D6" }} />
              )}
            </div>
          ))}
        </div>

        <div className="text-center mt-12">
          <button
            onClick={() => navigate("/create")}
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl text-[14px] font-semibold cursor-pointer transition-all duration-200 whitespace-nowrap"
            style={{ background: "#1D1D1F", color: "#ffffff" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#374151"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#1D1D1F"; }}
          >
            <i className="ri-add-circle-line text-[14px]" />
            立即开始创建
          </button>
        </div>
      </div>
    </section>
  );
}
