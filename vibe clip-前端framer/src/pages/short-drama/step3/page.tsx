import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import SDSharedNav from "@/pages/short-drama/components/SDSharedNav";
import AssetLightbox, { LightboxItem, LightboxField } from "@/pages/short-drama/step3/components/AssetLightbox";
import AddAssetModal, { AssetType } from "@/pages/short-drama/step3/components/AddAssetModal";

type TabType = "characters" | "scenes" | "assets";

interface CardImageGalleryProps {
  images?: string[];
  img: string;
  alt: string;
  height: string;
  contain?: boolean;
  onOpen: () => void;
  pending?: boolean;
  badge?: React.ReactNode;
}

function CardImageGallery({ images, img, alt, height, contain, onOpen, pending, badge }: CardImageGalleryProps) {
  const allImages = images && images.length > 0 ? images : [img];
  const [activeIdx, setActiveIdx] = useState(0);

  return (
    <div style={{ background: "#F5F5F7" }}>
      <div
        className={`relative w-full ${height} overflow-hidden flex items-center justify-center group cursor-pointer`}
        style={{ background: "#F5F5F7" }}
        onClick={onOpen}
      >
        {pending ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5" style={{ background: "#F9F9FB" }}>
            <div className="w-8 h-8 flex items-center justify-center rounded-xl" style={{ background: "#EAEAEA" }}>
              <i className="ri-time-line text-[15px]" style={{ color: "#AEAEB2" }} />
            </div>
            <span className="text-[11px] font-medium" style={{ color: "#AEAEB2" }}>待生成</span>
          </div>
        ) : (
          <>
            <img
              src={allImages[activeIdx]}
              alt={alt}
              className={`w-full h-full ${contain ? "object-contain" : "object-cover object-center"} transition-opacity duration-200`}
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-200 flex items-end justify-end p-2.5">
              <div
                className="w-7 h-7 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200 translate-y-1 group-hover:translate-y-0"
                style={{ background: "rgba(255,255,255,0.92)", border: "1px solid rgba(0,0,0,0.08)" }}
              >
                <i className="ri-zoom-in-line text-[12px]" style={{ color: "#1D1D1F" }} />
              </div>
            </div>
          </>
        )}
        {badge && <div className="absolute top-2.5 left-2.5">{badge}</div>}
        {!pending && allImages.length > 1 && (
          <div
            className="absolute bottom-2.5 right-2.5 text-[10px] font-medium px-2 py-0.5 rounded-full"
            style={{ background: "rgba(0,0,0,0.45)", color: "#ffffff" }}
          >
            {activeIdx + 1}/{allImages.length}
          </div>
        )}
      </div>

      {!pending && allImages.length > 1 && (
        <div
          className="flex gap-1.5 px-3 py-2"
          style={{ background: "#F0F0F2", borderTop: "1px solid #E8E8EA" }}
          onClick={(e) => e.stopPropagation()}
        >
          {allImages.map((src, idx) => (
            <button
              key={idx}
              onClick={() => setActiveIdx(idx)}
              className="relative flex-shrink-0 rounded-md overflow-hidden cursor-pointer transition-all duration-150"
              style={{
                width: 36,
                height: 28,
                border: idx === activeIdx ? "1.5px solid #1D1D1F" : "1.5px solid transparent",
                outline: "none",
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

interface CharacterItem {
  id: number; name: string; role: string; desc: string;
  tags: string[]; voice: string; img: string; images?: string[];
  pending?: boolean;
}

interface SceneItem {
  id: number; name: string; type: string; desc: string; img: string; images?: string[];
  lighting?: string; mood?: string; camera?: string; segment?: string; pending?: boolean;
}

interface ProductItem {
  id: number; name: string; placement: string; cameraHint: string; img: string; images?: string[];
  style?: string; segment?: string; pending?: boolean;
}

const INIT_CHARACTERS: CharacterItem[] = [
  {
    id: 1, name: "林晓", role: "主角",
    desc: "26岁独立设计师，刚搬入新公寓，性格细腻、有品位，内心渴望建立属于自己的生活空间",
    tags: ["情绪型演员", "写实风格", "25-30岁女性"],
    voice: "温柔知性",
    img: "https://readdy.ai/api/search-image?query=young%20chinese%20professional%20woman%20confident%20elegant%20modern%20outfit%20neutral%20expression%20studio%20portrait%20clean%20white%20background%20cinematic%20lighting%20lifestyle%20advertisement%20commercial%20photography%20realistic&width=200&height=260&seq=char01&orientation=portrait",
    images: [
      "https://readdy.ai/api/search-image?query=young%20chinese%20professional%20woman%20confident%20elegant%20modern%20outfit%20neutral%20expression%20studio%20portrait%20clean%20white%20background%20cinematic%20lighting%20lifestyle%20advertisement%20commercial%20photography%20realistic&width=200&height=260&seq=char01&orientation=portrait",
      "https://readdy.ai/api/search-image?query=young%20asian%20woman%20designer%20casual%20home%20wear%20relaxed%20natural%20light%20indoor%20lifestyle%20photography%20authentic%20expression%20warm%20background%20editorial%20portrait&width=200&height=260&seq=char01b&orientation=portrait",
      "https://readdy.ai/api/search-image?query=young%20chinese%20woman%20side%20profile%20elegant%20posture%20minimal%20fashion%20clean%20studio%20white%20background%20advertisement%20photography%20graceful%20lifestyle%20portrait&width=200&height=260&seq=char01c&orientation=portrait",
    ],
  },
  {
    id: 2, name: "Sarah", role: "朋友/配角",
    desc: "林晓的闺蜜，活泼外向，是剧情中重要的情绪反馈角色，负责触发 Twist 段落的高光反应",
    tags: ["配角", "欧洲风格", "自然表演"],
    voice: "活泼亮丽",
    img: "https://readdy.ai/api/search-image?query=european%20young%20woman%20friend%20casual%20cheerful%20genuine%20smile%20natural%20lifestyle%20portrait%20warm%20lighting%20clean%20background%20commercial%20advertisement%20photography%20authentic%20expression&width=200&height=260&seq=char02&orientation=portrait",
    images: [
      "https://readdy.ai/api/search-image?query=european%20young%20woman%20friend%20casual%20cheerful%20genuine%20smile%20natural%20lifestyle%20portrait%20warm%20lighting%20clean%20background%20commercial%20advertisement%20photography%20authentic%20expression&width=200&height=260&seq=char02&orientation=portrait",
      "https://readdy.ai/api/search-image?query=blonde%20european%20woman%20laughing%20natural%20outdoor%20portrait%20warm%20golden%20hour%20lifestyle%20photography%20editorial%20happy%20expression%20casual%20fashion&width=200&height=260&seq=char02b&orientation=portrait",
    ],
  },
];

const INIT_SCENES: SceneItem[] = [
  {
    id: 101, name: "空旷公寓", type: "室内 · 夜晚", lighting: "冷白人工光",
    mood: "孤独 · 期待", camera: "广角全景 · 慢推镜头", segment: "Segment 1 · Hook段落",
    desc: "全空的新公寓，只有地板和窗帘，冷白色调，强调孤独感，对应 Hook 段落",
    img: "https://readdy.ai/api/search-image?query=empty%20minimalist%20apartment%20interior%20night%20cold%20white%20light%20bare%20wooden%20floor%20large%20windows%20city%20lights%20outside%20cinematic%20lonely%20atmosphere%20wide%20angle%20shot%20realistic%20photography&width=320&height=200&seq=scene01&orientation=landscape",
    images: [
      "https://readdy.ai/api/search-image?query=empty%20minimalist%20apartment%20interior%20night%20cold%20white%20light%20bare%20wooden%20floor%20large%20windows%20city%20lights%20outside%20cinematic%20lonely%20atmosphere%20wide%20angle%20shot%20realistic%20photography&width=320&height=200&seq=scene01&orientation=landscape",
      "https://readdy.ai/api/search-image?query=empty%20apartment%20hallway%20night%20minimal%20bare%20concrete%20floor%20cold%20artificial%20light%20cinematic%20shadows%20atmosphere%20urban%20living%20photography%20wide&width=320&height=200&seq=scene01b&orientation=landscape",
    ],
  },
  {
    id: 102, name: "家居展厅", type: "室内 · 日间", lighting: "大量自然光",
    mood: "探索 · 惊喜", camera: "跟随拍摄 · 货架特写", segment: "Segment 2 · Conflict段落",
    desc: "北欧风格家具展厅，大量自然光，产品展示区，对应 Conflict 产品探索段落",
    img: "https://readdy.ai/api/search-image?query=scandinavian%20furniture%20showroom%20interior%20natural%20daylight%20wooden%20furniture%20display%20clean%20bright%20minimalist%20lifestyle%20store%20wide%20shot%20professional%20photography%20elegant%20retail%20space&width=320&height=200&seq=scene02&orientation=landscape",
    images: [
      "https://readdy.ai/api/search-image?query=scandinavian%20furniture%20showroom%20interior%20natural%20daylight%20wooden%20furniture%20display%20clean%20bright%20minimalist%20lifestyle%20store%20wide%20shot%20professional%20photography%20elegant%20retail%20space&width=320&height=200&seq=scene02&orientation=landscape",
      "https://readdy.ai/api/search-image?query=nordic%20design%20store%20interior%20close%20up%20wooden%20furniture%20detail%20natural%20light%20oak%20texture%20product%20display%20premium%20retail%20lifestyle%20photography&width=320&height=200&seq=scene02b&orientation=landscape",
      "https://readdy.ai/api/search-image?query=minimalist%20furniture%20store%20entrance%20window%20natural%20bright%20light%20scandinavian%20display%20props%20clean%20white%20walls%20wide%20professional%20commercial%20photography%20editorial&width=320&height=200&seq=scene02c&orientation=landscape",
    ],
  },
  {
    id: 103, name: "完整新家", type: "室内 · 黄金时段", lighting: "暖橙色自然光",
    mood: "温暖 · 满足感", camera: "正面全景 · 环绕拍摄", segment: "Segment 4 · Resolution",
    desc: "完成布置的温暖公寓，暖橙色调，北欧家具全貌，对应 Resolution 情绪高潮",
    img: "https://readdy.ai/api/search-image?query=cozy%20nordic%20home%20interior%20golden%20hour%20light%20warm%20wooden%20furniture%20complete%20living%20room%20atmospheric%20lifestyle%20photography%20cinematic%20amber%20tones%20elegant%20comfortable%20premium%20home%20decor&width=320&height=200&seq=scene03&orientation=landscape",
    images: [
      "https://readdy.ai/api/search-image?query=cozy%20nordic%20home%20interior%20golden%20hour%20light%20warm%20wooden%20furniture%20complete%20living%20room%20atmospheric%20lifestyle%20photography%20cinematic%20amber%20tones%20elegant%20comfortable%20premium%20home%20decor&width=320&height=200&seq=scene03&orientation=landscape",
      "https://readdy.ai/api/search-image?query=scandinavian%20living%20room%20dining%20area%20warm%20sunset%20light%20wooden%20table%20chairs%20sofa%20atmospheric%20lifestyle%20complete%20home%20photography%20editorial%20premium&width=320&height=200&seq=scene03b&orientation=landscape",
    ],
  },
];

const INIT_PRODUCTS: ProductItem[] = [
  {
    id: 201, name: "Fjord 实木餐桌", placement: "餐厅主视觉", cameraHint: "45° 俯拍 + 特写木纹",
    style: "北欧极简 · 自然橡木材质", segment: "Segment 3 · Segment 4",
    img: "https://readdy.ai/api/search-image?query=scandinavian%20natural%20wood%20dining%20table%20clean%20white%20background%20product%20photography%20oak%20grain%20detail%20minimalist%20nordic%20design%20premium%20furniture%20studio%20lighting&width=240&height=180&seq=prod01&orientation=landscape",
    images: [
      "https://readdy.ai/api/search-image?query=scandinavian%20natural%20wood%20dining%20table%20clean%20white%20background%20product%20photography%20oak%20grain%20detail%20minimalist%20nordic%20design%20premium%20furniture%20studio%20lighting&width=240&height=180&seq=prod01&orientation=landscape",
      "https://readdy.ai/api/search-image?query=oak%20wood%20dining%20table%20close%20up%20grain%20texture%20detail%20product%20photography%20clean%20minimal%20background%20premium%20nordic%20craftsmanship%20studio&width=240&height=180&seq=prod01b&orientation=landscape",
      "https://readdy.ai/api/search-image?query=nordic%20wooden%20dining%20table%20side%20view%20legs%20detail%20minimal%20white%20studio%20product%20shot%20elegant%20scandinavian%20furniture%20design%20premium&width=240&height=180&seq=prod01c&orientation=landscape",
    ],
  },
  {
    id: 202, name: "Lund 布艺沙发", placement: "客厅焦点", cameraHint: "正面全景 + 材质特写",
    style: "亚麻织物 · 哑光灰米色", segment: "Segment 2 · Segment 4",
    img: "https://readdy.ai/api/search-image?query=modern%20scandinavian%20fabric%20sofa%20clean%20background%20product%20shot%20linen%20texture%20nordic%20minimalist%20furniture%20professional%20studio%20photography%20warm%20light%20elegant&width=240&height=180&seq=prod02&orientation=landscape",
    images: [
      "https://readdy.ai/api/search-image?query=modern%20scandinavian%20fabric%20sofa%20clean%20background%20product%20shot%20linen%20texture%20nordic%20minimalist%20furniture%20professional%20studio%20photography%20warm%20light%20elegant&width=240&height=180&seq=prod02&orientation=landscape",
      "https://readdy.ai/api/search-image?query=linen%20fabric%20sofa%20cushion%20close%20up%20texture%20detail%20studio%20photography%20clean%20minimal%20background%20nordic%20design%20premium%20quality%20craftsmanship&width=240&height=180&seq=prod02b&orientation=landscape",
    ],
  },
  {
    id: 203, name: "Birch 落地灯", placement: "情绪烘托道具", cameraHint: "逆光剪影 + 氛围",
    style: "白桦原木 · 哑白灯罩", segment: "Segment 1 · Segment 4",
    img: "https://readdy.ai/api/search-image?query=minimalist%20scandinavian%20floor%20lamp%20natural%20wood%20base%20white%20shade%20product%20photography%20clean%20background%20nordic%20design%20warm%20ambient%20light%20elegant%20home%20decor&width=240&height=180&seq=prod03&orientation=landscape",
    images: [
      "https://readdy.ai/api/search-image?query=minimalist%20scandinavian%20floor%20lamp%20natural%20wood%20base%20white%20shade%20product%20photography%20clean%20background%20nordic%20design%20warm%20ambient%20light%20elegant%20home%20decor&width=240&height=180&seq=prod03&orientation=landscape",
      "https://readdy.ai/api/search-image?query=floor%20lamp%20backlight%20silhouette%20warm%20glow%20amber%20ambiance%20home%20interior%20minimal%20nordic%20design%20atmospheric%20mood%20photography%20wide&width=240&height=180&seq=prod03b&orientation=landscape",
    ],
  },
];

const TABS: Array<{ key: TabType; label: string; icon: string }> = [
  { key: "characters", label: "角色", icon: "ri-user-star-line" },
  { key: "scenes", label: "场景", icon: "ri-landscape-line" },
  { key: "assets", label: "产品资产", icon: "ri-archive-line" },
];

export default function Step3Page() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>("characters");
  const [lightbox, setLightbox] = useState<LightboxItem | null>(null);
  const [addModal, setAddModal] = useState<{ open: boolean; type: AssetType }>({ open: false, type: "character" });

  const [characters, setCharacters] = useState<CharacterItem[]>(INIT_CHARACTERS);
  const [scenes, setScenes] = useState<SceneItem[]>(INIT_SCENES);
  const [products, setProducts] = useState<ProductItem[]>(INIT_PRODUCTS);

  const tabCounts = {
    characters: characters.length,
    scenes: scenes.length,
    assets: products.length,
  };

  /* ── Open lightbox helpers ── */
  const openCharLightbox = useCallback((char: CharacterItem) => {
    const fields: LightboxField[] = [
      { key: "name", label: "资产名称", value: char.name, icon: "ri-user-star-line" },
      { key: "role", label: "角色定位", value: char.role, icon: "ri-user-line" },
      { key: "voice", label: "音色风格", value: char.voice, icon: "ri-mic-line" },
      { key: "tags", label: "标签", value: char.tags.join(" · "), icon: "ri-price-tag-3-line" },
      { key: "segments", label: "出镜片段", value: "Segment 1 · Segment 3", icon: "ri-film-line" },
      { key: "style", label: "视觉风格", value: "写实电影感 · 日光白平衡", icon: "ri-palette-line" },
      { key: "desc", label: "角色描述 / PMT", value: char.desc, icon: "ri-file-text-line", isPmt: true, multiline: true },
    ];
    setLightbox({ img: char.img, images: char.images, name: char.name, subtitle: char.role, desc: char.desc, tags: char.tags, fields, orientation: "portrait", type: "character" });
  }, []);

  const openSceneLightbox = useCallback((scene: SceneItem) => {
    const fields: LightboxField[] = [
      { key: "name", label: "资产名称", value: scene.name, icon: "ri-landscape-line" },
      { key: "type", label: "场景类型", value: scene.type, icon: "ri-map-pin-line" },
      { key: "lighting", label: "光线设定", value: scene.lighting || "自然光", icon: "ri-sun-line" },
      { key: "mood", label: "情绪氛围", value: scene.mood || "待填写", icon: "ri-emotion-line" },
      { key: "camera", label: "推荐镜头", value: scene.camera || "广角全景", icon: "ri-camera-line" },
      { key: "segment", label: "对应片段", value: scene.segment || "Segment 1", icon: "ri-film-line" },
      { key: "desc", label: "场景描述 / PMT", value: scene.desc, icon: "ri-file-text-line", isPmt: true, multiline: true },
    ];
    setLightbox({ img: scene.img, images: scene.images, name: scene.name, subtitle: scene.type, desc: scene.desc, fields, orientation: "landscape", type: "scene" });
  }, []);

  const openProductLightbox = useCallback((asset: ProductItem) => {
    const fields: LightboxField[] = [
      { key: "name", label: "资产名称", value: asset.name, icon: "ri-archive-line" },
      { key: "placement", label: "出镜方式", value: asset.placement, icon: "ri-camera-line" },
      { key: "style", label: "产品风格", value: asset.style || "北欧极简 · 自然材质", icon: "ri-palette-line" },
      { key: "segment", label: "对应片段", value: asset.segment || "Segment 2 · Segment 4", icon: "ri-film-line" },
      { key: "camera", label: "镜头定位 / PMT", value: asset.cameraHint, icon: "ri-focus-3-line", isPmt: true, multiline: true },
    ];
    setLightbox({ img: asset.img, images: asset.images, name: asset.name, subtitle: asset.placement, desc: `${asset.name}，出镜方式：${asset.placement}`, fields, orientation: "landscape", type: "asset" });
  }, []);

  /* ── Add handlers ── */
  const handleOpenAdd = useCallback((type: AssetType) => {
    setAddModal({ open: true, type });
  }, []);

  const handleAddAsset = useCallback((data: { type: AssetType; name: string; uploadedImg?: string; description?: string }) => {
    const newId = Date.now();
    const pendingImg = "https://readdy.ai/api/search-image?query=blank%20placeholder%20minimal%20light%20gray%20clean%20background%20pending%20generation&width=240&height=200&seq=pending01&orientation=landscape";
    if (data.type === "character") {
      setCharacters(prev => [...prev, { id: newId, name: data.name, role: "待填写", desc: data.description || "待生成", tags: [], voice: "待生成", img: data.uploadedImg || pendingImg, pending: !data.uploadedImg }]);
    } else if (data.type === "scene") {
      setScenes(prev => [...prev, { id: newId, name: data.name, type: "待填写", desc: data.description || "待生成", img: data.uploadedImg || pendingImg, lighting: "待生成", pending: !data.uploadedImg }]);
    } else {
      setProducts(prev => [...prev, { id: newId, name: data.name, placement: "待填写", cameraHint: "待生成", img: data.uploadedImg || pendingImg, pending: !data.uploadedImg }]);
    }
  }, []);

  /* ── Upload ref image handler (card button) ── */
  const handleUploadRef = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    // Just a UI trigger — real upload would be handled here
    e.preventDefault();
  }, []);

  /* ── Shared card button row ── */
  const CardButtons = useCallback(({ onDetail, inputId }: { onDetail: () => void; inputId: string }) => (
    <div className="flex gap-2">
      <button
        onClick={onDetail}
        className="flex-1 py-2 rounded-lg text-[11.5px] font-medium cursor-pointer transition-all duration-200 whitespace-nowrap"
        style={{ background: "#1D1D1F", color: "#ffffff" }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#374151"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#1D1D1F"; }}
      >
        <i className="ri-zoom-in-line text-[11px] mr-1" />
        查看详情
      </button>
      <label
        htmlFor={inputId}
        className="flex-1 py-2 rounded-lg text-[11.5px] cursor-pointer transition-all duration-200 whitespace-nowrap text-center font-medium"
        style={{ background: "#F7F8FA", color: "#444444", border: "1px solid #EAEAEA" }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#EAEAEA"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#F7F8FA"; }}
      >
        <i className="ri-upload-2-line text-[11px] mr-1" />
        上传参考图
        <input id={inputId} type="file" accept="image/*" className="hidden" onChange={handleUploadRef} />
      </label>
    </div>
  ), [handleUploadRef]);

  /* ── Pending badge ── */
  const PendingBadge = () => (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5" style={{ background: "#F9F9FB" }}>
      <div className="w-8 h-8 flex items-center justify-center rounded-xl" style={{ background: "#EAEAEA" }}>
        <i className="ri-time-line text-[15px]" style={{ color: "#AEAEB2" }} />
      </div>
      <span className="text-[11px] font-medium" style={{ color: "#AEAEB2" }}>待生成</span>
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: "#ffffff", fontFamily: "'Inter', sans-serif" }}>
      <SDSharedNav currentStep={3} projectName="北欧家居欧洲市场短剧" />

      <div className="pt-14">
        {/* Page header */}
        <div
          className="px-6 lg:px-10 py-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
          style={{ borderBottom: "1px solid #EAEAEA", background: "#ffffff" }}
        >
          <div>
            <span className="text-[11px] font-bold tracking-widest uppercase" style={{ color: "#8E8E93" }}>STEP 03</span>
            <h1 className="text-2xl font-black mt-0.5" style={{ fontFamily: "'Syne', sans-serif", color: "#1D1D1F" }}>
              角色与场景资产
            </h1>
            <p className="text-[13px] mt-1" style={{ color: "#8E8E93" }}>
              构建可复用的视觉资产库，统一整部短剧的视觉风格
            </p>
          </div>
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

        {/* Content area */}
        <div className="px-6 lg:px-10 py-7">

          {/* ── Characters ── */}
          {activeTab === "characters" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {characters.map((char) => (
                <div
                  key={char.id}
                  className="rounded-2xl overflow-hidden transition-all duration-200"
                  style={{ background: "#ffffff", border: "1px solid #EAEAEA" }}
                >
                  {/* Image area */}
                  <CardImageGallery
                    img={char.img}
                    images={char.images}
                    alt={char.name}
                    height="h-52"
                    contain
                    onOpen={() => openCharLightbox(char)}
                    pending={char.pending}
                    badge={
                      <span
                        className="text-[10px] font-semibold px-2 py-1 rounded-full"
                        style={{ background: "rgba(255,255,255,0.92)", color: "#444444", border: "1px solid rgba(0,0,0,0.06)" }}
                      >
                        {char.role}
                      </span>
                    }
                  />
                  {/* Info */}
                  <div className="p-4">
                    <h3 className="text-[15px] font-bold mb-1.5" style={{ fontFamily: "'Syne', sans-serif", color: "#1D1D1F" }}>
                      {char.name}
                    </h3>
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
                    <div className="flex items-center gap-2 mb-4 p-2 rounded-lg" style={{ background: "#F7F8FA", border: "1px solid #EAEAEA" }}>
                      <i className="ri-mic-line text-[12px]" style={{ color: "#8E8E93" }} />
                      <span className="text-[11.5px]" style={{ color: "#6E6E73" }}>音色：{char.voice}</span>
                    </div>
                    <CardButtons onDetail={() => openCharLightbox(char)} inputId={`upload-char-${char.id}`} />
                  </div>
                </div>
              ))}

              {/* Add character card */}
              <button
                onClick={() => handleOpenAdd("character")}
                className="rounded-2xl flex flex-col items-center justify-center gap-3 cursor-pointer transition-all duration-200 min-h-[320px]"
                style={{ border: "1.5px dashed #D1D1D6", background: "#F7F8FA" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#1D1D1F"; (e.currentTarget as HTMLElement).style.background = "#F5F5F7"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#D1D1D6"; (e.currentTarget as HTMLElement).style.background = "#F7F8FA"; }}
              >
                <div className="w-12 h-12 flex items-center justify-center rounded-2xl" style={{ background: "#EAEAEA" }}>
                  <i className="ri-user-add-line text-[20px]" style={{ color: "#8E8E93" }} />
                </div>
                <span className="text-[13px]" style={{ color: "#8E8E93" }}>添加角色</span>
              </button>
            </div>
          )}

          {/* ── Scenes ── */}
          {activeTab === "scenes" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {scenes.map((scene) => (
                <div
                  key={scene.id}
                  className="rounded-2xl overflow-hidden"
                  style={{ background: "#ffffff", border: "1px solid #EAEAEA" }}
                >
                  <CardImageGallery
                    img={scene.img}
                    images={scene.images}
                    alt={scene.name}
                    height="h-48"
                    onOpen={() => openSceneLightbox(scene)}
                    pending={scene.pending}
                    badge={
                      <span
                        className="text-[10px] font-medium px-2 py-1 rounded-full"
                        style={{ background: "rgba(255,255,255,0.9)", color: "#444444", border: "1px solid rgba(0,0,0,0.06)" }}
                      >
                        {scene.type}
                      </span>
                    }
                  />
                  <div className="p-4">
                    <h3 className="text-[14px] font-bold mb-2" style={{ fontFamily: "'Syne', sans-serif", color: "#1D1D1F" }}>
                      {scene.name}
                    </h3>
                    <p className="text-[12px] leading-relaxed mb-4 line-clamp-2" style={{ color: "#6E6E73" }}>{scene.desc}</p>
                    <CardButtons onDetail={() => openSceneLightbox(scene)} inputId={`upload-scene-${scene.id}`} />
                  </div>
                </div>
              ))}

              {/* Add scene card */}
              <button
                onClick={() => handleOpenAdd("scene")}
                className="rounded-2xl flex flex-col items-center justify-center gap-3 cursor-pointer transition-all duration-200 min-h-[280px]"
                style={{ border: "1.5px dashed #D1D1D6", background: "#F7F8FA" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#1D1D1F"; (e.currentTarget as HTMLElement).style.background = "#F5F5F7"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#D1D1D6"; (e.currentTarget as HTMLElement).style.background = "#F7F8FA"; }}
              >
                <div className="w-12 h-12 flex items-center justify-center rounded-2xl" style={{ background: "#EAEAEA" }}>
                  <i className="ri-landscape-line text-[20px]" style={{ color: "#8E8E93" }} />
                </div>
                <span className="text-[13px]" style={{ color: "#8E8E93" }}>添加场景</span>
              </button>
            </div>
          )}

          {/* ── Product assets ── */}
          {activeTab === "assets" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {products.map((asset) => (
                <div key={asset.id} className="rounded-2xl overflow-hidden" style={{ background: "#ffffff", border: "1px solid #EAEAEA" }}>
                  <CardImageGallery
                    img={asset.img}
                    images={asset.images}
                    alt={asset.name}
                    height="h-44"
                    onOpen={() => openProductLightbox(asset)}
                    pending={asset.pending}
                  />
                  <div className="p-4">
                    <h3 className="text-[14px] font-bold mb-3" style={{ fontFamily: "'Syne', sans-serif", color: "#1D1D1F" }}>
                      {asset.name}
                    </h3>
                    <div className="space-y-2 mb-4">
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
                    </div>
                    <CardButtons onDetail={() => openProductLightbox(asset)} inputId={`upload-asset-${asset.id}`} />
                  </div>
                </div>
              ))}

              {/* Add product card */}
              <button
                onClick={() => handleOpenAdd("asset")}
                className="rounded-2xl flex flex-col items-center justify-center gap-3 cursor-pointer transition-all duration-200 min-h-[280px]"
                style={{ border: "1.5px dashed #D1D1D6", background: "#F7F8FA" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#1D1D1F"; (e.currentTarget as HTMLElement).style.background = "#F5F5F7"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#D1D1D6"; (e.currentTarget as HTMLElement).style.background = "#F7F8FA"; }}
              >
                <div className="w-12 h-12 flex items-center justify-center rounded-2xl" style={{ background: "#EAEAEA" }}>
                  <i className="ri-archive-line text-[20px]" style={{ color: "#8E8E93" }} />
                </div>
                <span className="text-[13px]" style={{ color: "#8E8E93" }}>添加产品</span>
              </button>
            </div>
          )}

          {/* Bottom navigation */}
          <div className="flex items-center justify-between mt-10 pt-6" style={{ borderTop: "1px solid #EAEAEA" }}>
            <button
              onClick={() => navigate("/step2")}
              className="flex items-center gap-2 px-5 py-3 rounded-xl text-[13.5px] cursor-pointer whitespace-nowrap transition-all duration-200"
              style={{ background: "#F7F8FA", color: "#444444", border: "1px solid #EAEAEA" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#EAEAEA"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#F7F8FA"; }}
            >
              <i className="ri-arrow-left-line text-[13px]" />
              上一步
            </button>
            <button
              onClick={() => navigate("/step4")}
              className="flex items-center gap-2 px-7 py-3 rounded-xl text-[14px] font-semibold cursor-pointer transition-all duration-200 whitespace-nowrap"
              style={{ background: "#1D1D1F", color: "#ffffff" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#374151"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#1D1D1F"; }}
            >
              下一步：生成片段脚本
              <i className="ri-arrow-right-line text-[13px]" />
            </button>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      <AssetLightbox item={lightbox} onClose={() => setLightbox(null)} />

      {/* Add modal */}
      <AddAssetModal
        open={addModal.open}
        assetType={addModal.type}
        onClose={() => setAddModal(prev => ({ ...prev, open: false }))}
        onAdd={handleAddAsset}
      />
    </div>
  );
}
