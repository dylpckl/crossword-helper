import { describe, expect, it } from 'vitest';
import { buildLinks } from '../src/providers/links';

describe('links', () => {
  it('always has the three search links and adds wikipedia when there is no card', () => {
    expect(buildLinks('big apple', true).map((l) => l.label)).toEqual(['Wordplays', 'Google', 'DuckDuckGo']);
    const l = buildLinks('big apple', false);
    expect(l.map((x) => x.label)).toContain('Wikipedia');
    expect(l[1]!.url).toContain('big%20apple%20crossword%20clue');
  });
});
