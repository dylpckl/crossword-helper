import { describe, expect, it } from 'vitest';
import res from '../fixtures/wikipedia-tide.json';
import { buildUrl, isRelevant, mapReference, titleCase, truncate } from '../../src/providers/wikipedia';

describe('wikipedia', () => {
  it('title-cases and underscores', () => {
    expect(titleCase('rip current')).toBe('Rip_current');
    expect(buildUrl('big apple')).toBe('https://en.wikipedia.org/api/rest_v1/page/summary/Big_apple?redirect=true');
  });
  it('truncates at a sentence boundary', () => {
    const t = truncate(res.extract);
    expect(t.length).toBeLessThanOrEqual(400);
    expect(t.endsWith('.')).toBe(true);
  });
  it('maps summary to reference, preferring the mobile url', () => {
    const r = mapReference(res, 'tide')!;
    expect(r).toMatchObject({ title: 'Tide', kind: 'standard', source: 'wikipedia', url: 'https://en.m.wikipedia.org/wiki/Tide' });
    expect(r.thumbnailUrl).toMatch(/^https:\/\/upload\.wikimedia\.org/);
  });
  it('keeps pages whose title or lead sentence names the query', () => {
    expect(isRelevant('Big Apple', 'The Big Apple is a nickname for New York City.', 'big apple')).toBe(true);
    expect(isRelevant('New York City', 'New York, often called New York City or simply NYC, is the most populous city in the United States.', 'nyc')).toBe(true);
  });

  it('rejects a redirect that landed somewhere unrelated', () => {
    const anthem = {
      type: 'standard',
      title: 'National Anthem of Saudi Arabia',
      extract: 'The national anthem of Saudi Arabia was first officially adopted in 1950 without lyrics. The piece was gifted by King Farouk of Egypt.',
      content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/National_Anthem_of_Saudi_Arabia' } },
    };
    expect(isRelevant(anthem.title, anthem.extract, 'hasten')).toBe(false);
    expect(mapReference(anthem, 'hasten')).toBeNull();
  });

  it('flags disambiguation and rejects other page types', () => {
    expect(mapReference({ ...res, type: 'disambiguation' }, 'tide')!.kind).toBe('disambiguation');
    expect(mapReference({ ...res, type: 'no-extract' }, 'tide')).toBeNull();
  });
});
