export interface DashboardStat {
  labelKey: string;
  value: string;
  change: number;
  icon: string;
}

export const dashboardStats: DashboardStat[] = [
  { labelKey: "dashboard:total_users", value: "12,847", change: 3.2, icon: "ri-user-line" },
  { labelKey: "dashboard:new_users_today", value: "156", change: 8.5, icon: "ri-user-add-line" },
  { labelKey: "dashboard:total_projects", value: "45,231", change: 5.1, icon: "ri-folder-line" },
  { labelKey: "dashboard:projects_today", value: "892", change: -2.3, icon: "ri-folder-add-line" },
  { labelKey: "dashboard:assets_today", value: "3,456", change: 12.8, icon: "ri-image-line" },
  { labelKey: "dashboard:videos_today", value: "678", change: 7.2, icon: "ri-video-line" },
  { labelKey: "dashboard:api_calls_today", value: "24,567", change: 15.3, icon: "ri-server-line" },
  { labelKey: "dashboard:credits_consumed_today", value: "89,234", change: 9.6, icon: "ri-coin-line" },
  { labelKey: "dashboard:estimated_cost_today", value: "$1,247.50", change: 11.2, icon: "ri-money-cny-box-line" },
  { labelKey: "dashboard:failed_jobs_today", value: "23", change: -18.5, icon: "ri-error-warning-line" },
];

export interface TrendDataPoint {
  date: string;
  value: number;
  value2?: number;
}

export const userGrowthData: TrendDataPoint[] = [
  { date: "周一", value: 1200 },
  { date: "周二", value: 1350 },
  { date: "周三", value: 1280 },
  { date: "周四", value: 1520 },
  { date: "周五", value: 1680 },
  { date: "周六", value: 1900 },
  { date: "周日", value: 2150 },
];

export const projectVideoData: TrendDataPoint[] = [
  { date: "周一", value: 45, value2: 12 },
  { date: "周二", value: 52, value2: 15 },
  { date: "周三", value: 38, value2: 10 },
  { date: "周四", value: 67, value2: 22 },
  { date: "周五", value: 89, value2: 28 },
  { date: "周六", value: 95, value2: 30 },
  { date: "周日", value: 112, value2: 35 },
];

export const apiCostData: TrendDataPoint[] = [
  { date: "周一", value: 850, value2: 45 },
  { date: "周二", value: 920, value2: 52 },
  { date: "周三", value: 780, value2: 38 },
  { date: "周四", value: 1100, value2: 67 },
  { date: "周五", value: 1350, value2: 89 },
  { date: "周六", value: 1420, value2: 95 },
  { date: "周日", value: 1600, value2: 112 },
];

export interface ApiHealthItem {
  name: string;
  value: string;
  percentage: number;
  status: "good" | "warning" | "danger";
}

export const apiHealthItems: ApiHealthItem[] = [
  { name: "xAI 调用", value: "12,450", percentage: 50.7, status: "good" },
  { name: "Gemini 调用", value: "8,234", percentage: 33.5, status: "good" },
  { name: "Cloudflare R2 上传", value: "3,883", percentage: 15.8, status: "good" },
];

export interface ErrorType {
  type: string;
  count: number;
  percentage: number;
}

export const topErrorTypes: ErrorType[] = [
  { type: "超出速率限制", count: 45, percentage: 35 },
  { type: "超时", count: 32, percentage: 25 },
  { type: "无效响应", count: 28, percentage: 22 },
  { type: "认证失败", count: 15, percentage: 12 },
  { type: "服务不可用", count: 8, percentage: 6 },
];

export interface FailedTask {
  id: string;
  type: "Asset" | "Video" | "API";
  user: string;
  project: string;
  status: "Failed" | "Processing" | "Stuck" | "Completed";
  duration: string;
  error: string;
  createdAt: string;
}

export const failedTasks: FailedTask[] = [
  { id: "TK-001", type: "Video", user: "user_1234", project: "Summer Sale Promo", status: "Failed", duration: "4m 12s", error: "xAI rate limit exceeded", createdAt: "2026-05-09 14:32" },
  { id: "TK-002", type: "Asset", user: "user_5678", project: "New Collection Ad", status: "Stuck", duration: "12m 45s", error: "Image generation timeout", createdAt: "2026-05-09 13:15" },
  { id: "TK-003", type: "API", user: "user_9012", project: "Holiday Campaign", status: "Failed", duration: "2m 30s", error: "Gemini API 500 error", createdAt: "2026-05-09 12:08" },
  { id: "TK-004", type: "Video", user: "user_3456", project: "Flash Deal Video", status: "Processing", duration: "8m 20s", error: "-", createdAt: "2026-05-09 11:45" },
  { id: "TK-005", type: "Asset", user: "user_7890", project: "Brand Story", status: "Failed", duration: "6m 05s", error: "R2 upload failed", createdAt: "2026-05-09 10:22" },
  { id: "TK-006", type: "API", user: "user_2345", project: "Product Review", status: "Completed", duration: "1m 45s", error: "-", createdAt: "2026-05-09 09:55" },
  { id: "TK-007", type: "Video", user: "user_6789", project: "Tutorial Series", status: "Stuck", duration: "15m 30s", error: "Queue timeout", createdAt: "2026-05-09 08:40" },
  { id: "TK-008", type: "Asset", user: "user_0123", project: "Seasonal Banner", status: "Failed", duration: "3m 10s", error: "Invalid prompt format", createdAt: "2026-05-09 07:18" },
];

export interface HighConsumptionUser {
  user: string;
  email: string;
  creditsToday: number;
  apiCostToday: string;
  projects: number;
  videos: number;
  riskLevel: "Low" | "Medium" | "High" | "Critical";
}

export const highConsumptionUsers: HighConsumptionUser[] = [
  { user: "user_8842", email: "marketing@bigbrand.com", creditsToday: 15420, apiCostToday: "$342.50", projects: 45, videos: 89, riskLevel: "High" },
  { user: "user_1034", email: "admin@shopplus.com", creditsToday: 12300, apiCostToday: "$278.90", projects: 38, videos: 72, riskLevel: "Medium" },
  { user: "user_5567", email: "creative@trendy.co", creditsToday: 9870, apiCostToday: "$215.40", projects: 32, videos: 58, riskLevel: "Medium" },
  { user: "user_2201", email: "ops@megastore.io", creditsToday: 8560, apiCostToday: "$189.60", projects: 28, videos: 51, riskLevel: "Low" },
  { user: "user_7789", email: "content@fashionhub.com", creditsToday: 7420, apiCostToday: "$165.30", projects: 25, videos: 45, riskLevel: "Low" },
  { user: "user_3341", email: "video@ecommerce.pro", creditsToday: 6890, apiCostToday: "$152.80", projects: 22, videos: 40, riskLevel: "Low" },
  { user: "user_9902", email: "growth@startup.ai", creditsToday: 12300, apiCostToday: "$278.00", projects: 30, videos: 65, riskLevel: "Critical" },
  { user: "user_4456", email: "media@globalmart.com", creditsToday: 5670, apiCostToday: "$125.40", projects: 18, videos: 35, riskLevel: "Low" },
];