// The hero scene — sampled from the reference artwork, pre-baked. The
// dot list (assets/hero-dots.json) is generated offline by scanning the
// reference image: one dot per stipple dot via local-maxima detection,
// brightness mapped gradually to tone/alpha. The rendered cloud IS the
// reference picture — pieces, camera, board, ambient — dot-for-dot,
// re-toned dark-on-light. No geometry, no modelling.
//
// Behaviour: the scene resolves in on load; the hero is pinned and
// scroll drives the Knight's move — his own dots dissolve into mist in
// place, hold for a beat (the Queen exposed), then re-materialise on
// the shield square in front of her. No journey across the board; the
// environment never moves. Reduced-motion: the shielded end state.

import { clamp, lerp, easeOut, easeInOut, rng, fitCanvas, whileVisible, reducedMotion, DOT } from './util.js';

const SRC = 'assets/hero-dots.json';
const TONES = [DOT.dark, DOT.mid, DOT.faint];

// the Knight's own pixels in the reference (uv fractions): head/neck
// block above, plinth block below — board and ambient dots excluded so
// the environment stays intact when he moves
function isKnightUV(u, v) {
  if (u >= 0.05 && u <= 0.368 && v >= 0.385 && v <= 0.72) return true;
  if (u >= 0.145 && u <= 0.335 && v > 0.72 && v <= 0.925) return true;
  return false;
}

// re-materialise position: the shield square in front of the Queen
const KNIGHT_CENTER = { u: 0.235, v: 0.65 };
const MOVE_DELTA = { u: 0.44, v: 0.10 };
const MOVE_SCALE = 1.08;

// scroll choreography: dissolve in place → hold as mist → reform
const MOVE_START = 0.18;
const MOVE_END = 0.85;
const DISSOLVE_END = 0.36;  // of the move
const HOLD_END = 0.56;

export function initHero() {
  const hero = document.getElementById('hero');
  const canvas = document.getElementById('queen-canvas');
  if (!hero || !canvas) return;

  fetch(SRC)
    .then((r) => r.json())
    .then((flat) => run(hero, canvas, buildDots(flat)))
    .catch(() => { /* the hero copy stands on its own */ });
}

function buildDots(flat) {
  const rand = rng(31);
  const dots = [];
  for (let i = 0; i < flat.length; i += 4) {
    const u = flat[i] / 1000;
    const v = flat[i + 1] / 1000;
    const scatA = rand() * Math.PI * 2;
    dots.push({
      u, v,
      tone: TONES[flat[i + 2]],
      alpha: flat[i + 3] / 100,
      knight: isKnightUV(u, v),
      scatX: Math.cos(scatA),
      scatY: Math.sin(scatA),
      scatMag: 0.35 + 0.65 * Math.pow(rand(), 0.6),
      lag: rand() * 0.3,
    });
  }
  // synthesised board texture inside the plinth's footprint, so the
  // origin square reads as a complete empty square once he has left
  for (let i = 0; i < 130; i++) {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand());
    const scatA = rand() * Math.PI * 2;
    dots.push({
      u: 0.2425 + Math.cos(a) * r * 0.092,
      v: 0.905 + Math.sin(a) * r * 0.026,
      tone: rand() < 0.3 ? DOT.mid : DOT.faint,
      alpha: 0.4 + 0.3 * rand(),
      knight: false,
      scatX: Math.cos(scatA),
      scatY: Math.sin(scatA),
      scatMag: 0.35 + 0.65 * Math.pow(rand(), 0.6),
      lag: rand() * 0.3,
    });
  }
  return dots;
}

