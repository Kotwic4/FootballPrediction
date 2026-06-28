import { useEffect, useMemo, useState } from 'react';
import { tournament } from '../data/tournament.js';
import { players } from '../data/players.js';
import { buildStandings, sanitizeTiebreaks } from '../standings.js';
import { normalizeKnockout } from '../knockout.js';
import { fixedR32Teams, resolveBracket } from '../bracket.js';
import { scorePlayer } from '../leaderboard.js';
import { fetchWikiResults } from '../wikiResults.js';
import { GroupTable } from './Standings.jsx';
import { BestThirdsSelect } from './GroupStage.jsx';
import BracketStage from './BracketStage.jsx';

const RESULTS_KEY = 'ms2026-wyniki';
const LEGACY_DATA_KEY = 'ms2026-zbiorcza';

const RANK_MEDALS = ['🥇', '🥈', '🥉'];
const RESULT_OPTIONS = ['1', 'X', '2'];

// Shades every second player column so a single player is easy to follow down
// the wide pick tables.
const altCol = (i) => (i % 2 ? ' lb-col-alt' : '');

// Teams that are out for good, given the results so far: 4th in a finished
// group, third-placed teams that didn't make the best-8, and the losers of any
// decided knockout match. Used to cross such teams out of everyone's picks in
// every later round (not just the round where they were knocked out).
function computeEliminated(standings, bracket) {
  const out = new Set();
  const groupsComplete = tournament.groupOrder.every((g) => standings.byGroup[g].complete);
  for (const g of tournament.groupOrder) {
    const gs = standings.byGroup[g];
    if (gs.complete && gs.ranked[3]?.team) out.add(gs.ranked[3].team);
  }
  if (groupsComplete) {
    for (const t of standings.thirds) if (!t.advances && t.team) out.add(t.team);
  }
  for (const m of Object.values(bracket.matches)) {
    if (m.winner && m.a && m.b) out.add(m.winner === m.a ? m.b : m.a);
  }
  return out;
}

