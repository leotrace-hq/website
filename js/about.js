// Team page entry. Shares the homepage's nav + reveal grammar, then
// adds this page's behaviours: the count-up figures in the stats board,
// the halftone dot patches at the section edges, and the pinned
// founder-quotes sequence (grow → resolve → flick → resolve → release).
// Module imports carry the same version as the entry script in
// team/index.html — bump them together.
import { initNav } from './nav.js?v=36';
import { initReveal } from './reveal.js?v=36';
import { clamp, lerp, easeOut, easeInOut, rng, fitCanvas, whileVisible, reducedMotion, DOT } from './util.js?v=36';

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

// one dot language for the whole page: the same 16px grid, one dot size
// (Q_SIZE), tone carried by density — identical rules to the quotes field
// below, so the edge patches read as the same system, just a lighter
// dusting. A radial falloff (dense at the patch centre, scattering to
// nothing at its edge) drops dots; it never modulates dot size.
function drawMatrixPatch(ctx, cx, cy, size, seed) {
  const half = Math.ceil(size / Q_CELL / 2);
  for (let i = -half; i <= half; i++) {
    for (let j = -half; j <= half; j++) {
      const d = Math.hypot(i, j) / half;
      const t = clamp(1 - d, 0, 1);          // 1 at centre → 0 at edge
      const h1 = qhash(i + seed * 31, j + seed * 17);
      // density = the chance this cell keeps its dot; peaks well below
      // full so it stays a dusting, with a frayed, organic edge
      const keep = 0.6 * t + (qhash(j + seed * 7, i + seed * 3) - 0.5) * 0.3;
      if (h1 > keep) continue;
      const a = (0.12 + 0.16 * t) * (0.7 + 0.5 * h1);
      ctx.fillStyle = `rgba(${Q_INK[0]},${Q_INK[1]},${Q_INK[2]},${a.toFixed(3)})`;
      ctx.fillRect(
        cx + i * Q_CELL + (qhash(j, i + seed) - 0.5) * 2,
        cy + j * Q_CELL + (h1 - 0.5) * 2, Q_SIZE, Q_SIZE);
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

// the field behind and below the founder quote — one continuous dot
// system on a single 16px grid: consistent dot size, spacing and ink
// throughout. Density alone carries the gradient. It's full and dense
// behind the card and below it, then dissolves and scatters as it rises,
// so the field disperses into the section above with no hard edge and no
// second treatment. (Q_CELL / Q_INK / qhash are shared with the edge
// patches above, so the whole page speaks one dot language.)
const Q_CELL = 16;
const Q_INK = [17, 17, 20];
const Q_SIZE = 2.4; // one dot size everywhere in the field

function qhash(x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

// smoothstep 0→1
function qsmooth(x) { const t = clamp(x, 0, 1); return t * t * (3 - 2 * t); }

function initQuoteDots() {
  const canvas = document.querySelector('.quotes__dots');
  if (!canvas) return;
  const draw = () => {
    const { ctx, w, h } = fitCanvas(canvas);
    ctx.clearRect(0, 0, w, h);
    const cols = Math.ceil(w / Q_CELL);
    const rows = Math.ceil(h / Q_CELL);
    for (let ci = 0; ci <= cols; ci++) {
      for (let ri = 0; ri <= rows; ri++) {
        const x = ci * Q_CELL;
        const y = ri * Q_CELL;
        // vertical position: 0 at the top of the field, 1 at the bottom.
        // dense from ~60% down (behind + below the card), scattering up
        const t = qsmooth((y / h) / 0.6);
        const h1 = qhash(ci, ri);
        // density = the chance this cell keeps its dot; the noise term
        // frays the thinning edge so it never reads as a line
        const keep = 0.06 + 0.94 * t + (qhash(ri, ci) - 0.5) * 0.1;
        if (h1 > keep) continue;
        // survivors hold a steady ink, easing off only toward the top
        const a = (0.24 + 0.2 * t) * (0.8 + 0.4 * h1);
        ctx.fillStyle = `rgba(${Q_INK[0]},${Q_INK[1]},${Q_INK[2]},${a.toFixed(3)})`;
        ctx.fillRect(
          x + (qhash(ri, ci) - 0.5) * 2,
          y + (h1 - 0.5) * 2,
          Q_SIZE, Q_SIZE);
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
  // the slide distance (item width + 200px flow gap) is constant between
  // resizes — measure it once, never inside apply(), so no forced reflow
  // happens per animation frame
  let stepW = items[0].offsetWidth + 200;

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
    flow.style.transform = `translateX(${(-slide * stepW).toFixed(2)}px)`;
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
  // will-change is a scalpel: promote the transformed layers only while
  // the section is on screen, and drop the promotion when it sleeps
  whileVisible(section, (v) => {
    visible = v;
    const wc = v ? 'transform' : 'auto';
    viewport.style.willChange = wc;
    flow.style.willChange = wc;
    wake();
  });
  window.addEventListener('resize', () => { stepW = items[0].offsetWidth + 200; wake(); });
  wake();
}

initNav();
initReveal();
initCounters();
initDotPatches();
initQuoteDots();
initQuotes();
