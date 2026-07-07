// Module imports carry the same version as the entry script in
// index.html — bump them together so a cached module can never run
// against newer HTML/CSS.
import { initNav } from './nav.js?v=24';
import { initReveal } from './reveal.js?v=24';
import { initHero } from './hero-queen.js?v=24';
import { initIssue } from './issue.js?v=24';
import { initSolution } from './solution.js?v=24';
import { initResults } from './results.js?v=24';
import { initCta } from './cta.js?v=24';

initNav();
initReveal();
initHero();
initIssue();
initSolution();
initResults();
initCta();
