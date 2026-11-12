import './styles.css';
import { api } from './api.js';
import './icons-extra.js';
import { icons, logoSvg } from './icons.js';
import { ContextChart } from './charts.js';
import {
  state, subscribe, emit, go, currentModel, refreshStats, loadConfig,
  loadDetail, loadCaptures, loadCapture, previewRoute, loadUsage,
} from './store.js';
import { escapeHtml, pct, relative } from './format.js';
import {
  renderOverview, renderModels, renderTruncations, renderBucketsTable, renderRecentTable,
} from './pages/overview.js';
import { renderProviders, providerActions } from './pages/providers.js';
import { renderRoutes, routeActions } from './pages/routes.js';
import { renderCapture, captureActions, openCapture } from './pages/capture.js';
import { renderGuide, guideActions } from './pages/guide.js';
import { renderSettings, settingsActions } from './pages/settings.js';
import { renderUsage, usageActions, mountUsageChart } from './pages/usage.js';

const POLL_MS = 2500;

const NAV = [
  { id: 'overview', label: '总览', icon: 'dashboard', hint: '截断率与归因' },
  { id: 'models', label: '模型', icon: 'cpu', hint: '单模型全链路' },
  { id: 'usage', label: '用量', icon: 'activity', hint: '按天累计用量' },
  { id: 'capture', label: '抓包', icon: 'braces', hint: '完整请求响应' },
  { id: 'routes', label: '路由', icon: 'network', hint: '按模型分流' },
  { id: 'providers', label: '供应商', icon: 'server', hint: '上游与鉴权' },
  { id: 'guide', label: '接入', icon: 'book', hint: '客户端配置' },
  { id: 'settings', label: '设置', icon: 'gear', hint: '行为与诊断' },
];

const PAGES = {
  overview: renderOverview,
  models: renderModels,
  usage: renderUsage,
  capture: renderCapture,
  routes: renderRoutes,
  providers: renderProviders,
  guide: renderGuide,
  settings: renderSettings,
};

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

let chart = null;
let pollTimer = null;
let lastPage = null;

/* ------------------------------------------------------------------ shell */

function shell() {
  return `
  <div class="app">
    <aside class="rail">
      <div class="rail-brand">
        <span class="mark">${logoSvg.replace('width="32" height="32"', 'width="18" height="18"')}</span>
        <div>
          <div class="rn">ccp-observe</div>
          <div class="rs">截断检测 · 模型健康</div>
        </div>
      </div>
      <nav class="rail-nav" id="rail-nav">
        ${NAV.map((n) => `
          <button class="rail-btn" data-page="${n.id}" title="${escapeHtml(n.hint)}">
            ${icons[n.icon] || ''}<span>${n.label}</span>
          </button>`).join('')}
      </nav>
      <div class="rail-foot">
        <div class="rail-status" id="rail-status"></div>
        <div class="rail-ver" id="rail-ver"></div>
      </div>
    </aside>
    <div class="workspace">
      <header class="topstrip">
        <div class="strip-left" id="strip-left"></div>
        <div class="strip-right">
          <span class="strip-metric" id="strip-sync"></span>
          <button class="icon-btn" id="btn-refresh" title="立即刷新">${icons.refresh}</button>
        </div>
      </header>
      <main class="page" id="page"></main>
      <div class="notice" id="notice" hidden></div>
    </div>
  </div>
  <div id="overlay-root"></div>`;
}

/* ------------------------------------------------------------------- boot */

async function init() {
  state.page = pageFromHash();
  $('#app').innerHTML = shell();
  bindShell();
  await loadConfig();
  await refreshStats();
  await Promise.all([loadDetail(), loadCaptures()]);
  paint();
  if (location.hash) await afterNavigate();
  pollTimer = setInterval(() => {
    if (document.visibilityState === 'visible') tick();
  }, POLL_MS);
}

function pageFromHash() {
  const m = /#\/([a-z]+)/.exec(location.hash || '');
  const id = m ? m[1] : '';
  return PAGES[id] ? id : 'overview';
}

async function tick(manual = false) {
  const btn = $('#btn-refresh');
  if (btn && manual) btn.classList.add('spin');
  try {
    const ok = await refreshStats();
    if (ok) {
      if (state.page === 'models' || state.page === 'overview') await loadDetail();
      if (state.page === 'capture') await loadCaptures();
      if (state.page === 'usage') await refreshUsage();
    }
    paint();
  } finally {
    if (btn && manual) btn.classList.remove('spin');
  }
}

