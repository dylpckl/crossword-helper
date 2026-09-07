/**
 * API status: hits every upstream endpoint from this origin and reports
 * status, latency, and whether the browser let the response through (CORS).
 * This is milestone 1 from SPEC.md, kept in the app so it can be re-run
 * from any deployment.
 */
import { buildUrls as datamuseUrls } from '../providers/datamuse';
import { buildUrl as dictUrl } from '../providers/dictionaryapi';
import { buildUrl as wikiUrl } from '../providers/wikipedia';
import { buildUrl as wiktUrl, USER_AGENT } from '../providers/wiktionary';
import { esc } from '../render/util';

const SAMPLE = 'tide';

interface Check {
  name: string;
  url: string;
  headers?: Record<string, string>;
  summarize: (json: unknown) => string;
}

const CHECKS: Check[] = [
  { name: 'Datamuse · means-like', url: datamuseUrls({ query: SAMPLE })[0]!, summarize: (j) => `${(j as unknown[]).length} words, first “${(j as { word: string }[])[0]?.word}”` },
  { name: 'Datamuse · pattern', url: datamuseUrls({ query: SAMPLE, pattern: '?B?', length: 3 })[1]!, summarize: (j) => `${(j as unknown[]).length} words: ${(j as { word: string }[]).slice(0, 5).map((w) => w.word).join(', ')}` },
  { name: 'Free Dictionary', url: dictUrl(SAMPLE), summarize: (j) => `${(j as { meanings?: unknown[] }[])[0]?.meanings?.length ?? 0} meanings` },
  { name: 'Wiktionary', url: wiktUrl(SAMPLE), headers: { 'Api-User-Agent': USER_AGENT }, summarize: (j) => `${(j as { en?: unknown[] }).en?.length ?? 0} part-of-speech blocks` },
  { name: 'Wikipedia summary', url: wikiUrl(SAMPLE), headers: { 'Api-User-Agent': USER_AGENT }, summarize: (j) => `“${(j as { title?: string }).title}”, ${(j as { extract?: string }).extract?.length ?? 0} chars` },
  { name: 'Wikipedia opensearch', url: `https://en.wikipedia.org/w/api.php?action=opensearch&search=${SAMPLE}&limit=5&format=json&origin=*`, summarize: (j) => `${((j as unknown[])[1] as string[]).length} suggestions` },
];

type Light = 'idle' | 'run' | 'ok' | 'warn' | 'bad';
interface Row { check: Check; light: Light; ms?: number; detail: string }

export function mountDiagnostics(view: HTMLElement) {
  let rows: Row[] = CHECKS.map((check) => ({ check, light: 'idle', detail: '' }));
  let running = false;

  function env(): string {
    const nav = navigator as Navigator & { standalone?: boolean };
    const standalone = matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
    return `<dl class="env">
      <dt>Origin</dt><dd>${esc(location.origin)}</dd>
      <dt>Online</dt><dd>${navigator.onLine ? 'yes' : 'no'}</dd>
      <dt>Installed</dt><dd>${standalone ? 'yes (standalone)' : 'no (browser tab)'}</dd>
      <dt>Service worker</dt><dd id="swState">checking…</dd>
      <dt>User agent</dt><dd>${esc(navigator.userAgent.replace(/^Mozilla\/5\.0 /, ''))}</dd>
    </dl>`;
  }

  function render() {
    view.innerHTML = `<h2 class="page">API status</h2>
      <p class="lead">Each check calls a real endpoint from this page's origin. A red “Failed to fetch” with the network up almost always means the browser blocked the response (CORS) or a content blocker got in the way.</p>
      ${env()}
      <div class="btnrow"><button class="btn primary" id="runAll" ${running ? 'disabled' : ''}>${running ? 'Running…' : 'Run all checks'}</button><button class="btn" id="copyReport">Copy report</button></div>
      <div class="diag">${rows
        .map(
          (r) => `<div class="check"><span class="light ${r.light}"></span><span class="name">${esc(r.check.name)}</span><span class="ms">${r.ms != null ? `${r.ms} ms` : ''}</span>
            <span class="detail">${r.detail ? esc(r.detail) + '<br>' : ''}<code>${esc(r.check.url)}</code></span></div>`,
        )
        .join('')}</div>`;
    view.querySelector('#runAll')!.addEventListener('click', runAll);
    view.querySelector('#copyReport')!.addEventListener('click', copy);
    swState();
  }

  async function swState() {
    const el = view.querySelector('#swState');
    if (!el) return;
    if (!('serviceWorker' in navigator)) { el.textContent = 'unsupported'; return; }
    const reg = await navigator.serviceWorker.getRegistration();
    el.textContent = reg ? (reg.active ? 'active' : reg.installing ? 'installing' : 'registered') : 'not registered';
  }

  async function runOne(r: Row) {
    r.light = 'run'; r.detail = ''; r.ms = undefined; render();
    const t0 = performance.now();
    try {
      const res = await fetch(r.check.url, { headers: r.check.headers, signal: AbortSignal.timeout(10000) });
      r.ms = Math.round(performance.now() - t0);
      const text = await res.text();
      let json: unknown;
      try { json = JSON.parse(text); } catch { json = undefined; }
      if (!res.ok) { r.light = res.status === 404 ? 'warn' : 'bad'; r.detail = `HTTP ${res.status}: ${text.slice(0, 120)}`; }
      else if (json === undefined) { r.light = 'bad'; r.detail = `HTTP ${res.status} but body isn't JSON: ${text.slice(0, 80)}`; }
      else { r.light = 'ok'; r.detail = `HTTP ${res.status} · ${r.check.summarize(json)}`; }
    } catch (e) {
      r.ms = Math.round(performance.now() - t0);
      r.light = 'bad';
      const err = e as Error;
      r.detail = err.name === 'TimeoutError' ? 'Timed out after 10s' : `${err.name}: ${err.message} (blocked by CORS, a content blocker, or no network)`;
    }
    render();
  }

  async function runAll() {
    if (running) return;
    running = true;
    await Promise.all(rows.map(runOne));
    running = false;
    render();
  }

  function copy() {
    const lines = [
      `Crosscheck API status — ${new Date().toISOString()}`,
      `origin: ${location.origin}`,
      `ua: ${navigator.userAgent}`,
      ...rows.map((r) => `${r.light.toUpperCase().padEnd(4)} ${r.ms != null ? String(r.ms).padStart(5) + 'ms' : '     --'}  ${r.check.name}: ${r.detail || 'not run'}`),
    ];
    navigator.clipboard?.writeText(lines.join('\n')).catch(() => {});
    view.dispatchEvent(new CustomEvent('toast', { bubbles: true, detail: 'Report copied' }));
  }

  view.addEventListener('view:show', () => { if (!running && rows.every((r) => r.light === 'idle')) runAll(); else render(); });
  render();
}
