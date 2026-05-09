/** 登录/注册成功后的目标路径：优先 location.state.from，其次 ?from=，否则首页 */
export function getPostAuthRedirect(searchParams: URLSearchParams, locationState: unknown): string {
  const fromState = (locationState as { from?: string } | null)?.from;
  const fromParam = searchParams.get('from');
  const raw = fromState || fromParam;
  if (!raw || typeof raw !== 'string') return '/';
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('://')) return '/';
  if (raw === '/login' || raw === '/register') return '/';
  return raw;
}
