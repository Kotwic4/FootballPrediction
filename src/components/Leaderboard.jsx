import { useEffect, useMemo, useState } from 'react';
import { tournament } from '../data/tournament.js';
import { players } from '../data/players.js';
import { buildStandings, sanitizeTiebreaks } from '../standings.js';
import { normalizeKnockout } from '../knockout.js';
import { fixedR32Teams } from '../bracket.js';
import { scorePlayer } from '../leaderboard.js';
import { GroupTable } from './Standings.jsx';
import { BestThirdsSelect } from './GroupStage.jsx';
import BracketStage from './BracketStage.jsx';

const RESULTS_KEY = 'ms2026-wyniki';
const LEGACY_DATA_KEY = 'ms2026-zbiorcza';

const RANK_MEDALS = ['🥇', '🥈', '🥉'];
const RESULT_OPTIONS = ['1', 'X', '2'];

// Short column headers for the ranking table, in tournament.rounds order.
const ROUND_SHORT = {
  r32: '1/16',
  r16: '1/8',
  qf: 'ĆF',
  sf: 'PF',
  final: 'F',
  third: '3M',
  champion: 'M',
};

function loadJson(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function Ranking({ scores }) {
  const ranked = [...scores].sort(
    (a, b) => b.total - a.total || a.player.name.localeCompare(b.player.name, 'pl'),
  );
  return (
    <table className="standings lb-ranking">
      <thead>
        <tr>
          <th>#</th>
          <th className="ta-left">Gracz</th>
          <th title="Mecze grupowe">Grupy</th>
          {tournament.rounds.map((r) => (
            <th key={r.id} title={r.label}>{ROUND_SHORT[r.id]}</th>
          ))}
          <th>Suma</th>
        </tr>
      </thead>
      <tbody>
        {ranked.map((s) => {
          // Shared rank for equal totals (1, 1, 3, …).
          const rank = 1 + ranked.findIndex((x) => x.total === s.total);
          const medal = s.total > 0 ? RANK_MEDALS[rank - 1] : null;
          return (
            <tr key={s.player.name} className="standings-row">
              <td>{medal ?? rank}</td>
              <td className="ta-left">{s.player.name}</td>
              <td title={`${s.groupsCorrect} trafień z ${s.groupsPlayed} rozegranych`}>
                {s.breakdown.groups}
              </td>
              {tournament.rounds.map((r) => (
                <td key={r.id}>{s.breakdown[r.id]}</td>
              ))}
              <td className="pts">{s.total}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function dayLabel(date) {
  return new Date(date + 'T12:00:00').toLocaleDateString('pl-PL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

// One picks table over the given matches. In `chrono` mode extra time/group
// columns appear and a separator row is inserted whenever the day changes.
function MatchesTable({ matches, players, results, onSetResult, chrono = false }) {
  const rows = [];
  let prevDate = null;
  for (const m of matches) {
    if (chrono && m.date !== prevDate) {
      prevDate = m.date;
      rows.push(
        <tr key={'day-' + m.date} className="lb-day-row">
          {/* 4 fixed columns in chrono mode: Mecz, Godz, Gr, Wynik */}
          <td className="ta-left" colSpan={4 + players.length}>
            <span className="lb-day-label">📅 {dayLabel(m.date)}</span>
          </td>
        </tr>,
      );
    }
    const res = results.groups[m.nr];
    rows.push(
      <tr key={m.nr}>
        <td className="ta-left sticky-col lb-match" title={`#${m.nr} · ${m.date} ${m.time}`}>
          {m.team1} – {m.team2}
        </td>
        {chrono && <td className="lb-meta">{m.time}</td>}
        {chrono && <td className="lb-meta">{m.group}</td>}
        <td>
          <div className="lb-result-group">
            {RESULT_OPTIONS.map((o) => (
              <button
                key={o}
                type="button"
                className={res === o ? 'pick-btn pick-sm selected' : 'pick-btn pick-sm'}
                onClick={() => onSetResult(m.nr, o)}
              >
                {o}
              </button>
            ))}
          </div>
        </td>
        {players.map((p) => {
          const pick = p.groups[m.nr];
          const cls = !res || !pick ? '' : pick === res ? ' hit' : ' miss';
          return (
            <td key={p.name}>
              <span className={'lb-pick' + cls}>{pick ?? '–'}</span>
            </td>
          );
        })}
      </tr>,
    );
  }

  return (
    // In chrono mode the table scrolls with the page and the header row sticks
    // to the top of the viewport (the ranking page header is not sticky).
    <div className={chrono ? 'lb-chrono' : 'lb-scroll'}>
      <table className="lb-table">
        <thead>
          <tr>
            <th className="ta-left sticky-col">Mecz</th>
            {chrono && <th>Godz</th>}
            {chrono && <th>Gr</th>}
            <th>Wynik</th>
            {players.map((p) => (
              <th key={p.name} className="player-name"><span>{p.name}</span></th>
            ))}
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
    </div>
  );
}

// All 72 matches in kick-off order — the default view for entering results
// day by day.
function ChronoMatches({ players, results, onSetResult }) {
  const matches = [...tournament.matches].sort(
    (a, b) => (a.date + a.time).localeCompare(b.date + b.time) || a.nr - b.nr,
  );
  return (
    <MatchesTable
      matches={matches}
      players={players}
      results={results}
      onSetResult={onSetResult}
      chrono
    />
  );
}

// Compact grid of all 12 group tables, used below the chronological match
// list so team order (tie-breaks) can be set without switching views.
function GroupTablesGrid({ standings, onReorderGroup }) {
  return (
    <div className="ko-results-grid lb-group-grid">
      {tournament.groupOrder.map((g) => (
        <GroupTable
          key={g}
          group={g}
          {...standings.byGroup[g]}
          onSwap={(idx) => {
            const order = standings.byGroup[g].ranked.map((r) => r.team);
            [order[idx], order[idx + 1]] = [order[idx + 1], order[idx]];
            onReorderGroup(g, order);
          }}
        />
      ))}
    </div>
  );
}

function GroupMatches({ players, results, standings, onSetResult, onReorderGroup }) {
  return tournament.groupOrder.map((g) => {
    const matches = tournament.matches.filter((m) => m.group === g);
    const done = matches.filter((m) => results.groups[m.nr]).length;
    return (
      <details key={g} className="group-block" open={done < matches.length}>
        <summary className="group-title">
          <span className="group-name">Grupa {g}</span>
          <span className="group-teams-inline">{tournament.groups[g].join(' · ')}</span>
          <span className={done === matches.length ? 'group-progress complete' : 'group-progress'}>
            {done}/{matches.length} wyników
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
        <MatchesTable
          matches={matches}
          players={players}
          results={results}
          onSetResult={onSetResult}
        />
      </details>
    );
  });
}

// Read-only view of everyone's picks for one knockout round, colored against
// the actual qualifiers entered via the bracket. Players are columns; row i
// holds everyone's i-th pick (for 1/16 the rows follow the template slots),
// with a per-player points row at the bottom.
function RoundPicks({ round, players, results }) {
  const actualList = results.knockout[round.id] ?? [];
  const actual = new Set(actualList);
  const complete = actualList.length === round.count;

  return (
    <details className="group-block" open={complete}>
      <summary className="group-title">
        <span className="group-name">{round.label}</span>
        <span className="group-teams-inline">{round.points} pkt za trafienie</span>
        <span className={complete ? 'group-progress complete' : 'group-progress'}>
          {actualList.length}/{round.count} wyników
        </span>
      </summary>
      <div className="lb-scroll">
        <table className="lb-table">
          <thead>
            <tr>
              <th></th>
              {players.map((p) => (
                <th key={p.name} className="player-name"><span>{p.name}</span></th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: round.count }, (_, i) => (
              <tr key={i}>
                <td className="lb-meta">{round.count > 1 ? i + 1 : ''}</td>
                {players.map((p) => {
                  const team = (p.knockout[round.id] ?? [])[i];
                  const cls = !team ? '' : actual.has(team) ? ' hit' : complete ? ' miss' : '';
                  return (
                    <td key={p.name}>
                      <span className={'lb-ko-team' + cls} title={team}>{team ?? '–'}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr className="lb-pts-row">
              <td>Pkt</td>
              {players.map((p) => {
                const hits = (p.knockout[round.id] ?? []).filter((t) => actual.has(t)).length;
                return <td key={p.name}>{hits * round.points}</td>;
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </details>
  );
}

export default function Leaderboard() {
  const [matchView, setMatchView] = useState('chrono');
  const [results, setResults] = useState(() => {
    const r = loadJson(RESULTS_KEY);
    return {
      groups: r?.groups ?? {},
      knockout: r?.knockout ?? {},
      tiebreaks: sanitizeTiebreaks(r?.tiebreaks),
    };
  });

  useEffect(() => {
    localStorage.setItem(RESULTS_KEY, JSON.stringify(results));
  }, [results]);

  // Predictions are now bundled at build time (src/data/players.js); drop any
  // leftover uploaded copy so an old in-browser file can't shadow the build.
  useEffect(() => {
    localStorage.removeItem(LEGACY_DATA_KEY);
  }, []);

  const standings = useMemo(
    () => buildStandings(results.groups, results.tiebreaks),
    [results.groups, results.tiebreaks],
  );
  const scores = useMemo(
    () => players.map((p) => ({ player: p, ...scorePlayer(p, results) })),
    [players, results],
  );

  // The handlers below mirror App.jsx — the results object has the same shape
  // as a player's predictions, so the typer's group/bracket views drive it.
  const setGroupResult = (nr, value) => {
    setResults((prev) => {
      const groups = { ...prev.groups };
      if (groups[nr] === value) delete groups[nr];
      else groups[nr] = value;
      return { ...prev, groups };
    });
  };

  const setGroupOrder = (group, order) => {
    setResults((prev) => ({
      ...prev,
      tiebreaks: { ...prev.tiebreaks, [group]: order },
    }));
  };

  const setThirds = (thirdTeams) => {
    setResults((prev) => {
      const r32 = [...fixedR32Teams(standings), ...thirdTeams.slice(0, 8)];
      return { ...prev, knockout: normalizeKnockout({ ...prev.knockout, r32 }) };
    });
  };

  const setMatchWinner = (targetRound, [a, b], team) => {
    setResults((prev) => {
      const cur = prev.knockout[targetRound] ?? [];
      const next = cur.filter((t) => t !== a && t !== b);
      if (!cur.includes(team)) next.push(team);
      return {
        ...prev,
        knockout: normalizeKnockout({ ...prev.knockout, [targetRound]: next }),
      };
    });
  };

  const handleClearResults = () => {
    if (confirm('Wyczyścić wszystkie wpisane wyniki meczów?')) {
      setResults({ groups: {}, knockout: {}, tiebreaks: {} });
    }
  };

  const thirdsTeams = new Set(standings.thirds.map((t) => t.team));
  const selectedThirds = (results.knockout.r32 ?? []).filter((t) => thirdsTeams.has(t));

  return (
    <div className="leaderboard">
      <div className="lb-toolbar">
        <span className="lb-updated">{players.length} graczy</span>
        <button className="btn btn-ghost" onClick={handleClearResults}>🗑️ Wyczyść wyniki</button>
      </div>

      <p className="legend">
            Punkty: mecz grupowy {tournament.groupMatchPoints} pkt,
            {' '}{tournament.rounds.map((r) => `${r.label.toLowerCase()} ${r.points} pkt`).join(', ')}.
            Punkty za fazę pucharową naliczają się za każdą trafioną drużynę w danej fazie.
          </p>
          <Ranking scores={scores} />

          <h2 className="lb-heading">Faza grupowa — wyniki i typy</h2>
          <p className="legend">
            Wpisz wynik meczu (1/X/2) w kolumnie <strong>Wynik</strong> — trafione typy
            podświetlą się na <span className="lb-pick hit">zielono</span>, nietrafione
            zostaną <span className="lb-pick miss">wygaszone</span>. W widoku „Wg grup”
            tabele liczą się na żywo; przy remisie punktowym (⚖︎) ustaw kolejność
            strzałkami <strong>↑ ↓</strong>.
          </p>
          <div className="round-tabs">
            <button
              type="button"
              className={matchView === 'chrono' ? 'round-tab active' : 'round-tab'}
              onClick={() => setMatchView('chrono')}
            >
              📅 Terminarz
            </button>
            <button
              type="button"
              className={matchView === 'groups' ? 'round-tab active' : 'round-tab'}
              onClick={() => setMatchView('groups')}
            >
              Wg grup
            </button>
          </div>
          {matchView === 'chrono' ? (
            <>
              <ChronoMatches players={players} results={results} onSetResult={setGroupResult} />
              <h3 className="lb-subheading">Tabele grup</h3>
              <GroupTablesGrid standings={standings} onReorderGroup={setGroupOrder} />
            </>
          ) : (
            <GroupMatches
              players={players}
              results={results}
              standings={standings}
              onSetResult={setGroupResult}
              onReorderGroup={setGroupOrder}
            />
          )}

          <h2 className="lb-heading">Faza pucharowa — wyniki</h2>
          <p className="legend">
            Tak jak w typerze: po uzupełnieniu meczów grupowych zatwierdź
            {' '}<strong>8 drużyn z 3. miejsc</strong>, a potem klikaj zwycięzców
            kolejnych meczów w drabince.
          </p>
          <BestThirdsSelect
            thirds={standings.thirds}
            cutoffTied={standings.cutoffTied}
            selected={selectedThirds}
            onSetThirds={setThirds}
          />
          <BracketStage
            knockout={results.knockout}
            standings={standings}
            onSetWinner={setMatchWinner}
          />

          <h2 className="lb-heading">Typy graczy — faza pucharowa</h2>
          <p className="legend">
            Każdy gracz w osobnej kolumnie. Trafione drużyny są
            {' '}<span className="lb-ko-team hit">zielone</span>; nietrafione zostają
            wygaszone dopiero, gdy dana faza jest kompletna.
          </p>
          {tournament.rounds.map((r) => (
            <RoundPicks key={r.id} round={r} players={players} results={results} />
          ))}
    </div>
  );
}
