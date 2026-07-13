// The results — copy left, one ring right. The band encodes the figure:
// clockwise from 12 o'clock, solid ink to 60%, fading out through 90%,
// then a faint tail closing the circle — "at least 60, up to 90".
// Outside it a short four-dot head orbits once every 10 seconds: the fix
// time made visible. The copy reveals first (shared grammar); the ring
// particle-loads midway through, then the timer starts once the band
// has settled. One-shot; never replays.
// Reduced-motion: band resolved, head parked at 12 o'clock, no orbit.

import { clamp, lerp, easeOut, rng, fitCanvas, whileVisible, reducedMotion, DOT } from './util.js';

const LAP_MS = 10000;      // one full orbit of the timer head
const ASSEMBLE_END = 0.7;  // the band is fully assembled by this fraction of
                           // the pin; the remainder holds while the head orbits
const HEAD_DOTS = 4;       // visible length of the timer head

// reference geometry (380px box, halved): scaled by the actual canvas
const REF_HALF = 190;
const BAND_ROWS = [128, 141, 154];
const TIMER_R = 172;

// band fade: ink → light grey across the 60→90 span
const INK = [20, 20, 21];      // --dot-dark
const FADE_TO = [205, 205, 205];

function bandStyle(f) {
  if (f <= 0.6) return { fill: DOT.dark, alpha: 1 };
  if (f <= 0.9) {
    const t = (f - 0.6) / 0.3;
    const c = INK.map((v, i) => Math.round(lerp(v, FADE_TO[i], t)));
    return { fill: `rgb(${c[0]},${c[1]},${c[2]})`, alpha: 1 };
  }
  return { fill: DOT.faint, alpha: 0.9 }; // the faint tail — visible remainder
}

function build(canvas) {
  const { ctx, w, h } = fitCanvas(canvas);
  const cx = w / 2;
  const cy = h / 2;
  const u = Math.min(w, h) / 2 / REF_HALF;
  const small = Math.min(w, h) < 300;
  const perRow = small ? 48 : 64;    // simplify density on small screens
  const timerCount = small ? 56 : 72;
  const rand = rng(7);

  const band = [];
  for (const rr of BAND_ROWS) {
    const radius = rr * u;
    for (let i = 0; i < perRow; i++) {
      const f = i / perRow; // fraction of the lap, clockwise from 12
      const a = f * Math.PI * 2 - Math.PI / 2;
      const scatA = rand() * Math.PI * 2;
      band.push({
        x: cx + Math.cos(a) * radius,
        y: cy + Math.sin(a) * radius,
        f,
        lag: rand(), // per-dot stagger for the particle load-in
        scatX: Math.cos(scatA) * (20 + rand() * 50),
        scatY: Math.sin(scatA) * (20 + rand() * 50),
      });
    }
  }

  const timer = [];
  for (let i = 0; i < timerCount; i++) {
    const f = i / timerCount;
    const a = f * Math.PI * 2 - Math.PI / 2;
    timer.push({ x: cx + Math.cos(a) * TIMER_R * u, y: cy + Math.sin(a) * TIMER_R * u, f });
  }

  return { ctx, w, h, band, timer, timerCount, dotR: Math.max(1.5, 2 * u) };
}

export function initResults() {
  const canvas = document.getElementById('ring-results');
  const section = document.getElementById('results');
  if (!canvas || !section) return;
  const still = reducedMotion();

  let ring = build(canvas);

  // a: 0..1 assembly fraction driven by the pin scroll (a < 0 → resolved
  // instantly, for reduced-motion / resize-after-settle). Each dot flies
  // in over a 0.4-wide window, staggered by its lag across the first 0.6.
  function drawBand(a) {
    const { ctx, band, dotR } = ring;
    for (const d of band) {
      const dissolve = a < 0 ? 1 : easeOut(clamp((a - d.lag * 0.6) / 0.4, 0, 1));
      if (dissolve <= 0) continue;
      const tone = bandStyle(d.f);
      ctx.globalAlpha = tone.alpha * dissolve;
      ctx.fillStyle = tone.fill;
      ctx.beginPath();
      ctx.arc(d.x + d.scatX * (1 - dissolve), d.y + d.scatY * (1 - dissolve), dotR, 0, 7);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // only the head is ever visible: the lead dot brightest and slightly
  // larger, fading to nothing over ~4 dots; the track itself is invisible
  function drawTimer(lapFrac) {
    const { ctx, timer, timerCount, dotR } = ring;
    for (const d of timer) {
      const behind = ((lapFrac - d.f + 1) % 1) * timerCount;
      if (behind >= HEAD_DOTS) continue;
      const heat = 1 - behind / HEAD_DOTS;
      ctx.globalAlpha = Math.pow(heat, 1.3);
      ctx.fillStyle = DOT.dark;
      ctx.beginPath();
      ctx.arc(d.x, d.y, dotR * (0.9 + 0.35 * heat), 0, 7);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawResolved(lapFrac) {
    ring.ctx.clearRect(0, 0, ring.w, ring.h);
    drawBand(-1);
    drawTimer(lapFrac);
  }

  if (still) {
    drawResolved(0); // head parked at the start position
    window.addEventListener('resize', () => {
      ring = build(canvas);
      drawResolved(0);
    });
    return;
  }

  let cur = -1;         // eased pin progress
  let spinT0 = -1;      // orbit clock: starts once the band has assembled
  let visible = false;
  let rafId = 0;

  function progress() {
    const r = section.getBoundingClientRect();
    const scrollable = r.height - window.innerHeight;
    return scrollable > 0 ? clamp(-r.top / scrollable, 0, 1) : 1;
  }

  // The ring is scrubbed by the pin: scrolling assembles the band from
  // its scattered particles, so the user's input IS the progress — never
  // gated, clamped, or discarded (no wheel/scrollTo handlers at all). The
  // pin holds the frame still while the band forms; once it has settled
  // (a >= 1) the timer head orbits on its own 10s clock. Fully
  // scrollable-through in both directions; reverses as you scroll back.
  function frame(now) {
    rafId = 0;
    if (!visible) return;
    const target = progress();
    cur = cur < 0 ? target : cur + (target - cur) * 0.15;
    if (Math.abs(cur - target) < 0.001) cur = target;
    const a = clamp(cur / ASSEMBLE_END, 0, 1);

    ring.ctx.clearRect(0, 0, ring.w, ring.h);
    drawBand(a);
    if (a >= 1) {
      if (spinT0 < 0) spinT0 = now;
      drawTimer(((now - spinT0) % LAP_MS) / LAP_MS);
    } else {
      spinT0 = -1; // scrubbed back below the settle point — rearm the orbit
    }
    rafId = requestAnimationFrame(frame);
  }

  const wake = () => { if (!rafId && visible) rafId = requestAnimationFrame(frame); };

  // sleeps off-screen, resumes on return
  whileVisible(canvas, (v) => { visible = v; wake(); });

  window.addEventListener('resize', () => {
    ring = build(canvas);
    cur = -1;
    wake();
  });

  wake();
}
