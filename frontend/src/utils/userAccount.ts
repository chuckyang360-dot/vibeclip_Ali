import type { AuthUser } from '../services/api';
import { SUBSCRIPTION_PLANS, type PlanKey } from '../constants/billing';

/** Subscription plan title for billing cards (e.g. 基础会员). */
export function subscriptionPlanDisplayName(plan: string | null | undefined): string {
  const key = (plan || 'free').trim().toLowerCase();
  if (key === 'free') return '免费版';
  const p = SUBSCRIPTION_PLANS[key as Exclude<PlanKey, 'free'>];
  return p?.name ?? plan ?? '免费版';
}

/** Header / account settings membership line (e.g. 基础会员 / 免费版用户). */
export function membershipLabelFromUser(user: AuthUser | null | undefined): string {
  const plan = user?.subscription_plan?.trim().toLowerCase();
  const status = user?.subscription_status?.trim().toLowerCase();
  if (plan && plan !== 'free' && status === 'active') {
    return subscriptionPlanDisplayName(plan);
  }
  return '免费版用户';
}

/**
 * Display name for nav / menus.
 * Prefer registered username; avoid showing email local-part when legacy rows stored it in `name`.
 */
export function getUserDisplayName(user: AuthUser | null | undefined): string {
  if (!user) return '用户';
  const name = user.name?.trim();
  const username = user.username?.trim();
  const emailPrefix = user.email?.split('@')[0]?.trim() ?? '';
  if (username && (!emailPrefix || username !== emailPrefix)) return username;
  if (name) return name;
  if (username) return username;
  if (user.id) return `用户 ${user.id}`;
  return emailPrefix || '用户';
}
