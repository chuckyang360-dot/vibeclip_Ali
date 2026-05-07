import { ri } from '../utils/shortDramaHelpers';

type UploadDropzoneProps = {
  label: string;
  hint?: string;
  variant?: 'tile' | 'row';
};

export function UploadDropzone({ label, hint = '点击或拖拽上传（占位）', variant = 'tile' }: UploadDropzoneProps) {
  if (variant === 'row') {
    return (
      <button
        type="button"
        className="flex w-full cursor-default items-center justify-center gap-2 rounded-xl border border-dashed border-[#D1D1D6] bg-[#F7F8FA] py-3 text-[12.5px] text-[#8E8E93] transition-colors hover:border-[#1D1D1F] hover:text-[#1D1D1F]"
      >
        <i className={ri('ri-file-upload-line', 'text-[14px]')} aria-hidden />
        {label}
      </button>
    );
  }

  return (
    <button
      type="button"
      className="flex aspect-square w-full cursor-default flex-col items-center justify-center gap-1.5 rounded-xl border-[1.5px] border-dashed border-[#D1D1D6] bg-[#F7F8FA] transition-colors hover:border-[#1D1D1F] hover:bg-[#F5F5F7]"
    >
      <i className={ri('ri-add-line', 'text-[20px] text-[#AEAEB2]')} aria-hidden />
      <span className="max-w-[7rem] px-1 text-center text-[10px] text-[#AEAEB2]">{hint}</span>
      <span className="text-[10px] font-medium text-[#8E8E93]">{label}</span>
    </button>
  );
}
