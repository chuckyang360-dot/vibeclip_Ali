/**
 * Short Drama 模块内统一文案（非 i18n，仅保证语气与结构一致）。
 *
 * ## Fallback 约定（真实数据优先）
 * - **必须来自后端**：project_id、project 基本字段、product_context、story_blueprint、
 *   assets 规范、segment_scripts、final_video_url（若已生成）。
 * - **允许 fallback**：缺失的 image_url 占位图、Overview/Step4 中性视觉占位、
 *   剧情摘要等字段为空时的通用占位文案（不得替换为另一套具体商品剧情）。
 * - **禁止**：在已有真实字段时用 mock 覆盖（adapter 中先读 DTO，再补占位）。
 */

export const SHORT_DRAMA_UI = {
  /** 无任一来源时的顶栏演示名（非真实项目） */
  fallbackProjectName: '演示项目',

  noProject: {
    title: '未找到项目',
    body: '缺少有效的 project_id。请从「创建项目」开始完成流程。',
    cta: '前往创建项目',
  },

  loading: {
    pipeline: '正在加载项目数据…',
    story: '正在加载剧本数据…',
    generic: '加载中…',
  },

  generating: {
    assetSpecs: '正在生成资产规范…',
    assetImages: '正在生成角色/场景/产品参考图...',
    story: '正在生成剧本…',
    segmentVideos: '正在生成片段视频…',
    merge: '正在合成完整视频…',
    mergeSubtitle: '正在合并片段并生成完整成片…',
  },

  actions: {
    retry: '重试',
    retryLoad: '重试加载',
  },

  error: {
    generic: '操作失败，请稍后重试。',
    pipelineLoad: '加载项目数据失败',
    overviewLoad: '加载项目结果失败',
    productParse: '产品解析失败',
    storyGenerate: '剧本生成失败',
    assetSpecs: '资产规范生成失败',
    assetImages: '资产参考图生成失败',
    videoGenerate: '视频生成失败',
    videoBatch: '批量生成视频失败',
    videoSingle: '单段视频生成失败',
    merge: '合成视频失败',
    mergeNoFinalUrl: '合成已完成但未返回有效的成片地址，请稍后重试。',
  },

  blocked: {
    storyNeedsProduct: '需先完成「产品解析」后再生成剧本。请返回上一步完成解析。',
    assetsNeedStory:
      '项目需先完成「剧本生成」（状态为 story_generated）后，才可生成资产规范。请返回剧本大纲并完成生成。',
  },

  storyPage: {
    noBlueprintTitle: '尚未生成剧本',
    noBlueprintBody: '当前还没有剧本大纲，请先生成。',
    loadingPipeline: '正在加载项目数据…',
    generating: '生成中…',
    generateCta: '生成剧本',
  },

  productInput: {
    missingTitle: '项目未初始化',
    missingBody: '缺少有效的 project_id，请从「创建项目」开始。',
  },

  stepFour: {
    /** Shown when pipeline segment video_render indicates mock / testsrc */
    mockTestVideoBanner:
      '开发环境模拟视频：当前片段与成片由本地 mock（ffmpeg 测试条）生成，仅供联调用，不是真实 AI 短剧成片。',
    generatingSegmentScripts: '正在生成分段脚本…',
    segmentScriptsMissing: '当前项目尚未生成分段脚本。',
    segmentScriptsBlocked:
      '无法自动生成分段脚本：请确认已完成「资产规范」且项目状态为 asset_specs_generated，或返回「角色场景」页完成上一步。',
    segmentScriptsFailed: '分段脚本生成失败',
    videoStatusBlocked:
      '当前项目状态尚不允许生成片段视频（需 assets_ready / segments_generated / video_rendering / video_segments_ready / completed）。请在后端流程到达可渲染阶段后再试。',
    assetLibraryEmpty: '暂无资产条目，请先在「角色场景」页生成资产规范。',
    videoGeneratedLabel: '视频已生成',
    segmentNotSynced: '该片段未关联后端脚本，无法单段生成。请先完成前置流程或使用「全部生成」。',
    videoRenderingHint: '项目状态为 video_rendering：若刚提交生成，请稍后重新进入本页或刷新数据。',
    mergeOverlayLine: '正在请求后端合并片段，请稍候…',
  },

  empty: {
    noSegments: '暂无分段脚本数据',
    noFinalVideo: '完整成片尚未生成',
    noFinalVideoHint: '请在「片段视频」页完成各段生成并执行「合成并查看完整视频」。合成成功后刷新本页即可预览。',
    assetsAfterCall: '资产规范接口已调用，但未返回任何角色/场景/产品条目，请检查后端或稍后重试。',
    assetsStillNone: '仍未获得资产条目。',
    assetsStateAdvanced: '流程状态已前进，已刷新数据。若仍无条目请稍后重试或联系管理员。',
  },

  done: {
    segmentBadge: '已完成',
    segmentsReady: '所有后端片段视频已就绪',
  },

  overview: {
    badgeCompleted: '项目已完成',
    badgeInProgress: '进行中',
    badgeDraft: '结果预览',
    goStepFour: '前往片段视频',
    emptyAssets: '暂无资产数据',
    emptySegments: '暂无片段预览（需先完成分段脚本与视频生成）',
  },

  assets: {
    blockedFallback: '当前流程状态不足以生成资产规范。',
    backToStory: '返回剧本大纲',
    retrySpecs: '重试生成资产规范',
    regenSingle: '单卡「重新生成」将在接入图像生成 API 后开放。当前为资产规范预览。',
    batchRegen: '「全部重新生成」需新建项目或后端重置流程；资产规范已成功生成后无法重复调用同一接口。',
    upload: '参考图上传将在下一阶段接入。当前为资产规范预览。',
    addCharacter: '手动添加角色将在后续版本开放。当前数据来自剧本与产品解析生成的规范。',
    editProduct: '在线编辑将在后续版本开放。当前展示后端返回的资产描述与镜头提示。',
    imagePhase: '成片图像生成将在下一阶段接入；若后端已返回 image_url 将直接展示。',
  },
} as const;
