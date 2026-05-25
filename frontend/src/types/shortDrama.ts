/** Front-end draft types for Short Drama module (mock phase; not API-aligned). */

export type DurationOption = '30s' | '45s' | '60s';

export type ProjectFormat = 'single_ad' | 'series';

export type NarrativeStyle = 'light_conflict' | 'healing' | 'comedy' | 'suspense' | 'emotional';

export type VisualStyle = 'cinematic' | 'anime' | '3d_render' | 'premium_ad';

export type AspectRatioOption = '9:16' | '16:9';
export type TargetMarketOption =
  | 'North America'
  | 'Europe'
  | 'Japan'
  | 'Korea'
  | 'Thailand'
  | 'Southeast Asia'
  | 'China'
  | 'Global'
  | 'Custom';

export interface ShortDramaProjectDraft {
  projectName: string;
  duration: DurationOption;
  format: ProjectFormat;
  narrativeStyle: NarrativeStyle;
  visualStyle: VisualStyle;
  aspectRatio: AspectRatioOption;
  targetMarket: TargetMarketOption;
  marketingGoal: string;
  targetAudience: string;
  brandTone: string;
  creativeIntent: string;
  creativeBrief: string;
}

export interface ProductInputDraft {
  productNameRaw: string;
  productCategoryRaw: string;
  brandRaw: string;
  priceRaw: string;
  targetUsersRaw: string;
  sellingPointsRaw: string[];
  usageScenariosRaw: string[];
  extraNotesRaw: string;
  productImages: {
    imageUrl: string;
    imageOrder: number;
    isMainImage: boolean;
    imageCaptionRaw: string;
  }[];
}

export type ParseStatus = 'idle' | 'parsing' | 'ready' | 'error';

export interface ParsedProductContextDraft {
  productName: string;
  productCategory: string;
  /** 归一化品牌名（与后端 product_context.brand_name 对齐） */
  brandName: string;
  productSummary: string;
  coreSellingPoints: string[];
  targetUsers: string[];
  usageScenarios: string[];
  visualFeatures: string[];
  productForm: string;
  keyFunctions: string[];
  emotionalValue: string[];
  suitableStoryAngles: string[];
  userPainPoints: string[];
  visualRiskNotes: string[];
  consistencyNotes: string[];
  immutableStructureConstraints: string[];
  extractedFromImages: string[];
  parseConfidence: number;
  sourceTrace: Record<string, string>;
  fieldMeta: Record<string, { edited_by_user?: boolean; edited_at?: string }>;
}

export interface ProductPreviewSummary extends ParsedProductContextDraft {
  status: ParseStatus;
  errorMessage?: string;
}

export interface CapabilityCard {
  id: string;
  title: string;
  description: string;
  icon: string;
  /** Framer-style muted accent (hex), used for icon + tags */
  accentColor: string;
  tags: string[];
}

export interface WorkflowStepItem {
  id: string;
  num: string;
  title: string;
  description: string;
  icon: string;
  accentColor: string;
}

export interface AudienceItem {
  id: string;
  title: string;
  description: string;
  /** Remix Icon class, e.g. ri-global-line */
  icon: string;
  accentColor: string;
  examples: string[];
}

/** AI 剧情蓝图（Story Blueprint 页） */
export interface StoryBlueprint {
  title: string;
  premise: string;
  hook: string;
  coreConflict: string;
  twist: string;
  resolution: string;
  frameworkSections?: {
    key: string;
    label: string;
    content: string;
  }[];
  languagePolicy?: {
    workflowLanguage?: string;
    videoLanguage?: string;
    targetMarket?: string;
  };
  marketingStrategy?: Record<string, string>;
  storyStructure?: Record<string, unknown>;
  storyFramework?: {
    type?: string;
    name?: string;
    structure?: string[];
    reason?: string;
  };
  assetRequirements?: Record<string, unknown>;
  shotPlan?: Record<string, unknown>;
  spokenStrategy?: Record<string, unknown>;
}

export interface SegmentPlanItem {
  id: number;
  /** 段落名，如 Hook / Conflict */
  title: string;
  /** 展示用副标题，如 Segment 1 */
  segmentLabel: string;
  duration: string;
  goal: string;
  productExposureMode: string;
  productExposure?: string;
  segmentRole?: string;
  emotionalState?: string;
  summary: string;
  sourceSellingPoint?: string;
  productFeatureToShow?: string;
  targetUserTrigger?: string;
  requiredVisualElements?: string[];
  expectedAssets?: string[];
  transitionToNext?: string;
  accentColor: string;
  /** 轻量 tag，如 B2B 广告节奏 */
  tags?: string[];
}

export type AssetsTabId = 'characters' | 'scenes' | 'productAssets';

export interface MockCharacterAsset {
  id: string;
  name: string;
  roleType: string;
  description: string;
  /** 占位：本轮用纯色/渐变块，预留字段便于下轮接图 */
  imagePlaceholder: 'portrait' | 'square';
  voiceStyle?: string;
  traitTags?: string[];
}

export interface MockSceneAsset {
  id: string;
  name: string;
  sceneType: string;
  description: string;
  imagePlaceholder: 'landscape' | 'square';
}

