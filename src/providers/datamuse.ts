import type { Answer, AnswerProvider, SolveRequest } from '../contract';
import { fetchJson } from '../http';
import { toDatamuseSp, toGrid } from '../pattern';
import { rankAnswers } from '../rank';

export interface DatamuseWord {
  word: string;
  score?: number;
  tags?: string[];
  defs?: string[];
}

const BASE = 'https://api.datamuse.com/words';
/** Datamuse mixes internal markers (f:1.2, results_type:…) into tags; only these are parts of speech. */
const POS_TAGS = new Set(['n', 'v', 'adj', 'adv', 'prop', 'u']);
export const NAME = 'Datamuse';

export function buildUrls(req: SolveRequest): string[] {
  const ml = encodeURIComponent(req.query);
  const urls = [`${BASE}?ml=${ml}&md=dpf&max=60`];
  const sp = toDatamuseSp(req);
  if (sp) urls.push(`${BASE}?ml=${ml}&sp=${encodeURIComponent(sp)}&md=dpf&max=30`);
  return urls;
}

/** Pure mapper from raw Datamuse rows to contract Answers. Exported for tests. */
export function mapAnswers(rows: DatamuseWord[], req: SolveRequest): Answer[] {
  const max = rows.reduce((m, r) => Math.max(m, r.score ?? 0), 0) || 1;
  const seen = new Map<string, Answer>();
  for (const r of rows) {
    if (!r.word) continue;
    const answer = toGrid(r.word);
    if (!answer) continue;
    const tags = (r.tags ?? []).filter((t) => POS_TAGS.has(t));
    const def = r.defs?.[0]?.split('\t').pop()?.trim();
    const candidate: Answer = {
      answer,
      display: r.word,
      length: answer.length,
      score: Math.min(1, (r.score ?? 0) / max),
      rawScore: r.score,
      fitsPattern: null,
      gloss: def || undefined,
      partOfSpeech: tags.length ? tags : undefined,
      source: 'datamuse',
    };
    const prev = seen.get(answer);
    if (!prev || candidate.score > prev.score) seen.set(answer, { ...candidate, gloss: candidate.gloss ?? prev?.gloss });
  }
  return rankAnswers([...seen.values()], req).slice(0, 24);
}

export const datamuse: AnswerProvider = {
  name: NAME,
  async fetch(req, signal) {
    const results = await Promise.all(buildUrls(req).map((u) => fetchJson<DatamuseWord[]>(NAME, u, signal)));
    return mapAnswers(results.flat(), req);
  },
};
