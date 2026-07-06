// The results — two real numbers, breathing. The 60-90% ring loads its
// dots into place and settles into a filled 60→90 arc; the ≈10s ring is
// a continuous dot spinner, one lap every 10 seconds, forever.
// Reduced-motion: the range ring holds its final state; the spinner holds still.

import { clamp, easeOut, rng, fitCanvas, whileVisible, reducedMotion, DOT } from './util.js';

const RINGS = 3;         // concentric dot rows
const ROW_GAP = 9;
const LAP_MS = 10000;

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
      dots.push({
        x: cx + Math.cos(a) * radius,
        y: cy + Math.sin(a) * radius,
        f,
        scatX: (rand() - 0.5) * 60,
        scatY: (rand() - 0.5) * 60,
        lag: rand() * 0.35,
      });
    }
  }
  return { ctx, w, h, dots };
}

// tone across the lap: mid ramp to 60, black 60→90 (the filled arc), faint tail
function rangeTone(f) {
  if (f < 0.6) return { fill: DOT.mid, alpha: 0.35 + (f / 0.6) * 0.4, r: 1.6 };
  if (f <= 0.9) return { fill: DOT.dark, alpha: 1, r: 1.9 };
  return { fill: DOT.faint, alpha: 0.9, r: 1.5 };
}

export function initResults() {
  const rangeCanvas = document.getElementById('ring-range');
  const timeCanvas = document.getElementById('ring-time');
  if (!rangeCanvas || !timeCanvas) return;
  const still = reducedMotion();

  // --- the 60-90% ring ---
  let range = buildRing(rangeCanvas);

  function drawRange(settle) {
    const { ctx, w, h, dots } = range;
    ctx.clearRect(0, 0, w, h);
    for (const d of dots) {
      const t = easeOut(clamp((settle - d.lag) / (1 - d.lag), 0, 1));
      const tone = rangeTone(d.f);
      ctx.globalAlpha = tone.alpha * t;
      ctx.fillStyle = tone.fill;
      ctx.beginPath();
      ctx.arc(d.x + d.scatX * (1 - t), d.y + d.scatY * (1 - t), tone.r, 0, 7);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  if (still) {
    drawRange(1);
  } else {
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        io.disconnect();
        const t0 = performance.now();
        const tick = (now) => {
          const t = clamp((now - t0) / 1400, 0, 1);
          drawRange(t);
          if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.5 }
    );
    io.observe(rangeCanvas);
  }

  // --- the ≈10s ring: a comet doing one lap every 10 seconds ---
  let timer = buildRing(timeCanvas);

  function drawTime(lapFrac) {
    const { ctx, w, h, dots } = timer;
    ctx.clearRect(0, 0, w, h);
    for (const d of dots) {
      // distance behind the head, in lap fractions
      const behind = (lapFrac - d.f + 1) % 1;
      const inTail = behind < 0.30;
      const heat = inTail ? 1 - behind / 0.30 : 0;
      ctx.globalAlpha = inTail ? 0.25 + 0.75 * heat : 0.55;
      ctx.fillStyle = heat > 0.55 ? DOT.dark : heat > 0.12 ? DOT.mid : DOT.faint;
      ctx.beginPath();
      ctx.arc(d.x, d.y, inTail ? 1.5 + heat * 0.6 : 1.4, 0, 7);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  if (still) {
    drawTime(0.72); // held still, tail readable
  } else {
    let visible = false;
    let rafId = 0;
    const frame = (now) => {
      rafId = 0;
      if (!visible) return;
      drawTime((now % LAP_MS) / LAP_MS);
      rafId = requestAnimationFrame(frame);
    };
    whileVisible(timeCanvas, (v) => {
      visible = v;
      if (v && !rafId) rafId = requestAnimationFrame(frame);
    });
  }

  window.addEventListener('resize', () => {
    range = buildRing(rangeCanvas);
    timer = buildRing(timeCanvas);
    drawRange(1);
    if (still) drawTime(0.72);
  });
}
