# Clue Solver — handoff

## What it is
One-page web app. Type a word or phrase → get it solved as if it were a
crossword clue (multiple candidate answers, letter-tile styled) and defined
as a word, in a single request. Optional pattern field (`SC_D_`, `_` = unknown
letter) lets you constrain answers to a known length/shape from crossing
words — this was the key feature that made it actually useful for solving
real crosswords, not just a "look up a word" tool.

Working prototype: `crossword-solver.html` (attached). Pure HTML/CSS/JS,
no build step, no framework.

## ⚠️ The one thing that must change before this works outside claude.ai
The prototype calls the model like this:

```js
fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1000, messages: [...] })
})
```

This works with **no API key** only because it's running inside a Claude.ai
artifact — Anthropic's artifact sandbox intercepts that specific call and
injects auth on the user's behalf. Outside claude.ai (a real deployed site,
or run locally by any user other than the one who built it in-chat), this
fetch will just fail: there's no auth, and api.anthropic.com doesn't allow
browser CORS requests with a raw key attached client-side anyway. **API keys
must never be embedded in client-side JS in a real deployment.**

So step one in Claude Code: stand up a tiny backend that holds the real
`ANTHROPIC_API_KEY` server-side and proxies the request. Simplest options:
- A single serverless function (Vercel `/api/solve`, Cloudflare Worker, or
  Netlify function) that takes `{ clue, pattern }`, calls the Anthropic API
  server-side, and returns the parsed JSON.
- Swap the current `fetch("https://api.anthropic.com/...")` call in the
  frontend for `fetch("/api/solve", { method: "POST", body: ... })`.

## Alternative worth considering: drop the LLM entirely
We initially tried the free, no-key **Datamuse API** (`api.datamuse.com/words?ml=<phrase>`,
100k free requests/day) for the clue-solving side, plus **dictionaryapi.dev**
for definitions. Both failed *inside the artifact sandbox* (its CSP blocks
third-party fetches — only api.anthropic.com is special-cased), which is why
we moved to the Claude-API approach. But outside the sandbox, in a normal
deployed site, both of those APIs support standard CORS and would work
directly from client-side JS with **zero backend needed**.

Trade-off:
- **Datamuse + dictionaryapi.dev**: free, no backend, no key, instant — but
  purely meaning-based matching (no "why does this fit" reasoning, no real
  pattern-aware generation, weaker on wordplay/cryptic clues).
- **Claude API (current approach)**: needs a backend + costs per call, but
  understands the clue contextually, explains its reasoning, and can
  actually reason about the pattern constraint rather than just filtering.

Worth deciding in Claude Code: keep the Claude-API version (build the proxy),
switch to Datamuse/dictionaryapi.dev (no backend, weaker answers), or hybrid
(Datamuse for instant results + Claude API as an optional "explain/refine"
step).

## Current feature set (in the attached HTML)
- Single clue input + Solve button
- Optional pattern input (`_` = unknown letter), sorts/dims non-matching
  answers client-side as a safety net on top of the prompt constraint
- Answers rendered as crossword-style letter tiles with a short "why"
- Definition card below
- Inline error/debug output if the request fails (`#debug` div) — useful
  during dev, probably strip or hide-by-default for a real release

## Suggested next steps
1. Decide on the backend approach above and wire it up.
2. Move the prompt (currently inline in `solve()`) server-side too, so it's
   not editable via browser devtools.
3. Nice-to-haves from here: clue history, "no dictionary match" phrase
   fallback polish, keyboard-first flow (auto-focus, submit-on-enter is
   already there), maybe a share/copy-answer action per tile row.
4. Current design tokens (cream `#EFE9DD` / ink `#1B1B1B` / blue `#2B4C7E`,
   Georgia display serif + monospace tiles) are intentional — keep or evolve,
   but the letter-tile treatment for answers is the thing worth preserving.
