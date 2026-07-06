// The results — two real numbers, breathing. Both rings share one entry:
// their dots dissolve in together. Then the 60-90% ring's dark arc
// sweeps around the dial and locks onto the 60→90 span, while the ≈10s
// ring keeps spinning — one full lap every 10 seconds, forever.
// Reduced-motion: the range ring holds its final filled arc; the
// spinner holds still.

import { clamp, easeOut, easeInOut, rng, fitCanvas, whileVisible, reducedMotion, DOT } from './util.js';

const RINGS = 3;         // concentric dot rows
const ROW_GAP = 9;
const LAP_MS = 10000;

const DISSOLVE_MS = 900;   // both rings fade in together
const SWEEP_START = 950;   // then the range arc travels…
const SWEEP_MS = 1700;     // …and locks onto 60→90

function buildRing(canvas) {
  const { ctx, w, h } = fitCanvas(canvas);
  const cx = w / 2;
  const cy = h / 2;
  const outer = Math.min(w, h) / 2 - 6;
  const rand = rng(7);
  const dots = [];
  for (let row = 0; row < RINGS; row++) {
    const radius = outer - row * ROW_GAP;
    const count = Math.floor((2 * Math.PI * radius) / 7.2);
    for (let i = 0; i < count; i++) {
      // fraction of the lap, measured clockwise from 12 o'clock
      const f = i / count;
      const a = f * Math.PI * 2 - Math.PI / 2;
      const scatA = rand() * Math.PI * 2;
      dots.push({
        x: cx + Math.cos(a) * radius,
        y: cy + Math.sin(a) * radius,
        f,
        lag: rand(), // per-dot stagger
        // the entry particles: each dot flies in from its own scatter
        scatX: Math.cos(scatA) * (20 + rand() * 50),
        scatY: Math.sin(scatA) * (20 + rand() * 50),
      });
    }
  }
  return { ctx, w, h, dots };
}

// one clean fill to 90%: everything behind the travelling head is
// painted — mid-grey up to 60, black from 60 to 90 — the rest stays faint
const FAINT_TONE = { fill: DOT.faint, alpha: 0.9, r: 1.5 };

function rangeTone(f, head) {
  if (f > head) return FAINT_TONE;
  if (f < 0.6) return { fill: DOT.mid, alpha: 0.85, r: 1.7 };
  return { fill: DOT.dark, alpha: 1, r: 1.9 };
}

export function initResults() {
  const rangeCanvas = document.getElementById('ring-range');
  const timeCanvas = document.getElementById('ring-time');
  if (!rangeCanvas || !timeCanvas) return;
  const still = reducedMotion();

  let range = buildRing(rangeCanvas);
  let timer = buildRing(timeCanvas);

  // elapsed < 0 → skip straight to the resolved state
  function drawRange(elapsed) {
    const { ctx, w, h, dots } = range;
    ctx.clearRect(0, 0, w, h);
    const s = elapsed < 0 ? 1 : easeInOut(clamp((elapsed - SWEEP_START) / SWEEP_MS, 0, 1));
    const head = 0.9 * s;
    for (const d of dots) {
      const dissolve = elapsed < 0 ? 1 : easeOut(clamp((elapsed - d.lag * 500) / 450, 0, 1));
      if (dissolve <= 0) continue;
      // a short blend at the head so the paint arrives, not pops
      const tone = rangeTone(d.f, head);
      const mix = clamp((head - d.f) / 0.03, 0, 1);
      ctx.globalAlpha = (FAINT_TONE.alpha + (tone.alpha - FAINT_TONE.alpha) * mix) * dissolve;
      ctx.fillStyle = mix > 0.5 ? tone.fill : FAINT_TONE.fill;
      ctx.beginPath();
      const r = FAINT_TONE.r + (tone.r - FAINT_TONE.r) * mix;
      ctx.arc(d.x + d.scatX * (1 - dissolve), d.y + d.scatY * (1 - dissolve), r, 0, 7);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    return s >= 1; // resolved
  }

  function drawTime(elapsed, lapFrac) {
    const { ctx, w, h, dots } = timer;
    ctx.clearRect(0, 0, w, h);
    for (const d of dots) {
      const dissolve = elapsed < 0 ? 1 : easeOut(clamp((elapsed - d.lag * 500) / 450, 0, 1));
      if (dissolve <= 0) continue;
      // distance behind the comet head, in lap fractions
      const behind = (lapFrac - d.f + 1) % 1;
      const inTail = behind < 0.30;
      const heat = inTail ? 1 - behind / 0.30 : 0;
      ctx.globalAlpha = (inTail ? 0.25 + 0.75 * heat : 0.55) * dissolve;
      ctx.fillStyle = heat > 0.55 ? DOT.dark : heat > 0.12 ? DOT.mid : DOT.faint;
      ctx.beginPath();
      ctx.arc(d.x + d.scatX * (1 - dissolve), d.y + d.scatY * (1 - dissolve), inTail ? 1.5 + heat * 0.6 : 1.4, 0, 7);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  if (still) {
    drawRange(-1);
    drawTime(-1, 0.72); // held still, tail readable
    window.addEventListener('resize', () => {
      range = buildRing(rangeCanvas);
      timer = buildRing(timeCanvas);
      drawRange(-1);
      drawTime(-1, 0.72);
    });
    return;
  }

  let t0 = -1;          // set when the section comes into view
  let spinT0 = -1;      // the lap clock starts after the dissolve
  let visible = false;
  let rafId = 0;
  let rangeDone = false;

  function frame(now) {
    rafId = 0;
    if (!visible) return;
    if (t0 < 0) t0 = now;
    const elapsed = now - t0;

    if (!rangeDone) rangeDone = drawRange(elapsed);

    if (elapsed >= DISSOLVE_MS && spinT0 < 0) spinT0 = now;
    const lapFrac = spinT0 < 0 ? 0.999 : ((now - spinT0) % LAP_MS) / LAP_MS;
    drawTime(elapsed, lapFrac);

    rafId = requestAnimationFrame(frame);
  }

  whileVisible(rangeCanvas.closest('.stats') || rangeCanvas, (v) => {
    visible = v;
    if (v && !rafId) rafId = requestAnimationFrame(frame);
  });

  window.addEventListener('resize', () => {
    range = buildRing(rangeCanvas);
    timer = buildRing(timeCanvas);
    rangeDone = false;
  });
}
