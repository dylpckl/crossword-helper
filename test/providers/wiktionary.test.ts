import { describe, expect, it } from 'vitest';
import res from '../fixtures/wiktionary-tide.json';
import { buildUrl, mapDefinition, stripHtml } from '../../src/providers/wiktionary';

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
});
