# AGENTS.md — guide for AI agents and new contributors

Family World Cup 2026 prediction game. Static React 18 + Vite 5 SPA, deployed
to GitHub Pages. No backend, no router library, no state library, no
TypeScript, no tests, no linter. Three runtime deps: `react`, `react-dom`,
`xlsx` (SheetJS).

**Language convention:** all user-facing text is Polish; all code, comments,
and commit messages are English. Keep it that way.

## Commands

```bash
npm run dev        # dev server (http://localhost:5173)
npm run build      # production build — use this to verify changes compile
npm run preview    # serve the production build
node scripts/gen-players.mjs [path.xlsx]   # regenerate src/data/players.js
```

There is no test suite. Verify with `npm run build` plus a manual check in
the browser (`npm run dev`). Watch the console for React warnings.

## Architecture in one paragraph

`main.jsx` renders `App.jsx`, which switches between two views on the URL
hash: the **ranking/leaderboard** (default, `components/Leaderboard.jsx`) and
the **typer** prediction form (`#typer`, the rest of `App.jsx`). Both views
share the same pure domain modules (`standings.js`, `knockout.js`,
`bracket.js`, `leaderboard.js`) and the same bracket components. All state is
React `useState` persisted to `localStorage`; player predictions shown on the
ranking are frozen into the bundle (`src/data/players.js`).

## Core data model

Everything revolves around two objects with the **same shape**:

```js
// A player's predictions (typer) — and the real results (ranking):
{
  groups:    { [matchNr]: '1' | 'X' | '2' },   // 72 group matches, keyed by nr 1–72
  knockout:  { [roundId]: string[] },          // team names confirmed per round
  tiebreaks: { [group]: string[] },            // manual full ordering of a group's 4 teams
}
// The results object (Leaderboard) additionally carries:
//   goalStats:    { [team]: { gd, gf } }  — from Wikipedia; ranks best thirds
//   thirdsManual: boolean                 — user overrode the auto best-8 selection
```

Round ids in order: `r32, r16, qf, sf, final, third, champion` (defined with
labels/counts/points in `tournament.js` → `rounds`). Knockout picks are
**unordered sets of team names per round** — not match-by-match winners.
`third` (3rd-place match winner) draws its candidates from `sf` minus the
finalists; everything else from its parent round (`knockout.js` → `KO_PARENT`).

Key invariant: after any knockout edit, call `normalizeKnockout()` — it
cascades removals (a team dropped from r32 disappears from r16, qf, … too).
Similarly `sanitizeTiebreaks()` drops malformed manual orders on load/import.

## Module map (what lives where)

Pure logic (no React — safe to import from Node, as `gen-players.mjs` does):

- `src/data/tournament.js` — single source of truth: 72 matches (`nr`, teams,
  `group`, date/time), `groups`, `groupOrder`, `teams`, `rounds` with points.
  Swap this file (plus bracket data) to reuse the app for another tournament.
- `src/standings.js` — group tables from 1/X/2 picks. **No goals exist**, so
  ranking is points → manual tiebreak order (if set) → head-to-head; still-tied
  teams get `tied: true` (rendered as ⚖︎). `buildStandings()` returns
  `{ byGroup, thirds, cutoffTied, advancers }`; best-thirds ranking uses
  `goalStats` when available (Wikipedia), otherwise points only.
- `src/knockout.js` — `roundCandidates()` + `normalizeKnockout()` (see above).
- `src/bracket.js` — the official 2026 bracket as data: match numbers 73–104,
  R32 slot specs (`'1A'`, `'2B'`, `{ third: 'T1' }`), later matches referencing
  `{ win: nr }` / `{ lose: nr }`. `resolveBracket(knockout, standings)` turns
  the round-sets into per-match participants/winners. `assignThirds()` maps the
  8 chosen third-place groups onto slots T1–T8 via FIFA's table
  (`data/thirdCombos.js`, all 495 combinations). `BRACKET_COLUMNS` lists match
  numbers in **depth-first tree order** — do not "fix" it to be sequential; the
  2026 pairings are not, and the column layout depends on this order.
- `src/leaderboard.js` — `normalizeTeam()` (case/alias/typo-tolerant mapping of
  raw strings onto canonical Polish team names; "RPA" is a permanent family
  alias) and `scorePlayer()` (points accrue per correct team per round, so
  partial results already score).
