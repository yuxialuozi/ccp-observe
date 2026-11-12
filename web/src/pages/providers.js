import { icons } from '../icons.js';
import { api } from '../api.js';
import { state, saveConfig, setNotice } from '../store.js';
import { pageHead, card, emptyState, note, ownerTag } from '../ui.js';
import { escapeHtml, pct, num } from '../format.js';

const PROTOCOLS = [
  ['auto', '自动（跟随客户端）'],
  ['anthropic', 'Anthropic Messages'],
  ['openai', 'OpenAI Chat Completions'],
];

function blankProvider() {
  return {
    id: '', name: '', protocol: 'auto', base_url: '', auth_header: '',
    models: [], enabled: true, note: '',
  };
}

export function renderProviders() {
  const cfg = state.config || {};
  const providers = cfg.providers || [];
  const editing = state.editingProvider;
  const source = providers.length ? 'provider' : (cfg.upstream ? 'legacy' : 'none');

  return `
  ${pageHead('供应商', '上游地址、协议与鉴权都在这里管理，支持任意供应商',
    `<button class="btn primary" data-act="provider-new">${icons.plus}<span>新增供应商</span></button>`)}
  ${source === 'legacy' ? note('warn', icons.alert,
    '当前仍在用旧版单上游配置（设置页里的「上游地址」）。新增供应商并设为默认后，旧配置会自动退居兜底。') : ''}
  ${source === 'none' ? note('warn', icons.alert,
    '还没有任何上游。新增一个供应商后，把客户端指向本代理即可开始观测。') : ''}

  ${editing ? renderEditor(editing) : ''}

  ${providers.length ? `
  <div class="provider-grid">
    ${providers.map((p) => providerCard(p, cfg.default_provider === p.id)).join('')}
  </div>` : (editing ? '' : card('供应商', '', emptyState(icons.server, '还没有供应商',
    'ccp-observe 不绑定任何供应商：每家一个卡片，写上基址和鉴权头即可。',
    `<button class="btn primary" data-act="provider-new">新增供应商</button>`)))}
  `;
}

function providerCard(p, isDefault) {
  const models = p.models || [];
  const protoLabel = { auto: '自动', anthropic: 'Anthropic', openai: 'OpenAI' }[p.protocol] || p.protocol;
  return `
  <section class="card provider-card${p.enabled ? '' : ' disabled'}">
    <div class="card-head">
      <div class="card-title">
        <span class="dot ${p.enabled ? 'ok' : 'muted'}"></span>
        <h2 title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</h2>
        ${isDefault ? '<span class="chip ok">默认</span>' : ''}
        ${p.enabled ? '' : '<span class="chip">已停用</span>'}
      </div>
      <div class="card-actions">
        <button class="icon-btn" data-act="provider-test" data-id="${escapeHtml(p.id)}" title="测试连通性">${icons.plug}</button>
        <button class="icon-btn" data-act="provider-edit" data-id="${escapeHtml(p.id)}" title="编辑">${icons.gear}</button>
        <button class="icon-btn danger" data-act="provider-del" data-id="${escapeHtml(p.id)}" title="删除">${icons.trash}</button>
      </div>
    </div>
    <div class="card-body">
      <div class="kv"><span class="k">基址</span><span class="v mono" title="${escapeHtml(p.base_url)}">${escapeHtml(p.base_url || '—')}</span></div>
      <div class="kv"><span class="k">协议</span><span class="v">${protoLabel}${p.protocol !== 'auto' ? '' : ' <span class="dim">（跟随客户端）</span>'}</span></div>
      <div class="kv"><span class="k">鉴权</span><span class="v mono dim">${p.auth_header ? '已配置（不回显）' : '透传客户端'}</span></div>
      ${models.length ? `<div class="kv"><span class="k">模型</span><span class="v">${models.map((m) => `<span class="chip mono">${escapeHtml(m)}</span>`).join(' ')}</span></div>`
        : `<div class="kv"><span class="k">模型</span><span class="v dim">由路由规则决定</span></div>`}
      ${p.note ? `<div class="kv"><span class="k">备注</span><span class="v dim">${escapeHtml(p.note)}</span></div>` : ''}
      <div class="provider-foot">
        ${isDefault ? '<span class="dim">所有未命中路由的请求走这里</span>'
          : `<button class="link-btn" data-act="provider-default" data-id="${escapeHtml(p.id)}">设为默认</button>`}
        <span class="spacer"></span>
        <button class="link-btn" data-act="provider-toggle" data-id="${escapeHtml(p.id)}">${p.enabled ? '停用' : '启用'}</button>
      </div>
      <div class="probe-slot" id="probe-${escapeHtml(p.id)}"></div>
    </div>
  </section>`;
}

