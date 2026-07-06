// Shared helpers for the dot system + motion.

export const reducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const lerp = (a, b, t) => a + (b - a) * t;

// smooth ease for scroll-driven values — no bounce
export const easeOut = (t) => 1 - Math.pow(1 - t, 3);
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// Deterministic RNG so the dot fields render identically every load.
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Size a canvas's backing store to its CSS box × devicePixelRatio.
// Returns {ctx, w, h} in CSS pixels; re-run on resize.
export function fitCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(rect.width * dpr));
  canvas.height = Math.max(1, Math.round(rect.height * dpr));
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w: rect.width, h: rect.height };
}

// Run cb only while el is on screen (for rAF loops that should sleep).
export function whileVisible(el, onChange) {
  const io = new IntersectionObserver(
    (entries) => onChange(entries[0].isIntersecting),
    { rootMargin: '80px' }
  );
  io.observe(el);
  return io;
}

export const DOT = {
  dark: '#141415',
  mid: '#8c8d8d',
  faint: '#dcdddd',
};
