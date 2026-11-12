const BASE = '/_ccp/api';

async function request(path, options = {}) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    ...options,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok && !(data && data.ok === false)) {
    const err = new Error((data && (data.error || data.message)) || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  stats: () => request('/stats'),
  recent: (model, limit = 100) =>
    request(`/recent?limit=${limit}${model ? `&model=${encodeURIComponent(model)}` : ''}`),
  errors: (limit = 100) => request(`/errors?limit=${limit}`),
  truncations: (model, limit = 60) =>
    request(`/truncations?limit=${limit}${model ? `&model=${encodeURIComponent(model)}` : ''}`),
  context: (model) => request(`/context?model=${encodeURIComponent(model)}`),
  buckets: (model, granularity) =>
    request(`/buckets?model=${encodeURIComponent(model || '')}&granularity=${granularity}`),
  usage: (days = 30) => request(`/usage?days=${days}`),
  getConfig: () => request('/config'),
  saveConfig: (patch) => request('/config', { method: 'POST', body: JSON.stringify(patch) }),
  testUpstream: (payload) => request('/test', { method: 'POST', body: JSON.stringify(payload) }),
  selftest: () => request('/selftest'),
  route: (model, protocol = 'anthropic') =>
    request(`/route?model=${encodeURIComponent(model || '')}&protocol=${protocol}`),
  validateRoute: (payload) =>
    request('/routes/validate', { method: 'POST', body: JSON.stringify(payload) }),
  captures: ({ model, limit = 60, truncatedOnly = false } = {}) => {
    const q = new URLSearchParams({ limit: String(limit) });
    if (model) q.set('model', model);
    if (truncatedOnly) q.set('truncated', '1');
    return request(`/capture?${q.toString()}`);
  },
  capture: (id) => request(`/capture/${encodeURIComponent(id)}`),
};

export function isProxyUnreachable(err) {
  return err && (err.status === undefined || err.status === 0 || err.status === 502);
}
