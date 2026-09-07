import { describe, expect, it } from 'vitest';
import rows from '../fixtures/datamuse-tide.json';
import { buildUrls, mapAnswers } from '../../src/providers/datamuse';

describe('datamuse', () => {
  it('builds one url unconstrained and two with a pattern', () => {
    expect(buildUrls({ query: 'ocean current' })).toEqual(['https://api.datamuse.com/words?ml=ocean%20current&md=dpf&max=60']);
    const urls = buildUrls({ query: 'tide', pattern: 'E??', length: 3 });
    expect(urls).toHaveLength(2);
    expect(urls[1]).toContain('sp=e%3F%3F');
  });

  it('maps rows into grid-form answers, deduped, sorted, capped', () => {
    const a = mapAnswers(rows, { query: 'tide' });
    expect(a.map((x) => x.answer)).toEqual(['EBB', 'FLOW', 'RIPCURRENT', 'NEAP']);
    expect(a[0]).toMatchObject({ display: 'ebb', length: 3, score: 1, rawScore: 56321, fitsPattern: null, gloss: 'the movement of the tide out to sea', partOfSpeech: ['n', 'v'], source: 'datamuse' });
    expect(a[1]!.partOfSpeech).toEqual(['n', 'v']); // internal results_type tag dropped
    expect(a[2]!.length).toBe(10);
    expect(a[3]!.gloss).toBeUndefined();
  });

  it('marks and sorts by pattern fit', () => {
    const a = mapAnswers(rows, { query: 'tide', pattern: '?L??', length: 4 });
    expect(a[0]).toMatchObject({ answer: 'FLOW', fitsPattern: true });
    expect(a.filter((x) => x.fitsPattern === true)).toHaveLength(1);
    expect(a.find((x) => x.answer === 'EBB')!.fitsPattern).toBe(false);
  });

  it('ranks by letter hits without filtering anything out', () => {
    const a = mapAnswers(rows, { query: 'tide', letters: 'PA' });
    expect(a.map((x) => x.answer)).toEqual(['NEAP', 'RIPCURRENT', 'EBB', 'FLOW']);
    expect(a.map((x) => x.letterHits)).toEqual([2, 1, 0, 0]);
    expect(a.every((x) => x.fitsPattern === null)).toBe(true);
  });

  it('caps at 24', () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ word: `w${i}x`.replace(/\d/g, (d) => 'abcdefghij'[+d]!), score: 40 - i }));
    expect(mapAnswers(many, { query: 'x' })).toHaveLength(24);
  });
});
