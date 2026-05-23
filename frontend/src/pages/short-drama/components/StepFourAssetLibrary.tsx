import { useState } from "react";
import type { StepFourAssetLibraryVm } from "../utils/stepFourAdapters";
import { SHORT_DRAMA_UI } from "../utils/shortDramaUiCopy";

type AssetKind = "character" | "scene" | "product";
type AssetItem =
  | StepFourAssetLibraryVm["characters"][number]
  | StepFourAssetLibraryVm["scenes"][number]
  | StepFourAssetLibraryVm["products"][number];

interface AssetLibraryProps {
  library: StepFourAssetLibraryVm;
  onDragAsset?: (type: string, name: string) => void;
}

export function StepFourAssetLibrary({ library, onDragAsset: _onDragAsset }: AssetLibraryProps) {
  const { characters: CHAR_ASSETS, scenes: SCENE_ASSETS, products: PRODUCT_ASSETS } = library;
  const [detail, setDetail] = useState<{ kind: AssetKind; item: AssetItem } | null>(null);
  const isEmpty =
    CHAR_ASSETS.length === 0 && SCENE_ASSETS.length === 0 && PRODUCT_ASSETS.length === 0;

  return (
    <aside
      className="hidden w-56 shrink-0 flex-col overflow-y-auto md:flex"
      style={{ background: "#F7F8FA", borderRight: "1px solid #EAEAEA" }}
    >
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "#8E8E93" }}>
            资产库
          </h3>
          <button
            type="button"
            className="w-6 h-6 flex items-center justify-center rounded-md cursor-pointer transition-colors duration-150"
            style={{ color: "#8E8E93" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "#EAEAEA";
              (e.currentTarget as HTMLElement).style.color = "#1D1D1F";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
              (e.currentTarget as HTMLElement).style.color = "#8E8E93";
            }}
          >
            <i className="ri-add-line text-[14px]" />
          </button>
        </div>

        {isEmpty && (
          <p className="text-[10.5px] leading-relaxed mb-4" style={{ color: "#AEAEB2" }}>
            {SHORT_DRAMA_UI.stepFour.assetLibraryEmpty}
          </p>
        )}

        {/* Characters */}
        <div className="mb-5">
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5" style={{ color: "#AEAEB2" }}>
            <i className="ri-user-star-line text-[10px]" style={{ color: "#B45309" }} />
            角色 ({CHAR_ASSETS.length})
          </p>
          <div className="space-y-1">
            {CHAR_ASSETS.map((c) => (
              <button
                key={c.id}
                type="button"
                className="w-full flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all duration-150 text-left"
                style={{ background: "#ffffff", border: "1px solid #EAEAEA" }}
                onClick={() => setDetail({ kind: "character", item: c })}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.border = "1px solid #B45309";
                  (e.currentTarget as HTMLElement).style.background = "rgba(180,83,9,0.04)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.border = "1px solid #EAEAEA";
                  (e.currentTarget as HTMLElement).style.background = "#ffffff";
                }}
              >
                <div className="w-7 h-7 rounded-full overflow-hidden shrink-0">
                  {c.img ? (
                    <img src={c.img} alt={c.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-[#ECEDEF]" />
                  )}
                </div>
                <div>
                  <p className="text-[11.5px] font-medium" style={{ color: "#1D1D1F" }}>{c.name}</p>
                  <p className="text-[10px]" style={{ color: "#AEAEB2" }}>{c.role}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Scenes */}
        <div className="mb-5">
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5" style={{ color: "#AEAEB2" }}>
            <i className="ri-landscape-line text-[10px]" style={{ color: "#047857" }} />
            场景 ({SCENE_ASSETS.length})
          </p>
          <div className="space-y-1">
            {SCENE_ASSETS.map((s) => (
              <button
                key={s.id}
                type="button"
                className="w-full flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all duration-150 text-left"
                style={{ background: "#ffffff", border: "1px solid #EAEAEA" }}
                onClick={() => setDetail({ kind: "scene", item: s })}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.border = "1px solid #047857";
                  (e.currentTarget as HTMLElement).style.background = "rgba(4,120,87,0.04)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.border = "1px solid #EAEAEA";
                  (e.currentTarget as HTMLElement).style.background = "#ffffff";
                }}
              >
                <div>
                  <p className="text-[11.5px] font-medium" style={{ color: "#1D1D1F" }}>{s.name}</p>
                  <p className="text-[10px]" style={{ color: "#AEAEB2" }}>{s.type}</p>
                </div>
                {s.img ? (
                  <img src={s.img} alt={s.name} className="w-7 h-7 rounded-md object-cover" />
                ) : (
                  <i className="ri-landscape-line text-[12px]" style={{ color: "#D1D1D6" }} />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Products */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5" style={{ color: "#AEAEB2" }}>
            <i className="ri-archive-line text-[10px]" style={{ color: "#DC2626" }} />
            产品资产 ({PRODUCT_ASSETS.length})
          </p>
          <div className="space-y-1">
            {PRODUCT_ASSETS.map((p) => (
              <button
                key={p.id}
                type="button"
                className="w-full flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all duration-150 text-left"
                style={{ background: "#ffffff", border: "1px solid #EAEAEA" }}
                onClick={() => setDetail({ kind: "product", item: p })}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.border = "1px solid #DC2626";
                  (e.currentTarget as HTMLElement).style.background = "rgba(220,38,38,0.04)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.border = "1px solid #EAEAEA";
                  (e.currentTarget as HTMLElement).style.background = "#ffffff";
                }}
              >
                <div>
                  <p className="text-[11.5px] font-medium" style={{ color: "#1D1D1F" }}>{p.name}</p>
                  <p className="text-[10px]" style={{ color: "#AEAEB2" }}>{p.type}</p>
                </div>
                {p.img ? (
                  <img src={p.img} alt={p.name} className="w-7 h-7 rounded-md object-cover" />
                ) : (
                  <i className="ri-archive-line text-[12px]" style={{ color: "#D1D1D6" }} />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
      {detail && <AssetDetailModal detail={detail} onClose={() => setDetail(null)} />}
    </aside>
  );
}

function getMetaText(item: AssetItem, keys: string[], fallback = "—"): string {
  const meta = "meta" in item && item.meta && typeof item.meta === "object" ? item.meta : {};
  const typeFields =
    "type_fields" in (meta as Record<string, unknown>) &&
    (meta as Record<string, unknown>).type_fields &&
    typeof (meta as Record<string, unknown>).type_fields === "object"
      ? ((meta as Record<string, unknown>).type_fields as Record<string, unknown>)
      : {};
  for (const key of keys) {
    const v = (typeFields as Record<string, unknown>)[key] ?? (meta as Record<string, unknown>)[key];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (Array.isArray(v) && v.length) return v.map(String).filter(Boolean).join("；");
  }
  return fallback;
}

function sceneMetaText(item: AssetItem, keys: string[], fallback: string): string {
  const value = getMetaText(item, keys, "").trim();
  return value || fallback;
}

function AssetDetailModal({
  detail,
  onClose,
}: {
  detail: { kind: AssetKind; item: AssetItem };
  onClose: () => void;
}) {
  const { kind, item } = detail;
  const isDev = import.meta.env.DEV;
  const positionLabel =
    kind === "character"
      ? "角色定位"
      : kind === "scene"
        ? "场景定位"
        : kind === "product"
          ? "商品定位"
          : "定位";
  const positionValue =
    kind === "character"
      ? ("role" in item ? item.role : "角色")
      : "type" in item && item.type
        ? item.type
        : kind === "scene"
          ? "场景"
          : "产品";
  const rows = [
    ["名称", item.name || "—"],
    [positionLabel, positionValue || "—"],
    ["画面说明", ("desc" in item ? item.desc : "") || "—"],
    ["重新生成描述", ("visualPrompt" in item ? item.visualPrompt : "") || "—"],
    ["图片来源", "imageSource" in item ? item.imageSource || "—" : "—"],
  ] as const;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center px-4" style={{ background: "rgba(0,0,0,0.42)" }} onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl overflow-hidden" style={{ background: "#fff" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid #EAEAEA" }}>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "#8E8E93" }}>只读资产详情</p>
            <h3 className="text-[17px] font-bold mt-0.5" style={{ color: "#1D1D1F" }}>{item.name}</h3>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-lg" style={{ color: "#6E6E73" }}>
            <i className="ri-close-line text-[18px]" />
          </button>
        </div>
        <div className="grid grid-cols-[220px_1fr] gap-5 p-5">
          <div className="rounded-xl overflow-hidden flex items-center justify-center" style={{ background: "#F5F5F7", border: "1px solid #EAEAEA", minHeight: 280 }}>
            {"img" in item && item.img ? (
              <img src={item.img} alt={item.name} className="w-full h-full object-cover" />
            ) : (
              <i className="ri-image-line text-[32px]" style={{ color: "#AEAEB2" }} />
            )}
          </div>
          <div className="space-y-3">
            {rows.map(([label, value]) => (
              <div key={label}>
                <p className="text-[11px] mb-1" style={{ color: "#AEAEB2" }}>{label}</p>
                <p className="text-[12.5px] leading-relaxed whitespace-pre-wrap" style={{ color: "#444444" }}>{value || "—"}</p>
              </div>
            ))}
            {isDev ? (
              <details className="rounded-lg px-3 py-2" style={{ background: "#F7F8FA", border: "1px solid #EAEAEA" }}>
                <summary className="cursor-pointer text-[11px] font-semibold" style={{ color: "#6E6E73" }}>开发调试信息</summary>
                <div className="mt-2 space-y-2">
                  <p className="text-[11px] leading-relaxed whitespace-pre-wrap" style={{ color: "#444444" }}>
                    外观：{getMetaText(item, ["appearance"], "—")}
                  </p>
                  <p className="text-[11px] leading-relaxed whitespace-pre-wrap" style={{ color: "#444444" }}>
                    服装：{getMetaText(item, ["costume", "clothing"], "—")}
                  </p>
                  <p className="text-[11px] leading-relaxed whitespace-pre-wrap" style={{ color: "#444444" }}>
                    结构摘要：{getMetaText(item, ["structure_summary"], "—")}
                  </p>
                  <p className="text-[11px] leading-relaxed whitespace-pre-wrap" style={{ color: "#444444" }}>
                    剧情用途：{sceneMetaText(item, ["story_usage"], "—")}
                  </p>
                </div>
              </details>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
