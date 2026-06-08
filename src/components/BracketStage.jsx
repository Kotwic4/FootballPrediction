import { tournament } from '../data/tournament.js';
import {
  BRACKET_COLUMNS,
  resolveBracket,
  thirdPlaceTeams,
  fixedR32Teams,
} from '../bracket.js';

function MatchCard({ match, onPick }) {
  const { a, b, winner, target } = match;
  const teamBtn = (team) => {
    if (!team) return <span className="bk-team tbd">—</span>;
    const isWinner = winner === team;
    return (
      <button
        type="button"
        className={'bk-team' + (isWinner ? ' winner' : '') + (winner && !isWinner ? ' lost' : '')}
        onClick={() => onPick(target, [a, b], team)}
      >
        {team}
      </button>
    );
  };
  return (
    <div className="bk-match">
      {teamBtn(a)}
      {teamBtn(b)}
    </div>
  );
}

export default function BracketStage({ knockout, standings, onSetR32, onSetWinner }) {
  const groupsComplete = tournament.groupOrder.every((g) => standings.byGroup[g].complete);

  if (!groupsComplete) {
    const done = Object.values(standings.byGroup).reduce(
      (s, gs) => s + gs.ranked.reduce((a, r) => a + r.played, 0) / 2,
      0,
    );
    return (
      <div className="bracket-stage">
        <p className="warn">
          Aby zbudować drabinkę, najpierw uzupełnij <strong>wszystkie 72 mecze
          grupowe</strong> (zakładka „Faza grupowa”). Uzupełniono: {Math.round(done)}/72.
        </p>
      </div>
    );
  }

  const thirds = thirdPlaceTeams(standings);
  const selectedThirds = thirds.filter((t) => knockout.r32?.includes(t.team));
  const fixed = fixedR32Teams(standings);

  const toggleThird = (team) => {
    const has = knockout.r32?.includes(team);
    let nextThirds = selectedThirds.map((t) => t.team);
    if (has) nextThirds = nextThirds.filter((t) => t !== team);
    else {
      if (nextThirds.length >= 8) return; // already 8 chosen
      nextThirds = [...nextThirds, team];
    }
    onSetR32([...fixed, ...nextThirds]);
  };

  const eightChosen = selectedThirds.length === 8;
  const { matches } = resolveBracket(knockout, standings);

  return (
    <div className="bracket-stage">
      <p className="legend">
        Oficjalna drabinka MŚ 2026. Miejsca 1–2 z grup są przydzielone
        automatycznie. Wybierz <strong>8 z 12</strong> drużyn z 3. miejsc, a potem
        klikaj zwycięzców kolejnych meczów — awansują do następnej rundy.
      </p>

      <details className="thirds-picker" open={!eightChosen}>
        <summary>
          🥉 Drużyny z 3. miejsc — wybrano <strong>{selectedThirds.length}/8</strong>
        </summary>
        <div className="thirds-grid">
          {thirds.map((t) => {
            const sel = knockout.r32?.includes(t.team);
            const disabled = !sel && selectedThirds.length >= 8;
            return (
              <button
                key={t.group}
                type="button"
                disabled={disabled || !t.team}
                className={'team-chip' + (sel ? ' selected' : '') + (disabled ? ' disabled' : '')}
                onClick={() => toggleThird(t.team)}
              >
                <span className="chip-group">{t.group}</span> {t.team ?? '—'}
              </button>
            );
          })}
        </div>
      </details>

      {!eightChosen ? (
        <p className="warn">Wybierz dokładnie 8 drużyn z 3. miejsc, aby zobaczyć drabinkę.</p>
      ) : (
        <div className="bracket-scroll">
          <div className="bracket">
            {BRACKET_COLUMNS.map((col) => (
              <div key={col.roundId} className={'bracket-col col-' + col.roundId}>
                <div className="bracket-col-head">{col.label}</div>
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
      )}
    </div>
  );
}
