// Global entrance grammar: as a section scrolls into view, eyebrow →
// headline lines → body/points resolve in with a short rise-and-fade.
// CSS owns the transitions; this staggers them and flips .is-in.

import { reducedMotion } from './util.js';

export function initReveal() {
  const sections = document.querySelectorAll('[data-section]');
  if (reducedMotion()) {
    sections.forEach((s) => s.classList.add('is-in'));
    return;
  }

  sections.forEach((section) => {
    // one moment at a time: eyebrow, then headline lines, then the rest
    const beats = [
      ...section.querySelectorAll('.eyebrow[data-reveal]'),
      ...section.querySelectorAll('.line__inner'),
      ...section.querySelectorAll('[data-reveal]:not(.eyebrow)'),
    ];
    beats.forEach((el, i) => {
      el.style.transitionDelay = `${i * 150}ms`; // a gentle beat between elements
    });
  });

  // fire only once the section has genuinely entered the viewport — its
  // top must cross 35% up from the bottom edge — so the reveal plays in
  // front of the reader, not below the fold. (A fraction-of-section
  // threshold fires short sections while they're still a sliver.)
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      }
    },
    { threshold: 0, rootMargin: '0px 0px -35% 0px' }
  );

  sections.forEach((s) => io.observe(s));
}
