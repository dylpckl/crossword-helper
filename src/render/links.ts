import type { SearchLink } from '../contract';
import { esc, extIcon } from './util';

/** The chips only. Lives inside the Meaning disclosure, so it brings its own label. */
export function linkRow(links: SearchLink[]): string {
  return `<div class="block linkblock">
    <div class="eyebrow">Search elsewhere</div>
    <div class="links">${links
      .map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}${extIcon}</a>`)
      .join('')}</div>
  </div>`;
}
