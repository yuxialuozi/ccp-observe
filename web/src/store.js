import { api } from './api.js';

/** Shared panel state. Pages read it; `refresh()` keeps it warm. */
export const state = {
  page: 'overview',
  stats: null,
  config: null,
  offline: false,
  lastSync: null,
  selectedModel: null,
  detail: { recent: [], truncations: [], context: [], buckets: [] },
  gran: 'day',
  captures: [],
  captureStats: null,
  captureId: null,
  captureDetail: null,
  captureModel: '',
  captureTruncated: false,
  usage: null,
  usageDays: 30,
  usageChart: null,
  routeModel: '',
  routeProtocol: 'anthropic',
  routePreview: null,
  notice: null,
  busy: '',
};

const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emit() {
  for (const fn of listeners) {
    try {
      fn(state);
    } catch (err) {
      console.error(err);
    }
  }
}

export function go(page) {
  if (state.page === page) return;
  state.page = page;
  state.notice = null;
  location.hash = `#/${page}`;
  emit();
}

export function setNotice(text, kind = 'ok') {
  state.notice = text ? { text, kind, at: Date.now() } : null;
  emit();
}

export function currentModel() {
  const models = state.stats?.models || [];
  if (!models.length) return '';
  const wanted = state.selectedModel || state.stats.active_model;
  return models.some((m) => m.model === wanted) ? wanted : models[0].model;
}

export function modelRow(name = currentModel()) {
  return (state.stats?.models || []).find((m) => m.model === name) || null;
}

export async function loadConfig() {
  try {
    state.config = await api.getConfig();
  } catch {
    state.config = null;
  }
}

/** Stats + per-model detail. Returns false when the proxy is unreachable. */
export async function refreshStats() {
  try {
    state.stats = await api.stats();
    state.offline = false;
    state.lastSync = Date.now();
    return true;
  } catch (err) {
    state.offline = true;
    state.lastError = err.message || String(err);
    return false;
  }
}

export async function loadDetail() {
  const model = currentModel();
  if (!model) {
    state.detail = { recent: [], truncations: [], context: [], buckets: [] };
    return;
  }
  try {
    const [recent, truncs, ctx, buckets] = await Promise.all([
      api.recent(model, 80),
      api.truncations(model, 60),
      api.context(model),
      api.buckets(model, state.gran),
    ]);
    state.detail = {
      recent: recent.items || [],
      truncations: truncs.items || [],
      context: ctx.items || [],
      buckets: buckets.items || [],
    };
  } catch {
    /* offline is surfaced by refreshStats */
  }
}

export async function loadCaptures() {
  try {
    const res = await api.captures({
      model: state.captureModel || undefined,
      limit: 60,
      truncatedOnly: state.captureTruncated,
    });
    state.captures = res.items || [];
    state.captureStats = res.stats || null;
  } catch {
    state.captures = [];
  }
}

export async function loadCapture(id) {
  state.captureId = id;
  try {
    state.captureDetail = await api.capture(id);
  } catch {
    state.captureDetail = null;
  }
}

export async function previewRoute() {
  try {
    state.routePreview = await api.route(state.routeModel, state.routeProtocol);
  } catch (err) {
    state.routePreview = { error: err.message };
  }
}

/** Daily usage ledger — persisted, so it covers days the request ring forgot. */
export async function loadUsage() {
  try {
    state.usage = await api.usage(state.usageDays || 30);
  } catch {
    state.usage = null;
  }
}

export async function saveConfig(patch, message = '已保存') {
  const res = await api.saveConfig(patch);
  state.config = res.config;
  setNotice(message, 'ok');
  return res.config;
}
