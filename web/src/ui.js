import { escapeHtml, pct, num, ms, compact } from './format.js';

export const OWNER_LABEL = { model: '模型侧', gateway: '网关侧', local: '本地链路' };
export const RATE_CLASS = (rate) => (rate >= 40 ? 'error' : rate > 0 ? 'warn' : 'ok');

export function pageHead(title, subtitle, actions = '') {
  return `
  <header class="page-head">
    <div>
      <h1>${escapeHtml(title)}</h1>
      ${subtitle ? `<p>${subtitle}</p>` : ''}
    </div>
    <div class="page-actions">${actions}</div>
  </header>`;
}

export function card(title, subtitle = '', body = '', actions = '', cls = '') {
  return `
  <section class="card ${cls}">
    <div class="card-head">
      <div class="card-title">
        <h2>${escapeHtml(title)}</h2>
        ${subtitle ? `<span class="card-sub">${subtitle}</span>` : ''}
      </div>
      <div class="card-actions">${actions}</div>
    </div>
    <div class="card-body">${body}</div>
  </section>`;
}

export function emptyState(icon, title, text, actions = '') {
  return `
  <div class="empty">
    <div class="empty-icon">${icon}</div>
    <h3>${escapeHtml(title)}</h3>
    <p>${text}</p>
    ${actions ? `<div class="empty-actions">${actions}</div>` : ''}
  </div>`;
}

export function note(kind, icon, html) {
  return `<div class="note ${kind}">${icon}<div>${html}</div></div>`;
}

export function rateBadge(rate) {
  return `<span class="rate-badge ${RATE_CLASS(Number(rate || 0))}">${pct(rate)}</span>`;
}

export function ownerTag(owner) {
  if (!owner) return '';
  return `<span class="owner-tag ${escapeHtml(owner)}">${OWNER_LABEL[owner] || escapeHtml(owner)}</span>`;
}

export function stat(label, value, cls = '') {
  return `<div class="stat ${cls}"><span class="stat-k">${escapeHtml(label)}</span><span class="stat-v">${value}</span></div>`;
}

export function metricGrid(items) {
  return `<div class="metric-grid">${items.map(([k, v, cls]) => stat(k, v, cls)).join('')}</div>`;
}

export function heroLine(model) {
  const rate = Number(model.truncation_rate || 0);
  return `
  <div class="hero-line">
    <div class="hero-num ${RATE_CLASS(rate)}">
      <span class="hn-value">${pct(rate)}</span>
      <span class="hn-label">截断率 · ${num(model.truncated)}/${num(model.requests)}</span>
    </div>
    ${metricGrid([
      ['成功率', pct(model.success_rate)],
      ['重试成功', pct(model.retry_success_rate)],
      ['P95 延迟', ms(model.p95_latency_ms)],
      ['输入 / 输出', `${compact(model.input_tokens)} / ${compact(model.output_tokens)}`],
    ])}
  </div>`;
}
