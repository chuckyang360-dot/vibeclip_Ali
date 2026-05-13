export interface Project {
  id: string;
  name: string;
  user: string;
  currentStep: "S0" | "S1" | "S2" | "S3" | "S4";
  status: "Draft" | "Processing" | "Completed" | "Error";
  assets: number;
  videos: number;
  creditsUsed: number;
  apiCalls: number;
  lastError: string;
  createdAt: string;
  updatedAt: string;
}

export const projects: Project[] = [
  { id: "PRJ-2026001", name: "Summer Sale Promo", user: "user_8842", currentStep: "S4", status: "Completed", assets: 12, videos: 3, creditsUsed: 4500, apiCalls: 156, lastError: "-", createdAt: "2026-05-09 08:30", updatedAt: "2026-05-09 14:20" },
  { id: "PRJ-2026002", name: "New Collection Ad", user: "user_1034", currentStep: "S3", status: "Processing", assets: 8, videos: 1, creditsUsed: 2800, apiCalls: 98, lastError: "-", createdAt: "2026-05-09 07:15", updatedAt: "2026-05-09 13:45" },
  { id: "PRJ-2026003", name: "Holiday Campaign", user: "user_5567", currentStep: "S1", status: "Error", assets: 2, videos: 0, creditsUsed: 600, apiCalls: 25, lastError: "Script generation failed: content policy violation", createdAt: "2026-05-09 06:40", updatedAt: "2026-05-09 06:42" },
  { id: "PRJ-2026004", name: "Flash Deal Video", user: "user_2201", currentStep: "S4", status: "Completed", assets: 15, videos: 5, creditsUsed: 6200, apiCalls: 210, lastError: "-", createdAt: "2026-05-09 05:20", updatedAt: "2026-05-09 12:30" },
  { id: "PRJ-2026005", name: "Brand Story", user: "user_7789", currentStep: "S2", status: "Processing", assets: 5, videos: 0, creditsUsed: 1800, apiCalls: 65, lastError: "-", createdAt: "2026-05-09 04:10", updatedAt: "2026-05-09 11:50" },
  { id: "PRJ-2026006", name: "Product Review", user: "user_3341", currentStep: "S4", status: "Completed", assets: 10, videos: 2, creditsUsed: 3800, apiCalls: 134, lastError: "-", createdAt: "2026-05-09 03:45", updatedAt: "2026-05-09 10:25" },
  { id: "PRJ-2026007", name: "Tutorial Series", user: "user_9902", currentStep: "S3", status: "Error", assets: 6, videos: 0, creditsUsed: 2200, apiCalls: 78, lastError: "Asset generation timeout after 300s", createdAt: "2026-05-09 02:30", updatedAt: "2026-05-09 02:33" },
  { id: "PRJ-2026008", name: "Seasonal Banner", user: "user_4456", currentStep: "S0", status: "Draft", assets: 0, videos: 0, creditsUsed: 0, apiCalls: 0, lastError: "-", createdAt: "2026-05-09 01:15", updatedAt: "2026-05-09 01:15" },
  { id: "PRJ-2026009", name: "Weekend Special", user: "user_8842", currentStep: "S4", status: "Completed", assets: 9, videos: 2, creditsUsed: 3200, apiCalls: 112, lastError: "-", createdAt: "2026-05-08 22:00", updatedAt: "2026-05-09 09:40" },
  { id: "PRJ-2026010", name: "Influencer Collab", user: "user_1034", currentStep: "S2", status: "Processing", assets: 4, videos: 0, creditsUsed: 1500, apiCalls: 52, lastError: "-", createdAt: "2026-05-08 20:30", updatedAt: "2026-05-09 08:55" },
  { id: "PRJ-2026011", name: "Black Friday Prep", user: "user_5567", currentStep: "S1", status: "Draft", assets: 0, videos: 0, creditsUsed: 0, apiCalls: 0, lastError: "-", createdAt: "2026-05-08 19:00", updatedAt: "2026-05-08 19:00" },
  { id: "PRJ-2026012", name: "Launch Teaser", user: "user_2201", currentStep: "S4", status: "Completed", assets: 7, videos: 1, creditsUsed: 2600, apiCalls: 89, lastError: "-", createdAt: "2026-05-08 17:45", updatedAt: "2026-05-08 23:10" },
];