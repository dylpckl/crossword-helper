import type { Definition, ProviderError } from '../contract';
import { esc } from './util';

const SHOWN = 2;
const SOURCE_LABEL = { dictionaryapi: 'Free Dictionary API', wiktionary: 'Wiktionary', datamuse: 'Datamuse' } as const;

export function skeletonDefinition(): string {
  return `<section class="section" id="sec-meaning"><h2>Meaning</h2><div class="sk card"></div></section>`;
}

export function renderDefinition(d: Definition | null, query: string, errors: ProviderError[] = []): string {
  if (!d) {
    const err = errors.find((e) => e.provider === 'Free Dictionary' || e.provider === 'Wiktionary');
    const msg = err ? `${esc(err.message)}.` : `No dictionary entry for “${esc(query)}”. Phrases often don't have one.`;
    return `<section class="section" id="sec-meaning"><h2>Meaning</h2><div class="muted${err ? ' notice bad' : ''}">${msg}</div></section>`;
  }
  const extra = Math.max(0, d.senses.length - SHOWN);
  const senses = d.senses
    .map(
      (s, i) => `<li class="${i >= SHOWN ? 'more' : ''}"><span class="pos">${esc(s.partOfSpeech ?? '')}</span><span>${esc(s.definition)}${
        s.example ? `<span class="ex">“${esc(s.example)}”</span>` : ''
      }</span></li>`,
    )
    .join('');
  return `<section class="section" id="sec-meaning"><h2>Meaning</h2>
    <div class="card">
      <div class="head"><span class="term">${esc(d.term)}</span>${d.phonetic ? `<span class="ipa">${esc(d.phonetic)}</span>` : ''}
        ${d.audioUrl ? `<button class="play" type="button" aria-label="Play pronunciation" data-audio="${esc(d.audioUrl)}"><svg viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><path d="M2 1l9 5-9 5z"/></svg></button>` : ''}
      </div>
      <ul class="senses">${senses}</ul>
      ${extra ? `<button type="button" class="toggle" data-expand><span class="when-closed">⌄ ${extra} more sense${extra > 1 ? 's' : ''}</span><span class="when-open">⌃ Fewer senses</span></button>` : ''}
      <div class="src">${SOURCE_LABEL[d.source]}${d.sourceUrl ? ` · <a href="${esc(d.sourceUrl)}" target="_blank" rel="noopener">source</a>` : ''}</div>
    </div></section>`;
}
