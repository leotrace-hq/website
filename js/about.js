// About / team page entry. Shares the homepage's nav + reveal grammar,
// then adds this page's two behaviours: the count-up figures in the
// stats block (one-shot, on the same trigger line as the reveal) and
// the halftone dot patches at the section edges.
// Module imports carry the same version as the entry script in
// team/index.html — bump them together.
import { initNav } from './nav.js?v=24';
import { initReveal } from './reveal.js?v=24';
import { clamp, easeOut, rng, fitCanvas, reducedMotion, DOT } from './util.js?v=24';

const COUNT_MS = 1200;   // per-figure count-up
const STAGGER = 150;     // block beat between figures

function initCounters() {
  const section = document.getElementById('numbers');
  const els = [...document.querySelectorAll('.figure__value[data-count]')];
  if (!section || !els.length) return;
  if (reducedMotion()) return; // the HTML already holds the final values

  const fmt = (n) => `${n.toLocaleString('en-US')}+`;
  els.forEach((el) => { el.textContent = fmt(0); });

  // same trigger line as the shared reveal, one-shot — the numbers
  // climb while the block fades in
  const io = new IntersectionObserver(
    (entries) => {
      if (!entries[0].isIntersecting) return;
      io.disconnect();
      let t0 = -1;
      function frame(now) {
        if (t0 < 0) t0 = now;
        const elapsed = now - t0;
        let done = true;
        els.forEach((el, i) => {
          const t = clamp((elapsed - i * STAGGER) / COUNT_MS, 0, 1);
          if (t < 1) done = false;
          el.textContent = fmt(Math.round(easeOut(t) * Number(el.dataset.count)));
        });
        if (!done) requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    },
    { threshold: 0, rootMargin: '0px 0px -35% 0px' }
  );
  io.observe(section);
}

// soft dot clouds at the page edges — the site's three-tone dot system,
// deterministic, drawn once (static texture, nothing animates)
function drawPatch(canvas, seed) {
  const { ctx, w, h } = fitCanvas(canvas);
  ctx.clearRect(0, 0, w, h);
  const rand = rng(seed);
  const gap = 13;
  for (let x = gap / 2; x < w; x += gap) {
    for (let y = gap / 2; y < h; y += gap) {
      // density falls off radially from the patch centre, frayed by noise
      const d = Math.hypot(x / w - 0.5, y / h - 0.5) * 2;
      const p = clamp(1 - d, 0, 1);
      if (rand() > p * 0.9) continue;
      ctx.globalAlpha = 0.3 + rand() * 0.5;
      ctx.fillStyle = rand() < 0.18 ? DOT.mid : DOT.faint;
      ctx.beginPath();
      ctx.arc(x + (rand() - 0.5) * gap * 0.8, y + (rand() - 0.5) * gap * 0.8, 1.4, 0, 7);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function initDotPatches() {
  const patches = [...document.querySelectorAll('.about-dots')];
  if (!patches.length) return;
  const drawAll = () => patches.forEach((c, i) => drawPatch(c, 11 + i * 7));
  drawAll();
  window.addEventListener('resize', drawAll);
}

initNav();
initReveal();
initCounters();
initDotPatches();