async function refreshUsage() {
  const before = usageStamp();
  await loadUsage();
  // Only rebuild the page when the numbers moved; a rebuild every 2.5s would
  // kill chart hover state for no reason.
  if (usageStamp() !== before) state.forcePaint = true;
}

function usageStamp() {
  const days = state.usage?.days || [];
  const last = days[days.length - 1] || {};
  return JSON.stringify([
    days.length,
    last.date,
    last.requests,
    (state.usage?.summary || {}).requests,
    (state.usage?.models || []).length,
    (state.usage?.providers || []).length,
  ]);
}

async function afterNavigate() {
  if (state.page === 'capture') await loadCaptures();
  if (state.page === 'usage') await loadUsage();
  if (state.page === 'routes' && !state.routePreview) await previewRoute();
  if (state.page === 'providers' || state.page === 'routes') await loadConfig();
  paint();
}

/* ------------------------------------------------------------------ paint */

function paint() {
  paintRail();
  paintStrip();
  paintNotice();

  const page = $('#page');
  if (!page) return;
  // Re-rendering the page on every poll would drop focus and scroll; only
  // rebuild when the page actually changed or a full repaint was requested.
  const rebuild = lastPage !== state.page || state.forcePaint;
  state.forcePaint = false;
  if (rebuild) {
    page.innerHTML = (PAGES[state.page] || renderOverview)();
    page.dataset.page = state.page;
    lastPage = state.page;
    bindPage();
    if (state.page === 'models') {
      hydrateModelsPage();
    }
    if (state.page === 'usage') {
      mountUsageChart();
    } else if (state.usageChart) {
      // The chart node was replaced with another page; let go of the observer.
      state.usageChart.destroy();
      state.usageChart = null;
    }
    page.scrollTop = 0;
  } else if (state.page === 'models') {
    hydrateModelsPage();
  } else if (state.page === 'usage') {
    mountUsageChart();
  }
}

function repaint() {
  state.forcePaint = true;
  paint();
}

function paintRail() {
  $$('#rail-nav .rail-btn').forEach((btn) => {
    const active = btn.dataset.page === state.page;
    btn.classList.toggle('active', active);
    if (active) btn.setAttribute('aria-current', 'page');
    else btn.removeAttribute('aria-current');
  });
  const online = !state.offline && state.stats;
  const models = state.stats?.models || [];
  const rate = Number(state.stats?.overall?.truncation_rate || 0);
  $('#rail-status').innerHTML = `
    <span class="dot ${online ? (rate >= 40 ? 'error' : rate > 0 ? 'warn' : 'ok') : 'error'}"></span>
    <span>${online ? '代理在线' : '代理离线'}</span>`;
  const ver = $('#rail-ver');
  if (ver) ver.textContent = state.config?.version ? `v${state.config.version} · ${models.length} 个模型` : '';
}

function paintStrip() {
  const stats = state.stats;
  const left = $('#strip-left');
  const sync = $('#strip-sync');
  if (!stats) {
    left.innerHTML = `<span class="chip error">代理离线</span>`;
    sync.textContent = '';
    return;
  }
  const overall = stats.overall || {};
  const diag = stats.diagnosis || {};
  const rate = Number(overall.truncation_rate || 0);
  const cls = rate >= 40 ? 'error' : rate > 0 ? 'warn' : 'ok';
  const ownerText = diag.owner
    ? `<span class="ts-owner">${escapeHtml({ model: '模型侧', gateway: '网关侧', local: '本地链路' }[diag.owner] || diag.owner)}</span>`
    : '';
  left.innerHTML = `
    <div class="strip-rate ${cls}" title="${escapeHtml(diag.detail || '')}">
      <span class="sr-label">截断率</span><span class="sr-val">${pct(rate)}</span>${ownerText}
    </div>
    <span class="strip-sep"></span>
    <span class="strip-item">总请求 <b>${overall.requests ?? 0}</b></span>
    <span class="strip-item">成功率 <b>${pct(overall.success_rate)}</b></span>
    <span class="strip-item">活跃 <b>${escapeHtml(stats.active_model || '—')}</b></span>`;
  sync.textContent = state.lastSync ? `同步于 ${relative(new Date(state.lastSync).toISOString())}` : '';
}

function paintNotice() {
  const node = $('#notice');
  const note = state.notice;
  if (!note) {
    node.hidden = true;
    return;
  }
  node.hidden = false;
  node.className = `notice ${note.kind || 'ok'}`;
  node.innerHTML = `<span>${escapeHtml(note.text)}</span>
    <button class="icon-btn xs" data-dismiss-notice>${icons.close}</button>`;
}

/* ----------------------------------------------------------------- events */

