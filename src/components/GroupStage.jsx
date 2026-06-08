import { tournament } from '../data/tournament.js';
import { GroupTable, BestThirdsTable } from './Standings.jsx';

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
            <GroupTable {...standings.byGroup[g]} />
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
          </details>
        );
      })}
      <BestThirdsTable thirds={standings.thirds} cutoffTied={standings.cutoffTied} />
    </div>
  );
}
