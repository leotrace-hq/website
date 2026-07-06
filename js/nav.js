// Mobile menu toggle + hide-on-scroll-down / show-on-scroll-up.

export function initNav() {
  const nav = document.querySelector('.nav');
  const burger = nav.querySelector('.nav__burger');

  burger.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    burger.setAttribute('aria-expanded', String(open));
  });

  nav.querySelectorAll('.nav__link').forEach((link) =>
    link.addEventListener('click', () => {
      nav.classList.remove('is-open');
      burger.setAttribute('aria-expanded', 'false');
    })
  );

  // Direction-aware chrome: pinned at the very top; hides once you scroll
  // down past the bar, returns on any upward scroll. A small delta filter
  // keeps it from flickering on rubber-band or trackpad jitter.
  let lastY = window.scrollY;
  const DELTA = 6;

  window.addEventListener(
    'scroll',
    () => {
      const y = window.scrollY;
      const moved = y - lastY;
      if (Math.abs(moved) < DELTA) return;

      if (y <= nav.offsetHeight || nav.classList.contains('is-open')) {
        nav.classList.remove('is-hidden');
      } else if (moved > 0) {
        nav.classList.add('is-hidden');
      } else {
        nav.classList.remove('is-hidden');
      }
      lastY = y;
    },
    { passive: true }
  );
}
