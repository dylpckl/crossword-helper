import type { HistoryEntry } from '../contract';
import { esc } from './util';

export function renderHistory(list: HistoryEntry[]): string {
  if (!list.length) return '';
  return `<section class="section" id="sec-recent"><h2>Recent</h2><div class="recent">${list
    .slice(0, 12)
    .map(
      (h) =>
        `<button type="button" data-q="${esc(h.query)}" data-p="${esc(h.pattern ?? '')}">${esc(h.query)}${
          h.pattern ? `<code>${esc(h.pattern)}</code>` : ''
        }</button>`,
    )
    .join('')}</div></section>`;
}
