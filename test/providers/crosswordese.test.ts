import { describe, expect, it } from 'vitest';
import { CROSSWORDESE } from '../../src/data/crosswordese';
import { clueScore, findClued, tokenize } from '../../src/providers/crosswordese';

const req = (query: string) => ({ query });

describe('tokenize', () => {
  it('drops filler and folds plurals so clue and query meet in the middle', () => {
    expect(tokenize('Greek letters')).toEqual(['greek', 'letter']);
    expect(tokenize('the god of war')).toEqual(['god', 'war']);
  });

  it('keeps short words ending in s, which are rarely plurals', () => {
    expect(tokenize('ides')).toEqual(['ide']);
    expect(tokenize('gas')).toEqual(['gas']);
  });

  it('deduplicates repeated words', () => {
    expect(tokenize('coin coin')).toEqual(['coin']);
  });
});

describe('clueScore', () => {
  it('scores an exact phrase 1', () => {
    expect(clueScore(tokenize('old coin'), 'old coin')).toBe(1);
  });

  it('scores lower as the clue carries words the query did not ask for', () => {
    const exact = clueScore(tokenize('old coin'), 'old coin')!;
    const loose = clueScore(tokenize('old coin'), 'old french coin')!;
    expect(loose).toBeLessThan(exact);
    expect(loose).toBeCloseTo(2 / 3);
  });

  it('refuses a clue that is missing a word the query asked for', () => {
    // "coin" alone does not answer "old coin" — the setter asked for an old one.
    expect(clueScore(tokenize('old coin'), 'coin')).toBeNull();
  });

  it('refuses an empty query rather than matching everything', () => {
    expect(clueScore(tokenize('the of'), 'old coin')).toBeNull();
  });
});

describe('findClued', () => {
  it('answers the clue that Datamuse alone could not', () => {
    const answers = findClued(req('old coin'));
    const three = answers.filter((a) => a.length === 3).map((a) => a.answer);
    expect(three).toContain('SOU');
    expect(three).toContain('ECU');
    expect(three).toContain('ORE');
  });

  it('puts the shortest exact-clue answers first, which is what a grid wants', () => {
    expect(findClued(req('old coin'))[0]!.length).toBe(3);
  });

  it('marks every hit as crosswordese and carries a gloss', () => {
    for (const a of findClued(req('greek goddess'))) {
      expect(a.source).toBe('crosswordese');
      expect(a.gloss).toBeTruthy();
    }
  });

  it('scores an exact clue above a merely containing one', () => {
    const answers = findClued(req('butter substitute'));
    const oleo = answers.find((a) => a.answer === 'OLEO');
    expect(oleo?.score).toBe(1);
  });

  it('stays quiet on a query the corpus has no convention for', () => {
    expect(findClued(req('quantum chromodynamics'))).toEqual([]);
    expect(findClued(req('riptide'))).toEqual([]);
  });

  it('finds nothing for an empty query instead of returning the whole corpus', () => {
    expect(findClued(req(''))).toEqual([]);
  });
});

describe('the corpus itself', () => {
  it('holds every answer in grid form', () => {
    for (const e of CROSSWORDESE) expect(e.a).toMatch(/^[A-Z]+$/);
  });

  it('gives every answer a gloss and at least one clue', () => {
    for (const e of CROSSWORDESE) {
      expect(e.g.length).toBeGreaterThan(0);
      expect(e.c.length).toBeGreaterThan(0);
    }
  });

  it('stores clues in the lowercase form the matcher expects', () => {
    for (const e of CROSSWORDESE) for (const c of e.c) expect(c).toBe(c.toLowerCase());
  });

  it('lists each answer once, so merging never has to break a tie with itself', () => {
    const seen = new Set(CROSSWORDESE.map((e) => e.a));
    expect(seen.size).toBe(CROSSWORDESE.length);
  });
});
