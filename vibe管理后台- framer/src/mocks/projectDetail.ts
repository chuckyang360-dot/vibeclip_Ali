export interface ProjectStep {
  step: string;
  label: string;
  status: "completed" | "processing" | "error" | "not_started";
  updatedAt: string;
  error?: string;
}

export const projectSteps: ProjectStep[] = [
  { step: "S0", label: "Project Settings", status: "completed", updatedAt: "2026-05-09 08:30" },
  { step: "S1", label: "Product Understanding", status: "completed", updatedAt: "2026-05-09 09:15" },
  { step: "S2", label: "Strategy & Script", status: "completed", updatedAt: "2026-05-09 10:40" },
  { step: "S3", label: "Assets", status: "completed", updatedAt: "2026-05-09 12:00" },
  { step: "S4", label: "Video Generation", status: "processing", updatedAt: "2026-05-09 13:20", error: "Rendering queue pending" },
];

export interface ProjectAsset {
  id: string;
  type: "Character" | "Scene" | "Product" | "Other";
  preview: string;
  status: "Ready" | "Processing" | "Error";
  prompt: string;
  creditsUsed: number;
  createdAt: string;
}

export const projectAssets: ProjectAsset[] = [
  { id: "AST-001", type: "Character", preview: "Summer Model A", status: "Ready", prompt: "A young fashion model in summer outfit, bright lighting, clean background", creditsUsed: 300, createdAt: "2026-05-09 11:00" },
  { id: "AST-002", type: "Character", preview: "Summer Model B", status: "Ready", prompt: "A smiling male model in casual summer wear, outdoor setting", creditsUsed: 300, createdAt: "2026-05-09 11:05" },
  { id: "AST-003", type: "Scene", preview: "Beach Background", status: "Ready", prompt: "Sunny beach with turquoise water, golden sand, palm trees", creditsUsed: 350, createdAt: "2026-05-09 11:20" },
  { id: "AST-004", type: "Scene", preview: "Urban Cafe", status: "Ready", prompt: "Modern urban cafe interior, warm lighting, minimalist design", creditsUsed: 350, createdAt: "2026-05-09 11:25" },
  { id: "AST-005", type: "Product", preview: "Sunglasses Collection", status: "Ready", prompt: "Premium sunglasses product shot, white background, studio lighting", creditsUsed: 250, createdAt: "2026-05-09 11:40" },
  { id: "AST-006", type: "Other", preview: "Logo Animation", status: "Processing", prompt: "Brand logo with subtle animation effect, gold and white color scheme", creditsUsed: 200, createdAt: "2026-05-09 12:00" },
];

export interface ProjectVideo {
  id: string;
  type: "Segment" | "Full Video";
  preview: string;
  status: "Ready" | "Processing" | "Error";
  duration: string;
  creditsUsed: number;
  apiCost: string;
  error: string;
  createdAt: string;
}

export const projectVideos: ProjectVideo[] = [
  { id: "VID-001", type: "Segment", preview: "Scene 1 - Beach Intro", status: "Ready", duration: "0:15", creditsUsed: 500, apiCost: "$0.120", error: "-", createdAt: "2026-05-09 13:00" },
  { id: "VID-002", type: "Segment", preview: "Scene 2 - Product Showcase", status: "Ready", duration: "0:20", creditsUsed: 600, apiCost: "$0.150", error: "-", createdAt: "2026-05-09 13:15" },
  { id: "VID-003", type: "Segment", preview: "Scene 3 - Call to Action", status: "Processing", duration: "0:10", creditsUsed: 400, apiCost: "$0.080", error: "-", createdAt: "2026-05-09 13:30" },
  { id: "VID-004", type: "Full Video", preview: "Summer Sale Promo - Full", status: "Processing", duration: "0:45", creditsUsed: 1500, apiCost: "$0.350", error: "Rendering queue pending", createdAt: "2026-05-09 13:45" },
];

export interface ProjectError {
  time: string;
  step: string;
  errorType: string;
  errorMessage: string;
  relatedApi: string;
  status: "Resolved" | "Pending" | "Critical";
}

export const projectErrors: ProjectError[] = [
  { time: "2026-05-09 13:45", step: "S4", errorType: "Queue Timeout", errorMessage: "Video rendering queue exceeded max wait time of 30 minutes", relatedApi: "video_generate", status: "Pending" },
];

export interface ProjectApiLog {
  id: string;
  provider: string;
  businessType: string;
  model: string;
  status: "Success" | "Failed" | "Timeout" | "Rate Limited";
  cost: string;
  duration: string;
  createdAt: string;
}

export const projectApiLogs: ProjectApiLog[] = [
  { id: "API-001", provider: "xAI", businessType: "product_parse", model: "grok-2", status: "Success", cost: "$0.015", duration: "1.8s", createdAt: "2026-05-09 08:35" },
  { id: "API-002", provider: "Gemini", businessType: "script_generate", model: "gemini-2.0-pro", status: "Success", cost: "$0.032", duration: "3.5s", createdAt: "2026-05-09 09:20" },
  { id: "API-003", provider: "xAI", businessType: "asset_generate", model: "grok-2", status: "Success", cost: "$0.045", duration: "4.2s", createdAt: "2026-05-09 11:00" },
  { id: "API-004", provider: "xAI", businessType: "asset_generate", model: "grok-2", status: "Success", cost: "$0.045", duration: "4.5s", createdAt: "2026-05-09 11:05" },
  { id: "API-005", provider: "Gemini", businessType: "video_generate", model: "gemini-2.0-pro", status: "Success", cost: "$0.120", duration: "12.5s", createdAt: "2026-05-09 13:00" },
  { id: "API-006", provider: "Gemini", businessType: "video_generate", model: "gemini-2.0-pro", status: "Processing", cost: "$0.080", duration: "-", createdAt: "2026-05-09 13:30" },
];

export const projectSettings = {
  contentForm: "Short Video Ad (15-60s)",
  aspectRatio: "9:16 (Vertical)",
  duration: "45 seconds",
  storyStyle: "Engaging narrative with product highlight",
  visualStyle: "Bright, vibrant, summer-themed with natural lighting",
};