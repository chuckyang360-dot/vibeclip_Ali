import type { MockCharacterAsset, MockProductAsset, MockSceneAsset } from '@/types/shortDrama';
import { ri, sdColors, sdFontHeading } from '../utils/shortDramaHelpers';

function ImagePlaceholder({
  ratio,
  accentHex,
}: {
  ratio: 'portrait' | 'landscape' | 'square';
  accentHex: string;
}) {
  const aspect =
    ratio === 'portrait' ? 'aspect-[3/4] max-h-56' : ratio === 'landscape' ? 'aspect-[16/10]' : 'aspect-square max-h-48';
  return (
    <div
      className={`relative w-full overflow-hidden ${aspect}`}
      style={{
        background: `linear-gradient(145deg, ${accentHex}14 0%, #F5F5F7 45%, #E8EAED 100%)`,
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage: `radial-gradient(circle at 25% 15%, rgba(255,255,255,0.95) 0%, transparent 50%)`,
        }}
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <i className={ri('ri-image-2-line', 'text-[28px] text-[#C7C7CC]')} aria-hidden />
      </div>
      <div
        className="absolute bottom-2 right-2 rounded-full bg-white/95 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[#8E8E93]"
        style={{ border: '1px solid rgba(0,0,0,0.06)' }}
      >
        AI 参考占位
      </div>
    </div>
  );
}

type CharacterProps = { variant: 'character'; data: MockCharacterAsset; accent: string };
type SceneProps = { variant: 'scene'; data: MockSceneAsset; accent: string };
type ProductProps = { variant: 'product'; data: MockProductAsset; accent: string };

export type AssetCardProps = CharacterProps | SceneProps | ProductProps;

