import { icons } from '../icons.js';
import { state, loadCapture, loadCaptures, setNotice } from '../store.js';
import { pageHead, card, emptyState, note, ownerTag } from '../ui.js';
import { escapeHtml, ms, num, pct, timeOf } from '../format.js';

export function renderCapture() {
  const items = state.captures || [];
  const stats = state.captureStats || {};
  const detail = state.captureDetail;
  const models = state.stats?.models || [];

  return `
  ${pageHead('抓包', `保留最近 ${num(stats.limit || 0)} 次完整请求与响应，鉴权头已脱敏`,
    `<button class="btn" data-act="capture-refresh">${icons.refresh}<span>刷新</span></button>`)}
  <div class="split wide-left">
    <section class="card">
      <div class="card-head">
        <div class="card-title"><h2>请求流</h2>
          <span class="card-sub">${num(items.length)} 条 · 上限 ${num(stats.captured || 0)}/${num(stats.limit || 0)}</span></div>
        <div class="card-actions">
          <select id="cap-model" class="select-sm">
            <option value="">全部模型</option>
            ${models.map((m) => `<option value="${escapeHtml(m.model)}" ${state.captureModel === m.model ? 'selected' : ''}>${escapeHtml(m.model)}</option>`).join('')}
          </select>
          <label class="check sm"><input type="checkbox" id="cap-trunc" ${state.captureTruncated ? 'checked' : ''}/> 仅截断</label>
        </div>
      </div>
      <div class="card-body tight">
        ${items.length ? `
        <table class="table capture-table">
          <thead><tr>
            <th>时间</th><th>模型</th><th>供应商</th><th class="num">状态</th>
            <th class="num">耗时</th><th>协议</th><th>截断</th>
          </tr></thead>
          <tbody>
            ${items.map((c) => `
              <tr class="cap-row${state.captureId === c.id ? ' active' : ''}" data-capture="${escapeHtml(c.id)}">
                <td class="mono dim">${timeOf(c.time)}</td>
                <td title="${escapeHtml(c.model || '')}">${escapeHtml(short(c.model))}</td>
                <td class="dim" title="${escapeHtml(c.provider_name || '')}">${escapeHtml(c.provider_name || '旧版上游')}</td>
                <td class="num"><span class="tag ${c.ok ? 'ok' : 'error'}">${escapeHtml(String(c.status ?? '—'))}</span></td>
                <td class="num">${ms(c.duration_ms)}</td>
                <td>
                  <span class="proto">${escapeHtml(c.protocol || '—')}</span>
                  ${c.translated ? `<span class="chip xs" title="代理做了协议转换">⇄ ${escapeHtml(c.upstream_protocol || '')}</span>` : ''}
                </td>
                <td>${c.truncated ? `<span class="tag warn">${escapeHtml(c.reason || '截断')}</span>` : '<span class="dim">—</span>'}</td>
              </tr>`).join('')}
          </tbody>
        </table>` : emptyState(icons.braces, '还没有抓包记录',
          '任何经过代理的请求都会记下完整请求/响应，包括残缺的 tool_use JSON。发一条请求即可看到。')}
      </div>
    </section>

    <section class="card">
      <div class="card-head">
        <div class="card-title"><h2>请求详情</h2>
          <span class="card-sub">${detail ? escapeHtml(detail.id) : '从左侧选择一条记录'}</span></div>
      </div>
      <div class="card-body">${detail ? renderDetail(detail) : `<div class="empty-inline">选择左侧任意一条请求查看完整报文。</div>`}</div>
    </section>
  </div>`;
}

function short(name) {
  const s = String(name || '—');
  return s.length > 22 ? `${s.slice(0, 14)}…${s.slice(-6)}` : s;
}

