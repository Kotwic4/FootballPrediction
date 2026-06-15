import { useEffect, useMemo, useRef, useState } from 'react';
import { tournament } from './data/tournament.js';
import { buildStandings, sanitizeTiebreaks } from './standings.js';
import { normalizeKnockout } from './knockout.js';
import { fixedR32Teams } from './bracket.js';
import GroupStage from './components/GroupStage.jsx';
import BracketStage from './components/BracketStage.jsx';
import ProgressPanel from './components/ProgressPanel.jsx';
import Leaderboard from './components/Leaderboard.jsx';

const STORAGE_KEY = 'ms2026-typy';
const NAME_KEY = 'ms2026-imie';

function loadInitial() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        groups: parsed.groups ?? {},
        knockout: parsed.knockout ?? {},
        tiebreaks: sanitizeTiebreaks(parsed.tiebreaks),
      };
    }
  } catch {
    // ignore corrupt storage
  }
  return { groups: {}, knockout: {}, tiebreaks: {} };
}

// Build a safe, readable file-name fragment from the player's name.
function slugify(name) {
  return name
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}_-]/gu, '');
}

// Top-level view, driven by the URL hash. The ranking is the home page; the
// old prediction typer is hidden for now, reachable only via #typer.
function viewFromHash() {
  return window.location.hash === '#typer' ? 'typer' : 'ranking';
}

export default function App() {
  const [predictions, setPredictions] = useState(loadInitial);
  const [name, setName] = useState(() => localStorage.getItem(NAME_KEY) || '');
  const [tab, setTab] = useState('groups');
  const [view, setView] = useState(viewFromHash);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const onHash = () => setView(viewFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(predictions));
  }, [predictions]);

  useEffect(() => {
    localStorage.setItem(NAME_KEY, name);
  }, [name]);

  const standings = useMemo(
    () => buildStandings(predictions.groups, predictions.tiebreaks),
    [predictions.groups, predictions.tiebreaks],
  );

  const setGroupPick = (nr, pick) => {
    setPredictions((prev) => {
      const groups = { ...prev.groups };
      if (groups[nr] === pick) delete groups[nr];
      else groups[nr] = pick;
      return { ...prev, groups };
    });
  };

  // Manual order of a whole group, used to settle point ties (points still
  // rank first — the stored order only decides among level teams).
  const setGroupOrder = (group, order) => {
    setPredictions((prev) => ({
      ...prev,
      tiebreaks: { ...prev.tiebreaks, [group]: order },
    }));
  };

  // Best thirds confirmed in the group stage. The round of 32 is the 24 fixed
  // qualifiers (group winners + runners-up) plus the chosen thirds.
  const setThirds = (thirdTeams) => {
    setPredictions((prev) => {
      const r32 = [...fixedR32Teams(standings), ...thirdTeams.slice(0, 8)];
      return { ...prev, knockout: normalizeKnockout({ ...prev.knockout, r32 }) };
    });
  };

  // Bracket: pick the winner of a single match; the loser (and anything that
  // depended on it) is pruned from the target round.
  const setMatchWinner = (targetRound, [a, b], team) => {
    setPredictions((prev) => {
      const cur = prev.knockout[targetRound] ?? [];
      const next = cur.filter((t) => t !== a && t !== b);
      if (!cur.includes(team)) next.push(team);
      return {
        ...prev,
        knockout: normalizeKnockout({ ...prev.knockout, [targetRound]: next }),
      };
    });
  };

  const handleExport = async () => {
    let who = name.trim();
    if (!who) {
      who = (prompt('Podaj swoje imię (zostanie użyte w nazwie pliku):') || '').trim();
      if (!who) return; // cancelled / empty — don't export without a name
      setName(who);
    }
    const { downloadXlsx } = await import('./excel.js');
    const slug = slugify(who) || 'typy';
    downloadXlsx(predictions, `typy-ms-2026_${slug}.xlsx`);
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-importing the same file
    if (!file) return;
    try {
      const { importFromXlsx } = await import('./excel.js');
      const buf = await file.arrayBuffer();
      const { predictions: imported, warnings } = await importFromXlsx(buf);
      setPredictions({
        groups: imported.groups,
        knockout: normalizeKnockout(imported.knockout),
        tiebreaks: sanitizeTiebreaks(imported.tiebreaks),
      });
      if (warnings.length) {
        alert(
          `Wczytano typy, ale pominięto ${warnings.length} pozycji:\n\n` +
            warnings.slice(0, 12).join('\n') +
            (warnings.length > 12 ? '\n…' : ''),
        );
      }
    } catch (err) {
      alert('Nie udało się wczytać pliku Excel. Upewnij się, że to plik .xlsx z typami.');
      console.error(err);
    }
  };

  const handleReset = () => {
    if (confirm('Na pewno wyczyścić wszystkie typy? Tej operacji nie można cofnąć.')) {
      setPredictions({ groups: {}, knockout: {}, tiebreaks: {} });
    }
  };

  if (view === 'ranking') {
    return (
      <div className="app app-ranking">
        <header className="app-header">
          <div className="title-block">
            <h1>🏆 Ranking — {tournament.tournamentName}</h1>
          </div>
        </header>
        <main className="content">
          <Leaderboard />
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="title-block">
          <h1>⚽ Typer {tournament.tournamentName}</h1>
        </div>
        <div className="actions">
          <input
            className="name-input"
            type="text"
            placeholder="Twoje imię"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="Twoje imię"
          />
          <button className="btn" onClick={handleImportClick}>📂 Wczytaj Excel</button>
          <button className="btn btn-primary" onClick={handleExport}>💾 Zapisz do Excel</button>
          <button className="btn btn-ghost" onClick={handleReset}>🗑️ Wyczyść</button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFile}
            hidden
          />
        </div>
      </header>

      <div className="info-bar">
        Wypełnij swoje typy, kliknij <strong>„Zapisz do Excel”</strong> i
        {' '}<strong>wyślij pobrany plik e-mailem do organizatora</strong> 📧.
        Aby kontynuować później lub poprawić typy, kliknij
        {' '}<strong>„Wczytaj Excel”</strong> i wybierz swój plik.
      </div>

      <ProgressPanel predictions={predictions} />

      <nav className="tabs">
        <button
          className={tab === 'groups' ? 'tab active' : 'tab'}
          onClick={() => setTab('groups')}
        >
          Faza grupowa
        </button>
        <button
          className={tab === 'knockout' ? 'tab active' : 'tab'}
          onClick={() => setTab('knockout')}
        >
          Faza pucharowa
        </button>
        <button
          className="tab tab-link"
          onClick={() => {
            // Clear the #typer hash so we land on the ranking home page.
            history.replaceState(null, '', window.location.pathname + window.location.search);
            window.dispatchEvent(new HashChangeEvent('hashchange'));
          }}
        >
          🏆 Ranking
        </button>
      </nav>

      <main className="content">
        {tab === 'groups' && (
          <GroupStage
            predictions={predictions.groups}
            onPick={setGroupPick}
            standings={standings}
            r32={predictions.knockout.r32 ?? []}
            onSetThirds={setThirds}
            onReorderGroup={setGroupOrder}
            onGoToKnockout={() => setTab('knockout')}
          />
        )}
        {tab === 'knockout' && (
          <BracketStage
            knockout={predictions.knockout}
            standings={standings}
            onSetWinner={setMatchWinner}
          />
        )}
      </main>
    </div>
  );
}
