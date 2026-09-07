import type { Answer, Definition, ProviderError, Reference, SolveRequest, SolveResult } from './contract';
import { toProviderError } from './http';
import { parsePattern } from './pattern';
import { datamuse } from './providers/datamuse';
import { dictionaryapi } from './providers/dictionaryapi';
import { buildLinks } from './providers/links';
import { wikipedia } from './providers/wikipedia';
import { wiktionary } from './providers/wiktionary';
import { getCached, putCached } from './store';

export interface BuildError {
  error: string;
}

/** Normalize raw input into a SolveRequest, or a user-facing validation error. */
export function buildRequest(rawQuery: string, rawPattern = ''): SolveRequest | BuildError {
  const query = rawQuery.trim().replace(/\s+/g, ' ');
  if (!query) return { error: 'Type a word or phrase first' };
  if (query.length > 120) return { error: 'Keep it under 120 characters' };
  const c = parsePattern(rawPattern);
  if (c.error) return { error: c.error };
  const req: SolveRequest = { query };
  if (c.pattern) req.pattern = c.pattern;
  if (c.length) req.length = c.length;
  return req;
}

export function isBuildError(x: SolveRequest | BuildError): x is BuildError {
  return 'error' in x;
}

/** Partial results arrive as each provider settles; `done` fires once with the final assembled result. */
export interface SolveEvents {
  answers?: (a: Answer[]) => void;
  definition?: (d: Definition | null) => void;
  reference?: (r: Reference | null) => void;
  done: (r: SolveResult) => void;
}

/** Definition: Free Dictionary first, Wiktionary when that has nothing or fails. */
async function fetchDefinition(req: SolveRequest, signal: AbortSignal, errors: ProviderError[]): Promise<Definition | null> {
  try {
    const d = await dictionaryapi.fetch(req, signal);
    if (d) return d;
  } catch (e) {
    errors.push(toProviderError(dictionaryapi.name, e));
  }
  try {
    return await wiktionary.fetch(req, signal);
  } catch (e) {
    errors.push(toProviderError(wiktionary.name, e));
    return null;
  }
}

export async function solve(req: SolveRequest, signal: AbortSignal, on: SolveEvents): Promise<SolveResult> {
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  const cached = getCached(req, { allowStale: offline });
  if (cached) {
    on.answers?.(cached.answers);
    on.definition?.(cached.definition);
    on.reference?.(cached.reference);
    on.done(cached);
    return cached;
  }

  const errors: ProviderError[] = [];
  const [answers, definition, reference] = await Promise.all([
    datamuse.fetch(req, signal).then(
      (a) => (on.answers?.(a), a),
      (e) => (errors.push(toProviderError(datamuse.name, e)), on.answers?.([]), [] as Answer[]),
    ),
    fetchDefinition(req, signal, errors).then((d) => (on.definition?.(d), d)),
    wikipedia.fetch(req, signal).then(
      (r) => (on.reference?.(r), r),
      (e) => (errors.push(toProviderError(wikipedia.name, e)), on.reference?.(null), null),
    ),
  ]);

  const result: SolveResult = {
    request: req,
    answers,
    definition,
    reference,
    links: buildLinks(req.query, reference !== null),
    errors,
    fetchedAt: Date.now(),
    fromCache: false,
  };
  // Only cache results that actually came back; an all-errors result would poison the cache.
  if (!signal.aborted && errors.length === 0) putCached(req, result);
  on.done(result);
  return result;
}
