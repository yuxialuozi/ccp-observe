import { icons } from '../icons.js';
import { api } from '../api.js';
import { state, currentModel, go } from '../store.js';
import {
  RATE_CLASS, OWNER_LABEL, pageHead, card, emptyState, note, metricGrid,
  ownerTag, rateBadge,
} from '../ui.js';
import { compact, escapeHtml, ms, num, pct, relative, timeOf } from '../format.js';

const OWNER_ICON = { model: 'cpu', gateway: 'plug', local: 'terminal' };

export function renderOverview() {
  const stats = state.stats;
  if (!stats) return renderOffline();
  const overall = stats.overall || {};
  const models = stats.models || [];
  const diag = stats.diagnosis || {};

  return `
  ${pageHead('总览', '连上之后到底哪里出了问题 —— 截断率、归因与模型健康',
    `<button class="btn" data-act="refresh">${icons.refresh}<span>刷新</span></button>`)}

  <div class="headline-grid">
    <section class="headline ${RATE_CLASS(overall.truncation_rate || 0)}">
      <div class="hl-label">全局截断率</div>
      <div class="hl-value">${pct(overall.truncation_rate)}</div>
      <div class="hl-sub">${num(overall.truncated)} / ${num(overall.requests)} 次请求 · ${
        stats.last_truncation_at ? `最近 ${relative(stats.last_truncation_at)}` : '暂无截断'
      }</div>
      <div class="hl-bar"><i style="width:${Math.min(100, Number(overall.truncation_rate) || 0)}%"></i></div>
      ${metricGrid([
        ['成功率', pct(overall.success_rate)],
        ['重试后成功', num(overall.retried_ok)],
        ['平均延迟', ms(overall.avg_latency_ms)],
        ['P95 延迟', ms(overall.p95_latency_ms)],
        ['输入 token', compact(overall.input_tokens)],
        ['输出 token', compact(overall.output_tokens)],
      ])}
    </section>
    ${renderDiagnosisCard(diag, overall)}
  </div>

  ${card('模型健康', `共 ${models.length} 个模型 · 全部来自实际流量`,
    models.length ? `<div class="model-grid">${models.map(modelCard).join('')}</div>`
      : emptyState(icons.activity, '还没有模型流量',
          '把客户端指向本代理后，这里会自动出现模型卡片。',
          `<button class="btn primary" data-act="goto-guide">查看接入指引</button>`))}

  ${renderReasonBreakdown(overall)}
  ${renderRecentTruncations()}`;
}

function renderOffline() {
  return `
  ${pageHead('总览', '无法连接本地代理')}
  ${card('代理未连接', '',
    emptyState(icons.xCircle, '无法连接本地代理',
      `请确认代理已启动。<br/><span class="dim">${escapeHtml(state.lastError || '')}</span>`,
      `<button class="btn primary" data-act="refresh">重试</button>
       <button class="btn" data-act="goto-guide">查看启动方式</button>`), '', 'warn-card')}`;
}

function renderDiagnosisCard(diag, overall) {
  const owner = diag.owner;
  if (!owner) {
    return `
    <section class="diagnosis ok">
      <div class="diag-icon">${icons.checkCircle}</div>
      <div>
        <h2>${escapeHtml(diag.headline || '暂无截断')}</h2>
        <p>${escapeHtml(diag.detail || '流式响应都完整收尾，tool_use JSON 没有残缺。')}</p>
      </div>
    </section>`;
  }
  const cls = owner === 'model' ? 'warn' : owner === 'local' ? 'info' : 'error';
  const reasons = overall.truncation_reasons || [];
  return `
  <section class="diagnosis ${cls}">
    <div class="diag-icon">${icons[OWNER_ICON[owner]] || icons.alert}</div>
    <div class="diag-main">
      <div class="diag-title">
        <h2>${escapeHtml(diag.headline)}</h2>
        <span class="chip ${cls}">${OWNER_LABEL[owner] || owner}</span>
      </div>
      <p>${escapeHtml(diag.detail)}</p>
      ${reasons.length ? `
      <div class="reason-list">
        ${reasons.slice(0, 4).map((r) => `
          <div class="reason-row">
            <span class="rr-owner ${r.owner}">${OWNER_LABEL[r.owner] || r.owner}</span>
            <span class="rr-label">${escapeHtml(r.label)}</span>
            <span class="rr-bar"><i class="${r.owner}" style="width:${Math.max(3, r.ratio)}%"></i></span>
            <span class="rr-count mono">${num(r.count)} · ${pct(r.ratio)}</span>
          </div>`).join('')}
      </div>` : ''}
    </div>
  </section>`;
}

