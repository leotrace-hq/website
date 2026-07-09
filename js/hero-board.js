// Hero visual — a particle chess knight on a low, rotated diamond board,
// its candidate moves drawn as faint telemetry L-paths and one lit as the
// secured move. The board + paths are drawn on canvas; the knight is the
// finished transparent PNG, only placed (never regenerated).
//
// Projection is affine (parallel), lifted directly off blueprint.png: the
// two axes below are the measured screen vectors of one chess square's
// edges, so the camera matches the blueprint. This file builds the STATIC
// resting composition; the load-in animation is added separately.

import { clamp, rng, fitCanvas, whileVisible, reducedMotion, DOT } from './util.js';

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

const KNIGHT_SRC = 'assets/knight.png?v=32';

export function initHero() {
  const hero = document.getElementById('hero');
  const canvas = document.getElementById('hero-canvas');
  if (!hero || !canvas) return;

  const img = new Image();
  let imgReady = false;
  img.onload = () => { imgReady = true; scene && scene.render(); };
  img.src = KNIGHT_SRC;

  const scene = run(hero, canvas, () => imgReady ? img : null);

  // fonts must be ready before the label text measures/renders crisply
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => scene.render());
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

  function drawBoard() {
    const { ctx, w, h } = V;
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
    ctx.drawImage(off, 0, 0, w, h);
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

  // dotted line between two board points, sampled at fixed screen spacing
  function dottedLine(p0, p1, { gap, sz, tone, alpha }) {
    const { ctx } = V;
    const a = S(p0.c, p0.r), b = S(p1.c, p1.r);
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.max(1, Math.round(len / gap));
    ctx.fillStyle = tone;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = a.x + (b.x - a.x) * t;
      const y = a.y + (b.y - a.y) * t;
      ctx.globalAlpha = alpha(t) * xFade(x);
      ctx.fillRect(x - sz / 2, y - sz / 2, sz, sz);
    }
    ctx.globalAlpha = 1;
  }

  // dogleg L-route: long axis first, then the short step
  function legPoints(m) {
    if (Math.abs(m.r) === 2) return [{ c: 0, r: 0 }, { c: 0, r: m.r }, { c: m.c, r: m.r }];
    return [{ c: 0, r: 0 }, { c: m.c, r: 0 }, { c: m.c, r: m.r }];
  }

  function drawCandidatePaths() {
    const { ctx } = V;
    const sz = Math.max(1, dotPx());
    for (const m of CANDIDATES) {
      const f = smooth(fade(m.c, m.r));
      if (f <= 0.04) continue;
      const pts = legPoints(m);
      for (let i = 0; i < pts.length - 1; i++) {
        dottedLine(pts[i], pts[i + 1], {
          gap: 12, sz: sz + 0.6, tone: DOT.mid,
          alpha: () => 0.9 * f,
        });
      }
      // faint ghost destination square (dotted outline)
      ghostSquare(m.c, m.r, 0.7 * f);
    }
  }

  function ghostSquare(c, r, alpha) {
    const { ctx } = V;
    const q = quad(c, r);
    const sz = Math.max(1, dotPx());
    ctx.fillStyle = DOT.mid;
    for (let e = 0; e < 4; e++) {
      const a = q[e], b = q[(e + 1) % 4];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const steps = Math.max(1, Math.round(len / 11));
      for (let i = 0; i < steps; i++) {
        const t = i / steps;
        const x = a.x + (b.x - a.x) * t;
        const y = a.y + (b.y - a.y) * t;
        ctx.globalAlpha = alpha * xFade(x);
        ctx.fillRect(x, y, sz, sz);
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawSecured() {
    const { ctx } = V;
    const sz = dotPx() + 1; // weightier
    const pts = legPoints(SECURED);
    for (let i = 0; i < pts.length - 1; i++) {
      dottedLine(pts[i], pts[i + 1], {
        gap: 11, sz, tone: DOT.dark,
        alpha: (t) => 0.85 + 0.15 * t,
      });
    }
    drawTargetMarker(SECURED.c, SECURED.r);
    drawLabel(SECURED.c, SECURED.r);
  }

  // corner-tick brackets at the square's corners + solid centre dot
  function drawTargetMarker(c, r) {
    const { ctx } = V;
    const q = quad(c, r);
    const centre = S(c, r);
    ctx.strokeStyle = DOT.dark;
    ctx.lineWidth = 1.5;
    const armFrac = 0.34;
    for (let i = 0; i < 4; i++) {
      const cur = q[i];
      const prev = q[(i + 3) % 4];
      const next = q[(i + 1) % 4];
      const toPrev = { x: (prev.x - cur.x) * armFrac, y: (prev.y - cur.y) * armFrac };
      const toNext = { x: (next.x - cur.x) * armFrac, y: (next.y - cur.y) * armFrac };
      ctx.beginPath();
      ctx.moveTo(cur.x + toPrev.x, cur.y + toPrev.y);
      ctx.lineTo(cur.x, cur.y);
      ctx.lineTo(cur.x + toNext.x, cur.y + toNext.y);
      ctx.stroke();
    }
    // centre dot
    ctx.fillStyle = DOT.dark;
    ctx.beginPath();
    ctx.arc(centre.x, centre.y, Math.max(3, V.unit / 15), 0, Math.PI * 2);
    ctx.fill();
  }

  function drawLabel(c, r) {
    const { ctx } = V;
    const q = quad(c, r);
    // anchor: right corner of the target square, then out to the right
    const right = q[1];
    const lx = right.x + 34;
    const ly = right.y + 4;
    // leader line from square's right corner to the label
    ctx.strokeStyle = DOT.dark;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.moveTo(right.x + 6, right.y);
    ctx.lineTo(lx - 8, ly - 4);
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.letterSpacing = '2px';
    ctx.fillStyle = DOT.dark;
    ctx.font = '600 13px "Geist Mono", ui-monospace, monospace';
    ctx.fillText('SECURED MOVE', lx, ly);
    ctx.letterSpacing = '1px';
    ctx.fillStyle = '#737373'; // --text-3
    ctx.font = '400 10px "Geist Mono", ui-monospace, monospace';
    ctx.fillText('NEXT. BEST. MOVE.', lx, ly + 17);
    ctx.letterSpacing = '0px';
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

  function render() {
    if (!V) measure();
    const { ctx, w, h } = V;
    ctx.clearRect(0, 0, w, h);
    drawBoard();
    // paths + secured marker/label deferred until the board geometry is
    // approved (drawCandidatePaths / drawSecured)
    drawKnight();
  }

  measure();
  render();

  window.addEventListener('resize', () => { measure(); render(); });
  whileVisible(canvas, (vis) => { if (vis) render(); });

  return { render };
}
