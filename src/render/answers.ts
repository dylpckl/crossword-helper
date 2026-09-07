import type { Answer, ProviderError, SolveRequest } from '../contract';
import { esc } from './util';

export function skeletonAnswers(): string {
  return `<section class="section" id="sec-answers"><h2>Answers</h2>
    <div class="sk"></div><div class="sk short"></div><div class="sk"></div><div class="sk short"></div><div class="sk"></div><div class="sk short"></div>
  </section>`;
}

export const COMPACT_ROWS = 3;

export interface AnswersOpts {
  fromCache?: boolean;
  error?: ProviderError;
  /** Show only the first few rows with a "show more" button. */
  compact?: boolean;
  /** Header link that flips the layout, e.g. "Show as word". */
  swap?: string;
  /**
   * Show only answers of this length. A view-time filter over answers already
   * fetched, so it costs no request; a length with no answers is ignored.
   */
  lengthFilter?: number | null;
}

/** Lengths present in the answers, ascending, with how many of each. */
export function lengthCounts(answers: Answer[]): [number, number][] {
  const counts = new Map<number, number>();
  for (const a of answers) counts.set(a.length, (counts.get(a.length) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => a[0] - b[0]);
}

export function renderAnswers(answers: Answer[], req: SolveRequest, opts: AnswersOpts = {}): string {
  const counts = lengthCounts(answers);
  // Ignore a filter nothing matches, so a stale selection can't empty the list.
  const active = counts.some(([n]) => n === opts.lengthFilter) ? opts.lengthFilter! : null;
  const filtered = active ? answers.filter((a) => a.length === active) : answers;

  const swap = opts.swap ? `<button type="button" class="swap" data-swap>${esc(opts.swap)}</button>` : '';
  const label = active ? `${filtered.length} of ${answers.length}` : countLabel(answers, req);
  const head = `<h2>Answers ${answers.length ? `<span class="count">${label}</span>` : ''}${opts.fromCache ? '<span class="pill">Cached</span>' : ''}${swap}</h2>`;

  let body: string;
  if (opts.error && !answers.length) {
    body = `<div class="notice bad">${esc(opts.error.message)}.</div>`;
  } else if (!answers.length) {
    body = `<div class="empty">No matches for <b>${esc(req.query)}</b>. Try a shorter phrase, or search the web below.</div>`;
  } else {
    // One length is no choice, so the row only earns its space with two or more.
    const chips = counts.length > 1
      ? `<div class="lens" role="group" aria-label="Filter by length">${counts
          .map(([n, k]) => `<button type="button" data-len="${n}" aria-pressed="${n === active}" aria-label="${n} letters, ${k} answer${k === 1 ? '' : 's'}"><b>${n}</b><span>${k}</span></button>`)
          .join('')}</div>`
      : '';
    const shown = opts.compact && !active ? filtered.slice(0, COMPACT_ROWS) : filtered;
    const hidden = filtered.length - shown.length;
    body = `${chips}<div class="answers">${shown.map((a) => row(a, req)).join('')}</div>${
      hidden > 0 ? `<button type="button" class="more" data-expand-answers>Show ${hidden} more</button>` : ''
    }`;
  }
  return `<section class="section" id="sec-answers">${head}${body}</section>`;
}

function countLabel(answers: Answer[], req: SolveRequest): string {
  if (req.pattern || req.length) return `${answers.filter((a) => a.fitsPattern === true).length} of ${answers.length} fit`;
  if (req.letters) {
    const all = answers.filter((a) => a.letterHits === req.letters!.length).length;
    return `${all} of ${answers.length} have ${req.letters.split('').join(' ')}`;
  }
  return String(answers.length);
}

function row(a: Answer, req: SolveRequest): string {
  const words = a.display.split(/\s+/);
  let idx = 0;
  const tiles = words
    .map((w, wi) => {
      const letters = w
        .toUpperCase()
        .replace(/[^A-Z]/g, '')
        .split('')
        .map((ch) => {
          const hit = req.pattern ? req.pattern[idx] === ch : Boolean(req.letters?.includes(ch));
          idx++;
          return `<span class="tile${hit ? ' hit' : ''}">${ch}</span>`;
        })
        .join('');
      return letters + (wi < words.length - 1 ? '<span class="gap"></span>' : '');
    })
    .join('');
  const pos = a.partOfSpeech?.[0];
  return `<button class="row${a.fitsPattern === false ? ' dim' : ''}" data-answer="${a.answer}" data-display="${esc(a.display)}"
      aria-label="${esc(a.display)}, ${a.length} letters. Tap to copy, hold to look up.">
    <span class="tiles${a.length >= 9 ? ' long' : ''}">${tiles}<span class="len">${a.length}</span></span>
    ${a.gloss ? `<span class="gloss">${pos ? `<span class="pos">${esc(pos)}.</span>` : ''}${esc(a.gloss)}</span>` : ''}
  </button>`;
}
