import { useMemo, useState } from 'react';
import type { ShortDramaProjectDto } from '@/types/shortDramaApi';
import { resolveShortDramaMediaUrl } from '../utils/shortDramaMedia';

type CoverAsset = NonNullable<ShortDramaProjectDto['cover_asset']>;
type CoverAssetType = CoverAsset['asset_type'];

type ProjectCoverImageProps = {
  projectName: string;
  cover: CoverAsset | null;
  emptyTitle: string;
  emptyHint?: string;
};

function objectClassByAssetType(assetType: CoverAssetType | null | undefined): string {
  if (assetType === 'character') return 'object-cover object-top';
  if (assetType === 'product') return 'object-contain object-center';
  if (assetType === 'scene') return 'object-cover object-center';
  return 'object-cover object-center';
}

export function ProjectCoverImage({ projectName, cover, emptyTitle, emptyHint }: ProjectCoverImageProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const coverUrl = useMemo(
    () => resolveShortDramaMediaUrl(cover?.image_url ?? null),
    [cover?.image_url],
  );
  const shouldShowImage = Boolean(coverUrl) && !imageFailed;
  const objectClass = objectClassByAssetType(cover?.asset_type);
  const imageWrapClass =
    cover?.asset_type === 'product'
      ? 'h-full w-full bg-[#F9FAFB] flex items-center justify-center'
      : 'h-full w-full';

  if (shouldShowImage) {
    return (
      <div className={imageWrapClass}>
        <img
          src={coverUrl ?? undefined}
          alt={cover?.name || projectName}
          className={`h-full w-full ${objectClass}`}
          onError={() => setImageFailed(true)}
        />
      </div>
    );
  }

  const title = coverUrl ? '封面加载失败' : emptyTitle;
  const hint = coverUrl ? '重新生成资产后恢复' : emptyHint;
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#AEAEB2]">
        <i className="ri-image-line text-[22px]" />
      </div>
      <p className="text-[13px] font-semibold text-[#6E6E73]">{title}</p>
      {hint ? <p className="text-[11px] leading-relaxed text-[#AEAEB2]">{hint}</p> : null}
    </div>
  );
}
