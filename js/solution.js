// The solution — three products that read as one system, revealed as a
// pinned scroll sequence: card 1 drifts in, its graphic draws bottom-to-
// top; then card 2; then card 3. Strictly sequential, driven by scroll —
// the pin only releases once the third graphic completes. Graphics are
// code-driven SVG on a shared dot-matrix: no raster, no text, no borders
// inside.
//
// Mobile (no room to pin three stacked cards): cards arrive as they
// scroll into view, graphics playing on arrival. Reduced-motion: all
// three fully resolved, no pin.

import { clamp, easeOut, reducedMotion, DOT } from './util.js';

const SVGNS = 'http://www.w3.org/2000/svg';
const GRID = 10;   // dot pitch inside the 240×240 canvas

// the sequence is a pure function of pin progress: each card owns an
// exact third — drift in, then its graphic draws — with no gaps, so
// every bit of scroll advances something and the pin releases exactly
// when the third graphic completes
const T = 1 / 3;
const STEPS = [
  { card: [0 * T, 0 * T + 0.14], gfx: [0 * T + 0.14, 1 * T] },
  { card: [1 * T, 1 * T + 0.14], gfx: [1 * T + 0.14, 2 * T] },
  { card: [2 * T, 2 * T + 0.14], gfx: [2 * T + 0.14, 1.0] },
];
const TRAVEL = 120; // px the card rises into position — a real slide, not a fade-pop

function circle(svg, x, y, r, fill, stroke) {
  const c = document.createElementNS(SVGNS, 'circle');
  c.setAttribute('cx', x.toFixed(1));
  c.setAttribute('cy', y.toFixed(1));
  c.setAttribute('r', r);
  if (stroke) {
    c.setAttribute('fill', 'none');
    c.setAttribute('stroke', stroke);
  } else {
    c.setAttribute('fill', fill);
  }
  svg.appendChild(c);
  return c;
}

// every graphic sits on the same faint matrix
function matrix(svg) {
  for (let x = GRID / 2; x < 240; x += GRID) {
    for (let y = GRID / 2; y < 240; y += GRID) {
      const c = circle(svg, x, y, 1.1, DOT.faint);
      c.setAttribute('opacity', '0.55');
    }
  }
}

// LeoPrevent — interception. Streams rise from anchor nodes; most stop
// at different heights (the flaw caught), one clean stream reaches the top.
function buildPrevent(svg) {
  const anim = [];
  const columns = [
    { x: 35, top: 125 }, { x: 65, top: 85 }, { x: 95, top: 150 },
    { x: 125, top: 25 }, // the clean one
    { x: 155, top: 105 }, { x: 185, top: 65 }, { x: 215, top: 140 },
  ];
  for (const col of columns) {
    const clean = col.top <= 25;
    circle(svg, col.x, 225, 3.4, null, clean ? DOT.dark : DOT.mid);
    for (let y = 215; y >= col.top; y -= GRID) {
      const last = y - GRID < col.top;
      const c = circle(
        svg, col.x, y,
        last && !clean ? 2.6 : 1.7,
        clean ? DOT.dark : last ? DOT.dark : DOT.mid
      );
      anim.push({ el: c, order: 240 - y });
    }
  }
  return anim;
}

// LeoBench — ranked measurement. Three bars, three dots thick, different
// lengths: top highest (black), bottom second, middle lowest.
function buildBench(svg) {
  const anim = [];
  const bars = [
    { y: 66, len: 186, tone: DOT.dark },
    { y: 116, len: 92, tone: DOT.mid },
    { y: 166, len: 128, tone: DOT.mid },
  ];
  for (const bar of bars) {
    for (let row = 0; row < 3; row++) {
      const y = bar.y + row * 8;
      for (let x = 28; x <= 28 + bar.len; x += 8) {
        const c = circle(svg, x, y, 2, bar.tone);
        anim.push({ el: c, order: (240 - y) + x * 0.18 });
      }
    }
  }
  return anim;
}

// LeoReveal — the journey. A marker climbs a winding, checkpointed track,
// clearing stages as it passes; a faint wrong branch sits behind it.
function buildReveal(svg) {
  const anim = [];
  const track = [
    [38, 212], [116, 190], [76, 152], [146, 122], [104, 84], [172, 56], [200, 32],
  ];
  const branch = [[146, 122], [206, 136]];
  const stopAt = 0.93; // the marker stops just before the top

  const polylineDots = (pts, spacing) => {
    const out = [];
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      const d = Math.hypot(x1 - x0, y1 - y0);
      const steps = Math.floor(d / spacing);
      for (let s = i === 1 ? 0 : 1; s <= steps; s++) {
        const t = s / steps;
        out.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]);
      }
    }
    return out;
  };

  // the wrong branch: faint, static context
  for (const [x, y] of polylineDots(branch, 8)) {
    circle(svg, x, y, 1.5, DOT.faint);
  }

  const dots = polylineDots(track, 7);
  const markerIdx = Math.floor(dots.length * stopAt);
  dots.forEach(([x, y], i) => {
    const cleared = i <= markerIdx;
    const c = circle(svg, x, y, 1.7, cleared ? DOT.dark : DOT.faint);
    anim.push({ el: c, order: i * 1.6 }); // reveal travels the track
  });

  // checkpoints — cleared state decided by where they sit vs the marker
  track.forEach(([x, y]) => {
    let best = 0;
    let bestD = Infinity;
    dots.forEach(([dx, dy], i) => {
      const d = (dx - x) ** 2 + (dy - y) ** 2;
      if (d < bestD) { bestD = d; best = i; }
    });
    const cleared = best <= markerIdx;
    const c = circle(svg, x, y, 4.2, null, cleared ? DOT.dark : DOT.mid);
    anim.push({ el: c, order: best * 1.6 + 4 });
  });

  // the marker itself
  const [mx, my] = dots[markerIdx];
  const m1 = circle(svg, mx, my, 3, DOT.dark);
  const m2 = circle(svg, mx, my, 6.5, null, DOT.dark);
  anim.push({ el: m1, order: markerIdx * 1.6 + 30 });
  anim.push({ el: m2, order: markerIdx * 1.6 + 30 });
  return anim;
}

