import type { Definition, ProviderError, Reference } from '../contract';
import { esc } from './util';

const SHOWN = 2;
const SOURCE_LABEL = { dictionaryapi: 'Free Dictionary API', wiktionary: 'Wiktionary', datamuse: 'Datamuse' } as const;
const CHEVRON = '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';

export function skeletonMeaning(): string {
  return `<section class="section meaning open" id="sec-meaning"><h2>Meaning</h2><div class="sk card"></div></section>`;
}

export interface MeaningOpts {
  /** Expanded shows the cards; collapsed shows one line you can tap open. */
  open?: boolean;
}

/**
 * Meaning gathers everything that answers "what is this": the dictionary entry
 * and the Wikipedia summary. They come from different sources — each says which
 * — but they answer the same question, so they share one disclosure.
 *
 * Both states are always in the DOM. The closed one is collapsed to zero height
 * by a grid row transition, which is what lets the open and close animate in CSS
 * with no height measuring.
 */
export function renderMeaning(
  d: Definition | null,
  r: Reference | null,
  query: string,
  errors: ProviderError[] = [],
  opts: MeaningOpts = {},
): string {
  if (!d && !r) {
    const err = errors.find((e) => e.provider === 'Free Dictionary' || e.provider === 'Wiktionary');
    const msg = err ? `${esc(err.message)}.` : `No dictionary entry for “${esc(query)}”. Phrases often don't have one.`;
    return `<section class="section meaning" id="sec-meaning"><h2>Meaning</h2><div class="muted${err ? ' notice bad' : ''}">${msg}</div></section>`;
  }
  const open = opts.open !== false;
  return `<section class="section meaning${open ? ' open' : ''}" id="sec-meaning">
    <h2><button type="button" class="disclosure" data-toggle-meaning aria-expanded="${open}" aria-controls="meaning-body">Meaning${
      r?.kind === 'disambiguation' ? '<span class="pill">Several meanings</span>' : ''
    }${CHEVRON}</button></h2>
    <div class="peekwrap"><div class="inner"><button type="button" class="peek" data-toggle-meaning tabindex="${open ? -1 : 0}">${peek(d, r)}</button></div></div>
    <div class="bodywrap" id="meaning-body"><div class="inner">
      ${d ? definitionCard(d) : ''}
      ${r ? referenceCard(r) : ''}
    </div></div></section>`;
}

/** One line for the collapsed state: the definition if there is one, else the summary. */
function peek(d: Definition | null, r: Reference | null): string {
  if (d) {
    const first = d.senses[0];
    return `${esc(d.term)}${first ? ` <span class="pos">${esc(first.partOfSpeech ?? '')}</span>${esc(first.definition)}` : ''}`;
  }
  return r ? `${esc(r.title)} <span class="pos">wiki</span>${esc(r.extract)}` : '';
}

function definitionCard(d: Definition): string {
  const extra = Math.max(0, d.senses.length - SHOWN);
  const senses = d.senses
    .map(
      (s, i) => `<li class="${i >= SHOWN ? 'more' : ''}"><span class="pos">${esc(s.partOfSpeech ?? '')}</span><span>${esc(s.definition)}${
        s.example ? `<span class="ex">“${esc(s.example)}”</span>` : ''
      }</span></li>`,
    )
    .join('');
  return `<div class="card">
    <div class="head"><span class="term">${esc(d.term)}</span>${d.phonetic ? `<span class="ipa">${esc(d.phonetic)}</span>` : ''}
      ${d.audioUrl ? `<button class="play" type="button" aria-label="Play pronunciation" data-audio="${esc(d.audioUrl)}"><svg viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><path d="M2 1l9 5-9 5z"/></svg></button>` : ''}
    </div>
    <ul class="senses">${senses}</ul>
    ${extra ? `<button type="button" class="toggle" data-expand><span class="when-closed">⌄ ${extra} more sense${extra > 1 ? 's' : ''}</span><span class="when-open">⌃ Fewer senses</span></button>` : ''}
    <div class="src">${SOURCE_LABEL[d.source]}${d.sourceUrl ? ` · <a href="${esc(d.sourceUrl)}" target="_blank" rel="noopener">source</a>` : ''}</div>
  </div>`;
}

function referenceCard(r: Reference): string {
  return `<a class="about${r.thumbnailUrl ? '' : ' nothumb'}" href="${esc(r.url)}" target="_blank" rel="noopener">
    ${r.thumbnailUrl ? `<span class="thumb"><img src="${esc(r.thumbnailUrl)}" alt="" loading="lazy" onerror="this.closest('.about').classList.add('nothumb');this.parentElement.remove()"></span>` : ''}
    <span><span class="title">${esc(r.title)} <span class="ext">Wikipedia ↗</span></span><span class="extract">${esc(r.extract)}</span></span>
  </a>`;
}
