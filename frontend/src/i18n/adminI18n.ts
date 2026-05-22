export type AdminLocale = 'zh' | 'en';

type Dict = Record<string, string>;

const zh: Dict = {
  dashboard: '总览',
  users: '用户管理',
  projects: '项目管理',
  apiLogs: 'API 调用日志',
  credits: '积分管理',
  adminLogs: '操作日志',
  modelConfig: '模型配置',
  settings: '系统设置',
  today: '今日',
  day7: '7天',
  day30: '30天',
  custom: '自定义',
  searchPlaceholder: '搜索...',
  admin: '管理员',
  logout: '退出登录',
  totalUsers: '总用户数',
  newUsersToday: '今日新增用户',
  totalProjects: '总项目数',
  projectsToday: '今日项目数',
  assetsGeneratedToday: '今日生成资产',
  videosGeneratedToday: '今日生成视频',
  apiCallsToday: '今日 API 调用',
  creditsConsumedToday: '今日积分消耗',
  estimatedCostToday: '今日预估成本',
  failedJobsToday: '今日失败任务',
  totalRevenue: '总收入',
  todayRevenue: '今日收入',
  userGrowth: '用户增长趋势',
  projectVideoGeneration: '项目与视频生成趋势',
  apiCallsAndCost: 'API 调用与成本',
  apiHealth: 'API 健康状态',
  topConsumingUsers: '高消耗用户',
  noProviderStats: '暂无服务商统计',
  logsPopulate: '日志会随调用逐步生成',
  search: '搜索',
  status: '状态',
  sort: '排序',
  apply: '应用',
  user: '用户',
  actions: '操作',
  view: '查看',
  grant: '赠送',
  disable: '禁用',
  restore: '恢复',
  reason: '原因',
  amount: '数量',
  confirm: '确认',
  cancel: '取消',
  overview: '概览',
  errors: '错误',
  projectName: '项目名称',
  currentStep: '当前步骤',
  assets: '资产',
  videos: '视频',
  creditsUsed: '已用积分',
  apiCalls: 'API 调用',
  lastError: '最近错误',
  createdAt: '创建时间',
  updatedAt: '更新时间',
  provider: '服务商',
  businessType: '业务类型',
  model: '模型',
  httpStatus: 'HTTP 状态',
  duration: '耗时',
  estimatedCost: '预估成本',
  errorMessage: '错误信息',
  requestSummary: '请求摘要',
  responseSummary: '响应摘要',
  errorDetail: '错误详情',
  creditAccounts: '积分账户',
  creditTransactions: '积分流水',
  manualAdjustment: '手动调整',
  currentBalance: '当前余额',
  totalGranted: '累计发放',
  totalConsumed: '累计消耗',
  totalRefunded: '累计退回',
  operator: '操作人',
  action: '操作',
  targetType: '对象类型',
  targetId: '对象 ID',
  before: '修改前',
  after: '修改后',
  creditRules: '积分规则',
  assetGenerationCost: '资产生成成本',
  videoGenerationCost: '视频生成成本',
  refundPolicy: '退款策略',
  apiProviders: 'API 服务商',
  adminRoles: '管理员角色',
  superAdmin: '超级管理员',
  roleOperator: '运营人员',
  viewer: '查看人员',
};

/** 关键指标：主字典缺失或为空时仍返回正确文案（避免旧构建/缓存导致 label 回退为 key）。 */
const LABEL_FALLBACK: Partial<Record<string, Record<AdminLocale, string>>> = {
  totalRevenue: { zh: '总收入', en: 'Total Revenue' },
  todayRevenue: { zh: '今日收入', en: 'Today Revenue' },
};

