/**
 * 与后端通信的 API 根地址（不含末尾 /）。
 *
 * - 开发：默认留空，配合 Vite proxy（/api、/static → localhost:8000），与 fetch(`${base}/api/...`) 拼出相对路径 /api/...
 * - 生产：应通过 VITE_API_BASE_URL 注入；若未注入则用当前页面 origin（同域部署）
 * - 若构建误带 localhost，而用户从非本机域名访问，则强制改为当前页面 origin，避免线上仍打 localhost:8000
 */
function trimSlash(s: string): string {
  return s.replace(/\/+$/, '');
}

function resolveApiBaseUrl(): string {
  let raw = trimSlash(String(import.meta.env.VITE_API_BASE_URL || '').trim());
  const isProd = import.meta.env.PROD;
  const loc = typeof globalThis !== 'undefined' && 'location' in globalThis ? globalThis.location : null;
  const pageHost = loc?.hostname ?? '';
  const pageIsLocal = pageHost === 'localhost' || pageHost === '127.0.0.1';

  if (isProd && loc) {
    const rawPointsToLocal = /localhost|127\.0\.0\.1/i.test(raw);
    if (raw && rawPointsToLocal && !pageIsLocal) {
      console.warn(
        '[API_BASE_URL] VITE_API_BASE_URL points to localhost but page host is not local; using window.location.origin.',
      );
      raw = trimSlash(loc.origin);
    } else if (!raw) {
      raw = trimSlash(loc.origin);
    }
  }

  if (!isProd && !raw) {
    return '';
  }

  return raw;
}

const API_BASE_URL = resolveApiBaseUrl();

console.log('[API_BASE_URL]', API_BASE_URL || '(empty — dev relative /api via Vite proxy)');

export { API_BASE_URL };