function modelCard(m) {
  const h = m.health || { level: 'ok', score: 100, hint: '' };
  const rate = Number(m.truncation_rate || 0);
  const cls = RATE_CLASS(rate);
  return `
  <button class="model-card" data-model="${escapeHtml(m.model)}">
    <div class="mc-head">
      <span class="dot ${escapeHtml(h.level)}"></span>
      <span class="mc-name" title="${escapeHtml(m.model)}">${escapeHtml(m.model)}</span>
      <span class="mc-req mono">${num(m.requests)} 次</span>
    </div>
    <div class="mc-rate ${cls}">
      <span class="mcr-value">${pct(rate)}</span>
      <span class="mcr-label">截断率 ${num(m.truncated)}/${num(m.requests)}</span>
    </div>
    <div class="meter"><i class="${cls}" style="width:${Math.max(4, Math.min(100, rate))}%"></i></div>
    <div class="mc-foot">
      <span>${pct(m.success_rate)} 成功</span>
      <span>${ms(m.avg_latency_ms)}</span>
    </div>
    ${h.hint ? `<div class="mc-hint">${escapeHtml(h.hint)}</div>` : '<div class="mc-hint dim">暂无截断</div>'}
  </button>`;
}

function renderReasonBreakdown(overall) {
  const reasons = overall.truncation_reasons || [];
  if (!reasons.length) {
    return card('截断原因', '按责任侧归类',
      emptyState(icons.checkCircle, '没有截断记录',
        '所有流式响应都完整收尾。一旦出现 could not be parsed as JSON，这里会说明是谁的问题。'));
  }
  const owners = overall.truncation_owners || {};
  const total = Object.values(owners).reduce((a, b) => a + b, 0) || 1;
  return card('截断原因', '按责任侧归类', `
    <div class="owner-split">
      ${['model', 'gateway', 'local'].map((k) => `
        <div class="owner-slice ${k}">
          <span class="os-label">${OWNER_LABEL[k]}</span>
          <span class="os-count mono">${num(owners[k] || 0)}</span>
          <span class="os-pct">${pct(((owners[k] || 0) * 100) / total)}</span>
        </div>`).join('')}
    </div>
    <div class="owner-track">
      ${['model', 'gateway', 'local'].map((k) => `
        <i class="${k}" style="width:${((owners[k] || 0) * 100) / total}%"></i>`).join('')}
    </div>
    <table class="table">
      <thead><tr><th>原因</th><th>责任侧</th><th class="num">次数</th><th class="num">占比</th></tr></thead>
      <tbody>
        ${reasons.map((r) => `
          <tr>
            <td>${escapeHtml(r.label)}</td>
            <td>${ownerTag(r.owner)}</td>
            <td class="num mono">${num(r.count)}</td>
            <td class="num mono">${pct(r.ratio)}</td>
          </tr>`).join('')}
      </tbody>
    </table>`);
}

function renderRecentTruncations() {
  const items = (state.stats?.recent_truncations || []);
  if (!items.length) return '';
  return card('最近截断', '点「抓包」可看完整请求/响应',
    `<table class="table">
      <thead><tr><th>时间</th><th>模型</th><th>责任侧</th><th>原因</th><th></th></tr></thead>
      <tbody>${items.map((t) => `
        <tr>
          <td class="mono dim">${timeOf(t.time)}</td>
          <td>${escapeHtml(t.model || '—')}</td>
          <td>${ownerTag(t.owner)}</td>
          <td>${escapeHtml(t.reason_label || t.reason || '')}</td>
          <td class="num"><button class="link-btn" data-capture="${escapeHtml(t.id)}">查看抓包</button></td>
        </tr>`).join('')}</tbody>
    </table>`);
}

/* --------------------------------------------------------------- models */

