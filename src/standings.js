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

// Rank a group: by points, then head-to-head among tied teams. Anything still
// level afterwards is flagged `tied` (can't be resolved without goals).
function rankGroup(teams, stat, matches, picks) {
  const seedIndex = Object.fromEntries(teams.map((t, i) => [t, i]));
  const order = [...teams].sort((a, b) => stat[b].pts - stat[a].pts || seedIndex[a] - seedIndex[b]);
  const result = [];
  let i = 0;
  while (i < order.length) {
    let j = i;
    while (j + 1 < order.length && stat[order[j + 1]].pts === stat[order[i]].pts) j++;
    const cluster = order.slice(i, j + 1);
    if (cluster.length === 1) {
      result.push({ ...stat[cluster[0]], tied: false });
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

export function computeGroupStandings(group, groupPicks) {
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
  return { ranked: rankGroup(teams, stat, matches, groupPicks), complete };
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
export function buildStandings(groupPicks) {
  const byGroup = {};
  for (const g of tournament.groupOrder) byGroup[g] = computeGroupStandings(g, groupPicks);
  const { thirds, cutoffTied } = computeBestThirds(byGroup);

  const advancers = new Set();
  for (const g of tournament.groupOrder) {
    byGroup[g].ranked.filter((x) => x.position <= 2).forEach((x) => advancers.add(x.team));
  }
  thirds.filter((t) => t.advances).forEach((t) => advancers.add(t.team));

  return { byGroup, thirds, cutoffTied, advancers };
}
