// The CTA — urgency made live. A real clock counts up from arrival and an
// honest ≈line estimate ticks with it (~2 lines/s for one agent). Behind
// the copy, a dot field writes itself out as lines of code — ragged line
// lengths, indented, each line drawn left-to-right and top to bottom — so
// it reads as an agent typing. Client-side only; collects nothing.
// Reduced-motion: static partial field; the counter still ticks.

import { clamp, rng, fitCanvas, whileVisible, reducedMotion, DOT } from './util.js';

const LINES_PER_SECOND = 2;
const FILL_TAU_S = 110;   // write time-constant — brisk, not the old ~9-min crawl
const FILL_MAX = 0.9;     // the field never fully fills

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
  const still = reducedMotion();

  // --- the counter ---
  function renderCounter(s) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    timeEl.textContent = h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
      : `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    linesEl.textContent = Math.floor(s * LINES_PER_SECOND).toLocaleString('en-US');
  }

  // --- the field: lines of code, written line by line, left to right ---
  let field = null;

  function buildField() {
    const { ctx, w, h } = fitCanvas(canvas);
    const rand = rng(42);
    const rowGap = 16;    // line height
    const charGap = 11;   // character pitch
    const indentUnit = 26;
    const dots = [];
    let order = 0;        // global write-order: row-major, top→bottom, left→right
    for (let y = rowGap; y < h - 2; y += rowGap) {
      if (rand() < 0.12) { order += 6; continue; } // an occasional blank line
      const indent = charGap + Math.floor(rand() * 3) * indentUnit; // 0–2 nesting levels
      const maxChars = Math.max(4, Math.floor((w - indent - charGap) / charGap));
      const len = Math.max(4, Math.round((0.35 + rand() * 0.6) * maxChars)); // ragged length
      for (let i = 0; i < len; i++) {
        dots.push({
          x: indent + i * charGap,
          y: y + (rand() - 0.5) * 2,
          order: order++,
          tone: rand() < 0.18 ? DOT.mid : DOT.faint,
        });
      }
      order += 2; // a short beat at each line break
    }
    field = { ctx, w, h, dots, total: Math.max(1, order) };
  }

  const frontier = () => FILL_MAX * (1 - Math.exp(-elapsedS() / FILL_TAU_S)) * field.total;

  function drawField(f) {
    const { ctx, w, h, dots } = field;
    ctx.clearRect(0, 0, w, h);
    for (const d of dots) {
      if (d.order > f) continue;
      const a = clamp((f - d.order) / 4, 0, 1); // soft leading edge — the cursor
      ctx.globalAlpha = a * (d.tone === DOT.faint ? 0.8 : 0.9);
      ctx.fillStyle = d.tone;
      ctx.beginPath();
      ctx.arc(d.x, d.y, 1.4, 0, 7);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  buildField();
  drawField(frontier());
  let lastSec = Math.floor(elapsedS());
  renderCounter(lastSec);

  window.addEventListener('resize', () => { buildField(); drawField(frontier()); });

  // One rAF loop while the section is on screen drives both the counter
  // (text swap only when the whole second changes) and the field write
  // (redrawn only when the write-frontier actually advances, so it stops
  // repainting once the fill plateaus). Off-screen it sleeps; on return
  // the counter recomputes from the clock, so it is always correct. Under
  // reduced motion the field stays static; only the counter keeps ticking.
  let visible = false;
  let rafId = 0;
  let lastF = -1;
  function frame() {
    rafId = 0;
    if (!visible) return;
    const s = Math.floor(elapsedS());
    if (s !== lastSec) { lastSec = s; renderCounter(s); }
    if (!still) {
      const f = frontier();
      if (Math.abs(f - lastF) >= 0.5) { lastF = f; drawField(f); }
    }
    rafId = requestAnimationFrame(frame);
  }
  const wake = () => { if (!rafId && visible) rafId = requestAnimationFrame(frame); };
  whileVisible(canvas, (v) => { visible = v; wake(); });
}
