import type {
  AudienceItem,
  CapabilityCard,
  MockCharacterAsset,
  MockProductAsset,
  MockSceneAsset,
  ProductPreviewSummary,
  SegmentPlanItem,
  ShortDramaProjectDraft,
  StoryBlueprint,
  StoryBlueprintAnalysisItem,
  StoryBlueprintGlobalField,
  StoryBlueprintSettingRow,
  Step4SegmentItem,
  WorkflowStepItem,
} from '@/types/shortDrama';

export const mockCapabilityCards: CapabilityCard[] = [
  {
    id: 'parse',
    title: '产品解析',
    description:
      '深度解析产品卖点、品牌调性、目标受众，自动提炼剧情化关键词与情绪方向。',
    icon: 'ri-scan-2-line',
    accentColor: '#B45309',
    tags: ['卖点提炼', '受众画像', '品牌语境'],
  },
  {
    id: 'story',
    title: '剧情生成',
    description:
      '基于产品信息生成完整剧本大纲，包含 Hook、冲突、反转、结尾，结构化输出。',
    icon: 'ri-quill-pen-line',
    accentColor: '#DC2626',
    tags: ['Hook 设计', '冲突节奏', '分段脚本'],
  },
  {
    id: 'assets',
    title: '角色与场景资产',
    description: '自动生成角色设定与场景描述，配套 AI 参考图，构建统一视觉资产库。',
    icon: 'ri-user-star-line',
    accentColor: '#047857',
    tags: ['角色设定', '场景生成', '视觉资产'],
  },
  {
    id: 'video',
    title: '分镜与视频生成',
    description: '将脚本转化为逐镜头描述，对接 AI 视频生成，完成可下载的广告片段。',
    icon: 'ri-movie-2-line',
    accentColor: '#334155',
    tags: ['镜头设计', 'AI 视频', '多平台导出'],
  },
];

export const mockWorkflowSteps: WorkflowStepItem[] = [
  {
    id: '1',
    num: '01',
    title: '产品输入',
    description: '上传产品信息、图片资料，AI 自动解析卖点与品牌调性',
    icon: 'ri-upload-cloud-2-line',
    accentColor: '#B45309',
  },
  {
    id: '2',
    num: '02',
    title: '剧本大纲',
    description: '生成 Hook·冲突·反转·结尾完整结构，分段规划节奏',
    icon: 'ri-file-text-line',
    accentColor: '#DC2626',
  },
  {
    id: '3',
    num: '03',
    title: '角色场景',
    description: '生成角色设定与场景图，构建可复用的视觉资产库',
    icon: 'ri-user-star-line',
    accentColor: '#047857',
  },
  {
    id: '4',
    num: '04',
    title: '片段视频',
    description: '逐镜头脚本 + AI 视频生成，支持多段合成与导出',
    icon: 'ri-movie-2-line',
    accentColor: '#334155',
  },
  {
    id: '5',
    num: '05',
    title: '导出结果',
    description: '下载视频、导出脚本和分镜文档，一键完成交付',
    icon: 'ri-download-cloud-line',
    accentColor: '#1D1D1F',
  },
];

export const mockAudience: AudienceItem[] = [
  {
    id: 'a1',
    title: '出海品牌',
    description: '为品牌出海构建剧情化广告内容，在欧美、东南亚市场建立情绪认知。',
    icon: 'ri-global-line',
    accentColor: '#B45309',
    examples: ['服装美妆', '3C 数码', '快消品'],
  },
  {
    id: 'a2',
    title: '跨境电商卖家',
    description: '将产品卖点转化为 TikTok、Reels 可用的故事型广告，提升 CVR。',
    icon: 'ri-store-2-line',
    accentColor: '#DC2626',
    examples: ['Amazon 卖家', '独立站', 'Shopify 商家'],
  },
  {
    id: 'a3',
    title: '独立站团队',
    description: '快速生产系列化商品营销短视频，建立品牌内容资产池，降低制作成本。',
    icon: 'ri-team-line',
    accentColor: '#047857',
    examples: ['内容团队', '品牌运营', '市场部门'],
  },
  {
    id: 'a4',
    title: '海外内容营销团队',
    description: '将 Campaign Brief 转化为可执行的短视频脚本与分镜资产。',
    icon: 'ri-megaphone-line',
    accentColor: '#334155',
    examples: ['营销代理', '内容机构', 'MCN 公司'],
  },
];

