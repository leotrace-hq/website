# Home-page animation plan — delta over the v31 audit

**Read-only pass.** Re-read the current source (asset **v41**) from scratch; this reconciles it against `home-animation-audit.md` (captured at v31). Verdicts below come from the current code, not from diffing the old report.

## What changed since v31 (orientation only)
- **Hero fully rebuilt**: `hero-queen.js` (+ `assets/hero-dots.json`) is gone; the hero is now `js/hero-board.js` — a perspective dotted board + placed knight PNG + telemetry move-paths, **play-once-on-load**. The 260vh hero pin is **removed**; the hero is now a fixed-height framed surface.
- **Team page** dot field unified (single system) — no scroll/motion impact.
- **Demo form** wired to Web3Forms (live endpoint) + CSP `connect-src` opened for it. GitHub Pages custom-domain config added (`CNAME`, `.nojekyll`).
- Everything else on the home page is unchanged from v31.

## Per locked-finding status

### S1 · Hero — **CHANGED / settled — leave alone** (per directive; contract-checked and clean)
The old scrubbed-pin hero is gone. `hero-board.js` now:
- plays once on load (`setTimeout(TITLE_IN)` → `requestAnimationFrame(frame)`, `hero-board.js:453-462`); **no scroll/wheel/touch listener at all** — only `resize` + a `whileVisible` IntersectionObserver.
- animates canvas paint + the copy's shared reveal (`opacity`/`transform`); **no non-composite scroll-linked properties**.
- reduced motion → renders the final state once (`reducedMotion()` → `animState = FULL`, `:449-451`).
- `.hero__sticky` is `position: relative`, height `calc(100svh − nav − chrome)` (`styles.css:347-357`) — **not a pin**, so the old hero→Section 2 pin pile-up is eliminated.

**Verdict:** obeys the engineering contract (no gate/hijack, passive listeners, transform/opacity + canvas, reduced-motion clean, no pin). **Do not rework. No action.**

### S2 · Issue — **STILL PRESENT** (plan unchanged)
- `.issue__bar-fill` animated via `width %` — `issue.js:132` (`barEl.style.width = …%`), CSS `styles.css:520-528`. → swap to `transform: scaleX()`.
- HUD keyed to **raw** `target`, not eased `cur` — `updateHud(target)` at `issue.js:214`; early fade `HUD_FADE_AT = 0.955` (`:16`). → drive HUD from `cur`, fade only at release.
- Full-field repaint (~5,100 `fillRect`/frame while the eased value moves) — `drawField` `issue.js:82-120`, loop `:204-216`. Signature moment (pin + scrubbed spread) is **kept**.

### S3 · Solution — **STILL PRESENT — highest priority** (plan unchanged)
- Desktop is pure scrub, no sequencing — `runScrub` `solution.js:201-263`; `card.style.transition='none'` (`:203`).
- ~450–700 per-frame inline `style.opacity` writes across the three cards' SVG circles — `solution.js:220-222`. → batch into grouped `<g>` opacity.
- The staged cascade still exists **only on mobile** — `runArrival` `:267-294` (IO arrival → 240 ms/dot cascade after 460 ms). → promote to desktop, quantized into three stages on the existing 220vh pin (`styles.css:562`, desktop+no-preference only).

### S4 · Results — **STILL PRESENT** (plan unchanged) — the page's one hard wall
- Scroll gate intact: non-passive `wheel` `preventDefault` (`results.js:149-151`, added `:166` `{passive:false}`) + per-tick `getBoundingClientRect`→`window.scrollTo` clamp (`:152-155`, `:167`), armed by `engageGate()` (`:162-169`), released when the orbit starts (~2.05 s) or a 4 s failsafe (`:168`).
- Ring is fixed-duration time-based (`SETTLE_MS 1400` + `RING_DELAY 650`) on a 200vh pin (`styles.css:686`). → **remove the gate entirely**; convert the ring to a **scrub tied to the pin** so scroll assembles it.

### S5 · CTA — **STILL PRESENT** (plan unchanged)
- `setInterval(tick, 1000)` (`cta.js:46`) and `setInterval(drawField, 1500)` (`:102`); `FILL_TAU_S = 540`, `FILL_MAX = 0.86` (`:10-11`). → rAF (1 s accumulator for the counter), tau ≈ 90–120 s, and restructure the field **row-by-row with ragged line lengths + left-to-right sweep** (`buildField`/`drawField` `:52-88`).

### Global · pin budget — **IMPROVED, one item remains**
Hero no longer pins. Remaining desktop pins are now **three, still back-to-back with no breathing room between them**: Issue 340vh (`styles.css:402`) → Solution 220vh (`:562`) → Results 200vh (`:686`). Once Results is ungated (S4), add ordinary unpinned scroll travel **between** these three so the page breathes rather than being one 760vh crank. Re-check the pin map after S3/S4 land.

### Shared — **unchanged**
- `nav.js:42` reads `nav.offsetHeight` inside the passive scroll handler each tick (minor read-then-write). Fix once (cache the height; refresh on resize) — benefits every page.
- `reveal.js` IO reveal system + reduced-motion are clean site-wide.

## New findings this read (not in the v31 audit)
- **None new on the home page** beyond the hero rebuild above. The framed hero surface introduces no scroll-linked non-composite properties.

## Implementation order (unchanged, hero excluded)
**S2 → S4 → S3 → S5**, then the pin-budget breathing-room pass. Rationale in the v31 audit still holds; the hero is settled and excluded.
