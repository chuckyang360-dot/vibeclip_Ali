import type { AdminLocale } from '../i18n/adminI18n';

export type SubscriptionOrderRef = {
  plan_code?: string | null;
  period?: string | null;
  out_trade_no?: string | null;
  payment_provider?: string | null;
};

const PLAN_ZH: Record<string, string> = {
  basic: '基础会员',
  standard: '标准会员',
  pro: '高级会员',
};

const PERIOD_ZH: Record<string, string> = {
  monthly: '月度',
  yearly: '年度',
};

const PLAN_EN: Record<string, string> = {
  basic: 'Basic',
  standard: 'Standard',
  pro: 'Pro',
};

const PERIOD_EN: Record<string, string> = {
  monthly: 'monthly',
  yearly: 'yearly',
};

const SUBSCRIPTION_NOTE_RE = /^Subscription\s+(\w+)\s+(\w+)\s+\(order\s+([^)]+)\)\s*$/i;

function parseSubscriptionEnglishNote(note: string): { plan: string; period: string; out_trade_no: string } | null {
  const m = note.trim().match(SUBSCRIPTION_NOTE_RE);
  if (!m) return null;
  return { plan: m[1], period: m[2], out_trade_no: m[3].trim() };
}

function buildFromParts(
  locale: AdminLocale,
  planCode: string,
  period: string,
  outTradeNo: string | null | undefined,
): string {
  if (locale === 'zh') {
    const p = PLAN_ZH[planCode] ?? planCode;
    const per = PERIOD_ZH[period] ?? period;
    const orderPart = outTradeNo ? `（订单号：${outTradeNo}）` : '';
    return `${p}${per}订阅积分发放${orderPart}`;
  }
  const p = PLAN_EN[planCode] ?? planCode;
  const per = PERIOD_EN[period] ?? period;
  const orderPart = outTradeNo ? ` (Order: ${outTradeNo})` : '';
  return `${p} ${per} subscription credits${orderPart}`;
}

/**
 * 积分流水「原因」列：订阅发放用中文业务文案，其它类型保留 note。
 */
export function formatCreditTransactionReasonDisplay(
  locale: AdminLocale,
  row: {
    type?: string | null;
    note?: string | null;
    subscription_order?: SubscriptionOrderRef | Record<string, unknown> | null;
  },
): string {
  const typ = String(row.type || '');
  const note = row.note != null ? String(row.note) : '';

  if (typ === 'subscription_grant') {
    const rawSo = row.subscription_order;
    const so =
      rawSo && typeof rawSo === 'object'
        ? {
            plan_code: (rawSo as SubscriptionOrderRef).plan_code,
            period: (rawSo as SubscriptionOrderRef).period,
            out_trade_no: (rawSo as SubscriptionOrderRef).out_trade_no,
          }
        : null;
    if (so?.plan_code && so?.period) {
      return buildFromParts(locale, String(so.plan_code), String(so.period), so.out_trade_no);
    }
    const parsed = parseSubscriptionEnglishNote(note);
    if (parsed) {
      return buildFromParts(locale, parsed.plan, parsed.period, parsed.out_trade_no);
    }
  }

  return note.trim() || '—';
}
