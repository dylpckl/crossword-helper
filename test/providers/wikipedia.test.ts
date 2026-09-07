import { describe, expect, it } from 'vitest';
import res from '../fixtures/wikipedia-tide.json';
import { buildUrl, mapReference, titleCase, truncate } from '../../src/providers/wikipedia';

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
  it('flags disambiguation and rejects other page types', () => {
    expect(mapReference({ ...res, type: 'disambiguation' }, 'tide')!.kind).toBe('disambiguation');
    expect(mapReference({ ...res, type: 'no-extract' }, 'tide')).toBeNull();
  });
});
