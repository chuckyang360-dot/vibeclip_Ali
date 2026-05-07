import type { AssetLibraryItemDto } from '@/types/shortDramaApi';
import { getAssetThumbnailUrl } from './assetsPageAdapters';

function pickTypeFields(row: AssetLibraryItemDto): Record<string, unknown> {
  const extra = row.extra;
  if (!extra || typeof extra !== 'object') return {};
  const tf = (extra as Record<string, unknown>).type_fields;
  return tf && typeof tf === 'object' ? (tf as Record<string, unknown>) : {};
}

function asText(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function asPositiveInt(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

type SceneLabel = '开场' | '冲突' | '转折' | '收尾' | '生活场景';
type SceneLabelSource = 'scene_type' | 'fallback';
export type StructureSummary = {
  sceneStage: string;
  sceneForm: string;
  visualAnchor: string;
  variantCount: string;
  source: string;
};

export function mapRoleTypeToLabel(roleType: unknown): string {
  const x = asText(roleType).toLowerCase();
  if (!x) return '';
  if (x === 'main') return '主角';
  if (x === 'supporting') return '配角';
  if (x === 'antagonist') return '反派';
  if (x === 'extra') return '路人';
  return '';
}

export function mapSceneTypeToLabel(sceneType: unknown): string {
  const x = asText(sceneType).toLowerCase();
  if (!x) return '';
  if (x === 'hook') return '开场';
  if (x === 'conflict') return '冲突';
  if (x === 'turn') return '转折';
  if (x === 'resolution') return '收尾';
  return '';
}

export function mapSceneFormToLabel(sceneForm: unknown): string {
  const x = asText(sceneForm).toLowerCase();
  if (!x) return '';
  if (x === 'interior') return '室内';
  if (x === 'exterior') return '室外';
  if (x === 'montage') return '蒙太奇';
  return '';
}

export function mapProductRoleToLabel(productRole: unknown): string {
  const x = asText(productRole).toLowerCase();
  if (!x) return '';
  if (x === 'hero') return '主商品';
  if (x === 'contrast') return '对比商品';
  if (x === 'prop') return '道具';
  if (x === 'solution') return '解决方案';
  return '';
}

export function mapNarrativeFunctionToLabel(narrativeFunction: unknown): string {
  const x = asText(narrativeFunction).toLowerCase();
  if (!x) return '';
  if (['hook', 'opening', '开场'].includes(x)) return '负责开场吸引注意';
  if (['conflict', 'build', '冲突'].includes(x)) return '推动冲突与情节发展';
  if (['twist', 'turn', '转折'].includes(x)) return '承担转折与信息反转';
  if (['resolution', 'ending', '收尾'].includes(x)) return '用于收尾与结果确认';
  return '参与剧情推进';
}

function readTopLevelField(row: AssetLibraryItemDto, key: string): unknown {
  return (row as unknown as Record<string, unknown>)[key];
}

function resolveSceneLabelWithSource(row: AssetLibraryItemDto): { label: SceneLabel; source: SceneLabelSource } {
  const tf = pickTypeFields(row);
  const sceneType = readTopLevelField(row, 'scene_type') ?? tf.scene_type;
  const mapped = mapSceneTypeToLabel(sceneType);
  if (mapped) return { label: mapped as SceneLabel, source: 'scene_type' };
  // fallback when no valid stage-type scene_type
  return { label: '生活场景', source: 'fallback' };
}

export function resolveVisualAnchorImageUrl(row: AssetLibraryItemDto): string {
  return getAssetThumbnailUrl(row) ?? '';
}

export function resolveVisualAnchorImageId(row: AssetLibraryItemDto): number | null {
  const tf = pickTypeFields(row);
  return (
    asPositiveInt(readTopLevelField(row, 'cover_image_id')) ??
    asPositiveInt((readTopLevelField(row, 'cover_image') as Record<string, unknown> | undefined)?.id) ??
    asPositiveInt(readTopLevelField(row, 'visual_anchor_image_id')) ??
    asPositiveInt(tf.visual_anchor_image_id) ??
    asPositiveInt((row.images ?? [])[0]?.id)
  );
}

export function resolveAssetRoleLabel(row: AssetLibraryItemDto): string {
  const tf = pickTypeFields(row);
  const roleType = readTopLevelField(row, 'role_type') ?? tf.role_type;
  const productRole = readTopLevelField(row, 'product_role') ?? tf.product_role;
  if (row.asset_type === 'character') {
    const mapped = mapRoleTypeToLabel(roleType);
    if (mapped) return mapped;
    return '待标注角色';
  }
  if (row.asset_type === 'scene') {
    return resolveSceneLabelWithSource(row).label;
  }
  const mapped = mapProductRoleToLabel(productRole);
  if (mapped) return mapped;
  return '待标注产品';
}

export function buildStructureSummary(row: AssetLibraryItemDto): StructureSummary {
  const tf = pickTypeFields(row);
  const sceneType = readTopLevelField(row, 'scene_type') ?? tf.scene_type;
  const sceneForm = readTopLevelField(row, 'scene_form') ?? tf.scene_form;
  const sceneStageLabel = asText(tf.plot_stage) || mapSceneTypeToLabel(sceneType) || '未标注';
  const sceneFormLabel = asText(tf.scene_form) || mapSceneFormToLabel(sceneForm) || '未标注';
  const anchorId = asPositiveInt(readTopLevelField(row, 'visual_anchor_image_id')) ?? asPositiveInt(tf.visual_anchor_image_id);
  const variantCount = (row.images ?? []).filter((img) => Number.isInteger(img.id) && img.id > 0).length;
  return {
    sceneStage: sceneStageLabel,
    sceneForm: sceneFormLabel,
    visualAnchor: anchorId != null ? String(anchorId) : '未设置',
    variantCount: String(variantCount),
    source: resolveAssetSourceLabel(row),
  };
}

export function resolveSceneLabelDebug(row: AssetLibraryItemDto): { label: SceneLabel; source: SceneLabelSource } {
  return resolveSceneLabelWithSource(row);
}

export function resolveNarrativeFunctionLabel(row: AssetLibraryItemDto): string {
  const tf = pickTypeFields(row);
  const top = readTopLevelField(row, 'narrative_function');
  return mapNarrativeFunctionToLabel(top ?? tf.narrative_function);
}

export function resolveAssetSourceLabel(row: AssetLibraryItemDto): '系统生成' | '用户上传' | '用户参考图' {
  const hasReference = (row.images ?? []).some((img) => asText(img.image_type).toLowerCase() === 'reference');
  if (hasReference || row.has_reference_images) return '用户参考图';
  const source = asText(readTopLevelField(row, 'source')).toLowerCase();
  const hasUploaded = (row.images ?? []).some((img) => asText(img.image_type).toLowerCase() === 'uploaded');
  if (source === 'user_created' || source === 'mixed' || hasUploaded) return '用户上传';
  return '系统生成';
}

export function resolveTypeFields(row: AssetLibraryItemDto): Record<string, unknown> {
  return pickTypeFields(row);
}

function pickFirstText(...values: unknown[]): string | null {
  for (const v of values) {
    const t = asText(v);
    if (t) return t;
  }
  return null;
}

function pickFirstInt(...values: unknown[]): number | null {
  for (const v of values) {
    const n = asPositiveInt(v);
    if (n != null) return n;
  }
  return null;
}

export function buildRawStructureSnapshot(row: AssetLibraryItemDto): Record<string, unknown> {
  const tf = pickTypeFields(row);
  const extra = (row.extra && typeof row.extra === 'object') ? (row.extra as Record<string, unknown>) : {};

  const snapshot: Record<string, unknown> = {
    asset_type: row.asset_type,
    source: row.source,
  };

  const roleType = pickFirstText(readTopLevelField(row, 'role_type'), tf.role_type);
  const sceneType = pickFirstText(readTopLevelField(row, 'scene_type'), tf.scene_type);
  const sceneForm = pickFirstText(readTopLevelField(row, 'scene_form'), tf.scene_form);
  const productRole = pickFirstText(readTopLevelField(row, 'product_role'), tf.product_role);
  const narrativeFunction = pickFirstText(readTopLevelField(row, 'narrative_function'), tf.narrative_function);
  const exposurePriority = pickFirstText(readTopLevelField(row, 'exposure_priority'), tf.exposure_priority);
  const visualAnchorImageId = pickFirstInt(readTopLevelField(row, 'visual_anchor_image_id'), tf.visual_anchor_image_id);
  const segmentId = pickFirstText(readTopLevelField(row, 'segment_id'), tf.segment_id, extra.segment_id);
  const beatId = pickFirstText(readTopLevelField(row, 'beat_id'), tf.beat_id, extra.beat_id);
  const legacySource = extra.legacy_source;

  if (roleType) snapshot.role_type = roleType;
  if (sceneType) snapshot.scene_type = sceneType;
  if (sceneForm) snapshot.scene_form = sceneForm;
  if (productRole) snapshot.product_role = productRole;
  if (narrativeFunction) snapshot.narrative_function = narrativeFunction;
  if (exposurePriority) snapshot.exposure_priority = exposurePriority;
  if (visualAnchorImageId != null) snapshot.visual_anchor_image_id = visualAnchorImageId;

  const variantImageIds = (row.images ?? [])
    .map((img) => img.id)
    .filter((id): id is number => Number.isInteger(id) && id > 0);
  if (variantImageIds.length) snapshot.variant_image_ids = variantImageIds;

  if (segmentId) snapshot.segment_id = segmentId;
  if (beatId) snapshot.beat_id = beatId;
  if (legacySource && typeof legacySource === 'object' && Object.keys(legacySource as Record<string, unknown>).length) {
    snapshot.legacy_source = legacySource;
  }

  return snapshot;
}
