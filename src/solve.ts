import type { Answer, Definition, ProviderError, Reference, SolveRequest, SolveResult } from './contract';
import { toProviderError } from './http';
import { parsePattern } from './pattern';
import { datamuse } from './providers/datamuse';
import { dictionaryapi } from './providers/dictionaryapi';
import { buildLinks } from './providers/links';
import { wikipedia } from './providers/wikipedia';
import { wiktionary } from './providers/wiktionary';
import { rankAnswers } from './rank';
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
  if (c.letters) req.letters = c.letters;
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

/**
 * Definition: both dictionaries in parallel. Free Dictionary is preferred
 * (phonetics, audio) but it stalls often, so Wiktionary runs alongside and
 * fills in the moment Free Dictionary fails or comes back empty. An error
 * is only recorded when it cost us a definition.
 */
async function fetchDefinition(req: SolveRequest, signal: AbortSignal, errors: ProviderError[]): Promise<Definition | null> {
  const [primary, fallback] = await Promise.allSettled([dictionaryapi.fetch(req, signal), wiktionary.fetch(req, signal)]);
  if (primary.status === 'fulfilled' && primary.value) return primary.value;
  if (fallback.status === 'fulfilled' && fallback.value) return fallback.value;
  if (primary.status === 'rejected') errors.push(toProviderError(dictionaryapi.name, primary.reason));
  if (fallback.status === 'rejected') errors.push(toProviderError(wiktionary.name, fallback.reason));
  return null;
}

export async function solve(req: SolveRequest, signal: AbortSignal, on: SolveEvents): Promise<SolveResult> {
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  const cachedRaw = getCached(req, { allowStale: offline });
  const cached = cachedRaw && { ...cachedRaw, request: req, answers: rankAnswers(cachedRaw.answers, req) };
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
