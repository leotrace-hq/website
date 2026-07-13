# Home-page animation & scroll audit

**Scope:** read-only diagnostic of the home page (`index.html` + `css/styles.css` + `js/main.js` → `nav.js`, `reveal.js`, `hero-queen.js`, `issue.js`, `solution.js`, `results.js`, `cta.js`, `util.js`), at asset version v31.
**Method:** full static code audit **plus** a live frame-timing pass (Playwright driving system Chrome at 1440×900 on a 120 Hz machine: rAF-gap sampling while wheel-scrolling through each section). DevTools Layers panel was not used; layer counts are reasoned from code, not measured.

**Headline finding:** on this (fast, 120 Hz) machine every section held ~8.3 ms average frame times with **zero dropped frames** — the raw frame rate is not where the roughness lives. The reported heaviness comes from **behavioural jank** (a hard scroll block, four back-to-back pins, scrub-without-sequencing) plus **main-thread paint work** that is within budget on an M-series laptop but will not be on mid-range hardware. The one measurable smoking gun: scrolling through Section 4, the test's wheel input ended ~900 px short of the section end — the scroll gate was eating input (`endedAt 8279` vs `sectionEnd 9180`).

---

## Step 1 — Architecture (global)

### The stack
Zero-dependency vanilla. There is **no GSAP, no ScrollTrigger, no Lenis, no CSS `animation-timeline`, no WebGL** — nothing to version.

