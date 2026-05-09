import { Navigate } from 'react-router-dom';

/** 兼容旧链接 /pricing，统一到套餐页 */
export function PricingPage() {
  return <Navigate to="/billing/plans" replace />;
}
