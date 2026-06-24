import { tournament } from '../data/tournament.js';
import { BRACKET_COLUMNS, MATCH_INFO, resolveBracket } from '../bracket.js';

const POINTS = Object.fromEntries(tournament.rounds.map((r) => [r.id, r.points]));

// Short round name shown in the per-match label, keyed by the set the
// match WINNER advances to (match.target).
const ROUND_SHORT = {
  r16: '1/16',
  qf: '1/8',
  sf: 'Ćwierćfinał',
  final: 'Półfinał',
  champion: 'Finał',
  third: 'Mecz o 3. miejsce',
};

function columnHeader(col) {
  if (col.roundId === 'final') return `${col.label} · ${POINTS.final}/${POINTS.third} pkt · mistrz ${POINTS.champion} pkt`;
  return `${col.label} · ${POINTS[col.roundId]} pkt`;
}

function MatchCard({ match, onPick }) {
  const { nr, a, b, aLabel, bLabel, winner, target } = match;
  const info = MATCH_INFO[nr];
  const teamBtn = (team, label) => {
    // No team yet — show the placeholder (e.g. "Zwycięzca grupy A"), not clickable.
    if (!team) return <span className="bk-team tbd" title={label}>{label || '—'}</span>;
    const isWinner = winner === team;
    return (
      <button
        type="button"
        title={team}
        className={'bk-team' + (isWinner ? ' winner' : '') + (winner && !isWinner ? ' lost' : '')}
        onClick={() => onPick(target, [a, b], team)}
      >
        {team}
      </button>
    );
  };
  return (
    <div>
      <div className="bk-match-label">
        {ROUND_SHORT[target]} · {info.day} · {info.city}
      </div>
      <div className="bk-match">
        {teamBtn(a, aLabel)}
        {teamBtn(b, bLabel)}
      </div>
    </div>
  );
}

export default function BracketStage({ knockout, standings, onSetWinner, progressive = false }) {
  const groupsComplete = tournament.groupOrder.every((g) => standings.byGroup[g].complete);
  const thirdsTeams = new Set(standings.thirds.map((t) => t.team));
  const selectedThirds = (knockout.r32 ?? []).filter((t) => thirdsTeams.has(t));

  // The typer gates the bracket until groups + thirds are settled; the ranking
  // page (progressive) always renders it, filling placeholders as results land.
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

  return (
    <div className="bracket-stage">
      <p className="legend">
        Oficjalna drabinka MŚ 2026. Klikaj zwycięzców kolejnych meczów — awansują do
        następnej rundy. Punkty za awans drużyny: <strong>1/16 – 1</strong>,
        {' '}<strong>1/8 – 2</strong>, <strong>ćwierćfinał – 3</strong>,
        {' '}<strong>półfinał – 4</strong>, <strong>finał – 5</strong>,
        {' '}<strong>3. miejsce – 5</strong>, <strong>mistrz – 10</strong>.
      </p>

      <div className="bracket-scroll">
        <div className="bracket">
          {BRACKET_COLUMNS.map((col) => (
            <div key={col.roundId} className={'bracket-col col-' + col.roundId}>
              <div className="bracket-col-head">{columnHeader(col)}</div>
              <div className="bracket-col-body">
                {col.matches.map((nr) => (
                  <div key={nr} className="bk-slot">
                    <MatchCard match={matches[nr]} onPick={onSetWinner} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
