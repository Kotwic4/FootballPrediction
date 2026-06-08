import { tournament } from '../data/tournament.js';

// Read-only "funnel": one column per round, narrowing toward the champion.
// The data model is a set of teams per round (not bracket matchups), so this
// shows progression rather than specific games.
export default function KnockoutTree({ knockout }) {
  const champion = knockout.champion?.[0];
  const empty = tournament.rounds.every((r) => !(knockout[r.id]?.length));

  return (
    <div className="tree">
      <p className="legend">
        Wizualizacja Twoich typów fazy pucharowej — kolumna na rundę, od 1/16 aż
        do mistrza. To podgląd kto awansuje (model opiera się na liście drużyn w
        rundzie, nie na parach meczów).
      </p>

      {empty ? (
        <p className="warn">Brak typów fazy pucharowej. Uzupełnij je w zakładce „Faza pucharowa”.</p>
      ) : (
        <div className="tree-columns">
          {tournament.rounds.map((r) => {
            const teams = knockout[r.id] ?? [];
            return (
              <div key={r.id} className={'tree-col tree-' + r.id}>
                <div className="tree-col-head">
                  <span className="tree-col-title">{r.label}</span>
                  <span className="tree-col-count">{teams.length}/{r.count}</span>
                </div>
                <div className="tree-col-teams">
                  {teams.length === 0 ? (
                    <span className="tree-empty">—</span>
                  ) : (
                    teams.map((t) => (
                      <span
                        key={t}
                        className={
                          'tree-team' +
                          (r.id === 'champion' ? ' champion' : '') +
                          (t === champion ? ' is-champion' : '')
                        }
                      >
                        {r.id === 'champion' ? '🏆 ' : ''}
                        {t}
                      </span>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
