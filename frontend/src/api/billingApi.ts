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
  status: 'pending' | 'paid' | 'failed' | 'cancelled' | string;
  plan_code: string;
  period: string;
  amount: number;
  paid_at: string | null;
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

export async function getBillingOrder(orderId: number): Promise<BillingOrderResponse> {
  const response = await fetch(`${API_BASE_URL}/api/billing/orders/${orderId}`, {
    method: 'GET',
    headers: {
      Authorization: authHeaders().Authorization,
    },
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || '获取订单状态失败');
  }
  return response.json();
}
