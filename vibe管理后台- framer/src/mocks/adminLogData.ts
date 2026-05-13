export interface AdminLog {
  id: string;
  operator: string;
  action: string;
  targetType: string;
  targetId: string;
  before: string;
  after: string;
  reason: string;
  ip: string;
  createdAt: string;
}

export const adminLogs: AdminLog[] = [
  { id: "LOG-001", operator: "admin_001", action: "grant_credits", targetType: "User", targetId: "user_8842", before: "Balance: 0", after: "Balance: 50000", reason: "Initial paid subscription grant", ip: "192.168.1.10", createdAt: "2026-05-09 08:00:15" },
  { id: "LOG-002", operator: "admin_002", action: "update_user_note", targetType: "User", targetId: "user_8842", before: "Note: -", after: "Note: High priority customer", reason: "Enterprise account onboarding", ip: "192.168.1.11", createdAt: "2026-05-09 09:30:22" },
  { id: "LOG-003", operator: "admin_001", action: "deduct_credits", targetType: "User", targetId: "user_5567", before: "Balance: 13500", after: "Balance: 8500", reason: "Manual audit adjustment for suspicious activity", ip: "192.168.1.10", createdAt: "2026-05-09 12:30:45" },
  { id: "LOG-004", operator: "admin_001", action: "mark_asset_abnormal", targetType: "Asset", targetId: "AST-005", before: "Status: Ready", after: "Status: Flagged", reason: "Policy violation in generated asset", ip: "192.168.1.10", createdAt: "2026-05-09 13:15:08" },
  { id: "LOG-005", operator: "admin_003", action: "disable_user", targetType: "User", targetId: "user_10010", before: "Status: Normal", after: "Status: Disabled", reason: "Violation of terms of service", ip: "192.168.1.15", createdAt: "2026-05-09 14:00:33" },
  { id: "LOG-006", operator: "admin_002", action: "restore_user", targetType: "User", targetId: "user_10010", before: "Status: Disabled", after: "Status: Normal", reason: "Appeal approved after review", ip: "192.168.1.11", createdAt: "2026-05-09 15:20:10" },
  { id: "LOG-007", operator: "admin_001", action: "grant_credits", targetType: "User", targetId: "user_9902", before: "Balance: 0", after: "Balance: 10000", reason: "Recovery grant after payment issue", ip: "192.168.1.10", createdAt: "2026-05-09 10:00:00" },
  { id: "LOG-008", operator: "admin_001", action: "adjustment", targetType: "User", targetId: "user_4456", before: "Balance: 87200", after: "Balance: 89200", reason: "Credit correction for billing error", ip: "192.168.1.10", createdAt: "2026-05-09 09:30:00" },
  { id: "LOG-009", operator: "admin_002", action: "mark_video_abnormal", targetType: "Video", targetId: "VID-002", before: "Status: Ready", after: "Status: Flagged", reason: "Inappropriate content detected", ip: "192.168.1.11", createdAt: "2026-05-09 16:45:18" },
  { id: "LOG-010", operator: "admin_003", action: "update_user_note", targetType: "User", targetId: "user_7789", before: "Note: -", after: "Note: Monitor for high consumption", reason: "High risk usage pattern detected", ip: "192.168.1.15", createdAt: "2026-05-09 11:10:05" },
];