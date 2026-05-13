export interface CreditAccount {
  user: string;
  email: string;
  currentBalance: number;
  totalGranted: number;
  totalConsumed: number;
  totalRefunded: number;
  updatedAt: string;
}

export const creditAccounts: CreditAccount[] = [
  { user: "user_8842", email: "marketing@bigbrand.com", currentBalance: 45000, totalGranted: 125000, totalConsumed: 78900, totalRefunded: 1900, updatedAt: "2026-05-09 14:20" },
  { user: "user_1034", email: "admin@shopplus.com", currentBalance: 32100, totalGranted: 98000, totalConsumed: 64500, totalRefunded: 1400, updatedAt: "2026-05-09 13:55" },
  { user: "user_5567", email: "creative@trendy.co", currentBalance: 8500, totalGranted: 35000, totalConsumed: 25800, totalRefunded: 700, updatedAt: "2026-05-09 12:40" },
  { user: "user_2201", email: "ops@megastore.io", currentBalance: 67800, totalGranted: 180000, totalConsumed: 111000, totalRefunded: 2200, updatedAt: "2026-05-09 12:30" },
  { user: "user_7789", email: "content@fashionhub.com", currentBalance: 1200, totalGranted: 50000, totalConsumed: 48200, totalRefunded: 600, updatedAt: "2026-05-09 11:50" },
  { user: "user_3341", email: "video@ecommerce.pro", currentBalance: 3200, totalGranted: 22000, totalConsumed: 18400, totalRefunded: 400, updatedAt: "2026-05-09 10:25" },
  { user: "user_9902", email: "growth@startup.ai", currentBalance: 500, totalGranted: 80000, totalConsumed: 78900, totalRefunded: 1400, updatedAt: "2026-05-09 10:15" },
  { user: "user_4456", email: "media@globalmart.com", currentBalance: 89200, totalGranted: 250000, totalConsumed: 158000, totalRefunded: 2800, updatedAt: "2026-05-09 09:40" },
];

export interface CreditTransactionAll {
  id: string;
  user: string;
  email: string;
  type: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  relatedObject: string;
  operator: string;
  note: string;
  createdAt: string;
}

export const creditTransactionsAll: CreditTransactionAll[] = [
  { id: "TXN-00588", user: "user_8842", email: "marketing@bigbrand.com", type: "asset_generation_consume", amount: -1500, balanceBefore: 46500, balanceAfter: 45000, relatedObject: "PRJ-2026001", operator: "system", note: "Asset generation", createdAt: "2026-05-09 14:20" },
  { id: "TXN-00587", user: "user_1034", email: "admin@shopplus.com", type: "video_generation_consume", amount: -800, balanceBefore: 32900, balanceAfter: 32100, relatedObject: "PRJ-2026002", operator: "system", note: "Video generation", createdAt: "2026-05-09 13:50" },
  { id: "TXN-00586", user: "user_5567", email: "creative@trendy.co", type: "admin_deduct", amount: -5000, balanceBefore: 13500, balanceAfter: 8500, relatedObject: "-", operator: "admin_001", note: "Manual audit adjustment", createdAt: "2026-05-09 12:30" },
  { id: "TXN-00585", user: "user_2201", email: "ops@megastore.io", type: "subscription_grant", amount: 50000, balanceBefore: 17800, balanceAfter: 67800, relatedObject: "SUB-2045", operator: "system", note: "Enterprise plan monthly grant", createdAt: "2026-05-09 00:00" },
  { id: "TXN-00584", user: "user_7789", email: "content@fashionhub.com", type: "refund", amount: 600, balanceBefore: 600, balanceAfter: 1200, relatedObject: "PRJ-2026032", operator: "system", note: "Refund for failed video generation", createdAt: "2026-05-09 11:00" },
  { id: "TXN-00583", user: "user_9902", email: "growth@startup.ai", type: "admin_grant", amount: 10000, balanceBefore: 0, balanceAfter: 10000, relatedObject: "-", operator: "admin_002", note: "Recovery grant after payment issue", createdAt: "2026-05-09 10:00" },
  { id: "TXN-00582", user: "user_4456", email: "media@globalmart.com", type: "adjustment", amount: 2000, balanceBefore: 87200, balanceAfter: 89200, relatedObject: "-", operator: "admin_001", note: "Credit correction for billing error", createdAt: "2026-05-09 09:30" },
  { id: "TXN-00581", user: "user_3341", email: "video@ecommerce.pro", type: "video_generation_consume", amount: -400, balanceBefore: 3600, balanceAfter: 3200, relatedObject: "PRJ-2026006", operator: "system", note: "Video segment generation", createdAt: "2026-05-09 10:25" },
  { id: "TXN-00580", user: "user_8842", email: "marketing@bigbrand.com", type: "admin_grant", amount: 50000, balanceBefore: 0, balanceAfter: 50000, relatedObject: "-", operator: "admin_001", note: "Initial paid subscription grant", createdAt: "2026-05-08 08:00" },
  { id: "TXN-00579", user: "user_1034", email: "admin@shopplus.com", type: "asset_generation_consume", amount: -1200, balanceBefore: 34100, balanceAfter: 32900, relatedObject: "PRJ-2026002", operator: "system", note: "Asset generation", createdAt: "2026-05-09 13:00" },
];

export const creditStats = {
  totalGranted: 865000,
  totalConsumed: 542800,
  totalRefunded: 12400,
  currentBalanceTotal: 340200,
  adminAdjustmentsToday: 3,
  creditsConsumedToday: 89234,
};