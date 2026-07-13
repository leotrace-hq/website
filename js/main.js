// Module imports carry the same version as the entry script in
// index.html — bump them together so a cached module can never run
// against newer HTML/CSS.
import { initNav } from './nav.js?v=41';
import { initReveal } from './reveal.js?v=41';
import { initHero } from './hero-board.js?v=41';
import { initIssue } from './issue.js?v=41';
import { initSolution } from './solution.js?v=41';
import { initResults } from './results.js?v=41';
import { initCta } from './cta.js?v=41';

initNav();
initReveal();
initHero();
initIssue();
initSolution();
initResults();
initCta();
