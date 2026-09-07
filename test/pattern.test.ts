import { describe, expect, it } from 'vitest';
import { fits, parsePattern, toDatamuseSp, toGrid } from '../src/pattern';

describe('parsePattern', () => {
  it('returns nothing for empty input', () => expect(parsePattern('  ')).toEqual({}));
  it('treats digits as a length', () => expect(parsePattern('5')).toEqual({ length: 5 }));
  it('normalizes unknown markers to ?', () => {
    expect(parsePattern('sc_d.')).toEqual({ pattern: 'SC?D?', length: 5 });
    expect(parsePattern('?I??')).toEqual({ pattern: '?I??', length: 4 });
    expect(parsePattern('r-p*')).toEqual({ pattern: 'R?P?', length: 4 });
  });
  it('strips spaces so multi-word answers match letters-only', () => {
    expect(parsePattern('rip ???????')).toEqual({ pattern: 'RIP???????', length: 10 });
  });
  it('rejects junk characters', () => expect(parsePattern('a1b').error).toMatch(/"1"/));
  it('rejects absurd lengths', () => expect(parsePattern('99').error).toBeDefined());
});

describe('fits', () => {
  it('is null when unconstrained', () => expect(fits('TIDE', {})).toBeNull());
  it('checks length alone', () => {
    expect(fits('TIDE', { length: 4 })).toBe(true);
    expect(fits('TIDES', { length: 4 })).toBe(false);
  });
  it('checks letters', () => {
    expect(fits('TIDE', { pattern: '?I??', length: 4 })).toBe(true);
    expect(fits('EDDY', { pattern: '?I??', length: 4 })).toBe(false);
    expect(fits('RIPCURRENT', { pattern: 'RIP???????', length: 10 })).toBe(true);
  });
});

describe('helpers', () => {
  it('toGrid strips everything but letters', () => expect(toGrid("rock 'n' roll")).toBe('ROCKNROLL'));
  it('toDatamuseSp lowercases patterns and expands lengths', () => {
    expect(toDatamuseSp({ pattern: 'SC?D?' })).toBe('sc?d?');
    expect(toDatamuseSp({ length: 3 })).toBe('???');
    expect(toDatamuseSp({})).toBeUndefined();
  });
});