export function renderModels() {
  const stats = state.stats;
  const models = stats?.models || [];
  if (!models.length) {
    return `${pageHead('模型', '按模型看截断率、延迟与上下文增长')}
      ${card('模型', '', emptyState(icons.cpu, '还没有模型流量',
        '模型卡片完全由流量中的 model 字段聚合，任何上游的任何模型都会自动出现。',
        `<button class="btn primary" data-act="goto-guide">查看接入指引</button>`))}`;
  }
  const name = currentModel();
  const model = models.find((m) => m.model === name) || models[0];
  const h = model.health || {};
  const rate = Number(model.truncation_rate || 0);
  const cls = RATE_CLASS(rate);
  const owner = maxOwner(model.truncation_owners || {});
  const reasons = model.truncation_reasons || [];

  return `
  ${pageHead('模型', '左侧选择模型，右侧是该模型的完整证据链')}
  <div class="split">
    <aside class="split-rail">
      ${models.map((m) => {
        const r = Number(m.truncation_rate || 0);
        return `
        <button class="rail-item${m.model === model.model ? ' active' : ''}" data-model="${escapeHtml(m.model)}">
          <span class="dot ${escapeHtml((m.health || {}).level || 'ok')}"></span>
          <span class="ri-name" title="${escapeHtml(m.model)}">${escapeHtml(m.model)}</span>
          <span class="ri-rate ${RATE_CLASS(r)}">${pct(r)}</span>
        </button>`;
      }).join('')}
    </aside>
    <div class="split-main">
      <section class="card model-detail">
        <div class="card-head">
          <div class="card-title">
            <h2 title="${escapeHtml(model.model)}">${escapeHtml(model.model)}</h2>
            <span class="chip ${h.level === 'ok' ? 'ok' : h.level === 'warn' ? 'warn' : 'error'}">${
              h.level === 'ok' ? '健康' : h.level === 'warn' ? '需关注' : '异常'
            }</span>
          </div>
          <div class="card-actions mono dim">健康度 ${h.score ?? '—'} · ${num(model.requests)} 次请求</div>
        </div>
        <div class="card-body">
          <div class="model-hero ${cls}">
            <div class="mh-rate">
              <span class="mh-value">${pct(rate)}</span>
              <span class="mh-label">截断率</span>
              <span class="mh-sub">${num(model.truncated)} / ${num(model.requests)} 次</span>
            </div>
            ${metricGrid([
              ['成功率', pct(model.success_rate)],
              ['重试成功', pct(model.retry_success_rate)],
              ['平均延迟', ms(model.avg_latency_ms)],
              ['P95 延迟', ms(model.p95_latency_ms)],
              ['输入 token', compact(model.input_tokens)],
              ['输出 token', compact(model.output_tokens)],
            ])}
          </div>
          ${h.hint ? `<div class="verdict ${cls}">${escapeHtml(h.hint)}</div>` : ''}
        </div>
      </section>

      ${reasons.length ? `
      <section class="card">
        <div class="card-head"><div class="card-title"><h2>归因</h2>
          <span class="card-sub">${OWNER_LABEL[owner] || '—'}为主 · ${num(model.truncated)} 次截断</span></div></div>
        <div class="card-body">
          <div class="reason-list">
            ${reasons.map((r) => `
              <div class="reason-row">
                <span class="rr-owner ${r.owner}">${OWNER_LABEL[r.owner] || r.owner}</span>
                <span class="rr-label">${escapeHtml(r.label)}</span>
                <span class="rr-bar"><i class="${r.owner}" style="width:${Math.max(3, r.ratio)}%"></i></span>
                <span class="rr-count mono">${num(r.count)} · ${pct(r.ratio)}</span>
              </div>`).join('')}
          </div>
          <div class="advice">${escapeHtml(ADVICE(owner))}</div>
        </div>
      </section>` : ''}

      <section class="card">
        <div class="card-head">
          <div class="card-title"><h2>上下文增长</h2><span class="card-sub">input + cache tokens</span></div>
          <div class="card-actions">
            <span class="legend"><i></i>input</span>
            <span class="legend cache"><i></i>cache</span>
            <span class="legend cut"><i></i>截断</span>
          </div>
        </div>
        <div class="card-body"><div class="chart-host" id="chart-host"><div class="chart-tip" id="chart-tip"></div></div></div>
      </section>

      <section class="card">
        <div class="card-head">
          <div class="card-title"><h2>截断事件</h2><span class="card-sub">展开可见残缺 tool_use JSON</span></div>
          <div class="card-actions"><span class="chip">${num(model.truncated)} 次</span></div>
        </div>
        <div class="card-body"><div class="trunc-list" id="trunc-list"></div></div>
      </section>

      <section class="card">
        <div class="card-head">
          <div class="card-title"><h2>用量统计</h2></div>
          <div class="card-actions">
            <div class="seg" id="gran-seg">
              ${['day', 'week', 'month'].map((g) => `<button data-gran="${g}" class="${state.gran === g ? 'active' : ''}">${
                { day: '日', week: '周', month: '月' }[g]}</button>`).join('')}
            </div>
          </div>
        </div>
        <div class="card-body tight"><div id="buckets-wrap"></div></div>
      </section>

      <section class="card">
        <div class="card-head"><div class="card-title"><h2>最近请求</h2></div>
          <div class="card-actions"><span class="chip" id="recent-count">—</span></div></div>
        <div class="card-body tight"><div id="recent-wrap"></div></div>
      </section>
    </div>
  </div>`;
}

