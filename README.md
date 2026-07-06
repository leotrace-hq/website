# LeoTrace marketing website (v3.5)

Hand-authored static site — HTML + CSS + vanilla JS, zero runtime dependencies.
Built from `leotrace-website-brief.md` (v3.5), with the Figma file as the visual
source of truth (`Website` file, page node `67:2384`). Light-skin foundation:
neutral ramp, luminance-step + hairline depth, colour only for status, one
shared dot / point-cloud system, Geist + Geist Mono.

## Run

```
python3 -m http.server 4175 --directory leotrace-website-3.5
```

or use the `leotrace-3.5` entry in the repo's `.claude/launch.json`.

## Structure

- `index.html` — the whole page (nav → hero → issue → solution → results → CTA → footer)
- `css/styles.css` — tokens (neutral light ramp), six type roles, layout, motion grammar
- `js/` — ES modules, one per mechanic:
  - `hero-queen.js` — isometric point-cloud Queen; three scroll-driven moves, ambiguity → recognition
  - `issue.js` — pinned scrub: accumulating points + spreading dot field + telemetry (the one red accent)
  - `solution.js` — card arrival choreography + three code-driven SVG dot graphics
  - `results.js` — 60-90% range ring + ≈10s looping spinner ring
  - `cta.js` — since-arrival clock, ≈line counter (~2 lines/s), rising dot field (never fills)
  - `reveal.js` / `nav.js` / `util.js` — shared entrance grammar, mobile menu, canvas/rng helpers
- `fonts/` — self-hosted Geist + Geist Mono variable woff2
- `reference/` — Figma section-frame screenshots used to check the build, section by section
- `_headers` — CSP + security headers for hosts that support the file (a strict CSP
  `meta` tag is also inlined in `index.html`)

## Security posture

Strict CSP (no `unsafe-inline` / `unsafe-eval` — no style attributes or inline
scripts anywhere), no external requests, no trackers, no client-side secrets.
The live counter is client-side only and collects nothing.
`prefers-reduced-motion` is honoured everywhere: the Queen and the spread land
on readable end states, the rings hold still, the counter still ticks.
