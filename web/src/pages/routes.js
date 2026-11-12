import { icons } from '../icons.js';
import { state, saveConfig, setNotice, previewRoute } from '../store.js';
import { pageHead, card, emptyState, note } from '../ui.js';
import { escapeHtml, num } from '../format.js';

const SOURCE_LABEL = {
  rule: '路由规则命中',
  models: '供应商模型列表命中',
  default: '默认供应商',
  legacy: '旧版单上游配置',
  none: '没有可用上游',
};

export function renderRoutes() {
  const cfg = state.config || {};
  const providers = cfg.providers || [];
  const routes = cfg.routes || [];
  const preview = state.routePreview;
  const providerName = (id) => (providers.find((p) => p.id === id) || {}).name || id || '—';

  return `
  ${pageHead('路由', '按模型名或路径把请求分到不同供应商，规则自上而下匹配',
    `<button class="btn" data-act="route-export">导出规则</button>`)}

  ${providers.length ? '' : note('warn', icons.alert,
    '还没有供应商。先到「供应商」页添加至少一个上游，否则请求无处可去。')}

  <div class="split wide-left">
    <section class="card">
      <div class="card-head">
        <div class="card-title"><h2>规则</h2><span class="card-sub">改完即时生效</span></div>
        <div class="card-actions"><span class="chip">${routes.length} 条</span></div>
      </div>
      <div class="card-body tight">
        ${routes.length ? `
        <table class="table">
          <thead><tr><th style="width:34px">#</th><th>匹配</th><th>目标供应商</th><th style="width:88px"></th></tr></thead>
          <tbody>
            ${routes.map((r, i) => `
              <tr>
                <td class="dim mono">${i + 1}</td>
                <td class="mono">${escapeHtml(r.match)}
                  <span class="dim">${r.match.startsWith('/') ? '路径' : '模型'}</span></td>
                <td>${escapeHtml(providerName(r.provider))}</td>
                <td class="num nowrap">
                  <button class="icon-btn sm" data-act="route-up" data-idx="${i}" title="上移">↑</button>
                  <button class="icon-btn sm" data-act="route-down" data-idx="${i}" title="下移">↓</button>
                  <button class="icon-btn sm danger" data-act="route-del" data-idx="${i}" title="删除">${icons.trash}</button>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>` : `<div class="empty-inline">还没有规则，所有请求会走默认供应商。</div>`}
        <div class="route-add">
          <input type="text" id="route-match" placeholder="模型通配（如 vendor/*）或路径（/v1/messages）" />
          <select id="route-provider">
            <option value="">选择供应商…</option>
            ${providers.map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`).join('')}
          </select>
          <button class="btn primary" data-act="route-add">${icons.plus}<span>添加</span></button>
        </div>
        <div class="hint-line">匹配规则：<code>*</code> 任意字符，<code>vendor/*</code> 前缀匹配；以 <code>/</code> 开头则按请求路径匹配。</div>
      </div>
    </section>

    <section class="card">
      <div class="card-head">
        <div class="card-title"><h2>命中预演</h2><span class="card-sub">按真实决策逻辑跑一遍</span></div>
      </div>
      <div class="card-body">
        <div class="preview-form">
          <label class="field"><span>模型名</span>
            <input type="text" id="route-model" value="${escapeHtml(state.routeModel || '')}" placeholder="例如 vendor/model-x" />
          </label>
          <label class="field"><span>客户端协议</span>
            <select id="route-protocol">
              <option value="anthropic" ${state.routeProtocol === 'anthropic' ? 'selected' : ''}>Anthropic</option>
              <option value="openai" ${state.routeProtocol === 'openai' ? 'selected' : ''}>OpenAI</option>
            </select>
          </label>
          <button class="btn primary" data-act="route-preview">预演</button>
        </div>
        ${renderPreview(preview, providerName)}
        <div class="kv-list">
          <div class="kv"><span class="k">默认供应商</span><span class="v">${
            cfg.default_provider ? escapeHtml(providerName(cfg.default_provider)) : '<span class="dim">未设置</span>'}</span></div>
          <div class="kv"><span class="k">协议转换</span><span class="v">${
            cfg.translate ? '开启 · 上游协议与客户端不同时自动转换' : '关闭 · 只做透传'}</span></div>
        </div>
      </div>
    </section>
  </div>

  ${card('匹配顺序', '', `
    <ol class="order-list">
      <li><b>路由规则</b> 自上而下，第一条命中的生效。</li>
      <li><b>供应商模型列表</b> 请求里的 model 精确命中某个供应商的列表。</li>
      <li><b>默认供应商</b> 以上都没命中时兜底。</li>
      <li><b>旧版单上游</b> 没有任何供应商时的兼容路径。</li>
    </ol>`)}
  `;
}

function renderPreview(p, providerName) {
  if (!p) return `<div class="empty-inline">输入模型名后点「预演」，可以看到请求会落到哪个供应商、是否需要改写协议。</div>`;
  if (p.error) return `<div class="preview-box error">${escapeHtml(p.error)}</div>`;
  const none = p.source === 'none';
  return `
  <div class="preview-box ${none ? 'error' : 'ok'}">
    <div class="pv-row"><span class="pv-k">决策</span><span class="pv-v">
      <b>${escapeHtml(SOURCE_LABEL[p.source] || p.source || '—')}</b>
      ${p.matched ? `<span class="dim mono">· ${escapeHtml(p.matched)}</span>` : ''}</span></div>
    <div class="pv-row"><span class="pv-k">供应商</span><span class="pv-v">${
      p.provider_id ? escapeHtml(providerName(p.provider_id)) : '<span class="dim">无（旧版上游或无上游）</span>'}</span></div>
    <div class="pv-row"><span class="pv-k">上游地址</span><span class="pv-v mono">${escapeHtml(p.base_url || '—')}</span></div>
    <div class="pv-row"><span class="pv-k">上游协议</span><span class="pv-v mono">${escapeHtml(p.upstream_protocol || '—')}</span></div>
    <div class="pv-row"><span class="pv-k">格式转换</span><span class="pv-v">${
      p.translate ? '是 · 请求与响应都会转换' : '否 · 原样透传'}</span></div>
  </div>`;
}

export function routeActions(act, el, rerender) {
  const cfg = state.config || {};
  const routes = (cfg.routes || []).map((r) => ({ ...r }));
  const idx = el.dataset.idx !== undefined ? Number(el.dataset.idx) : -1;

  if (act === 'route-add') {
    const match = (document.getElementById('route-match')?.value || '').trim();
    const provider = document.getElementById('route-provider')?.value || '';
    if (!match) return setNotice('请填写匹配模式', 'error'), true;
    if (!provider) return setNotice('请选择目标供应商', 'error'), true;
    routes.push({ match, provider });
    saveConfig({ routes }, '已添加规则').then(rerender);
    return true;
  }
  if (act === 'route-del' && idx >= 0) {
    routes.splice(idx, 1);
    saveConfig({ routes }, '已删除规则').then(rerender);
    return true;
  }
  if ((act === 'route-up' || act === 'route-down') && idx >= 0) {
    const to = act === 'route-up' ? idx - 1 : idx + 1;
    if (to < 0 || to >= routes.length) return true;
    const [item] = routes.splice(idx, 1);
    routes.splice(to, 0, item);
    saveConfig({ routes }, '已调整顺序').then(rerender);
    return true;
  }
  if (act === 'route-preview') {
    state.routeModel = document.getElementById('route-model')?.value || '';
    state.routeProtocol = document.getElementById('route-protocol')?.value || 'anthropic';
    previewRoute().then(rerender);
    return true;
  }
  if (act === 'route-export') {
    const text = routes.map((r) => `${r.match}=${r.provider}`).join('\n');
    navigator.clipboard?.writeText(text).then(
      () => setNotice('规则已复制到剪贴板', 'ok'),
      () => setNotice('复制失败', 'error')
    );
    return true;
  }
  return false;
}