- **Pins** are native `position: sticky` inside tall sections (the site's own "pin grammar").
- **Scrubbing** is hand-rolled: per-section `requestAnimationFrame` loops compute pin progress from `getBoundingClientRect()` and apply an eased follow (`cur += (target - cur) * k`, k = 0.09–0.19).
- **Entrance reveals** are CSS transitions on `opacity`/`transform`, triggered by `IntersectionObserver` adding `.is-in` ([reveal.js](../js/reveal.js), margins `-35%` default / `-12%` for `[data-early]` at `reveal.js:95,101`).
- **Graphics** are Canvas 2D (hero, issue spread, results ring, CTA field) and inline SVG dots (solution cards).
- Anchor scrolling uses CSS `scroll-behavior: smooth` (`styles.css:78-80`, gated on `prefers-reduced-motion: no-preference`).

### Global scroll / wheel / touch listeners
| Listener | File | Passive? | Layout read in handler | Style write same tick | Verdict |
|---|---|---|---|---|---|
| `scroll` (nav hide/show) | `nav.js:25-42` | ✅ `{passive:true}` | `nav.offsetHeight` (line 32) | class toggle → transform transition | Read-then-write each tick. Small element, cheap, but it is a per-tick layout read. |
| `wheel` (results gate, while armed) | `results.js:149-151, 166` | ❌ **`{passive:false}`** | `gateLimit()` → `getBoundingClientRect()` | `preventDefault()` | **The page's one true scroll blocker.** Non-passive wheel forces the browser to wait on JS before scrolling, for the whole ~2 s the gate is armed. |
| `scroll` (results gate clamp, while armed) | `results.js:152-155, 167` | ✅ passive | `getBoundingClientRect()` per tick | `window.scrollTo(...)` same tick | Read-then-write-scroll each tick — the clamp fights the scroller. Removed on release (`releaseGate`, 156-161; failsafe `setTimeout` 4 s at 168). |
| `scroll` (issue HUD, reduced-motion path only) | `issue.js:194` | ✅ passive | `getBoundingClientRect()` | class toggle | Only registered under reduced motion. Fine. |

No `touchmove` listeners anywhere.

### rAF / timer loops
- **Always-on-while-visible rAF loops** (all sleep via `whileVisible` / IO, `util.js:38-45`, `rootMargin: 80px`):
  - `hero-queen.js:214-234` — redraws the hero canvas whenever entry or eased scrub value changes. During the 1.5 s entry it paints **~11,600 fillRects/frame**; after settling it draws a baked offscreen composite + ~2k knight dots per frame while the scrub value changes.
  - `issue.js:204-216` — repaints the full spread field, ≈ (1440/16)×(900/16) ≈ **5,100 fillRects/frame**, every frame the eased value moves (which continues *after* the wheel stops, until the lerp converges).
  - `solution.js:238-263` — no canvas; instead writes inline styles per frame (see Section 3).
  - `results.js` — assembly/move loop, then **stops permanently** (`done` flag + baked composite). The best-behaved loop on the page.
- **Timer-driven animation (flagged — not refresh-synced):**
  - `cta.js:46` — `setInterval(tick, 1000)` for the live counter.
  - `cta.js:102` — `setInterval(drawField, 1500)` for the dot-field accrual: the fill repaints as discrete 1.5 s steps.
  - `solution.js:287` — one-shot `setTimeout(..., 460)` per card (mobile arrival path only; acceptable).

### Pin inventory (the page's spine)
Four **consecutive, back-to-back** sticky pins, no unpinned breathing room between them:

| # | Section | Height | CSS | Scrub |
|---|---|---|---|---|
| 1 | Hero | **260vh** | `styles.css:345` | eased follow k=0.09 (`hero-queen.js:220`) |
| 2 | Issue | **340vh** | `styles.css:392` | eased follow k=0.12 (`issue.js:208`) |
| 3 | Solution | **220vh** | `styles.css:552` | eased follow k=0.19 (`solution.js:245`) |
| 4 | Results | **200vh** | `styles.css:676` | time-based, plus the scroll gate |

Measured section tops: hero 0, issue 2340, solution 5400, results 7380, CTA 9180 (page ≈ 10,000 px at 900 px viewport). **~73% of the page's scroll distance is pinned.** The wheel therefore rarely produces ordinary page movement — this, more than frame drops, is why scrolling "feels heavy": the scroll wheel is an animation crank for most of the page. There is no ScrollTrigger so there is no `refresh()`; the equivalent (canvas rebuilds) happens on `resize` only.

### `will-change` audit
**None on the home page.** The only two `will-change: transform` declarations in the stylesheet (`styles.css:1675, 1694`) belong to the Team page's quote stage. No over-promotion here; if anything, the scrubbed hero/issue canvases rely on canvas's natural layerization, which is fine.

### Reduced motion
Respected everywhere on the home page: `reveal.js:43-46` (everything resolved), `hero-queen.js:193-197` (end state, no scrub), `issue.js:188-197` (end state), `solution.js:182-185`, `results.js` (static resolved scene; the gate is unreachable in this branch), `cta.js:49, 95` (static field; counter still ticks — a deliberate, content-bearing exception), nav/cursor transitions gated in CSS (`styles.css:203-207, 228-230`). **No gaps found.**

---

## Step 2 — Per-section breakdown

### Section 1 — Hero (chess scene)

1. **What the user sees:** the dot scene resolves in on load; then, pinned for 260vh, scroll dissolves the knight to mist and re-materialises him in front of the tall piece.
2. **Trigger:** entry animation starts on first rAF after load (`entryT0`, `hero-queen.js:217-218`, fixed 1500 ms); the move is scrubbed by pin progress (`progress()`, 207-212).
3. **Mechanism:** Canvas 2D dot cloud from a pre-baked JSON (11.6k dots), full redraw per frame in a rAF loop; sticky pin. `hero-queen.js:89-235`, CSS `styles.css:338-384`.
4. **Animated properties:** canvas paint only (its own layer); no DOM properties animated besides the copy's shared reveal (`opacity`/`transform` ✅). **No non-composite properties.** The cost is main-thread canvas rasterisation: ~11.6k `fillRect` per frame during entry, baked-composite + knight dots during the scrub.
5. **Time-based or scrubbed:** entry time-based (1.5 s); the knight move **scroll-scrubbed** across the 260vh pin.
6. **Scroll interference:** none — no listener, no preventDefault. The pin itself is the only coupling: it costs the user 1.6 extra viewport-heights of wheel travel before Section 2.
7. **Symptom / decoupling answer:** the hero **is** coupled to scroll via (a) `.hero { height: 260vh }` + `.hero__sticky` (`styles.css:345-356`), (b) the scrub logic in `hero-queen.js` (`progress()` 207-212, `knightState()` 135-147, `MOVE_*` constants 28-37, the `cur/target` lerp 219-221), and (c) the reduced-motion height override (`styles.css:367-369`). Removing scroll behaviour touches exactly those two files and nothing else — no other module reads the hero's height; the "See how it works ↓" anchor (`index.html:44`) targets `#issue` and is unaffected. (The parked `hero-rework` branch already contains a play-on-load hero as a reference implementation.)

### Section 2 — "A flaw doesn't stay one flaw" (dot spread)

1. **What the user sees:** pinned; three points accumulate while an infection front spreads across a full-bleed dot field, with a bottom HUD (step `01/03`, progress bar, red `SPREAD %`).
2. **Trigger:** pin progress; points toggle `.is-on` at thresholds (`POINT_AT`, `issue.js:14, 122-131`).
3. **Mechanism:** Canvas 2D hash-grid field fully repainted per frame (`drawField`, `issue.js:82-120`) inside the shared rAF/eased-follow loop (204-216); the HUD is DOM (`index.html:87-91`, CSS `styles.css:492-528`).
4. **Animated properties:** canvas paint; points use `opacity`/`transform` ✅; HUD uses `opacity` ✅ and `transform: scaleX` ✅ for retraction — **but the bar fill animates `width` (`barEl.style.width = %`, `issue.js:132`) — non-composite, forces layout every frame for the entire pin.** Prime suspect flagged.
5. **Time-based or scrubbed:** fully scroll-scrubbed (eased follow k=0.12 — repaints continue briefly after the wheel stops until the lerp converges).
6. **Scroll interference:** none.
7. **Root cause of "the progress indicator vanishes when you scroll down":** two stacked causes in `updateHud` (`issue.js:139-144`) —
   - it is keyed to the **raw, instantaneous** progress (`updateHud(target)`, line 214) while the visible content is keyed to the **eased** value (`applyState(cur)`); and
   - it hides early: `is-done` at `p ≥ HUD_FADE_AT = 0.955` (line 17), which is ~140 px *before* the pin releases, dropping the strip to `opacity: 0` and retracting the bar (`styles.css:506-508`).
   On any brisk downward scroll the raw `target` shoots past 0.955 while the eased spread is still visibly mid-animation — so the indicator disappears in front of the user mid-sequence. That is exactly the reported "vanishes when you scroll down, feels broken."

### Section 3 — "The Solution" cards (HIGHEST PRIORITY)

1. **What the user sees (intended):** section pins; card 1 rises and its graphic draws bottom-to-top, then card 2, then card 3 — a sequence.
2. **Trigger:** pin progress only.
3. **Mechanism:** `runScrub()` (`solution.js:201-263`): the whole sequence is a **pure function of pin progress** — each card owns exactly one third of the 220vh pin (`STEPS`, lines 21-27: rise = first 14% of its third, graphic = the rest). CSS transitions are explicitly disabled (`card.style.transition = 'none'`, line 203); everything is driven by per-frame inline style writes.
4. **Animated properties:** card `opacity` + `transform: translateY` ✅ composite-friendly *as properties* — **but** each card's graphic is 100–200 individual SVG `<circle>` elements whose `style.opacity` is written **every frame** (lines 219-222; plus the 576-dot background matrix per card built at init). Across three cards that is **~450–700 inline style mutations per scroll frame**, each triggering style recalc on separate SVG nodes — this is main-thread work per frame, not compositor animation, even though the property is nominally "opacity."
5. **Time-based or scrubbed:** **entirely scroll-scrubbed on desktop.** Nothing on the desktop path is time-based. (The mobile path, `runArrival` 267-294, is the opposite: IO arrival → `.is-in` card transition → a 240 ms/dot time-based cascade after 460 ms — i.e. **the "elegant sequence" behaviour still exists in the codebase, but only on mobile.**)
6. **Scroll interference:** none beyond the pin.
7. **Root cause of "cards just appear as you scroll — a manual task":** the pin is **not** gone (220vh sticky is present, `styles.css:552-556`). What's missing is **sequencing**: there is no arrival trigger and no time-based play on desktop. Progress maps linearly onto the cards, so the user's wheel literally draws each dot — scroll 10 px, get 10 px of dots. The per-card graphics are not "wired to each card's arrival"; they are *detached from arrival entirely* and wired to raw scrub position. The glide (k=0.19, line 245) softens input but cannot create a sequence. The old feel (pin into place → each card *plays*) matches what `runArrival` does on mobile — on desktop that logic was replaced by the pure scrub.

### Section 4 — Results (the scroll-blocked section)

1. **What the user sees:** pinned full-viewport frame; copy reveals, the 60–90% ring assembles from particles, a timer dot orbits — and downward scrolling is refused until the ring settles.
2. **Trigger:** IO at the shared reveal line (`rootMargin -35%`, `results.js:203`) starts the ring 650 ms later; **the same trigger arms the scroll gate** (`engageGate()`, line 197/162-169).
3. **Mechanism:** the gate is: non-passive `wheel` listener that `preventDefault()`s all downward wheel at the pin end (`results.js:149-151, 166`) **plus** a scroll clamp that measures the section rect and calls `window.scrollTo(pin end)` on every scroll tick (152-155, 167). Release happens when the orbit starts — `RING_DELAY 650 ms + SETTLE_MS 1400 ms ≈ 2.05 s` after the trigger (`releaseGate()` called at line 183) — with a 4 s failsafe (`setTimeout`, 168). Desktop-only, skipped for reduced motion and when arriving from below (163-164).
4. **Animated properties:** canvas paint only; copy reveal is `opacity`/`transform` ✅. No non-composite DOM properties.
5. **Time-based or scrubbed:** the ring animation is **fixed-duration time-based** (assembly ~1.4 s, move to orbit at ~2.05 s) while the section is a **pin** — the mismatch is the design flaw: scroll distance buys the user nothing during the hold.
6. **Scroll interference:** **the hardest on the page.** Non-passive `preventDefault` on wheel + programmatic `scrollTo` clamping. Measured in the live pass: wheel input worth ~900 px was swallowed (scroll ended at 8279 px against a section end of 9180 px). The user is held ~1.4–2 s from reaching the pin end (less if the entrance already ran).
7. **Root cause of "blocks scrolling until an animation loads — a hard wall":** exactly the gate above. It feels like a wall rather than a sequence because the input is *discarded*, not *converted*: a scrubbed section absorbs wheel energy into visible progress; this one freezes the frame and refuses input while an unrelated clock runs.

### Section 5 — CTA

1. **What the user sees:** live headline ("Since you arrived 00:42 … ≈84 lines"), then a dot field slowly accruing from the bottom of the section.
2. **Trigger:** counter starts on page load (arrival time in `sessionStorage`, `cta.js:13-23`); field drawn on init and re-drawn on an interval while visible.
3. **Mechanism:** `cta.js` — counter `setInterval(tick, 1000)` (line 46); field: jittered grid of dots each with an appearance `level`, filled bottom-up as `fillLevel()` rises (52-91), repainted by `setInterval(drawField, 1500)` (line 102).
4. **Animated properties:** DOM text swaps (counter — layout per tick, but tabular-nums prevents reflow jitter); canvas paint for the field. Headline reveal `opacity`/`transform` ✅. No non-composite CSS animations.
5. **Time-based or scrubbed:** all time-based; nothing scroll-linked.
6. **Scroll interference:** none.
7. **Root cause of "the dot effect is too slow and doesn't read like lines of code":**
   - **Speed** is governed by `FILL_TAU_S = 540` with `FILL_MAX = 0.86` (`cta.js:10-11, 72`): `fill = 0.86 · (1 − e^(−t/540))`. That's a **9-minute time constant** — ~1.6% fill per 10 s at the start. Practically nobody sees it move. The 1.5 s repaint interval (line 102) additionally makes what little motion exists step rather than flow.
   - **"Doesn't read as code lines"** because the field is a uniformly jittered grid filled by a *noisy bottom-up frontier* (`level` = vertical position + random jitter, lines 57-67): dots pop in scattered order with no row structure, no line-lengths, no left-to-right sweep — nothing that scans as lines of code being written.

---

## Step 3 — Findings summary

### Ranked jank causes (most → least impactful)
1. **The results scroll gate** — non-passive `wheel` `preventDefault` + per-tick rect-read→`scrollTo` clamp; discards ~2 s of user input (measured ~900 px swallowed). `results.js:147-168`.
2. **Four back-to-back pins covering ~73% of the page** (260vh + 340vh + 220vh + 200vh) — the wheel almost never produces normal page motion; the hero pin also queues directly into Section 2's pin. `styles.css:345, 392, 552, 676`.
3. **Solution's per-frame inline style writes on ~450–700 SVG circles** — main-thread style recalc every scroll frame; also the reason the section reads as a "manual task" (pure scrub, no sequencing). `solution.js:203, 207-224`.
4. **Issue's full-field canvas repaint (~5,100 rects) every frame the eased value moves**, continuing after the wheel stops. `issue.js:82-120, 204-216`.
5. **HUD keyed to raw progress + early fade at 95.5%** — the "progress indicator vanishes" break. `issue.js:17, 139-144, 214`.
6. **`.issue__bar-fill` animated via `width` percentage per frame** — the page's one truly non-composite animated property. `issue.js:132`, `styles.css:524-528`.
7. **CTA `setInterval` animations (1000 ms / 1500 ms)** — not refresh-synced; stepped repaints; the 540 s fill constant makes the effect look stalled. `cta.js:46, 102, 10-11`.
8. **`nav.offsetHeight` read inside the passive scroll handler each tick** — minor layout read-then-write. `nav.js:32`.
9. **Hero entry paints 11.6k rects/frame for its first 1.5 s** — a load-time cost only. `hero-queen.js:116-190`.

### Smoothness scorecard
| Section | Verdict | Single reason |
|---|---|---|
| 1 · Hero | **main-thread-heavy** | full-canvas dot repaint per frame during entry and scrub (plus a 260vh pin competing with Section 2) |
| 2 · Issue | **main-thread-heavy** | ~5,100-rect canvas repaint per frame + `width`-animated progress bar |
| 3 · Solution | **main-thread-heavy** | ~450–700 inline SVG style writes per scroll frame, raw scrub with no sequencing |
| 4 · Results | **scroll-blocking** | non-passive wheel `preventDefault` + `scrollTo` clamp for ~2 s |
| 5 · CTA | **compositor-clean** | text reveals are transform/opacity; only caveat is timer-stepped canvas repaints |

### Cheapest high-impact fixes (describe only — not implemented)
1. **Remove the results gate** (or replace the time-based ring with a scrub tied to the existing 200vh pin so scroll *is* the progress). One deletion removes the page's only hard wall and its non-passive listener.
2. **Unpin the hero**: `height: 260vh → auto` + play the move once on load (the logic changes are contained to `hero-queen.js`; a play-on-load implementation already exists on the parked `hero-rework` branch). Frees 1.6 viewports and stops the pin pile-up at the top.
3. **Restore sequencing in Solution**: keep the pin, but quantize progress into three stages and, on each stage's entry, play that card's graphic as a short time-based cascade — the exact behaviour already written in `runArrival()` (mobile); promote it to desktop with stage thresholds. Also batch the SVG dots into a handful of `<g>` groups and animate group opacity instead of hundreds of circles.
4. **Fix the HUD**: drive `updateHud` from the eased `cur` (not raw `target`) and fade only at release (`HUD_FADE_AT ≈ 0.99` or on pin exit).
5. **Bar fill via `transform: scaleX()`** instead of `width` — one-line CSS/JS swap, removes the only non-composite animation.
6. **CTA field**: drop the fill time-constant to ~90–120 s, repaint via rAF (only while visible), and restructure the accrual row-by-row with ragged line lengths and a left-to-right sweep so it reads as code being written; tick the counter from rAF with a 1 s accumulator.
