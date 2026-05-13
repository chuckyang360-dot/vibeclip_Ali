export interface ApiLog {
  id: string;
  provider: string;
  model: string;
  businessType: string;
  user: string;
  project: string;
  status: "Success" | "Failed" | "Timeout" | "Rate Limited";
  httpStatus: number;
  duration: string;
  estimatedCost: string;
  errorMessage: string;
  createdAt: string;
}

export const apiLogs: ApiLog[] = [
  { id: "API-20260509-001", provider: "xAI", model: "grok-2", businessType: "script_generate", user: "user_8842", project: "Summer Sale Promo", status: "Success", httpStatus: 200, duration: "2.3s", estimatedCost: "$0.045", errorMessage: "-", createdAt: "2026-05-09 14:30:22" },
  { id: "API-20260509-002", provider: "Gemini", model: "gemini-2.0-flash", businessType: "asset_generate", user: "user_1034", project: "New Collection Ad", status: "Success", httpStatus: 200, duration: "5.8s", estimatedCost: "$0.032", errorMessage: "-", createdAt: "2026-05-09 14:28:15" },
  { id: "API-20260509-003", provider: "xAI", model: "grok-2", businessType: "product_parse", user: "user_5567", project: "Holiday Campaign", status: "Failed", httpStatus: 429, duration: "0.5s", estimatedCost: "$0.002", errorMessage: "Rate limit exceeded: 1000 req/min", createdAt: "2026-05-09 14:25:08" },
  { id: "API-20260509-004", provider: "Cloudflare R2", model: "-", businessType: "r2_upload", user: "user_2201", project: "Flash Deal Video", status: "Success", httpStatus: 200, duration: "1.2s", estimatedCost: "$0.008", errorMessage: "-", createdAt: "2026-05-09 14:22:40" },
  { id: "API-20260509-005", provider: "Gemini", model: "gemini-2.0-pro", businessType: "video_generate", user: "user_7789", project: "Brand Story", status: "Timeout", httpStatus: 504, duration: "30.0s", estimatedCost: "$0.120", errorMessage: "Gateway timeout after 30s", createdAt: "2026-05-09 14:20:12" },
  { id: "API-20260509-006", provider: "xAI", model: "grok-2", businessType: "video_status_polling", user: "user_3341", project: "Product Review", status: "Success", httpStatus: 200, duration: "0.8s", estimatedCost: "$0.005", errorMessage: "-", createdAt: "2026-05-09 14:18:35" },
  { id: "API-20260509-007", provider: "Gemini", model: "gemini-2.0-flash", businessType: "script_generate", user: "user_9902", project: "Tutorial Series", status: "Success", httpStatus: 200, duration: "3.5s", estimatedCost: "$0.028", errorMessage: "-", createdAt: "2026-05-09 14:15:50" },
  { id: "API-20260509-008", provider: "xAI", model: "grok-2", businessType: "asset_generate", user: "user_4456", project: "Seasonal Banner", status: "Rate Limited", httpStatus: 429, duration: "0.3s", estimatedCost: "$0.001", errorMessage: "Rate limit: burst quota exceeded", createdAt: "2026-05-09 14:12:18" },
  { id: "API-20260509-009", provider: "Cloudflare R2", model: "-", businessType: "r2_upload", user: "user_8842", project: "Weekend Special", status: "Success", httpStatus: 200, duration: "0.9s", estimatedCost: "$0.006", errorMessage: "-", createdAt: "2026-05-09 14:10:05" },
  { id: "API-20260509-010", provider: "Gemini", model: "gemini-2.0-pro", businessType: "product_parse", user: "user_1034", project: "Influencer Collab", status: "Success", httpStatus: 200, duration: "1.8s", estimatedCost: "$0.015", errorMessage: "-", createdAt: "2026-05-09 14:08:22" },
  { id: "API-20260509-011", provider: "xAI", model: "grok-2", businessType: "script_generate", user: "user_5567", project: "Black Friday Prep", status: "Failed", httpStatus: 500, duration: "2.1s", estimatedCost: "$0.018", errorMessage: "Internal server error: model unavailable", createdAt: "2026-05-09 14:05:40" },
  { id: "API-20260509-012", provider: "Gemini", model: "gemini-2.0-flash", businessType: "video_generate", user: "user_2201", project: "Launch Teaser", status: "Success", httpStatus: 200, duration: "8.5s", estimatedCost: "$0.065", errorMessage: "-", createdAt: "2026-05-09 14:02:15" },
];