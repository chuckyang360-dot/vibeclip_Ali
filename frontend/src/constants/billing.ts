export type PlanKey = 'free' | 'basic' | 'standard' | 'pro';
export type BillingPeriod = 'monthly' | 'yearly';

export const SUBSCRIPTION_PLANS: Record<
  Exclude<PlanKey, 'free'>,
  {
    key: Exclude<PlanKey, 'free'>;
    name: string;
    monthlyPrice: number;
    creditsPerMonth: number;
    queueLabel: string;
    hdExport: string;
    watermark: string;
    summaryLines: string[];
  }
> = {
  basic: {
    key: 'basic',
    name: '基础会员',
    // TEMP: basic monthly price set to 1 CNY for Alipay production payment testing. Restore to 79 after verification.
    monthlyPrice: 1,
    creditsPerMonth: 1000,
    queueLabel: '普通生成队列',
    hdExport: '标准高清导出',
    watermark: '去除导出水印',
    summaryLines: ['每月 1000 积分', '最多 30 个项目', '完整内容理解 / 脚本 / 资产生成'],
  },
  standard: {
    key: 'standard',
    name: '标准会员',
    monthlyPrice: 209,
    creditsPerMonth: 3000,
    queueLabel: '较高优先生成队列',
    hdExport: '高清导出',
    watermark: '去除导出水印',
    summaryLines: ['每月 3000 积分', '最多 150 个项目', '分镜解析与全部核心模板'],
  },
  pro: {
    key: 'pro',
    name: '高级会员',
    monthlyPrice: 529,
    creditsPerMonth: 8000,
    queueLabel: '最高优先生成队列',
    hdExport: '高清导出',
    watermark: '去除导出水印',
    summaryLines: ['每月 8000 积分', '高额度或不限项目', '批量生成与最大资产库'],
  },
};

export type CreditPackId = 'p19' | 'p49' | 'p99' | 'p199';

export const CREDIT_PACKS: { id: CreditPackId; price: number; points: number }[] = [
  { id: 'p19', price: 19, points: 200 },
  { id: 'p49', price: 49, points: 600 },
  { id: 'p99', price: 99, points: 1500 },
  { id: 'p199', price: 199, points: 3500 },
];

/** 年付应付金额与 backend/app/routes/billing.py PLAN_PRICE yearly 一致（以后端为准）。 */
const BACKEND_YEARLY_PAYABLE_BY_MONTHLY: Record<number, number> = {
  // TEMP: keyed by current monthly display price for basic (1 during Alipay test); yearly basic still ¥758 on backend.
  1: 758,
  209: 2006,
  529: 5078,
};

export function yearlyTotals(monthlyPrice: number) {
  const fullYear = monthlyPrice * 12;
  const payable =
    BACKEND_YEARLY_PAYABLE_BY_MONTHLY[monthlyPrice] ??
    Math.round(fullYear * 0.8 * 100) / 100;
  const saved = Math.round((fullYear - payable) * 100) / 100;
  return { subtotal: fullYear, payable, saved };
}
