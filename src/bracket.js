import { tournament } from './data/tournament.js';

// Official 2026 World Cup knockout bracket (FIFA match numbers 73–104).
// Source: 2026 FIFA World Cup knockout stage (Wikipedia / FIFA Annex C).

// Each of the eight third-place slots may only be filled by a third-placed team
// from one of the listed groups (FIFA's rule: thirds face winners, no same-group
// rematches). The exact group→slot assignment is resolved by bipartite matching.
export const THIRD_SLOTS = [
  { id: 'T1', match: 74, allowed: ['A', 'B', 'C', 'D', 'F'] },
  { id: 'T2', match: 77, allowed: ['C', 'D', 'F', 'G', 'H'] },
  { id: 'T3', match: 79, allowed: ['C', 'E', 'F', 'H', 'I'] },
  { id: 'T4', match: 80, allowed: ['E', 'H', 'I', 'J', 'K'] },
  { id: 'T5', match: 81, allowed: ['B', 'E', 'F', 'I', 'J'] },
  { id: 'T6', match: 82, allowed: ['A', 'E', 'H', 'I', 'J'] },
  { id: 'T7', match: 85, allowed: ['E', 'F', 'G', 'I', 'J'] },
  { id: 'T8', match: 87, allowed: ['D', 'E', 'I', 'J', 'L'] },
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
export const BRACKET_COLUMNS = [
  { roundId: 'r32', label: '1/16 finału', matches: [74, 77, 73, 75, 83, 84, 81, 82, 76, 78, 79, 80, 86, 88, 85, 87] },
  { roundId: 'r16', label: '1/8 finału', matches: [89, 90, 93, 94, 91, 92, 95, 96] },
  { roundId: 'qf', label: 'Ćwierćfinał', matches: [97, 98, 99, 100] },
  { roundId: 'sf', label: 'Półfinał', matches: [101, 102] },
  { roundId: 'final', label: 'Finał', matches: [104] },
  { roundId: 'third', label: 'Mecz o 3. miejsce', matches: [103] },
];

// Third-placed team of each group (or null if standings incomplete).
export function thirdPlaceTeams(standings) {
  return tournament.groupOrder.map((g) => ({
    group: g,
    team: standings.byGroup[g].ranked[2]?.team ?? null,
  }));
}

// Assign the selected third-place groups to slots T1..T8 via bipartite matching
// (Kuhn's algorithm). Returns { T1: 'A', ... } or null if no full assignment.
export function assignThirds(selectedGroups) {
  const sel = new Set(selectedGroups);
  const slotGroup = {};
  const groupSlot = {};

  function augment(slot, visited) {
    for (const g of slot.allowed) {
      if (!sel.has(g) || visited.has(g)) continue;
      visited.add(g);
      if (groupSlot[g] === undefined || augment(THIRD_SLOTS[groupSlot[g]], visited)) {
        slotGroup[slot.id] = g;
        groupSlot[g] = THIRD_SLOTS.indexOf(slot);
        return true;
      }
    }
    return false;
  }

  for (const slot of THIRD_SLOTS) augment(slot, new Set());
  return Object.keys(slotGroup).length === selectedGroups.length ? slotGroup : null;
}

function pickWinner(a, b, set) {
  if (!set) return null;
  if (a && set.includes(a)) return a;
  if (b && set.includes(b)) return b;
  return null;
}

const TARGET_OF_R32 = 'r16';

// Resolve every bracket match: participants (a/b), winner, and loser.
export function resolveBracket(knockout, standings) {
  const slotTeam = {};
  for (const g of tournament.groupOrder) {
    const r = standings.byGroup[g].ranked;
    slotTeam['1' + g] = r[0]?.team ?? null;
    slotTeam['2' + g] = r[1]?.team ?? null;
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
    matches[m.nr] = { nr: m.nr, target: TARGET_OF_R32, a, b, winner: pickWinner(a, b, knockout.r16) };
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
      matches[m.nr] = { nr: m.nr, target: grp.target, a, b, winner: pickWinner(a, b, knockout[grp.target]) };
    }
  }

  return { matches, selectedThirds: selected, assignment };
}

// The 24 teams that always qualify (group winners + runners-up).
export function fixedR32Teams(standings) {
  const teams = [];
  for (const g of tournament.groupOrder) {
    const r = standings.byGroup[g].ranked;
    if (r[0]?.team) teams.push(r[0].team);
    if (r[1]?.team) teams.push(r[1].team);
  }
  return teams;
}
