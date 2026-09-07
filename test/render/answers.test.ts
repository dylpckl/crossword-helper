import { describe, expect, it } from 'vitest';
import type { Answer } from '../../src/contract';
import { lengthCounts, renderAnswers } from '../../src/render/answers';
import { renderMeaning } from '../../src/render/meaning';

const make = (display: string, score = 1): Answer => {
  const answer = display.toUpperCase().replace(/[^A-Z]/g, '');
  return { answer, display, length: answer.length, score, fitsPattern: null, source: 'datamuse' };
};
const ANSWERS = [make('seer'), make('ezra'), make('nahum'), make('samuel'), make('soothsayer')];

describe('length chips', () => {
  it('counts only the lengths present, ascending', () => {
    expect(lengthCounts(ANSWERS)).toEqual([[4, 2], [5, 1], [6, 1], [10, 1]]);
  });

  it('renders one segment per length, plus All, with counts kept in the label', () => {
    const html = renderAnswers(ANSWERS, { query: 'x' });
    expect(html).toContain('data-len="0" aria-pressed="true">All');
    expect(html).toContain('data-len="4"');
    expect(html).toContain('data-len="10"');
    expect(html).not.toContain('data-len="7"');
    // The count is announced but never drawn, so two numbers can't be confused.
    expect(html).toContain('aria-label="4 letters, 2 answers"');
    expect(html).toContain('aria-label="5 letters, 1 answer"');
    expect(html).not.toMatch(/>4<\/b>/);
  });

  it('filters the list and updates the count when a length is picked', () => {
    const html = renderAnswers(ANSWERS, { query: 'x' }, { lengthFilter: 4 });
    expect(html).toContain('2 of 5');
    expect(html).toContain('data-answer="SEER"');
    expect(html).toContain('data-answer="EZRA"');
    expect(html).not.toContain('data-answer="NAHUM"');
    expect(html).toContain('data-len="4" aria-pressed="true"');
    expect(html).toContain('data-len="0" aria-pressed="false">All');
  });

  it('ignores a length nothing matches and falls back to All', () => {
    const html = renderAnswers(ANSWERS, { query: 'x' }, { lengthFilter: 9 });
    expect(html).toContain('data-answer="NAHUM"');
    expect(html).toContain('data-len="0" aria-pressed="true">All');
    expect(html).not.toContain('data-len="4" aria-pressed="true"');
  });

  it('hides the row when every answer is the same length', () => {
    expect(renderAnswers([make('seer'), make('ezra')], { query: 'x' })).not.toContain('class="lens"');
  });

  it('shows all matches when filtering, even in compact mode', () => {
    const html = renderAnswers(ANSWERS, { query: 'x' }, { compact: true, lengthFilter: 4 });
    expect(html).toContain('data-answer="EZRA"');
    expect(html).not.toContain('data-expand-answers');
  });
});

describe('meaning disclosure', () => {
  const LINKS = [{ label: 'Google', url: 'https://example.com' }];
  const REF = {
    title: 'Tide',
    extract: 'Tides are the rise and fall of sea levels.',
    url: 'https://en.m.wikipedia.org/wiki/Tide',
    kind: 'standard' as const,
    source: 'wikipedia' as const,
  };
  const DEF = {
    term: 'tide',
    phonetic: '/taɪd/',
    senses: [
      { partOfSpeech: 'n.', definition: 'The periodic rise and fall of the sea.' },
      { partOfSpeech: 'n.', definition: 'A powerful surge of feeling.' },
    ],
    source: 'dictionaryapi' as const,
  };

  it('carries both sources in one disclosure', () => {
    const html = renderMeaning(DEF, REF, LINKS, 'tide', [], { open: true });
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('class="section meaning open"');
    expect(html).toContain('The periodic rise and fall of the sea.');
    expect(html).toContain('Tides are the rise and fall of sea levels.');
    expect(html).toContain('Free Dictionary API');
    expect(html).toContain('Wikipedia');
  });

  it('keeps both states in the DOM so the height can animate', () => {
    const html = renderMeaning(DEF, REF, LINKS, 'tide', [], { open: false });
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('class="section meaning open"');
    // Collapsed, but present: CSS transitions the grid row, not display.
    expect(html).toContain('class="peek"');
    expect(html).toContain('The periodic rise and fall of the sea.');
  });

  it('peeks the summary when only Wikipedia has anything', () => {
    const html = renderMeaning(null, REF, LINKS, 'big apple', [], { open: false });
    expect(html).toContain('data-toggle-meaning');
    expect(html).toContain('Tides are the rise and fall of sea levels.');
  });

  it('offers no control when neither source has anything, but still links out', () => {
    const html = renderMeaning(null, null, LINKS, 'out of the country');
    expect(html).not.toContain('data-toggle-meaning');
    expect(html).toContain('No dictionary entry');
    expect(html).toContain('Search elsewhere');
  });

  it('keeps the links inside the disclosure', () => {
    const html = renderMeaning(DEF, REF, LINKS, 'tide', [], { open: true });
    expect(html.indexOf('Search elsewhere')).toBeGreaterThan(html.indexOf('bodywrap'));
  });
});
