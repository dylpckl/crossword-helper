import type { ErrorKind, ProviderError } from './contract';

export const TIMEOUT_MS = 8000;

export class HttpError extends Error implements ProviderError {
  constructor(
    public provider: string,
    public kind: ErrorKind,
    message: string,
    public status?: number,
  ) {
    super(message);
  }
}

/** Sentinel for a clean "not found" so adapters can return null. */
export class NotFound extends Error {}

export function toProviderError(provider: string, err: unknown): ProviderError {
  if (err instanceof HttpError) return { provider, kind: err.kind, message: err.message, status: err.status };
  if (err instanceof DOMException && err.name === 'AbortError') {
    return { provider, kind: 'timeout', message: `${provider} took longer than ${TIMEOUT_MS / 1000}s` };
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { provider, kind: 'offline', message: "You're offline" };
  }
  return { provider, kind: 'network', message: `Couldn't reach ${provider}` };
}

/**
 * fetch + JSON with a timeout tied to the caller's signal.
 * 404 → NotFound (adapters map to null). 429 → ratelimit. Other non-2xx → http.
 */
export async function fetchJson<T>(
  provider: string,
  url: string,
  signal: AbortSignal,
  init: RequestInit = {},
): Promise<T> {
  const ctl = new AbortController();
  const onAbort = () => ctl.abort();
  signal.addEventListener('abort', onAbort, { once: true });
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: ctl.signal });
    if (res.status === 404) throw new NotFound();
    if (res.status === 429) throw new HttpError(provider, 'ratelimit', `${provider} rate limit reached`, 429);
    if (!res.ok) throw new HttpError(provider, 'http', `${provider} returned ${res.status}`, res.status);
    try {
      return (await res.json()) as T;
    } catch {
      throw new HttpError(provider, 'parse', `${provider} sent an unreadable response`, res.status);
    }
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', onAbort);
  }
}
