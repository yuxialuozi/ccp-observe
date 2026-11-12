export const nf = new Intl.NumberFormat('zh-CN');

export function num(value) {
  if (value === null || value === undefined || value === '') return '—';
  return nf.format(Math.round(Number(value)));
}

export function compact(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (Math.abs(n) >= 1e4) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'k';
  return nf.format(Math.round(n));
}

export function pct(value, digits = 1) {
  if (value === null || value === undefined) return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${n.toFixed(digits).replace(/\.0$/, '')}%`;
}

export function ms(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return '—';
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 2)}s`;
  return `${Math.round(n)}ms`;
}

export function timeOf(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('zh-CN', { hour12: false });
}

export function dateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.getMonth() + 1}/${d.getDate()} ${d.toLocaleTimeString('zh-CN', { hour12: false })}`;
}

export function relative(value, now = Date.now()) {
  if (!value) return '—';
  const t = typeof value === 'number' ? value : new Date(value).getTime();
  if (!Number.isFinite(t)) return '—';
  const diff = Math.max(0, now - t);
  if (diff < 5000) return '刚刚';
  if (diff < 60000) return `${Math.floor(diff / 1000)} 秒前`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  return `${Math.floor(diff / 86400000)} 天前`;
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function modelKey(name) {
  return String(name || 'unknown')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'model';
}

/** status -> {level,text} for a request row */
export function requestState(row) {
  if (row.truncated) return { level: 'warn', text: '截断' };
  if (!row.ok) return { level: 'error', text: row.status ? String(row.status) : '失败' };
  if (row.retried_ok) return { level: 'warn', text: '重试成功' };
  return { level: 'ok', text: String(row.status || 200) };
}