- `src/excel.js` — per-player `.xlsx` export/import. **The layout mirrors the
  family's Excel template and must stay interchangeable with it**: column D
  round labels (`1/16`, `ĆWIERĆFINAŁ`, …), team names in column E, tiebreak
  rows after the points legend (older files simply lack them). Import matches
  rows by match number / round label, never by absolute row index.
- `src/leaderboardExcel.js` — parses the organizer's aggregate ("ZBIORCZA")
  spreadsheet: columns A–G are the template, each column from H is one player.
  Used only by `scripts/gen-players.mjs` at build/generation time.
- `src/wikiResults.js` — scrapes live results from Wikipedia's REST parse API
  (CORS-friendly, `origin=*`). English article is primary (updates sooner),
  Polish is fallback; knockout winners are **unioned** across both. Fragile by
  nature — parsing rules are documented inline (penalty shootouts, flag-only
  anchors, en-dash minus signs). Touch carefully and read the comments first.

React:

- `src/App.jsx` — typer state + hash-based view switch. localStorage keys:
  `ms2026-typy` (predictions), `ms2026-imie` (player name).
- `src/components/Leaderboard.jsx` — the whole ranking page: results entry
  (chronological or by group), Wikipedia download button, best-thirds
  auto/manual toggle, bracket (columns or circle), per-round pick tables.
  Results localStorage key: `ms2026-wyniki`. An effect auto-fills `r32` from
  finished groups; downloaded knockout winners are merged raw and pruned by
  that effect, not at merge time.
- `src/components/BracketStage.jsx` — column bracket. `progressive` prop:
  ranking renders placeholders as results land; typer gates until groups +
  8 thirds are complete.
- `src/components/CircularBracket.jsx` — radial SVG bracket (flags from
  flagcdn via `data/flags.js`). Same `resolveBracket()` data as BracketStage.
- `src/components/GroupStage.jsx` — group picks; exports `BestThirdsSelect`
  (reused by Leaderboard). `Standings.jsx` — shared group table (↑↓ swap only
  between point-level neighbours). `ProgressPanel.jsx` — fill-in progress.
- `src/styles.css` — all styling, plain CSS, single file. Class prefixes:
  `lb-` leaderboard, `bk-` bracket.

Generated / data files:

- `src/data/players.js` — **AUTO-GENERATED** by `scripts/gen-players.mjs`,
  do not edit by hand. The source ZBIORCZA `.xlsx` is gitignored on purpose;
  the generated file is committed.
- `src/data/thirdCombos.js` — generated from Wikipedia/FIFA Annex C; treat as
  data, don't hand-edit.

## Gotchas

- **GitHub Pages base path**: `vite.config.js` sets `base:
  '/FootballPrediction/'`. Asset URLs must go through Vite; hash-only
  navigation is used precisely to avoid path routing.
- **Deploy**: every push to `main` auto-deploys via
  `.github/workflows/deploy.yml`. `index.html` carries no-cache meta tags so
  users pick up new builds immediately — keep them.
- **Excel download on mobile**: `downloadXlsx()` defers anchor/objectURL
  cleanup by 10 s because some Android browsers fetch the blob async after
  `click()`. Don't "clean up" that timeout.
- **No goals anywhere in predictions**: any feature needing goal difference
  must get it from `goalStats` (Wikipedia) or degrade gracefully (the ⚖︎ tie
  flag + manual ordering is the established pattern).
- **Team names are Polish display strings** and act as ids throughout. New
  external data sources must be mapped through `normalizeTeam()` /
  `EN_TO_PL`-style alias tables.
- Match numbers: 1–72 group stage (template order, not chronological), 73–104
  knockout (official FIFA numbering).

## Adding a feature — where to hook in

1. Decide which view it belongs to: typer (`App.jsx`) or ranking
   (`Leaderboard.jsx`). State lives at the top of each; handlers mirror each
   other because predictions and results share a shape.
2. Put any non-trivial logic in a pure module in `src/` (or extend one), keep
   components thin — that keeps it importable by Node scripts and easy to
   reason about.
3. If it touches knockout state, route every write through
   `normalizeKnockout()`; if it touches the Excel format, keep files readable
   by the family template and by older versions of the app (append, don't
   reshape).
4. Verify: `npm run build`, then `npm run dev` and click through both pages
   (`/` and `#typer`), ideally also with empty localStorage.