const BUILDERS = {
  'g-prevent': buildPrevent,
  'g-bench': buildBench,
  'g-reveal': buildReveal,
};

export function initSolution() {
  const section = document.getElementById('solution');
  const cards = [...document.querySelectorAll('.card')];
  if (!section || !cards.length) return;
  const still = reducedMotion();
  const mobile = window.matchMedia('(max-width: 820px)').matches;

  const sets = cards.map((card) => {
    const svg = card.querySelector('svg');
    matrix(svg);
    const anim = BUILDERS[svg.id](svg);
    const maxOrder = Math.max(...anim.map((a) => a.order));
    const minOrder = Math.min(...anim.map((a) => a.order));
    return { card, anim, maxOrder, minOrder };
  });

  if (still) {
    cards.forEach((c) => c.classList.add('is-in'));
    return;
  }

  // hide the figure dots until their moment
  for (const { anim } of sets) {
    for (const { el } of anim) el.style.opacity = '0';
  }

  if (mobile) {
    runArrival(sets);
  } else {
    runScrub(section, sets);
  }
}

/* ---------- desktop: pinned, strictly sequential, scroll-driven ---------- */

function runScrub(section, sets) {
  // cards are driven directly — no CSS transition lag under a scrub
  for (const { card } of sets) card.style.transition = 'none';

  const FADE = 26; // order-units over which each dot eases in

  function applyState(p) {
    sets.forEach(({ card, anim, maxOrder, minOrder }, i) => {
      const [ca, cb] = STEPS[i].card;
      const raw = clamp((p - ca) / (cb - ca), 0, 1);
      // fade completes early so the tail of the rise is fully visible
      card.style.opacity = easeOut(Math.min(1, raw / 0.55)).toFixed(3);
      card.style.transform = `translateY(${((1 - easeOut(raw)) * TRAVEL).toFixed(1)}px)`;

      const [ga, gb] = STEPS[i].gfx;
      const g = clamp((p - ga) / (gb - ga), 0, 1);
      // normalised to the graphic's own order range: the first pixel of
      // its scroll window already draws, the last pixel completes it
      const front = minOrder + g * (maxOrder - minOrder + FADE);
      for (const d of anim) {
        d.el.style.opacity = clamp((front - d.order) / FADE, 0, 1).toFixed(3);
      }
    });
  }

  function progress() {
    const rect = section.getBoundingClientRect();
    const scrollable = rect.height - window.innerHeight;
    if (scrollable <= 0) return 1;
    return clamp(-rect.top / scrollable, 0, 1);
  }

  let last = -1;
  let rafId = 0;
  let visible = true;

  function frame() {
    rafId = 0;
    if (!visible) return;
    // exact lock-step: state is read straight off the scroll position —
    // stop scrolling and the sequence stops exactly where it is
    const p = progress();
    if (p !== last) {
      last = p;
      applyState(p);
    }
    rafId = requestAnimationFrame(frame);
  }

  const io = new IntersectionObserver(
    (entries) => {
      visible = entries[0].isIntersecting;
      if (visible && !rafId) rafId = requestAnimationFrame(frame);
    },
    { rootMargin: '80px' }
  );
  io.observe(section);
  rafId = requestAnimationFrame(frame);
}

/* ---------- mobile: cards arrive as they scroll into view ---------- */

function runArrival(sets) {
  const bySvg = new Map(sets.map((s) => [s.card, s]));

  const playGraphic = ({ anim }) => {
    for (const { el, order } of anim) {
      el.style.transition = 'opacity 240ms ease-out';
      el.style.transitionDelay = `${Math.round(order * 3.2)}ms`;
    }
    requestAnimationFrame(() => {
      for (const { el } of anim) el.style.opacity = '1';
    });
  };

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const card = entry.target;
        io.unobserve(card);
        card.classList.add('is-in');
        setTimeout(() => playGraphic(bySvg.get(card)), 460);
      }
    },
    { threshold: 0.3 }
  );

  sets.forEach(({ card }) => io.observe(card));
}
