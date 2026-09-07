import { clearCache, clearHistory, getSettings, saveSettings, type ResultOrder, type Theme } from '../store';
import { AUTHOR_URL, COMMIT, DONATE_URL, REPO_URL } from './shell';

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.classList.toggle('dark-system', theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
}

export function mountSettings(view: HTMLElement, onChange: () => void) {
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme(getSettings().theme));

  function render() {
    const s = getSettings();
    view.innerHTML = `<h2 class="page">Settings</h2>
      <div class="setting"><div class="text"><div class="label">Theme</div><div class="sub">System follows your phone.</div></div>
        <div class="seg" role="group" aria-label="Theme">${(['system', 'light', 'dark'] as Theme[])
          .map((t) => `<button data-theme="${t}" aria-pressed="${s.theme === t}">${t[0]!.toUpperCase() + t.slice(1)}</button>`)
          .join('')}</div></div>
      <div class="setting"><div class="text"><div class="label">Result order</div><div class="sub">${
        s.resultOrder === 'auto'
          ? 'Guesses whether you typed a word or a clue, and leads with the more useful section.'
          : 'You choose. A Clue / Word control sits under the search box.'
      }</div></div>
        <div class="seg" role="group" aria-label="Result order">${(['auto', 'manual'] as ResultOrder[])
          .map((o) => `<button data-order="${o}" aria-pressed="${s.resultOrder === o}">${o === 'auto' ? 'Auto' : 'Manual'}</button>`)
          .join('')}</div></div>
      <div class="setting"><div class="text"><div class="label">Search as you type</div><div class="sub">Solves after a short pause. Uses more of the free quota.</div></div>
        <button class="switch" role="switch" aria-checked="${s.liveSearch}" data-key="liveSearch" aria-label="Search as you type"></button></div>
      <div class="setting"><div class="text"><div class="label">Recent searches</div><div class="sub">Stored only on this device.</div></div>
        <button class="btn danger" data-action="clearHistory">Clear</button></div>
      <div class="setting"><div class="text"><div class="label">Cached results</div><div class="sub">Lets past lookups work offline.</div></div>
        <button class="btn danger" data-action="clearCache">Clear</button></div>`;
  }

  view.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('button');
    if (!t) return;
    if (t.dataset.theme) { applyTheme(saveSettings({ theme: t.dataset.theme as Theme }).theme); render(); }
    else if (t.dataset.order) { saveSettings({ resultOrder: t.dataset.order as ResultOrder }); render(); onChange(); }
    else if (t.dataset.key === 'liveSearch') { saveSettings({ liveSearch: !getSettings().liveSearch }); render(); onChange(); }
    else if (t.dataset.action === 'clearHistory') { clearHistory(); onChange(); toast('Recent searches cleared'); }
    else if (t.dataset.action === 'clearCache') { clearCache(); toast('Cached results cleared'); }
  });
  const toast = (msg: string) => view.dispatchEvent(new CustomEvent('toast', { bubbles: true, detail: msg }));
  render();
}

export function mountAbout(view: HTMLElement) {
  view.innerHTML = `<div class="about-page"><h2 class="page">About</h2>
    <p class="lead">Type a word or phrase. Crosscheck treats it as a crossword clue and lists likely answers as letter tiles, then shows what it means.</p>
    <p>Type letters you already have to rank answers that contain them, or a pattern like <code>SC?D?</code> to match by position. Tap an answer to copy it, hold one to look it up.</p>
    <p>If your input is a word the dictionary knows, its meaning comes first and the crossword answers are tucked below. If it reads like a clue, the answers come first. Use “Show as clue” or “Show as word” in the section header to flip it, or switch Result order to Manual in Settings to choose every time.</p>
    <p>The About card is a Wikipedia summary of what you typed, shown when there is a page that clearly matches.</p>
    <p>Answers are ordered by how well Datamuse thinks they match the clue, best first.</p>
    <p>Answers come from Datamuse. Definitions come from the Free Dictionary API and Wiktionary. Summaries come from Wikipedia. Nothing you type is sent anywhere else, and no account is needed.</p>
    <p>Built by <a href="${AUTHOR_URL}" target="_blank" rel="noopener">Dylan Smith</a>.</p>
    <p>Crosscheck is free and has no ads. If it helps you finish a puzzle, you can <a href="${DONATE_URL}" target="_blank" rel="noopener">buy me a coffee</a>.</p>
    <dl><dt>Build</dt><dd><a href="${REPO_URL}/commit/${COMMIT}" target="_blank" rel="noopener">${COMMIT}</a></dd>
      <dt>Source</dt><dd><a href="${REPO_URL}" target="_blank" rel="noopener">github.com/dylpckl/crossword-helper</a></dd>
      <dt>Site</dt><dd><a href="${AUTHOR_URL}" target="_blank" rel="noopener">dylansmith.dev</a></dd></dl>
  </div>`;
}