function renderEditor(p) {
  const isNew = !p.id;
  return `
  <section class="card editor">
    <div class="card-head">
      <div class="card-title"><h2>${isNew ? '新增供应商' : '编辑供应商'}</h2>
        <span class="card-sub">鉴权头格式：<code>Authorization: Bearer 你的 key</code></span></div>
      <div class="card-actions">
        <button class="btn sm ghost" data-act="provider-cancel">取消</button>
      </div>
    </div>
    <div class="card-body">
      <div class="form-grid">
        <label class="field">
          <span>名称</span>
          <input type="text" data-field="name" value="${escapeHtml(p.name)}" placeholder="例如 我的网关 A" />
          <em>面板与路由里显示的名字，可随时改。</em>
        </label>
        <label class="field">
          <span>协议</span>
          <select data-field="protocol">
            ${PROTOCOLS.map(([v, label]) => `<option value="${v}" ${p.protocol === v ? 'selected' : ''}>${label}</option>`).join('')}
          </select>
          <em>「自动」表示上游说客户端同一种协议；选具体协议时，若与客户端不同会自动做格式转换。</em>
        </label>
      </div>
      <label class="field">
        <span>基址</span>
        <input type="text" data-field="base_url" value="${escapeHtml(p.base_url)}" placeholder="https://example.internal/v1" />
        <em>填写到 <code>/v1</code> 为止（也可只写域名）。示例值仅作占位，不含任何真实内网地址。</em>
      </label>
      <label class="field">
        <span>鉴权头</span>
        <input type="text" data-field="auth_header" value="" placeholder="${p.auth_header ? '已配置，留空则保持不变' : 'Authorization: Bearer sk-xxxx'}" />
        <em>格式 <code>头名: 值</code>。配置后代理用它覆盖客户端的同名头，避免把客户端 key 透传给第三方。</em>
      </label>
      <label class="field">
        <span>模型列表 <span class="dim">（可选）</span></span>
        <input type="text" data-field="models" value="${escapeHtml((p.models || []).join(', '))}" placeholder="model-a, model-b, vendor/*" />
        <em>填写后，请求体里的 model 命中这一项就自动路由到这里；留空则只按路由规则匹配。</em>
      </label>
      <label class="field">
        <span>备注</span>
        <input type="text" data-field="note" value="${escapeHtml(p.note || '')}" placeholder="可选" maxlength="200" />
      </label>
      <div class="form-foot">
        <label class="check"><input type="checkbox" data-field="enabled" ${p.enabled ? 'checked' : ''}/> 启用</label>
        <span class="spacer"></span>
        <button class="btn" data-act="provider-probe-new">测试连通性</button>
        <button class="btn primary" data-act="provider-save" data-id="${escapeHtml(p.id)}">保存</button>
      </div>
      <div class="probe-slot" id="probe-editor"></div>
    </div>
  </section>`;
}

/* ------------------------------------------------------------- actions */

