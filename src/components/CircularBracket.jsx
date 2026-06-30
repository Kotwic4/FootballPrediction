import { tournament } from '../data/tournament.js';
import { resolveBracket } from '../bracket.js';
import { flagUrl } from '../data/flags.js';

// Radial ("circle of flags") view of the 2026 knockout bracket. The 32 round-of-32
// participants sit on the outer ring; each round's winners appear one ring closer
// to the centre, where the champion (and the trophy) live. It renders from the same
// resolved match objects as BracketStage, so picks/results stay in sync.

const CENTER = 500; // viewBox is 0 0 1000 1000

// Ring radius (flag-centre distance from middle) and flag radius per level.
const RING = { leaf: 452, r32: 372, r16: 290, qf: 206, sf: 122 };
const FR = { leaf: 30, r32: 27, r16: 25, qf: 24, sf: 24, champ: 38 };

// R32 match order around the circle — the same depth-first order the column view
// uses, so adjacent flags are real opponents and the tree nests without crossings.
const R32_ORDER = [74, 77, 73, 75, 83, 84, 81, 82, 76, 78, 79, 80, 86, 88, 85, 87];

// Which two earlier matches feed each later match (winners; 103 takes the losers).
const FEEDS = {
  89: [74, 77], 90: [73, 75], 91: [76, 78], 92: [79, 80],
  93: [83, 84], 94: [81, 82], 95: [86, 88], 96: [85, 87],
  97: [89, 90], 98: [93, 94], 99: [91, 92], 100: [95, 96],
  101: [97, 98], 102: [99, 100],
  104: [101, 102], 103: [101, 102],
};

// Inverse of FEEDS for the main path: the match a team plays next after winning.
const PARENT = {};
for (const [parent, kids] of Object.entries(FEEDS)) {
  if (parent === '103') continue; // bronze match is a side branch, not an advance
  for (const k of kids) PARENT[k] = Number(parent);
}

// Ring + flag radius keyed by the match whose WINNER sits at that node.
const LEVEL = {};
for (let nr = 73; nr <= 88; nr++) LEVEL[nr] = 'r32';
for (let nr = 89; nr <= 96; nr++) LEVEL[nr] = 'r16';
for (let nr = 97; nr <= 100; nr++) LEVEL[nr] = 'qf';
LEVEL[101] = 'sf';
LEVEL[102] = 'sf';

const norm = (v) => {
  const len = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / len, y: v.y / len };
};
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
const at = (unit, r) => ({ x: CENTER + unit.x * r, y: CENTER + unit.y * r });

// Compute every node's direction (bisector of its children) and screen position.
// Done once — the layout is fixed; only the teams/winners on it change.
const GEOM = (() => {
  const unit = {};
  const leaf = []; // 32 outer-ring positions, leaf[2k]/[2k+1] = match R32_ORDER[k]'s a/b
  for (let i = 0; i < 32; i++) {
    const ang = ((-90 + i * (360 / 32)) * Math.PI) / 180; // start at top, go clockwise
    const u = { x: Math.cos(ang), y: Math.sin(ang) };
    leaf[i] = at(u, RING.leaf);
    leaf[i].unit = u;
  }
  R32_ORDER.forEach((nr, k) => {
    unit[nr] = norm(add(leaf[2 * k].unit, leaf[2 * k + 1].unit));
  });
  for (const nr of [89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 104]) {
    const [a, b] = FEEDS[nr];
    unit[nr] = norm(add(unit[a], unit[b]));
  }
  const pos = {};
  for (const nr of Object.keys(LEVEL)) pos[nr] = at(unit[Number(nr)], RING[LEVEL[nr]]);
  pos[104] = { x: CENTER, y: CENTER };
  // R32 match -> its two outer leaf positions and the matching teams' indices.
  const leafOf = {};
  R32_ORDER.forEach((nr, k) => { leafOf[nr] = [leaf[2 * k], leaf[2 * k + 1]]; });
  return { unit, leaf, pos, leafOf };
})();

// One flag disc clipped to a circle (flagcdn image), with a fallback for teams
// without a known flag code and a muted placeholder when the slot is still empty.
function Flag({ id, x, y, r, team, cls = '', onClick, title }) {
  const clickable = !!onClick;
  const common = {
    className: 'cb-flag' + (cls ? ' ' + cls : '') + (clickable ? ' cb-clickable' : ''),
    onClick: onClick || undefined,
  };
  if (!team) {
    return (
      <g {...common}>
        <circle cx={x} cy={y} r={r} className="cb-flag-empty" />
      </g>
    );
  }
  const url = flagUrl(team);
  return (
    <g {...common}>
      <title>{title || team}</title>
      {url ? (
        <>
          <clipPath id={id}>
            <circle cx={x} cy={y} r={r} />
          </clipPath>
          <image
            href={url}
            x={x - r}
            y={y - r}
            width={2 * r}
            height={2 * r}
            clipPath={`url(#${id})`}
            preserveAspectRatio="xMidYMid slice"
          />
        </>
      ) : (
        <>
          <circle cx={x} cy={y} r={r} className="cb-flag-empty" />
          <text x={x} y={y} className="cb-flag-initials" dominantBaseline="central">
            {team.slice(0, 3)}
          </text>
        </>
      )}
      <circle cx={x} cy={y} r={r} className="cb-flag-ring" />
    </g>
  );
}

