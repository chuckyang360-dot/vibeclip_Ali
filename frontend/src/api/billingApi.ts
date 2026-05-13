import { API_BASE_URL } from '../config/api';
import { getToken } from '../services/api';

type BillingPeriod = 'monthly' | 'yearly';
type PlanCode = 'basic' | 'standard' | 'pro';

export type CreateAlipayOrderResponse = {
  order_id: number;
  out_trade_no: string;
  pay_url?: string | null;
  payment_form_html?: string | null;
  status: 'pending' | 'paid' | 'failed' | 'cancelled' | string;
};

export type BillingOrderResponse = {
  order_id: number;
  out_trade_no: string;
  status: string;
  plan_code: string;
  period: string;
  amount: string | number;
  paid_at: string | null;
  created_at?: string | null;
};

export type CurrentSubscriptionDto = {
  plan: string;
  status: string;
  billing_period: string | null;
  renews_at: string | null;
  monthly_credits: number | null;
};

export type CreditRecordDto = {
  id: number;
  transaction_type: string;
  amount: number;
  balance_after: number;
  note: string | null;
  created_at: string | null;
  related_object_type?: string | null;
  related_object_id?: string | null;
  plan_code?: string | null;
  period?: string | null;
  out_trade_no?: string | null;
};

export type PaymentOrderListItemDto = {
  order_id: number;
  out_trade_no: string;
  status: string;
  plan_code: string;
  period: string;
  amount: string;
  paid_at: string | null;
  created_at: string | null;
};

export type BillingMeResponse = {
  current_subscription: CurrentSubscriptionDto;
  current_credits_balance: number;
  credit_records: CreditRecordDto[];
  payment_orders: PaymentOrderListItemDto[];
};

function authHeaders() {
  const token = getToken();
  if (!token) {
    throw new Error('请先登录后再发起支付');
  }
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

function bearerOnly() {
  const token = getToken();
  if (!token) {
    throw new Error('请先登录');
  }
  return { Authorization: `Bearer ${token}` };
}

export async function createAlipayOrder(plan_code: PlanCode, period: BillingPeriod): Promise<CreateAlipayOrderResponse> {
  const response = await fetch(`${API_BASE_URL}/api/billing/alipay/create-order`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ plan_code, period }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || '创建支付订单失败');
  }
  return response.json();
}

/** Numeric order id or merchant out_trade_no (e.g. VC…). */
export async function getBillingOrder(orderRef: string | number): Promise<BillingOrderResponse> {
  const ref = encodeURIComponent(typeof orderRef === 'number' ? String(orderRef) : orderRef);
  const response = await fetch(`${API_BASE_URL}/api/billing/orders/${ref}`, {
    method: 'GET',
    headers: bearerOnly(),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || '获取订单状态失败');
  }
  return response.json();
}

export async function fetchBillingMe(): Promise<BillingMeResponse> {
  const response = await fetch(`${API_BASE_URL}/api/billing/me`, {
    method: 'GET',
    headers: bearerOnly(),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || '加载账单数据失败');
  }
  return response.json();
}
