import * as XLSX from 'xlsx';
import { tournament } from './data/tournament.js';
import { LABEL_TO_ROUND } from './excel.js';
import { normalizeTeam } from './leaderboard.js';

/**
 * Parse the organizer's aggregate spreadsheet ("ZBIORCZA"): columns A–G are
 * the match template, every column from H on is one player's picks with the
 * player's name in the header row.
 *
 * The sheet contains paste leftovers from individual files (points legend,
 * team reference list, a numbering row) — rows are therefore matched only by
 * a known match number in column A or a round label in column D; everything
 * else is ignored.
 *
 * Returns { players: [{ name, groups, knockout }], warnings }.
 */
export function parseAggregateXlsx(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });

  const headerIdx = rows.findIndex((r) => String(r[0]).trim() === 'Nr meczu');
  if (headerIdx < 0) {
    throw new Error('Nie znaleziono wiersza nagłówka („Nr meczu”) w arkuszu.');
  }
  const header = rows[headerIdx];
  const players = [];
  for (let c = 7; c < header.length; c++) {
    const name = String(header[c]).trim();
    if (name) players.push({ name, col: c, groups: {}, knockout: {} });
  }
  if (!players.length) {
    throw new Error('Nie znaleziono żadnych graczy (kolumny od H z imionami w nagłówku).');
  }

  const warnings = [];
  const matchNrs = new Set(tournament.matches.map((m) => m.nr));

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    const colA = row[0];
    const nr = typeof colA === 'number' ? colA : parseInt(colA, 10);

    if (matchNrs.has(nr)) {
      for (const p of players) {
        const pick = String(row[p.col] ?? '').trim().toUpperCase();
        if (!pick) {
          warnings.push(`${p.name}, mecz ${nr}: brak typu`);
        } else if (pick === '1' || pick === 'X' || pick === '2') {
          p.groups[nr] = pick;
        } else {
          warnings.push(`${p.name}, mecz ${nr}: nieznany typ „${row[p.col]}” (oczekiwano 1/X/2)`);
        }
      }
      continue;
    }

    const label = String(row[3] ?? '').trim();
    const roundId = LABEL_TO_ROUND[label];
    if (!roundId) continue;

    for (const p of players) {
      const raw = String(row[p.col] ?? '').trim();
      if (!raw) continue; // missing picks are reported via the count check below
      const team = normalizeTeam(raw);
      if (!team) {
        warnings.push(`${p.name}, ${label}: nieznana drużyna „${raw}”`);
        continue;
      }
      const picks = (p.knockout[roundId] ??= []);
      if (picks.includes(team)) {
        warnings.push(`${p.name}, ${label}: zdublowana drużyna „${team}” — pominięto duplikat`);
      } else {
        picks.push(team);
      }
    }
  }

  // Completeness report, so gaps are visible instead of silently scoring 0.
  for (const p of players) {
    const g = Object.keys(p.groups).length;
    if (g !== tournament.matches.length) {
      warnings.push(`${p.name}: tylko ${g}/${tournament.matches.length} typów grupowych`);
    }
    for (const r of tournament.rounds) {
      const n = (p.knockout[r.id] ?? []).length;
      if (n !== r.count) warnings.push(`${p.name}, ${r.label}: ${n}/${r.count} typów`);
    }
  }

  return {
    players: players.map(({ col, ...rest }) => rest),
    warnings,
  };
}
