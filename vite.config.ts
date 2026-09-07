import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

// GitHub Pages serves project sites under /<repo>/. The deploy workflow sets
// BASE_PATH; local dev and other hosts default to '/'.
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  build: { target: 'es2022', sourcemap: true },
  test: { environment: 'jsdom' },
  plugins: [
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icons/apple-touch-icon.png', 'icons/favicon.svg'],
      manifest: {
        name: 'Clue Solver',
        short_name: 'Clues',
        description: 'Type a word or phrase, get crossword answers and its meaning.',
        start_url: `${base}?source=pwa`,
        scope: base,
        display: 'standalone',
        background_color: '#EFE9DD',
        theme_color: '#2B4C7E',
        icons: [
          { src: 'icons/192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        share_target: { action: base, method: 'GET', params: { text: 'q' } },
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        navigateFallback: `${base}index.html`,
        runtimeCaching: [
          rt(/^https:\/\/api\.datamuse\.com\//, 'api-datamuse', 7),
          rt(/^https:\/\/api\.dictionaryapi\.dev\//, 'api-dict', 30),
          rt(/^https:\/\/en\.wiktionary\.org\/api\//, 'api-dict', 30),
          rt(/^https:\/\/en\.wikipedia\.org\/(api|w)\//, 'api-wiki', 30),
          {
            urlPattern: /^https:\/\/upload\.wikimedia\.org\//,
            handler: 'CacheFirst',
            options: { cacheName: 'img', expiration: { maxEntries: 50, maxAgeSeconds: 30 * 86400 } },
          },
        ],
      },
    }),
  ],
});

function rt(urlPattern: RegExp, cacheName: string, days: number) {
  return {
    urlPattern,
    handler: 'StaleWhileRevalidate' as const,
    options: {
      cacheName,
      expiration: { maxEntries: 100, maxAgeSeconds: days * 86400 },
      cacheableResponse: { statuses: [0, 200, 404] },
    },
  };
}