export const defaultProjectDraft: ShortDramaProjectDraft = {
  projectName: '',
  duration: '60s',
  format: 'single_ad',
  narrativeStyle: 'light_conflict',
  visualStyle: 'cinematic',
  aspectRatio: '9:16',
  targetMarket: 'North America',
  marketingGoal: 'brand_seeding',
  targetAudience: '',
  brandTone: 'natural',
  creativeIntent: '',
  creativeBrief: '',
};

/** 剧本大纲页左侧：项目设置（与 Create / 统一 mock 设定一致） */
export const mockStoryBlueprintProjectSettings: StoryBlueprintSettingRow[] = [
  { label: '时长', value: '60s' },
  { label: '形式', value: '单条广告' },
  { label: '风格', value: '情绪 · 反转' },
  { label: '视觉', value: '写实电影感' },
  { label: '比例', value: '9:16' },
  { label: '市场', value: '待填写' },
];

export const mockStoryBlueprintGlobalSettings: StoryBlueprintGlobalField[] = [
  { label: '主角', value: '品牌目标用户代表（由项目信息生成）' },
  { label: '核心情绪', value: '犹豫 → 可验证信任 → 行动' },
  { label: 'POV', value: '第三人称观察' },
  { label: '叙事节奏', value: '快 Hook · 中段堆叠 · 缓收 CTA' },
];

export const mockStoryBlueprintAnalysisItems: StoryBlueprintAnalysisItem[] = [
  { label: '叙事节奏', value: '快 → 中 → 缓压收', icon: 'ri-pulse-line', color: '#B45309' },
  { label: '情绪弧线', value: '压抑 → 探索 → 正向升华', icon: 'ri-emotion-line', color: '#DC2626' },
  { label: '广告密度', value: '低 · 中 · 高', icon: 'ri-bar-chart-2-line', color: '#047857' },
  { label: 'Hook 强度', value: '★★★★☆', icon: 'ri-star-line', color: '#B45309' },
];

export const mockStoryBlueprintStructureVerdict = {
  title: '结构评估',
  body: '剧情结构完整，Hook 与产品论证链路透清晰；建议压缩中段对比镜头时长，避免投放完播下滑。',
} as const;

/** 离线演示用中性剧本占位（不得用于覆盖真实 pipeline 数据） */
export const mockStoryBlueprint: StoryBlueprint = {
  title: '《占位标题 · 待生成》',
  premise: '此处为演示占位：真实剧本由「剧本生成」接口写入项目。',
  hook: '—',
  coreConflict: '—',
  twist: '—',
  resolution: '—',
};

export const mockSegmentPlan: SegmentPlanItem[] = [
  {
    id: 1,
    segmentLabel: 'Segment 1',
    title: 'Hook',
    duration: '0–12s',
    goal: '演示占位：建立代入与悬念（真实分段由后端生成）。',
    productExposureMode: '待项目定义',
    summary: '中性占位，不绑定具体品类或场景。',
    sourceSellingPoint: '',
    productFeatureToShow: '',
    targetUserTrigger: '',
    requiredVisualElements: [],
    accentColor: '#B45309',
    tags: ['占位'],
  },
  {
    id: 2,
    segmentLabel: 'Segment 2',
    title: 'Build',
    duration: '12–40s',
    goal: '演示占位：展开卖点与证明链（真实分段由后端生成）。',
    productExposureMode: '待项目定义',
    summary: '中性占位，不绑定具体品类或场景。',
    sourceSellingPoint: '',
    productFeatureToShow: '',
    targetUserTrigger: '',
    requiredVisualElements: [],
    accentColor: '#DC2626',
    tags: ['占位'],
  },
  {
    id: 3,
    segmentLabel: 'Segment 3',
    title: 'Resolution',
    duration: '40–60s',
    goal: '演示占位：收束情绪与转化（真实分段由后端生成）。',
    productExposureMode: '待项目定义',
    summary: '中性占位，不绑定具体品类或场景。',
    sourceSellingPoint: '',
    productFeatureToShow: '',
    targetUserTrigger: '',
    requiredVisualElements: [],
    accentColor: '#047857',
    tags: ['占位'],
  },
];

