import { useEffect, useMemo, useRef, useState } from 'react';
import { tournament } from './data/tournament.js';
import { buildStandings } from './standings.js';
import { normalizeKnockout } from './knockout.js';
import GroupStage from './components/GroupStage.jsx';
import KnockoutStage from './components/KnockoutStage.jsx';
import BracketStage from './components/BracketStage.jsx';
import ProgressPanel from './components/ProgressPanel.jsx';

const STORAGE_KEY = 'ms2026-typy';
const NAME_KEY = 'ms2026-imie';

function loadInitial() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { groups: parsed.groups ?? {}, knockout: parsed.knockout ?? {} };
    }
  } catch {
    // ignore corrupt storage
  }
  return { groups: {}, knockout: {} };
}

// Build a safe, readable file-name fragment from the player's name.
function slugify(name) {
  return name
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}_-]/gu, '');
}

export default function App() {
  const [predictions, setPredictions] = useState(loadInitial);
  const [name, setName] = useState(() => localStorage.getItem(NAME_KEY) || '');
  const [tab, setTab] = useState('groups');
  const fileInputRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(predictions));
  }, [predictions]);

  useEffect(() => {
    localStorage.setItem(NAME_KEY, name);
  }, [name]);

  const standings = useMemo(() => buildStandings(predictions.groups), [predictions.groups]);

  const setGroupPick = (nr, pick) => {
    setPredictions((prev) => {
      const groups = { ...prev.groups };
      if (groups[nr] === pick) delete groups[nr];
      else groups[nr] = pick;
      return { ...prev, groups };
    });
  };

  const toggleKnockoutTeam = (roundId, team, max) => {
    setPredictions((prev) => {
      const current = prev.knockout[roundId] ?? [];
      let next;
      if (current.includes(team)) {
        next = current.filter((t) => t !== team);
      } else {
        if (current.length >= max) return prev; // round is full
        next = [...current, team];
      }
      // Re-validate so removals cascade into later rounds.
      const knockout = normalizeKnockout({ ...prev.knockout, [roundId]: next });
      return { ...prev, knockout };
    });
  };

  // Clear a single knockout round (cascades into later rounds via normalize).
  const clearKnockoutRound = (roundId) => {
    setPredictions((prev) => {
      const knockout = normalizeKnockout({ ...prev.knockout, [roundId]: [] });
      return { ...prev, knockout };
    });
  };

  // Fill the round of 32 with the teams the group standings imply advance.
  const autofillR32 = () => {
    setPredictions((prev) => {
      const knockout = normalizeKnockout({
        ...prev.knockout,
        r32: [...standings.advancers],
      });
      return { ...prev, knockout };
    });
  };

  // Bracket: set the full round-of-32 (24 fixed qualifiers + chosen thirds).
  const setR32 = (teams) => {
    setPredictions((prev) => ({
      ...prev,
      knockout: normalizeKnockout({ ...prev.knockout, r32: teams }),
    }));
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
      setPredictions({ groups: {}, knockout: {} });
    }
  };

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
        Wypełnij swoje typy i kliknij <strong>„Zapisz do Excel”</strong>, a następnie
        wyślij plik Excel do organizatora. Możesz kliknąć <strong>„Wczytaj Excel”</strong>,
        aby kontynuować wypełnianie lub zmodyfikować już utworzony plik.
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
          className={tab === 'tree' ? 'tab active' : 'tab'}
          onClick={() => setTab('tree')}
        >
          Drzewo
        </button>
      </nav>

      <main className="content">
        {tab === 'groups' && (
          <GroupStage
            predictions={predictions.groups}
            onPick={setGroupPick}
            standings={standings}
          />
        )}
        {tab === 'knockout' && (
          <KnockoutStage
            predictions={predictions.knockout}
            onToggle={toggleKnockoutTeam}
            onClearRound={clearKnockoutRound}
            onAutofillR32={autofillR32}
            standings={standings}
          />
        )}
        {tab === 'tree' && (
          <BracketStage
            knockout={predictions.knockout}
            standings={standings}
            onSetR32={setR32}
            onSetWinner={setMatchWinner}
          />
        )}
      </main>
    </div>
  );
}
