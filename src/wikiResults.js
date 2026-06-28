import { tournament } from './data/tournament.js';
import { normalizeTeam } from './leaderboard.js';
import { KO_MATCH_TARGET } from './bracket.js';

// Group-stage match results scraped from Wikipedia. We try the Polish article
// first (team names already match ours) and fall back to the English article
// (different page/URL — useful when a proxy or CDN serves a stale Polish copy).
// Each fixture is matched to our `nr` by the unordered team pair; Wikipedia's
// own "Mecz N" numbering does NOT line up with ours.

const pairKey = (a, b) => [a, b].sort().join('|');
const byPair = new Map(tournament.matches.map((m) => [pairKey(m.team1, m.team2), m]));
const flip = (o) => (o === '1' ? '2' : o === '2' ? '1' : 'X');

// English Wikipedia team names → our Polish names.
const EN_TO_PL = {
  algeria: 'Algieria',
  argentina: 'Argentyna',
  australia: 'Australia',
  austria: 'Austria',
  belgium: 'Belgia',
  'bosnia and herzegovina': 'Bośnia i Hercegowina',
  brazil: 'Brazylia',
  canada: 'Kanada',
  'cape verde': 'Republika Zielonego Przylądka',
  colombia: 'Kolumbia',
  croatia: 'Chorwacja',
  curaçao: 'Curaçao',
  'czech republic': 'Czechy',
  'dr congo': 'DR Konga',
  ecuador: 'Ekwador',
  egypt: 'Egipt',
  england: 'Anglia',
  france: 'Francja',
  germany: 'Niemcy',
  ghana: 'Ghana',
  haiti: 'Haiti',
  iran: 'Iran',
  iraq: 'Irak',
  'ivory coast': 'Wybrzeże Kości Słoniowej',
  japan: 'Japonia',
  jordan: 'Jordania',
  mexico: 'Meksyk',
  morocco: 'Maroko',
  netherlands: 'Holandia',
  'new zealand': 'Nowa Zelandia',
  norway: 'Norwegia',
  panama: 'Panama',
  paraguay: 'Paragwaj',
  portugal: 'Portugalia',
  qatar: 'Katar',
  'saudi arabia': 'Arabia Saudyjska',
  scotland: 'Szkocja',
  senegal: 'Senegal',
  'south africa': 'Republika Południowej Afryki',
  'south korea': 'Korea Południowa',
  spain: 'Hiszpania',
  sweden: 'Szwecja',
  switzerland: 'Szwajcaria',
  tunisia: 'Tunezja',
  turkey: 'Turcja',
  'united states': 'Stany Zjednoczone',
  uruguay: 'Urugwaj',
  uzbekistan: 'Uzbekistan',
};

// smaxage/maxage=0 ask Wikipedia not to serve a stale shared-cache copy.
function apiUrl(host, page) {
  return (
    `https://${host}/w/api.php?action=parse&format=json&formatversion=2` +
    `&origin=*&prop=text&smaxage=0&maxage=0&page=${encodeURIComponent(page)}`
  );
}

async function fetchDoc(host, page) {
  const resp = await fetch(apiUrl(host, page));
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const data = await resp.json();
  const html = data?.parse?.text;
  if (!html) throw new Error('nieoczekiwana odpowiedź');
  return new DOMParser().parseFromString(html, 'text/html');
}

const firstLink = (el) => el?.querySelector('a')?.textContent.trim() || '';
const parseScore = (text) => text.replace(/\s+/g, ' ').match(/(\d+)\s*[–:-]\s*(\d+)/);

// Read played fixtures from the Polish "mecz-pilkarski" boxes. The score cell is
// the only one whose text starts with "<digits>:<digits>"; teams are adjacent.
function readPolish(doc) {
  const out = [];
  for (const box of doc.querySelectorAll('table.mecz-pilkarski')) {
    const tds = Array.from(box.querySelectorAll('td'));
    for (let i = 1; i < tds.length - 1; i++) {
      const m = tds[i].textContent.trim().match(/^(\d+)\s*:\s*(\d+)/);
      if (!m) continue;
      const home = firstLink(tds[i - 1]);
      const away = firstLink(tds[i + 1]);
      if (home && away) out.push({ home, away, hg: +m[1], ag: +m[2] });
      break;
    }
  }
  return out;
}

