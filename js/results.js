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
const RING_DELAY = 650;    // after the section enters — the words land first
const SETTLE_MS = 1400;    // dissolve stagger + per-dot settle, then the orbit
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

  // elapsed < 0 → resolved instantly (reduced-motion, resize-after-settle)
  function drawBand(elapsed) {
    const { ctx, band, dotR } = ring;
    for (const d of band) {
      const dissolve = elapsed < 0 ? 1 : easeOut(clamp((elapsed - d.lag * 500) / 450, 0, 1));
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

  let started = false;  // the section entered + the copy is underway
  let t0 = -1;          // ring clock: set on the first drawn frame
  let spinT0 = -1;      // lap clock: starts once the band has settled
  let visible = false;
  let rafId = 0;

  // the scroll gate: while the entrance plays, the page can't be
  // scrolled past the section — downward wheel input at the pin's end
  // is swallowed and any overshoot (keyboard, scrollbar drag, momentum)
  // is clamped back. The section is sticky-pinned on desktop, so the
  // frame the user sees holds perfectly still while the gate works.
  // Released the moment the orbit starts, with a failsafe in case the
  // tab loses rAF mid-entrance. Never engaged on the stacked mobile
  // layout (no pin — clamping there visibly fights the scroll), under
  // reduced motion (this branch is unreachable then), or when arriving
  // from below, so it can't yank the page upward.
  let gateOn = false;
  const gateLimit = () =>
    window.scrollY + section.getBoundingClientRect().bottom - window.innerHeight;
  const onGateWheel = (e) => {
    if (e.deltaY > 0 && window.scrollY >= gateLimit() - 1) e.preventDefault();
  };
  const onGateScroll = () => {
    const max = gateLimit();
    if (window.scrollY > max) window.scrollTo({ top: max, behavior: 'instant' });
  };
  function releaseGate() {
    if (!gateOn) return;
    gateOn = false;
    window.removeEventListener('wheel', onGateWheel);
    window.removeEventListener('scroll', onGateScroll);
  }
  function engageGate() {
    if (!window.matchMedia('(min-width: 821px)').matches) return; // pinned layout only
    if (window.scrollY > gateLimit()) return; // came from below — don't yank
    gateOn = true;
    window.addEventListener('wheel', onGateWheel, { passive: false });
    window.addEventListener('scroll', onGateScroll, { passive: true });
    setTimeout(releaseGate, 4000);
  }

  function frame(now) {
    rafId = 0;
    if (!visible || !started) return;
    if (t0 < 0) t0 = now;
    const elapsed = now - t0;

    ring.ctx.clearRect(0, 0, ring.w, ring.h);
    drawBand(elapsed);

    if (elapsed >= SETTLE_MS) {
      if (spinT0 < 0) {
        spinT0 = now;
        releaseGate(); // the band has settled — the page may move on
      }
      drawTimer(((now - spinT0) % LAP_MS) / LAP_MS);
    }

    rafId = requestAnimationFrame(frame);
  }

  // same trigger line as the shared reveal (reveal.js), so the ring's
  // delay is measured from the moment the copy starts — one-shot
  const io = new IntersectionObserver(
    (entries) => {
      if (!entries[0].isIntersecting) return;
      io.disconnect();
      engageGate();
      setTimeout(() => {
        started = true;
        if (visible && !rafId) rafId = requestAnimationFrame(frame);
      }, RING_DELAY);
    },
    { threshold: 0, rootMargin: '0px 0px -35% 0px' }
  );
  io.observe(section);

  // the orbit sleeps off-screen and resumes when scrolled back
  whileVisible(canvas, (v) => {
    visible = v;
    if (v && started && !rafId) rafId = requestAnimationFrame(frame);
  });

  window.addEventListener('resize', () => {
    ring = build(canvas);
    if (started && !visible && t0 >= 0) drawResolved(0);
  });
}
