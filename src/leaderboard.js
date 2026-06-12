import { tournament } from './data/tournament.js';

// Team-name aliases seen in the aggregate spreadsheet. Keys are lowercase.
// "RPA" is the family's everyday name, not a typo — keep it permanently.
const TEAM_ALIASES = {
  rpa: 'Republika Południowej Afryki',
};

const byLower = new Map(tournament.teams.map((t) => [t.toLowerCase(), t]));

// Levenshtein distance, used as a last-resort typo match ("Austia" → "Austria").
function editDistance(a, b) {
  const prev = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(
        prev[j] + 1,
        prev[j - 1] + 1,
        diag + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      diag = tmp;
    }
  }
  return prev[b.length];
}

/**
 * Map a raw spreadsheet value onto a canonical team name from tournament.js.
 * Handles case, stray whitespace, known aliases and 1–2 letter typos.
 * Returns null when the value cannot be resolved unambiguously.
 */
export function normalizeTeam(raw) {
  const cleaned = String(raw ?? '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return null;
  const lower = cleaned.toLowerCase();
  if (byLower.has(lower)) return byLower.get(lower);
  if (TEAM_ALIASES[lower]) return TEAM_ALIASES[lower];

  let best = null;
  let bestD = 3; // accept at most distance 2
  let tie = false;
  for (const t of tournament.teams) {
    const d = editDistance(lower, t.toLowerCase());
    if (d < bestD) {
      bestD = d;
      best = t;
      tie = false;
    } else if (d === bestD && t !== best) {
      tie = true;
    }
  }
  return tie ? null : best;
}

/**
 * Score one player's predictions against the actual results.
 * results = { groups: { [nr]: '1'|'X'|'2' }, knockout: { [roundId]: string[] } }
 * Knockout points accrue as soon as a team is confirmed in a round, so partial
 * results (e.g. half the groups decided) already count.
 */
export function scorePlayer(player, results) {
  const breakdown = {};
  let groupsCorrect = 0;
  let groupsPlayed = 0;
  for (const m of tournament.matches) {
    const res = results.groups?.[m.nr];
    if (!res) continue;
    groupsPlayed++;
    if (player.groups[m.nr] === res) groupsCorrect++;
  }
  breakdown.groups = groupsCorrect * tournament.groupMatchPoints;

  for (const r of tournament.rounds) {
    const actual = new Set(results.knockout?.[r.id] ?? []);
    const hits = (player.knockout[r.id] ?? []).filter((t) => actual.has(t)).length;
    breakdown[r.id] = hits * r.points;
  }

  const total = Object.values(breakdown).reduce((a, b) => a + b, 0);
  return { breakdown, total, groupsCorrect, groupsPlayed };
}
