import { describe, expect, it } from 'vitest';
import { normalizeClue } from '../../src/clue-norm';
import { lookupClue } from '../../src/providers/cluebank';

const BANK = { 'false god': ['IDOL', 'BAAL'], 'small case': ['ETUI'] };

describe('normalizeClue', () => {
  it('collapses the ways a setter might punctuate one clue', () => {
    for (const written of ['False god', 'FALSE GOD', 'False god (4)', '  false   god  ']) {
      expect(normalizeClue(written)).toBe('false god');
    }
  });

  it('treats curly and straight apostrophes alike, and never splits the word', () => {
    expect(normalizeClue("Florence's river")).toBe('florences river');
    expect(normalizeClue('Florence’s river')).toBe('florences river');
  });

  it('drops parenthetical metadata', () => {
    expect(normalizeClue('Roman well (var.)')).toBe('roman well');
    expect(normalizeClue('Gets going (2 wds.)')).toBe('gets going');
  });

  it('reduces a clue with nothing but punctuation to empty', () => {
    expect(normalizeClue('(4)')).toBe('');
    expect(normalizeClue('   ')).toBe('');
  });
});

describe('lookupClue', () => {
  it('answers the clue the user actually typed', () => {
    expect(lookupClue(BANK, { query: 'false god' }).map((a) => a.answer)).toEqual(['IDOL', 'BAAL']);
  });

  it('matches however the clue was capitalized or punctuated', () => {
    expect(lookupClue(BANK, { query: 'False God (4)' }).map((a) => a.answer)).toEqual(['IDOL', 'BAAL']);
  });

  it('keeps the most published answer first', () => {
    const [first, second] = lookupClue(BANK, { query: 'false god' });
    expect(first!.answer).toBe('IDOL');
    expect(first!.score).toBeGreaterThan(second!.score);
  });

  it('marks hits as stronger evidence than any association', () => {
    for (const a of lookupClue(BANK, { query: 'false god' })) {
      expect(a.priority).toBe(1);
      expect(a.source).toBe('cluebank');
    }
  });

  it('stays exact: a clue the bank does not hold returns nothing', () => {
    expect(lookupClue(BANK, { query: 'a false god' })).toEqual([]);
    expect(lookupClue(BANK, { query: 'god' })).toEqual([]);
  });

  it('handles an empty query and an empty bank', () => {
    expect(lookupClue(BANK, { query: '' })).toEqual([]);
    expect(lookupClue({}, { query: 'false god' })).toEqual([]);
  });
});
