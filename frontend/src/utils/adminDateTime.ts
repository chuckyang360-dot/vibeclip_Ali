/** 管理后台统一按上海时区展示流水时间（与后端「今日」统计口径一致）。 */
const SHANGHAI_TZ = 'Asia/Shanghai';

export function formatAdminShanghaiDateTime(iso: string | null | undefined): string {
  if (iso == null || String(iso).trim() === '') return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SHANGHAI_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d);
  const pick = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const y = pick('year');
  const m = pick('month');
  const day = pick('day');
  const h = pick('hour');
  const min = pick('minute');
  const s = pick('second');
  if (!y) return String(iso);
  return `${y}-${m}-${day} ${h}:${min}:${s}`;
}
