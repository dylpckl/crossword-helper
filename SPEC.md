# Clue Solver — spec

One input. Type a word or phrase, get (a) candidate crossword answers as
letter tiles and (b) what the phrase means. Mobile-first, installable PWA,
no backend required for v1.

Companion files:

- `src/contract.ts` — the data model contract. Read that first.
- `docs/HANDOFF.md` — the original prototype handoff this spec builds on.

---

## 1. Decisions

| Question | Decision | Why |
|---|---|---|
| Backend? | **None for v1.** All calls go browser → public API. | Every API below sends `Access-Control-Allow-Origin: *`. Zero hosting cost, zero secrets, works as a static site on GitHub Pages / Netlify / Cloudflare Pages. |
| Answer engine | **Datamuse** (`ml=` means-like + `sp=` spelled-like) | Free, no key, 100k req/day, pattern-aware server-side, returns definitions and part-of-speech in the same call. |
| Definition | **Free Dictionary API** first, **Wiktionary REST** fallback | dictionaryapi.dev is richest for single words (phonetics, audio, examples). Wiktionary handles phrases and rarer words. |
| "Web search" | **Wikipedia REST summary** + outbound search links | There is no free, CORS-enabled web search JSON API. Wikipedia's summary endpoint covers proper nouns and phrases well. Real search is a tap-out link (Google / DuckDuckGo / Wordplays). |
| Claude API | **Phase 2, optional.** Proxy at `POST /api/solve`. | Adds reasoning for cryptic clues. Needs a server-held key, so it's an add-on, not the base. Contract already defined (`ProxySolveResponse`). |
| Framework | **None.** Vite + vanilla TypeScript. | App is one screen. Vite gives TS, hashed assets, and `vite-plugin-pwa` for a correct service worker. No React/Preact. |
| Persistence | `localStorage` for history and result cache | Small, synchronous, good enough. Swap to IndexedDB only if cache size becomes a problem. |

> **Unverified from this sandbox:** the CORS claims above are from each API's
> documentation and prior use, not a live check (the dev container's egress
> policy blocks all of these hosts). First task after scaffolding is a
> 5-line smoke test page that fetches each endpoint from a deployed origin.

---

## 2. Data model contract

Defined in full in `src/contract.ts`. Summary of the flow:

```
user input ──parse──▶ SolveRequest {query, pattern?, length?}
                          │
                          ├──▶ DatamuseAnswers   ──▶ Answer[]
                          ├──▶ DictionaryApi  ─┐  (in parallel; Free Dictionary
                          ├──▶ Wiktionary     ─┴─▶ Definition | null   preferred)
                          ├──▶ WikipediaSummary  ──▶ Reference | null
                          └──▶ buildLinks()      ──▶ SearchLink[]   (no network)
                                    │
                    Promise.allSettled + merge/sort/dedupe
                                    ▼
                           SolveResult ──▶ UI + cache
```

Key invariants:

- `Answer.answer` is grid form (`RIPCURRENT`), `Answer.display` is human form
  (`rip current`). Pattern matching and dedupe use grid form only.
- The constraint field is always visible and has two modes. Plain letters
  ("SC") are a **soft** constraint: nothing is filtered, answers are ranked by
  how many of those letters they contain and matching tiles light up. Any
  `?` (or `_ . - *`) switches to a **positional** pattern ("SC?D?") that
  filters strictly and dims non-matches. Digits alone are a length. Letters
  are applied client-side only and never change what is fetched or cached;
  patterns and lengths go to Datamuse as `sp=`.
- Partial failure is a normal state. Missing definition ≠ error. Provider
  errors are collected into `SolveResult.errors` and shown as a quiet inline
  notice, never a modal.
- `SolveResult` is the only thing the renderer accepts. It is also exactly
  what gets cached, so cache hits and network hits render through one path.

---

## 3. APIs and how they map to the contract

### 3.1 Datamuse → `Answer[]`

```
GET https://api.datamuse.com/words?ml={query}&md=dpf&max=60
GET https://api.datamuse.com/words?ml={query}&sp={pattern}&md=dpf&max=30   (only when pattern/length given)
```

- `ml` = "means like". This is the crossword-clue engine.
- `sp` = "spelled like". `?` = one unknown letter, `*` = any run. A bare length
  becomes `?????`. Datamuse applies this server-side, so constrained queries
  come back pre-filtered.
- `md=dpf` = metadata: **d**efinitions, **p**arts of speech, **f**requency.
- Response: `[{ word, score, tags?: ["n","v","f:1.23"], defs?: ["n\tdefinition"] }]`

