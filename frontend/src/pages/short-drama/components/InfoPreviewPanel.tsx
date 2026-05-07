import type { ProductPreviewSummary } from '@/types/shortDrama';
import { ri, sdColors, sdFontHeading } from '../utils/shortDramaHelpers';

type Props = {
  preview: ProductPreviewSummary;
};

export function InfoPreviewPanel({ preview }: Props) {
  const statusLabel =
    preview.status === 'idle'
      ? '等待解析'
      : preview.status === 'parsing'
        ? '解析中…'
        : preview.status === 'ready'
          ? '已提取'
          : preview.status === 'error'
            ? '解析失败'
            : '解析异常';

  const summaryDisplay =
    preview.status === 'idle'
      ? '请填写上方产品资料后，点击「解析产品信息」，将请求后端进行解析。'
      : preview.status === 'parsing'
        ? 'AI 正在理解产品信息，提炼卖点、场景与风格关键词…'
        : preview.status === 'error'
          ? preview.errorMessage || '解析失败，请稍后重试。'
          : preview.productSummary;

  return (
    <section className="overflow-hidden rounded-2xl border border-[#EAEAEA] bg-white shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
      <div
        className="flex items-center gap-3 border-b border-[#EAEAEA] px-5 py-4"
        style={{ background: sdColors.surface2 }}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: sdColors.ink }}>
          <i className={ri('ri-sparkling-2-line', 'text-[14px] text-white')} aria-hidden />
        </div>
        <span className="text-[13px] font-bold" style={{ ...sdFontHeading, color: sdColors.ink }}>
          AI 解析结果
        </span>
        <span
          className="ml-auto rounded-full border px-2.5 py-1 text-[11px] font-medium"
          style={{
            background:
              preview.status === 'ready'
                ? 'rgba(4,120,87,0.08)'
                : preview.status === 'parsing'
                  ? 'rgba(59,130,246,0.08)'
                  : preview.status === 'error'
                    ? 'rgba(220,38,38,0.08)'
                    : 'rgba(0,0,0,0.04)',
            color:
              preview.status === 'ready'
                ? '#047857'
                : preview.status === 'parsing'
                  ? '#2563EB'
                  : preview.status === 'error'
                    ? '#DC2626'
                    : '#6E6E73',
            borderColor:
              preview.status === 'ready'
                ? 'rgba(4,120,87,0.18)'
                : preview.status === 'parsing'
                  ? 'rgba(37,99,235,0.2)'
                  : preview.status === 'error'
                    ? 'rgba(220,38,38,0.2)'
                    : 'rgba(0,0,0,0.06)',
          }}
        >
          {statusLabel}
        </span>
      </div>

      <div className="space-y-5 p-5">
        {preview.status === 'parsing' ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <i className={ri('ri-loader-4-line', 'animate-spin text-[22px] text-[#1D1D1F]')} aria-hidden />
            <p className="text-[13px] text-[#8E8E93]">解析中，请稍候…</p>
          </div>
        ) : null}

        {preview.status !== 'parsing' ? (
          <>
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[#8E8E93]">产品摘要</p>
              <p
                className="rounded-xl border border-[#EAEAEA] p-4 text-[13px] leading-relaxed"
                style={{
                  color:
                    preview.status === 'idle' ? '#8E8E93' : preview.status === 'error' ? '#DC2626' : '#444444',
                  background: sdColors.surface,
                }}
              >
                {summaryDisplay}
              </p>
            </div>

            <div className="rounded-xl border border-[#EAEAEA] bg-[#F7F8FA] p-4">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[#6E6E73]">核心卖点</p>
              <p className="text-[12px] text-[#444444]">{preview.coreSellingPoints.join(' / ') || '—'}</p>
            </div>
            <div className="rounded-xl border border-[#EAEAEA] bg-[#F7F8FA] p-4">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[#6E6E73]">视觉特征</p>
              <p className="text-[12px] text-[#444444]">{preview.visualFeatures.join(' / ') || '—'}</p>
            </div>
            <div className="rounded-xl border border-[#EAEAEA] bg-[#F7F8FA] p-4">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[#6E6E73]">故事角度</p>
              <p className="text-[12px] text-[#444444]">{preview.suitableStoryAngles.join(' / ') || '—'}</p>
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
