# Schedule-a-demo page animation, scroll & form-interaction plan (`/demo/`)

**Read-only diagnostic.** Source: `demo/index.html` + `css/styles.css` (dark-theme block `:1346-1371`, demo block `:1378+`) + `js/demo.js` (→ shared `nav.js`, `reveal.js`, `util.js`). Static contract audit; no fresh live frame-timing pass (see note in the team plan). **Motion/scroll only — form submission and validation logic are out of scope; correctness observations are flagged separately, not fixed.**

## Inventory
| Area | Motion / behaviour | Mechanism | Notes |
|---|---|---|---|
| Page | single viewport, **no pin, no scroll-linked motion** | `.demo` static; one `section[data-section]` | scroll is entirely native |
| Entrance | eyebrow + headline word-cascade + form block reveal | shared `reveal.js` | on-vocabulary |
| Background | two flanking **dot fields** with a gentle continuous twinkle | `initDotFields` rAF while visible (`demo.js:219-247`), canvas | ambient |
| Form | field focus/inline-validation, chip radiogroup, submit → Sending… → success/fail | `initForm` (`demo.js:53-168`); state via `hidden`/`disabled`/class toggles + CSS transitions | no scroll-linked motion |

**Theme:** the page runs `<html data-theme="dark">` (`demo/index.html:3`) → the LeoTrace dark ramp (`styles.css:1346-1371`). This is the **intended dark inverse** of the light marketing site — see the theme open question in the site summary; do not "fix" it to light or invert it away.
**Listeners:** shared `nav.js` scroll (passive). `demo.js` adds only `resize` + `whileVisible` IO for the fields, and form/chip `click`/`keydown`/`input`/`submit` handlers — **no wheel/scroll/touch handler, no `preventDefault` on scroll, no `scrollTo`.** ✅
**rAF/timers:** dot-field twinkle is **rAF** (`demo.js:237-242`), sleeps via `whileVisible`. **No `setInterval`/`setTimeout`.** ✅

## Contract audit
- **Transform/opacity only:** ✅ no scroll-linked DOM animation at all. Field motion is canvas paint; reveals are `opacity`/`transform` (`reveal.js`); form state changes toggle `hidden`/classes with CSS transitions on composite-friendly props.
- **Passive / no gate:** ✅ nothing blocks scroll.
- **rAF for continuous motion:** ✅.
- **Batch writes:** ✅ single canvas per field, not per-node DOM.
- **`will-change`:** ✅ none on this page.
- **Reduced motion:** ✅ `initDotFields` draws once then early-returns under reduced motion (`demo.js:223,233`); reveals resolve via shared reveal; form has no motion. At home-page parity.

## The one caveat — the twinkle never settles
- **Current:** `initDotFields` repaints **both** full canvases every frame, forever, while the page is visible (`drawField` clears + re-arcs every dot each frame, `demo.js:205-217`; loop `:237-242`). The demo page is one viewport, so "while visible" ≈ "always." It's a perpetual main-thread paint with no settle — the opposite of the "one signature moment, then rest" discipline, and pure cost on low-end hardware for a very subtle effect.
- **Target feel:** the depth reads as a *quiet, alive* environment without a permanent per-frame canvas repaint — motion that's felt, not spent continuously.
- **Options (pick in implementation):**
  1. **Cheapest:** throttle the twinkle to ~30 fps (repaint every other frame via a time accumulator in the rAF), roughly halving paint cost, imperceptible for a slow sine twinkle. Keep rAF.
  2. **Cleaner:** drop the JS twinkle and render the two fields as **static** canvas depth (they already draw a fine static frame via `drawField(f, -1)`, `:228`), letting the entrance reveal be the page's only motion. Most on-brand with "one moment, then rest."
  - Recommendation: **option 2** (static depth) unless the twinkle is considered a deliberate signature — it's the more restrained, lower-cost choice and the field looks complete static.
- **Reduced-motion end-state:** already static (unchanged).
- **Risk:** low — both options are visual-only; option 2 removes the rAF loop entirely (also removes the only always-on cost on the page).
- **Verify:** Performance trace on the idle demo page — confirm no continuous rAF paint (option 2) or halved paint frames (option 1); visual check that the fields still read as depth.

## Form interaction — motion assessment (logic untouched)
- Focus, inline error clear-on-correct (`demo.js:108-114`), submit-lock (`fieldset.disabled`, label → "Sending…", `:139-140`), success/fail swaps (`:154-166`) — all state toggles with CSS transitions; **no janky or non-composite motion**, no scroll coupling. **No motion change recommended.** The interaction model (accent-not-flood errors, keyboard chip radiogroup) is coherent with the site.
- **Flagged separately (NOT a motion fix — do not change here):** `setFieldError` does `field.error.textContent = message || field.error.textContent` (`demo.js:102`) — on clearing it keeps the prior text (harmless, hidden), but relies on the initial HTML error text matching the validator's message; a future message-only-in-JS change could desync. Cosmetic/robustness only. The form posts to a live Web3Forms endpoint with a public access key (by design, `:14-19`) — already reviewed/committed upstream; no action.

## Per-section plan (single section)
### D1 · Demo section
- **Current problem:** perpetual dual-canvas twinkle repaint (above); otherwise clean.
- **Target feel:** restrained dark form surface, one entrance beat, quiet depth at the edges.
- **Exact change:** `js/demo.js` `initDotFields` — either add a frame-rate throttle to the rAF loop (`:237-242`) **or** remove the loop and keep the static `drawField(f, -1)` already produced by `build()` (`:226-230`). No CSS/HTML change.
- **Reduced-motion end-state:** unchanged (static field).
- **Risk:** low.
- **Verify:** as above.

## Cross-page note
Reveal grammar and dot-tone vocabulary match home/team (via shared `reveal.js`/`util.js`), just on the dark ramp. The dark theme is a scoped **colour** flip only — spacing, type, motion identical (`styles.css:1338-1344`) — so the page feels like the same system inverted, which is the intent.
