import { tournament } from '../data/tournament.js';

const OPTIONS = [
  { value: '1', hint: 'wygrana gospodarzy' },
  { value: 'X', hint: 'remis' },
  { value: '2', hint: 'wygrana gości' },
];

// Position → visual status. 1–2 advance, 3 plays for a best-third spot.
function rowClass(position) {
  if (position <= 2) return 'standings-row advance';
  if (position === 3) return 'standings-row third';
  return 'standings-row out';
}

function StandingsTable({ ranked, complete }) {
  return (
    <table className="standings">
      <thead>
        <tr>
          <th>#</th>
          <th className="ta-left">Drużyna</th>
          <th title="Mecze">M</th>
          <th title="Zwycięstwa">Z</th>
          <th title="Remisy">R</th>
          <th title="Porażki">P</th>
          <th title="Punkty">Pkt</th>
        </tr>
      </thead>
      <tbody>
        {ranked.map((r) => (
          <tr key={r.team} className={rowClass(r.position)}>
            <td>{r.position}</td>
            <td className="ta-left">
              {r.team}
              {r.tied && <span className="tie-flag" title="Remis nierozstrzygnięty (brak bramek)"> ⚖︎</span>}
            </td>
            <td>{r.played}</td>
            <td>{r.w}</td>
            <td>{r.d}</td>
            <td>{r.l}</td>
            <td className="pts">{r.pts}</td>
          </tr>
        ))}
      </tbody>
      {!complete && (
        <tfoot>
          <tr>
            <td colSpan={7} className="standings-note">
              Grupa niekompletna — uzupełnij wszystkie mecze, aby tabela była ostateczna.
            </td>
          </tr>
        </tfoot>
      )}
    </table>
  );
}

function MatchRow({ match, pick, onPick }) {
  return (
    <div className="match-row">
      <span className="match-nr">#{match.nr}</span>
      <span className="match-date">{match.date} {match.time}</span>
      <span className="team team-home">{match.team1}</span>
      <div className="pick-group" role="group" aria-label={`Typ meczu ${match.nr}`}>
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            title={o.hint}
            className={pick === o.value ? 'pick-btn selected' : 'pick-btn'}
            onClick={() => onPick(match.nr, o.value)}
          >
            {o.value}
          </button>
        ))}
      </div>
      <span className="team team-away">{match.team2}</span>
    </div>
  );
}

function BestThirds({ thirds, cutoffTied }) {
  return (
    <section className="best-thirds">
      <h2>Najlepsze trzecie miejsca</h2>
      <p className="legend">
        Awansuje <strong>8 najlepszych</strong> drużyn z trzecich miejsc (spośród 12 grup).
        Ranking wg punktów — bez bramek nie da się rozstrzygnąć wszystkich remisów.
      </p>
      <table className="standings thirds-table">
        <thead>
          <tr>
            <th>#</th>
            <th className="ta-left">Drużyna</th>
            <th>Grupa</th>
            <th>Pkt</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {thirds.map((t) => (
            <tr key={t.team} className={t.advances ? 'standings-row advance' : 'standings-row out'}>
              <td>{t.rank}</td>
              <td className="ta-left">
                {t.team}
                {t.tied && <span className="tie-flag" title="Remis punktowy"> ⚖︎</span>}
              </td>
              <td>{t.group}</td>
              <td className="pts">{t.pts}</td>
              <td>{t.advances ? 'awans' : 'odpada'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {cutoffTied && (
        <p className="warn">
          ⚠︎ Remis punktowy na granicy awansu (8./9. miejsce) — wynik nierozstrzygnięty bez bramek.
        </p>
      )}
    </section>
  );
}

export default function GroupStage({ predictions, onPick, standings }) {
  return (
    <div className="group-stage">
      <p className="legend">
        Wybierz wynik każdego meczu: <strong>1</strong> = wygrana pierwszej drużyny,
        {' '}<strong>X</strong> = remis, <strong>2</strong> = wygrana drugiej drużyny
        (1 pkt za trafienie). Tabele liczą się na żywo. Z miejsc 1–2 jest
        {' '}<span className="chip-advance">awans</span>, z 3. miejsca gra się o awans.
      </p>
      {tournament.groupOrder.map((g) => {
        const matches = tournament.matches.filter((m) => m.group === g);
        const done = matches.filter((m) => predictions[m.nr]).length;
        return (
          <section key={g} className="group-block">
            <h2 className="group-title">
              Grupa {g}
              <span className="group-progress">{done}/{matches.length}</span>
            </h2>
            <StandingsTable {...standings.byGroup[g]} />
            <div className="matches">
              {matches.map((m) => (
                <MatchRow
                  key={m.nr}
                  match={m}
                  pick={predictions[m.nr]}
                  onPick={onPick}
                />
              ))}
            </div>
          </section>
        );
      })}
      <BestThirds thirds={standings.thirds} cutoffTied={standings.cutoffTied} />
    </div>
  );
}
