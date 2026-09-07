import type { ProviderError, Reference, SearchLink } from '../contract';
import { esc, extIcon } from './util';

export function skeletonReference(): string {
  return `<section class="section" id="sec-about"><h2>About</h2><div class="sk" style="height:64px"></div></section>`;
}

export function renderReference(r: Reference | null, links: SearchLink[], query: string, errors: ProviderError[] = []): string {
  const linkRow = `<div class="links">${links
    .map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}${extIcon}</a>`)
    .join('')}</div>`;
  if (!r) {
    const err = errors.find((e) => e.provider === 'Wikipedia');
    const msg = err ? `${esc(err.message)}.` : `No Wikipedia page for “${esc(query)}”.`;
    return `<section class="section" id="sec-about"><h2>About</h2><div class="muted${err ? ' notice bad' : ''}">${msg}</div>${linkRow}</section>`;
  }
  return `<section class="section" id="sec-about"><h2>About${r.kind === 'disambiguation' ? '<span class="pill">Several meanings</span>' : ''}</h2>
    <a class="about${r.thumbnailUrl ? '' : ' nothumb'}" href="${esc(r.url)}" target="_blank" rel="noopener">
      ${r.thumbnailUrl ? `<span class="thumb"><img src="${esc(r.thumbnailUrl)}" alt="" loading="lazy" onerror="this.closest('.about').classList.add('nothumb');this.parentElement.remove()"></span>` : ''}
      <span><span class="title">${esc(r.title)} <span class="ext">Wikipedia ↗</span></span><span class="extract">${esc(r.extract)}</span></span>
    </a>${linkRow}</section>`;
}
