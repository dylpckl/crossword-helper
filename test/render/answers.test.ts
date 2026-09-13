import { describe, expect, it } from 'vitest';
import type { Answer } from '../../src/contract';
import { lengthCounts, renderAnswers } from '../../src/render/answers';
import { renderMeaning } from '../../src/render/meaning';

const make = (display: string, score = 1, priority = 0): Answer => {
  const answer = display.toUpperCase().replace(/[^A-Z]/g, '');
  return { answer, display, length: answer.length, score, priority, fitsPattern: null, source: priority ? 'cluebank' : 'datamuse' };
};
/** Two published answers, three associations. */
const ANSWERS = [make('seer', 1, 1), make('ezra', 1, 1), make('nahum'), make('samuel'), make('soothsayer')];

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
    // The count is of published answers: both four-letter ones are.
    expect(html).toContain('2 of 2');
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

  it('labels the row so two numbers are never left to speak for themselves', () => {
    expect(renderAnswers(ANSWERS, { query: 'x' })).toContain('class="lenlabel">Length');
  });
});

describe('answers versus related words', () => {
  it('shows published answers under Answers and associations under their own heading', () => {
    const html = renderAnswers(ANSWERS, { query: 'prophet' });
    const answers = html.indexOf('data-answer="SEER"');
    const subhead = html.indexOf('class="subhead">Related words');
    const related = html.indexOf('data-answer="NAHUM"');
    expect(answers).toBeGreaterThan(-1);
    expect(subhead).toBeGreaterThan(answers);
    expect(related).toBeGreaterThan(subhead);
    expect(html).toContain('Related words <span class="count">3</span>');
  });

  it('counts only published answers in the heading', () => {
    expect(renderAnswers(ANSWERS, { query: 'prophet' })).toContain('<span class="count">2</span>');
  });

  it('never presents an association as an answer', () => {
    const html = renderAnswers([make('gods'), make('deity')], { query: 'false god' });
    expect(html).not.toMatch(/<h2>Answers <span class="count">/);
    expect(html).toContain('Related words');
  });

  it('offers the search the reader would have typed when nothing is published', () => {
    const html = renderAnswers([make('gods')], { query: 'false god' });
    expect(html).toContain('No published answer for <b>false god</b> yet.');
    expect(html).toContain('Google “false god crossword”');
    expect(html).toContain('href="https://www.google.com/search?q=false%20god%20crossword%20clue"');
    // The hand-off sits where the answers would be, above the associations.
    expect(html.indexOf('class="handoff"')).toBeLessThan(html.indexOf('Related words'));
  });

  it('carries the selected length into the hand-off', () => {
    const html = renderAnswers([make('gods'), make('deity')], { query: 'false god' }, { lengthFilter: 4 });
    expect(html).toContain('Google “false god crossword, 4 letters”');
    expect(html).toContain('false%20god%20crossword%20clue%204%20letters');
  });

  it('hands off even when there is nothing at all, so the page is never a dead end', () => {
    const html = renderAnswers([], { query: 'sawbuck' });
    expect(html).toContain('class="handoff-btn"');
    expect(html).not.toContain('Related words');
  });

  it('keeps the provider error visible alongside the hand-off', () => {
    const html = renderAnswers([], { query: 'sawbuck' }, { error: { provider: 'Datamuse', kind: 'http', message: 'Datamuse returned 503', status: 503 } });
    expect(html).toContain('Datamuse returned 503');
    expect(html).toContain('class="handoff-btn"');
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

  it('is closed unless asked otherwise', () => {
    expect(renderMeaning(DEF, REF, LINKS, 'tide')).toContain('aria-expanded="false"');
  });

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
