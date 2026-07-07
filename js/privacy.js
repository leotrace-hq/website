// Privacy policy page entry. Shares the homepage's nav + reveal
// grammar, then draws the aligned dot-grid textures at the page edges —
// regular grids (no jitter) in the site's dot tones, fading out
// radially. Static; nothing animates beyond the shared reveal.
// Module imports carry the same version as the entry script in
// privacy/index.html — bump them together.
import { initNav } from './nav.js?v=26';
import { initReveal } from './reveal.js?v=26';
import { clamp, rng, fitCanvas, DOT } from './util.js?v=26';

function drawGrid(canvas, seed) {
  const { ctx, w, h } = fitCanvas(canvas);
  ctx.clearRect(0, 0, w, h);
  const rand = rng(seed);
  const gap = 14;
  for (let x = gap / 2; x < w; x += gap) {
    for (let y = gap / 2; y < h; y += gap) {
      const d = Math.hypot(x / w - 0.5, y / h - 0.5) * 2;
      const fall = clamp(1 - d, 0, 1);
      if (fall <= 0.03) continue;
      ctx.globalAlpha = fall * (0.25 + rand() * 0.35);
      ctx.fillStyle = rand() < 0.1 ? DOT.mid : DOT.faint;
      ctx.beginPath();
      ctx.arc(x, y, 1.1, 0, 7);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function initGridTextures() {
  const grids = [...document.querySelectorAll('.privacy-grid')];
  if (!grids.length) return;
  const drawAll = () => grids.forEach((c, i) => drawGrid(c, 29 + i * 13));
  drawAll();
  window.addEventListener('resize', drawAll);
}

initNav();
initReveal();
initGridTextures();
