# The clue bank

Crosscheck answers a clue from three sources. Two of them ship in this repo;
this document is about the third, which does not, and how to fill it in.

| Source | Knows | Ships here |
| --- | --- | --- |
| Clue bank | What published puzzles have used for this **exact** clue | No — you generate it |
| Crosswordese corpus | Convention for short recurring fill: "old coin" wants SOU | Yes, ~296 entries, hand-written |
| Datamuse | Semantic association across the whole language | No — live API |

## Why the bank exists

Datamuse answers "what words are near this phrase in meaning". That is the
wrong question for most crossword fill. IDOL is the answer to "false god" not
because an idol *resembles* a false god but because setters have used that
clue for that answer for decades. Association cannot recover convention, and
no amount of tuning fixes it — the knowledge simply isn't in the model.

The hand-written corpus encodes that convention for the fill that repeats
most. It cannot scale: the real space is hundreds of thousands of published
clue/answer pairs, which is a dataset, not something to write by hand.

## Getting a dataset

Any delimited file with a clue column and an answer column works. Two that
are known to be shaped right:

- **The XD corpus** — <https://xd.saul.pw>. Several million clue/answer pairs
  from decades of published puzzles, assembled for research. Download the
  clues archive and point the script at its `clues.tsv`.
- **A Kaggle NYT clue export** — several exist; they are CSVs with columns
  along the lines of `Date, Word, Clue`.

**Check the licence before publishing.** These clues come from published
puzzles, and the datasets are assembled for research and analysis. Shipping
a distilled copy inside a public web app is a different use from analysing
one locally, and it is worth being sure about before the file lands on a
public URL.

## Building it

```
npm run build:cluebank -- path/to/clues.tsv
```

Columns are sniffed from the header, so order does not matter and either tab
or comma delimiters work. Options, all optional:

| Flag | Default | What it does |
| --- | --- | --- |
| `--max-clues` | 30000 | How many clues to keep, most frequently published first |
| `--max-answers` | 6 | Answers kept per clue |
| `--min-len` / `--max-len` | 3 / 24 | Answer lengths to accept |

The script reports the resulting file size; tune `--max-clues` against it.
Everything a visitor downloads, they download once and keep, but it is still
worth keeping honest — 30,000 clues lands in the low hundreds of KB, and
gzips to roughly a third of that.

Output is `src/data/cluebank.json`. Nothing else changes: the app already
imports it, so `npm test && npm run build` is the whole of the rest.

## How it behaves once filled

The bank is loaded with a dynamic `import()`, so Vite splits it into its own
chunk. It is fetched on the first search rather than at startup, and the
service worker caches the chunk, so it works offline from then on.

Lookup is **exact** on the normalized clue — see `src/clue-norm.ts`, which
both the build script and the runtime import so their keys cannot drift.
"False god", "FALSE GOD" and "False god (4)" all reduce to `false god`.

Exactness is the point. A bank hit means a real puzzle used this clue for
this answer, which is stronger evidence than anything else the app has, so
hits carry `priority: 1` and sort above every Datamuse association
(`src/contract.ts`). Relaxing the match would spend exactly the credibility
that makes ranking them first correct.
