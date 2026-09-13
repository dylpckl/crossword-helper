import { describe, expect, it } from 'vitest';
import type { Answer } from '../src/contract';
import { capAnswers, mergeAnswers, rankAnswers } from '../src/rank';

const answer = (over: Partial<Answer> & { answer: string }): Answer => ({
  display: over.answer.toLowerCase(),
  length: over.answer.length,
  score: 0.5,
  fitsPattern: null,
  source: 'datamuse',
  ...over,
});

describe('mergeAnswers', () => {
  it('collapses the same answer found by two sources', () => {
    const merged = mergeAnswers([
      answer({ answer: 'OLEO', source: 'crosswordese', score: 1 }),
      answer({ answer: 'OLEO', source: 'datamuse', score: 0.4 }),
    ]);
    expect(merged).toHaveLength(1);
  });

  it('keeps the higher score', () => {
    const merged = mergeAnswers([
      answer({ answer: 'ORE', score: 0.3 }),
      answer({ answer: 'ORE', score: 0.9 }),
    ]);
    expect(merged[0]!.score).toBe(0.9);
  });

  it('prefers the stock crossword gloss over the dictionary one', () => {
    // Datamuse defines OLEO as a fat; the grid cares that it means margarine.
    const merged = mergeAnswers([
      answer({ answer: 'OLEO', source: 'datamuse', score: 1, gloss: 'an edible fat' }),
      answer({ answer: 'OLEO', source: 'crosswordese', score: 0.6, gloss: 'Margarine.' }),
    ]);
    expect(merged[0]!.gloss).toBe('Margarine.');
    expect(merged[0]!.score).toBe(1);
  });

  it('fills in a gloss from the loser when the winner has none', () => {
    const merged = mergeAnswers([
      answer({ answer: 'ERNE', score: 1 }),
      answer({ answer: 'ERNE', score: 0.2, gloss: 'A sea eagle.' }),
    ]);
    expect(merged[0]!.gloss).toBe('A sea eagle.');
  });

  it('leaves distinct answers alone', () => {
    expect(mergeAnswers([answer({ answer: 'SOU' }), answer({ answer: 'ECU' })])).toHaveLength(2);
  });
});

describe('capAnswers', () => {
  it('keeps everything when the list is already short', () => {
    const ranked = [answer({ answer: 'SOU' }), answer({ answer: 'ECU' })];
    expect(capAnswers(ranked)).toHaveLength(2);
  });

  it('trims a long run of same-length answers', () => {
    const ranked = Array.from({ length: 100 }, (_, i) => answer({ answer: `WORDS${String(i).padStart(3, 'X')}` }));
    expect(capAnswers(ranked, 40).length).toBeLessThanOrEqual(40 + 4);
  });

  it('rescues a rare length that the flat cap would have cut', () => {
    // 50 seven-letter answers rank above the one three-letter answer, which is
    // exactly the shape that hid SOU behind ANTIQUE.
    const long = Array.from({ length: 50 }, (_, i) => answer({ answer: `LONGWD${String.fromCharCode(65 + i)}` }));
    const ranked = [...long, answer({ answer: 'SOU', score: 0.1 })];
    const capped = capAnswers(ranked, 40);
    expect(capped.map((a) => a.answer)).toContain('SOU');
  });

  it('holds the rescued answers to the per-length floor', () => {
    const long = Array.from({ length: 50 }, (_, i) => answer({ answer: `LONGWD${String.fromCharCode(65 + i)}` }));
    const shorts = ['SOU', 'ECU', 'ORE', 'SEN', 'ELL', 'ETA'].map((a) => answer({ answer: a, score: 0.1 }));
    const capped = capAnswers([...long, ...shorts], 40, 4);
    expect(capped.filter((a) => a.length === 3)).toHaveLength(4);
  });

  it('preserves rank order in the head', () => {
    const ranked = [answer({ answer: 'AAA', score: 1 }), answer({ answer: 'BBB', score: 0.5 })];
    expect(capAnswers(ranked).map((a) => a.answer)).toEqual(['AAA', 'BBB']);
  });
});

describe('priority', () => {
  it('lifts a published answer above a better-scoring association', () => {
    // Datamuse's top always normalizes to 1, which says nothing about whether
    // it beats an answer a real puzzle used for this exact clue.
    const ranked = rankAnswers(
      [
        answer({ answer: 'GODS', source: 'datamuse', score: 1 }),
        answer({ answer: 'IDOL', source: 'cluebank', score: 0.9, priority: 1 }),
      ],
      { query: 'false god' },
    );
    expect(ranked[0]!.answer).toBe('IDOL');
  });

  it('still respects a pattern fit over evidence tier', () => {
    const ranked = rankAnswers(
      [
        answer({ answer: 'IDOL', source: 'cluebank', score: 1, priority: 1 }),
        answer({ answer: 'GODS', source: 'datamuse', score: 0.2 }),
      ],
      { query: 'false god', pattern: 'G??S', length: 4 },
    );
    expect(ranked[0]!.answer).toBe('GODS');
  });

  it('keeps the higher tier when two sources agree on an answer', () => {
    const merged = mergeAnswers([
      answer({ answer: 'IDOL', source: 'cluebank', score: 0.9, priority: 1 }),
      answer({ answer: 'IDOL', source: 'datamuse', score: 1, gloss: 'an image of a god' }),
    ]);
    expect(merged[0]!.priority).toBe(1);
    expect(merged[0]!.gloss).toBe('an image of a god');
  });
});