Mapping:

| Datamuse | Answer |
|---|---|
| `word` | `display`; `answer = word.toUpperCase().replace(/[^A-Z]/g,'')` |
| `score / maxScore` | `score` (relative to the top answer; raw integer kept in `rawScore`) |
| `defs[0]` after the tab | `gloss` |
| `tags` minus `f:*` and `syn` | `partOfSpeech` |

Both calls run in parallel. Results are merged, deduped by `answer`, and
`fitsPattern` is recomputed client-side against the letters-only pattern.
The unconstrained call matters because Datamuse's `sp` can't see through
spaces: "rip current" (10 letters) won't match `sp=??????????` server-side
but does match after stripping. Cap output at 24.

Also useful later: `rel_syn=` (synonyms) and `rel_trg=` (triggers) as extra
answer sources for short clues, merged with a lower weight.

Limits: 100,000 requests/day without a key, no auth, CORS `*`.

### 3.2 Free Dictionary API → `Definition | null`

```
GET https://api.dictionaryapi.dev/api/v2/entries/en/{query}
```

- 200: `[{ word, phonetic?, phonetics: [{text?, audio?}], meanings: [{partOfSpeech, definitions: [{definition, example?, synonyms[]}]}], sourceUrls[] }]`
- 404: `{ title: "No Definitions Found", ... }` → return `null`, not an error.

Mapping: take entry `[0]`; `phonetic` from `phonetic` or first `phonetics[].text`;
`audioUrl` from first non-empty `phonetics[].audio`; flatten `meanings[]` ×
`definitions[]` into `Sense[]`, cap 6; `sourceUrl = sourceUrls[0]`.

Caveats: community-run, occasionally slow or 5xx. Mostly single words. Runs in
parallel with Wiktionary rather than ahead of it, so a stall costs nothing.

### 3.3 Wiktionary REST → `Definition | null` (fallback)

```
GET https://en.wiktionary.org/api/rest_v1/page/definition/{query}
```

- 200: `{ en: [{ partOfSpeech, definitions: [{ definition (HTML), examples?: [HTML] }] }] }`
- 404 → `null`.

Entries are case-sensitive: `Big_Apple` exists where `big_apple` 404s, so a
404 is retried title-cased before giving up. Strip HTML to text before it
reaches the contract. Better than dictionaryapi
for phrases ("rip current", "in the black") and slang. Send header
`Api-User-Agent: clue-solver/1.0 (contact url)` — Wikimedia asks for it.

### 3.4 Wikipedia REST summary → `Reference | null`

```
GET https://en.wikipedia.org/api/rest_v1/page/summary/{Title_Case_Query}?redirect=true
```

- 200: `{ type: "standard"|"disambiguation"|..., title, extract, thumbnail?: {source}, content_urls: {desktop: {page}} }`
- 404 → `null`.

Mapping is direct. `kind` = `type === 'disambiguation' ? 'disambiguation' : 'standard'`.
Truncate `extract` to ~400 chars at a sentence boundary.

