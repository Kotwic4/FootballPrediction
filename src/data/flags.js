// Maps a team's Polish display name to its flagcdn country code.
// flagcdn serves circular-friendly flag images (we clip them to a circle in the
// SVG). Codes are ISO 3166-1 alpha-2, except the British home nations which use
// flagcdn's special `gb-eng` / `gb-sct` subdivisions.
export const FLAG_CODE = {
  Meksyk: 'mx',
  'Republika Południowej Afryki': 'za',
  'Korea Południowa': 'kr',
  Czechy: 'cz',
  Kanada: 'ca',
  'Bośnia i Hercegowina': 'ba',
  Katar: 'qa',
  Szwajcaria: 'ch',
  Haiti: 'ht',
  Szkocja: 'gb-sct',
  Brazylia: 'br',
  Maroko: 'ma',
  'Stany Zjednoczone': 'us',
  Paragwaj: 'py',
  Australia: 'au',
  Turcja: 'tr',
  'Wybrzeże Kości Słoniowej': 'ci',
  Ekwador: 'ec',
  Niemcy: 'de',
  Curaçao: 'cw',
  Holandia: 'nl',
  Japonia: 'jp',
  Szwecja: 'se',
  Tunezja: 'tn',
  Iran: 'ir',
  'Nowa Zelandia': 'nz',
  Belgia: 'be',
  Egipt: 'eg',
  'Arabia Saudyjska': 'sa',
  Urugwaj: 'uy',
  Hiszpania: 'es',
  'Republika Zielonego Przylądka': 'cv',
  Francja: 'fr',
  Senegal: 'sn',
  Irak: 'iq',
  Norwegia: 'no',
  Argentyna: 'ar',
  Algieria: 'dz',
  Austria: 'at',
  Jordania: 'jo',
  Portugalia: 'pt',
  'DR Konga': 'cd',
  Uzbekistan: 'uz',
  Kolumbia: 'co',
  Ghana: 'gh',
  Panama: 'pa',
  Anglia: 'gb-eng',
  Chorwacja: 'hr',
};

// PNG URL at the requested pixel width (flagcdn rounds to its nearest size).
// We render into SVG <image> with a circular clip, so the width just sets
// source resolution — w160 is crisp for our ~60px flag circles on retina.
export function flagUrl(team, width = 160) {
  const code = FLAG_CODE[team];
  if (!code) return null;
  return `https://flagcdn.com/w${width}/${code}.png`;
}
