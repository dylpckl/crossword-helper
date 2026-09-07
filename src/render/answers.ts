import type { Answer, ProviderError, SolveRequest } from '../contract';
import { esc } from './util';

export function skeletonAnswers(): string {
  return `<section class="section" id="sec-answers"><h2>Answers</h2>
    <div class="sk"></div><div class="sk short"></div><div class="sk"></div><div class="sk short"></div><div class="sk"></div><div class="sk short"></div>
  </section>`;
}

export function renderAnswers(answers: Answer[], req: SolveRequest, opts: { fromCache?: boolean; error?: ProviderError } = {}): string {
  const constrained = Boolean(req.pattern || req.length);
  const hits = answers.filter((a) => a.fitsPattern === true).length;
  const head = `<h2>Answers ${answers.length ? `<span class="count">${constrained ? `${hits} of ${answers.length} fit` : answers.length}</span>` : ''}${opts.fromCache ? '<span class="pill">Cached</span>' : ''}</h2>`;
  let body: string;
  if (opts.error && !answers.length) {
    body = `<div class="notice bad">${esc(opts.error.message)}.</div>`;
  } else if (!answers.length) {
    body = `<div class="empty">No matches for <b>${esc(req.query)}</b>. Try a shorter phrase, or search the web below.</div>`;
  } else {
    body = `<div class="answers">${answers.map((a) => row(a, req)).join('')}</div>`;
  }
  return `<section class="section" id="sec-answers">${head}${body}</section>`;
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
          const hit = req.pattern?.[idx] === ch;
          idx++;
          return `<span class="tile${hit ? ' hit' : ''}">${ch}</span>`;
        })
        .join('');
      return letters + (wi < words.length - 1 ? '<span class="gap"></span>' : '');
    })
    .join('');
  const dots = [1, 2, 3, 4, 5].map((i) => `<i class="${a.score >= i / 5 - 0.1 ? 'on' : ''}"></i>`).join('');
  const pos = a.partOfSpeech?.[0];
  return `<button class="row${a.fitsPattern === false ? ' dim' : ''}" data-answer="${a.answer}" data-display="${esc(a.display)}"
      aria-label="${esc(a.display)}, ${a.length} letters. Tap to copy, hold to look up.">
    <span class="tiles${a.length >= 9 ? ' long' : ''}">${tiles}<span class="len">${a.length}</span></span>
    <span class="score" aria-hidden="true">${dots}</span>
    ${a.gloss ? `<span class="gloss">${pos ? `<span class="pos">${esc(pos)}.</span>` : ''}${esc(a.gloss)}</span>` : ''}
  </button>`;
}
