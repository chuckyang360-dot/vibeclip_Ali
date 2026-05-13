export interface User {
  id: string;
  email: string;
  username: string;
  registeredAt: string;
  lastLogin: string;
  status: "Normal" | "Disabled" | "Risk";
  subscription: "Free" | "Paid" | "Expired" | "Canceled";
  creditBalance: number;
  projects: number;
  assets: number;
  videos: number;
  apiCost7D: string;
}

export const users: User[] = [
  { id: "USR-10001", email: "marketing@bigbrand.com", username: "bigbrand_mkt", registeredAt: "2026-01-15 09:30", lastLogin: "2026-05-09 14:20", status: "Normal", subscription: "Paid", creditBalance: 45000, projects: 156, assets: 890, videos: 312, apiCost7D: "$2,450.80" },
  { id: "USR-10002", email: "admin@shopplus.com", username: "shopplus_admin", registeredAt: "2026-02-03 11:45", lastLogin: "2026-05-09 13:55", status: "Normal", subscription: "Paid", creditBalance: 32100, projects: 128, assets: 720, videos: 256, apiCost7D: "$1,980.50" },
  { id: "USR-10003", email: "creative@trendy.co", username: "trendy_creative", registeredAt: "2026-02-20 08:15", lastLogin: "2026-05-09 12:40", status: "Normal", subscription: "Free", creditBalance: 8500, projects: 45, assets: 280, videos: 98, apiCost7D: "$456.30" },
  { id: "USR-10004", email: "ops@megastore.io", username: "megastore_ops", registeredAt: "2026-03-05 16:22", lastLogin: "2026-05-08 22:10", status: "Normal", subscription: "Paid", creditBalance: 67800, projects: 234, assets: 1450, videos: 520, apiCost7D: "$3,120.00" },
  { id: "USR-10005", email: "content@fashionhub.com", username: "fashionhub", registeredAt: "2026-03-12 10:05", lastLogin: "2026-05-09 09:30", status: "Risk", subscription: "Paid", creditBalance: 1200, projects: 89, assets: 560, videos: 198, apiCost7D: "$890.60" },
  { id: "USR-10006", email: "video@ecommerce.pro", username: "ecommerce_video", registeredAt: "2026-03-18 14:48", lastLogin: "2026-05-07 18:35", status: "Normal", subscription: "Free", creditBalance: 3200, projects: 28, assets: 150, videos: 52, apiCost7D: "$234.80" },
  { id: "USR-10007", email: "growth@startup.ai", username: "startup_growth", registeredAt: "2026-03-25 07:30", lastLogin: "2026-05-09 15:10", status: "Risk", subscription: "Paid", creditBalance: 500, projects: 67, assets: 420, videos: 156, apiCost7D: "$1,560.20" },
  { id: "USR-10008", email: "media@globalmart.com", username: "globalmart", registeredAt: "2026-04-01 13:20", lastLogin: "2026-05-09 11:00", status: "Normal", subscription: "Paid", creditBalance: 89200, projects: 312, assets: 1890, videos: 680, apiCost7D: "$4,230.50" },
  { id: "USR-10009", email: "design@luxestyle.com", username: "luxestyle", registeredAt: "2026-04-08 09:55", lastLogin: "2026-05-08 20:45", status: "Normal", subscription: "Expired", creditBalance: 0, projects: 15, assets: 90, videos: 32, apiCost7D: "$0.00" },
  { id: "USR-10010", email: "manager@quickshop.com", username: "quickshop_mgr", registeredAt: "2026-04-15 11:10", lastLogin: "2026-05-06 16:30", status: "Disabled", subscription: "Canceled", creditBalance: 0, projects: 8, assets: 45, videos: 15, apiCost7D: "$0.00" },
  { id: "USR-10011", email: "brand@urbanwear.com", username: "urbanwear", registeredAt: "2026-04-22 08:40", lastLogin: "2026-05-09 10:15", status: "Normal", subscription: "Free", creditBalance: 5600, projects: 34, assets: 210, videos: 78, apiCost7D: "$345.60" },
  { id: "USR-10012", email: "lead@digitalmart.com", username: "digitalmart_lead", registeredAt: "2026-04-28 15:25", lastLogin: "2026-05-09 08:50", status: "Normal", subscription: "Paid", creditBalance: 12500, projects: 56, assets: 340, videos: 125, apiCost7D: "$780.90" },
];