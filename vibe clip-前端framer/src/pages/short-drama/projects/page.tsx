import { useState } from "react";
import { useNavigate } from "react-router-dom";
import UserDropdown from "@/components/feature/UserDropdown";

interface Project {
  id: string;
  name: string;
  editPage: string;
  status: "制作中" | "已完成" | "待审核" | "草稿";
  updatedAt: string;
  cover: string;
}

const MOCK_PROJECTS: Project[] = [
  {
    id: "SD-20240301-001",
    name: "护肤精华·28天蜕变日记",
    editPage: "Step 4 · 视频合成",
    status: "制作中",
    updatedAt: "2024-04-22 14:32",
    cover: "https://readdy.ai/api/search-image?query=elegant%20skincare%20serum%20product%20advertisement%20beautiful%20woman%20glowing%20skin%20warm%20studio%20lighting%20premium%20beauty%20brand%20commercial%20photography%20cinematic%20lifestyle&width=600&height=360&seq=proj01&orientation=landscape",
  },
  {
    id: "SD-20240301-002",
    name: "运动水杯·健身达人的选择",
    editPage: "Step 3 · 素材生成",
    status: "待审核",
    updatedAt: "2024-04-21 09:18",
    cover: "https://readdy.ai/api/search-image?query=sport%20water%20bottle%20fitness%20gym%20athlete%20workout%20active%20lifestyle%20product%20photography%20dynamic%20energetic%20clean%20background%20commercial%20advertisement&width=600&height=360&seq=proj02&orientation=landscape",
  },
  {
    id: "SD-20240301-003",
    name: "家居收纳神器·告别杂乱",
    editPage: "Step 2 · 脚本生成",
    status: "已完成",
    updatedAt: "2024-04-20 17:45",
    cover: "https://readdy.ai/api/search-image?query=minimalist%20home%20organization%20storage%20solution%20clean%20nordic%20interior%20tidy%20living%20space%20lifestyle%20photography%20warm%20natural%20light%20elegant%20home%20product%20commercial&width=600&height=360&seq=proj03&orientation=landscape",
  },
  {
    id: "SD-20240301-004",
    name: "宠物零食·毛孩子的最爱",
    editPage: "Step 1 · 产品信息",
    status: "草稿",
    updatedAt: "2024-04-19 11:22",
    cover: "https://readdy.ai/api/search-image?query=cute%20dog%20cat%20pet%20snack%20treat%20product%20happy%20animal%20lifestyle%20photography%20warm%20pastel%20background%20adorable%20commercial%20advertisement%20premium%20pet%20brand&width=600&height=360&seq=proj04&orientation=landscape",
  },
  {
    id: "SD-20240301-005",
    name: "智能手环·运动数据全掌握",
    editPage: "Step 4 · 视频合成",
    status: "已完成",
    updatedAt: "2024-04-18 16:10",
    cover: "https://readdy.ai/api/search-image?query=smart%20fitness%20band%20wristband%20wearable%20technology%20product%20photography%20active%20sport%20lifestyle%20clean%20modern%20minimal%20background%20tech%20advertisement%20commercial&width=600&height=360&seq=proj05&orientation=landscape",
  },
  {
    id: "SD-20240301-006",
    name: "有机咖啡·晨间仪式感",
    editPage: "Step 3 · 素材生成",
    status: "制作中",
    updatedAt: "2024-04-17 08:55",
    cover: "https://readdy.ai/api/search-image?query=organic%20coffee%20morning%20ritual%20cozy%20cafe%20aesthetic%20latte%20art%20warm%20light%20wooden%20table%20lifestyle%20photography%20premium%20brand%20commercial%20cinematic&width=600&height=360&seq=proj06&orientation=landscape",
  },
  {
    id: "SD-20240301-007",
    name: "儿童益智积木·创造力启蒙",
    editPage: "Step 2 · 脚本生成",
    status: "草稿",
    updatedAt: "2024-04-16 13:40",
    cover: "https://readdy.ai/api/search-image?query=colorful%20wooden%20building%20blocks%20children%20toys%20creative%20play%20educational%20bright%20clean%20background%20lifestyle%20photography%20premium%20kids%20brand%20commercial%20advertisement&width=600&height=360&seq=proj07&orientation=landscape",
  },
  {
    id: "SD-20240301-008",
    name: "轻薄冲锋衣·极限户外伴侣",
    editPage: "Step 4 · 视频合成",
    status: "已完成",
    updatedAt: "2024-04-15 19:03",
    cover: "https://readdy.ai/api/search-image?query=lightweight%20outdoor%20jacket%20windbreaker%20adventure%20mountain%20hiking%20active%20lifestyle%20photography%20dramatic%20landscape%20cinematic%20athletic%20apparel%20commercial%20premium%20brand&width=600&height=360&seq=proj08&orientation=landscape",
  },
];

