import { icons } from '../icons.js';
import { state, setNotice } from '../store.js';
import { pageHead, card, note } from '../ui.js';
import { escapeHtml, pct } from '../format.js';

export function renderGuide() {
  const origin = location.origin;
  const mix = state.stats?.protocol_mix;
  const cfg = state.config || {};
  const providers = cfg.providers || [];
  const hasUpstream = Boolean(cfg.upstream) || providers.some((p) => p.enabled && p.base_url);

  const claude = `export ANTHROPIC_BASE_URL=${origin}\nexport ANTHROPIC_AUTH_TOKEN=your-key-if-any\n# 上游鉴权在「供应商」页配置，客户端这里只放占位值`;
  const codex = `# ~/.codex/config.toml（或直接跑 ccp codex，不用改这个文件）
model_provider = "ccp"
web_search = "disabled"

[model_providers.ccp]
name = "ccp-observe"
base_url = "${origin}/v1"
env_key = "OPENAI_API_KEY"
wire_api = "responses"`;
  const curl = `curl ${origin}/v1/messages \\\n  -H "content-type: application/json" \\\n  -d '{"model":"your-model","max_tokens":32,"messages":[{"role":"user","content":"hi"}]}'`;

  return `
  ${pageHead('接入', '把客户端指向本代理，其余保持不变',
    mix ? `<span class="chip">Anthropic ${pct(mix.anthropic_ratio)} · OpenAI ${pct(mix.openai_ratio)}</span>` : '')}

  ${hasUpstream ? '' : note('warn', icons.alert,
    '还没有配置上游。先到「供应商」页添加一个上游，否则请求会被代理拒掉并给出提示。')}

  ${card('先读这一条', '', `
    ${note('info', icons.info,
      '代理按请求路径自动分流：<code>/v1/messages</code> 走 Anthropic Messages，<code>/v1/chat/completions</code> 走 OpenAI Chat Completions，<code>/v1/responses</code> 走 OpenAI Responses（Codex 用这条）。请求经过代理即自动记录截断检测与统计，无需任何额外配置。')}
    ${note('alert', icons.alert,
      '<b>看到 <code>could not be parsed as JSON</code>？</b> 先回「总览」看截断率和归因卡片：只有一个模型脏 → 模型侧；多个模型同时脏 → 网关或本地链路；客户端主动断开 → 本地。再点「抓包」看那一刻的残缺 tool_use JSON。')}`)}

  <div class="guide-grid">
    ${guideCard('Claude Code', 'Anthropic Messages', 'code-claude', claude, [
      '在终端执行，或写入 <code>~/.zshrc</code> / 系统环境变量。',
      '保持 <code>ANTHROPIC_MODEL</code> 与实际使用的模型一致；面板按响应里的模型名归类。',
      '客户端自己的 key 不会被透传到第三方：在「供应商 → 鉴权头」里统一配置。',
      '启动 <code>claude</code>，在「抓包」里看到 <code>/v1/messages</code> 即接入成功。',
    ])}
    ${guideCard('Codex', 'OpenAI Responses', 'code-codex', codex, [
      '最省事：装好后直接跑 <code>ccp codex</code>，它会用 <code>-c</code> 覆盖上面这些配置，不改你的 <code>config.toml</code>。',
      'Codex 只认 <code>wire_api = "responses"</code>，所以必须路由到 <b>protocol 为 openai</b> 的供应商；anthropic 供应商无法转换。',
      '<code>web_search = "disabled"</code>：多数兼容网关不接受 web_search 工具，开着会 400。',
      '发一条带工具调用的消息，「抓包」里能看到 <code>/v1/responses</code> 的完整请求与响应。',
    ])}
    ${guideCard('通用 HTTP 客户端', 'curl', 'code-curl', curl, [
      `任意 HTTP 客户端都可以接入，把 base URL 指向 <code>${escapeHtml(origin)}</code>。`,
      'HTTP 与 SSE 流式都支持；流式响应中的 tool_use 片段会被逐段解析用于截断检测。',
      '数据只在本机内存与状态目录，不上传任何地方。',
    ])}
  </div>

  ${card('常见问题', '', `
    <div class="faq">
      <div class="faq-item"><h4>统计为空？</h4>
        <p>请求必须经过本代理端口。检查 <code>ANTHROPIC_BASE_URL</code> / <code>OPENAI_BASE_URL</code> 是否指向 <code>${escapeHtml(origin)}</code>。
        「设置 → 监听」页显示的是实际端口（被占用时代理会自动顺延）。</p></div>
      <div class="faq-item"><h4>面板显示「无法连接本地代理」？</h4>
        <p>代理没在跑。桌面端会在启动时自动拉起；命令行方式运行 <code>python proxy/proxy.py</code> 即可。</p></div>
      <div class="faq-item"><h4>怎么区分不同客户端的流量？</h4>
        <p>看「抓包」里的协议列，或「设置 → 协议转换」中按路径统计的比例。</p></div>
      <div class="faq-item"><h4>截断率一直很高，先改什么？</h4>
        <p>按归因走：模型侧先提高 <code>max_tokens</code>；网关侧先查流式支持与超时；本地链路先查 IDE 卡顿与本机网络。</p></div>
    </div>`)}
  `;
}

function guideCard(title, proto, id, code, steps) {
  return `
  <section class="card guide-card">
    <div class="card-head">
      <div class="card-title"><span class="dot ok"></span><h2>${escapeHtml(title)}</h2>
        <span class="card-sub">${escapeHtml(proto)}</span></div>
      <div class="card-actions">
        <button class="btn sm" data-action="copy-block" data-copy="${id}">${icons.copy}<span>复制</span></button>
      </div>
    </div>
    <div class="card-body">
      <pre class="code" id="${id}">${escapeHtml(code)}</pre>
      <ol class="steps">${steps.map((s) => `<li>${s}</li>`).join('')}</ol>
    </div>
  </section>`;
}

export function guideActions(act, el) {
  if (act !== 'copy-block') return false;
  const target = document.getElementById(el.dataset.copy || '');
  if (!target) return true;
  const text = target.textContent;
  const done = () => {
    setNotice('已复制', 'ok');
    const span = el.querySelector('span');
    if (span) {
      const original = span.textContent;
      span.textContent = '已复制';
      setTimeout(() => { span.textContent = original; }, 1600);
    }
  };
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(done, () => setNotice('复制失败', 'error'));
  } else {
    setNotice('当前环境不支持剪贴板', 'error');
  }
  return true;
}
