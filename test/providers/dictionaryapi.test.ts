import { describe, expect, it } from 'vitest';
import entries from '../fixtures/dictionaryapi-tide.json';
import { buildUrl, mapDefinition } from '../../src/providers/dictionaryapi';

describe('dictionaryapi', () => {
  it('encodes the query', () => expect(buildUrl('rip current')).toBe('https://api.dictionaryapi.dev/api/v2/entries/en/rip%20current'));
  it('maps phonetics, audio, senses (capped at 6), and source', () => {
    const d = mapDefinition(entries)!;
    expect(d.term).toBe('tide');
    expect(d.phonetic).toBe('/taɪd/');
    expect(d.audioUrl).toMatch(/tide-us\.mp3$/);
    expect(d.senses).toHaveLength(6);
    expect(d.senses[0]).toMatchObject({ partOfSpeech: 'n.', example: 'the changing patterns of the tides', synonyms: ['ebb', 'flow'] });
    expect(d.senses[1]!.synonyms).toBeUndefined();
    expect(d.senses[3]!.partOfSpeech).toBe('v.');
    expect(d.source).toBe('dictionaryapi');
    expect(d.sourceUrl).toBe('https://en.wiktionary.org/wiki/tide');
  });
  it('returns null for empty input', () => expect(mapDefinition([])).toBeNull());
});
