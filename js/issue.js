// The issue — a pinned scroll sequence. The three points load in one at
// a time and stay; the dot field spreads from a single seeded flaw in
// sync with the same scroll progress. Bottom telemetry: step, progress
// bar, and SPREAD % (the page's one red accent).
//
// The field is the 3.4 spread, ported: a full-viewport hash grid where
// one seeded flaw cell spreads as you scroll — organic front (not a
// clean circle), a glint riding the leading edge, faint background
// matrix where it hasn't reached, eased follow for a smooth advance.
// Reduced-motion: land on the end state.

import { clamp, fitCanvas, whileVisible, reducedMotion } from './util.js';

const POINT_AT = [0.14, 0.44, 0.74];
const SCRUB_END = 0.92; // content completes here — 100% gets a beat before the HUD resolves
const HUD_FADE_AT = 0.955; // HUD dissolves after the beat, before the pin releases

// spread tied to the point progression: point 01 owns 0–33%, point 02
// 33–66%, point 03 66–100% — the field only completes on the third point
const SPREAD_STOPS = [[0, 0], [0.44, 0.33], [0.74, 0.66], [1, 1]];

function spreadOf(q) {
  for (let i = 1; i < SPREAD_STOPS.length; i++) {
    const [q1, s1] = SPREAD_STOPS[i];
    if (q <= q1) {
      const [q0, s0] = SPREAD_STOPS[i - 1];
      return s0 + ((q - q0) / (q1 - q0)) * (s1 - s0);
    }
  }
  return 1;
}

// 3.4 field constants
const INK = [17, 17, 20];
const GLINT = [14, 127, 134];
const CELL = 16;
const DOT_SIZE = 2;
const SEED_X = 0.72; // flaw seeds in the open right field; copy stays left
const SEED_Y = 0.4;

