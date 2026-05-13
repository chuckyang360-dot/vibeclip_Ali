import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { createAlipayOrder } from '../../api/billingApi';
import { PaymentModal, type PaymentMethod } from '../../components/billing/PaymentModal';
import {
  CREDIT_PACKS,
  SUBSCRIPTION_PLANS,
  yearlyTotals,
  type BillingPeriod,
} from '../../constants/billing';
import { ShortDramaLayout } from '../short-drama/components/ShortDramaLayout';

type CheckoutType = 'subscription' | 'credits';

function parsePlan(p: string | null): keyof typeof SUBSCRIPTION_PLANS {
  if (p === 'basic' || p === 'standard' || p === 'pro') return p;
  return 'standard';
}

function parsePeriod(p: string | null): BillingPeriod {
  return p === 'yearly' ? 'yearly' : 'monthly';
}

export function BillingCheckoutPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const type = (searchParams.get('type') === 'credits' ? 'credits' : 'subscription') as CheckoutType;
  const planKey = parsePlan(searchParams.get('plan'));
  const rawPack = searchParams.get('pack');
  const validPack = CREDIT_PACKS.find((x) => x.id === rawPack) ?? CREDIT_PACKS[0];

  const [period, setPeriodState] = useState<BillingPeriod>(() => parsePeriod(searchParams.get('period')));
  const [payMethod] = useState<PaymentMethod>('alipay');
  const [modalOpen, setModalOpen] = useState(false);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  useEffect(() => {
    setPeriodState(parsePeriod(searchParams.get('period')));
  }, [searchParams]);

  const setPeriod = (next: BillingPeriod) => {
    setPeriodState(next);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('period', next);
    setSearchParams(nextParams, { replace: true });
  };

  const subMeta = SUBSCRIPTION_PLANS[planKey];
  const y = useMemo(() => yearlyTotals(subMeta.monthlyPrice), [subMeta.monthlyPrice]);

  const isCredits = type === 'credits';
  const titleLine = isCredits ? `积分包 · ${validPack.points} 积分` : subMeta.name;
  const amountNumber = isCredits ? validPack.price : period === 'monthly' ? subMeta.monthlyPrice : y.payable;
  const amountLabel = `¥${amountNumber}`;

  const submitPaymentFormHtml = (paymentFormHtml: string) => {
    const wrap = document.createElement('div');
    wrap.style.display = 'none';
    wrap.innerHTML = paymentFormHtml;
    document.body.appendChild(wrap);
    const form = wrap.querySelector('form');
    if (!form) {
      throw new Error('支付表单无效');
    }
    form.submit();
  };

  const openPay = async () => {
    if (isCredits) {
      setPayError('当前仅支持支付宝订阅支付，积分包支付暂未开通。');
      setModalOpen(true);
      return;
    }
    setPayError(null);
    setModalOpen(true);
    setCreatingOrder(true);
    try {
      const order = await createAlipayOrder(planKey, period);
      if (order.pay_url) {
        window.location.href = order.pay_url;
        return;
      }
      if (order.payment_form_html) {
        submitPaymentFormHtml(order.payment_form_html);
        return;
      }
      navigate(`/billing/processing?order_id=${order.order_id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : '创建支付订单失败，请稍后重试';
      setPayError(message);
    } finally {
      setCreatingOrder(false);
    }
  };

  return (
    <ShortDramaLayout headerMode="landing">
      <div className="min-h-screen bg-[#F7F8FA] px-6 py-10">
        <div className="mx-auto max-w-[1100px]">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-10">
            {/* 左侧 */}
            <div className="lg:col-span-7">
              <h1 className="text-2xl font-black text-[#1D1D1F]">{isCredits ? '确认购买' : '确认订阅'}</h1>
              <p className="mt-2 text-[14px] leading-relaxed text-[#6E6E73]">
                {isCredits
                  ? '确认积分包与支付方式。支付完成后积分将自动发放到账户（当前为演示流程，不创建真实订单）。'
                  : '确认套餐信息并选择支付方式，支付完成后积分将自动发放到账户。'}
              </p>

              <section className="mt-8 rounded-2xl border border-[#EAEAEA] bg-white p-6 shadow-sm">
                <h2 className="text-[15px] font-bold text-[#1D1D1F]">{isCredits ? '积分包' : '套餐信息'}</h2>
                {isCredits ? (
                  <div className="mt-4 space-y-2 text-[14px] text-[#444444]">
                    <p>积分数量：{validPack.points} 积分</p>
                    <p>支付金额：¥{validPack.price}</p>
                    <p className="text-[13px] text-[#6E6E73]">积分永久有效（以正式条款为准）。</p>
                  </div>
                ) : (
                  <div className="mt-4 space-y-2 text-[14px] text-[#444444]">
                    <p>套餐名称：{subMeta.name}</p>
                    <p>计费周期：{period === 'monthly' ? '连续包月' : '连续包年（8 折）'}</p>
                    <p>
                      套餐价格：
                      {period === 'monthly' ? `¥${subMeta.monthlyPrice}/月` : `¥${y.payable}/年（原价 ¥${y.subtotal}）`}
                    </p>
                    <p>每月积分：{subMeta.creditsPerMonth} 积分</p>
                    <ul className="mt-2 list-inside list-disc text-[13px] text-[#6E6E73]">
                      {subMeta.summaryLines.map((l) => (
                        <li key={l}>{l}</li>
                      ))}
                    </ul>
                    <Link
                      to="/billing/plans"
                      className="mt-3 inline-block text-[13px] font-semibold text-[#7B61FF] hover:underline"
                    >
                      更换套餐
                    </Link>
                  </div>
                )}
              </section>

              {!isCredits ? (
                <section className="mt-6 rounded-2xl border border-[#EAEAEA] bg-white p-6 shadow-sm">
                  <h2 className="text-[15px] font-bold text-[#1D1D1F]">计费周期</h2>
                  <div className="mt-4 inline-flex rounded-xl border border-[#EAEAEA] p-1">
                    <button
                      type="button"
                      onClick={() => setPeriod('monthly')}
                      className={`rounded-lg px-4 py-2 text-[13px] font-semibold ${
                        period === 'monthly' ? 'bg-[#1D1D1F] text-white' : 'text-[#6E6E73]'
                      }`}
                    >
                      连续包月
                    </button>
                    <button
                      type="button"
                      onClick={() => setPeriod('yearly')}
                      className={`rounded-lg px-4 py-2 text-[13px] font-semibold ${
                        period === 'yearly' ? 'bg-[#1D1D1F] text-white' : 'text-[#6E6E73]'
                      }`}
                    >
                      连续包年 8 折
                    </button>
                  </div>
                </section>
              ) : null}

              <section className="mt-6 rounded-2xl border border-[#EAEAEA] bg-white p-6 shadow-sm">
                <h2 className="text-[15px] font-bold text-[#1D1D1F]">选择支付方式</h2>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3 transition-colors ${
                      payMethod === 'alipay'
                        ? 'border-[#7B61FF] bg-[rgba(123,97,255,0.06)]'
                        : 'border-[#EAEAEA] hover:border-[#D0D0D0]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="pay"
                      className="sr-only"
                      checked={payMethod === 'alipay'}
                      readOnly
                    />
                    <span className="text-[20px] font-bold text-[#1677FF]">支</span>
                    <div className="flex-1">
                      <p className="text-[14px] font-semibold text-[#1D1D1F]">支付宝</p>
                      <p className="text-[11px] text-[#8E8E93]">跳转支付宝收银台完成支付</p>
                    </div>
                    {payMethod === 'alipay' ? <span className="text-[#7B61FF]">✓</span> : null}
                  </label>
                </div>
              </section>

              <div className="mt-6 rounded-xl bg-[#F0F1F3] px-4 py-3 text-[12.5px] leading-relaxed text-[#555555]">
                <p>· 支付成功后，套餐权益会立即生效。</p>
                <p>· 月度积分会自动发放到账户。</p>
                <p>· 订阅可在账单页面管理。</p>
                <p>· 如支付失败，不会扣除积分或变更套餐。</p>
              </div>
            </div>

            {/* 右侧摘要 */}
            <div className="lg:col-span-5">
              <div className="sticky top-24 rounded-2xl border border-[#EAEAEA] bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.08)]">
                <h2 className="text-[15px] font-bold text-[#1D1D1F]">订单摘要</h2>
                <dl className="mt-4 space-y-2 text-[13px] text-[#444444]">
                  <div className="flex justify-between gap-2">
                    <dt className="text-[#8E8E93]">套餐</dt>
                    <dd className="text-right font-medium">{titleLine}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-[#8E8E93]">计费周期</dt>
                    <dd className="text-right font-medium">
                      {isCredits ? '一次性' : period === 'monthly' ? '连续包月' : '连续包年'}
                    </dd>
                  </div>
                  {!isCredits ? (
                    <>
                      <div className="flex justify-between gap-2">
                        <dt className="text-[#8E8E93]">每月积分</dt>
                        <dd className="text-right font-medium">{subMeta.creditsPerMonth}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-[#8E8E93]">生成队列</dt>
                        <dd className="text-right">{subMeta.queueLabel}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-[#8E8E93]">高清导出</dt>
                        <dd className="text-right">{subMeta.hdExport}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-[#8E8E93]">去水印</dt>
                        <dd className="text-right">{subMeta.watermark}</dd>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between gap-2">
                      <dt className="text-[#8E8E93]">积分</dt>
                      <dd className="text-right font-medium">{validPack.points}</dd>
                    </div>
                  )}
                </dl>
                <div className="my-5 border-t border-[#EAEAEA]" />
                {!isCredits && period === 'yearly' ? (
                  <>
                    <div className="flex justify-between text-[13px] text-[#444444]">
                      <span>小计</span>
                      <span>¥{y.subtotal}</span>
                    </div>
                    <div className="mt-2 flex justify-between text-[13px] text-[#16A34A]">
                      <span>年付优惠</span>
                      <span>-¥{y.saved}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between text-[13px] text-[#444444]">
                    <span>小计</span>
                    <span>¥{isCredits ? validPack.price : subMeta.monthlyPrice}</span>
                  </div>
                )}
                {!isCredits && period === 'monthly' ? (
                  <div className="mt-2 flex justify-between text-[13px] text-[#8E8E93]">
                    <span>优惠</span>
                    <span>¥0</span>
                  </div>
                ) : null}
                <div className="mt-3 flex justify-between text-[16px] font-bold text-[#1D1D1F]">
                  <span>应付金额</span>
                  <span>{amountLabel}</span>
                </div>
                <button
                  type="button"
                  onClick={openPay}
                  className="mt-6 w-full rounded-xl bg-[#7B61FF] py-3.5 text-[15px] font-bold text-white shadow-sm transition-colors hover:bg-[#6B51EF]"
                >
                  确认支付 {amountLabel}
                </button>
                <p className="mt-3 text-center text-[11px] leading-relaxed text-[#8E8E93]">
                  点击确认支付即表示你同意
                  <Link to="/terms" className="mx-0.5 text-[#7B61FF] hover:underline">
                    《服务协议》
                  </Link>
                  和
                  <Link to="/subscription-terms" className="mx-0.5 text-[#7B61FF] hover:underline">
                    《订阅条款》
                  </Link>
                  。
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <PaymentModal
        open={modalOpen}
        amountLabel={amountLabel}
        titleLine={titleLine}
        loading={creatingOrder}
        errorMessage={payError}
        onClose={() => setModalOpen(false)}
        onRetry={openPay}
      />
    </ShortDramaLayout>
  );
}
