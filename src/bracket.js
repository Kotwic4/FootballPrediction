import { tournament } from './data/tournament.js';
import { THIRD_COMBINATIONS } from './data/thirdCombos.js';

// Official 2026 World Cup knockout bracket (FIFA match numbers 73–104).
// Source: 2026 FIFA World Cup knockout stage (Wikipedia / FIFA Annex C).

// The eight third-place slots in the round of 32. The group→slot assignment
// for each combination of advancing groups comes from THIRD_COMBINATIONS
// (FIFA's official table), whose values follow this T1..T8 order.
export const THIRD_SLOTS = [
  { id: 'T1', match: 74 },
  { id: 'T2', match: 77 },
  { id: 'T3', match: 79 },
  { id: 'T4', match: 80 },
  { id: 'T5', match: 81 },
  { id: 'T6', match: 82 },
  { id: 'T7', match: 85 },
  { id: 'T8', match: 87 },
];

// Round of 32: home/away are slot specs — '1A' = winner A, '2B' = runner-up B,
// { third: 'T1' } = a best-third team. Winner advances into the 'r16' set.
const R32 = [
  { nr: 73, home: '2A', away: '2B' },
  { nr: 74, home: '1E', away: { third: 'T1' } },
  { nr: 75, home: '1F', away: '2C' },
  { nr: 76, home: '1C', away: '2F' },
  { nr: 77, home: '1I', away: { third: 'T2' } },
  { nr: 78, home: '2E', away: '2I' },
  { nr: 79, home: '1A', away: { third: 'T3' } },
  { nr: 80, home: '1L', away: { third: 'T4' } },
  { nr: 81, home: '1D', away: { third: 'T5' } },
  { nr: 82, home: '1G', away: { third: 'T6' } },
  { nr: 83, home: '2K', away: '2L' },
  { nr: 84, home: '1H', away: '2J' },
  { nr: 85, home: '1B', away: { third: 'T7' } },
  { nr: 86, home: '1J', away: '2H' },
  { nr: 87, home: '1K', away: { third: 'T8' } },
  { nr: 88, home: '2D', away: '2G' },
];

// Later rounds reference winners (win) / losers (lose) of earlier matches.
// `target` is the knockout set the match WINNER joins.
const LATER = [
  { target: 'qf', matches: [
    { nr: 89, a: { win: 74 }, b: { win: 77 } },
    { nr: 90, a: { win: 73 }, b: { win: 75 } },
    { nr: 91, a: { win: 76 }, b: { win: 78 } },
    { nr: 92, a: { win: 79 }, b: { win: 80 } },
    { nr: 93, a: { win: 83 }, b: { win: 84 } },
    { nr: 94, a: { win: 81 }, b: { win: 82 } },
    { nr: 95, a: { win: 86 }, b: { win: 88 } },
    { nr: 96, a: { win: 85 }, b: { win: 87 } },
  ] },
  { target: 'sf', matches: [
    { nr: 97, a: { win: 89 }, b: { win: 90 } },
    { nr: 98, a: { win: 93 }, b: { win: 94 } },
    { nr: 99, a: { win: 91 }, b: { win: 92 } },
    { nr: 100, a: { win: 95 }, b: { win: 96 } },
  ] },
  { target: 'final', matches: [
    { nr: 101, a: { win: 97 }, b: { win: 98 } },
    { nr: 102, a: { win: 99 }, b: { win: 100 } },
  ] },
  { target: 'third', matches: [
    { nr: 103, a: { lose: 101 }, b: { lose: 102 } },
  ] },
  { target: 'champion', matches: [
    { nr: 104, a: { win: 101 }, b: { win: 102 } },
  ] },
];

