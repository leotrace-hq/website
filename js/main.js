// Module imports carry the same version as the entry script in
// index.html — bump them together so a cached module can never run
// against newer HTML/CSS.
import { initNav } from './nav.js?v=42';
import { initReveal } from './reveal.js?v=42';
import { initHero } from './hero-board.js?v=42';
import { initIssue } from './issue.js?v=42';
import { initSolution } from './solution.js?v=42';
import { initResults } from './results.js?v=42';
import { initCta } from './cta.js?v=42';

initNav();
initReveal();
initHero();
initIssue();
initSolution();
initResults();
initCta();
