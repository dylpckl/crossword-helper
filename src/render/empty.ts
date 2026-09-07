import { esc } from './util';

/** A clue and a word, so the two things the app does are both one tap away. */
const EXAMPLES = ['old testament prophet', 'tide'];

/**
 * Shown when there is nothing to show: first load, or after clearing the input.
 * Examples only appear before there is any history, since recent searches do
 * the same job better once they exist.
 */
export function renderEmpty(showExamples: boolean): string {
  return `<div class="empty-state">
    <div class="motif" aria-hidden="true">${'CLUE'.split('').map((c) => `<span class="tile">${c}</span>`).join('')}</div>
    <h2>Type a clue or a word</h2>
    <p>Crosscheck solves it as a crossword clue and defines it as a word, in one go.</p>
    ${
      showExamples
        ? `<div class="examples"><span class="eyebrow">Try one</span>${EXAMPLES.map(
            (e) => `<button type="button" data-example="${esc(e)}">${esc(e)}</button>`,
          ).join('')}</div>`
        : ''
    }
  </div>`;
}
