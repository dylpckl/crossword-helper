/**
 * Distil a crossword clue dataset into the bundled clue bank.
 *
 *   node --experimental-strip-types scripts/build-cluebank.mjs <file> [options]
 *   npm run build:cluebank -- data/clues.tsv --max-clues 30000
 *
 * Input is any delimited file with a clue column and an answer column — the
 * XD corpus's clues.tsv, a Kaggle NYT clue export, anything shaped like that.
 * Headers are sniffed, so the column order does not matter. See
 * docs/CLUEBANK.md for where to get one.
 *
 * Output is src/data/cluebank.json: normalized clue → answers, most
 * frequently published first. Nothing else in the app changes when it is
 * regenerated; the file is loaded lazily and looked up by exact clue.
 *
 * It imports the runtime's own normalizer rather than reimplementing it,
 * because a build key that normalizes differently from a lookup key is a
 * corpus that silently never matches.
 */
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { normalizeClue } from '../src/clue-norm.ts';

const OUT = new URL('../src/data/cluebank.json', import.meta.url);

const argv = process.argv.slice(2);
const file = argv.find((a) => !a.startsWith('--'));
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : Number(argv[i + 1]);
};
/** Clues to keep, most frequently published first. Tune against the reported size. */
const MAX_CLUES = flag('max-clues', 30000);
/** Answers per clue. Beyond a handful they are historical curiosities, not candidates. */
const MAX_ANSWERS = flag('max-answers', 6);
/** Answers this short are usually dataset noise rather than fill. */
const MIN_LEN = flag('min-len', 3);
const MAX_LEN = flag('max-len', 24);

if (!file) {
  console.error('usage: build-cluebank.mjs <clues.tsv|clues.csv> [--max-clues N] [--max-answers N]');
  process.exit(1);
}

/**
 * RFC 4180-ish reader. Clues are full of commas and quoted speech, so the
 * naive split on the delimiter mangles a good fraction of any real dataset.
 */
function* rows(text, delim) {
  let field = '';
  let row = [];
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === delim) { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field); yield row; row = []; field = ''; }
    else if (ch !== '\r') field += ch;
  }
  if (field || row.length) { row.push(field); yield row; }
}

const text = readFileSync(file, 'utf8');
const firstLine = text.slice(0, text.indexOf('\n'));
const delim = (firstLine.match(/\t/g) ?? []).length >= (firstLine.match(/,/g) ?? []).length ? '\t' : ',';

const iter = rows(text, delim);
const header = iter.next().value?.map((h) => h.trim().toLowerCase()) ?? [];
const clueCol = header.findIndex((h) => /clue/.test(h));
const answerCol = header.findIndex((h) => /answer|solution|word|entry/.test(h));
if (clueCol === -1 || answerCol === -1) {
  console.error(`could not find clue and answer columns in header: ${JSON.stringify(header)}`);
  process.exit(1);
}
console.log(`reading ${file} (${delim === '\t' ? 'tab' : 'comma'}-delimited)`);
console.log(`  clue column   ${clueCol} "${header[clueCol]}"`);
console.log(`  answer column ${answerCol} "${header[answerCol]}"`);

/** normalized clue → answer → times published */
const counts = new Map();
let read = 0;
let kept = 0;
for (const row of iter) {
  read++;
  const clue = normalizeClue(row[clueCol] ?? '');
  const answer = (row[answerCol] ?? '').toUpperCase().replace(/[^A-Z]/g, '');
  if (!clue || answer.length < MIN_LEN || answer.length > MAX_LEN) continue;
  kept++;
  let byAnswer = counts.get(clue);
  if (!byAnswer) counts.set(clue, (byAnswer = new Map()));
  byAnswer.set(answer, (byAnswer.get(answer) ?? 0) + 1);
}

// Rank clues by how often they have been published. A clue asked a hundred
// times is one a setter is likely to ask again; a hapax is dead weight in a
// file every visitor downloads.
const ranked = [...counts.entries()]
  .map(([clue, byAnswer]) => {
    let total = 0;
    for (const n of byAnswer.values()) total += n;
    return { clue, byAnswer, total };
  })
  .sort((a, b) => b.total - a.total || a.clue.length - b.clue.length);

const bank = {};
for (const { clue, byAnswer } of ranked.slice(0, MAX_CLUES)) {
  bank[clue] = [...byAnswer.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, MAX_ANSWERS)
    .map(([answer]) => answer);
}

writeFileSync(OUT, JSON.stringify(bank));
const kb = (statSync(OUT).size / 1024).toFixed(0);
console.log(`\n${read.toLocaleString()} rows read, ${kept.toLocaleString()} usable`);
console.log(`${counts.size.toLocaleString()} distinct clues, kept the top ${Object.keys(bank).length.toLocaleString()}`);
console.log(`wrote src/data/cluebank.json (${kb} KB, gzips to roughly a third)`);
console.log('\nrun `npm test && npm run build` next; the app picks it up with no code change.');
