// Module imports carry the same version as the entry script in
// index.html — bump them together so a cached module can never run
// against newer HTML/CSS.
import { initNav } from './nav.js?v=34';
import { initReveal } from './reveal.js?v=34';
import { initHero } from './hero-board.js?v=34';
import { initIssue } from './issue.js?v=34';
import { initSolution } from './solution.js?v=34';
import { initResults } from './results.js?v=34';
import { initCta } from './cta.js?v=34';

initNav();
initReveal();
initHero();
initIssue();
initSolution();
initResults();
initCta();
