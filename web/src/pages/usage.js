import { icons } from '../icons.js';
import { state, loadUsage, setNotice } from '../store.js';
import { pageHead, card, emptyState } from '../ui.js';
import { compact, escapeHtml, ms, num, pct } from '../format.js';
import { UsageChart } from '../charts.js';

const RANGES = [
  [7, '近 7 天'],
  [30, '近 30 天'],
  [90, '近 90 天'],
];

export function renderUsage() {
  const usage = state.usage;
  const days = state.usageDays || 30;

  return `
  ${pageHead('用量', '按天累计、跨重启保留 —— 昨天和上周的数字不会因为重启而消失',
    `<div class="seg">${RANGES.map(([d, label]) => `
      <button class="${d === days ? 'active' : ''}" data-act="usage-range" data-days="${d}">${label}</button>`
    ).join('')}</div>`)}

  ${!usage ? card('用量', '', emptyState(icons.activity, '正在读取用量台账…',
      '若长时间没有数据，说明代理未就绪。')) : `
    ${summaryCard(usage, days)}
    ${chartCard(usage)}
    ${modelTable(usage)}
    ${providerTable(usage)}
  `}`;
}

function summaryCard(usage, days) {
  const s = usage.summary || {};
  const today = s.today || {};
  const perDay = s.active_days ? Math.round((s.requests || 0) / s.active_days) : 0;
  return card(`近 ${days} 天`, `有流量的 ${num(s.active_days)} 天 · 日均 ${num(perDay)} 次请求`, `
    <div class="metric-grid wide">
      ${[['请求', num(s.requests)], ['成功', num(s.success)], ['失败', num(s.failed)],
         ['截断', pct(s.truncation_rate)], ['输入 token', compact(s.input_tokens)],
         ['输出 token', compact(s.output_tokens)], ['缓存读', compact(s.cache_read_tokens)],
         ['平均延迟', ms(s.avg_latency_ms)]]
        .map(([k, v]) => `<div class="stat"><span class="stat-k">${escapeHtml(k)}</span>
          <span class="stat-v">${v}</span></div>`).join('')}
    </div>
    <div class="usage-today">
      <span class="ut-label">今天</span>
      <span>${num(today.requests)} 次请求</span>
      <span class="dim">·</span>
      <span>输入 ${compact(today.input_tokens)} / 输出 ${compact(today.output_tokens)}</span>
      <span class="dim">·</span>
      <span>截断 ${num(today.truncated)}</span>
      <span class="dim">·</span>
      <span>平均 ${ms(today.avg_latency_ms)}</span>
    </div>
    ${usage.persisted === false ? `<p class="muted">台账尚未落盘（首次写入发生在下一次请求结束后）。</p>` : ''}
  `);
}

function chartCard(usage) {
  return `
  <section class="card">
    <div class="card-head">
      <div class="card-title"><h2>每日用量</h2>
        <span class="card-sub">柱状为请求数，折线为截断率</span></div>
      <div class="card-actions">
        <span class="legend"><i class="req"></i>请求</span>
        <span class="legend"><i class="cut"></i>截断率</span>
      </div>
    </div>
    <div class="card-body"><div class="chart-host tall" id="usage-chart">
      <div class="chart-tip" id="usage-tip"></div></div></div>
  </section>`;
}

function modelTable(usage) {
  const rows = usage.models || [];
  if (!rows.length) {
    return card('按模型', '', `<div class="empty-inline">这段时间还没有模型流量</div>`);
  }
  return card('按模型', '同一段时间内的累计用量', `
    <table class="table">
      <thead><tr>
        <th>模型</th><th class="num">请求</th><th class="num">成功</th>
        <th class="num">截断</th><th class="num">输入</th><th class="num">输出</th>
        <th class="num">缓存读</th><th class="num">平均延迟</th>
      </tr></thead>
      <tbody>${rows.map((r) => `
        <tr>
          <td class="mono">${escapeHtml(r.model)}</td>
          <td class="num">${num(r.requests)}</td>
          <td class="num">${pct(r.success_rate)}</td>
          <td class="num ${r.truncated ? 'warn-c' : ''}">${num(r.truncated)}</td>
          <td class="num">${compact(r.input_tokens)}</td>
          <td class="num">${compact(r.output_tokens)}</td>
          <td class="num">${compact(r.cache_read_tokens)}</td>
          <td class="num">${ms(r.avg_latency_ms)}</td>
        </tr>`).join('')}</tbody>
    </table>`);
}

function providerTable(usage) {
  const rows = usage.providers || [];
  if (!rows.length) return '';
  return card('按供应商', '哪一条上游在承担流量', `
    <table class="table">
      <thead><tr>
        <th>供应商</th><th class="num">请求</th><th class="num">失败</th>
        <th class="num">截断</th><th class="num">输入</th><th class="num">输出</th>
        <th class="num">平均延迟</th>
      </tr></thead>
      <tbody>${rows.map((r) => `
        <tr>
          <td>${escapeHtml(r.provider)}</td>
          <td class="num">${num(r.requests)}</td>
          <td class="num ${r.failed ? 'bad' : ''}">${num(r.failed)}</td>
          <td class="num ${r.truncated ? 'warn-c' : ''}">${num(r.truncated)}</td>
          <td class="num">${compact(r.input_tokens)}</td>
          <td class="num">${compact(r.output_tokens)}</td>
          <td class="num">${ms(r.avg_latency_ms)}</td>
        </tr>`).join('')}</tbody>
    </table>`);
}

/** Called after paint; the chart node only exists on the usage page. */
export function mountUsageChart() {
  const host = document.getElementById('usage-chart');
  if (!host) {
    if (state.usageChart) {
      state.usageChart.destroy();
      state.usageChart = null;
    }
    return;
  }
  const tip = document.getElementById('usage-tip');
  if (!state.usageChart || state.usageChart.el !== host) {
    if (state.usageChart) state.usageChart.destroy();
    state.usageChart = new UsageChart(host, tip);
  }
  const rows = state.usage?.days || [];
  if (state.usageChart.rows !== rows) state.usageChart.setData(rows);
}

export async function usageActions(act, el) {
  if (act !== 'usage-range') return false;
  state.usageDays = Number(el.dataset.days) || 30;
  await loadUsage();
  state.forcePaint = true;
  setNotice(null);
  return true;
}
