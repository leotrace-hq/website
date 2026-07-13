# Team-page animation & scroll plan (`/team/`)

**Read-only diagnostic.** Source: `team/index.html` + `css/styles.css` + `js/about.js` (→ shared `nav.js`, `reveal.js`, `util.js`). Method: full static contract audit. (No fresh live frame-timing pass this round — the in-app preview tab throttles rAF, making in-tab sampling unreliable; verdicts are from the code, which the brief treats as source of truth.)

## Motion & scroll inventory
| # | Section | Motion | Mechanism | Scroll-linked? |
|---|---|---|---|---|
| 1 | Intro + memo (`.team`) | shared entrance reveal; static edge dot-patches | `reveal.js`; `initDotPatches` one-shot canvas draw (`about.js:73-83`) | no |
| 2 | Pivot line + stats (`.numbers`, `[data-early]`) | word-cascade reveal; **count-up figures** | `reveal.js`; `initCounters` rAF one-shot, `easeOut`, `data-count` (`about.js:14-46`) | no |
| 3 | Founder quotes (`.quotes`) | **pinned: card grows → quote resolves → flick swap → resolve** — the page's signature moment | `initQuotes` rAF eased-follow scrub over a 260vh pin (`about.js:143-208`); dots via `initQuoteDots` one-shot (`:104-136`) | yes (pin scrub) |

**Pins:** one — `.quotes` 260vh (`styles.css:1687-1689`; mobile 300vh `:1856`). Sticky child `.quotes__sticky` `:1692`.
**Listeners:** shared `nav.js` scroll (passive). `about.js` adds only `resize` + `whileVisible` IO — **no wheel/scroll/touch handler, no `preventDefault`, no `scrollTo`.** ✅
**rAF/timers:** `initCounters` one-shot rAF; `initQuotes` rAF while visible (sleeps via `whileVisible`). No `setInterval`/`setTimeout`-driven motion. ✅

## Contract audit
- **Transform/opacity only (scroll-linked):** ✅ `apply()` writes `viewport.style.transform = scale(...)`, `viewport.style.opacity`, `flow.style.transform = translateX(...)` (`about.js:181-187`). No width/height/top/left/filter/box-shadow.
- **Passive listeners / no gate:** ✅ nothing blocks scroll; the pin is native `position: sticky`, fully scrollable-through.
- **rAF for continuous motion:** ✅.
- **`will-change` scalpel:** ⚠️ **permanent** `will-change: transform` on `.quotes__viewport` (`styles.css:1715`) **and** `.quote-flow` (`:1734`) — two GPU-promoted layers left on at all times, including when the section is off-screen/at rest. Only actually transformed during the pin.
- **No per-frame layout read→write:** ⚠️ `apply()` reads `items[0].offsetWidth` **every frame** (`about.js:186`) then writes `flow.style.transform` — a forced reflow per frame during the pin. The value is constant (card width); it should be measured once. (Separately, `progress()`+`growTarget()` each call `getBoundingClientRect()` per frame — the site's standard pin-scrub pattern, shared with issue/solution; acceptable, not flagged for change here.)
- **Batch DOM writes:** ✅ transforms are on two grouped elements, not per-node.
- **Reduced motion:** ✅ `initQuotes` early-returns and stacks both cards live (`about.js:150-153`); CSS unpins + `transform:none !important` (`styles.css:1836-1853`); `initCounters` returns (HTML holds finals, `:18`); dot canvases draw static. Clean, at home-page parity.

## The one signature moment
The pinned quote **grow → flick** is the right single beat for the page — keep it. It is spring-like (eased follow `lerp(...,0.16)`, `about.js:195,198`), scroll-driven, and fully scrollable-through. No second effect competes. **No re-design needed** — only the two hygiene fixes below.

---

## Per-section plan

### T1 · Intro + memo — no change
- **Current:** shared reveal + static dot-patches. **Target feel:** unchanged. **Change:** none. **Reduced motion:** reveal resolved (shared). **Risk:** none. **Verify:** visual — reveal plays once on entry.

### T2 · Pivot + stats count-up — no change (optional polish)
- **Current:** figures count up once on entry via rAF `easeOut` (`about.js:14-46`). Clean and on-vocabulary. **Target feel:** unchanged. **Change:** none required. *(Optional: the count writes `textContent` each frame — cheap, tabular figures prevent reflow jitter; leave as is.)* **Reduced motion:** returns early, HTML shows finals. **Risk:** none. **Verify:** figures climb once, settle.

### T3 · Founder quotes — keep the moment, apply two hygiene fixes
- **Current problem:**
  1. Permanent `will-change: transform` on `.quotes__viewport` + `.quote-flow` (`styles.css:1715,1734`) — always-on layer promotion (GPU memory) even when the section is nowhere near the viewport.
  2. `items[0].offsetWidth` read inside the per-frame `apply()` (`about.js:186`) — a forced reflow every animation frame; the width never changes between resizes.
- **Target feel:** identical motion (grow + flick), but the promotion is scoped to when it's animating and the per-frame reflow is gone — smoother on mid-range GPUs, no idle cost.
- **Exact change (implementation phase):**
  - Remove the two static `will-change: transform` declarations from CSS (`styles.css:1715,1734`); instead set `will-change` on `.quotes__viewport`/`.quote-flow` from `about.js` when `whileVisible` reports the section visible and clear it (`will-change:auto`) when it sleeps (hook into the existing `whileVisible` callback, `about.js:205`).
  - Hoist the card-width read: measure `items[0].offsetWidth` once in `initQuotes` (and on `resize`, where `wake()` already fires, `:206`), store it, and use the cached value inside `apply()`; drop the per-frame read at `:186`.
- **Reduced-motion end-state:** unchanged — cards stacked, resolved, no pin (`styles.css:1836-1853`); JS early-return (`about.js:150`). `will-change` is never set in this branch (the rAF loop never runs).
- **Risk:** low. Scoping `will-change` via JS is behaviour-neutral; hoisting a constant read is behaviour-neutral. Watch: set `will-change` *before* the first transform of a wake cycle so the first flick frame is already promoted.
- **Verify:** DevTools Layers — confirm the two layers exist only while `.quotes` is in view and are gone at rest; Performance trace over the pin — confirm no "Recalculate/Layout" forced-reflow marker per frame from `apply()`.

## Cross-page note
The count-up (T2) and the pinned scrub (T3) share the home page's vocabulary (eased follow ~0.12–0.19, reveal grammar from `reveal.js`). Motion reads as one system. The only shared-infra item touching this page is `nav.js:42` (see the site summary).