// Read knockout winners from the Polish "mecz-pilkarski" boxes (numbered
// "Mecz N", N 73–104). For each played box we map N → the round its winner
// joins (KO_MATCH_TARGET) and add the winner. A decisive score gives the
// winner directly; a draw is resolved by the penalty score if present.
function readKnockoutPolish(doc, resolve) {
  const knockout = {};
  for (const box of doc.querySelectorAll('table.mecz-pilkarski')) {
    const numM = box.textContent.match(/Mecz\s+(\d+)/);
    if (!numM) continue;
    const target = KO_MATCH_TARGET[Number(numM[1])];
    if (!target) continue; // group match
    const tds = Array.from(box.querySelectorAll('td'));
    for (let i = 1; i < tds.length - 1; i++) {
      const cell = tds[i].textContent.trim();
      const m = cell.match(/^(\d+)\s*:\s*(\d+)/);
      if (!m) continue;
      const home = firstLink(tds[i - 1]);
      const away = firstLink(tds[i + 1]);
      if (!home || !away) break;
      const hg = +m[1];
      const ag = +m[2];
      let winnerName = null;
      if (hg !== ag) {
        winnerName = hg > ag ? home : away;
      } else {
        // Draw → penalty shootout, e.g. "… karne 4:2".
        const pk = box.textContent.match(/(?:karne|rzuty)[^0-9]{0,14}(\d+)\s*[:–-]\s*(\d+)/i);
        if (pk) winnerName = +pk[1] > +pk[2] ? home : away;
      }
      const winner = winnerName && resolve(winnerName);
      if (winner) (knockout[target] ??= []).push(winner);
      break;
    }
  }
  return knockout;
}

// Read played fixtures from the English "footballbox" template.
function readEnglish(doc) {
  const out = [];
  for (const box of doc.querySelectorAll('.footballbox')) {
    const m = parseScore(box.querySelector('.fscore')?.textContent || '');
    if (!m) continue;
    const home = firstLink(box.querySelector('.fhome'));
    const away = firstLink(box.querySelector('.faway'));
    if (home && away) out.push({ home, away, hg: +m[1], ag: +m[2] });
  }
  return out;
}

// Read knockout winners from the English page, which doesn't number its boxes.
// Walk headings and football boxes in document order, tracking which knockout
// round the current section is, and add each box's winner to that round.
function readKnockoutEnglish(doc, resolve) {
  const targetFor = (text) => {
    const t = text.toLowerCase();
    if (t.includes('round of 32')) return 'r16';
    if (t.includes('round of 16')) return 'qf';
    if (t.includes('quarter')) return 'sf';
    if (t.includes('semi')) return 'final';
    if (t.includes('third place')) return 'third';
    if (t.includes('final')) return 'champion';
    return null; // group stage / other → don't assign
  };
  const knockout = {};
  let target = null;
  for (const el of doc.querySelectorAll('h2, h3, h4, .footballbox')) {
    if (el.matches('.footballbox')) {
      if (!target) continue;
      const m = parseScore(el.querySelector('.fscore')?.textContent || '');
      if (!m) continue;
      const home = firstLink(el.querySelector('.fhome'));
      const away = firstLink(el.querySelector('.faway'));
      if (!home || !away || +m[1] === +m[2]) continue; // draw → penalties (skip; PL covers)
      const win = resolve(+m[1] > +m[2] ? home : away);
      if (win) (knockout[target] ??= []).push(win);
    } else {
      target = targetFor(el.textContent);
    }
  }
  return knockout;
}

// Map raw {home, away, hg, ag} fixtures onto our nr → '1'|'X'|'2'.
function toResults(raw, resolve) {
  const groups = {};
  let unresolved = 0;
  for (const r of raw) {
    const home = resolve(r.home);
    const away = resolve(r.away);
    if (!home || !away) {
      unresolved++;
      continue;
    }
    const match = byPair.get(pairKey(home, away));
    if (!match) continue; // knockout box or non-group pairing
    const o = r.hg > r.ag ? '1' : r.ag > r.hg ? '2' : 'X';
    groups[match.nr] = home === match.team1 ? o : flip(o);
  }
  return { groups, count: Object.keys(groups).length, scored: raw.length, unresolved };
}

