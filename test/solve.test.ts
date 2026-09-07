import { beforeEach, describe, expect, it, vi } from 'vitest';
import datamuseRows from './fixtures/datamuse-tide.json';
import dictEntries from './fixtures/dictionaryapi-tide.json';
import wikiSummary from './fixtures/wikipedia-tide.json';
import { buildRequest, isBuildError, solve } from '../src/solve';
import { getCached } from '../src/store';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('buildRequest', () => {
  it('normalizes whitespace and attaches the constraint', () => {
    expect(buildRequest('  ocean   current ', 'sc?d?')).toEqual({ query: 'ocean current', pattern: 'SC?D?', length: 5 });
  });
  it('carries letters as a soft constraint', () => {
    expect(buildRequest('tide', 'sc')).toEqual({ query: 'tide', letters: 'SC' });
  });
  it('surfaces validation errors', () => {
    expect(buildRequest('', '')).toEqual({ error: 'Type a word or phrase first' });
    const r = buildRequest('x', 'a1');
    expect(isBuildError(r) && r.error).toMatch(/"1"/);
  });
});

describe('solve', () => {
  beforeEach(() => localStorage.clear());

  it('fans out, assembles a SolveResult, and caches it', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('datamuse')) return json(datamuseRows);
      if (url.includes('dictionaryapi')) return json(dictEntries);
      if (url.includes('wikipedia')) return json(wikiSummary);
      if (url.includes('wiktionary')) return json({}, 404);
      return json({}, 500);
    });
    vi.stubGlobal('fetch', fetchMock);
    const req = { query: 'tide' };
    const events: string[] = [];
    const r = await solve(req, new AbortController().signal, {
      answers: () => events.push('answers'),
      definition: () => events.push('definition'),
      reference: () => events.push('reference'),
      done: () => events.push('done'),
    });
    expect(events.sort()).toEqual(['answers', 'definition', 'done', 'reference']);
    expect(r.answers[0]!.answer).toBe('EBB');
    expect(r.definition!.source).toBe('dictionaryapi');
    expect(r.reference!.title).toBe('Tide');
    expect(r.links.map((l) => l.label)).toEqual(['Wordplays', 'Google', 'DuckDuckGo']);
    expect(r.errors).toEqual([]);
    // Datamuse, Free Dictionary, Wikipedia, and Wiktionary twice: its 404 on the
    // lowercase entry triggers the title-cased retry.
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(getCached(req)!.answers).toHaveLength(r.answers.length);

    // Same query with letters hits the cache and is re-ranked, no fetch.
    fetchMock.mockClear();
    const r2 = await solve({ query: 'tide', letters: 'PA' }, new AbortController().signal, { done: () => {} });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(r2.fromCache).toBe(true);
    expect(r2.answers[0]!.answer).toBe('NEAP');
    vi.unstubAllGlobals();
  });

  it('uses wiktionary when free dictionary stalls, without surfacing an error', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('datamuse')) return json(datamuseRows);
      if (url.includes('dictionaryapi')) return json({}, 502);
      if (url.includes('wiktionary')) return json({ en: [{ partOfSpeech: 'Noun', definitions: [{ definition: 'x' }] }] });
      return json({}, 404);
    }));
    const r = await solve({ query: 'q' }, new AbortController().signal, { done: () => {} });
    expect(r.definition!.source).toBe('wiktionary');
    expect(r.errors).toEqual([]);
    vi.unstubAllGlobals();
  });

  it('falls back to wiktionary on a dictionary 404 and records partial failures without caching', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('datamuse')) return json({ error: 'nope' }, 503);
      if (url.includes('dictionaryapi')) return json({ title: 'No Definitions Found' }, 404);
      if (url.includes('wiktionary')) return json({ en: [{ partOfSpeech: 'Noun', definitions: [{ definition: 'x' }] }] });
      if (url.includes('wikipedia')) return json({}, 404);
      return json({}, 500);
    }));
    const req = { query: 'zzz' };
    const r = await solve(req, new AbortController().signal, { done: () => {} });
    expect(r.answers).toEqual([]);
    expect(r.definition!.source).toBe('wiktionary');
    expect(r.reference).toBeNull();
    expect(r.links.map((l) => l.label)).toContain('Wikipedia');
    expect(r.errors).toEqual([{ provider: 'Datamuse', kind: 'http', message: 'Datamuse returned 503', status: 503 }]);
    expect(getCached(req)).toBeNull();
    vi.unstubAllGlobals();
  });
});
