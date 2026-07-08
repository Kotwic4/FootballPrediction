import { tournament } from './data/tournament.js';
import { normalizeTeam } from './leaderboard.js';

// Results scraped from English Wikipedia (the Polish article proved unreliable
// and was dropped as a source). The main tournament article carries the group
// standings tables and every knockout match box, but the group MATCH boxes
// were split out into the twelve per-group articles ("2026 FIFA World Cup
// Group A" …), so group results are read from those. The knockout-stage
// article is fetched too and its winners unioned in, in case the main article
// is ever trimmed down the same way.
// Each fixture is matched to our `nr` by the unordered team pair; Wikipedia's
// own match numbering does NOT line up with ours.

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

const HOST = 'en.wikipedia.org';
const MAIN_PAGE = '2026 FIFA World Cup';
const KNOCKOUT_PAGE = '2026 FIFA World Cup knockout stage';
const GROUP_PAGES = tournament.groupOrder.map((g) => `2026 FIFA World Cup Group ${g}`);

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
  // When throttled, the API can answer 200 with a plain-text "You are making
  // too many requests" body instead of JSON — treat that like a 429.
  const data = await resp.json().catch(() => {
    throw new Error('HTTP 429 (limit zapytań)');
  });
  const html = data?.parse?.text;
  if (!html) throw new Error('nieoczekiwana odpowiedź');
  return new DOMParser().parseFromString(html, 'text/html');
}

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

// Wikipedia rate-limits bursts of uncached API calls (HTTP 429), so the pages
// go through a small worker pool instead of one big Promise.all, and a
// throttled request is retried with a growing pause. Returns docs aligned
// with `pages` (null where a page failed) plus the failure messages.
async function fetchDocs(pages) {
  const docs = new Array(pages.length).fill(null);
  const errors = [];
  const backoff = [2000, 5000];
  let next = 0;
  const worker = async () => {
    while (next < pages.length) {
      const i = next++;
      for (let attempt = 0; ; attempt++) {
        try {
          docs[i] = await fetchDoc(HOST, pages[i]);
          break;
        } catch (err) {
          if (attempt < backoff.length && /429/.test(String(err.message))) {
            await sleep(backoff[attempt]);
            continue;
          }
          errors.push(`${pages[i]}: ${err.message ?? err}`);
          break;
        }
      }
    }
  };
  await Promise.all(Array.from({ length: 3 }, worker));
  return { docs, errors };
}

// First anchor with actual text. The away/right-hand team cell puts the flag
// link (an <a> wrapping only an <img>, so empty text) before the team-name
// link, so we must skip empty anchors rather than blindly take the first one.
const firstLink = (el) => {
  for (const a of el?.querySelectorAll('a') ?? []) {
    const t = a.textContent.trim();
    if (t) return t;
  }
  return '';
};
const parseScore = (text) => text.replace(/\s+/g, ' ').match(/(\d+)\s*[–:-]\s*(\d+)/);

