// Hero visual — a particle chess knight on a low, rotated diamond board,
// its candidate moves drawn as faint telemetry L-paths and one lit as the
// secured move. The board + paths are drawn on canvas; the knight is the
// finished transparent PNG, only placed (never regenerated).
//
// Projection is affine (parallel), lifted directly off blueprint.png: the
// two axes below are the measured screen vectors of one chess square's
// edges, so the camera matches the blueprint. This file builds the STATIC
// resting composition; the load-in animation is added separately.

import { clamp, easeOut, rng, fitCanvas, whileVisible, reducedMotion, DOT } from './util.js';

// --- projection: symmetric shallow isometric. Both axes ~27° below the
//     horizontal (|dy/dx| = 0.45/0.89 ≈ 0.5), so squares read as a clean,
//     un-sheared diamond. Scaled by `k` (cell edge, px) at render time. ---
const AX = { x: 0.89, y: 0.45 };   // +col — down-right board axis (26.8°)
const AY = { x: -0.89, y: 0.45 };  // +row — down-left board axis (26.8°)

// legal knight L-moves (col,row). The secured move lands straight below the
// knight — that is (1,2), drawn as the dogleg down-left×2 → down-right×1.
const SECURED = { c: 1, r: 2 };
const CANDIDATES = [
  { c: 2, r: 1 }, { c: -1, r: 2 }, { c: -2, r: 1 }, { c: -2, r: -1 },
  { c: -1, r: -2 }, { c: 1, r: -2 }, { c: 2, r: -1 },
];

const KNIGHT_SRC = 'assets/knight.png?v=33';

export function initHero() {
  const hero = document.getElementById('hero');
  const canvas = document.getElementById('hero-canvas');
  if (!hero || !canvas) return;

  const img = new Image();
  let imgReady = false;
  img.onload = () => { imgReady = true; scene && scene.redraw(); };
  img.src = KNIGHT_SRC;

  const scene = run(hero, canvas, () => imgReady ? img : null);

  // fonts must be ready before the label text measures/renders crisply
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => scene.redraw());
  }
}

