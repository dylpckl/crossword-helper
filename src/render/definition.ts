import type { Definition, ProviderError } from '../contract';
import { esc } from './util';

const SHOWN = 2;
const SOURCE_LABEL = { dictionaryapi: 'Free Dictionary API', wiktionary: 'Wiktionary', datamuse: 'Datamuse' } as const;

export function skeletonDefinition(): string {
  return `<section class="section" id="sec-meaning"><h2>Meaning</h2><div class="sk card"></div></section>`;
}

const CHEVRON = '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';

export interface DefinitionOpts {
  /** Expanded shows the full card; collapsed shows one line you can tap open. */
  open?: boolean;
}

/** One-line taste of the entry, for the collapsed state. */
function peek(d: Definition): string {
  const first = d.senses[0];
  return `${esc(d.term)}${first ? ` <span class="pos">${esc(first.partOfSpeech ?? '')}</span>${esc(first.definition)}` : ''}`;
}

export function renderDefinition(d: Definition | null, query: string, errors: ProviderError[] = [], opts: DefinitionOpts = {}): string {
  if (!d) {
    // Nothing to disclose, so no control: just say so.
    const err = errors.find((e) => e.provider === 'Free Dictionary' || e.provider === 'Wiktionary');
    const msg = err ? `${esc(err.message)}.` : `No dictionary entry for “${esc(query)}”. Phrases often don't have one.`;
    return `<section class="section" id="sec-meaning"><h2>Meaning</h2><div class="muted${err ? ' notice bad' : ''}">${msg}</div></section>`;
  }
  const open = opts.open !== false;
  const header = `<h2><button type="button" class="disclosure" data-toggle-meaning aria-expanded="${open}" aria-controls="meaning-body">Meaning${CHEVRON}</button></h2>`;
  if (!open) {
    return `<section class="section" id="sec-meaning">${header}
      <button type="button" class="peek" data-toggle-meaning id="meaning-body">${peek(d)}</button></section>`;
  }
  const extra = Math.max(0, d.senses.length - SHOWN);
  const senses = d.senses
    .map(
      (s, i) => `<li class="${i >= SHOWN ? 'more' : ''}"><span class="pos">${esc(s.partOfSpeech ?? '')}</span><span>${esc(s.definition)}${
        s.example ? `<span class="ex">“${esc(s.example)}”</span>` : ''
      }</span></li>`,
    )
    .join('');
  return `<section class="section" id="sec-meaning">${header}
    <div class="card" id="meaning-body">
      <div class="head"><span class="term">${esc(d.term)}</span>${d.phonetic ? `<span class="ipa">${esc(d.phonetic)}</span>` : ''}
        ${d.audioUrl ? `<button class="play" type="button" aria-label="Play pronunciation" data-audio="${esc(d.audioUrl)}"><svg viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><path d="M2 1l9 5-9 5z"/></svg></button>` : ''}
      </div>
      <ul class="senses">${senses}</ul>
      ${extra ? `<button type="button" class="toggle" data-expand><span class="when-closed">⌄ ${extra} more sense${extra > 1 ? 's' : ''}</span><span class="when-open">⌃ Fewer senses</span></button>` : ''}
      <div class="src">${SOURCE_LABEL[d.source]}${d.sourceUrl ? ` · <a href="${esc(d.sourceUrl)}" target="_blank" rel="noopener">source</a>` : ''}</div>
    </div></section>`;
}
