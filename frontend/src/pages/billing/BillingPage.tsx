import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchBillingMe } from '../../api/billingApi';
import type { BillingMeResponse, CreditRecordDto, PaymentOrderListItemDto } from '../../api/billingApi';
import { SUBSCRIPTION_PLANS } from '../../constants/billing';
import { getToken } from '../../services/api';
import {
  parseSubscriptionGrantNote,
  subscriptionGrantTitle,
  type SubscriptionGrantParts,
} from '../../utils/creditRecordLabels';
import { ShortDramaLayout } from '../short-drama/components/ShortDramaLayout';

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '--';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--';
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function planDisplayName(plan: string): string {
  if (plan === 'free') return '免费版';
  const p = SUBSCRIPTION_PLANS[plan as keyof typeof SUBSCRIPTION_PLANS];
  return p?.name ?? plan;
}

function subscriptionStatusLabel(status: string): string {
  if (status === 'active') return '有效';
  if (status === 'not_subscribed') return '未订阅';
  if (status === 'inactive') return '未订阅';
  return status;
}

function orderStatusLabel(s: string): string {
  if (s === 'paid') return '已支付';
  if (s === 'pending') return '待支付';
  if (s === 'failed') return '失败';
  if (s === 'closed') return '已关闭';
  return s;
}

function paymentMethodLabel(provider: string | undefined): string {
  if (provider === 'wechat') return '微信支付';
  return '支付宝';
}

function providerTxnDisplay(o: PaymentOrderListItemDto): string {
  if (o.payment_provider === 'wechat') return o.wechat_transaction_id?.trim() || '—';
  return o.alipay_trade_no?.trim() || '—';
}

function creditTxnLabel(t: CreditRecordDto): string {
  if (t.transaction_type === 'subscription_grant') return '订阅积分发放';
  if (t.transaction_type === 'admin_grant') return '管理员发放';
  if (t.transaction_type === 'admin_deduct') return '管理员扣减';
  return t.transaction_type;
}

function resolveSubscriptionGrantParts(row: CreditRecordDto): SubscriptionGrantParts | null {
  if (row.transaction_type !== 'subscription_grant') return null;
  if (row.plan_code && row.period && row.out_trade_no) {
    return { plan: row.plan_code, period: row.period, outTradeNo: row.out_trade_no };
  }
  return parseSubscriptionGrantNote(row.note);
}

function creditRecordPrimaryLine(row: CreditRecordDto): string {
  const sub = resolveSubscriptionGrantParts(row);
  if (sub) return subscriptionGrantTitle(sub.plan, sub.period);
  return creditTxnLabel(row);
}

function creditRecordSecondaryLine(row: CreditRecordDto): string | null {
  const sub = resolveSubscriptionGrantParts(row);
  if (sub) return `订单号：${sub.outTradeNo}`;
  if (row.note) return row.note;
  return null;
}