export const mockCharacterAssets: MockCharacterAsset[] = [
  {
    id: 'c1',
    name: '角色 A',
    roleType: '主角',
    description: '演示占位角色，真实数据来自资产规范接口。',
    imagePlaceholder: 'portrait',
    voiceStyle: '未指定',
    traitTags: ['占位'],
  },
];

export const mockSceneAssets: MockSceneAsset[] = [
  {
    id: 's1',
    name: '场景 1',
    sceneType: '待定',
    description: '演示占位场景，真实数据来自资产规范接口。',
    imagePlaceholder: 'landscape',
  },
];

export const mockProductAssets: MockProductAsset[] = [
  {
    id: 'p1',
    name: '产品 1',
    shotUse: '待定',
    description: '演示占位产品，真实数据来自资产规范接口。',
    imagePlaceholder: 'landscape',
  },
];

export const mockProductPreview: ProductPreviewSummary = {
  productName: '',
  productCategory: '',
  brandName: '',
  productSummary: '演示占位摘要。提交产品解析后，此处将显示真实提炼结果。',
  coreSellingPoints: ['卖点一（示例）', '卖点二（示例）'],
  targetUsers: [],
  usageScenarios: ['场景关键词（示例）'],
  visualFeatures: ['风格关键词（示例）'],
  productForm: '',
  keyFunctions: [],
  emotionalValue: [],
  suitableStoryAngles: [],
  userPainPoints: [],
  visualRiskNotes: [],
  consistencyNotes: [],
  immutableStructureConstraints: [],
  extractedFromImages: [],
  parseConfidence: 0,
  sourceTrace: {},
  fieldMeta: {},
  status: 'idle',
};

export const mockMarkets = ['北美', '欧洲', '日本', '东南亚', '中国', '全球', '自定义'] as const;

export const mockCategories = [
  '家居生活',
  '美妆护肤',
  '女装服饰',
  '男装配件',
  '3C 数码',
  '运动健康',
  '宠物用品',
  '食品饮料',
  '珠宝配饰',
] as const;

export const createFlowSidebarSteps = [
  { icon: 'ri-file-add-line', title: '项目初始化', desc: '设置名称与形式', step: 0 },
  { icon: 'ri-upload-cloud-2-line', title: '产品输入', desc: '上传产品资料', step: 1 },
  { icon: 'ri-pen-nib-line', title: '剧本大纲', desc: 'AI 生成结构', step: 2 },
  { icon: 'ri-user-star-line', title: '角色场景', desc: '视觉资产生成', step: 3 },
  { icon: 'ri-movie-2-line', title: '片段视频', desc: '脚本与视频', step: 4 },
] as const;

/** 历史 Framer 占位：主链已改为仅使用 pipeline.segment_scripts，禁止用此数据覆盖真实项目 */
export const mockStep4InitialSegments: Step4SegmentItem[] = [];

/** 离线演示 overview 占位（Overview 主链仅使用 pipeline；勿将下列常量当作真实回退） */
export const mockOverviewProject = {
  name: '演示项目（占位）',
  createdAt: '—',
  duration: '—',
  format: '—',
  ratio: '—',
  style: '—',
  visual: '—',
  market: '—',
} as const;

export const mockOverviewSegments = [] as const;

export const mockOverviewChars = [] as const;

export const mockOverviewScenes = [] as const;

export const mockOverviewProducts = [] as const;

export const mockOverviewPlotSummary = '';

export const mockOverviewFinalVideoThumb =
  'https://readdy.ai/api/search-image?query=abstract%20soft%20gradient%209x16%20vertical%20minimal%20clean%20background%20no%20objects%20neutral%20light&width=180&height=320&seq=final-neutral&orientation=portrait';
