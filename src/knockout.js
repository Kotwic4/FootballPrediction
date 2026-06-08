import { tournament } from './data/tournament.js';

// Each knockout round draws its candidates from the previous one. Third place
// is contested by semifinalists who did NOT reach the final.
export const KO_PARENT = {
  r16: 'r32',
  qf: 'r16',
  sf: 'qf',
  final: 'sf',
  champion: 'final',
  third: 'sf',
};

// Teams that may be selected for a round, given current picks.
export function roundCandidates(roundId, knockout) {
  if (roundId === 'r32') return tournament.teams;
  let pool = knockout[KO_PARENT[roundId]] ?? [];
  if (roundId === 'third') {
    const finalists = new Set(knockout.final ?? []);
    pool = pool.filter((t) => !finalists.has(t));
  }
  return pool;
}

// Drop picks that are no longer valid (e.g. a team removed from 1/16 must also
// leave 1/8, QF, …). Iterates to convergence so removals cascade fully.
export function normalizeKnockout(knockout) {
  const teams = new Set(tournament.teams);
  const k = {};
  for (const r of tournament.rounds) k[r.id] = (knockout[r.id] ?? []).filter((t) => teams.has(t));

  let changed = true;
  while (changed) {
    changed = false;
    for (const r of tournament.rounds) {
      if (r.id === 'r32') continue;
      const allowed = new Set(roundCandidates(r.id, k));
      const filtered = k[r.id].filter((t) => allowed.has(t));
      if (filtered.length !== k[r.id].length) {
        k[r.id] = filtered;
        changed = true;
      }
    }
  }
  return k;
}
