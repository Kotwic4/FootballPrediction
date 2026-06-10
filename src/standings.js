import { tournament } from './data/tournament.js';

// Points awarded from a 1/X/2 prediction. Goals are unknown, so only points
// and head-to-head can be derived — goal difference is intentionally absent.
function applyPick(stat, m, pick) {
  const a = stat[m.team1];
  const b = stat[m.team2];
  a.played++;
  b.played++;
  if (pick === '1') { a.w++; a.pts += 3; b.l++; }
  else if (pick === '2') { b.w++; b.pts += 3; a.l++; }
  else { a.d++; b.d++; a.pts += 1; b.pts += 1; }
}

function headToHeadPoints(cluster, matches, picks) {
  const set = new Set(cluster);
  const hp = Object.fromEntries(cluster.map((t) => [t, 0]));
  for (const m of matches) {
    if (!set.has(m.team1) || !set.has(m.team2)) continue;
    const p = picks[m.nr];
    if (!p) continue;
    if (p === '1') hp[m.team1] += 3;
    else if (p === '2') hp[m.team2] += 3;
    else { hp[m.team1] += 1; hp[m.team2] += 1; }
  }
  return hp;
}

// Rank a group: by points, then — if the user reordered the group by hand —
// their preferred order (`pref`, a full permutation of the group's teams),
// otherwise head-to-head among tied teams. Anything still level afterwards is
// flagged `tied` (can't be resolved without goals); a manual order resolves
// every tie, so nothing is flagged then.
function rankGroup(teams, stat, matches, picks, pref) {
  const seedIndex = Object.fromEntries(teams.map((t, i) => [t, i]));
  const prefIndex = pref ? Object.fromEntries(pref.map((t, i) => [t, i])) : null;
  const order = [...teams].sort((a, b) => stat[b].pts - stat[a].pts || seedIndex[a] - seedIndex[b]);
  const result = [];
  let i = 0;
  while (i < order.length) {
    let j = i;
    while (j + 1 < order.length && stat[order[j + 1]].pts === stat[order[i]].pts) j++;
    const cluster = order.slice(i, j + 1);
    if (cluster.length === 1) {
      result.push({ ...stat[cluster[0]], tied: false });
    } else if (prefIndex) {
      cluster.sort((a, b) => prefIndex[a] - prefIndex[b]);
      for (const t of cluster) result.push({ ...stat[t], tied: false });
    } else {
      const hp = headToHeadPoints(cluster, matches, picks);
      cluster.sort((a, b) => hp[b] - hp[a] || seedIndex[a] - seedIndex[b]);
      for (let k = 0; k < cluster.length; k++) {
        const t = cluster[k];
        const tied =
          (k > 0 && hp[cluster[k - 1]] === hp[t]) ||
          (k < cluster.length - 1 && hp[cluster[k + 1]] === hp[t]);
        result.push({ ...stat[t], tied });
      }
    }
    i = j + 1;
  }
  result.forEach((r, idx) => { r.position = idx + 1; });
  return result;
}

export function computeGroupStandings(group, groupPicks, pref) {
  const teams = tournament.groups[group];
  const matches = tournament.matches.filter((m) => m.group === group);
  const stat = {};
  for (const t of teams) stat[t] = { team: t, played: 0, w: 0, d: 0, l: 0, pts: 0 };
  let complete = true;
  for (const m of matches) {
    const p = groupPicks[m.nr];
    if (!p) { complete = false; continue; }
    applyPick(stat, m, p);
  }
  return { ranked: rankGroup(teams, stat, matches, groupPicks, pref), complete };
}

// Keep only well-formed manual orders: a full permutation of the group's teams.
// Anything else (corrupt storage, hand-edited Excel) is silently dropped.
export function sanitizeTiebreaks(tiebreaks) {
  const out = {};
  if (!tiebreaks || typeof tiebreaks !== 'object') return out;
  for (const g of tournament.groupOrder) {
    const order = tiebreaks[g];
    if (!Array.isArray(order)) continue;
    const teams = tournament.groups[g];
    if (order.length === teams.length && teams.every((t) => order.includes(t))) {
      out[g] = order;
    }
  }
  return out;
}

// Cross-group ranking of the 12 third-placed teams; the best 8 advance.
function computeBestThirds(byGroup) {
  const thirds = [];
  for (const g of tournament.groupOrder) {
    const third = byGroup[g]?.ranked.find((x) => x.position === 3);
    if (third) thirds.push({ ...third, group: g });
  }
  thirds.sort((a, b) => b.pts - a.pts);
  thirds.forEach((t, idx) => {
    t.rank = idx + 1;
    t.advances = idx < 8;
  });
  for (const t of thirds) {
    t.tied = thirds.some((o) => o !== t && o.pts === t.pts);
  }
  const cutoffTied = thirds.length > 8 && thirds[7]?.pts === thirds[8]?.pts;
  return { thirds, cutoffTied };
}

// One pass over all group picks: per-group tables, best-thirds race, and the
// set of 32 teams the predictions imply will reach the round of 32.
// `tiebreaks` maps group → manual team order used to settle point ties.
export function buildStandings(groupPicks, tiebreaks = {}) {
  const byGroup = {};
  for (const g of tournament.groupOrder) byGroup[g] = computeGroupStandings(g, groupPicks, tiebreaks[g]);
  const { thirds, cutoffTied } = computeBestThirds(byGroup);

  const advancers = new Set();
  for (const g of tournament.groupOrder) {
    byGroup[g].ranked.filter((x) => x.position <= 2).forEach((x) => advancers.add(x.team));
  }
  thirds.filter((t) => t.advances).forEach((t) => advancers.add(t.team));

  return { byGroup, thirds, cutoffTied, advancers };
}
