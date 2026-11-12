import { icons } from '../icons.js';
import { api } from '../api.js';
import { state, saveConfig, setNotice } from '../store.js';
import { pageHead, card, note } from '../ui.js';
import { escapeHtml, pct, num } from '../format.js';

export function renderSettings() {
  const cfg = state.config || {};
  const mix = state.stats?.protocol_mix;
  const listen = cfg.listen || '—';

  return `
  ${pageHead('设置', '监听地址与面板信息')}

  ${card('监听', '来自启动参数，不能用面板修改', `
    <div class="kv-list">
      <div class="kv"><span class="k">面板地址</span><span class="v mono">${escapeHtml(location.origin)}/_ccp/</span></div>
      <div class="kv"><span class="k">监听</span><span class="v mono">${escapeHtml(listen)}</span></div>
      <div class="kv"><span class="k">客户端入口</span><span class="v mono">ANTHROPIC_BASE_URL=${escapeHtml(location.origin)}<br/>OPENAI_BASE_URL=${escapeHtml(location.origin)}/v1</span></div>
      <div class="kv"><span class="k">版本</span><span class="v mono">v${escapeHtml(cfg.version || '—')}</span></div>
    </div>
    ${note('info', icons.info,
      '端口被占用时代理会自动顺延，请以本页显示的实际监听地址为准。桌面端会跟随该地址，不需要手动改配置。')}`)}

  ${card('行为', '保存后立即热更新', `
    <div class="form-grid">
      <label class="field"><span>重试次数</span>
        <input type="number" id="set-retries" min="0" max="20" value="${Number(cfg.retries ?? 3)}" />
        <em>仅对 429 / 5xx / 连接错误重试。</em>
      </label>
      <label class="field"><span>重试退避（毫秒）</span>
        <input type="number" id="set-backoff" min="0" max="60000" value="${Number(cfg.retry_backoff_ms ?? 600)}" />
        <em>线性退避基数，第 n 次重试等待 n × 该值。</em>
      </label>
      <label class="field"><span>历史保留条数</span>
        <input type="number" id="set-history" min="50" max="20000" value="${Number(cfg.history_limit ?? 500)}" />
        <em>内存中保留的请求条数上限。</em>
      </label>
      <label class="field"><span>抓包保留条数</span>
        <input type="number" id="set-captures" min="1" max="2000" value="${Number(cfg.capture_limit ?? 200)}" />
        <em>完整请求/响应保留的条数。</em>
      </label>
    </div>
    <label class="check"><input type="checkbox" id="set-capture" ${cfg.capture_enabled !== false ? 'checked' : ''}/> 开启抓包</label>
    <div class="form-foot">
      <span class="spacer"></span>
      <button class="btn primary" data-act="settings-save">保存</button>
    </div>`)}

  ${card('协议转换', '', `
    <label class="check"><input type="checkbox" id="set-translate" ${cfg.translate !== false ? 'checked' : ''}/>
      自动转换协议格式</label>
    <p class="muted">开启后，如果某个供应商声明的协议与客户端不同（例如 Claude Code 走 OpenAI 兼容上游），
    代理会转换请求与流式响应；关闭则只做透传，由上游自行处理。</p>
    <div class="mix">
      <div class="mix-bar">
        <i class="a" style="width:${mix ? mix.anthropic_ratio : 0}%"></i>
        <i class="o" style="width:${mix ? mix.openai_ratio : 0}%"></i>
      </div>
      <div class="mix-labels">
        <span><i class="a"></i>Anthropic ${mix ? pct(mix.anthropic_ratio) : '—'}</span>
        <span><i class="o"></i>OpenAI ${mix ? pct(mix.openai_ratio) : '—'}</span>
      </div>
      <p class="muted">按请求路径自动识别协议，无需手工切换。</p>
    </div>
    <div class="form-foot"><span class="spacer"></span>
      <button class="btn primary" data-act="settings-save">保存</button></div>`)}

  ${card('模型名映射', '仅影响面板展示与统计，不改写请求', `
    <label class="field">
      <textarea id="set-modelmap" rows="5" placeholder="vendor-a/model-x=model-x&#10;团队别名=规范名">${
        escapeHtml(Object.entries(cfg.model_map || {}).map(([k, v]) => `${k}=${v}`).join('\n'))
      }</textarea>
      <em>每行一条 <code>源=目标</code>。常用于把同一模型的不同写法合并成一张卡片。</em>
    </label>
    <div class="form-foot"><span class="spacer"></span>
      <button class="btn primary" data-act="settings-save">保存</button></div>`)}

  ${card('诊断', '', `
    <div class="form-foot">
      <button class="btn" data-act="settings-selftest">运行自检</button>
      <span class="spacer"></span>
      <span class="dim">配置保存在状态目录的 config.json，不含任何硬编码地址。</span>
    </div>
    <div id="selftest-out"></div>`)}
  `;
}

export function settingsActions(act, el, rerender) {
  if (act === 'settings-save') {
    const modelMap = {};
    for (const line of String(document.getElementById('set-modelmap')?.value || '').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const i = trimmed.indexOf('=');
      if (i > 0) {
        const k = trimmed.slice(0, i).trim();
        const v = trimmed.slice(i + 1).trim();
        if (k && v) modelMap[k] = v;
      }
    }
    saveConfig({
      retries: Number(document.getElementById('set-retries')?.value || 0),
      retry_backoff_ms: Number(document.getElementById('set-backoff')?.value || 0),
      history_limit: Number(document.getElementById('set-history')?.value || 500),
      capture_limit: Number(document.getElementById('set-captures')?.value || 200),
      capture_enabled: Boolean(document.getElementById('set-capture')?.checked),
      translate: Boolean(document.getElementById('set-translate')?.checked),
      model_map: modelMap,
    }, '设置已保存').then(rerender);
    return true;
  }
  if (act === 'settings-selftest') {
    const out = document.getElementById('selftest-out');
    if (out) out.innerHTML = '<div class="probe pending">自检中…</div>';
    api.selftest().then((res) => {
      if (!out) return;
      out.innerHTML = `<table class="table compact">
        <thead><tr><th>项目</th><th>结果</th><th>详情</th></tr></thead>
        <tbody>${(res.checks || []).map((c) => `
          <tr><td>${escapeHtml(c.name)}</td>
            <td><span class="tag ${c.ok ? 'ok' : 'error'}">${c.ok ? '通过' : '失败'}</span></td>
            <td class="dim mono">${escapeHtml(c.detail || '')}</td></tr>`).join('')}</tbody></table>`;
    }).catch((err) => {
      if (out) out.innerHTML = `<div class="probe error">${escapeHtml(err.message)}</div>`;
    });
    return true;
  }
  return false;
}
