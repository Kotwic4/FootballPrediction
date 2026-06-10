import { tournament } from '../data/tournament.js';
import { GroupTable } from './Standings.jsx';

const OPTIONS = [
  { value: '1', hint: 'wygrana gospodarzy' },
  { value: 'X', hint: 'remis' },
  { value: '2', hint: 'wygrana gości' },
];

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

// Interactive best-thirds selection: confirm which 8 of the 12 third-placed
// teams advance to the knockout stage.
function BestThirdsSelect({ thirds, cutoffTied, selected, onSetThirds }) {
  const selSet = new Set(selected);
  const toggle = (team) => {
    if (selSet.has(team)) onSetThirds(selected.filter((t) => t !== team));
    else if (selected.length < 8) onSetThirds([...selected, team]);
  };
  const selectTop8 = () => onSetThirds(thirds.slice(0, 8).map((t) => t.team));

  return (
    <section className="best-thirds">
      <h3>Awans z 3. miejsc — wybierz 8 z 12</h3>
      <p className="legend">
        Do fazy pucharowej awansuje <strong>8 najlepszych</strong> drużyn z 3. miejsc.
        Zaznacz te, które Twoim zdaniem przejdą dalej. Wybrano:
        {' '}<strong>{selected.length}/8</strong>.
        <button className="btn btn-small inline-btn" type="button" onClick={selectTop8}>
          Zaznacz 8 najlepszych wg tabeli
        </button>
      </p>
      <table className="standings thirds-table">
        <thead>
          <tr>
            <th>#</th>
            <th className="ta-left">Drużyna</th>
            <th>Grupa</th>
            <th>Pkt</th>
            <th>Awans?</th>
          </tr>
        </thead>
        <tbody>
          {thirds.map((t) => {
            const isSel = selSet.has(t.team);
            const disabled = !isSel && selected.length >= 8;
            return (
              <tr
                key={t.team}
                className={
                  'standings-row third-select' + (isSel ? ' advance' : '') + (disabled ? ' is-disabled' : '')
                }
                onClick={() => !disabled && toggle(t.team)}
              >
                <td>{t.rank}</td>
                <td className="ta-left">
                  {t.team}
                  {t.tied && <span className="tie-flag" title="Remis punktowy"> ⚖︎</span>}
                </td>
                <td>{t.group}</td>
                <td className="pts">{t.pts}</td>
                <td>
                  <span className={isSel ? 'check on' : 'check'}>{isSel ? '✓ awans' : '—'}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {cutoffTied && (
        <p className="warn">
          ⚠︎ Remis punktowy na granicy awansu (8./9. miejsce) — wybierz ręcznie, kto przechodzi.
        </p>
      )}
    </section>
  );
}

export default function GroupStage({ predictions, onPick, standings, r32, onSetThirds, onReorderGroup, onGoToKnockout }) {
  const groupsComplete = tournament.groupOrder.every((g) => standings.byGroup[g].complete);
  const thirdsTeams = new Set(standings.thirds.map((t) => t.team));
  const selectedThirds = r32.filter((t) => thirdsTeams.has(t));
  const ready = groupsComplete && selectedThirds.length === 8;

  return (
    <div className="group-stage">
      <p className="legend">
        Wybierz wynik każdego meczu: <strong>1</strong> = wygrana pierwszej drużyny,
        {' '}<strong>X</strong> = remis, <strong>2</strong> = wygrana drugiej drużyny
        (1 pkt za trafienie). Tabele liczą się na żywo. Z miejsc 1–2 jest
        {' '}<span className="chip-advance">awans</span>, z 3. miejsca gra się o awans.
        Przy remisie punktowym (⚖︎) możesz ustawić kolejność strzałkami <strong>↑ ↓</strong> w tabeli.
      </p>
      {tournament.groupOrder.map((g) => {
        const matches = tournament.matches.filter((m) => m.group === g);
        const done = matches.filter((m) => predictions[m.nr]).length;
        const full = done === matches.length;
        return (
          <details key={g} className="group-block" open>
            <summary className="group-title">
              <span className="group-name">Grupa {g}</span>
              <span className="group-teams-inline">{tournament.groups[g].join(' · ')}</span>
              <span className={full ? 'group-progress complete' : 'group-progress'}>
                {done}/{matches.length}
              </span>
            </summary>
            <GroupTable
              {...standings.byGroup[g]}
              onSwap={(idx) => {
                const order = standings.byGroup[g].ranked.map((r) => r.team);
                [order[idx], order[idx + 1]] = [order[idx + 1], order[idx]];
                onReorderGroup(g, order);
              }}
            />
            <div className="matches">
              {matches.map((m) => (
                <MatchRow key={m.nr} match={m} pick={predictions[m.nr]} onPick={onPick} />
              ))}
            </div>
          </details>
        );
      })}

      <BestThirdsSelect
        thirds={standings.thirds}
        cutoffTied={standings.cutoffTied}
        selected={selectedThirds}
        onSetThirds={onSetThirds}
      />

      <div className="goto-knockout">
        {ready ? (
          <button className="btn btn-primary btn-big" onClick={onGoToKnockout}>
            Przejdź do fazy pucharowej →
          </button>
        ) : (
          <p className="goto-hint">
            {!groupsComplete
              ? 'Uzupełnij wszystkie mecze grupowe, aby przejść do fazy pucharowej.'
              : `Wybierz 8 drużyn z 3. miejsc (zaznaczono ${selectedThirds.length}/8), aby przejść dalej.`}
          </p>
        )}
      </div>
    </div>
  );
}
