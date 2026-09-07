import type { SearchLink } from '../contract';
import { esc, extIcon } from './util';

/** Search elsewhere: a fallback row, so it sits after the answers rather than inside them. */
export function renderLinks(links: SearchLink[]): string {
  return `<section class="section" id="sec-links"><h2>Search elsewhere</h2>
    <div class="links">${links
      .map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}${extIcon}</a>`)
      .join('')}</div></section>`;
}
