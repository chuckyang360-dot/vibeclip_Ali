export interface UserProject {
  id: string;
  name: string;
  currentStep: "S0" | "S1" | "S2" | "S3" | "S4";
  status: "Draft" | "Processing" | "Completed" | "Error";
  assets: number;
  videos: number;
  creditsUsed: number;
  updatedAt: string;
}

export const userProjects: UserProject[] = [
  { id: "PRJ-2026001", name: "Summer Sale Promo", currentStep: "S4", status: "Completed", assets: 12, videos: 3, creditsUsed: 4500, updatedAt: "2026-05-09 14:20" },
  { id: "PRJ-2026009", name: "Weekend Special", currentStep: "S4", status: "Completed", assets: 9, videos: 2, creditsUsed: 3200, updatedAt: "2026-05-09 09:40" },
  { id: "PRJ-2026050", name: "Flash Deal Bundle", currentStep: "S3", status: "Processing", assets: 7, videos: 1, creditsUsed: 2100, updatedAt: "2026-05-09 08:15" },
  { id: "PRJ-2026032", name: "Holiday Countdown", currentStep: "S2", status: "Error", assets: 3, videos: 0, creditsUsed: 800, updatedAt: "2026-05-08 22:30" },
  { id: "PRJ-2026018", name: "New Arrivals Ad", currentStep: "S4", status: "Completed", assets: 8, videos: 2, creditsUsed: 2800, updatedAt: "2026-05-08 16:45" },
  { id: "PRJ-2026025", name: "Brand Refresh", currentStep: "S1", status: "Draft", assets: 0, videos: 0, creditsUsed: 0, updatedAt: "2026-05-08 12:00" },
  { id: "PRJ-2026040", name: "End of Season", currentStep: "S3", status: "Processing", assets: 5, videos: 0, creditsUsed: 1500, updatedAt: "2026-05-08 10:20" },
  { id: "PRJ-2026055", name: "Mega Sale Video", currentStep: "S4", status: "Completed", assets: 14, videos: 4, creditsUsed: 5200, updatedAt: "2026-05-07 18:30" },
];

export interface CreditTransaction {
  id: string;
  type: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  relatedObject: string;
  operator: string;
  note: string;
  createdAt: string;
}

export const userCreditTransactions: CreditTransaction[] = [
  { id: "TXN-00588", type: "asset_generation_consume", amount: -1500, balanceBefore: 46500, balanceAfter: 45000, relatedObject: "PRJ-2026001", operator: "system", note: "Asset generation for Summer Sale Promo", createdAt: "2026-05-09 14:20" },
  { id: "TXN-00587", type: "video_generation_consume", amount: -800, balanceBefore: 47300, balanceAfter: 46500, relatedObject: "PRJ-2026001", operator: "system", note: "Video generation for Summer Sale Promo", createdAt: "2026-05-09 13:50" },
  { id: "TXN-00586", type: "asset_generation_consume", amount: -1200, balanceBefore: 48500, balanceAfter: 47300, relatedObject: "PRJ-2026009", operator: "system", note: "Asset generation for Weekend Special", createdAt: "2026-05-09 09:15" },
  { id: "TXN-00580", type: "admin_grant", amount: 50000, balanceBefore: 0, balanceAfter: 50000, relatedObject: "-", operator: "admin_001", note: "Initial credit grant for paid subscription", createdAt: "2026-05-08 08:00" },
  { id: "TXN-00550", type: "subscription_grant", amount: 5000, balanceBefore: 0, balanceAfter: 5000, relatedObject: "SUB-1001", operator: "system", note: "Monthly subscription bonus", createdAt: "2026-05-01 00:00" },
];

export interface UserApiUsage {
  id: string;
  provider: string;
  businessType: string;
  model: string;
  status: "Success" | "Failed" | "Timeout" | "Rate Limited";
  cost: string;
  duration: string;
  createdAt: string;
}

export const userApiUsages: UserApiUsage[] = [
  { id: "API-001", provider: "xAI", businessType: "script_generate", model: "grok-2", status: "Success", cost: "$0.045", duration: "2.3s", createdAt: "2026-05-09 14:32:10" },
  { id: "API-002", provider: "Gemini", businessType: "asset_generate", model: "gemini-2.0-flash", status: "Success", cost: "$0.032", duration: "5.8s", createdAt: "2026-05-09 14:28:15" },
  { id: "API-003", provider: "xAI", businessType: "video_status_polling", model: "grok-2", status: "Success", cost: "$0.005", duration: "0.8s", createdAt: "2026-05-09 14:18:35" },
  { id: "API-004", provider: "Gemini", businessType: "video_generate", model: "gemini-2.0-pro", status: "Failed", cost: "$0.001", duration: "30.0s", createdAt: "2026-05-09 14:20:12" },
  { id: "API-005", provider: "Cloudflare R2", businessType: "r2_upload", model: "-", status: "Success", cost: "$0.008", duration: "1.2s", createdAt: "2026-05-09 14:22:40" },
  { id: "API-006", provider: "xAI", businessType: "product_parse", model: "grok-2", status: "Rate Limited", cost: "$0.002", duration: "0.5s", createdAt: "2026-05-09 14:25:08" },
];

export interface AdminNote {
  operator: string;
  action: string;
  before: string;
  after: string;
  reason: string;
  createdAt: string;
}

export const userAdminNotes: AdminNote[] = [
  { operator: "admin_001", action: "grant_credits", before: "Balance: 0", after: "Balance: 50000", reason: "Paid subscription initial grant", createdAt: "2026-05-08 08:00" },
  { operator: "admin_002", action: "update_user_note", before: "Note: -", after: "Note: High priority customer", reason: "Enterprise account onboarding", createdAt: "2026-05-08 09:30" },
];