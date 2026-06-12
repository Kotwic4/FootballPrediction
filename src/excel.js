import * as XLSX from 'xlsx';
import { tournament } from './data/tournament.js';

// Excel column-D round labels (must match the original template so files stay
// interchangeable with the family spreadsheet).
const ROUND_LABEL = {
  r32: '1/16',
  r16: '1/8',
  qf: 'ĆWIERĆFINAŁ',
  sf: 'PÓŁFINAŁ',
  third: 'TRZECIE MIEJSCE',
  final: 'FINAŁ',
  champion: 'MISTRZ',
};

export const LABEL_TO_ROUND = Object.fromEntries(
  Object.entries(ROUND_LABEL).map(([id, label]) => [label, id]),
);

// 1/16 slot labels from the template (group winners/runners-up + best thirds).
const R32_SLOTS = [];
for (const g of tournament.groupOrder) {
  R32_SLOTS.push(`${g}1`, `${g}2`);
}
while (R32_SLOTS.length < 32) R32_SLOTS.push('TRZECIE MIEJSCE W GRUPIE');

const HEADER = ['Nr meczu', 'Data', 'Godz', 'Drużyna 1', 'TWÓJ TYP\n1 lub X lub 2', 'Drużyna 2', 'Grupa'];

const POINTS_TABLE = [
  ['Punktacja', 'pkt', 'suma możliwa'],
  ['Mecz grupowy', 1, 72],
  ['1/16', 1, 32],
  ['1/8', 2, 32],
  ['Ćwierćfinał', 3, 24],
  ['Półfinał', 4, 16],
  ['Finał', 5, 10],
  ['Trzecie miejsce', 5, 5],
  ['Mistrz', 10, 10],
  ['', '', 201],
];

/**
 * Build an .xlsx Blob from the current predictions, replicating the template.
 * predictions = { groups: { [matchNr]: '1'|'X'|'2' }, knockout: { [roundId]: string[] } }
 */
export function exportToXlsx(predictions) {
  const rows = [];
  rows.push(HEADER);

  // Group matches (rows 2..73)
  for (const m of tournament.matches) {
    rows.push([
      m.nr,
      m.date,
      m.time,
      m.team1,
      predictions.groups?.[m.nr] ?? '',
      m.team2,
      m.group,
    ]);
  }

  // Knockout header row (matches template: E column = "NAZWA DRUŻYNY")
  rows.push(['', '', '', '', 'NAZWA DRUŻYNY', '', '']);

  // Knockout rounds: column D = round label, column F = slot (only for 1/16),
  // column E = predicted team name.
  for (const round of tournament.rounds) {
    const picks = predictions.knockout?.[round.id] ?? [];
    for (let i = 0; i < round.count; i++) {
      const slot = round.id === 'r32' ? R32_SLOTS[i] : '';
      rows.push(['', '', '', ROUND_LABEL[round.id], picks[i] ?? '', slot, '']);
    }
  }

  // Spacer + points legend
  rows.push([]);
  for (const r of POINTS_TABLE) {
    rows.push(['', '', '', r[0], r[1], r[2]]);
  }

  // Manual group orders (tie-break choices). Placed after the legend so older
  // app versions and the family template simply ignore these rows.
  const tiebreaks = predictions.tiebreaks ?? {};
  const tbGroups = tournament.groupOrder.filter((g) => tiebreaks[g]);
  if (tbGroups.length) {
    rows.push([]);
    for (const g of tbGroups) {
      rows.push(['', '', '', `${TIEBREAK_LABEL} ${g}`, tiebreaks[g].join('; ')]);
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 9 }, { wch: 12 }, { wch: 7 }, { wch: 26 },
    { wch: 22 }, { wch: 26 }, { wch: 8 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Arkusz1');
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

export function downloadXlsx(predictions, filename = 'typy-ms-2026.xlsx') {
  const blob = exportToXlsx(predictions);

  // msSaveBlob path for older mobile browsers that support it.
  if (typeof navigator !== 'undefined' && navigator.msSaveOrOpenBlob) {
    navigator.msSaveOrOpenBlob(blob, filename);
    return;
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  // IMPORTANT: some mobile browsers (notably Samsung Internet and some Android
  // Chrome builds) fetch the blob asynchronously after click(). Removing the
  // anchor or revoking the object URL right away cancels the download, so we
  // defer cleanup. iOS Safari works either way, hence the cross-device gap.
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 10000);
}

const VALID_GROUP_PICK = { '1': '1', 'X': 'X', '2': '2' };
const validTeams = new Set(tournament.teams);
const TIEBREAK_LABEL = 'KOLEJNOŚĆ GRUPA';

/**
 * Parse a (possibly partly filled) .xlsx ArrayBuffer back into predictions.
 * Robust to row shifts: group picks are matched by match number, knockout
 * picks by the round label in column D until the points legend ("Punktacja").
 */
export async function importFromXlsx(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });

  const groups = {};
  const knockout = {};
  const tiebreaks = {};
  const warnings = [];
  const matchNrs = new Set(tournament.matches.map((m) => m.nr));

  let inLegend = false;
  for (const row of rows) {
    const colA = row[0];
    const colD = (row[3] ?? '').toString().trim();
    const colE = row[4];

    // Manual group order rows live after the points legend.
    if (colD.startsWith(TIEBREAK_LABEL)) {
      const g = colD.slice(TIEBREAK_LABEL.length).trim();
      const order = (colE ?? '').toString().split(';').map((t) => t.trim()).filter(Boolean);
      if (tournament.groups[g] && order.every((t) => validTeams.has(t))) tiebreaks[g] = order;
      else warnings.push(`${colD}: nieprawidłowa kolejność drużyn`);
      continue;
    }

    if (colD === 'Punktacja') inLegend = true;
    if (inLegend) continue;

    // Group match pick: column A is a known match number, column E is the type.
    const nr = typeof colA === 'number' ? colA : parseInt(colA, 10);
    if (matchNrs.has(nr) && colE !== '' && colE != null) {
      const pick = colE.toString().trim().toUpperCase();
      if (VALID_GROUP_PICK[pick]) groups[nr] = VALID_GROUP_PICK[pick];
      else warnings.push(`Mecz ${nr}: nieznany typ "${colE}" (oczekiwano 1/X/2)`);
      continue;
    }

    // Knockout pick: column D is a round label, column E is a team name.
    const roundId = LABEL_TO_ROUND[colD];
    if (roundId && colE !== '' && colE != null) {
      const team = colE.toString().trim();
      if (!team) continue;
      if (!knockout[roundId]) knockout[roundId] = [];
      if (validTeams.has(team)) knockout[roundId].push(team);
      else warnings.push(`${colD}: nieznana drużyna "${team}"`);
    }
  }

  return { predictions: { groups, knockout, tiebreaks }, warnings };
}
