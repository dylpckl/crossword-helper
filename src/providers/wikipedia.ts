import type { Reference, ReferenceProvider } from '../contract';
import { fetchJson, NotFound } from '../http';
import { USER_AGENT } from './wiktionary';

export interface WikiSummary {
  type?: string;
  title?: string;
  extract?: string;
  thumbnail?: { source?: string };
  content_urls?: { desktop?: { page?: string }; mobile?: { page?: string } };
}

export const NAME = 'Wikipedia';
export const MAX_EXTRACT = 400;

export function titleCase(q: string): string {
  return q.trim().replace(/\s+/g, '_').replace(/^./, (c) => c.toUpperCase());
}

export function buildUrl(query: string): string {
  return `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(titleCase(query))}?redirect=true`;
}

export function truncate(text: string, max = MAX_EXTRACT): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('.'));
  return (end > max * 0.5 ? cut.slice(0, end + 1) : cut.trimEnd() + '…').trim();
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Wikipedia redirects can land far from the query: "Hasten" redirects to the
 * Saudi national anthem, whose English title opens with that word. Accept the
 * page only when the query shows up in its title or its lead sentence, where
 * aliases live ("New York, often called ... or simply NYC, is ..."). A missing
 * card is better than a confidently wrong one; the Wikipedia search link stays
 * in the links row either way.
 */
export function isRelevant(title: string, extract: string, query: string): boolean {
  const q = norm(query);
  if (!q) return false;
  return norm(title).includes(q) || norm(extract.slice(0, 180)).includes(q);
}

export function mapReference(s: WikiSummary, query: string): Reference | null {
  if (!s.title || !s.extract) return null;
  if (s.type && !['standard', 'disambiguation'].includes(s.type)) return null;
  if (!isRelevant(s.title, s.extract, query)) return null;
  const url = s.content_urls?.mobile?.page ?? s.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(titleCase(query))}`;
  return {
    title: s.title,
    extract: truncate(s.extract.replace(/\s+/g, ' ').trim()),
    url,
    thumbnailUrl: s.thumbnail?.source,
    kind: s.type === 'disambiguation' ? 'disambiguation' : 'standard',
    source: 'wikipedia',
  };
}

export const wikipedia: ReferenceProvider = {
  name: NAME,
  async fetch(req, signal) {
    try {
      const res = await fetchJson<WikiSummary>(NAME, buildUrl(req.query), signal, {
        headers: { 'Api-User-Agent': USER_AGENT },
      });
      return mapReference(res, req.query);
    } catch (e) {
      if (e instanceof NotFound) return null;
      throw e;
    }
  },
};