const STATUS_CONFIG: Record<Project["status"], { color: string; bg: string; icon: string }> = {
  制作中: { color: "#D97706", bg: "rgba(217,119,6,0.1)", icon: "ri-loader-4-line" },
  已完成: { color: "#16A34A", bg: "rgba(22,163,74,0.1)", icon: "ri-check-double-line" },
  待审核: { color: "#6366F1", bg: "rgba(99,102,241,0.1)", icon: "ri-time-line" },
  草稿: { color: "#6B7280", bg: "rgba(107,114,128,0.1)", icon: "ri-draft-line" },
};

const STEP_PROGRESS: Record<string, number> = {
  "Step 1 · 产品信息": 25,
  "Step 2 · 脚本生成": 50,
  "Step 3 · 素材生成": 75,
  "Step 4 · 视频合成": 95,
};

const EDIT_PAGE_MAP: Record<string, string> = {
  "Step 1 · 产品信息": "/step1",
  "Step 2 · 脚本生成": "/step2",
  "Step 3 · 素材生成": "/step3",
  "Step 4 · 视频合成": "/step4",
};

export default function ProjectsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<Project["status"] | "全部">("全部");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [projectNames, setProjectNames] = useState<Record<string, string>>({});

  const getProjectName = (p: Project) => projectNames[p.id] ?? p.name;

  const filtered = MOCK_PROJECTS.filter((p) => {
    const name = getProjectName(p);
    const matchSearch = name.includes(search) || p.id.includes(search);
    const matchStatus = filterStatus === "全部" || p.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const handleEditName = (project: Project) => {
    setEditingId(project.id);
    setEditName(getProjectName(project));
  };

  const handleSaveName = () => {
    if (editingId) {
      setProjectNames(prev => ({ ...prev, [editingId]: editName }));
    }
    setEditingId(null);
  };

  return (
    <div style={{ background: "#F7F8FA", minHeight: "100vh", fontFamily: "'Inter', sans-serif" }}>
      {/* Nav */}
      <header
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 lg:px-10 h-14"
        style={{
          background: "#ffffff",
          borderBottom: "1px solid #EAEAEA",
          boxShadow: "0 1px 6px rgba(0,0,0,0.04)",
        }}
      >
        <a href="/" className="flex items-center gap-2 cursor-pointer group" style={{ textDecoration: "none" }}>
          <div
            className="w-7 h-7 flex items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-105"
            style={{ background: "linear-gradient(135deg, #7C3AED, #A78BFA)" }}
          >
            <i className="ri-film-line text-white text-[13px]" />
          </div>
          <span className="text-[14px] font-bold whitespace-nowrap hidden sm:inline" style={{ fontFamily: "'Syne', sans-serif", color: "#1D1D1F" }}>
            VibeClip
          </span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md hidden sm:inline" style={{ background: "#F5F3FF", color: "#7C3AED" }}>
            维播
          </span>
        </a>

        <div className="hidden md:flex items-center gap-1">
          {[
            { label: "首页", href: "/#capabilities" },
            { label: "流程", href: "/#workflow" },
            { label: "案例", href: "/#cases" },
            { label: "项目管理", href: "/projects" },
          ].map((item) => {
            const isActive = item.href === "/projects";
            const isHome = item.href === "/#capabilities";
            return (
              <a
                key={item.label}
                href={item.href}
                className="px-3.5 py-1.5 text-[13.5px] font-medium rounded-lg transition-all duration-200 cursor-pointer whitespace-nowrap"
                style={{ color: isActive ? "#1D1D1F" : "#8E8E93", background: isActive || isHome ? "#F5F5F7" : "transparent", textDecoration: "none" }}
                onMouseEnter={(e) => { if (!isActive && !isHome) { (e.currentTarget as HTMLElement).style.color = "#1D1D1F"; (e.currentTarget as HTMLElement).style.background = "#F5F5F7"; } }}
                onMouseLeave={(e) => { if (!isActive && !isHome) { (e.currentTarget as HTMLElement).style.color = "#8E8E93"; (e.currentTarget as HTMLElement).style.background = "transparent"; } }}
              >
                {item.label}
              </a>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <UserDropdown isLoggedIn={false} />
        </div>
      </header>

      <main className="pt-14">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-10">

          {/* Page header */}
          <div className="mb-7 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold tracking-widest uppercase mb-1" style={{ color: "#AEAEB2" }}>PROJECT STUDIO</p>
              <h1 className="text-[26px] font-black leading-tight" style={{ color: "#1D1D1F", fontFamily: "'Syne', sans-serif" }}>
                项目管理
              </h1>
              <p className="text-[13.5px] mt-1" style={{ color: "#8E8E93" }}>
                共 {MOCK_PROJECTS.length} 个项目 · {MOCK_PROJECTS.filter(p => p.status === "已完成").length} 个已完成 · {MOCK_PROJECTS.filter(p => p.status === "制作中").length} 个制作中
              </p>
            </div>

            {/* Stats chips */}
            <div className="flex items-center gap-2 flex-wrap">
              {(["制作中", "待审核", "已完成", "草稿"] as const).map((s) => {
                const cnt = MOCK_PROJECTS.filter(p => p.status === s).length;
                const cfg = STATUS_CONFIG[s];
                return (
                  <div key={s} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ background: cfg.bg }}>
                    <i className={`${cfg.icon} text-[11px]`} style={{ color: cfg.color }} />
                    <span className="text-[12px] font-semibold whitespace-nowrap" style={{ color: cfg.color }}>{s} {cnt}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-7">
            <div className="relative flex-1 max-w-sm">
              <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-[13px]" style={{ color: "#AEAEB2" }} />
              <input
                type="text"
                placeholder="搜索项目名称或 ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-[13px] rounded-xl outline-none transition-all duration-200"
                style={{ background: "#ffffff", border: "1px solid #EAEAEA", color: "#1D1D1F" }}
                onFocus={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#1D1D1F"; }}
                onBlur={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#EAEAEA"; }}
              />
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {(["全部", "制作中", "待审核", "已完成", "草稿"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className="px-3 py-1.5 rounded-lg text-[12.5px] font-medium cursor-pointer transition-all duration-200 whitespace-nowrap"
                  style={{
                    background: filterStatus === s ? "#1D1D1F" : "#ffffff",
                    color: filterStatus === s ? "#ffffff" : "#6E6E73",
                    border: `1px solid ${filterStatus === s ? "#1D1D1F" : "#EAEAEA"}`,
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Cards grid */}
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 rounded-2xl" style={{ background: "#ffffff", border: "1px solid #EAEAEA" }}>
              <div className="w-14 h-14 flex items-center justify-center rounded-2xl mb-4" style={{ background: "#F5F5F7" }}>
                <i className="ri-folder-open-line text-[26px]" style={{ color: "#AEAEB2" }} />
              </div>
              <p className="text-[15px] font-semibold mb-1" style={{ color: "#1D1D1F" }}>暂无匹配项目</p>
              <p className="text-[13px]" style={{ color: "#8E8E93" }}>尝试调整搜索条件或状态筛选</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {filtered.map((project) => {
                const statusCfg = STATUS_CONFIG[project.status];
                const progress = STEP_PROGRESS[project.editPage] ?? 0;
                const isEditing = editingId === project.id;
                const displayName = getProjectName(project);

                return (
                  <div
                    key={project.id}
                    className="rounded-2xl overflow-hidden flex flex-col transition-all duration-200 group"
                    style={{ background: "#ffffff", border: "1px solid #EAEAEA" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#D1D1D6"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#EAEAEA"; }}
                  >
                    {/* Cover image */}
                    <div
                      className="relative w-full overflow-hidden cursor-pointer"
                      style={{ height: "168px", background: "#F5F5F7" }}
                      onClick={() => navigate(EDIT_PAGE_MAP[project.editPage] ?? "/step1")}
                    >
                      <img
                        src={project.cover}
                        alt={displayName}
                        className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                      />
                      {/* Dark overlay on hover */}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300" />

                      {/* Status badge top-left */}
                      <div className="absolute top-3 left-3">
                        <span
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap"
                          style={{ color: statusCfg.color, background: "rgba(255,255,255,0.92)", border: "1px solid rgba(255,255,255,0.5)" }}
                        >
                          <i className={`${statusCfg.icon} text-[10px]`} />
                          {project.status}
                        </span>
                      </div>

                      {/* Enter button on hover */}
                      <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-all duration-200 translate-y-1 group-hover:translate-y-0">
                        <div
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold"
                          style={{ background: "rgba(255,255,255,0.95)", color: "#1D1D1F" }}
                        >
                          <i className="ri-edit-box-line text-[11px]" />
                          继续编辑
                        </div>
                      </div>
                    </div>

                    {/* Card body */}
                    <div className="flex flex-col flex-1 p-4">
                      {/* Project name (editable) */}
                      <div className="mb-3">
                        {isEditing ? (
                          <input
                            autoFocus
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onBlur={handleSaveName}
                            onKeyDown={(e) => { if (e.key === "Enter") handleSaveName(); if (e.key === "Escape") setEditingId(null); }}
                            className="w-full text-[14px] font-bold px-2 py-1 rounded-lg outline-none"
                            style={{ color: "#1D1D1F", border: "1.5px solid #1D1D1F", background: "#FAFAFA", fontFamily: "'Syne', sans-serif" }}
                          />
                        ) : (
                          <h3
                            className="text-[14px] font-bold leading-snug line-clamp-2 cursor-pointer transition-colors duration-150"
                            style={{ color: "#1D1D1F", fontFamily: "'Syne', sans-serif" }}
                            onClick={() => navigate(EDIT_PAGE_MAP[project.editPage] ?? "/step1")}
                            title={displayName}
                          >
                            {displayName}
                          </h3>
                        )}
                      </div>

                      {/* Fields */}
                      <div className="space-y-2 mb-4 flex-1">
                        {/* Project ID */}
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 flex items-center justify-center shrink-0">
                            <i className="ri-fingerprint-line text-[11px]" style={{ color: "#AEAEB2" }} />
                          </div>
                          <span className="text-[11.5px] font-mono" style={{ color: "#8E8E93" }}>{project.id}</span>
                        </div>

                        {/* Edit page */}
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 flex items-center justify-center shrink-0">
                            <i className="ri-edit-box-line text-[11px]" style={{ color: "#AEAEB2" }} />
                          </div>
                          <button
                            onClick={() => navigate(EDIT_PAGE_MAP[project.editPage] ?? "/step1")}
                            className="text-[12px] font-medium cursor-pointer transition-colors duration-150 whitespace-nowrap"
                            style={{ color: "#444444" }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#1D1D1F"; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#444444"; }}
                          >
                            {project.editPage}
                          </button>
                        </div>

                        {/* Update time */}
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 flex items-center justify-center shrink-0">
                            <i className="ri-time-line text-[11px]" style={{ color: "#AEAEB2" }} />
                          </div>
                          <span className="text-[12px]" style={{ color: "#8E8E93" }}>{project.updatedAt}</span>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[11px]" style={{ color: "#AEAEB2" }}>制作进度</span>
                          <span className="text-[11px] font-semibold" style={{ color: "#1D1D1F" }}>{progress}%</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: "#F0F0F5" }}>
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${progress}%`,
                              background: project.status === "已完成"
                                ? "#16A34A"
                                : project.status === "制作中"
                                ? "#D97706"
                                : project.status === "待审核"
                                ? "#6366F1"
                                : "#AEAEB2",
                            }}
                          />
                        </div>
                      </div>

                      {/* Actions row */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => navigate(EDIT_PAGE_MAP[project.editPage] ?? "/step1")}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[12.5px] font-semibold cursor-pointer transition-all duration-200 whitespace-nowrap"
                          style={{ background: "#1D1D1F", color: "#ffffff" }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#374151"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#1D1D1F"; }}
                        >
                          <i className="ri-arrow-right-line text-[12px]" />
                          继续编辑
                        </button>
                        <button
                          onClick={() => handleEditName(project)}
                          title="修改项目名称"
                          className="w-9 h-9 flex items-center justify-center rounded-xl cursor-pointer transition-all duration-200 shrink-0"
                          style={{ background: "#F5F5F7", color: "#6E6E73", border: "1px solid #EAEAEA" }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#EAEAEA"; (e.currentTarget as HTMLElement).style.color = "#1D1D1F"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#F5F5F7"; (e.currentTarget as HTMLElement).style.color = "#6E6E73"; }}
                        >
                          <i className="ri-pencil-line text-[13px]" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* New project card */}
              <a
                href="/create"
                className="rounded-2xl flex flex-col items-center justify-center gap-3 cursor-pointer transition-all duration-200 min-h-[320px]"
                style={{ border: "1.5px dashed #D1D1D6", background: "#FAFAFA", textDecoration: "none" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#1D1D1F"; (e.currentTarget as HTMLElement).style.background = "#F5F5F7"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#D1D1D6"; (e.currentTarget as HTMLElement).style.background = "#FAFAFA"; }}
              >
                <div className="w-12 h-12 flex items-center justify-center rounded-2xl" style={{ background: "#EAEAEA" }}>
                  <i className="ri-add-line text-[22px]" style={{ color: "#8E8E93" }} />
                </div>
                <span className="text-[13px] font-medium" style={{ color: "#8E8E93" }}>新建项目</span>
              </a>
            </div>
          )}

          <p className="text-center text-[12px] mt-8" style={{ color: "#C7C7CC" }}>
            显示 {filtered.length} / {MOCK_PROJECTS.length} 个项目
          </p>
        </div>
      </main>
    </div>
  );
}
