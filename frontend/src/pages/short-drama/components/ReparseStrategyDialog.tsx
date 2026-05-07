type ReparseStrategyDialogProps = {
  open: boolean;
  loading: boolean;
  editedFieldCount: number;
  currentVersion: number;
  isRawDirty: boolean;
  onClose: () => void;
  onReplaceAll: () => void;
  onPreserveEdited: () => void;
};

export function ReparseStrategyDialog({
  open,
  loading,
  editedFieldCount,
  currentVersion,
  isRawDirty,
  onClose,
  onReplaceAll,
  onPreserveEdited,
}: ReparseStrategyDialogProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/35 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
        <h3 className="text-[16px] font-semibold text-[#1D1D1F]">重新解析策略</h3>
        <p className="mt-2 text-[13px] leading-6 text-[#4B5563]">
          你已手动修改过部分解析结果。重新解析时，可以选择覆盖全部结果，或保留人工编辑字段仅更新未编辑字段。
        </p>
        <div className="mt-3 rounded-lg border border-[#EAEAEA] bg-[#F9FAFB] px-3 py-2 text-[12px] text-[#6B7280]">
          当前版本：v{currentVersion} · 人工编辑字段：{editedFieldCount} · Raw 未同步变更：{isRawDirty ? '是' : '否'}
        </div>
        <div className="mt-5 space-y-2">
          <button
            type="button"
            onClick={onReplaceAll}
            disabled={loading}
            className="w-full rounded-lg bg-[#1D1D1F] px-4 py-2.5 text-[13px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? '处理中…' : '覆盖全部解析结果'}
          </button>
          <button
            type="button"
            onClick={onPreserveEdited}
            disabled={loading}
            className="w-full rounded-lg border border-[#D1D5DB] bg-white px-4 py-2.5 text-[13px] font-medium text-[#1F2937] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? '处理中…' : '保留人工编辑字段，仅更新未编辑字段'}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="w-full rounded-lg px-4 py-2 text-[12px] text-[#6B7280] hover:bg-[#F3F4F6] disabled:cursor-not-allowed disabled:opacity-60"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
