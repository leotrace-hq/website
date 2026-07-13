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

  // a link to the page you're already on (nav or footer) scrolls back to
  // the top instead of reloading — a same-URL reload restores the old
  // scroll position, so you'd never see the top of the page
  document.querySelectorAll('a[aria-current="page"]').forEach((link) =>
    link.addEventListener('click', (e) => {
      e.preventDefault();
      window.scrollTo({ top: 0 });
    })
  );

  // Direction-aware chrome: pinned at the very top; hides once you scroll
  // down past the bar, returns on any upward scroll. A small delta filter
  // keeps it from flickering on rubber-band or trackpad jitter.
  let lastY = window.scrollY;
  const DELTA = 6;

  // cache the bar height so the scroll handler never reads layout per tick
  // (the absolute mobile menu doesn't change it; only a resize can)
  let navH = nav.offsetHeight;
  window.addEventListener('resize', () => { navH = nav.offsetHeight; }, { passive: true });

  window.addEventListener(
    'scroll',
    () => {
      const y = window.scrollY;
      const moved = y - lastY;
      if (Math.abs(moved) < DELTA) return;

      if (y <= navH || nav.classList.contains('is-open')) {
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
