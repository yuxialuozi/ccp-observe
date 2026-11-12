import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { compact, escapeHtml, num, timeOf } from './format.js';

const AXIS_FONT = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif';

/**
 * Context-size chart: input tokens as the lower band, cache-read tokens as the
 * band between the input line and the total (input + cache) line.
 * Uses uPlot's `bands` feature so no stacking path maths is needed.
 */
export class ContextChart {
  constructor(container, tooltip) {
    this.el = container;
    this.tip = tooltip;
    this.u = null;
    this.points = [];
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
  }

  destroy() {
    this.ro.disconnect();
    if (this.u) this.u.destroy();
    this.u = null;
  }

  resize() {
    if (!this.u) return;
    const width = this.el.clientWidth;
    if (width > 0 && Math.abs(width - this.u.width) > 1) {
      this.u.setSize({ width, height: this.height() });
    }
  }

  height() {
    return 190;
  }

  setData(points) {
    this.points = points || [];
    const width = this.el.clientWidth || 640;
    if (!this.points.length) {
      if (this.u) {
        this.u.destroy();
        this.u = null;
      }
      return;
    }
    const xs = [];
    const input = [];
    const total = [];
    for (const p of this.points) {
      xs.push(Math.round(Number(p.ts) / 1000));
      input.push(Number(p.input) || 0);
      total.push((Number(p.input) || 0) + (Number(p.cache_read) || 0));
    }
    const data = [xs, input, total];

    if (this.u) {
      this.u.setData(data);
      return;
    }

    // Keep the tooltip node: it is a sibling appended by the page, and
    // wiping the container would silently detach the reference we hold.
    this.el.querySelectorAll('.uplot').forEach((node) => node.remove());
    const opts = {
      width,
      height: this.height(),
      padding: [10, 12, 0, 0],
      legend: { show: false },
      cursor: {
        show: true,
        x: true,
        y: false,
        points: { show: false },
        drag: { x: false, y: false },
      },
      scales: {
        x: { time: true },
        y: { range: (u, min, max) => [0, max <= 0 ? 100 : max * 1.12] },
      },
      axes: [
        {
          stroke: '#9aa1ab',
          font: AXIS_FONT,
          grid: { stroke: '#eef0f3', width: 1 },
          ticks: { stroke: '#eef0f3', width: 1, size: 4 },
          values: (u, ticks) => ticks.map((t) => formatTick(t)),
        },
        {
          stroke: '#9aa1ab',
          font: AXIS_FONT,
          size: 52,
          grid: { stroke: '#eef0f3', width: 1 },
          ticks: { show: false },
          values: (u, ticks) => ticks.map((t) => compact(t)),
        },
      ],
      series: [
        {},
        {
          label: 'input',
          stroke: '#7ea6f2',
          width: 1.2,
          points: { show: false },
          fill: 'rgba(37,99,235,0.06)',
        },
        {
          label: 'context',
          stroke: '#2563eb',
          width: 1.6,
          points: { show: false },
        },
      ],
      bands: [
        {
          series: [1, 2],
          fill: 'rgba(37,99,235,0.16)',
        },
      ],
      hooks: {
        draw: [
          (u) => {
            const ctx = u.ctx;
            ctx.save();
            // truncation markers
            this.points.forEach((p, i) => {
              if (!p.truncated) return;
              const x = u.valToPos(u.data[0][i], 'x', true);
              const y = u.valToPos(u.data[1][i], 'y', true);
              ctx.beginPath();
              ctx.fillStyle = '#d97706';
              ctx.arc(x, y, 3.2, 0, Math.PI * 2);
              ctx.fill();
              ctx.strokeStyle = 'rgba(217,119,6,0.45)';
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.arc(x, y, 5.6, 0, Math.PI * 2);
              ctx.stroke();
            });
            ctx.restore();
          },
        ],
        setCursor: [(u) => this.hover(u)],
      },
    };
    this.u = new uPlot(opts, data, this.el);
  }

  hover(u) {
    const idx = u.cursor.idx;
    if (idx == null || !this.tip) {
      if (this.tip) this.tip.classList.remove('show');
      return;
    }
    const p = this.points[idx];
    if (!p) return;
    const left = u.cursor.left;
    const top = u.valToPos(u.data[2][idx], 'y', true);
    this.tip.innerHTML =
      `<b>${timeOf(p.time)}</b><br/>` +
      `input ${num(p.input)} · cache ${num(p.cache_read)}<br/>` +
      `context ${num(p.context)}` +
      (p.truncated ? '<br/><span style="color:#fbbf24">⚠ 该请求发生截断</span>' : '');
    this.tip.style.left = `${Math.max(60, left)}px`;
    this.tip.style.top = `${Math.max(46, top - 8)}px`;
    this.tip.classList.add('show');
  }