function run(hero, canvas, dots) {
  const aspect = 1600 / 1045;
  let view = null;
  let baked = null;

  function measure() {
    const { ctx, w, h } = fitCanvas(canvas);
    const mobile = w < 821;
    let rw, rh, rx, ry;
    if (mobile) {
      rw = w * 0.96;
      rh = rw / aspect;
      rx = (w - rw) / 2;
      ry = h * 0.97 - rh;
    } else {
      rh = h * 0.60;
      rw = rh * aspect;
      rx = w * 0.99 - rw;
      ry = h * 0.90 - rh;
    }
    view = { ctx, w, h, mobile, rect: { x: rx, y: ry, w: rw, h: rh } };
    baked = null;
  }

  // even, fine stipple: uniform dot size per tone; alpha carries the form
  const sizeOf = (d) => (d.tone === DOT.dark ? 1.35 : 1.25) * (view.rect.w / 830);

  function bakeStatic() {
    const { w, h } = view;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const off = document.createElement('canvas');
    off.width = Math.round(w * dpr);
    off.height = Math.round(h * dpr);
    const ctx = off.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const d of dots) {
      if (d.knight) continue;
      ctx.globalAlpha = d.alpha;
      ctx.fillStyle = d.tone;
      const sz = sizeOf(d);
      ctx.fillRect(view.rect.x + d.u * view.rect.w, view.rect.y + d.v * view.rect.h, sz, sz);
    }
    baked = off;
  }

  // dissolve in place → hold → reform at the shield square
  function knightState(p, lag) {
    const m = clamp((p - MOVE_START) / (MOVE_END - MOVE_START), 0, 1);
    let env;
    if (m <= DISSOLVE_END) {
      env = easeInOut(clamp((m / DISSOLVE_END - lag * 0.2) / (1 - lag * 0.2), 0, 1));
    } else if (m <= HOLD_END) {
      env = 1;
    } else {
      env = 1 - easeInOut(clamp(((m - HOLD_END) / (1 - HOLD_END) - lag * 0.2) / (1 - lag * 0.2), 0, 1));
    }
    // the base position swaps while fully misted — no visible journey
    return { env, atTarget: m > (DISSOLVE_END + HOLD_END) / 2 };
  }

  function draw(p, entry) {
    const { ctx, w, h, mobile, rect } = view;
    ctx.clearRect(0, 0, w, h);
    const scatBase = mobile ? 80 : 140;
    const settled = entry >= 1;

    if (settled && !baked) bakeStatic();
    if (settled) ctx.drawImage(baked, 0, 0, w, h);

    for (const d of dots) {
      if (settled && !d.knight) continue;

      let u = d.u;
      let v = d.v;
      let env = 0;
      let fore = 0;

      if (d.knight) {
        const st = knightState(p, d.lag);
        env = st.env;
        if (st.atTarget) {
          fore = 1;
          u = KNIGHT_CENTER.u + (d.u - KNIGHT_CENTER.u) * MOVE_SCALE + MOVE_DELTA.u;
          v = KNIGHT_CENTER.v + (d.v - KNIGHT_CENTER.v) * MOVE_SCALE + MOVE_DELTA.v;
        }
      }

      const x = rect.x + u * rect.w;
      const y = rect.y + v * rect.h;

      const dotEntry = easeOut(clamp((entry - d.lag * 0.5) / (1 - d.lag * 0.5), 0, 1));
      const amp = ((1 - dotEntry) * scatBase + env * (mobile ? 45 : 70)) * d.scatMag;

      ctx.globalAlpha = Math.min(1, d.alpha * (1 + 0.15 * fore * (1 - env)))
        * (0.15 + 0.85 * dotEntry) * (1 - 0.78 * env);
      ctx.fillStyle = d.tone;
      const sz = sizeOf(d) * (1 + (MOVE_SCALE - 1) * fore * (1 - env));
      ctx.fillRect(x + d.scatX * amp, y + d.scatY * amp - env * 6, sz, sz);
    }
    ctx.globalAlpha = 1;
  }

  measure();

  if (reducedMotion()) {
    draw(1, 1);
    window.addEventListener('resize', () => { measure(); draw(1, 1); });
    return;
  }

  let target = 0;
  let cur = -1;
  let lastDrawn = -1;
  let lastEntry = -1;
  let visible = true;
  let rafId = 0;
  let entryT0 = -1;

  function progress() {
    const r = hero.getBoundingClientRect();
    const scrollable = r.height - window.innerHeight;
    if (scrollable <= 0) return 1;
    return clamp(-r.top / scrollable, 0, 1);
  }

  function frame(time) {
    rafId = 0;
    if (!visible) return;
    if (entryT0 < 0) entryT0 = time;
    const entry = clamp((time - entryT0) / 1500, 0, 1);
    target = progress();
    cur = cur < 0 ? target : lerp(cur, target, 0.09);
    if (Math.abs(cur - target) < 0.0004) cur = target;
    if (entry !== lastEntry || cur !== lastDrawn) {
      draw(cur, entry);
      lastDrawn = cur;
      lastEntry = entry;
    }
    rafId = requestAnimationFrame(frame);
  }

  const wake = () => { if (!rafId && visible) rafId = requestAnimationFrame(frame); };

  window.addEventListener('resize', () => { measure(); lastDrawn = -1; wake(); });
  whileVisible(canvas, (v) => { visible = v; wake(); });
  wake();
}
