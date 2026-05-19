import type { NavigateFunction } from 'react-router-dom';
import { ShortDramaApiError } from '@/services/shortDramaApi';

export type InsufficientCreditsDetail = {
  code?: string;
  message?: string;
  required_credits?: number;
  current_balance?: number;
};

export function isInsufficientCreditsDetail(detail: unknown): detail is InsufficientCreditsDetail {
  if (!detail || typeof detail !== 'object') return false;
  const d = detail as InsufficientCreditsDetail;
  return d.code === 'INSUFFICIENT_CREDITS';
}

export function isInsufficientCreditsError(status: number, detail: unknown): boolean {
  return status === 402 && isInsufficientCreditsDetail(detail);
}

export function showInsufficientCreditsDialog(navigate: NavigateFunction): void {
  const go = window.confirm(
    '积分不足\n\n您的积分不足，请充值后继续使用。\n\n点击「确定」前往充值，点击「取消」关闭。',
  );
  if (go) {
    navigate('/billing');
  }
}

export function handleApiInsufficientCredits(
  status: number,
  detail: unknown,
  navigate: NavigateFunction,
): boolean {
  if (!isInsufficientCreditsError(status, detail)) return false;
  showInsufficientCreditsDialog(navigate);
  return true;
}

/** Returns true when a 402 INSUFFICIENT_CREDITS dialog was shown. */
export function tryHandleInsufficientCreditsFromApiError(
  e: unknown,
  navigate: NavigateFunction,
): boolean {
  if (e instanceof ShortDramaApiError && e.isInsufficientCredits) {
    return handleApiInsufficientCredits(e.status, e.detail, navigate);
  }
  return false;
}