function run(hero, canvas, getImg) {
  let V = null; // view: ctx, w, h, mobile, home {x,y}, unit, cell basis

  function measure() {
    const { ctx, w, h } = fitCanvas(canvas);
    const mobile = w < 821;
    // k = cell edge (px). Matches Blueprint 3 (~117 @ 1440); the dissolve keeps
    // the board contained in the right portion with no bleed off any edge.
    const unit = clamp(w * (mobile ? 0.11 : 0.081), 80, 130);
    // home square: right-of-centre on desktop (copy sits left), lower-mid on
    // mobile (copy sits above)
    const home = mobile
      ? { x: w * 0.54, y: h * 0.60 }
      : { x: w * 0.742, y: h * 0.59 };
    // board dissolves before it reaches the copy column (desktop) so the
    // headline keeps clean negative space to its right
    const copyEdge = mobile ? { x0: -1, x1: -1 } : { x0: w * 0.48, x1: w * 0.62 };
    // --- TRUE PERSPECTIVE (homography). The board is a flat grid on the ground
    //     plane, camera tilted down: near (front) cells are ~1.5x the far (back)
    //     cells, and the front-edge diamond sits at ~27deg. D shrinks toward the
    //     back so cells foreshorten; a parallel grid (uniform D) would read flat.
    //       x = homeX + Q*(c-r)/D ,  y = HOR + P/D ,  D = D0 - t*(c+r)
    //     Q/D0 = 0.89*unit (home half-diagonal); P set for the 27deg front angle;
    //     HOR pins the home cell (0,0) to (homeX, homeY). ---
    const D0 = 3, tt = 0.16;
    const Q = 0.89 * unit * D0;
    const P = 0.51 * Q * D0 / tt;            // tan(27deg) ~ 0.51
    const HOR = home.y - P / D0;
    V = { ctx, w, h, mobile, home, unit, copyEdge, D0, tt, Q, P, HOR };
  }

  // 0 over the copy column, 1 out in the open (desktop only)
  function xFade(x) {
    const { x0, x1 } = V.copyEdge;
    if (x1 < 0) return 1;
    return clamp((x - x0) / (x1 - x0), 0, 1);
  }

  // board (col,row) -> screen, via the perspective homography
  const S = (c, r) => {
    const D = V.D0 - V.tt * (c + r);
    return { x: V.home.x + V.Q * (c - r) / D, y: V.HOR + V.P / D };
  };

  // four corners of a square centred on (c,r)
  const quad = (c, r) => [
    S(c - 0.5, r - 0.5), S(c + 0.5, r - 0.5),
    S(c + 0.5, r + 0.5), S(c - 0.5, r + 0.5),
  ];

  // half-size diamond centred in a cell — the target boxes use this so all
  // eight read as small, uniform, centred boxes (declutters the board)
  const HALF = 0.25;
  const halfQuad = (c, r) => [
    S(c - HALF, r - HALF), S(c + HALF, r - HALF),
    S(c + HALF, r + HALF), S(c - HALF, r + HALF),
  ];

  // distance falloff (board units) -> 0..1, dense near knight, gone at edge
  function fade(c, r) {
    const d = Math.hypot(c, r);
    return clamp(1 - (d - 1.1) / 1.9, 0, 1);
  }
  const smooth = (t) => t * t * (3 - 2 * t);

  const dotPx = () => Math.max(1, V.unit / 58);

  // --- Board texture (matches original-render): each cell is traced by a
  //     DARKER DOTTED OUTLINE (the primary structure) with a LIGHT, AIRY, SPARSE
  //     interior fill. Definition FALLS OFF with distance from the knight — near
  //     cells have the clearest outline + fill; far cells thin out and dissolve
  //     to white (dots blended toward white by the falloff, then gradient masks
  //     clean the outer edges). ---
  const BOARD = {
    outline: [150, 150, 150], // dotted cell-edge dots (darker, primary)
    fill: [176, 176, 176],    // black-cell interior dots — a step lighter
    R: 3,                     // compact set of cells around the knight
  };

  // blend an [r,g,b] toward white by (1-f): f=1 full colour, f=0 white
  const blend = (rgb, f) =>
    `rgb(${Math.round(255 + (rgb[0] - 255) * f)},${Math.round(255 + (rgb[1] - 255) * f)},${Math.round(255 + (rgb[2] - 255) * f)})`;

  // definition falloff: 1 at the knight, dissolving to 0 with distance
  const falloff = (c, r) => smooth(clamp(1 - (Math.hypot(c, r) - 0.6) / 2.6, 0, 1));

  // dotted run of small dots between two screen points, spaced in screen px
  function edgeDots(cx, a, b, colour) {
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(2, Math.round(len / 7));
    cx.fillStyle = colour;
    const sz = 1.5;
    for (let i = 0; i <= n; i++) {
      const x = a.x + (b.x - a.x) * i / n, y = a.y + (b.y - a.y) * i / n;
      cx.fillRect(x - sz / 2, y - sz / 2, sz, sz);
    }
  }

  // The board is static — build its bitmap once and blit it each frame (the
  // per-frame path animation must not rebuild this heavy dot field).
  let boardCache = null;
  function blitBoard() {
    if (!boardCache) boardCache = buildBoard();
    V.ctx.drawImage(boardCache, 0, 0, V.w, V.h);
  }

  function buildBoard() {
    const { w, h } = V;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const off = document.createElement('canvas');
    off.width = Math.round(w * dpr);
    off.height = Math.round(h * dpr);
    const cx = off.getContext('2d');
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const { outline, fill, R } = BOARD;
    for (let c = -R; c <= R; c++) {
      for (let r = -R; r <= R; r++) {
        const f = falloff(c, r);
        if (f <= 0.02) continue;
        const q = quad(c, r);
        // dotted outline — the primary structure (every cell)
        const oc = blend(outline, f);
        for (let e = 0; e < 4; e++) edgeDots(cx, q[e], q[(e + 1) % 4], oc);
        // fill the BLACK (dark checker) cells with interior dots at the SAME
        // pitch + size as the outline, a step lighter; white cells stay
        // outline-only (the home cell (0,0) is white — knight stands clear)
        if (((c + r) & 1) === 1) {
          let per = 0;
          for (let e = 0; e < 4; e++) {
            per += Math.hypot(q[(e + 1) % 4].x - q[e].x, q[(e + 1) % 4].y - q[e].y);
          }
          const G = Math.max(2, Math.round(per / 4 / 7)); // 7px pitch (= edgeDots)
          cx.fillStyle = blend(fill, f);
          for (let i = 1; i < G; i++) {
            for (let j = 1; j < G; j++) {
              const p = S(c - 0.5 + i / G, r - 0.5 + j / G);
              cx.fillRect(p.x - 0.75, p.y - 0.75, 1.5, 1.5);
            }
          }
        }
      }
    }
    fadeBoardEdges(cx);
    return off;
  }

  // Dissolve the board into white with gradient masks on all four sides —
  // strongest at the edges, clearest around the knight. Erases the board
  // layer so the white page shows through; the underlying dots stay uniform.
  function fadeBoardEdges(cx) {
    const { w, h, mobile } = V;
    cx.save();
    cx.globalCompositeOperation = 'destination-out';
    const band = (x0, y0, x1, y1, rx, ry, rw, rh) => {
      const g = cx.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      cx.fillStyle = g;
      cx.fillRect(rx, ry, rw, rh);
    };
    // left — dissolve before the copy column (desktop); right; top. No bottom
    // band: the front (nearest) row of cells must stay fully visible, and the
    // distance falloff already lightens them.
    const lx0 = (mobile ? 0.14 : 0.50) * w, lx1 = (mobile ? 0.34 : 0.62) * w;
    band(lx0, 0, lx1, 0, 0, 0, lx1, h);
    band(w, 0, 0.93 * w, 0, 0.93 * w, 0, w - 0.93 * w, h);
    band(0, 0.02 * h, 0, 0.20 * h, 0, 0, w, 0.20 * h);
    cx.restore();
  }

  // ============================================================
  //  Move-paths + targets layer (drawn between board and knight)
  // ============================================================
  // The eight legal knight L-moves. SECURED (1,2) is the black move with the
  // full telemetry target; the other seven are subordinate grey candidates.
  // Colour discipline: black = secured path + target ONLY, everything else grey.
  const MOVES = [SECURED, ...CANDIDATES];
  const PATH = { black: '#141415', grey: '#8a8a8a' }; // candidates lighter/fainter
  const isSecured = (m) => m.c === SECURED.c && m.r === SECURED.r;

  // Per-move dogleg routing TRACED from the reference (asymmetric — not a
  // symmetric fan). 'r' = go along the row axis first then the column; 'c' =
  // column axis first then row. (2,1) is a bespoke staircase per the drawing.
  const ROUTES = {
    '1,2': 'r', '-1,2': 'r', '-2,1': 'r',
    '2,-1': 'r', '1,-2': 'r', '-1,-2': 'r', '-2,-1': 'c',
  };
  // explicit waypoint routes (board coords) where a simple dogleg is wrong
  const STAIR = { '2,1': [[0, 0], [1, 0], [1, 1], [2, 1]] };
  const sign = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);
  // the secured box is the larger, primary marker; candidates stay small + quiet
  const boxHalf = (m) => (isSecured(m) ? 0.26 : 0.19);
  const boxQuad = (c, r, h) => [S(c - h, r - h), S(c + h, r - h), S(c + h, r + h), S(c - h, r + h)];

  // route waypoints; the final point stops at the target box's near EDGE
  // (boxHalf back from the cell centre) so the path meets the box cleanly.
  function legPoints(m) {
    const h = boxHalf(m);
    const key = m.c + ',' + m.r;
    if (STAIR[key]) {
      const w = STAIR[key].map(([c, r]) => ({ c, r }));
      const a = w[w.length - 2], b = w[w.length - 1];
      if (a.r === b.r) b.c -= h * sign(b.c - a.c); else b.r -= h * sign(b.r - a.r);
      return w;
    }
    if (ROUTES[key] === 'r') {
      return [{ c: 0, r: 0 }, { c: 0, r: m.r }, { c: m.c - h * sign(m.c), r: m.r }];
    }
    return [{ c: 0, r: 0 }, { c: m.c, r: 0 }, { c: m.c, r: m.r - h * sign(m.r) }];
  }

  // ordered board-space dots along the dogleg, from the knight outward, at a
  // pitch that carries the board's dot language + foreshortens with it. This
  // ordering IS the animation structure: reveal dots 0..k to draw a path out.
  function pathSamples(m) {
    const pts = legPoints(m);
    const out = [];
    const PP = isSecured(m) ? 0.07 : 0.09; // bigger, evenly-spaced dots (clear gaps)
    for (let s = 0; s < pts.length - 1; s++) {
      const a = pts[s], b = pts[s + 1];
      const seg = Math.hypot(b.c - a.c, b.r - a.r);
      const n = Math.max(1, Math.round(seg / PP));
      for (let i = s === 0 ? 0 : 1; i <= n; i++) {
        const t = i / n;
        out.push({ c: a.c + (b.c - a.c) * t, r: a.r + (b.r - a.r) * t });
      }
    }
    return out; // index 0 = at the knight, last = at the target
  }

  // animation-ready structure: each move carries its ordered dot list
  let PATHS = null;
  const buildPaths = () => { PATHS = MOVES.map((m) => ({ m, secured: isSecured(m), dots: pathSamples(m) })); };

  function edgeDotRun(a, b, colour, sz) {
    const { ctx } = V;
    const n = Math.max(2, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 6));
    ctx.fillStyle = colour;
    for (let i = 0; i <= n; i++) {
      const x = a.x + (b.x - a.x) * i / n, y = a.y + (b.y - a.y) * i / n;
      ctx.fillRect(x - sz / 2, y - sz / 2, sz, sz);
    }
  }

  // one move's dots + target box. `reveal` (0..1) = fraction of the ordered
  // path drawn from the knight; `targetOp` (0..1) fades the target in once the
  // path has reached it.
  function drawMove(p, reveal, targetOp) {
    const { ctx } = V;
    const colour = p.secured ? PATH.black : PATH.grey;
    const psz = p.secured ? 3.0 : 2.4;   // bigger dots
    const nShow = Math.round(p.dots.length * clamp(reveal, 0, 1));
    ctx.fillStyle = colour;
    for (let i = 0; i < nShow; i++) {
      const s = S(p.dots[i].c, p.dots[i].r);
      ctx.fillRect(s.x - psz / 2, s.y - psz / 2, psz, psz);
    }
    if (targetOp <= 0.001) return;
    ctx.globalAlpha = clamp(targetOp, 0, 1);
    // target box: half-size diamond centred in the destination cell. The
    // secured box is larger + carries full telemetry; candidates stay small.
    const q = boxQuad(p.m.c, p.m.r, boxHalf(p.m));
    for (let e = 0; e < 4; e++) edgeDotRun(q[e], q[(e + 1) % 4], colour, p.secured ? 2.6 : 1.8);
    const centre = S(p.m.c, p.m.r);
    if (p.secured) {
      ctx.strokeStyle = PATH.black;
      ctx.lineWidth = 2.5;
      const arm = 0.34;
      for (let i = 0; i < 4; i++) {
        const cur = q[i], prev = q[(i + 3) % 4], next = q[(i + 1) % 4];
        ctx.beginPath();
        ctx.moveTo(cur.x + (prev.x - cur.x) * arm, cur.y + (prev.y - cur.y) * arm);
        ctx.lineTo(cur.x, cur.y);
        ctx.lineTo(cur.x + (next.x - cur.x) * arm, cur.y + (next.y - cur.y) * arm);
        ctx.stroke();
      }
      ctx.fillStyle = PATH.black;
      ctx.beginPath();
      ctx.arc(centre.x, centre.y, 3.6, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = colour;
      ctx.beginPath();
      ctx.arc(centre.x, centre.y, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // full paths layer, driven by the animation `state`. Candidates draw together,
  // then the secured path, then the secured label (see ANIM timeline).
  function drawPaths(st) {
    if (!PATHS) buildPaths();
    const { ctx } = V;
    ctx.save();
    // dots sit directly on the board (no white lanes). Grey candidates first,
    // secured last so it stays on top.
    for (const p of PATHS) if (!p.secured) drawMove(p, st.candReveal, st.candTargetOp);
    const sec = PATHS.find((p) => p.secured);
    if (sec) drawMove(sec, st.secReveal, st.secTargetOp);
    if (st.labelOp > 0.001) drawSecuredLabel(st.labelOp);
    ctx.restore();
  }

  function drawSecuredLabel(op) {
    const { ctx } = V;
    ctx.globalAlpha = clamp(op, 0, 1);
    const right = boxQuad(SECURED.c, SECURED.r, boxHalf(SECURED))[1];
    const lx = right.x + 34, ly = right.y + 4;
    ctx.strokeStyle = PATH.black;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(right.x + 8, right.y);
    ctx.lineTo(lx - 8, ly - 4);
    ctx.stroke();
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.letterSpacing = '2px';
    ctx.fillStyle = PATH.black;
    ctx.font = '600 13px "Geist Mono", ui-monospace, monospace';
    ctx.fillText('SECURED MOVE', lx, ly);
    ctx.letterSpacing = '1px';
    ctx.fillStyle = '#737373';
    ctx.font = '400 10px "Geist Mono", ui-monospace, monospace';
    ctx.fillText('NEXT. BEST. MOVE.', lx, ly + 17);
    ctx.letterSpacing = '0px';
    ctx.globalAlpha = 1;
  }

  function drawKnight() {
    const img = getImg();
    if (!img) return;
    const { ctx } = V;
    const home = V.home;
    // home cell in perspective: horizontal diagonal + near (front) corner
    const cellW = S(0.5, -0.5).x - S(-0.5, 0.5).x;
    const kW = cellW * 1.02;              // footprint contained within one cell
    const kH = kW * (img.height / img.width);
    // seat the base ellipse CENTRED in the single home cell — bottom sits near
    // the cell's near (front) corner so the piece reads planted in the square
    const baseY = home.y + (S(0.5, 0.5).y - home.y) * 1.1;
    const x = home.x - kW / 2;
    const y = baseY - kH;
    ctx.drawImage(img, x, y, kW, kH);
  }

  function render(st) {
    if (!V) measure();
    const { ctx, w, h } = V;
    ctx.clearRect(0, 0, w, h);
    blitBoard();               // static board (cached bitmap)
    drawPaths(st);             // animated paths + targets + label
    drawKnight();              // on top, occludes the path behind its base
  }

  // --- draw-out animation (plays once, AFTER the title has animated in) ---
  //   candidates draw together -> their targets resolve -> the secured path
  //   draws last -> the secured target -> the SECURED MOVE label, last of all.
  const EMPTY = { candReveal: 0, candTargetOp: 0, secReveal: 0, secTargetOp: 0, labelOp: 0 };
  const FULL = { candReveal: 1, candTargetOp: 1, secReveal: 1, secTargetOp: 1, labelOp: 1 };
  const TITLE_IN = 1400;   // ms — hold until the headline cascade has landed
  const ANIM_END = 2600;   // ms — total length of the board sequence
  const rmp = (ms, s, d) => clamp((ms - s) / d, 0, 1);
  function stateAt(ms) {
    return {
      candReveal: easeOut(rmp(ms, 0, 780)),        // 7 candidate paths, together
      candTargetOp: smooth(rmp(ms, 780, 240)),     // their targets resolve
      secReveal: easeOut(rmp(ms, 1150, 640)),      // secured path draws, last
      secTargetOp: smooth(rmp(ms, 1810, 240)),     // secured target
      labelOp: smooth(rmp(ms, 2120, 440)),         // SECURED MOVE label, last of all
    };
  }

  let animState = EMPTY;
  const redraw = () => render(animState);

  measure();
  render(animState);           // board + knight; paths hidden until the title lands

  window.addEventListener('resize', () => { boardCache = null; measure(); render(animState); });
  whileVisible(canvas, (vis) => { if (vis) render(animState); });

  if (reducedMotion()) {
    animState = FULL;
    render(animState);
  } else {
    let t0 = -1;
    const frame = (now) => {
      if (t0 < 0) t0 = now;
      const t = now - t0;
      animState = t >= ANIM_END ? FULL : stateAt(t);
      render(animState);
      if (t < ANIM_END) requestAnimationFrame(frame);
    };
    setTimeout(() => requestAnimationFrame(frame), TITLE_IN);
  }

  return { redraw };
}
