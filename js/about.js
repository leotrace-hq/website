// Team page entry. Shares the homepage's nav + reveal grammar, then
// adds this page's behaviours: the count-up figures in the stats board,
// the halftone dot patches at the section edges, and the pinned
// founder-quotes sequence (grow → resolve → flick → resolve → release).
// Module imports carry the same version as the entry script in
// team/index.html — bump them together.
import { initNav } from './nav.js?v=31';
import { initReveal } from './reveal.js?v=31';
import { clamp, lerp, easeOut, easeInOut, rng, fitCanvas, whileVisible, reducedMotion, DOT } from './util.js?v=31';

const COUNT_MS = 1200;   // per-figure count-up
const STAGGER = 150;     // block beat between figures

function initCounters() {
  const section = document.getElementById('numbers');
  const els = [...document.querySelectorAll('[data-count]')];
  if (!section || !els.length) return;
  if (reducedMotion()) return; // the HTML already holds the final values

  const fmt = (el, n) => `${n.toLocaleString('en-US')}${el.dataset.suffix || ''}`;
  els.forEach((el) => { el.textContent = fmt(el, 0); });

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
          el.textContent = fmt(el, Math.round(easeOut(t) * Number(el.dataset.count)));
        });
        if (!done) requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    },
    { threshold: 0, rootMargin: '0px 0px -12% 0px' }
  );
  io.observe(section);
}

// one dot language for the whole page: the matrix grammar (16px grid
// of jittered ink squares, organic falloff). The edge patches are a
// light dusting of it — a little drop, never a precise block.
function drawMatrixPatch(ctx, cx, cy, size, seed) {
  const half = Math.ceil(size / Q_CELL / 2);
  for (let i = -half; i <= half; i++) {
    for (let j = -half; j <= half; j++) {
      const d = Math.hypot(i, j) / half;
      const h1 = qhash(i + seed * 31, j + seed * 17);
      const f = 1 - d + (h1 - 0.5) * 0.45;
      if (f < 0.3) continue;
      const a = 0.05 + 0.24 * clamp((f - 0.3) / 0.55, 0, 1) * (0.6 + 0.4 * h1);
      const sz = f > 0.72 ? 2.2 : 1.4;
      ctx.fillStyle = `rgba(${Q_INK[0]},${Q_INK[1]},${Q_INK[2]},${a.toFixed(3)})`;
      ctx.fillRect(
        cx + i * Q_CELL + (qhash(j, i + seed) - 0.5) * 2,
        cy + j * Q_CELL + (h1 - 0.5) * 2, sz, sz);
    }
  }
}

function initDotPatches() {
  const patches = [...document.querySelectorAll('.about-dots')];
  if (!patches.length) return;
  const drawAll = () => patches.forEach((c, i) => {
    const { ctx, w, h } = fitCanvas(c);
    ctx.clearRect(0, 0, w, h);
    drawMatrixPatch(ctx, w / 2, h / 2, Math.min(w, h), 11 + i * 7);
  });
  drawAll();
  window.addEventListener('resize', drawAll);
}

// the field behind the quote cards — the home page's section-2 matrix
// grammar: a full-bleed 16px hash grid of ink squares, faint everywhere,
// rising into dense organic patches at the edges and along the bottom
const QUOTE_BLOBS = [
  [0.92, 0.08, 0.30], [0.04, 0.28, 0.26], [0.99, 0.50, 0.28],
  [0.02, 0.86, 0.36], [0.24, 1.00, 0.38], [0.52, 1.04, 0.38],
  [0.78, 0.99, 0.38], [0.97, 0.85, 0.32],
];
const Q_CELL = 16;
const Q_INK = [17, 17, 20];

