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
}

export function renderAnswers(answers: Answer[], req: SolveRequest, opts: AnswersOpts = {}): string {
  const swap = opts.swap ? `<button type="button" class="swap" data-swap>${esc(opts.swap)}</button>` : '';
  const head = `<h2>Answers ${answers.length ? `<span class="count">${countLabel(answers, req)}</span>` : ''}${opts.fromCache ? '<span class="pill">Cached</span>' : ''}${swap}</h2>`;
  let body: string;
  if (opts.error && !answers.length) {
    body = `<div class="notice bad">${esc(opts.error.message)}.</div>`;
  } else if (!answers.length) {
    body = `<div class="empty">No matches for <b>${esc(req.query)}</b>. Try a shorter phrase, or search the web below.</div>`;
  } else {
    const shown = opts.compact ? answers.slice(0, COMPACT_ROWS) : answers;
    const hidden = answers.length - shown.length;
    body = `<div class="answers">${shown.map((a) => row(a, req)).join('')}</div>${
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