export function BillingPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<BillingMeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!getToken()) {
      navigate('/login', { replace: true, state: { from: '/billing' } });
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const me = await fetchBillingMe();
      setData(me);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    void load();
  }, [load]);

  const sub = data?.current_subscription;
  const planKey = sub?.plan === 'free' ? 'free' : sub?.plan;
  const isPaid = sub && sub.plan !== 'free' && sub.status === 'active';
  const subtitle =
    planKey === 'free' || !isPaid
      ? '每月 100 积分 · 基础视频生成（免费版额度）'
      : `每月 ${sub?.monthly_credits?.toLocaleString() ?? '--'} 积分 · ${planDisplayName(sub.plan)}`;

  return (
    <ShortDramaLayout headerMode="landing">
      <div className="min-h-screen bg-[#F7F8FA] px-6 py-10">
        <div className="mx-auto max-w-[960px]">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-[26px] font-black text-[#1D1D1F]">账单中心</h1>
              <p className="mt-1 text-[13.5px] text-[#8E8E93]">查看订阅状态、积分记录与支付记录</p>
            </div>
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-xl border border-[#EAEAEA] bg-white px-4 py-2 text-[13px] font-semibold text-[#444444] hover:bg-[#FAFAFA]"
            >
              刷新
            </button>
          </div>

          {error ? (
            <div className="mb-6 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-[13px] text-[#B91C1C]">{error}</div>
          ) : null}

          <div className="rounded-2xl overflow-hidden border border-[#EAEAEA] bg-white mb-6">
            <div className="px-6 py-4 border-b border-[#F0F0F5]">
              <h2 className="text-[14px] font-bold text-[#1D1D1F]">当前订阅</h2>
            </div>
            <div className="px-6 py-6">
              {loading && !data ? (
                <p className="text-[13px] text-[#8E8E93]">加载中…</p>
              ) : (
                <>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[#F5F3FF]">
                      <i className="ri-vip-crown-line text-[20px] text-[#7C3AED]" />
                    </div>
                    <div>
                      <p className="text-[15px] font-bold text-[#1D1D1F]">{planDisplayName(sub?.plan ?? 'free')}</p>
                      <p className="text-[12.5px] text-[#8E8E93]">{subtitle}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[13px] text-[#6E6E73]">
                    <p>下一个结算日：{formatDate(sub?.renews_at)}</p>
                    <p>当前积分余额：{data?.current_credits_balance?.toLocaleString() ?? '--'}</p>
                    <p>订阅状态：{subscriptionStatusLabel(sub?.status ?? 'not_subscribed')}</p>
                  </div>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => navigate('/billing/plans')}
                      className="rounded-xl bg-[#7C3AED] px-4 py-2.5 text-[13px] font-semibold text-white"
                    >
                      升级计划
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate('/billing/credits')}
                      className="rounded-xl border border-[#EAEAEA] bg-white px-4 py-2.5 text-[13px] font-semibold text-[#444444]"
                    >
                      购买积分
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate('/account/settings')}
                      className="rounded-xl border border-[#EAEAEA] bg-white px-4 py-2.5 text-[13px] font-semibold text-[#444444]"
                    >
                      账户设置
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="rounded-2xl overflow-hidden border border-[#EAEAEA] bg-white mb-6">
            <div className="px-6 py-4 border-b border-[#F0F0F5]">
              <h2 className="text-[14px] font-bold text-[#1D1D1F]">积分记录</h2>
            </div>
            <div className="px-6 py-5">
              {loading && !data ? (
                <p className="text-[13px] text-[#8E8E93]">加载中…</p>
              ) : !data?.credit_records?.length ? (
                <p className="text-[13px] text-[#8E8E93]">暂无积分变动记录</p>
              ) : (
                data.credit_records.map((row, idx) => {
                  const secondary = creditRecordSecondaryLine(row);
                  return (
                  <div
                    key={row.id}
                    className="flex items-center justify-between py-3"
                    style={{ borderBottom: idx < data.credit_records.length - 1 ? '1px solid #F0F0F5' : 'none' }}
                  >
                    <div>
                      <p className="text-[13.5px] text-[#1D1D1F]">{creditRecordPrimaryLine(row)}</p>
                      {secondary ? (
                        <p className="text-[12px] text-[#6E6E73] mt-0.5">{secondary}</p>
                      ) : null}
                      <p className="text-[11.5px] text-[#8E8E93] mt-1">{formatDate(row.created_at)}</p>
                    </div>
                    <span
                      className="text-[13.5px] font-bold"
                      style={{ color: row.amount >= 0 ? '#16A34A' : '#DC2626' }}
                    >
                      {row.amount >= 0 ? '+' : ''}
                      {row.amount}
                    </span>
                  </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="rounded-2xl overflow-hidden border border-[#EAEAEA] bg-white mb-6">
            <div className="px-6 py-4 border-b border-[#F0F0F5]">
              <h2 className="text-[14px] font-bold text-[#1D1D1F]">最近订单 / 支付记录</h2>
            </div>
            <div className="px-6 py-5">
              {loading && !data ? (
                <p className="text-[13px] text-[#8E8E93]">加载中…</p>
              ) : !data?.payment_orders?.length ? (
                <p className="text-[13.5px] text-[#8E8E93]">暂无订单</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[13px]">
                    <thead>
                      <tr className="text-[#8E8E93] border-b border-[#F0F0F5]">
                        <th className="py-2 pr-3 font-medium">支付方式</th>
                        <th className="py-2 pr-3 font-medium">商户订单号</th>
                        <th className="py-2 pr-3 font-medium">交易号</th>
                        <th className="py-2 pr-3 font-medium">套餐</th>
                        <th className="py-2 pr-3 font-medium">周期</th>
                        <th className="py-2 pr-3 font-medium">金额</th>
                        <th className="py-2 pr-3 font-medium">状态</th>
                        <th className="py-2 font-medium">时间</th>
                      </tr>
                    </thead>
                    <tbody className="text-[#444444]">
                      {data.payment_orders.map((o: PaymentOrderListItemDto) => (
                        <tr key={o.order_id} className="border-b border-[#F7F7FA]">
                          <td className="py-2.5 pr-3 whitespace-nowrap">{paymentMethodLabel(o.payment_provider)}</td>
                          <td className="py-2.5 pr-3 font-mono text-[12px]">{o.out_trade_no}</td>
                          <td className="py-2.5 pr-3 font-mono text-[12px]">{providerTxnDisplay(o)}</td>
                          <td className="py-2.5 pr-3">{planDisplayName(o.plan_code)}</td>
                          <td className="py-2.5 pr-3">{o.period === 'yearly' ? '年付' : '月付'}</td>
                          <td className="py-2.5 pr-3">¥{o.amount}</td>
                          <td className="py-2.5 pr-3">{orderStatusLabel(o.status)}</td>
                          <td className="py-2.5 whitespace-nowrap">{formatDate(o.paid_at || o.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </ShortDramaLayout>
  );
}
