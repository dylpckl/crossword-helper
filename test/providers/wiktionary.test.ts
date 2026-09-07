import { describe, expect, it, vi } from 'vitest';
import res from '../fixtures/wiktionary-tide.json';
import { buildUrl, mapDefinition, stripHtml, titleCased, wiktionary } from '../../src/providers/wiktionary';

describe('wiktionary', () => {
  it('underscores spaces in the url', () => expect(buildUrl('rip current')).toMatch(/definition\/rip_current$/));
  it('strips html', () => expect(stripHtml('A <b>stream</b>, <a href="x">current</a>  or flood.')).toBe('A stream, current or flood.'));
  it('maps and skips empty definitions', () => {
    const d = mapDefinition(res, 'tide')!;
    expect(d.senses.map((s) => s.definition)).toEqual([
      'The periodic change of the sea level, caused by the gravitational pull of the Moon and Sun.',
      'A stream, current or flood.',
      'To cause to float with the tide.',
    ]);
    expect(d.senses[0]!.example).toBe('the changing patterns of the tides');
    expect(d.senses[2]!.partOfSpeech).toBe('v.');
    expect(d.source).toBe('wiktionary');
  });
  it('returns null when there is no english block', () => expect(mapDefinition({}, 'x')).toBeNull());

  it('title-cases only when it would change the query', () => {
    expect(titleCased('big apple')).toBe('Big Apple');
    expect(titleCased('Big Apple')).toBeNull();
  });

  it('retries title-cased because entries are case-sensitive', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith('/Big_Apple')) {
        return new Response(JSON.stringify({ en: [{ partOfSpeech: 'Proper noun', definitions: [{ definition: '(informal) New York City.' }] }] }), { status: 200 });
      }
      return new Response('{}', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const d = await wiktionary.fetch({ query: 'big apple' }, new AbortController().signal);
    expect(d!.term).toBe('Big Apple');
    expect(d!.senses[0]!.definition).toBe('(informal) New York City.');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.unstubAllGlobals();
  });

  it('gives up when neither casing exists', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 404 })));
    expect(await wiktionary.fetch({ query: 'zzz qqq' }, new AbortController().signal)).toBeNull();
    vi.unstubAllGlobals();
  });
});
