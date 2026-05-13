import { useEffect, useRef, useState, useCallback } from "react";

export type AssetType = "character" | "scene" | "asset";

interface Props {
  open: boolean;
  assetType: AssetType;
  onClose: () => void;
  onAdd?: (data: AddAssetData) => void;
}

export interface AddAssetData {
  type: AssetType;
  mode: "upload" | "describe";
  name: string;
  uploadedImg?: string;
  description?: string;
}

const ASSET_TYPE_LABEL: Record<AssetType, { label: string; icon: string; namePlaceholder: string; descPlaceholder: string }> = {
  character: { label: "角色", icon: "ri-user-star-line", namePlaceholder: "如：林晓、Detective Wang...", descPlaceholder: "描述角色性格、外貌特征、情感状态，越详细生成效果越好..." },
  scene:     { label: "场景", icon: "ri-landscape-line", namePlaceholder: "如：空旷公寓、城市夜景...", descPlaceholder: "描述场景氛围、光线、时间段、情绪基调，越详细生成效果越好..." },
  asset:     { label: "产品", icon: "ri-archive-line", namePlaceholder: "如：Fjord 实木餐桌...", descPlaceholder: "描述产品材质、颜色、摆放环境与出镜方式，越详细生成效果越好..." },
};

export default function AddAssetModal({ open, assetType, onClose, onAdd }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [mode, setMode] = useState<"upload" | "describe">("upload");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [uploadedImg, setUploadedImg] = useState<string | undefined>(undefined);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const meta = ASSET_TYPE_LABEL[assetType];

  useEffect(() => {
    if (open) {
      setName(""); setDescription(""); setUploadedImg(undefined); setMode("upload");
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    } else {
      setVisible(false);
    }
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    if (open) { document.body.style.overflow = "hidden"; }
    else { document.body.style.overflow = ""; }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const handleFileDrop = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => setUploadedImg(e.target?.result as string);
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileDrop(file);
  }, [handleFileDrop]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileDrop(file);
  }, [handleFileDrop]);

  const canSubmit = name.trim().length > 0 && (mode === "upload" || description.trim().length > 0);

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return;
    onAdd?.({ type: assetType, mode, name: name.trim(), uploadedImg, description: description.trim() || undefined });
    onClose();
  }, [canSubmit, onAdd, assetType, mode, name, uploadedImg, description, onClose]);

  if (!open && !visible) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8"
      style={{
        background: visible ? "rgba(0,0,0,0.48)" : "rgba(0,0,0,0)",
        backdropFilter: visible ? "blur(10px)" : "blur(0px)",
        transition: "background 0.28s ease, backdrop-filter 0.28s ease",
      }}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div
        className="w-full overflow-hidden"
        style={{
          maxWidth: "600px",
          maxHeight: "90vh",
          background: "#ffffff",
          borderRadius: "20px",
          border: "1px solid #EAEAEA",
          opacity: visible ? 1 : 0,
          transform: visible ? "scale(1) translateY(0)" : "scale(0.95) translateY(14px)",
          transition: "opacity 0.26s ease, transform 0.26s cubic-bezier(0.16,1,0.3,1)",
        }}
      >
        {/* Top bar */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid #F0F0F5" }}
        >
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 flex items-center justify-center rounded-lg" style={{ background: "#F5F5F7" }}>
              <i className={`${meta.icon} text-[13px]`} style={{ color: "#6E6E73" }} />
            </div>
            <span className="text-[14px] font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "#1D1D1F" }}>
              添加{meta.label}
            </span>
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
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[12px] font-medium cursor-pointer transition-colors whitespace-nowrap"
              style={{
                background: canSubmit ? "#1D1D1F" : "#F0F0F5",
                color: canSubmit ? "#ffffff" : "#AEAEB2",
              }}
              onMouseEnter={(e) => { if (canSubmit) (e.currentTarget as HTMLElement).style.background = "#374151"; }}
              onMouseLeave={(e) => { if (canSubmit) (e.currentTarget as HTMLElement).style.background = "#1D1D1F"; }}
            >
              <i className="ri-save-line text-[11px]" />
              保存
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 py-5" style={{ maxHeight: "calc(90vh - 64px)" }}>
          {/* Mode toggle */}
          <div className="flex gap-1 p-1 rounded-xl mb-5 w-fit" style={{ background: "#F5F5F7", border: "1px solid #EAEAEA" }}>
            {(["upload", "describe"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-[12.5px] font-medium cursor-pointer transition-all duration-200 whitespace-nowrap"
                style={{
                  background: mode === m ? "#ffffff" : "transparent",
                  color: mode === m ? "#1D1D1F" : "#8E8E93",
                  border: mode === m ? "1px solid #EAEAEA" : "1px solid transparent",
                }}
              >
                <i className={`${m === "upload" ? "ri-upload-2-line" : "ri-text-wrap"} text-[12px]`} />
                {m === "upload" ? "上传图片" : "编辑描述"}
              </button>
            ))}
          </div>

          {/* Asset name */}
          <div className="mb-4">
            <label className="block text-[11px] font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "#AEAEB2" }}>
              {meta.label}名称 <span style={{ color: "#EF4444" }}>*</span>
            </label>
            <input
              className="w-full text-[13px] rounded-xl px-4 py-2.5 outline-none"
              style={{ background: "#F9F9FB", border: "1.5px solid #EAEAEA", color: "#1D1D1F" }}
              placeholder={meta.namePlaceholder}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onFocus={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#1D1D1F"; }}
              onBlur={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#EAEAEA"; }}
            />
          </div>

          {/* Upload mode */}
          {mode === "upload" && (
            <>
              <div className="mb-4">
                <label className="block text-[11px] font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "#AEAEB2" }}>
                  上传参考图
                </label>
                {!uploadedImg ? (
                  <div
                    className="relative flex flex-col items-center justify-center gap-3 rounded-xl cursor-pointer transition-all duration-200"
                    style={{
                      height: "180px",
                      border: `1.5px dashed ${isDragging ? "#1D1D1F" : "#D1D1D6"}`,
                      background: isDragging ? "#F5F5F7" : "#FAFAFA",
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                  >
                    <div className="w-10 h-10 flex items-center justify-center rounded-2xl" style={{ background: "#EAEAEA" }}>
                      <i className="ri-image-add-line text-[18px]" style={{ color: "#8E8E93" }} />
                    </div>
                    <div className="text-center">
                      <p className="text-[13px] font-medium" style={{ color: "#444444" }}>点击上传或拖拽图片至此</p>
                      <p className="text-[11.5px] mt-1" style={{ color: "#AEAEB2" }}>支持 JPG / PNG / WEBP，最大 10MB</p>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                  </div>
                ) : (
                  <div className="relative rounded-xl overflow-hidden" style={{ height: "200px" }}>
                    <img src={uploadedImg} alt="uploaded" className="w-full h-full object-contain" style={{ background: "#F5F5F7" }} />
                    <button
                      onClick={() => setUploadedImg(undefined)}
                      className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full cursor-pointer transition-colors"
                      style={{ background: "rgba(0,0,0,0.45)", color: "#ffffff" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.7)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.45)"; }}
                    >
                      <i className="ri-close-line text-[13px]" />
                    </button>
                  </div>
                )}
              </div>

              <div className="rounded-xl px-4 py-3 flex items-start gap-2.5" style={{ background: "#FFF9EC", border: "1px solid #FDE68A" }}>
                <i className="ri-information-line text-[13px] mt-0.5 shrink-0" style={{ color: "#D97706" }} />
                <p className="text-[12px] leading-relaxed" style={{ color: "#92400E" }}>
                  上传图片后，资产名称以外的其他字段将标记为「待生成」状态，点击下一步时批量生成。
                </p>
              </div>
            </>
          )}

          {/* Describe mode */}
          {mode === "describe" && (
            <>
              <div className="mb-4">
                <label className="block text-[11px] font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "#AEAEB2" }}>
                  描述内容 <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <textarea
                  className="w-full text-[13px] rounded-xl px-4 py-3 outline-none resize-none"
                  style={{ background: "#F9F9FB", border: "1.5px solid #EAEAEA", color: "#1D1D1F", minHeight: "120px" }}
                  placeholder={meta.descPlaceholder}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onFocus={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#1D1D1F"; }}
                  onBlur={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#EAEAEA"; }}
                />
                <p className="text-right text-[11px] mt-1" style={{ color: description.length > 450 ? "#EF4444" : "#AEAEB2" }}>
                  {description.length} / 500
                </p>
              </div>

              <div className="rounded-xl px-4 py-3 flex items-start gap-2.5" style={{ background: "#F0F7FF", border: "1px solid #BFDBFE" }}>
                <i className="ri-magic-line text-[13px] mt-0.5 shrink-0" style={{ color: "#2563EB" }} />
                <p className="text-[12px] leading-relaxed" style={{ color: "#1E40AF" }}>
                  填写描述后，图片与其他字段将标记为「待生成」状态，点击下一步时批量生成。
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
