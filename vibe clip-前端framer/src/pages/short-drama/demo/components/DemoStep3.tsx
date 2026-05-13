import { useState } from "react";
import { DemoCaseConfig } from "@/mocks/demoCases";

type TabType = "characters" | "scenes" | "assets";

interface Props {
  demo: DemoCaseConfig;
  onNext: () => void;
  onPrev: () => void;
}

interface GalleryProps {
  images?: string[];
  img: string;
  alt: string;
  height: string;
  contain?: boolean;
}

function ReadonlyGallery({ images, img, alt, height, contain }: GalleryProps) {
  const allImages = images && images.length > 0 ? images : [img];
  const [activeIdx, setActiveIdx] = useState(0);

  return (
    <div style={{ background: "#F5F5F7" }}>
      <div className={`relative w-full ${height} overflow-hidden flex items-center justify-center`} style={{ background: "#F5F5F7" }}>
        <img
          src={allImages[activeIdx]}
          alt={alt}
          className={`w-full h-full ${contain ? "object-contain" : "object-cover object-center"}`}
        />
        {allImages.length > 1 && (
          <div
            className="absolute bottom-2.5 right-2.5 text-[10px] font-medium px-2 py-0.5 rounded-full"
            style={{ background: "rgba(0,0,0,0.45)", color: "#ffffff" }}
          >
            {activeIdx + 1}/{allImages.length}
          </div>
        )}
      </div>
      {allImages.length > 1 && (
        <div
          className="flex gap-1.5 px-3 py-2"
          style={{ background: "#F0F0F2", borderTop: "1px solid #E8E8EA" }}
        >
          {allImages.map((src, idx) => (
            <button
              key={idx}
              onClick={() => setActiveIdx(idx)}
              className="relative flex-shrink-0 rounded-md overflow-hidden cursor-pointer"
              style={{
                width: 36, height: 28,
                border: idx === activeIdx ? "1.5px solid #1D1D1F" : "1.5px solid transparent",
              }}
            >
              <img src={src} alt={`${alt}-${idx + 1}`} className="w-full h-full object-cover" />
              {idx !== activeIdx && (
                <div className="absolute inset-0" style={{ background: "rgba(255,255,255,0.35)" }} />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const TABS: Array<{ key: TabType; label: string; icon: string }> = [
  { key: "characters", label: "角色", icon: "ri-user-star-line" },
  { key: "scenes", label: "场景", icon: "ri-landscape-line" },
  { key: "assets", label: "产品资产", icon: "ri-archive-line" },
];

export default function DemoStep3({ demo, onNext, onPrev }: Props) {
  const { step3 } = demo;
  const [activeTab, setActiveTab] = useState<TabType>("characters");

  const tabCounts = {
    characters: step3.characters.length,
    scenes: step3.scenes.length,
    assets: step3.products.length,
  };

  return (
    <div style={{ background: "#ffffff" }}>
      {/* Page header */}
      <div
        className="px-6 lg:px-10 py-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
        style={{ borderBottom: "1px solid #EAEAEA" }}
      >
        <div>
          <span className="text-[11px] font-bold tracking-widest uppercase" style={{ color: "#8E8E93" }}>STEP 03</span>
          <h1 className="text-2xl font-black mt-0.5" style={{ fontFamily: "'Syne', sans-serif", color: "#1D1D1F" }}>
            角色与场景资产
          </h1>
          <p className="text-[13px] mt-1" style={{ color: "#8E8E93" }}>
            {demo.title} 的视觉资产库
          </p>
        </div>
        <span
          className="flex items-center gap-1.5 text-[11.5px] font-medium px-3 py-1.5 rounded-full"
          style={{ background: "rgba(4,120,87,0.08)", color: "#047857", border: "1px solid rgba(4,120,87,0.18)" }}
        >
          <i className="ri-sparkling-2-line text-[12px]" />
          AI 已生成
        </span>
      </div>

      {/* Tabs */}
      <div className="px-6 lg:px-10 pt-5 pb-0">
        <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: "#F5F5F7", border: "1px solid #EAEAEA" }}>
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-[13px] font-medium cursor-pointer transition-all duration-200 whitespace-nowrap"
              style={{
                background: activeTab === tab.key ? "#ffffff" : "transparent",
                color: activeTab === tab.key ? "#1D1D1F" : "#8E8E93",
                border: activeTab === tab.key ? "1px solid #EAEAEA" : "1px solid transparent",
                boxShadow: activeTab === tab.key ? "0 1px 4px rgba(0,0,0,0.06)" : "none",
              }}
            >
              <i className={`${tab.icon} text-[13px]`} />
              {tab.label}
              <span
                className="text-[11px] px-1.5 py-0.5 rounded-full"
                style={{
                  background: activeTab === tab.key ? "#F5F5F7" : "#EAEAEA",
                  color: activeTab === tab.key ? "#444444" : "#8E8E93",
                }}
              >
                {tabCounts[tab.key]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-6 lg:px-10 py-7">
        {/* Characters */}
        {activeTab === "characters" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {step3.characters.map((char) => (
              <div key={char.id} className="rounded-2xl overflow-hidden" style={{ background: "#ffffff", border: "1px solid #EAEAEA" }}>
                <ReadonlyGallery img={char.img} images={char.images} alt={char.name} height="h-52" contain />
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-[15px] font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "#1D1D1F" }}>
                      {char.name}
                    </h3>
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: "#F5F5F7", color: "#6E6E73", border: "1px solid #EAEAEA" }}
                    >
                      {char.role}
                    </span>
                  </div>
                  <p className="text-[12px] leading-relaxed mb-3 line-clamp-2" style={{ color: "#6E6E73" }}>{char.desc}</p>
                  {char.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {char.tags.map((tag) => (
                        <span key={tag} className="text-[10px] px-2 py-1 rounded-full" style={{ background: "#F5F5F7", color: "#6E6E73" }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-2 p-2 rounded-lg" style={{ background: "#F7F8FA", border: "1px solid #EAEAEA" }}>
                    <i className="ri-mic-line text-[12px]" style={{ color: "#8E8E93" }} />
                    <span className="text-[11.5px]" style={{ color: "#6E6E73" }}>音色：{char.voice}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Scenes */}
        {activeTab === "scenes" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {step3.scenes.map((scene) => (
              <div key={scene.id} className="rounded-2xl overflow-hidden" style={{ background: "#ffffff", border: "1px solid #EAEAEA" }}>
                <ReadonlyGallery img={scene.img} images={scene.images} alt={scene.name} height="h-48" />
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-[14px] font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "#1D1D1F" }}>
                      {scene.name}
                    </h3>
                    <span
                      className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                      style={{ background: "#F5F5F7", color: "#6E6E73", border: "1px solid #EAEAEA" }}
                    >
                      {scene.type}
                    </span>
                  </div>
                  <p className="text-[12px] leading-relaxed mb-3 line-clamp-2" style={{ color: "#6E6E73" }}>{scene.desc}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {scene.lighting && (
                      <div className="flex items-center gap-1.5 p-2 rounded-lg" style={{ background: "#F7F8FA", border: "1px solid #EAEAEA" }}>
                        <i className="ri-sun-line text-[11px]" style={{ color: "#AEAEB2" }} />
                        <span className="text-[11px]" style={{ color: "#6E6E73" }}>{scene.lighting}</span>
                      </div>
                    )}
                    {scene.mood && (
                      <div className="flex items-center gap-1.5 p-2 rounded-lg" style={{ background: "#F7F8FA", border: "1px solid #EAEAEA" }}>
                        <i className="ri-emotion-line text-[11px]" style={{ color: "#AEAEB2" }} />
                        <span className="text-[11px]" style={{ color: "#6E6E73" }}>{scene.mood}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Products */}
        {activeTab === "assets" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {step3.products.map((asset) => (
              <div key={asset.id} className="rounded-2xl overflow-hidden" style={{ background: "#ffffff", border: "1px solid #EAEAEA" }}>
                <ReadonlyGallery img={asset.img} images={asset.images} alt={asset.name} height="h-44" />
                <div className="p-4">
                  <h3 className="text-[14px] font-bold mb-3" style={{ fontFamily: "'Syne', sans-serif", color: "#1D1D1F" }}>
                    {asset.name}
                  </h3>
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <i className="ri-camera-line text-[11px] mt-0.5" style={{ color: "#AEAEB2" }} />
                      <div>
                        <p className="text-[10px] mb-0.5" style={{ color: "#AEAEB2" }}>出镜方式</p>
                        <p className="text-[12px]" style={{ color: "#444444" }}>{asset.placement}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <i className="ri-focus-3-line text-[11px] mt-0.5" style={{ color: "#AEAEB2" }} />
                      <div>
                        <p className="text-[10px] mb-0.5" style={{ color: "#AEAEB2" }}>镜头定位</p>
                        <p className="text-[12px]" style={{ color: "#444444" }}>{asset.cameraHint}</p>
                      </div>
                    </div>
                    {asset.style && (
                      <div className="flex items-start gap-2">
                        <i className="ri-palette-line text-[11px] mt-0.5" style={{ color: "#AEAEB2" }} />
                        <div>
                          <p className="text-[10px] mb-0.5" style={{ color: "#AEAEB2" }}>产品风格</p>
                          <p className="text-[12px]" style={{ color: "#444444" }}>{asset.style}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Bottom nav */}
        <div className="flex items-center justify-between mt-10 pt-6" style={{ borderTop: "1px solid #EAEAEA" }}>
          <button
            onClick={onPrev}
            className="flex items-center gap-2 px-5 py-3 rounded-xl text-[13.5px] cursor-pointer whitespace-nowrap transition-all duration-200"
            style={{ background: "#F7F8FA", color: "#444444", border: "1px solid #EAEAEA" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#EAEAEA"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#F7F8FA"; }}
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
            查看最终成片
            <i className="ri-arrow-right-line text-[13px]" />
          </button>
        </div>
      </div>
    </div>
  );
}
