import type { SearchLink } from '../contract';

export function buildLinks(query: string, hasReference: boolean): SearchLink[] {
  const q = encodeURIComponent(query);
  const links: SearchLink[] = [
    { label: 'Wordplays', url: `https://www.wordplays.com/crossword-solver/${q}` },
    { label: 'Google', url: `https://www.google.com/search?q=${encodeURIComponent(query + ' crossword clue')}` },
    { label: 'DuckDuckGo', url: `https://duckduckgo.com/?q=${q}` },
  ];
  if (!hasReference) links.push({ label: 'Wikipedia', url: `https://en.wikipedia.org/w/index.php?search=${q}` });
  return links;
}