function maxOwner(owners) {
  return ['model', 'gateway', 'local'].reduce((best, k) => (owners[k] > (owners[best] || 0) ? k : best), 'model');
}

function ADVICE(owner) {
  return {
    model: '模型在输出工具调用时被截断或生成了非法 JSON。先提高 max_tokens，再考虑降低温度、缩小工具 schema，或换一个模型对比同一批请求。',
    gateway: '截断发生在流结束前，请求没有正常收尾。优先检查上游/网关的流式支持、空闲超时与 5xx；换直连对比可以快速定位。',
    local: '客户端或本地链路主动断开。检查代理超时、编辑器/IDE 卡顿，以及本机网络是否在长流式响应中途中断。',
  }[owner] || '';
}

export function renderTruncations(host) {
  if (!host) return;
  const items = state.detail.truncations || [];
  if (!items.length) {
    host.innerHTML = `<div class="empty-inline">该模型暂无 tool_use 截断记录</div>`;
    return;
  }
  const expanded = state.expanded || (state.expanded = new Set());
  host.innerHTML = items.map((t) => {
    const open = expanded.has(t.id);
    const calls = t.truncation?.tool_calls || [];
    const frag = calls.map((c) => `#${c.index} ${c.name || '(未命名工具)'} ${c.id || ''}\n${c.fragment || '(空片段)'}`).join('\n\n');
    const owner = t.owner || 'gateway';
    return `
    <div class="trunc-item${open ? ' open' : ''}" data-tid="${escapeHtml(t.id)}">
      <button class="trunc-row">
        <span class="mono dim">${timeOf(t.time)}</span>
        <span class="owner-tag ${owner}">${OWNER_LABEL[owner] || owner}</span>
        <span class="tn">${escapeHtml(calls.map((c) => c.name).filter(Boolean).join(', ') || 'tool_use')}</span>
        <span class="tr">${escapeHtml(t.reason_label || t.reason || '')}</span>
        <span class="caret">${icons.chevron}</span>
      </button>
      <div class="trunc-detail">
        <pre class="frag">${escapeHtml(frag || '(无片段)')}</pre>
        <div class="frag-meta">
          <span>${escapeHtml(t.model || '')}</span>
          <span>${escapeHtml(t.path || '')}</span>
          <span>${escapeHtml(t.session || '无 session')}</span>
          <span>HTTP ${escapeHtml(String(t.status ?? '—'))}</span>
          <span class="mono dim">${escapeHtml(t.reason || '')}</span>
          <button class="link-btn" data-capture="${escapeHtml(t.id)}">看完整抓包</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

export function renderBucketsTable(host) {
  if (!host) return;
  const all = state.detail.buckets || [];
  if (!all.length) {
    host.innerHTML = `<div class="empty-inline">暂无数据</div>`;
    return;
  }
  // The API returns oldest-first for charting; this table reads newest-first.
  // Empty buckets are dropped so a new install does not show 29 rows of zeros.
  const active = all.filter((r) => (r.requests || 0) > 0).reverse();
  if (!active.length) {
    host.innerHTML = `<div class="empty-inline">这段时间还没有流量</div>`;
    return;
  }
  const today = bucketLabelNow(state.gran);
  // Buckets carry an average latency, not a duration sum, so rebuild the
  // weighted total from average × requests before averaging again.
  const total = active.reduce((acc, r) => {
    for (const key of ['requests', 'success', 'failed', 'truncated', 'input_tokens', 'output_tokens']) {
      acc[key] += Number(r[key] || 0);
    }
    acc.duration_ms += Number(r.avg_latency_ms || 0) * Number(r.requests || 0);
    return acc;
  }, { requests: 0, success: 0, failed: 0, truncated: 0, input_tokens: 0, output_tokens: 0, duration_ms: 0 });
  const avg = total.requests ? total.duration_ms / total.requests : 0;

  host.innerHTML = `
    <div class="table-wrap">
    <table class="table">
      <thead><tr>
        <th>${state.gran === 'day' ? '日期' : state.gran === 'week' ? '起始周' : '月份'}</th>
        <th class="num">请求</th><th class="num">成功</th><th class="num">失败</th>
        <th class="num">截断</th><th class="num">输入</th><th class="num">输出</th><th class="num">平均延迟</th>
      </tr></thead>
      <tbody>${active.map((r) => `
        <tr${r.label === today ? ' class="today"' : ''}>
          <td class="mono">${escapeHtml(r.label)}${r.label === today ? '<span class="today-tag">今天</span>' : ''}</td>
          <td class="num">${num(r.requests)}</td>
          <td class="num">${num(r.success)}</td>
          <td class="num ${r.failed ? 'bad' : 'dim'}">${r.failed ? num(r.failed) : '—'}</td>
          <td class="num ${r.truncated ? 'warn-c' : 'dim'}">${r.truncated ? num(r.truncated) : '—'}</td>
          <td class="num">${compact(r.input_tokens)}</td>
          <td class="num">${compact(r.output_tokens)}</td>
          <td class="num">${ms(r.avg_latency_ms)}</td>
        </tr>`).join('')}
      </tbody>
      <tfoot><tr class="total-row">
        <td class="mono">合计 · ${active.length} ${state.gran === 'day' ? '天' : state.gran === 'week' ? '周' : '月'}</td>
        <td class="num">${num(total.requests)}</td>
        <td class="num">${num(total.success)}</td>
        <td class="num ${total.failed ? 'bad' : 'dim'}">${total.failed ? num(total.failed) : '—'}</td>
        <td class="num ${total.truncated ? 'warn-c' : 'dim'}">${total.truncated ? num(total.truncated) : '—'}</td>
        <td class="num">${compact(total.input_tokens)}</td>
        <td class="num">${compact(total.output_tokens)}</td>
        <td class="num">${ms(avg)}</td>
      </tr></tfoot>
    </table>
    </div>`;
}

/** Today's bucket label, matching the proxy's label_of() formats. */
function bucketLabelNow(gran) {
  const d = new Date();
  if (gran === 'month') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const mmdd = (x) => `${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  if (gran === 'week') {
    // Buckets start on Monday, as in proxy/ccp/stats.py.
    return `${mmdd(new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7)))} 周`;
  }
  return mmdd(d);
}

export function renderRecentTable(host) {
  if (!host) return;
  const rows = state.detail.recent || [];
  const count = document.getElementById('recent-count');
  if (count) count.textContent = `${rows.length} 条`;
  if (!rows.length) {
    host.innerHTML = `<div class="empty-inline">暂无请求</div>`;
    return;
  }
  host.innerHTML = `
    <table class="table">
      <thead><tr>
        <th>时间</th><th>状态</th><th class="num">尝试</th><th class="num">耗时</th>
        <th class="num">输入</th><th class="num">输出</th><th>协议</th><th>截断</th><th></th>
      </tr></thead>
      <tbody>${rows.map((r) => {
        const st = r.truncated ? ['warn', '截断'] : !r.ok ? ['error', String(r.status || '失败')]
          : r.retried_ok ? ['warn', '重试成功'] : ['ok', String(r.status || 200)];
        return `
        <tr>
          <td class="mono dim">${timeOf(r.time)}</td>
          <td><span class="tag ${st[0]}">${escapeHtml(st[1])}</span></td>
          <td class="num">${num(r.attempts)}</td>
          <td class="num">${ms(r.duration_ms)}</td>
          <td class="num">${num(r.input_tokens)}</td>
          <td class="num">${num(r.output_tokens)}</td>
          <td><span class="proto">${escapeHtml(r.protocol || '—')}</span></td>
          <td>${r.truncated ? '<span class="tag warn">截断</span>' : '<span class="dim">—</span>'}</td>
          <td class="num"><button class="link-btn" data-capture="${escapeHtml(r.id)}">抓包</button></td>
        </tr>`;
      }).join('')}</tbody>
    </table>`;
}