Redirects can land far from the query: "Hasten" redirects to the Saudi national
anthem, whose English title opens with that word. The page is kept only when the
query appears in its title or its lead sentence, where aliases live ("New York,
often called ... or simply NYC, is ..."). A missing card beats a confidently
wrong one, and the Wikipedia search link stays in the links row regardless.

Optional second call when summary 404s, to offer suggestions:
`https://en.wikipedia.org/w/api.php?action=opensearch&search={query}&limit=5&format=json&origin=*`
(`origin=*` is what enables CORS on the action API).

### 3.5 Search links → `SearchLink[]` (local, no network)

Always built. In order:

| Label | URL |
|---|---|
| Wordplays | `https://www.wordplays.com/crossword-solver/{query}` |
| Google | `https://www.google.com/search?q={query}+crossword+clue` |
| DuckDuckGo | `https://duckduckgo.com/?q={query}` |
| Wikipedia | `https://en.wikipedia.org/w/index.php?search={query}` |

Open with `target=_blank rel=noopener`. On mobile these are the real "web
search" affordance; the Wikipedia card is the inline preview.

### 3.6 Rejected / not viable client-side

- **DuckDuckGo Instant Answer API** — no CORS headers on `api.duckduckgo.com`.
- **Google Custom Search / Bing / Brave Search** — need keys, would leak client-side.
- **Crossword-specific clue databases** (XWord Info, Crossword Tracker, xd corpus) —
  no public CORS APIs; the xd clue corpus is a possible phase-3 server-side index.
- **Merriam-Webster / Oxford** — keys required.

### 3.7 Phase 2: Claude proxy (optional)

Single serverless function (Cloudflare Worker or Vercel edge function):

```
POST /api/solve
body:     SolveRequest              (see contract)
response: ProxySolveResponse        { answers: [{display, gloss, score}], meta? }
```

Server holds `ANTHROPIC_API_KEY`, uses the official TypeScript SDK, model
`claude-opus-5` with `output_config.effort: "low"` and structured output
(`output_config.format`) so the response is schema-valid JSON without parsing
prose. The prompt lives server-side. Client merges the answers with
`source: 'claude'` and shows them in a separate "Reasoned" group under the
Datamuse tiles. Behind a settings toggle, off by default, so the app stays
free-to-run for anyone who deploys it as static.

Rate-limit the function per IP (Cloudflare has this built in) and cap
`max_tokens` at ~1000 since the response is a small JSON list.

---

## 4. Libraries

| Need | Choice | Notes |
|---|---|---|
| Build / dev server | `vite` | Zero config, TS out of the box. |
| PWA | `vite-plugin-pwa` (wraps Workbox) | Generates `manifest.webmanifest`, precache for app shell, runtime caching rules, and the "update available" prompt. |
| HTTP | native `fetch` + `AbortController` | No axios. 8s timeout per provider. |
| Storage | `localStorage` behind a 20-line `store.ts` | History (last 50) + result cache (LRU 200, 7-day TTL). |
| HTML sanitizing | `DOMParser` → `textContent` | Only Wiktionary returns HTML; we only need text out of it. |
| Tests | `vitest` | Unit tests for the pattern parser and each adapter's mapper against fixture JSON. |
| Fonts | system stack + optional Georgia for the display serif | No web font loads; keep first paint instant on 3G. |

Nothing else. Total shipped JS target: under 15 KB gzipped excluding the
service worker.

---

## 5. UI spec (mobile)

Single screen, portrait-first, everything reachable with one thumb.

```
┌──────────────────────────────┐
│  Clue Solver                 │  ← app name, small
│ ┌──────────────────────────┐ │
│ │ ocean current            │ │  ← one input, autofocus, enterkeyhint=search
│ └──────────────────────────┘ │
│ ┌────────┐                   │
│ │ ?I??   │  pattern (optional, collapsed behind a "pattern" chip)
│ └────────┘                   │
│                              │
│  ANSWERS                     │
│  T I D E                     │  ← letter tiles; score orders, isn't shown
│  a periodic rise and fall…   │  ← gloss, one line
│  E D D Y                     │
│  R I P C U R R E N T         │  (dimmed if !fitsPattern)
│                              │
│  MEANING                     │
│  ocean current  /ˈoʊʃən/  ▶  │  ← audio on tap
│  n. a continuous, directed…  │
│  ⌄ 2 more senses             │
│                              │
│  ABOUT                       │
│  [thumb] Ocean current       │  ← Wikipedia card, taps out
│  An ocean current is a…      │
│                              │
│  Wordplays · Google · DDG    │  ← link row
│                              │
│  RECENT                      │
│  tide · ?I??   sc_d_ · …     │  ← history chips
└──────────────────────────────┘
```

Layout intent (one input, two jobs):

- A short input (one or two words) that gets a dictionary entry reads as a
  **word**: Meaning leads as a highlighted card, then About, then Answers
  collapsed to three rows with "Show N more".
- Anything else reads as a **clue**: Answers lead in full, then Meaning, About.
- The section header carries "Show as clue" / "Show as word" to flip the guess
  for the current result. Nothing is ever hidden, only reordered.
- Settings offers **Result order: Auto or Manual**. Manual replaces the guess
  and the header link with a Clue / Word control under the search box, and the
  choice is remembered between searches.

Behavior:

- Submit on Enter and on input blur if text changed. Debounce 300ms on typing
  for a "live" feel only when online and the query is ≥ 3 chars.
- Pattern field is hidden behind a chip until tapped, so the default screen
  is truly one input. Typing a number alone in the pattern field means "length".
- Tap an answer tile row → copies the grid-form answer to clipboard and shows
  a toast. Long-press → sets it as the query (chain lookups).
- Sections render independently as each provider resolves. Skeleton rows
  while loading; the answers section usually lands first.
- Errors show as a single muted line under the affected section
  ("Couldn't reach dictionary — showing cached result"). Never a modal.
- Design tokens from the prototype are kept: cream `#EFE9DD`, ink `#1B1B1B`,
  blue `#2B4C7E`, serif display, monospace tiles. Dark mode inverts cream/ink.
- Respect `prefers-reduced-motion`. Min tap target 44px. `100dvh` layout so
  the iOS keyboard doesn't push content off-screen.

---

## 6. PWA

### Manifest

```json
{
  "name": "Clue Solver",
  "short_name": "Clues",
  "start_url": "/?source=pwa",
  "display": "standalone",
  "background_color": "#EFE9DD",
  "theme_color": "#2B4C7E",
  "icons": [
    { "src": "/icons/192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ],
  "share_target": {
    "action": "/",
    "method": "GET",
    "params": { "text": "q" }
  }
}
```

`share_target` lets the user highlight a clue in another app and "share" it
straight into the solver; `?q=` is read on load and submitted.

### Service worker (Workbox via vite-plugin-pwa)

| Route | Strategy | Cache | Expiry |
|---|---|---|---|
| App shell (`index.html`, JS, CSS, icons) | Precache | `app-v{hash}` | On deploy |
| `api.datamuse.com/*` | StaleWhileRevalidate | `api-datamuse` | 100 entries, 7 d |
| `api.dictionaryapi.dev/*`, `en.wiktionary.org/api/*` | StaleWhileRevalidate | `api-dict` | 100 entries, 30 d |
| `en.wikipedia.org/api/rest_v1/*` | StaleWhileRevalidate | `api-wiki` | 100 entries, 30 d |
| Wikipedia thumbnails (`upload.wikimedia.org`) | CacheFirst | `img` | 50 entries, 30 d |

Two cache layers exist on purpose: the SW HTTP cache makes repeat network
calls free, and the app-level `SolveResult` cache in `localStorage` makes
repeat *queries* render with no fetch at all (and works even if the SW
hasn't installed yet).

Offline behavior:

- App shell always loads.
- A query already in the result cache renders normally with an "offline,
  cached" pill.
- A new query offline: answers/definition sections show one line each
  ("You're offline"), the search links still render (they'll open when the
  user is back online), history still works.

Update flow: `registerType: 'prompt'`. When a new SW is waiting, show a
small "Update available — reload" bar. Never auto-reload mid-typing.

iOS notes: no `beforeinstallprompt`, so show an "Add to Home Screen" hint
once (dismissable, stored) when running in Safari and not standalone.
Set `<meta name="apple-mobile-web-app-capable">` and an
`apple-touch-icon`. Safari evicts storage after 7 days of non-use for
non-installed sites; installed PWAs are exempt.

---

## 7. Project layout

```
index.html
vite.config.ts            # vite-plugin-pwa config lives here
public/
  icons/192.png, 512.png, apple-touch-icon.png
src/
  contract.ts             # ← the data model (already written)
  main.ts                 # boot, read ?q=, wire input → solve → render
  solve.ts                # orchestrator: parse, fan out, merge, cache
  pattern.ts              # parser + matcher (pure, unit-tested)
  providers/
    datamuse.ts
    dictionaryapi.ts
    wiktionary.ts
    wikipedia.ts
    links.ts
  store.ts                # localStorage history + result cache
  render/
    answers.ts            # letter tiles
    definition.ts
    reference.ts
    history.ts
  styles.css
test/
  pattern.test.ts
  providers/*.test.ts     # mapper tests against fixtures/
  fixtures/*.json         # captured real responses
```

---

## 8. Milestones

1. **Scaffold + smoke test.** Vite project, deploy to Pages, one page that
   fetches each of the four endpoints and prints status + CORS result.
   This validates the "no backend" decision before anything else is built.
2. **Pattern parser + Datamuse adapter + tiles.** The core loop. Ship it.
3. **Definition + reference cards, search links.**
4. **Cache, history, offline states.**
5. **PWA polish:** manifest, icons, SW strategies, update prompt, share target,
   iOS install hint. Lighthouse PWA + a11y ≥ 95.
6. **Phase 2 (optional):** Claude proxy behind a settings toggle.

---

## 9. Open questions (non-blocking, defaults chosen)

- **Live-as-you-type vs submit only.** Default: submit only, with a debounced
  live mode as a later toggle. Live mode burns Datamuse quota fast on a
  shared deployment.
- **Answer count.** Default cap 24; the prototype showed ~8. Tune after use.
- **Proper-noun answers.** Datamuse tags them `prop`. Default: keep them,
  since crosswords love them, but sort slightly lower than common words.
