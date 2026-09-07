import type { Definition, DefinitionProvider, Sense } from '../contract';
import { fetchJson, NotFound } from '../http';

export interface DictEntry {
  word: string;
  phonetic?: string;
  phonetics?: { text?: string; audio?: string }[];
  meanings?: {
    partOfSpeech?: string;
    definitions?: { definition: string; example?: string; synonyms?: string[] }[];
  }[];
  sourceUrls?: string[];
}

export const NAME = 'Free Dictionary';
export const MAX_SENSES = 6;

export function buildUrl(query: string): string {
  return `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(query)}`;
}

export function mapDefinition(entries: DictEntry[]): Definition | null {
  const e = entries[0];
  if (!e) return null;
  const senses: Sense[] = [];
  for (const m of e.meanings ?? []) {
    for (const d of m.definitions ?? []) {
      if (!d.definition) continue;
      senses.push({
        partOfSpeech: abbrev(m.partOfSpeech),
        definition: d.definition,
        example: d.example || undefined,
        synonyms: d.synonyms?.length ? d.synonyms.slice(0, 5) : undefined,
      });
      if (senses.length >= MAX_SENSES) break;
    }
    if (senses.length >= MAX_SENSES) break;
  }
  if (!senses.length) return null;
  return {
    term: e.word,
    phonetic: e.phonetic || e.phonetics?.find((p) => p.text)?.text || undefined,
    audioUrl: e.phonetics?.find((p) => p.audio)?.audio || undefined,
    senses,
    source: 'dictionaryapi',
    sourceUrl: e.sourceUrls?.[0],
  };
}

export function abbrev(pos?: string): string | undefined {
  if (!pos) return undefined;
  const map: Record<string, string> = {
    noun: 'n.', verb: 'v.', adjective: 'adj.', adverb: 'adv.', pronoun: 'pron.', preposition: 'prep.',
    conjunction: 'conj.', interjection: 'interj.', 'proper noun': 'prop. n.', determiner: 'det.', numeral: 'num.',
  };
  return map[pos.toLowerCase()] ?? pos;
}

export const dictionaryapi: DefinitionProvider = {
  name: NAME,
  async fetch(req, signal) {
    try {
      return mapDefinition(await fetchJson<DictEntry[]>(NAME, buildUrl(req.query), signal));
    } catch (e) {
      if (e instanceof NotFound) return null;
      throw e;
    }
  },
};