export default function CircularBracket({ knockout, standings, onSetWinner, progressive = false }) {
  const groupsComplete = tournament.groupOrder.every((g) => standings.byGroup[g].complete);
  const thirdsTeams = new Set(standings.thirds.map((t) => t.team));
  const selectedThirds = (knockout.r32 ?? []).filter((t) => thirdsTeams.has(t));

  // Mirror BracketStage's gating on the typer; the ranking page (progressive)
  // always renders and fills in as results arrive.
  if (!progressive && !groupsComplete) {
    return (
      <div className="bracket-stage">
        <p className="warn">
          Aby zobaczyć drabinkę, najpierw uzupełnij <strong>wszystkie mecze grupowe</strong>
          {' '}w zakładce „Faza grupowa”.
        </p>
      </div>
    );
  }
  if (!progressive && selectedThirds.length !== 8) {
    return (
      <div className="bracket-stage">
        <p className="warn">
          Na dole zakładki „Faza grupowa” zatwierdź <strong>8 drużyn z 3. miejsc</strong>
          {' '}(zaznaczono {selectedThirds.length}/8), aby zbudować drabinkę.
        </p>
      </div>
    );
  }

  const { matches } = resolveBracket(knockout, standings);

  // A flag is "lost" once the match it would advance into has a different winner.
  const lostAt = (nr, team) => {
    const parent = PARENT[nr];
    const pm = parent && matches[parent];
    return !!(pm && pm.winner && pm.winner !== team);
  };

  // Connector segments (drawn behind the flags).
  const lines = [];
  for (const nr of R32_ORDER) {
    const [la, lb] = GEOM.leafOf[nr];
    lines.push([la, GEOM.pos[nr]], [lb, GEOM.pos[nr]]);
  }
  for (const nr of [89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 104]) {
    const [a, b] = FEEDS[nr];
    lines.push([GEOM.pos[a], GEOM.pos[nr]], [GEOM.pos[b], GEOM.pos[nr]]);
  }

  const flags = [];

  // Outer ring: the 32 round-of-32 participants. Clicking picks the R32 winner.
  for (const nr of R32_ORDER) {
    const m = matches[nr];
    const [la, lb] = GEOM.leafOf[nr];
    [{ team: m.a, p: la, k: 'a' }, { team: m.b, p: lb, k: 'b' }].forEach(({ team, p, k }) => {
      const won = team && m.winner === team;
      const lost = team && m.winner && m.winner !== team;
      flags.push(
        <Flag
          key={`r32-${nr}-${k}`}
          id={`clip-r32-${nr}-${k}`}
          x={p.x}
          y={p.y}
          r={FR.leaf}
          team={team}
          cls={(won ? 'cb-won ' : '') + (lost ? 'cb-lost' : '')}
          onClick={team && onSetWinner ? () => onSetWinner(m.target, [m.a, m.b], team) : undefined}
        />,
      );
    });
  }

  // Inner rings: each match's winner, one ring closer to the centre. Clicking it
  // advances that team into its next match (PARENT), just like the column view.
  for (const nr of Object.keys(LEVEL)) {
    const m = matches[nr];
    if (!m.winner) continue;
    const parent = PARENT[nr];
    const pm = matches[parent];
    const canAdvance = pm && pm.a && pm.b && onSetWinner;
    flags.push(
      <Flag
        key={`win-${nr}`}
        id={`clip-win-${nr}`}
        x={GEOM.pos[nr].x}
        y={GEOM.pos[nr].y}
        r={FR[LEVEL[nr]]}
        team={m.winner}
        cls={'cb-won' + (lostAt(nr, m.winner) ? ' cb-lost' : '')}
        onClick={canAdvance ? () => onSetWinner(pm.target, [pm.a, pm.b], m.winner) : undefined}
      />,
    );
  }

  // Centre: champion + trophy.
  const champion = matches[104]?.winner ?? null;

  // Bronze (3rd-place) match, shown as a small side pair just below the centre.
  const bronze = matches[103];
  const bz = { x: CENTER, y: CENTER + 86 };

  return (
    <div className="circular-bracket">
      <svg viewBox="0 0 1000 1000" className="cb-svg" role="img" aria-label="Drabinka pucharowa w formie koła">
        <g className="cb-lines">
          {lines.map(([p1, p2], i) => (
            <line key={i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} />
          ))}
        </g>

        {flags}

        {/* Champion / trophy at the centre */}
        {champion ? (
          <>
            <Flag id="clip-champ" x={CENTER} y={CENTER} r={FR.champ} team={champion} cls="cb-champ" />
            <text x={CENTER} y={CENTER - FR.champ - 14} className="cb-trophy-mark">🏆</text>
          </>
        ) : (
          <text x={CENTER} y={CENTER} className="cb-trophy" dominantBaseline="central">🏆</text>
        )}

        {/* Bronze match */}
        {(bronze?.a || bronze?.b) && (
          <g className="cb-bronze">
            <text x={bz.x} y={bz.y - 24} className="cb-bronze-label">3. miejsce</text>
            <Flag
              id="clip-bz-a"
              x={bz.x - 24}
              y={bz.y}
              r={18}
              team={bronze.a}
              cls={bronze.winner === bronze.a ? 'cb-won' : bronze.winner ? 'cb-lost' : ''}
              onClick={bronze.a && onSetWinner ? () => onSetWinner('third', [bronze.a, bronze.b], bronze.a) : undefined}
            />
            <Flag
              id="clip-bz-b"
              x={bz.x + 24}
              y={bz.y}
              r={18}
              team={bronze.b}
              cls={bronze.winner === bronze.b ? 'cb-won' : bronze.winner ? 'cb-lost' : ''}
              onClick={bronze.b && onSetWinner ? () => onSetWinner('third', [bronze.a, bronze.b], bronze.b) : undefined}
            />
          </g>
        )}
      </svg>
      <p className="legend cb-hint">
        Najedź na flagę, aby zobaczyć drużynę. Kliknij zwycięzcę meczu — awansuje
        {' '}bliżej środka, gdzie czeka trofeum dla mistrza.
      </p>
    </div>
  );
}