export interface MockProductAsset {
  id: string;
  name: string;
  description: string;
  /** 镜头定位 / 在成片中的使用方式 */
  shotUse: string;
  imagePlaceholder: 'landscape' | 'square';
}

/** Assets 页：与 Framer 卡片字段对齐的视图模型（由 pipeline 适配） */
export type AssetsPageCharacterVm = {
  id: number;
  name: string;
  role: string;
  desc: string;
  tags: string[];
  voice: string;
  img: string | null;
  hasRealImage: boolean;
  visualPrompt: string;
};

export type AssetsPageSceneVm = {
  id: number;
  name: string;
  type: string;
  desc: string;
  img: string | null;
  hasRealImage: boolean;
  visualPrompt: string;
};

export type AssetsPageProductVm = {
  id: number;
  name: string;
  placement: string;
  cameraHint: string;
  desc: string;
  img: string | null;
  hasRealImage: boolean;
};

export type AssetsPageViewModel = {
  characters: AssetsPageCharacterVm[];
  scenes: AssetsPageSceneVm[];
  products: AssetsPageProductVm[];
};

/** 剧本大纲页侧栏：项目参数行 */
export interface StoryBlueprintSettingRow {
  label: string;
  value: string;
}

/** 剧本大纲页：全局叙事设定 */
export interface StoryBlueprintGlobalField {
  label: string;
  value: string;
}

/** 剧本大纲页：结构分析小块 */
export interface StoryBlueprintAnalysisItem {
  label: string;
  value: string;
  icon: string;
  color: string;
}

export interface StoryBlueprintAnalysisSectionField {
  label: string;
  value: string;
}

export interface StoryBlueprintAnalysisSection {
  key: string;
  title: string;
  icon: string;
  color: string;
  fields: StoryBlueprintAnalysisSectionField[];
}

/** Framer step4：片段与镜头（片段视频页） */
export interface Step4Shot {
  id: number;
  backendShotId: string;
  desc: string;
  shotRole?: string;
  action: string;
  spokenText: string;
  voiceoverText: string;
  subtitleText: string;
  camera?: string;
  cameraMovement?: string;
  framing?: string;
  dialogue: string;
  voiceover?: string;
  subtitle?: string;
  dialogueSource?:
    | 'dialogue'
    | 'voiceover'
    | 'narration'
    | 'spoken_line'
    | 'caption'
    | 'dialogue_lines'
    | 'lines'
    | 'script'
    | 'none';
  emotion: string;
  duration: string;
  durationSeconds: number;
  /** 结构化槽位（新数据或 pipeline 推断）；旧数据可能部分为空 */
  sceneDescription?: string;
  subjectDescription?: string;
  cameraDescription?: string;
  imagePrompt?: string;
  videoPrompt?: string;
  generationPrompt?: string;
  visualStyleInstruction?: string;
  marketLocalizationDetail?: string;
  manualVideoPrompt?: string;
  characterRefs?: string[];
  characterAssetIds?: string[];
  manualCharacterRefs?: string[];
  sceneRef?: string;
  sceneAssetId?: string;
  manualSceneRef?: string;
  productRefs?: string[];
  productAssetId?: string;
  manualProductRefs?: string[];
  mustShow?: string[];
  mustAvoid?: string[];
  sourceSegmentId?: string;
  sourceSellingPoint?: string;
  sourceVisualConstraints?: Record<string, unknown>;
  executionInput?: Record<string, unknown>;
  promptBudget?: Record<string, unknown>;
  providerError?: string;
  providerResponse?: Record<string, unknown>;
  viewerTakeaway?: string;
  visualDirection?: string;
  characterDirection?: string;
  productPresence?: string;
  productPurpose?: string;
  sceneDirection?: string;
  cameraDirection?: string;
  dialogueText?: string;
  audioIntent?: string;
  audioStatus?: string;
  audioRequired?: boolean;
  subtitleRequired?: boolean;
}

export interface Step4SegmentItem {
  id: number;
  backendRecordId?: number;
  name: string;
  duration: string;
  durationLimit: number;
  goal: string;
  productionPrompt?: string;
  sourceExcerpt?: string;
  segmentRole?: string;
  productExposure?: string;
  characters: string[];
  scene: string;
  placement: string;
  color: string;
  isNew?: boolean;
  shots: Step4Shot[];
  /** 后端 segment_id（如 seg_1），用于单段视频生成 */
  backendSegmentId?: string;
  functionLabel?: string;
  shortLabel?: string;
  /** pipeline 返回的相对或绝对地址，展示前需经 utils/shortDramaMedia.resolvePublicMediaUrl */
  videoUrl?: string | null;
}

export interface Step4RenderProgress {
  phase: string;
  phaseLabel: string;
  percent: number;
  currentShot: number;
  totalShots: number;
  totalFrames: number;
}

export type Step4VideoStatus = 'idle' | 'queued' | 'running' | 'completed' | 'failed';
export type Step4VideoStatusMap = Record<number, Step4VideoStatus>;
export type Step4RenderProgressMap = Record<number, Step4RenderProgress>;