export function AssetCard(props: AssetCardProps) {
  const { variant, accent } = props;

  if (variant === 'character') {
    const { data } = props;
    return (
      <article
        className="overflow-hidden rounded-2xl border border-[#EAEAEA] bg-white transition-shadow duration-200 hover:shadow-[0_10px_32px_rgba(0,0,0,0.06)]"
      >
        <div className="relative">
          <ImagePlaceholder ratio={data.imagePlaceholder === 'portrait' ? 'portrait' : 'square'} accentHex={accent} />
          <div className="absolute left-2.5 top-2.5">
            <span
              className="rounded-full px-2 py-1 text-[10px] font-semibold"
              style={{
                background: 'rgba(255,255,255,0.94)',
                color: '#444444',
                border: '1px solid rgba(0,0,0,0.06)',
              }}
            >
              角色
            </span>
          </div>
        </div>
        <div className="p-4">
          <h3 className="text-[15px] font-bold" style={{ ...sdFontHeading, color: sdColors.ink }}>
            {data.name}
          </h3>
          <p className="mt-1 text-[11px] font-medium text-[#8E8E93]">{data.roleType}</p>
          <p className="mt-2 text-[12px] leading-relaxed text-[#6E6E73]">{data.description}</p>
          {data.traitTags?.length ? (
            <div className="mt-3 flex flex-wrap gap-1">
              {data.traitTags.map((t) => (
                <span
                  key={t}
                  className="rounded-full px-2 py-0.5 text-[10px]"
                  style={{ background: '#F5F5F7', color: '#6E6E73' }}
                >
                  {t}
                </span>
              ))}
            </div>
          ) : null}
          {data.voiceStyle ? (
            <div
              className="mt-3 flex items-center gap-2 rounded-lg px-2 py-2 text-[11.5px] text-[#6E6E73]"
              style={{ background: '#F7F8FA', border: `1px solid ${sdColors.border}` }}
            >
              <i className={ri('ri-mic-line', 'text-[12px] text-[#8E8E93]')} aria-hidden />
              音色：{data.voiceStyle}
            </div>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#EAEAEA] bg-[#F7F8FA] px-2 py-2 text-[11.5px] font-medium text-[#444444] transition-colors hover:bg-[#EAEAEA] min-[400px]:flex-none"
            >
              <i className={ri('ri-refresh-line', 'text-[12px]')} aria-hidden />
              重新生成
            </button>
            <button
              type="button"
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#EAEAEA] bg-white px-2 py-2 text-[11.5px] font-medium text-[#444444] transition-colors hover:bg-[#F7F8FA] min-[400px]:flex-none"
            >
              <i className={ri('ri-edit-line', 'text-[12px]')} aria-hidden />
              编辑
            </button>
            <button
              type="button"
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[#D1D1D6] bg-white px-2 py-2 text-[11.5px] font-medium text-[#6E6E73] transition-colors hover:border-[#AEAEB2] sm:w-auto sm:flex-1"
            >
              <i className={ri('ri-upload-2-line', 'text-[12px]')} aria-hidden />
              上传参考图
            </button>
          </div>
        </div>
      </article>
    );
  }

  if (variant === 'scene') {
    const { data } = props;
    return (
      <article className="overflow-hidden rounded-2xl border border-[#EAEAEA] bg-white transition-shadow duration-200 hover:shadow-[0_10px_32px_rgba(0,0,0,0.06)]">
        <div className="relative">
          <ImagePlaceholder ratio="landscape" accentHex={accent} />
          <div className="absolute left-2.5 top-2.5">
            <span
              className="rounded-full px-2 py-1 text-[10px] font-semibold"
              style={{
                background: 'rgba(255,255,255,0.94)',
                color: '#047857',
                border: '1px solid rgba(4,120,87,0.2)',
              }}
            >
              场景
            </span>
          </div>
        </div>
        <div className="p-4">
          <h3 className="text-[15px] font-bold" style={{ ...sdFontHeading, color: sdColors.ink }}>
            {data.name}
          </h3>
          <p className="mt-1 text-[11px] font-medium text-[#8E8E93]">{data.sceneType}</p>
          <p className="mt-2 text-[12px] leading-relaxed text-[#6E6E73]">{data.description}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#EAEAEA] bg-[#F7F8FA] px-3 py-2 text-[11.5px] font-medium text-[#444444] transition-colors hover:bg-[#EAEAEA]"
            >
              <i className={ri('ri-refresh-line', 'text-[12px]')} aria-hidden />
              重新生成
            </button>
            <button
              type="button"
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#EAEAEA] bg-white px-3 py-2 text-[11.5px] font-medium text-[#444444] transition-colors hover:bg-[#F7F8FA]"
            >
              <i className={ri('ri-edit-line', 'text-[12px]')} aria-hidden />
              编辑
            </button>
          </div>
        </div>
      </article>
    );
  }

  const { data } = props;
  return (
    <article className="overflow-hidden rounded-2xl border border-[#EAEAEA] bg-white transition-shadow duration-200 hover:shadow-[0_10px_32px_rgba(0,0,0,0.06)]">
      <div className="relative">
        <ImagePlaceholder ratio="landscape" accentHex={accent} />
        <div className="absolute left-2.5 top-2.5">
          <span
            className="rounded-full px-2 py-1 text-[10px] font-semibold tracking-wide"
            style={{
              background: 'rgba(51,65,85,0.1)',
              color: '#334155',
              border: '1px solid rgba(51,65,85,0.2)',
            }}
          >
            镜头资产
          </span>
        </div>
      </div>
      <div className="p-4">
        <h3 className="text-[15px] font-bold" style={{ ...sdFontHeading, color: sdColors.ink }}>
          {data.name}
        </h3>
        <p className="mt-1 text-[11px] font-semibold text-[#334155]">{data.shotUse}</p>
        <p className="mt-2 text-[12px] leading-relaxed text-[#6E6E73]">{data.description}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#EAEAEA] bg-white px-3 py-2 text-[11.5px] font-medium text-[#444444] transition-colors hover:bg-[#F7F8FA]"
          >
            <i className={ri('ri-edit-line', 'text-[12px]')} aria-hidden />
            编辑
          </button>
          <button
            type="button"
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#EAEAEA] bg-[#F7F8FA] px-3 py-2 text-[11.5px] font-medium text-[#444444] transition-colors hover:bg-[#EAEAEA]"
          >
            <i className={ri('ri-refresh-line', 'text-[12px]')} aria-hidden />
            重新生成
          </button>
        </div>
      </div>
    </article>
  );
}
