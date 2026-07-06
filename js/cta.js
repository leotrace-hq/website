// The CTA — urgency made live. A real clock counts up from arrival and an
// honest ≈line estimate ticks with it (~2 lines/s for one agent). Behind
// the copy, a dot field accrues upward with time on the site and never
// fully fills. Client-side only; collects nothing.
// Reduced-motion: static partial field; the counter still ticks.

import { clamp, rng, fitCanvas, whileVisible, reducedMotion, DOT } from './util.js';

const LINES_PER_SECOND = 2;
const FILL_TAU_S = 540;   // time constant of the rise
const FILL_MAX = 0.86;    // the field never fully fills

function arrivalMs() {
  try {
    const stored = sessionStorage.getItem('lt-arrival');
    if (stored) return Number(stored);
    const now = Date.now();
    sessionStorage.setItem('lt-arrival', String(now));
    return now;
  } catch {
    return Date.now();
  }
}

export function initCta() {
  const timeEl = document.getElementById('cta-time');
  const linesEl = document.getElementById('cta-lines');
  const canvas = document.getElementById('cta-canvas');
  if (!timeEl || !canvas) return;

  const t0 = arrivalMs();
  const elapsedS = () => Math.max(0, (Date.now() - t0) / 1000);

  // --- the counter ---
  function tick() {
    const s = Math.floor(elapsedS());
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    timeEl.textContent = h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
      : `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    linesEl.textContent = Math.floor(s * LINES_PER_SECOND).toLocaleString('en-US');
  }
  tick();
  setInterval(tick, 1000);

  // --- the rising field ---
  const still = reducedMotion();
  let field = null;

  function buildField() {
    const { ctx, w, h } = fitCanvas(canvas);
    const gap = 15;
    const dots = [];
    const rand = rng(42);
    for (let x = gap / 2; x < w; x += gap) {
      for (let y = gap / 2; y < h; y += gap) {
        const fromBottom = 1 - y / h; // 0 at bottom … 1 at top
        dots.push({
          x: x + (rand() - 0.5) * gap * 0.8,
          y: y + (rand() - 0.5) * gap * 0.8,
          // level at which this dot appears; bottom first, jittered frontier
          level: clamp(fromBottom * 0.92 + (rand() - 0.5) * 0.14, 0, 1),
          tone: rand() < 0.22 ? DOT.mid : DOT.faint,
        });
      }
    }
    field = { ctx, w, h, dots };
  }

  const fillLevel = () => FILL_MAX * (1 - Math.exp(-elapsedS() / FILL_TAU_S));

  function drawField() {
    const { ctx, w, h, dots } = field;
    const level = fillLevel();
    ctx.clearRect(0, 0, w, h);
    for (const d of dots) {
      if (d.level > level) continue;
      const a = clamp((level - d.level) / 0.05, 0, 1);
      ctx.globalAlpha = a * (d.tone === DOT.faint ? 0.8 : 0.9);
      ctx.fillStyle = d.tone;
      ctx.beginPath();
      ctx.arc(d.x, d.y, 1.4, 0, 7);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  buildField();
  drawField();

  window.addEventListener('resize', () => { buildField(); drawField(); });

  if (still) return; // static partial field

  let visible = false;
  let intervalId = 0;
  whileVisible(canvas, (v) => {
    visible = v;
    if (visible && !intervalId) {
      intervalId = setInterval(drawField, 1500); // it keeps accruing while they read
      drawField();
    } else if (!visible && intervalId) {
      clearInterval(intervalId);
      intervalId = 0;
    }
  });
}