function qhash(x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

function initQuoteDots() {
  const canvas = document.querySelector('.quotes__dots');
  if (!canvas) return;
  const draw = () => {
    const { ctx, w, h } = fitCanvas(canvas);
    ctx.clearRect(0, 0, w, h);
    const cols = Math.ceil(w / Q_CELL);
    const rows = Math.ceil(h / Q_CELL);
    const reach = Math.min(w, 1200);
    for (let cx = 0; cx <= cols; cx++) {
      for (let cy = 0; cy <= rows; cy++) {
        const x = cx * Q_CELL;
        const y = cy * Q_CELL;
        let f = 0;
        for (const [u, v, r] of QUOTE_BLOBS) {
          const d = Math.hypot(x - u * w, y - v * h) / (r * reach);
          f = Math.max(f, clamp(1 - d, 0, 1));
        }
        const h1 = qhash(cx, cy);
        const organic = f + (h1 - 0.5) * 0.25; // frayed patch edges
        let a, sz;
        if (organic > 0.28) {
          a = 0.2 + 0.62 * clamp((organic - 0.28) / 0.55, 0, 1) * (0.72 + 0.28 * h1);
          sz = 2.6;
        } else {
          a = 0.05 + h1 * 0.04; // the faint background matrix
          sz = 1.4;
        }
        ctx.fillStyle = `rgba(${Q_INK[0]},${Q_INK[1]},${Q_INK[2]},${a.toFixed(3)})`;
        ctx.fillRect(x + (qhash(cy, cx) - 0.5) * 2, y + (h1 - 0.5) * 2, sz, sz);
      }
    }
  };
  draw();
  window.addEventListener('resize', draw);
}

/* founder quotes: a pinned scrub in the site's pin grammar. The card
   grows in over the first fifth of the runway, the quote resolves
   one-shot, holds, then a short scrub range drives the flick — with
   the glide smoothing, it plays as a fast eased swap. Reduced motion
   skips the whole mechanism (CSS stacks both cards, resolved). */
function initQuotes() {
  const section = document.getElementById('quotes');
  const viewport = document.getElementById('quotes-viewport');
  const flow = document.getElementById('quote-flow');
  if (!section || !viewport || !flow) return;
  const items = [...flow.children];

  if (reducedMotion()) {
    items.forEach((c) => c.classList.add('is-live'));
    return;
  }
  // the waiting quote is already resolved — it slides in whole, like
  // the reference; only the first quote fades in with the card
  items[1].classList.add('is-live');

  let target = 0;
  let cur = -1;
  let gCur = -1;
  let visible = false;
  let rafId = 0;

  const progress = () => {
    const r = section.getBoundingClientRect();
    const scrollable = r.height - window.innerHeight;
    return scrollable > 0 ? clamp(-r.top / scrollable, 0, 1) : 1;
  };

  // the grow starts the moment the section enters the viewport and
  // completes shortly after it pins — continuous with the scroll, never
  // waiting for a position
  const growTarget = () => {
    const r = section.getBoundingClientRect();
    const vh = window.innerHeight;
    return clamp((vh - r.top) / (vh * 1.35), 0, 1);
  };

  function apply(p, g) {
    const ge = easeOut(g);
    viewport.style.transform = `scale(${0.62 + 0.38 * ge})`;
    viewport.style.opacity = String(0.3 + 0.7 * ge);
    // the card never moves — the content slides right-to-left through
    // it, scrubbed with the scroll (the glide keeps it silky)
    const slide = easeInOut(clamp((p - 0.32) / 0.36, 0, 1));
    const step = items[0].offsetWidth + 200; // item + flow gap
    flow.style.transform = `translateX(${(-slide * step).toFixed(2)}px)`;
    if (g > 0.88) items[0].classList.add('is-live'); // one-shot
  }

  function frame() {
    rafId = 0;
    if (!visible) return;
    target = progress();
    cur = cur < 0 ? target : lerp(cur, target, 0.16);
    if (Math.abs(cur - target) < 0.0005) cur = target;
    const gT = growTarget();
    gCur = gCur < 0 ? gT : lerp(gCur, gT, 0.16);
    if (Math.abs(gCur - gT) < 0.0005) gCur = gT;
    apply(cur, gCur);
    rafId = requestAnimationFrame(frame);
  }

  const wake = () => { if (!rafId && visible) rafId = requestAnimationFrame(frame); };
  whileVisible(section, (v) => { visible = v; wake(); });
  window.addEventListener('resize', wake);
  wake();
}

initNav();
initReveal();
initCounters();
initDotPatches();
initQuoteDots();
initQuotes();