function renderDetail(d) {
  const req = d.request || {};
  const resp = d.response || {};
  const truncCalls = (d.truncated && d.reason) ? collectFragments(d) : [];
  return `
  <div class="cap-meta">
    <div class="kv"><span class="k">时间</span><span class="v mono">${timeOf(d.time)}</span></div>
    <div class="kv"><span class="k">模型</span><span class="v">${escapeHtml(d.model || '—')}</span></div>
    <div class="kv"><span class="k">供应商</span><span class="v">${escapeHtml(d.provider_name || '旧版上游')}</span></div>
    <div class="kv"><span class="k">路径</span><span class="v mono">${escapeHtml(d.path || '')}</span></div>
    <div class="kv"><span class="k">状态</span><span class="v"><span class="tag ${d.ok ? 'ok' : 'error'}">${escapeHtml(String(d.status ?? '—'))}</span>
      ${num(d.attempts)} 次尝试 · ${ms(d.duration_ms)}</span></div>
    <div class="kv"><span class="k">协议</span><span class="v mono">${escapeHtml(d.protocol || '')}${
      d.translated ? ` → ${escapeHtml(d.upstream_protocol || '')}（已转换）` : ''}</span></div>
    ${d.truncated ? `<div class="kv"><span class="k">截断</span><span class="v">${ownerTag(d.owner)}
      <span class="dim">${escapeHtml(d.reason || '')}</span></span></div>` : ''}
    ${d.error ? `<div class="kv"><span class="k">错误</span><span class="v bad">${escapeHtml(d.error)}</span></div>` : ''}
  </div>

  ${truncCalls.length ? `
  <div class="cap-section">
    <div class="cap-section-head">残缺的 tool_use 片段</div>
    ${truncCalls.map((c) => `
      <pre class="frag">#${c.index} ${escapeHtml(c.name || '(未命名工具)')} ${escapeHtml(c.id || '')}
${escapeHtml(c.fragment || '(空片段)')}</pre>`).join('')}
  </div>` : ''}

  <div class="cap-section">
    <div class="cap-section-head">
      请求 <span class="dim">${num(req.bytes || 0)} B${req.truncated ? ' · 已截断显示' : ''}</span>
      <span class="spacer"></span>
      <button class="link-btn" data-action="copy-capture" data-copy="${escapeHtml(d.id)}-req">复制</button>
    </div>
    <pre class="code" id="cap-req">${escapeHtml(req.text || '(空请求体)')}</pre>
    <details class="cap-headers"><summary>请求头</summary>
      <pre class="code sm">${escapeHtml(headersText(req.headers))}</pre></details>
  </div>

  <div class="cap-section">
    <div class="cap-section-head">
      响应 <span class="dim">${num(resp.bytes || 0)} B${resp.truncated ? ' · 已截断显示' : ''}</span>
    </div>
    <pre class="code" id="cap-resp">${escapeHtml(resp.text || '(空响应体)')}</pre>
    <details class="cap-headers"><summary>响应头</summary>
      <pre class="code sm">${escapeHtml(headersText(resp.headers))}</pre></details>
  </div>`;
}

function headersText(headers) {
  return Object.entries(headers || {}).map(([k, v]) => `${k}: ${v}`).join('\n') || '(无)';
}

function collectFragments(d) {
  // The ledger keeps the structured truncation; the capture keeps the bytes.
  // Prefer the structured one so the panel shows the same thing as the model page.
  const item = (state.detail.truncations || []).find((t) => t.id === d.id);
  return item?.truncation?.tool_calls || [];
}

export function captureActions(act, el, rerender) {
  if (act === 'capture-refresh') {
    loadCaptures().then(rerender);
    return true;
  }
  if (act === 'copy-capture') {
    const id = el.dataset.copy || '';
    const which = id.endsWith('-req') ? 'cap-req' : 'cap-resp';
    const node = document.getElementById(which);
    if (node) {
      navigator.clipboard?.writeText(node.textContent).then(
        () => setNotice('已复制', 'ok'), () => setNotice('复制失败', 'error'));
    }
    return true;
  }
  return false;
}

/** Row clicks are handled by main.js so both pages share the binding. */
export async function openCapture(id, rerender) {
  await loadCapture(id);
  rerender();
}