// Read played fixtures from the "footballbox" template boxes.
function readFixtures(doc) {
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

// Read knockout winners from an English page. The match box shows a penalty
// tie as a draw ("1–1 (a.e.t.)"), so most winners can't be read from the
// score. Instead we read the *participants* of each round's boxes: a team that
// appears in a Round-of-16 box won its Round-of-32 tie (penalties included), so
// it belongs in the 'r16' set; teams in the Quarter-final boxes are 'qf', and
// so on. The two terminal winners with no "next round" to advance into — the
// champion (winner of the final) and the third place — are read from the score
// when it is decisive, and from the penalty-shootout score otherwise (the box
// lists the shootout under a "Penalties" row; the takers carry no digits, so
// the first score after that word is the shootout result).
function readKnockout(doc, resolve) {
  // Section heading → the round set whose MEMBERS play their match here.
  const memberSet = (text) => {
    const t = text.toLowerCase();
    if (t.includes('round of 16')) return 'r16';
    if (t.includes('quarter')) return 'qf';
    if (t.includes('semi')) return 'sf';
    if (t.includes('third place')) return null; // terminal, see winnerSet
    if (t.includes('final')) return 'final'; // the two finalists
    return null; // round of 32 / group / other
  };
  // Section heading → terminal winner set read from the decisive score.
  const winnerSet = (text) => {
    const t = text.toLowerCase();
    if (t.includes('quarter') || t.includes('semi')) return null;
    if (t.includes('third place')) return 'third';
    if (t.includes('final')) return 'champion';
    return null;
  };
  // A real team, not a "Match 77" / "Winner Match 74" / "Loser Match 101" stub.
  const teamOf = (el) => {
    for (const a of el?.querySelectorAll('a') ?? []) {
      const t = a.textContent.trim();
      if (t && !/^(match|winner|loser)\b/i.test(t)) return t;
    }
    return '';
  };
  const knockout = {};
  const add = (set, team) => {
    if (set && team) (knockout[set] ??= []).push(team);
  };
  let member = null;
  let winner = null;
  for (const el of doc.querySelectorAll('h2, h3, h4, .footballbox')) {
    if (!el.matches('.footballbox')) {
      const m = memberSet(el.textContent);
      const w = winnerSet(el.textContent);
      // A round keyword (or a new top-level section) switches state; other
      // subheadings — the knockout-stage article titles every match
      // "Canada vs Morocco" — stay inside the current round.
      if (m || w || el.tagName === 'H2') {
        member = m;
        winner = w;
      }
      continue;
    }
    const home = teamOf(el.querySelector('.fhome'));
    const away = teamOf(el.querySelector('.faway'));
    add(member, resolve(home));
    add(member, resolve(away));
    if (winner && home && away) {
      const m = parseScore(el.querySelector('.fscore')?.textContent || '');
      let winnerName = null;
      if (m && +m[1] !== +m[2]) {
        winnerName = +m[1] > +m[2] ? home : away;
      } else if (m) {
        const pk = el.textContent.match(/Penalties[^0-9]*(\d+)\s*[–:-]\s*(\d+)/);
        if (pk && +pk[1] !== +pk[2]) winnerName = +pk[1] > +pk[2] ? home : away;
      }
      if (winnerName) add(winner, resolve(winnerName));
    }
  }
  for (const k of Object.keys(knockout)) knockout[k] = [...new Set(knockout[k])];
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

/**
 * Fetch current results from English Wikipedia: the main article (standings,
 * goal stats, knockout boxes), the knockout-stage article (knockout winners,
 * unioned with the main article's) and the twelve per-group articles (the 72
 * group-match boxes — the main article no longer carries them). All pages are
 * fetched through a rate-limited pool; whatever loaded is used, so a partial
 * failure still yields partial results.
 * Returns { groups, count, scored, unresolved, tiebreaks, stats, knockout,
 * source, failed } (stats = { team: { gd, gf } }; knockout = { roundId:
 * [winners] }; failed = number of pages that did not load, so the caller can
 * flag a partial download). Throws only when every page failed to load.
 */
export async function fetchWikiResults() {
  const pages = [MAIN_PAGE, KNOCKOUT_PAGE, ...GROUP_PAGES];
  const { docs, errors } = await fetchDocs(pages);
  if (docs.every((d) => !d)) throw new Error(`en-wiki: ${errors[0] ?? 'brak źródeł'}`);
  const [mainDoc, koDoc, ...groupDocs] = docs;

  // Group results: union of the played fixtures on the per-group articles.
  const raw = groupDocs.filter(Boolean).flatMap((doc) => readFixtures(doc));
  const results = toResults(raw, resolveEn);

  // Union the knockout winners from both knockout-bearing pages.
  const knockout = {};
  for (const doc of [mainDoc, koDoc].filter(Boolean)) {
    for (const [round, teams] of Object.entries(readKnockout(doc, resolveEn))) {
      const set = new Set(knockout[round]);
      teams.forEach((t) => set.add(t));
      knockout[round] = [...set];
    }
  }

  // Standings / goal stats: main article first, group articles fill any gaps
  // (each also carries its own standings table).
  const stats = {};
  const tiebreaks = {};
  for (const doc of [mainDoc, ...groupDocs].filter(Boolean)) {
    const r = readStandings(doc, resolveEn);
    for (const [team, s] of Object.entries(r.stats)) stats[team] ??= s;
    for (const [group, order] of Object.entries(r.tiebreaks)) tiebreaks[group] ??= order;
  }

  return { ...results, tiebreaks, stats, knockout, source: 'en-wiki', failed: errors.length };
}