// Columns shown in the UI. Match order within each column follows the bracket
// tree (depth-first), so every match sits vertically between the two matches
// that feed it — otherwise the columns wouldn't line up, because the 2026
// pairings are not sequential (e.g. R16 #89 is fed by R32 #74 and #77).
// The last column holds both the final and (below it) the 3rd-place match.
export const BRACKET_COLUMNS = [
  { roundId: 'r32', label: '1/16 finału', matches: [74, 77, 73, 75, 83, 84, 81, 82, 76, 78, 79, 80, 86, 88, 85, 87] },
  { roundId: 'r16', label: '1/8 finału', matches: [89, 90, 93, 94, 91, 92, 95, 96] },
  { roundId: 'qf', label: 'Ćwierćfinał', matches: [97, 98, 99, 100] },
  { roundId: 'sf', label: 'Półfinał', matches: [101, 102] },
  { roundId: 'final', label: 'Finał i 3. miejsce', matches: [104, 103] },
];

// Official date and host city of every knockout match (FIFA schedule).
export const MATCH_INFO = {
  73: { day: 'niedz., 28.06', city: 'Los Angeles' },
  74: { day: 'pon., 29.06', city: 'Boston' },
  75: { day: 'pon., 29.06', city: 'Monterrey' },
  76: { day: 'pon., 29.06', city: 'Houston' },
  77: { day: 'wt., 30.06', city: 'Nowy Jork' },
  78: { day: 'wt., 30.06', city: 'Dallas' },
  79: { day: 'wt., 30.06', city: 'Meksyk' },
  80: { day: 'śr., 1.07', city: 'Atlanta' },
  81: { day: 'śr., 1.07', city: 'San Francisco' },
  82: { day: 'śr., 1.07', city: 'Seattle' },
  83: { day: 'czw., 2.07', city: 'Toronto' },
  84: { day: 'czw., 2.07', city: 'Los Angeles' },
  85: { day: 'czw., 2.07', city: 'Vancouver' },
  86: { day: 'pt., 3.07', city: 'Miami' },
  87: { day: 'pt., 3.07', city: 'Kansas City' },
  88: { day: 'pt., 3.07', city: 'Dallas' },
  89: { day: 'sob., 4.07', city: 'Filadelfia' },
  90: { day: 'sob., 4.07', city: 'Houston' },
  91: { day: 'niedz., 5.07', city: 'Nowy Jork' },
  92: { day: 'niedz., 5.07', city: 'Meksyk' },
  93: { day: 'pon., 6.07', city: 'Dallas' },
  94: { day: 'pon., 6.07', city: 'Seattle' },
  95: { day: 'wt., 7.07', city: 'Atlanta' },
  96: { day: 'wt., 7.07', city: 'Vancouver' },
  97: { day: 'czw., 9.07', city: 'Boston' },
  98: { day: 'pt., 10.07', city: 'Los Angeles' },
  99: { day: 'sob., 11.07', city: 'Miami' },
  100: { day: 'sob., 11.07', city: 'Kansas City' },
  101: { day: 'wt., 14.07', city: 'Dallas' },
  102: { day: 'śr., 15.07', city: 'Atlanta' },
  103: { day: 'sob., 18.07', city: 'Miami' },
  104: { day: 'niedz., 19.07', city: 'Nowy Jork' },
};

// Third-placed team of each group (or null if standings incomplete).
export function thirdPlaceTeams(standings) {
  return tournament.groupOrder.map((g) => ({
    group: g,
    team: standings.byGroup[g].ranked[2]?.team ?? null,
  }));
}

// Assign the selected third-place groups to slots T1..T8 using FIFA's official
// combinations table. Returns { T1: 'A', ... } or null if not exactly 8 groups.
export function assignThirds(selectedGroups) {
  const key = [...selectedGroups].sort().join('');
  const assigned = THIRD_COMBINATIONS[key];
  if (!assigned) return null;
  const slotGroup = {};
  THIRD_SLOTS.forEach((slot, i) => {
    slotGroup[slot.id] = assigned[i];
  });
  return slotGroup;
}

function pickWinner(a, b, set) {
  if (!set) return null;
  if (a && set.includes(a)) return a;
  if (b && set.includes(b)) return b;
  return null;
}

