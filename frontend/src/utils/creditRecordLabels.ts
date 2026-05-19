/** 积分流水展示文案（账单中心等），与后端 note 格式兼容。 */

const SUBSCRIPTION_NOTE_RE = /^Subscription\s+(\w+)\s+(\w+)\s+\(order\s+([^)]+)\)\s*$/i;

export type SubscriptionGrantParts = {
  plan: string;
  period: string;
  outTradeNo: string;
};

export function parseSubscriptionGrantNote(note: string | null | undefined): SubscriptionGrantParts | null {
  if (!note?.trim()) return null;
  const m = note.trim().match(SUBSCRIPTION_NOTE_RE);
  if (!m) return null;
  return { plan: m[1].toLowerCase(), period: m[2].toLowerCase(), outTradeNo: m[3].trim() };
}

export function planCodeToZh(plan: string): string {
  if (plan === 'basic') return '基础会员';
  if (plan === 'standard') return '标准会员';
  if (plan === 'pro') return '高级会员';
  return plan;
}

export function billingPeriodToZh(period: string): string {
  if (period === 'monthly') return '月度订阅';
  if (period === 'yearly') return '年度订阅';
  return period;
}

/** 例：基础会员月度订阅积分发放 */
export function subscriptionGrantTitle(plan: string, period: string): string {
  return `${planCodeToZh(plan)}${billingPeriodToZh(period)}积分发放`;
}

const CONSUME_TYPE_ZH: Record<string, string> = {
  free_monthly_grant: '免费版每月积分',
  text_understanding_consume: '文本/链接理解',
  image_understanding_consume: '图片理解',
  script_generation_consume: '脚本生成与解析',
  image_asset_generation_consume: '图片资产生成',
  segment_video_generation_consume: '视频片段生成',
  hd_export_consume: '高清导出',
  refund: '积分退回',
  subscription_grant: '订阅积分发放',
  admin_grant: '管理员发放',
  admin_deduct: '管理员扣减',
};

export function creditTransactionTypeLabel(transactionType: string): string {
  return CONSUME_TYPE_ZH[transactionType] || transactionType;
}