  setVisible(visible) {
    if (this.u) {
      this.u.setSize({ width: this.el.clientWidth, height: visible ? this.height() : this.height() });
    }
  }
}

/**
 * Daily usage chart: one bar per day for request volume, plus a truncation-rate
 * line on a second y-axis so a bad day stands out without hiding the volume.
 */
export class UsageChart {
  constructor(container, tooltip) {
    this.el = container;
    this.tip = tooltip;
    this.u = null;
    this.rows = [];
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
  }

  destroy() {
    this.ro.disconnect();
    if (this.u) this.u.destroy();
    this.u = null;
  }

  height() {
    return 210;
  }

  resize() {
    if (!this.u) return;
    const width = this.el.clientWidth;
    if (width > 0 && Math.abs(width - this.u.width) > 1) {
      this.u.setSize({ width, height: this.height() });
    }
  }

  setData(rows) {
    this.rows = rows || [];
    const width = this.el.clientWidth || 640;
    if (!this.rows.length) {
      if (this.u) {
        this.u.destroy();
        this.u = null;
      }
      return;
    }
    const xs = [];
    const requests = [];
    const cut = [];
    for (const r of this.rows) {
      xs.push(Math.round(Date.parse(`${r.date}T00:00:00`) / 1000));
      requests.push(Number(r.requests) || 0);
      cut.push(Number(r.truncation_rate) || 0);
    }
    const data = [xs, requests, cut];

    if (this.u) {
      this.u.setData(data);
      return;
    }

    this.el.querySelectorAll('.uplot').forEach((node) => node.remove());
    const opts = {
      width,
      height: this.height(),
      padding: [10, 12, 0, 0],
      legend: { show: false },
      cursor: {
        show: true, x: true, y: false, points: { show: false },
        drag: { x: false, y: false },
      },
      scales: {
        x: { time: true },
        y: { range: (u, min, max) => [0, max <= 0 ? 4 : max * 1.15] },
        cut: { range: [0, 100] },
      },
      axes: [
        {
          stroke: '#9aa1ab', font: AXIS_FONT,
          grid: { stroke: '#eef0f3', width: 1 },
          ticks: { stroke: '#eef0f3', width: 1, size: 4 },
          values: (u, ticks) => ticks.map((t) => dayTick(t)),
        },
        {
          stroke: '#9aa1ab', font: AXIS_FONT, size: 44,
          grid: { stroke: '#eef0f3', width: 1 },
          ticks: { show: false },
          values: (u, ticks) => ticks.map((t) => compact(t)),
        },
        {
          scale: 'cut', side: 1, stroke: '#c98a2e', font: AXIS_FONT, size: 40,
          grid: { show: false }, ticks: { show: false },
          values: (u, ticks) => ticks.map((t) => (t === Math.round(t) ? `${t}%` : '')),
        },
      ],
      series: [
        {},
        {
          label: '请求',
          stroke: '#2563eb',
          fill: 'rgba(37,99,235,0.18)',
          width: 1,
          points: { show: false },
          paths: uPlot.paths.bars({ size: [0.62, 12] }),
        },
        {
          label: '截断率',
          scale: 'cut',
          stroke: '#d97706',
          width: 1.6,
          points: { show: true, size: 4, fill: '#d97706' },
        },
      ],
      hooks: {
        setCursor: [(u) => this.hover(u)],
      },
    };
    this.u = new uPlot(opts, data, this.el);
  }

  hover(u) {
    const idx = u.cursor.idx;
    if (idx == null || !this.tip) {
      if (this.tip) this.tip.classList.remove('show');
      return;
    }
    const r = this.rows[idx];
    if (!r) return;
    const point = u.cursor.left;
    const top = u.valToPos(u.data[1][idx], 'y', true);
    this.tip.innerHTML =
      `<b>${escapeHtml(r.date)}</b><br/>` +
      `${num(r.requests)} 次请求 · ${num(r.success)} 成功<br/>` +
      `截断 ${num(r.truncated)}（${Number(r.truncation_rate || 0).toFixed(1)}%）<br/>` +
      `输入 ${compact(r.input_tokens)} / 输出 ${compact(r.output_tokens)}`;
    this.tip.style.left = `${Math.max(60, point)}px`;
    this.tip.style.top = `${Math.max(46, top - 8)}px`;
    this.tip.classList.add('show');
  }
}

function dayTick(t) {
  const d = new Date(t * 1000);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function formatTick(t) {
  const d = new Date(t * 1000);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  if (hh === '00' && mm === '00') return `${d.getMonth() + 1}/${d.getDate()}`;
  return `${hh}:${mm}`;
}