// Build name → shared rank (1, 1, 3, …) from the current scores, matching the
// ranking table's tie handling.
function rankMap(scores) {
  const sorted = [...scores].sort(
    (a, b) => b.total - a.total || a.player.name.localeCompare(b.player.name, 'pl'),
  );
  const map = {};
  for (const s of sorted) map[s.player.name] = 1 + sorted.findIndex((x) => x.total === s.total);
  return map;
}

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
function MatchesTable({ matches, players, results, onSetResult, ranks, showRanks, chrono = false }) {
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
        {players.map((p, i) => {
          const pick = p.groups[m.nr];
          const cls = !res || !pick ? '' : pick === res ? ' hit' : ' miss';
          return (
            <td key={p.name} className={altCol(i)}>
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
            {players.map((p, i) => (
              <th key={p.name} className={'player-name' + altCol(i)}>
                {showRanks && <span className="player-rank">{ranks[p.name]}.</span>}
                <span>{p.name}</span>
              </th>
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
function ChronoMatches({ players, results, onSetResult, ranks, showRanks }) {
  const matches = [...tournament.matches].sort(
    (a, b) => (a.date + a.time).localeCompare(b.date + b.time) || a.nr - b.nr,
  );
  return (
    <MatchesTable
      matches={matches}
      players={players}
      results={results}
      onSetResult={onSetResult}
      ranks={ranks}
      showRanks={showRanks}
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

function GroupMatches({ players, results, standings, onSetResult, onReorderGroup, ranks, showRanks }) {
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
          ranks={ranks}
          showRanks={showRanks}
        />
      </details>
    );
  });
}

// Read-only view of everyone's picks for one knockout round, colored against
// the actual qualifiers entered via the bracket. Players are columns; row i
// holds everyone's i-th pick (for 1/16 the rows follow the template slots),
// with a per-player points row at the bottom.
function RoundPicks({ round, players, results, ranks, showRanks, eliminated }) {
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
      {/* Page-level horizontal scroll (like the group chrono table) so every
          player column is reachable on a phone, not just the first few. */}
      <div className="lb-chrono">
        <table className="lb-table">
          <thead>
            <tr>
              <th></th>
              {players.map((p, i) => (
                <th key={p.name} className={'player-name' + altCol(i)}>
                  {showRanks && <span className="player-rank">{ranks[p.name]}.</span>}
                  <span>{p.name}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: round.count }, (_, i) => (
              <tr key={i}>
                <td className="lb-meta">{round.count > 1 ? i + 1 : ''}</td>
                {players.map((p, pi) => {
                  const team = (p.knockout[round.id] ?? [])[i];
                  const cls = !team ? '' : actual.has(team) ? ' hit' : eliminated.has(team) ? ' miss' : '';
                  return (
                    <td key={p.name} className={altCol(pi)}>
                      <span className={'lb-ko-team' + cls} title={team}>{team ?? '–'}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr className="lb-pts-row">
              <td>Pkt</td>
              {players.map((p, pi) => {
                const hits = (p.knockout[round.id] ?? []).filter((t) => actual.has(t)).length;
                return <td key={p.name} className={altCol(pi)}>{hits * round.points}</td>;
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </details>
  );
}

// Summary of the group stage: how many matches are played, the 1/X/2 outcome
// distribution, and how the players are doing against those results.
function GroupStats({ results, scores }) {
  const total = tournament.matches.length;
  const dist = { 1: 0, X: 0, 2: 0 };
  for (const m of tournament.matches) {
    const r = results.groups[m.nr];
    if (r) dist[r] += 1;
  }
  const played = dist[1] + dist.X + dist[2];
  const pct = (n) => (played ? Math.round((n / played) * 100) : 0);
  const acc = (hits) => (played ? Math.round((hits / played) * 100) : 0);

  const ranked = [...scores].sort(
    (a, b) => b.groupsCorrect - a.groupsCorrect || a.player.name.localeCompare(b.player.name, 'pl'),
  );
  const leader = ranked[0];
  const hits = scores.map((s) => s.groupsCorrect);
  const avgAcc = scores.length ? acc(hits.reduce((a, b) => a + b, 0) / scores.length) : 0;

  const segs = [
    { key: '1', cls: 'seg-1', label: 'Gospodarze (1)', n: dist[1] },
    { key: 'X', cls: 'seg-x', label: 'Remisy (X)', n: dist.X },
    { key: '2', cls: 'seg-2', label: 'Goście (2)', n: dist[2] },
  ];

  return (
    <section className="lb-stats">
      <div className="stat-cards">
        <div className="stat-card">
          <span className="stat-value">{played}/{total}</span>
          <span className="stat-label">Rozegrane mecze</span>
        </div>
        {segs.map((s) => (
          <div key={s.key} className="stat-card">
            <span className="stat-value">{s.n} · {pct(s.n)}%</span>
            <span className="stat-label">{s.label}</span>
          </div>
        ))}
      </div>

      {played > 0 && (
        <div className="stat-bar" title="Rozkład wyników 1 / X / 2">
          {segs.map((s) =>
            s.n ? (
              <span key={s.key} className={'seg ' + s.cls} style={{ width: pct(s.n) + '%' }}>
                {pct(s.n) >= 10 ? `${s.key} ${pct(s.n)}%` : ''}
              </span>
            ) : null,
          )}
        </div>
      )}

      {played > 0 && scores.length > 0 && (
        <div className="stat-cards">
          <div className="stat-card">
            <span className="stat-value">{leader.player.name}</span>
            <span className="stat-label">
              Lider grup — {leader.groupsCorrect} pkt ({acc(leader.groupsCorrect)}%)
            </span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{avgAcc}%</span>
            <span className="stat-label">Średnia skuteczność ({scores.length} graczy)</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{acc(Math.max(...hits))}%</span>
            <span className="stat-label">Najlepsza skuteczność</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{acc(Math.min(...hits))}%</span>
            <span className="stat-label">Najsłabsza skuteczność</span>
          </div>
        </div>
      )}
    </section>
  );
}

export default function Leaderboard() {
  const [matchView, setMatchView] = useState('chrono');
  // Which block of the page is shown: the group stage or straight to knockout.
  // Knockout is the default now that the group stage is over.
  const [section, setSection] = useState('knockout');
  const [results, setResults] = useState(() => {
    const r = loadJson(RESULTS_KEY);
    return {
      groups: r?.groups ?? {},
      knockout: r?.knockout ?? {},
      tiebreaks: sanitizeTiebreaks(r?.tiebreaks),
      // Goal diff / goals for per team, from the Wikipedia download. Used to
      // rank the third-placed teams correctly (our 1/X/2 data has no goals).
      goalStats: r?.goalStats ?? {},
      // When false, the 8 best third-placed teams are auto-selected from the
      // standings; once the user edits the selection by hand it flips to true
      // and their choice is kept until they reset back to auto.
      thirdsManual: r?.thirdsManual ?? false,
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
    () => buildStandings(results.groups, results.tiebreaks, results.goalStats),
    [results.groups, results.tiebreaks, results.goalStats],
  );
  const scores = useMemo(
    () => players.map((p) => ({ player: p, ...scorePlayer(p, results) })),
    [players, results],
  );
  const ranks = useMemo(() => rankMap(scores), [scores]);
  // Don't clutter the headers with "1." for everyone before any result exists.
  const showRanks = scores.some((s) => s.total > 0);

  const bracket = useMemo(
    () => resolveBracket(results.knockout, standings),
    [results.knockout, standings],
  );
  const eliminated = useMemo(() => computeEliminated(standings, bracket), [standings, bracket]);

  const groupsComplete = tournament.groupOrder.every((g) => standings.byGroup[g].complete);

  // Round of 32 fills itself from the standings: each finished group sends its
  // top two through. The 8 best third-placed teams are added automatically once
  // every group is done — unless the user has overridden the third-place
  // selection by hand (thirdsManual), in which case their choice is kept.
  useEffect(() => {
    const thirdSet = new Set(standings.thirds.map((t) => t.team));
    const autoThirds = groupsComplete
      ? standings.thirds.filter((t) => t.advances).map((t) => t.team)
      : [];
    setResults((prev) => {
      const curR32 = prev.knockout.r32 ?? [];
      const keptThirds = prev.thirdsManual ? curR32.filter((t) => thirdSet.has(t)) : autoThirds;
      const r32 = [...fixedR32Teams(standings), ...keptThirds];
      if (curR32.length === r32.length && curR32.every((t) => r32.includes(t))) return prev;
      return { ...prev, knockout: normalizeKnockout({ ...prev.knockout, r32 }) };
    });
  }, [standings, groupsComplete]);

  // Manual third-place override: lock the selection to the chosen teams.
  const setThirds = (thirdTeams) => {
    setResults((prev) => {
      const r32 = [...fixedR32Teams(standings), ...thirdTeams.slice(0, 8)];
      return { ...prev, thirdsManual: true, knockout: normalizeKnockout({ ...prev.knockout, r32 }) };
    });
  };

  // Hand control of the third-place picks back to the automatic best-8.
  const resetThirdsToAuto = () => {
    setResults((prev) => {
      const autoThirds = standings.thirds.filter((t) => t.advances).map((t) => t.team);
      const r32 = [...fixedR32Teams(standings), ...autoThirds];
      return { ...prev, thirdsManual: false, knockout: normalizeKnockout({ ...prev.knockout, r32 }) };
    });
  };

  const [downloading, setDownloading] = useState(false);
  const [downloadMsg, setDownloadMsg] = useState(null);

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
      setResults({ groups: {}, knockout: {}, tiebreaks: {}, goalStats: {}, thirdsManual: false });
    }
  };

  // Pull current group-stage results (1/X/2) from Wikipedia and merge them in,
  // overwriting any manually entered results and group order with the official
  // ones (Wikipedia's order resolves point ties by goal difference).
  const handleDownloadResults = async () => {
    setDownloading(true);
    setDownloadMsg(null);
    try {
      const { groups, count, scored, unresolved, source, tiebreaks, stats, knockout } = await fetchWikiResults();
      // Merge knockout winners raw; the auto-R32 effect normalises them against
      // the freshly recomputed round of 32 (pruning here would use the stale one).
      setResults((prev) => ({
        ...prev,
        groups: { ...prev.groups, ...groups },
        tiebreaks: { ...prev.tiebreaks, ...sanitizeTiebreaks(tiebreaks) },
        goalStats: { ...prev.goalStats, ...stats },
        knockout: { ...prev.knockout, ...knockout },
      }));
      const koCount = Object.values(knockout).reduce((a, b) => a + b.length, 0);
      let msg;
      if (count) {
        msg = {
          kind: 'ok',
          text:
            `Pobrano ${count} wyników grupowych` +
            (koCount ? ` i ${koCount} pucharowych` : '') +
            ` (źródło: ${source}).`,
        };
      } else if (scored === 0) {
        msg = { kind: 'warn', text: 'Żaden mecz nie został jeszcze rozegrany na Wikipedii.' };
      } else if (unresolved) {
        msg = { kind: 'warn', text: `Znaleziono ${scored} wyników, ale nie udało się dopasować drużyn.` };
      } else {
        msg = { kind: 'warn', text: 'Nie znaleziono rozegranych meczów grupowych.' };
      }
      setDownloadMsg(msg);
    } catch (err) {
      setDownloadMsg({
        kind: 'warn',
        text: `Nie udało się pobrać wyników (${err.message}).`,
      });
    } finally {
      setDownloading(false);
    }
  };

  const thirdsTeams = new Set(standings.thirds.map((t) => t.team));
  const selectedThirds = (results.knockout.r32 ?? []).filter((t) => thirdsTeams.has(t));

  return (
    <div className="leaderboard">
      <div className="lb-toolbar">
        <span className="lb-updated">{players.length} graczy</span>
        <button className="btn btn-ghost" onClick={handleDownloadResults} disabled={downloading}>
          {downloading ? '⏳ Pobieranie…' : '🌐 Pobierz wyniki z internetu'}
        </button>
        <button className="btn btn-ghost" onClick={handleClearResults}>🗑️ Wyczyść wyniki</button>
        {downloadMsg && (
          <span className={downloadMsg.kind === 'ok' ? 'lb-download-msg ok' : 'lb-download-msg warn'}>
            {downloadMsg.text}
          </span>
        )}
      </div>

      <p className="legend">
            Punkty: mecz grupowy {tournament.groupMatchPoints} pkt,
            {' '}{tournament.rounds.map((r) => `${r.label.toLowerCase()} ${r.points} pkt`).join(', ')}.
            Punkty za fazę pucharową naliczają się za każdą trafioną drużynę w danej fazie.
          </p>
          <Ranking scores={scores} />

          <div className="round-tabs lb-section-tabs">
            <button
              type="button"
              className={section === 'groups' ? 'round-tab active' : 'round-tab'}
              onClick={() => setSection('groups')}
            >
              📊 Faza grupowa
            </button>
            <button
              type="button"
              className={section === 'knockout' ? 'round-tab active' : 'round-tab'}
              onClick={() => setSection('knockout')}
            >
              🏆 Faza pucharowa
            </button>
          </div>

          {section === 'groups' && (
            <>
          <h2 className="lb-heading">Faza grupowa — wyniki i typy</h2>
          <p className="legend">
            Wpisz wynik meczu (1/X/2) w kolumnie <strong>Wynik</strong> — trafione typy
            podświetlą się na <span className="lb-pick hit">zielono</span>, nietrafione
            zostaną <span className="lb-pick miss">wygaszone</span>. W widoku „Wg grup”
            tabele liczą się na żywo; przy remisie punktowym (⚖︎) ustaw kolejność
            strzałkami <strong>↑ ↓</strong>.
          </p>
          <GroupStats results={results} scores={scores} />
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
              <ChronoMatches
                players={players}
                results={results}
                onSetResult={setGroupResult}
                ranks={ranks}
                showRanks={showRanks}
              />
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
              ranks={ranks}
              showRanks={showRanks}
            />
          )}

          <h2 className="lb-heading">Awans z 3. miejsc</h2>
          {groupsComplete ? (
            <BestThirdsSelect
              thirds={standings.thirds}
              cutoffTied={standings.cutoffTied}
              selected={selectedThirds}
              onSetThirds={setThirds}
              title="Awans z 3. miejsc — 8 z 12 (możesz nadpisać ręcznie)"
              actions={
                <span className="lb-thirds-mode">
                  <span className={results.thirdsManual ? 'badge' : 'badge badge-auto'}>
                    {results.thirdsManual ? '✋ Wybór ręczny' : '⚙️ Automat (wg wyników)'}
                  </span>
                  {results.thirdsManual && (
                    <button type="button" className="btn btn-small inline-btn" onClick={resetThirdsToAuto}>
                      ↩︎ Wróć do automatu
                    </button>
                  )}
                </span>
              }
            />
          ) : (
            <p className="legend">
              Tabela 3. miejsc pojawi się po zakończeniu <strong>wszystkich</strong> meczów
              grupowych — wtedy 8 najlepszych zostanie wybranych automatycznie (z możliwością
              ręcznej zmiany).
            </p>
          )}
            </>
          )}

          {section === 'knockout' && (
            <>
          <h2 className="lb-heading">Faza pucharowa — wyniki</h2>
          <p className="legend">
            Drabinka wypełnia się automatycznie wynikami grup: <strong>1. i 2.</strong>
            {' '}miejsce z każdej zakończonej grupy wchodzi do 1/16, a po komplecie grup
            dochodzi <strong>8 najlepszych drużyn z 3. miejsc</strong> (wybierane w zakładce
            {' '}„Faza grupowa”). Puste miejsca mają etykiety (np. „Zwycięzca grupy A”).
            Klikaj zwycięzców kolejnych meczów.
          </p>

          <BracketStage
            knockout={results.knockout}
            standings={standings}
            onSetWinner={setMatchWinner}
            progressive
          />

          <h2 className="lb-heading">Typy graczy — faza pucharowa</h2>
          <p className="legend">
            Każdy gracz w osobnej kolumnie. Trafione drużyny są
            {' '}<span className="lb-ko-team hit">zielone</span>; nietrafione zostają
            wygaszone dopiero, gdy dana faza jest kompletna.
          </p>
          {tournament.rounds.map((r) => (
            <RoundPicks
              key={r.id}
              round={r}
              players={players}
              results={results}
              ranks={ranks}
              showRanks={showRanks}
              eliminated={eliminated}
            />
          ))}
            </>
          )}
    </div>
  );
}