function hash(x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

export function initIssue() {
  const section = document.getElementById('issue');
  const canvas = document.getElementById('spread-canvas');
  if (!section || !canvas) return;

  const points = section.querySelectorAll('[data-point]');
  const stepEl = document.getElementById('issue-step');
  const barEl = document.getElementById('issue-bar');
  const pctEl = document.getElementById('spread-pct');
  const hudEl = section.querySelector('.issue__telemetry');

  let field = null; // {ctx, w, h, cols, rows, maxD}

  function buildField() {
    const { ctx, w, h } = fitCanvas(canvas);
    const cols = Math.ceil(w / CELL);
    const rows = Math.ceil(h / CELL);
    const sx = SEED_X * cols;
    const sy = SEED_Y * rows;
    const maxD = Math.max(
      Math.hypot(sx, sy), Math.hypot(cols - sx, sy),
      Math.hypot(sx, rows - sy), Math.hypot(cols - sx, rows - sy)
    );
    // sorted infection keys → the front is a percentile, so the infected
    // fraction of the field tracks the SPREAD % readout linearly
    const keys = [];
    for (let cx = 0; cx <= cols; cx++) {
      for (let cy = 0; cy <= rows; cy++) {
        const nd = Math.hypot(cx - sx, cy - sy) / maxD;
        keys.push(nd + (hash(cx, cy) - 0.5) * 0.22);
      }
    }
    keys.sort((a, b) => a - b);
    field = { ctx, w, h, cols, rows, maxD, keys };
  }

  function drawField(s) {
    const { ctx, w, h, cols, rows, maxD, keys } = field;
    // front sits at the s-percentile of the keys: s = infected fraction
    const idx = Math.min(keys.length - 1, Math.floor(s * keys.length));
    const front = s >= 1 ? keys[keys.length - 1] + 0.001 : keys[idx];
    ctx.clearRect(0, 0, w, h);
    const sx = SEED_X * cols;
    const sy = SEED_Y * rows;

    for (let cx = 0; cx <= cols; cx++) {
      for (let cy = 0; cy <= rows; cy++) {
        const nd = Math.hypot(cx - sx, cy - sy) / maxD; // 0 at seed → 1 at far corner
        const h1 = hash(cx, cy);
        const key = nd + (h1 - 0.5) * 0.22; // organic front, not a clean circle
        const infected = key <= front;

        let r, g, b, a, sz;
        if (infected) {
          const behind = front - key; // how far inside the front
          const edge = behind < 0.07 ? 1 - behind / 0.07 : 0; // glint rides the leading edge
          a = 0.62 + Math.min(behind * 2.6, 0.36);
          const mix = edge * 0.9;
          r = Math.round(INK[0] + (GLINT[0] - INK[0]) * mix);
          g = Math.round(INK[1] + (GLINT[1] - INK[1]) * mix);
          b = Math.round(INK[2] + (GLINT[2] - INK[2]) * mix);
          sz = DOT_SIZE + 0.6 + edge * 0.8;
        } else {
          // not yet reached: faint background matrix
          r = INK[0]; g = INK[1]; b = INK[2];
          a = 0.09 + h1 * 0.04;
          sz = DOT_SIZE - 0.6;
        }
        const px = cx * CELL + (hash(cy, cx) - 0.5) * 2;
        const py = cy * CELL + (h1 - 0.5) * 2;
        ctx.fillStyle = `rgba(${r},${g},${b},${a.toFixed(3)})`;
        ctx.fillRect(px, py, sz, sz);
      }
    }
  }

  function applyState(p) {
    // content scrub completes at SCRUB_END, holding the end state
    const q = clamp(p / SCRUB_END, 0, 1);
    let step = 0;
    points.forEach((el, i) => {
      const on = q >= POINT_AT[i];
      el.classList.toggle('is-on', on);
      if (on) step = i + 1;
    });
    stepEl.textContent = `${String(Math.max(step, 1)).padStart(2, '0')} / 03`;
    barEl.style.width = `${(q * 100).toFixed(1)}%`;
    // SPREAD % and the field share the point-locked spread progress
    const s = spreadOf(q);
    pctEl.textContent = `${String(Math.round(s * 100)).padStart(2, '0')}%`;
    drawField(s);
  }

  // the HUD belongs to the pinned frame only
  function updateHud(p) {
    const done = p >= HUD_FADE_AT;
    hudEl.classList.toggle('is-live', p > 0.004 && !done);
    hudEl.classList.toggle('is-done', done);
  }

  function progress() {
    const rect = section.getBoundingClientRect();
    const scrollable = rect.height - window.innerHeight;
    return clamp(-rect.top / scrollable, 0, 1);
  }

  // The pattern carries over the boundary into the next section on the
  // SAME matrix grid — no scatter, no drift. Each column simply runs to
  // its own depth (some further, some stopping short) and eases out, so
  // the frame ends as an uneven fill of one clean matrix. Drawn once.
  const carry = document.getElementById('carryover-canvas');

  function drawCarryover() {
    if (!carry || !field) return;
    const { ctx, w, h } = fitCanvas(carry);
    ctx.clearRect(0, 0, w, h);
    const cols = Math.ceil(w / CELL);
    const rows = Math.ceil(h / CELL);
    // continue the field's row rhythm across the section boundary: the
    // field's rows sit at multiples of CELL inside a canvas field.h tall,
    // so the first row here lands where the next multiple would fall.
    const phase = (CELL - (field.h % CELL)) % CELL;
    for (let cx = 0; cx <= cols; cx++) {
      // each column reaches its own depth — uneven fill, always on grid
      const reach = 0.18 + 0.82 * hash(cx, 3.7);
      for (let cy = 0; cy <= rows; cy++) {
        const t = cy / rows; // 0 at the section boundary → 1 deep inside
        if (t > reach) break;
        const h1 = hash(cx + 61, cy + 17);
        const fade = 1 - t / reach; // eases out toward the column's end
        const a = (0.2 + 0.75 * Math.pow(fade, 1.35)) * (0.8 + 0.2 * h1);
        const px = cx * CELL + (hash(cy + 9, cx) - 0.5) * 2; // same ±1px grid jitter as the field
        const py = phase + cy * CELL + (h1 - 0.5) * 2;
        ctx.fillStyle = `rgba(${INK[0]},${INK[1]},${INK[2]},${a.toFixed(3)})`;
        ctx.fillRect(px, py, DOT_SIZE + 0.6, DOT_SIZE + 0.6);
      }
    }
  }

  buildField();
  drawCarryover();

  if (reducedMotion()) {
    // content lands on its end state; the HUD still tracks the pin
    // window so it never lingers between sections (transitions are
    // disabled by the media query, so the swap is instant).
    applyState(1);
    updateHud(progress());
    window.addEventListener('scroll', () => updateHud(progress()), { passive: true });
    window.addEventListener('resize', () => { buildField(); applyState(1); drawCarryover(); });
    return;
  }

  let visible = true;
  let cur = -1;
  let last = -1;
  let rafId = 0;

  function frame() {
    rafId = 0;
    if (!visible) return;
    const target = progress();
    cur = cur < 0 ? target : cur + (target - cur) * 0.12; // eased follow, 3.4-style
    if (Math.abs(target - cur) < 0.001) cur = target;
    if (Math.abs(cur - last) > 0.0006) {
      last = cur;
      applyState(cur);
    }
    updateHud(target);
    rafId = requestAnimationFrame(frame);
  }

  const wake = () => { if (!rafId && visible) rafId = requestAnimationFrame(frame); };

  window.addEventListener('resize', () => { buildField(); drawCarryover(); last = -1; wake(); });
  whileVisible(section, (v) => { visible = v; wake(); });
  wake();
}
