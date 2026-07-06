// Global entrance grammar: as a section first enters the viewport, its
// eyebrow, headline and supporting copy fade in while rising gently —
// headlines cascade word by word (each word its own beat), everything
// else moves as a block. One-shot per section; never replays.
// Reduced-motion: everything resolved immediately, nothing split-styled.

import { reducedMotion } from './util.js';

const WORD_BEAT = 45;    // ms between words in a headline
const BLOCK_BEAT = 150;  // ms between block elements

// wrap an element's words in spans; existing child elements (e.g. the
// CTA's live counters) are kept whole and animate as single units
function splitWords(el) {
  el.classList.add('is-split');
  const words = [];
  for (const node of [...el.childNodes]) {
    if (node.nodeType === Node.TEXT_NODE) {
      const frag = document.createDocumentFragment();
      for (const part of node.textContent.split(/(\s+)/)) {
        if (!part) continue;
        if (/^\s+$/.test(part)) {
          frag.appendChild(document.createTextNode(part));
        } else {
          const s = document.createElement('span');
          s.className = 'w';
          s.textContent = part;
          frag.appendChild(s);
          words.push(s);
        }
      }
      node.replaceWith(frag);
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      node.classList.add('w');
      words.push(node);
    }
  }
  return words;
}

export function initReveal() {
  const sections = document.querySelectorAll('[data-section]');
  if (reducedMotion()) {
    sections.forEach((s) => s.classList.add('is-in'));
    return;
  }

  sections.forEach((section) => {
    let delay = 0;
    const block = (el) => {
      el.style.transitionDelay = `${delay}ms`;
      delay += BLOCK_BEAT;
    };

    // eyebrow leads as a block
    section.querySelectorAll('.eyebrow[data-reveal]').forEach(block);

    // headline lines cascade word by word
    const headlineParts = section.querySelectorAll('.line__inner, .cta__headline[data-reveal]');
    headlineParts.forEach((part) => {
      for (const w of splitWords(part)) {
        w.style.transitionDelay = `${delay}ms`;
        delay += WORD_BEAT;
      }
    });

    // supporting copy follows as blocks
    delay += BLOCK_BEAT - WORD_BEAT;
    section.querySelectorAll('[data-reveal]:not(.eyebrow):not(.is-split)').forEach(block);
  });

  // fire only once the section has genuinely entered the viewport — its
  // top must cross 35% up from the bottom edge — so the reveal plays in
  // front of the reader, not below the fold
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
