# Typer Mistrzostw Świata 2026 ⚽

A static web app (React + Vite, no backend) for a family World Cup 2026
prediction game. The UI is in **Polish**; code and comments are in English.

**Live:** https://kotwic4.github.io/FootballPrediction/

> For AI agents / new contributors: see **[AGENTS.md](AGENTS.md)** for the
> architecture, data model, and gotchas.

## The two pages

The app has two views, switched by the URL hash:

| URL | View | Purpose |
|-----|------|---------|
| `/` (default) | **Ranking** (`Leaderboard.jsx`) | Live leaderboard: everyone's picks (bundled at build time) scored against real results |
| `/#typer` | **Typer** (`App.jsx` main view) | The original prediction form each player used to fill in their picks |

### Typer (prediction form)

- **Group stage** — for each of the 72 group matches pick `1` (home win),
  `X` (draw) or `2` (away win). 1 point per correct pick. Live group tables
  are computed from the picks (points + head-to-head as tiebreaker; since
  picks carry no goals, unresolvable ties are flagged ⚖︎ and can be ordered
  manually with ↑ ↓ arrows).
- **Best thirds** — the top 2 of each group advance automatically; the player
  picks **8 of the 12** third-placed teams.
- **Knockout (bracket)** — the official 2026 bracket (matches 73–104). Third
  places are assigned to their round-of-32 slots per FIFA's official
  combinations table; the player clicks winners up to the final and the
  third-place match.
- **Save / load** — picks autosave to `localStorage` and can be exported to /
  imported from an `.xlsx` file compatible with the family's Excel template.

Scoring per correctly predicted team, by round:

| Round | Teams | Pts/team | Max |
|-------|:-----:|:--------:|:---:|
| Group match | 72 | 1 | 72 |
| Round of 32 | 32 | 1 | 32 |
| Round of 16 | 16 | 2 | 32 |
| Quarter-final | 8 | 3 | 24 |
| Semi-final | 4 | 4 | 16 |
| Final | 2 | 5 | 10 |
| Third place | 1 | 5 | 5 |
| Champion | 1 | 10 | 10 |
| **Total** | | | **201** |

### Ranking (leaderboard)

- Player predictions are **bundled at build time** in `src/data/players.js`,
  generated from the organizer's aggregate spreadsheet (see below).
- Real results can be entered by hand (1/X/2 buttons, clicking bracket
  winners) or **downloaded from Wikipedia** (English article is the primary
  source, Polish is the fallback; knockout winners are merged from both).
- Group tables, the best-thirds race (using goal stats from Wikipedia), and
  the bracket fill in progressively as results land. Two bracket layouts:
  classic columns and a radial "circle of flags" view.
- Results are stored in `localStorage` on the organizer's device.

## Development

Requires Node.js 18+ (CI uses 20).

```bash
npm install
npm run dev      # dev server at http://localhost:5173
npm run build    # production build into dist/
npm run preview  # preview the production build
```

There are no tests or linters — verify changes with `npm run build` and a
manual check in the browser.

### Updating player predictions

`src/data/players.js` is auto-generated. When a new aggregate spreadsheet
("ZBIORCZA") arrives from the organizer:

```bash
node scripts/gen-players.mjs "WORLD CUP 2026 ZBIORCZA.xlsx"
```

The source `.xlsx` is intentionally **not** committed (gitignored); the
generated `players.js` is.

## Deployment

Every push to `main` deploys to GitHub Pages via
`.github/workflows/deploy.yml` (Settings → Pages → Source: GitHub Actions).
The `base` path in `vite.config.js` is `/FootballPrediction/` and must match
the repository name.

## Project structure

```
src/
├── main.jsx                  # entry point
├── App.jsx                   # typer view: state, tabs, Excel buttons, localStorage
├── standings.js              # group tables, tiebreaks, best-thirds ranking (pure)
├── knockout.js               # round candidate/cascade rules (pure)
├── bracket.js                # official 2026 bracket, third-place slot assignment (pure)
├── leaderboard.js            # team-name normalization + scoring (pure)
├── excel.js                  # per-player .xlsx export/import (SheetJS)
├── leaderboardExcel.js       # parser for the organizer's aggregate .xlsx
├── wikiResults.js            # scrape results/standings from Wikipedia
├── styles.css                # all styling (single file)
├── components/
│   ├── GroupStage.jsx        # group picks + BestThirdsSelect
│   ├── BracketStage.jsx      # column bracket (shared by typer & ranking)
│   ├── CircularBracket.jsx   # radial "circle of flags" bracket (SVG)
│   ├── Standings.jsx         # shared group table component
│   ├── ProgressPanel.jsx     # collapsible fill-in progress panel
│   └── Leaderboard.jsx       # the whole ranking page
└── data/
    ├── tournament.js         # matches, groups, teams, rounds & points
    ├── players.js            # AUTO-GENERATED — everyone's picks
    ├── thirdCombos.js        # FIFA's 495 third-place slot combinations
    └── flags.js              # team → flagcdn country code

scripts/gen-players.mjs       # regenerates src/data/players.js
```

To reuse the app for another tournament, replace `src/data/tournament.js`
(and the bracket definition in `src/bracket.js` + `src/data/thirdCombos.js`
if the knockout format differs).

## Note on Excel import

`.xlsx` import uses SheetJS — only load files that came from the family /
were exported by this app.
