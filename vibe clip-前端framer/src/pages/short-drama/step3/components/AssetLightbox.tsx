import { useEffect, useRef, useState, useCallback } from "react";

export interface LightboxField {
  key: string;
  label: string;
  value: string;
  icon: string;
  isPmt?: boolean;
  multiline?: boolean;
}

export interface LightboxItem {
  img: string;
  images?: string[]; // multi-image support
  name: string;
  subtitle: string;
  desc: string;
  tags?: string[];
  fields?: LightboxField[];
  orientation?: "portrait" | "landscape";
  type: "character" | "scene" | "asset";
}

interface Props {
  item: LightboxItem | null;
  onClose: () => void;
  onSave?: (item: LightboxItem) => void;
}

export default function AssetLightbox({ item, onClose, onSave }: Props) {
  const [visible, setVisible] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  const [localItem, setLocalItem] = useState<LightboxItem | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());
  const [regenKeys, setRegenKeys] = useState<Set<string>>(new Set());
  const [activeImgIdx, setActiveImgIdx] = useState(0);

  useEffect(() => {
    if (item) {
      setLocalItem(JSON.parse(JSON.stringify(item)));
      setEditingKey(null);
      setSavedKeys(new Set());
      setRegenKeys(new Set());
      setActiveImgIdx(0);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
    } else {
      setVisible(false);
      setTimeout(() => setLocalItem(null), 300);
    }
  }, [item]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (editingKey) { setEditingKey(null); }
        else { onClose(); }
      }
      if (e.key === "ArrowLeft") setActiveImgIdx(i => Math.max(0, i - 1));
      if (e.key === "ArrowRight") {
        const imgs = localItem?.images ?? [localItem?.img ?? ""];
        setActiveImgIdx(i => Math.min(imgs.length - 1, i + 1));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, editingKey, localItem]);

  useEffect(() => {
    if (item) { document.body.style.overflow = "hidden"; }
    else { document.body.style.overflow = ""; }
    return () => { document.body.style.overflow = ""; };
  }, [item]);

  const startEdit = useCallback((field: LightboxField) => {
    setEditingKey(field.key);
    setEditingValue(field.value);
  }, []);

  const commitSave = useCallback((field: LightboxField) => {
    if (!localItem) return;
    const updatedFields = localItem.fields?.map(f =>
      f.key === field.key ? { ...f, value: editingValue } : f
    );
    setLocalItem({ ...localItem, fields: updatedFields });
    setSavedKeys(prev => new Set([...prev, field.key]));
    setEditingKey(null);
    setTimeout(() => setSavedKeys(prev => { const next = new Set(prev); next.delete(field.key); return next; }), 2000);
  }, [localItem, editingValue]);

  const commitRegen = useCallback((field: LightboxField) => {
    if (!localItem) return;
    const updatedFields = localItem.fields?.map(f =>
      f.key === field.key ? { ...f, value: editingValue } : f
    );
    setLocalItem({ ...localItem, fields: updatedFields });
    setRegenKeys(prev => new Set([...prev, field.key]));
    setEditingKey(null);
    setTimeout(() => setRegenKeys(prev => { const next = new Set(prev); next.delete(field.key); return next; }), 3000);
  }, [localItem, editingValue]);

  const handleGlobalSave = useCallback(() => {
    if (localItem && onSave) onSave(localItem);
    onClose();
  }, [localItem, onSave, onClose]);

  if (!localItem) return null;

  const images = localItem.images && localItem.images.length > 0 ? localItem.images : [localItem.img];
  const currentImg = images[activeImgIdx] ?? localItem.img;
  const hasMultiple = images.length > 1;
  const isPortrait = localItem.type === "character";

  const typeIcon =
    localItem.type === "character" ? "ri-user-star-line" :
    localItem.type === "scene" ? "ri-landscape-line" : "ri-archive-line";

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8"
      style={{
        background: visible ? "rgba(0,0,0,0.52)" : "rgba(0,0,0,0)",
        backdropFilter: visible ? "blur(12px)" : "blur(0px)",
        transition: "background 0.3s ease, backdrop-filter 0.3s ease",
      }}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div
        className="relative w-full flex flex-col overflow-hidden"
        style={{
          maxWidth: isPortrait ? "900px" : "1040px",
          maxHeight: "92vh",
          background: "#ffffff",
          borderRadius: "20px",
          border: "1px solid #EAEAEA",
          opacity: visible ? 1 : 0,
          transform: visible ? "scale(1) translateY(0)" : "scale(0.94) translateY(16px)",
          transition: "opacity 0.28s ease, transform 0.28s cubic-bezier(0.16,1,0.3,1)",
        }}
      >
        {/* ── Global action bar ── */}
        <div
          className="flex items-center justify-between px-5 py-3.5 shrink-0"
          style={{ background: "rgba(255,255,255,0.97)", borderBottom: "1px solid #F0F0F5", zIndex: 10 }}
        >
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 flex items-center justify-center rounded-lg shrink-0" style={{ background: "#F5F5F7" }}>
              <i className={`${typeIcon} text-[11px]`} style={{ color: "#8E8E93" }} />
            </div>
            <span className="text-[12.5px] font-semibold" style={{ color: "#1D1D1F" }}>{localItem.name}</span>
            <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: "#F5F5F7", color: "#8E8E93" }}>{localItem.subtitle}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg text-[12px] font-medium cursor-pointer transition-colors whitespace-nowrap"
              style={{ background: "#F5F5F7", color: "#444444", border: "1px solid #EAEAEA" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#EAEAEA"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#F5F5F7"; }}
            >
              关闭
            </button>
            <button
              onClick={handleGlobalSave}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[12px] font-medium cursor-pointer transition-colors whitespace-nowrap"
              style={{ background: "#1D1D1F", color: "#ffffff" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#374151"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#1D1D1F"; }}
            >
              <i className="ri-save-line text-[11px]" />
              保存
            </button>
          </div>
        </div>

        {/* ── Body: side-by-side ── */}
        <div className="flex flex-col md:flex-row overflow-hidden" style={{ flex: 1, minHeight: 0 }}>
          {/* Image panel */}
          <div
            className="shrink-0 flex flex-col"
            style={{
              width: isPortrait ? "min(320px, 38%)" : "min(400px, 42%)",
              background: "#F5F5F7",
              borderRight: "1px solid #EAEAEA",
            }}
          >
            {/* Main image */}
            <div
              className="relative flex items-center justify-center overflow-hidden"
              style={{
                flex: 1,
                minHeight: isPortrait ? "360px" : "260px",
                maxHeight: isPortrait ? "calc(92vh - 200px)" : "340px",
                background: "#F5F5F7",
              }}
            >
              <img
                src={currentImg}
                alt={localItem.name}
                className="w-full h-full transition-opacity duration-200"
                style={{ objectFit: "contain" }}
              />
              {/* Arrow buttons */}
              {hasMultiple && (
                <>
                  <button
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-full cursor-pointer transition-all"
                    style={{
                      background: activeImgIdx === 0 ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.9)",
                      border: "1px solid rgba(0,0,0,0.08)",
                      opacity: activeImgIdx === 0 ? 0.4 : 1,
                    }}
                    disabled={activeImgIdx === 0}
                    onClick={() => setActiveImgIdx(i => Math.max(0, i - 1))}
                  >
                    <i className="ri-arrow-left-s-line text-[14px]" style={{ color: "#1D1D1F" }} />
                  </button>
                  <button
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-full cursor-pointer transition-all"
                    style={{
                      background: activeImgIdx === images.length - 1 ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.9)",
                      border: "1px solid rgba(0,0,0,0.08)",
                      opacity: activeImgIdx === images.length - 1 ? 0.4 : 1,
                    }}
                    disabled={activeImgIdx === images.length - 1}
                    onClick={() => setActiveImgIdx(i => Math.min(images.length - 1, i + 1))}
                  >
                    <i className="ri-arrow-right-s-line text-[14px]" style={{ color: "#1D1D1F" }} />
                  </button>
                  {/* Counter badge */}
                  <div
                    className="absolute bottom-2.5 right-2.5 text-[10px] font-semibold px-2 py-1 rounded-full"
                    style={{ background: "rgba(0,0,0,0.5)", color: "#ffffff" }}
                  >
                    {activeImgIdx + 1} / {images.length}
                  </div>
                </>
              )}
            </div>

            {/* Thumbnails */}
            {hasMultiple && (
              <div
                className="flex gap-1.5 p-2.5 overflow-x-auto"
                style={{ borderTop: "1px solid #EAEAEA", background: "#FAFAFA" }}
              >
                {images.map((imgUrl, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImgIdx(idx)}
                    className="shrink-0 w-12 h-12 rounded-lg overflow-hidden cursor-pointer transition-all"
                    style={{
                      border: activeImgIdx === idx ? "2px solid #1D1D1F" : "2px solid transparent",
                      opacity: activeImgIdx === idx ? 1 : 0.6,
                    }}
                  >
                    <img src={imgUrl} alt="" className="w-full h-full" style={{ objectFit: "cover" }} />
                  </button>
                ))}
                {/* Upload more button */}
                <label
                  className="shrink-0 w-12 h-12 rounded-lg flex items-center justify-center cursor-pointer transition-all"
                  style={{ border: "1.5px dashed #D1D1D6", background: "#F5F5F7" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#1D1D1F"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#D1D1D6"; }}
                >
                  <i className="ri-add-line text-[14px]" style={{ color: "#AEAEB2" }} />
                  <input type="file" accept="image/*" multiple className="hidden" />
                </label>
              </div>
            )}
            {/* Add image when only one */}
            {!hasMultiple && (
              <label
                className="flex items-center justify-center gap-1.5 py-2.5 cursor-pointer transition-colors"
                style={{ borderTop: "1px solid #EAEAEA", background: "#FAFAFA" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#F0F0F5"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#FAFAFA"; }}
              >
                <i className="ri-image-add-line text-[12px]" style={{ color: "#AEAEB2" }} />
                <span className="text-[11px]" style={{ color: "#AEAEB2" }}>添加更多图片</span>
                <input type="file" accept="image/*" multiple className="hidden" />
              </label>
            )}
          </div>

          {/* Info / edit panel */}
          <div
            className="flex flex-col overflow-y-auto"
            style={{ flex: 1, padding: "22px 26px", minWidth: 0 }}
          >
            {/* Description */}
            <div className="mb-5">
              <p className="text-[10.5px] font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "#AEAEB2" }}>描述</p>
              <p className="text-[13px] leading-relaxed" style={{ color: "#444444" }}>{localItem.desc}</p>
            </div>

            {/* Tags */}
            {localItem.tags && localItem.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-5">
                {localItem.tags.map((tag) => (
                  <span key={tag} className="text-[11px] px-2.5 py-1 rounded-full" style={{ background: "#F0F0F5", color: "#444444" }}>
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Editable fields */}
            {localItem.fields && localItem.fields.length > 0 && (
              <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #EAEAEA" }}>
                {localItem.fields.map((field, idx) => {
                  const isEditing = editingKey === field.key;
                  const isSaved = savedKeys.has(field.key);
                  const isRegen = regenKeys.has(field.key);
                  const isLast = idx === localItem.fields!.length - 1;

                  return (
                    <div key={field.key} style={{ borderBottom: isLast ? "none" : "1px solid #F5F5F7" }}>
                      {!isEditing && (
                        <div
                          className="flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors group"
                          style={{ background: isSaved || isRegen ? "#F0FFF7" : "#ffffff" }}
                          onClick={() => startEdit(field)}
                          onMouseEnter={(e) => { if (!isSaved && !isRegen) (e.currentTarget as HTMLElement).style.background = "#F9F9FB"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = isSaved || isRegen ? "#F0FFF7" : "#ffffff"; }}
                        >
                          <div className="w-7 h-7 flex items-center justify-center rounded-lg shrink-0 mt-0.5" style={{ background: "#F5F5F7" }}>
                            <i className={`${field.icon} text-[12px]`} style={{ color: "#8E8E93" }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <p className="text-[10.5px]" style={{ color: "#AEAEB2" }}>{field.label}</p>
                              {field.isPmt && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: "#FFF4E6", color: "#D97706" }}>PMT</span>
                              )}
                              {(isSaved || isRegen) && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: "#DCFCE7", color: "#16A34A" }}>
                                  {isRegen ? "已触发重新生成" : "已保存"}
                                </span>
                              )}
                            </div>
                            <p className="text-[12.5px] font-medium break-words" style={{ color: "#1D1D1F" }}>{field.value}</p>
                          </div>
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1">
                            <i className="ri-pencil-line text-[11px]" style={{ color: "#AEAEB2" }} />
                          </div>
                        </div>
                      )}

                      {isEditing && (
                        <div className="px-4 py-3" style={{ background: "#F9F9FB" }}>
                          <div className="flex items-center gap-1.5 mb-2">
                            <div className="w-5 h-5 flex items-center justify-center rounded-md shrink-0" style={{ background: "#F0F0F5" }}>
                              <i className={`${field.icon} text-[10px]`} style={{ color: "#8E8E93" }} />
                            </div>
                            <p className="text-[10.5px] font-semibold" style={{ color: "#444444" }}>{field.label}</p>
                            {field.isPmt && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: "#FFF4E6", color: "#D97706" }}>PMT</span>
                            )}
                          </div>
                          {field.multiline ? (
                            <textarea
                              className="w-full text-[12.5px] rounded-lg px-3 py-2.5 outline-none resize-none"
                              style={{ background: "#ffffff", border: "1.5px solid #1D1D1F", color: "#1D1D1F", minHeight: "80px" }}
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              autoFocus
                            />
                          ) : (
                            <input
                              className="w-full text-[12.5px] rounded-lg px-3 py-2 outline-none"
                              style={{ background: "#ffffff", border: "1.5px solid #1D1D1F", color: "#1D1D1F" }}
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              autoFocus
                            />
                          )}
                          <div className="flex gap-2 mt-2.5">
                            <button
                              onClick={() => setEditingKey(null)}
                              className="px-3 py-1.5 rounded-lg text-[11.5px] cursor-pointer transition-colors whitespace-nowrap"
                              style={{ background: "#F5F5F7", color: "#444444", border: "1px solid #EAEAEA" }}
                              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#EAEAEA"; }}
                              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#F5F5F7"; }}
                            >
                              取消
                            </button>
                            {field.isPmt ? (
                              <button
                                onClick={() => commitRegen(field)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11.5px] font-medium cursor-pointer transition-colors whitespace-nowrap"
                                style={{ background: "#D97706", color: "#ffffff" }}
                                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#B45309"; }}
                                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#D97706"; }}
                              >
                                <i className="ri-refresh-line text-[11px]" />
                                重新生成
                              </button>
                            ) : (
                              <button
                                onClick={() => commitSave(field)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11.5px] font-medium cursor-pointer transition-colors whitespace-nowrap"
                                style={{ background: "#1D1D1F", color: "#ffffff" }}
                                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#374151"; }}
                                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#1D1D1F"; }}
                              >
                                <i className="ri-save-line text-[11px]" />
                                保存
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex-1 min-h-4" />
            <p className="text-center text-[11px] mt-5" style={{ color: "#C7C7CC" }}>
              点击字段可编辑 · ESC 取消编辑 / 关闭
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
