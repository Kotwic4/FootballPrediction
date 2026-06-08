import { useState } from 'react';
import { tournament } from '../data/tournament.js';
import { roundCandidates, KO_PARENT } from '../knockout.js';
import { GroupTable, BestThirdsTable } from './Standings.jsx';

const ROUND_LABELS = Object.fromEntries(tournament.rounds.map((r) => [r.id, r.label]));

function GroupResultsPanel({ standings }) {
  return (
    <details className="ko-results">
      <summary>📊 Tabele grup i najlepsze trzecie miejsca</summary>
      <div className="ko-results-body">
        <div className="ko-results-grid">
          {tournament.groupOrder.map((g) => (
            <GroupTable key={g} group={g} {...standings.byGroup[g]} />
          ))}
        </div>
        <BestThirdsTable thirds={standings.thirds} cutoffTied={standings.cutoffTied} />
      </div>
    </details>
  );
}

function RoundHeader({ round, count, full, onClear }) {
  return (
    <div className="round-title">
      <span>{round.label}</span>
      <span className={full ? 'round-count complete' : 'round-count'}>
        {count}/{round.count}
      </span>
      <span className="round-points">{round.points} pkt / drużynę</span>
      {count > 0 && (
        <button className="btn btn-small btn-ghost round-clear" onClick={() => onClear(round.id)}>
          ✕ Wyczyść rundę
        </button>
      )}
    </div>
  );
}

function RoundPicker({ round, knockout, standings, onToggle, onAutofillR32, onClear }) {
  const selected = knockout[round.id] ?? [];
  const candidates = roundCandidates(round.id, knockout);
  const candidateByGroup = tournament.groupOrder.map((g) => ({
    g,
    teams: tournament.groups[g].filter((t) => candidates.includes(t)),
  }));
  const count = selected.length;
  const full = count >= round.count;

  if (round.id !== 'r32' && candidates.length === 0) {
    return (
      <section className="round-block">
        <RoundHeader round={round} count={count} full={full} onClear={onClear} />
        <p className="warn">
          Najpierw wybierz drużyny w rundzie „{ROUND_LABELS[KO_PARENT[round.id]]}”.
        </p>
      </section>
    );
  }

  return (
    <section className="round-block">
      <RoundHeader round={round} count={count} full={full} onClear={onClear} />
      {round.id === 'r32' && (
        <>
          <GroupResultsPanel standings={standings} />
          <div className="round-actions">
            <button className="btn btn-small" onClick={onAutofillR32}>
              ⤵︎ Uzupełnij z tabel grupowych
            </button>
            <span className="round-hint">
              <span className="chip-advance">awans</span> = wg Twoich tabel drużyna wychodzi z grupy
            </span>
          </div>
        </>
      )}
      <div className="team-grid">
        {candidateByGroup.map(({ g, teams }) =>
          teams.length === 0 ? null : (
            <div key={g} className="team-grid-group">
              <span className="team-grid-label">{g}</span>
              {teams.map((team) => {
                const isSel = selected.includes(team);
                const disabled = !isSel && full;
                const advancing = round.id === 'r32' && standings.advancers.has(team);
                return (
                  <button
                    key={team}
                    type="button"
                    disabled={disabled}
                    className={
                      'team-chip' +
                      (isSel ? ' selected' : '') +
                      (disabled ? ' disabled' : '') +
                      (advancing ? ' advancing' : '')
                    }
                    onClick={() => onToggle(round.id, team, round.count)}
                  >
                    {team}
                  </button>
                );
              })}
            </div>
          ),
        )}
      </div>
    </section>
  );
}

export default function KnockoutStage({ predictions, onToggle, onClearRound, onAutofillR32, standings }) {
  const [openRound, setOpenRound] = useState(tournament.rounds[0].id);

  return (
    <div className="knockout-stage">
      <p className="legend">
        Dla każdej rundy zaznacz drużyny, które do niej awansują. Od 1/8 finału
        możesz wybierać tylko spośród drużyn wskazanych w poprzedniej rundzie —
        więc <strong>najpierw wypełnij 1/16</strong>. Punkty rosną z każdą rundą.
      </p>
      <div className="round-tabs">
        {tournament.rounds.map((r) => {
          const sel = predictions[r.id]?.length ?? 0;
          return (
            <button
              key={r.id}
              className={openRound === r.id ? 'round-tab active' : 'round-tab'}
              onClick={() => setOpenRound(r.id)}
            >
              {r.label} <span className="round-tab-count">{sel}/{r.count}</span>
            </button>
          );
        })}
      </div>
      {tournament.rounds
        .filter((r) => r.id === openRound)
        .map((r) => (
          <RoundPicker
            key={r.id}
            round={r}
            knockout={predictions}
            standings={standings}
            onToggle={onToggle}
            onClear={onClearRound}
            onAutofillR32={onAutofillR32}
          />
        ))}
    </div>
  );
}