const en: Dict = {
  dashboard: 'Dashboard',
  users: 'Users',
  projects: 'Projects',
  apiLogs: 'API Logs',
  credits: 'Credits',
  adminLogs: 'Admin Logs',
  modelConfig: 'Model Config',
  settings: 'Settings',
  today: 'Today',
  day7: '7D',
  day30: '30D',
  custom: 'Custom',
  searchPlaceholder: 'Search...',
  admin: 'Admin',
  logout: 'Log out',
  totalUsers: 'Total Users',
  newUsersToday: 'New Users Today',
  totalProjects: 'Total Projects',
  projectsToday: 'Projects Today',
  assetsGeneratedToday: 'Assets Generated Today',
  videosGeneratedToday: 'Videos Generated Today',
  apiCallsToday: 'API Calls Today',
  creditsConsumedToday: 'Credits Consumed Today',
  estimatedCostToday: 'Estimated Cost Today',
  failedJobsToday: 'Failed Jobs Today',
  totalRevenue: 'Total Revenue',
  todayRevenue: 'Today Revenue',
  userGrowth: 'User Growth',
  projectVideoGeneration: 'Project & Video Generation',
  apiCallsAndCost: 'API Calls & Cost',
  apiHealth: 'API Health',
  topConsumingUsers: 'Top Consuming Users',
  noProviderStats: 'No provider stats yet',
  logsPopulate: 'Logs will populate over time.',
  search: 'Search',
  status: 'Status',
  sort: 'Sort',
  apply: 'Apply',
  user: 'User',
  actions: 'Actions',
  view: 'View',
  grant: 'Grant',
  disable: 'Disable',
  restore: 'Restore',
  reason: 'Reason',
  amount: 'Amount',
  confirm: 'Confirm',
  cancel: 'Cancel',
  overview: 'Overview',
  errors: 'Errors',
  projectName: 'Project Name',
  currentStep: 'Current Step',
  assets: 'Assets',
  videos: 'Videos',
  creditsUsed: 'Credits Used',
  apiCalls: 'API Calls',
  lastError: 'Last Error',
  createdAt: 'Created At',
  updatedAt: 'Updated At',
  provider: 'Provider',
  businessType: 'Business Type',
  model: 'Model',
  httpStatus: 'HTTP Status',
  duration: 'Duration',
  estimatedCost: 'Estimated Cost',
  errorMessage: 'Error Message',
  requestSummary: 'Request Summary',
  responseSummary: 'Response Summary',
  errorDetail: 'Error Detail',
  creditAccounts: 'Credit Accounts',
  creditTransactions: 'Credit Transactions',
  manualAdjustment: 'Manual Adjustment',
  currentBalance: 'Current Balance',
  totalGranted: 'Total Granted',
  totalConsumed: 'Total Consumed',
  totalRefunded: 'Total Refunded',
  operator: 'Operator',
  action: 'Action',
  targetType: 'Target Type',
  targetId: 'Target ID',
  before: 'Before',
  after: 'After',
  creditRules: 'Credit Rules',
  assetGenerationCost: 'Asset Generation Cost',
  videoGenerationCost: 'Video Generation Cost',
  refundPolicy: 'Refund Policy',
  apiProviders: 'API Providers',
  adminRoles: 'Admin Roles',
  superAdmin: 'Super Admin',
  roleOperator: 'Operator',
  viewer: 'Viewer',
};

export function tAdmin(locale: AdminLocale, key: string): string {
  const dict = locale === 'zh' ? zh : en;
  const fromDict = dict[key];
  if (typeof fromDict === 'string' && fromDict.length > 0) {
    return fromDict;
  }
  const fb = LABEL_FALLBACK[key];
  if (fb) {
    return fb[locale];
  }
  return key;
}

const statusMap: Record<string, { zh: string; en: string }> = {
  normal: { zh: '正常', en: 'Normal' },
  disabled: { zh: '已禁用', en: 'Disabled' },
  risk: { zh: '风险', en: 'Risk' },
  success: { zh: '成功', en: 'Success' },
  failed: { zh: '失败', en: 'Failed' },
  timeout: { zh: '超时', en: 'Timeout' },
  rate_limited: { zh: '频率限制', en: 'Rate Limited' },
  processing: { zh: '处理中', en: 'Processing' },
  completed: { zh: '已完成', en: 'Completed' },
  draft: { zh: '草稿', en: 'Draft' },
  error: { zh: '错误', en: 'Error' },
};

const txnMap: Record<string, { zh: string; en: string }> = {
  admin_grant: { zh: '后台赠送', en: 'Admin Grant' },
  admin_deduct: { zh: '后台扣减', en: 'Admin Deduct' },
  subscription_grant: { zh: '订阅发放', en: 'Subscription Grant' },
  asset_generation_consume: { zh: '资产生成消耗', en: 'Asset Generation' },
  video_generation_consume: { zh: '视频生成消耗', en: 'Video Generation' },
  refund: { zh: '退回', en: 'Refund' },
  adjustment: { zh: '系统校正', en: 'Adjustment' },
};

const businessTypeMap: Record<string, { zh: string; en: string }> = {
  product_parse: { zh: '商品解析', en: 'Product Parse' },
  script_generate: { zh: '剧本生成', en: 'Script Generation' },
  asset_generate: { zh: '资产生成', en: 'Asset Generation' },
  video_generate: { zh: '视频生成', en: 'Video Generation' },
  video_status_polling: { zh: '视频状态轮询', en: 'Video Status Polling' },
  r2_upload: { zh: 'R2 上传', en: 'R2 Upload' },
  other: { zh: '其他', en: 'Other' },
};

export function formatAdminStatus(locale: AdminLocale, raw: unknown): string {
  const key = String(raw || '').toLowerCase();
  const item = statusMap[key];
  return item ? item[locale] : String(raw || '-');
}

export function formatTransactionType(locale: AdminLocale, raw: unknown): string {
  const key = String(raw || '').toLowerCase();
  const item = txnMap[key];
  return item ? item[locale] : String(raw || '-');
}

export function formatBusinessType(locale: AdminLocale, raw: unknown): string {
  const key = String(raw || '').toLowerCase();
  const item = businessTypeMap[key];
  return item ? item[locale] : String(raw || '-');
}
