// Regenerates src/data/players.js from the organizer's aggregate spreadsheet.
//
// The source .xlsx is intentionally NOT committed, so run this whenever a new
// aggregate file is received:
//
//   node scripts/gen-players.mjs "WORLD CUP 2026 ZBIORCZA.xlsx"
//
// Defaults to the file name below when no path is given.
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { parseAggregateXlsx } from '../src/leaderboardExcel.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const srcXlsx = process.argv[2] || path.join(root, 'WORLD CUP 2026 ZBIORCZA.xlsx');
const outFile = path.join(root, 'src', 'data', 'players.js');

const buf = fs.readFileSync(srcXlsx);
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
const { players, warnings } = parseAggregateXlsx(ab);

if (warnings.length) {
  console.warn(`⚠︎ ${warnings.length} ostrzeżeń przy parsowaniu:`);
  for (const w of warnings) console.warn('  -', w);
}

const out = `// AUTO-GENERATED from the organizer's aggregate spreadsheet.
// Do not edit by hand. Regenerate with: node scripts/gen-players.mjs
// (the source .xlsx is intentionally not committed).
//
// Each player: { name, groups: { [matchNr]: '1'|'X'|'2' }, knockout: { [roundId]: string[] } }
// Picks are already normalized (case, aliases, typos) by the parser.

export const players = ${JSON.stringify(players, null, 2)};
`;

fs.writeFileSync(outFile, out);
console.log(`✓ ${players.length} graczy → ${path.relative(root, outFile)}`);