function bindShell() {
  $('#rail-nav').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-page]');
    if (btn) go(btn.dataset.page);
  });
  $('#btn-refresh').addEventListener('click', () => tick(true));
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-dismiss-notice]')) {
      state.notice = null;
      paintNotice();
    }
  });
  window.addEventListener('hashchange', async () => {
    state.page = pageFromHash();
    await afterNavigate();
  });
}

function bindPage() {
  const root = $('#page');
  root.addEventListener('click', handlePageClick);
  root.addEventListener('change', handlePageChange);
  window.addEventListener('beforeunload', () => {
    if (pollTimer) clearInterval(pollTimer);
    if (chart) chart.destroy();
  });
}

async function handlePageClick(e) {
  const modelCard = e.target.closest('[data-model]');
  if (modelCard) {
    state.selectedModel = modelCard.dataset.model;
    state.forcePaint = true;
    if (state.page === 'models') await loadDetail();
    paint();
    return;
  }

  const notify = e.target.closest('[data-act],[data-action]');
  if (notify) {
    await handleAction(notify.dataset.act || notify.dataset.action, notify);
    return;
  }
  const capBtn = e.target.closest('[data-copy]');
  if (capBtn) {
    captureActions('copy-capture', capBtn, repaint);
    return;
  }

  const capRow = e.target.closest('[data-capture]');
  if (capRow) {
    await openCapture(capRow.dataset.capture, repaint);
    if (state.page !== 'capture') go('capture');
    return;
  }

  const truncRow = e.target.closest('.trunc-row');
  if (truncRow) {
    const item = truncRow.closest('.trunc-item');
    const id = item.dataset.tid;
    state.expanded = state.expanded || new Set();
    if (state.expanded.has(id)) state.expanded.delete(id);
    else state.expanded.add(id);
    item.classList.toggle('open');
    return;
  }

  const gran = e.target.closest('[data-gran]');
  if (gran) {
    state.gran = gran.dataset.gran;
    $$('#gran-seg button').forEach((b) => b.classList.toggle('active', b === gran));
    const model = currentModel();
    try {
      const res = await api.buckets(model, state.gran);
      state.detail.buckets = res.items || [];
      renderBucketsTable($('#buckets-wrap'));
    } catch {
      /* ignore */
    }
    return;
  }
}

function handlePageChange(e) {
  if (e.target.id === 'cap-model') {
    state.captureModel = e.target.value;
    loadCaptures().then(repaint);
  }
  if (e.target.id === 'cap-trunc') {
    state.captureTruncated = e.target.checked;
    loadCaptures().then(repaint);
  }
}

/* Dispatch the many small `data-act` buttons to their page module. */
async function handleAction(action, el) {
  if (action === 'refresh') {
    await tick(true);
    return;
  }
  if (action === 'goto-guide') {
    go('guide');
    return;
  }
  if (providerActions(action, el, repaint)) return;
  if (routeActions(action, el, repaint)) return;
  if (captureActions(action, el, repaint)) return;
  if (settingsActions(action, el, repaint)) return;
  if (await usageActions(action, el)) repaint();
}

/* ------------------------------------------------- models page hydration */

let pendingChart = null;

function hydrateModelsPage() {
  const model = currentModel();
  const list = state.detail.truncations || [];
  renderTruncations($('#trunc-list'));
  renderBucketsTable($('#buckets-wrap'));
  renderRecentTable($('#recent-wrap'));
  mountChart();
  void list;
  void model;
}

function mountChart() {
  const host = $('#chart-host');
  if (!host) {
    if (chart) {
      chart.destroy();
      chart = null;
    }
    return;
  }
  const tip = $('#chart-tip');
  if (!chart || chart.el !== host) {
    if (chart) chart.destroy();
    chart = new ContextChart(host, tip);
  }
  const pts = state.detail.context || [];
  if (!pts.length) {
    if (chart.u) {
      chart.u.destroy();
      chart.u = null;
    }
    if (!host.querySelector('.chart-empty')) {
      host.insertAdjacentHTML('beforeend',
        '<div class="chart-empty">该模型还没有 token 用量数据<br/><span>发起一次流式请求后即可上图</span></div>');
    }
    return;
  }
  host.querySelector('.chart-empty')?.remove();
  chart.setData(pts);
  pendingChart = chart;
}

window.addEventListener('beforeunload', () => {
  if (pollTimer) clearInterval(pollTimer);
  if (chart) chart.destroy();
});

init().catch((err) => {
  $('#app').innerHTML = `<div class="boot"><div class="boot-mark">ccp</div>
    <div class="boot-text">${escapeHtml(err.message || String(err))}</div></div>`;
});