export function providerActions(act, el, rerender) {
  const id = el.dataset.id;
  const cfg = state.config || {};
  const providers = cfg.providers || [];

  if (act === 'provider-new') {
    state.editingProvider = blankProvider();
    rerender();
    return true;
  }
  if (act === 'provider-edit') {
    const p = providers.find((x) => x.id === id);
    state.editingProvider = p ? { ...p, auth_header: '' } : blankProvider();
    rerender();
    return true;
  }
  if (act === 'provider-cancel') {
    state.editingProvider = null;
    rerender();
    return true;
  }
  if (act === 'provider-save') {
    saveProvider(el, rerender);
    return true;
  }
  if (act === 'provider-del') {
    const p = providers.find((x) => x.id === id);
    if (!p) return true;
    if (!confirm(`删除供应商「${p.name}」？指向它的路由规则也会一并移除。`)) return true;
    saveConfig({ providers: providers.filter((x) => x.id !== id) }, '已删除').then(rerender);
    return true;
  }
  if (act === 'provider-default') {
    saveConfig({ default_provider: id }, '已设为默认供应商').then(rerender);
    return true;
  }
  if (act === 'provider-toggle') {
    const next = providers.map((x) => (x.id === id ? { ...x, enabled: !x.enabled } : x));
    saveConfig({ providers: next }, '已更新').then(rerender);
    return true;
  }
  if (act === 'provider-test' || act === 'provider-probe-new') {
    probe(el, id, rerender);
    return true;
  }
  return false;
}

function saveProvider(el, rerender) {
  const cardEl = el.closest('.card');
  const read = (name) => {
    const node = cardEl.querySelector(`[data-field="${name}"]`);
    if (!node) return '';
    return node.type === 'checkbox' ? node.checked : node.value;
  };
  const existingId = el.dataset.id || '';
  const cfg = state.config || {};
  const providers = (cfg.providers || []).map((x) => ({ ...x }));

  const models = String(read('models') || '')
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const entry = {
    id: existingId || undefined,
    name: String(read('name') || '').trim(),
    protocol: String(read('protocol') || 'auto'),
    base_url: String(read('base_url') || '').trim(),
    auth_header: String(read('auth_header') || '').trim(),
    models,
    enabled: Boolean(read('enabled')),
    note: String(read('note') || '').trim(),
  };
  if (!entry.name) {
    setNotice('请填写供应商名称', 'error');
    return;
  }
  if (!entry.base_url) {
    setNotice('请填写基址', 'error');
    return;
  }

  let next;
  if (existingId) {
    next = providers.map((p) => {
      if (p.id !== existingId) return p;
      return {
        ...p,
        ...entry,
        id: p.id,
        auth_header: entry.auth_header || p.auth_header, // blank keeps the stored key
      };
    });
  } else {
    next = [...providers, entry];
  }
  saveConfig({ providers: next }, '已保存供应商').then((saved) => {
    state.editingProvider = null;
    const ids = (saved.providers || []).map((p) => p.id);
    if (!saved.default_provider && ids.length) {
      saveConfig({ default_provider: ids[ids.length - 1] }, '已设为默认供应商').then(rerender);
    } else {
      rerender();
    }
  });
}

async function probe(el, id, rerender) {
  const cardEl = el.closest('.card');
  const slot = cardEl.querySelector('.probe-slot');
  const read = (name) => cardEl.querySelector(`[data-field="${name}"]`);
  const cfg = state.config || {};
  const stored = (cfg.providers || []).find((p) => p.id === id);
  const node = read('base_url');
  const payload = node
    ? {
      upstream: String(node.value || '').trim(),
      auth_header: String((read('auth_header') || {}).value || '').trim(),
      protocol: String((read('protocol') || {}).value || 'auto'),
    }
    : { provider: id, protocol: (stored?.protocol || 'auto') };
  if (payload.protocol === 'auto') payload.protocol = 'openai';
  slot.innerHTML = `<div class="probe pending">正在探测…</div>`;
  try {
    const res = await api.testUpstream(payload);
    slot.innerHTML = `<div class="probe ${res.ok ? 'ok' : 'error'}">
      ${res.ok ? '✓ 连通' : '✕ 失败'} · HTTP ${escapeHtml(String(res.status ?? '—'))} · ${escapeHtml(String(res.latency_ms ?? '—'))}ms
      <span class="dim mono">${escapeHtml(res.url || '')}</span>
      ${res.error ? `<span class="dim">${escapeHtml(res.error)}</span>` : ''}
    </div>`;
  } catch (err) {
    slot.innerHTML = `<div class="probe error">✕ ${escapeHtml(err.message)}</div>`;
  }
}