// Human-readable placeholder for a slot that has no team yet, e.g. before the
// groups are decided: '1A' → "Zwycięzca grupy A", '2B' → "2. grupy B",
// { third: 'T1' } → "3. miejsce".
export function slotLabel(slot) {
  if (typeof slot === 'string') {
    const g = slot.slice(1);
    return slot[0] === '1' ? `Zwycięzca grupy ${g}` : `2. grupy ${g}`;
  }
  if (slot && slot.third) return '3. miejsce';
  return '';
}

// Placeholder for a later-round slot fed by an earlier match.
const refLabel = (r) =>
  r.win ? `Zwycięzca M${r.win}` : r.lose ? `Przegrany M${r.lose}` : '';

const TARGET_OF_R32 = 'r16';

// Knockout match number (73–104) → the round its WINNER joins. Used to map a
// scraped knockout result onto the right round set.
export const KO_MATCH_TARGET = (() => {
  const map = {};
  for (const m of R32) map[m.nr] = TARGET_OF_R32;
  for (const grp of LATER) for (const m of grp.matches) map[m.nr] = grp.target;
  return map;
})();

// Resolve every bracket match: participants (a/b), winner, and loser.
export function resolveBracket(knockout, standings) {
  // Only a finished group yields confirmed 1st/2nd; until then the slot stays
  // null so the bracket shows a placeholder ("Zwycięzca grupy A", …) instead of
  // the provisional seed-order team.
  const slotTeam = {};
  for (const g of tournament.groupOrder) {
    const gs = standings.byGroup[g];
    slotTeam['1' + g] = gs.complete ? gs.ranked[0]?.team ?? null : null;
    slotTeam['2' + g] = gs.complete ? gs.ranked[1]?.team ?? null : null;
  }

  const thirds = thirdPlaceTeams(standings);
  const selected = thirds.filter((t) => t.team && (knockout.r32 ?? []).includes(t.team));
  const assignment = selected.length === 8 ? assignThirds(selected.map((t) => t.group)) : null;
  const thirdTeam = {};
  if (assignment) {
    for (const slot of THIRD_SLOTS) {
      const g = assignment[slot.id];
      thirdTeam[slot.id] = standings.byGroup[g].ranked[2]?.team ?? null;
    }
  }

  const resolveSlot = (slot) => {
    if (typeof slot === 'string') return slotTeam[slot] ?? null;
    if (slot.third) return thirdTeam[slot.third] ?? null;
    return null;
  };

  const matches = {};
  for (const m of R32) {
    const a = resolveSlot(m.home);
    const b = resolveSlot(m.away);
    matches[m.nr] = {
      nr: m.nr,
      target: TARGET_OF_R32,
      a,
      b,
      aLabel: slotLabel(m.home),
      bLabel: slotLabel(m.away),
      winner: pickWinner(a, b, knockout.r16),
    };
  }

  const ref = (r) => {
    if (r.win) return matches[r.win]?.winner ?? null;
    if (r.lose) {
      const m = matches[r.lose];
      if (!m || !m.winner || !m.a || !m.b) return null;
      return m.winner === m.a ? m.b : m.a;
    }
    return null;
  };

  for (const grp of LATER) {
    for (const m of grp.matches) {
      const a = ref(m.a);
      const b = ref(m.b);
      matches[m.nr] = {
        nr: m.nr,
        target: grp.target,
        a,
        b,
        aLabel: refLabel(m.a),
        bLabel: refLabel(m.b),
        winner: pickWinner(a, b, knockout[grp.target]),
      };
    }
  }

  return { matches, selectedThirds: selected, assignment };
}

// The group winners + runners-up that have been confirmed so far. Only finished
// groups contribute, so the round of 32 fills in progressively as groups end.
export function fixedR32Teams(standings) {
  const teams = [];
  for (const g of tournament.groupOrder) {
    const gs = standings.byGroup[g];
    if (!gs.complete) continue;
    if (gs.ranked[0]?.team) teams.push(gs.ranked[0].team);
    if (gs.ranked[1]?.team) teams.push(gs.ranked[1].team);
  }
  return teams;
}
