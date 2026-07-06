// Module imports carry the same version as the entry script in
// index.html — bump them together so a cached module can never run
// against newer HTML/CSS.
import { initNav } from './nav.js?v=15';
import { initReveal } from './reveal.js?v=15';
import { initHero } from './hero-queen.js?v=15';
import { initIssue } from './issue.js?v=15';
import { initSolution } from './solution.js?v=15';
import { initResults } from './results.js?v=15';
import { initCta } from './cta.js?v=15';

initNav();
initReveal();
initHero();
initIssue();
initSolution();
initResults();
initCta();
