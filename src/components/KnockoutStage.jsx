import { useState } from 'react';
import { tournament } from '../data/tournament.js';
import { roundCandidates, KO_PARENT } from '../knockout.js';

const ROUND_LABELS = Object.fromEntries(tournament.rounds.map((r) => [r.id, r.label]));

function RoundPicker({ round, knockout, advancers, onToggle, onAutofillR32 }) {
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
        <RoundHeader round={round} count={count} full={full} />
        <p className="warn">
          Najpierw wybierz drużyny w rundzie „{ROUND_LABELS[KO_PARENT[round.id]]}”.
        </p>
      </section>
    );
  }

  return (
    <section className="round-block">
      <RoundHeader round={round} count={count} full={full} />
      {round.id === 'r32' && (
        <div className="round-actions">
          <button className="btn btn-small" onClick={onAutofillR32}>
            ⤵︎ Uzupełnij z tabel grupowych
          </button>
          <span className="round-hint">
            <span className="chip-advance">awans</span> = wg Twoich tabel drużyna wychodzi z grupy
          </span>
        </div>
      )}
      <div className="team-grid">
        {candidateByGroup.map(({ g, teams }) =>
          teams.length === 0 ? null : (
            <div key={g} className="team-grid-group">
              <span className="team-grid-label">{g}</span>
              {teams.map((team) => {
                const isSel = selected.includes(team);
                const disabled = !isSel && full;
                const advancing = round.id === 'r32' && advancers.has(team);
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

function RoundHeader({ round, count, full }) {
  return (
    <h2 className="round-title">
      {round.label}
      <span className={full ? 'round-count complete' : 'round-count'}>
        {count}/{round.count}
      </span>
      <span className="round-points">{round.points} pkt / drużynę</span>
    </h2>
  );
}

export default function KnockoutStage({ predictions, onToggle, advancers, onAutofillR32 }) {
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
            advancers={advancers}
            onToggle={onToggle}
            onAutofillR32={onAutofillR32}
          />
        ))}
    </div>
  );
}