const resolveEn = (name) => normalizeTeam(EN_TO_PL[name.trim().toLowerCase()] ?? name);

// Read the official group order AND goal stats from the standings tables. Our
// 1/X/2 data can't compute goal difference, so Wikipedia is the only way to
// settle ties correctly — both the within-group order (tiebreaks) and the
// cross-group ranking of third-placed teams (which needs goal diff / goals for).
// A standings table is a wikitable whose team rows resolve to exactly one
// group's four teams; columns end with … GF, GA, GD, Pts.
function readStandings(doc, resolve) {
  const byGroup = tournament.groupOrder.map((g) => ({ g, set: new Set(tournament.groups[g]) }));
  const tiebreaks = {};
  const stats = {};
  for (const table of doc.querySelectorAll('table.wikitable')) {
    const rows = [];
    for (const tr of table.querySelectorAll('tr')) {
      let team = null;
      for (const a of tr.querySelectorAll('a')) {
        const t = resolve(a.textContent.trim());
        if (t) {
          team = t;
          break;
        }
      }
      if (!team || rows.some((r) => r.team === team)) continue;
      // Wikipedia writes negatives with U+2212 (minus) / U+2013 (en-dash); normalise to '-'.
      const nums = (tr.textContent.replace(/[−–]/g, '-').match(/-?\d+/g) || []).map(Number);
      rows.push({ team, nums });
    }
    if (rows.length !== 4) continue;
    const order = rows.map((r) => r.team);
    const hit = byGroup.find(({ set }) => order.every((t) => set.has(t)));
    if (!hit || tiebreaks[hit.g]) continue;
    tiebreaks[hit.g] = order;
    for (const { team, nums } of rows) {
      if (nums.length >= 4) stats[team] = { gd: nums[nums.length - 2], gf: nums[nums.length - 4] };
    }
  }
  return { tiebreaks, stats };
}

const SOURCES = [
  { name: 'pl-wiki', host: 'pl.wikipedia.org', page: 'Mistrzostwa Świata w Piłce Nożnej 2026', read: readPolish, readKo: readKnockoutPolish, resolve: normalizeTeam },
  { name: 'en-wiki', host: 'en.wikipedia.org', page: '2026 FIFA World Cup', read: readEnglish, readKo: readKnockoutEnglish, resolve: resolveEn },
];

async function runSource(src) {
  const doc = await fetchDoc(src.host, src.page);
  return {
    ...toResults(src.read(doc), src.resolve),
    ...readStandings(doc, src.resolve),
    knockout: src.readKo(doc, src.resolve),
  };
}

/**
 * Fetch current results from every source in parallel. Groups / standings come
 * from the first source that has group data; knockout winners are merged (union)
 * across all sources, so a result that reached one Wikipedia edition first is
 * still picked up even if the other lags.
 * Returns { groups, count, scored, unresolved, tiebreaks, stats, knockout, source }
 * (stats = { team: { gd, gf } }; knockout = { roundId: [winners] }).
 * Throws only when every source failed to load.
 */
export async function fetchWikiResults() {
  const settled = await Promise.allSettled(SOURCES.map((src) => runSource(src)));
  const ok = [];
  const errors = [];
  settled.forEach((s, i) => {
    if (s.status === 'fulfilled') ok.push({ name: SOURCES[i].name, r: s.value });
    else errors.push(`${SOURCES[i].name}: ${s.reason?.message ?? s.reason}`);
  });
  if (!ok.length) throw new Error(errors.join(' · ') || 'brak źródeł');

  const primary = ok.find((o) => o.r.count > 0) ?? ok[0];

  // Union the knockout winners from every source that loaded.
  const knockout = {};
  for (const { r } of ok) {
    for (const [round, teams] of Object.entries(r.knockout ?? {})) {
      const set = new Set(knockout[round]);
      teams.forEach((t) => set.add(t));
      knockout[round] = [...set];
    }
  }

  return { ...primary.r, knockout, source: primary.name };
}
