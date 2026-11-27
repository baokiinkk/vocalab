# VocaLab — brief for page agents

VocaLab is a static web app (no server, no build step, no framework) for Vietnamese learners to study English vocabulary.
Project root: `/Users/baoho/development/english`. UI language: **Vietnamese** (copy exactly as in the design).

## The design (source of truth — match it 100%)
`design-v3/project/*.dc.html` (v3 — `design-v2/` and `design/` are obsolete; the app currently implements v2, so `diff design-v2/project/X.dc.html design-v3/project/X.dc.html` shows exactly what changed) are the designer's artboards. v3 is a full restyle: warm paper background, terracotta primary, Be Vietnam Pro font, pastel dotted tiles with a 'tape' strip, flat 'lip' shadows (0 2px/3px 0), plus layout/content changes per page. Each base file (e.g. `Main.dc.html`) renders **all three devices**
from one source: read the markup inside `<x-dc>` AND the `layout()` / `renderVals()` code in the `<script type="text/x-dc">`
block — the `L.*` style objects there give exact paddings, font sizes, grid columns, colors per device
(`laptop` = 1440 wide with left sidebar, `ipad` = 820 wide with 88px icon rail, `iphone` = 390 wide with bottom tab bar).
`{{ x }}` holes are filled from `renderVals()`; `<sc-for list>` is a loop, `<sc-if value>` a condition, `onClick="{{ fn }}"` a handler.
The demo data hard-coded there (e.g. "24", "58%", "albeit") must become **live data** from the core APIs below.
`Flow.dc.html` shows how screens connect. `Sidebar.dc.html` is the nav (already re-implemented for v3 in core `VL.ui.nav` — 5 items incl. Thêm từ — don't rebuild it).
The `*Phone.dc.html` / `*Tablet.dc.html` files are just wrappers passing `device=`.

## Architecture (already built — read these files first)
- `index.html` loads, in order: `js/core/util.js, store.js, decks.js, srs.js, session.js, ai.js, media.js, ui.js`,
  `data/decks/*.js`, then `js/pages/*.js`, then `js/core/app.js` (router + boot). CSS: `css/base.css` then `css/pages/*.css`.
- Everything is on the global `window.VL`. Classic scripts only (no ES modules — app must also work from file://).
- **Read the header comments + code of every file in `js/core/` and `css/base.css` before writing your page.** They document:
  - `VL.html\`...\`` tagged template (auto-escapes; `VL.raw()` for trusted HTML), `VL.esc`, `VL.norm`, date helpers.
  - Router/page contract in `js/core/app.js`: `VL.page(name, {nav, focus, title, enter, render, mount})`, `VL.refresh()`,
    `VL.go(hash)`, `VL.href.*`, routes table. The router sets `#app` classes `device-laptop|device-ipad|device-iphone`,
    `is-focus`, `page-<name>` — scope device-specific CSS with those.
  - `VL.store` (settings, export/import, backup), `VL.words` (get/search/save/remove/inDeck/library/findByText/addToDeck),
    `VL.decks` (catalog, mineIds, add/remove, perDay, stats), `VL.srs` (score with decay, level, record, weight, todayPlan,
    overview, streak, resetAll), `VL.session` (start/item/answer/next/finish/last/retryWrong/quit), `VL.MODES`, `VL.PRESETS`,
    `VL.distractors`, `VL.blankOut`, `VL.modeOk`, `VL.ai` (Groq: suggest, fillEmpty), `VL.media` (speak, image, hydrate),
    `VL.ui` (icon via `VL.icon`, deckIcon, ring, bar, levelBadge, masteryBar, wordImage, speakBtn, stepper, seg, switch, chip,
    focusTop, empty, toast, confirm, delegate).
  - Score rules: correct +10 (10 correct = 100 %), wrong −pen %, gradual decay when not practised, lower score ⇒ picked more often.
- Shared CSS classes in `css/base.css`: `.page > .page-inner` (page padding & 1080px max width per device), `.card`, `.card-soft`,
  `.card-head`, `.h1`, `.h2`, `.btn btn-primary|btn-outline|btn-soft|btn-ghost|btn-danger btn-lg|btn-sm|btn-block`, `.icon-btn`,
  `.input`, `.textarea`, `.field`, `.search`, `.seg`, `.chip(s)`, `.switch`, `.stepper`, `.score-ring`, `.bar`, `.mastery-bar`,
  `.level-badge`, `.word-img`, `.focus-top`, `.empty`, `.back-link`, `.muted`, `.small`, `.sr-only`.
  **Use CSS variables from `css/base.css` (already updated to v3: `--bg --surface --surface-2 --line --line-2 --ink --ink-2 --muted --muted-2 --primary --primary-ink --primary-soft --primary-soft-2 --primary-soft-line --track --weak* --learning* --good* --master* --purple-* --sky-* --butter-* --shadow --shadow-btn --dots --radius*`) — avoid hard-coding the design hexes**
  (dark theme must work). Pastel tile colours (peach/lilac/butter/mint/pink/sky) may be page CSS classes with a `:root[data-theme="dark"]` override. Deck tile colours (`deck.bg/fg`) and level colours from `VL.srs.level()` may be inline.

## Your deliverables (only these files — do NOT edit other files)
- `js/pages/<page>.js` — replace the stub. One IIFE calling `VL.page('<page>', {...})`.
- `css/pages/<page>.css` — page-specific styles, prefixed with `.page-<page>` (the class on `#app`) or your own `.<page>-*` classes.
- `tests/pages/<page>.test.js` — browser tests (see Testing).
If you find a bug or a missing capability in core (`js/core/*`, `css/base.css`, `index.html`), **do not edit core** —
work around it inside your page if reasonable, and list the issue precisely (file, line, fix) in your final report.

## Rules
- Pixel-faithful to the design on all 3 devices: same sections, order, copy, sizes, radii, spacing, colours, icons.
- Real behaviour: every button/link in the design must work (navigate, toggle, save…). Links between pages use these hashes:
  `#/today`, `#/library`, `#/deck/<id>`, `#/word/<encodeURIComponent(key)>` (use `VL.href.word(key)`), `#/add`
  (`?edit=<key>` edit, `?q=<text>` prefill, `?deck=<id>` target deck), `#/practice` (`?deck=<id>` preselect deck),
  `#/flash`, `#/quiz`, `#/result`, `#/settings`. Starting practice always goes through `VL.session.start({...})`.
- Handle empty states (no words yet, no due words, search with no results, no session) gracefully.
- No `alert/confirm/prompt` — use `VL.ui.toast` / `VL.ui.confirm`. No external libraries. No `innerHTML` with unescaped user data
  (always build HTML with `VL.html`).
- Accessible: real `<button>`/`<a href>`/`<label>`, `aria-label` on icon buttons, touch targets ≥ 44 px, keyboard usable.
- Words may have an image: use `VL.ui.wordImage(key, cls)` where it helps visualise the word (router auto-hydrates it after render;
  call `VL.media.hydrate(root)` if you inject HTML later). Images load from the network, so the layout must look fine without them.
- Keep page-local UI state in your IIFE closure; reset it in `enter(ctx)`; re-render with `VL.refresh()` after changes.
  Text inputs: give them an `id` so focus/caret survive `VL.refresh()` (router restores it), or update DOM in place for live search.

## Testing (mandatory)
- No HTTP server: run every test/screenshot with env `VL_BASE=file:///Users/baoho/development/english` (the app works from file://). Do NOT start a server.
- Helpers: `tests/pw.js` (`launch()`, `open(browser, device, hash, {seed})` — blocks external network, collects console errors in
  `page.errors`), `tests/fixtures.js` (`seed` function: fallback deck rows, custom words, progress, streak), `tests/shot.js`.
  playwright-core + system Chrome are installed in `tests/node_modules`.
- Write `tests/pages/<page>.test.js` runnable with `node --test tests/pages/<page>.test.js` (from the project root) covering, on
  **laptop, ipad and iphone**: page renders without console errors, every interactive element works (clicks, inputs, navigation
  targets are correct), data is live (changes persist after `VL.refresh()`/reload), empty states.
- Take full-page screenshots for the 3 devices (`VL_BASE=... node tests/shot.js '#/<page>' all tests/shots/<page>`) into `tests/shots/<page>/` and **look at them** (Read tool on the PNG) comparing to
  the design markup/styles. Fix every visual mismatch, overflow, clipped text, horizontal scroll at 390 px.
- Also run `node --test tests/core.test.js` to be sure core still passes (don't change it).
- Then self-review your code for logic bugs, navigation dead-ends and blockers; fix; re-run tests until green.

## Final report (keep it short)
What you built, test results (pass/fail counts), screenshots paths, deviations from the design (should be none or justified),
and any core issues found (file:line + suggested fix).
