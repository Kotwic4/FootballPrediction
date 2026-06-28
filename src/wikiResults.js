import { tournament } from './data/tournament.js';
import { normalizeTeam } from './leaderboard.js';

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
  { name: 'pl-wiki', host: 'pl.wikipedia.org', page: 'Mistrzostwa Świata w Piłce Nożnej 2026', read: readPolish, resolve: normalizeTeam },
  { name: 'en-wiki', host: 'en.wikipedia.org', page: '2026 FIFA World Cup', read: readEnglish, resolve: resolveEn },
];

async function runSource(src) {
  const doc = await fetchDoc(src.host, src.page);
  return {
    ...toResults(src.read(doc), src.resolve),
    ...readStandings(doc, src.resolve),
  };
}

/**
 * Fetch current group-stage results, trying each source until one returns data.
 * Returns { groups, count, scored, unresolved, tiebreaks, stats, source }
 * (source = which site supplied the data, or null when none had results;
 * stats = { team: { gd, gf } } for the third-place ranking). Throws only when
 * every source failed to load.
 */
export async function fetchWikiResults() {
  const errors = [];
  let fallback = null;
  for (const src of SOURCES) {
    try {
      const r = await runSource(src);
      if (r.count > 0) return { ...r, source: src.name };
      fallback = fallback ?? { ...r, source: src.name };
    } catch (err) {
      errors.push(`${src.name}: ${err.message}`);
    }
  }
  if (fallback) return fallback;
  throw new Error(errors.join(' · ') || 'brak źródeł');
}
