import { clearCache, clearHistory, getSettings, saveSettings, type Theme } from '../store';

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
      <div class="setting"><div><div class="label">Theme</div><div class="sub">System follows your phone.</div></div>
        <div class="seg" role="group" aria-label="Theme">${(['system', 'light', 'dark'] as Theme[])
          .map((t) => `<button data-theme="${t}" aria-pressed="${s.theme === t}">${t[0]!.toUpperCase() + t.slice(1)}</button>`)
          .join('')}</div></div>
      <div class="setting"><div><div class="label">Search as you type</div><div class="sub">Solves after a short pause. Uses more of the free quota.</div></div>
        <button class="switch" role="switch" aria-checked="${s.liveSearch}" data-key="liveSearch" aria-label="Search as you type"></button></div>
      <div class="setting"><div><div class="label">Recent searches</div><div class="sub">Stored only on this device.</div></div>
        <button class="btn danger" data-action="clearHistory">Clear</button></div>
      <div class="setting"><div><div class="label">Cached results</div><div class="sub">Lets past lookups work offline.</div></div>
        <button class="btn danger" data-action="clearCache">Clear</button></div>`;
  }

  view.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('button');
    if (!t) return;
    if (t.dataset.theme) { applyTheme(saveSettings({ theme: t.dataset.theme as Theme }).theme); render(); }
    else if (t.dataset.key === 'liveSearch') { saveSettings({ liveSearch: !getSettings().liveSearch }); render(); onChange(); }
    else if (t.dataset.action === 'clearHistory') { clearHistory(); onChange(); toast('Recent searches cleared'); }
    else if (t.dataset.action === 'clearCache') { clearCache(); toast('Cached results cleared'); }
  });
  const toast = (msg: string) => view.dispatchEvent(new CustomEvent('toast', { bubbles: true, detail: msg }));
  render();
}

export function mountAbout(view: HTMLElement, version: string) {
  view.innerHTML = `<div class="about-page"><h2 class="page">About</h2>
    <p class="lead">Type a word or phrase. Clue Solver treats it as a crossword clue and lists likely answers as letter tiles, then shows what it means.</p>
    <p>Type letters you already have to rank answers that contain them, or a pattern like <code>SC?D?</code> to match by position. Tap an answer to copy it, hold one to look it up.</p>
    <p>The thin bar beside each answer is relevance relative to the top answer for that clue. Datamuse scores are only meaningful within one list, so the bar is never a percentage of certainty.</p>
    <p>Answers come from Datamuse. Definitions come from the Free Dictionary API and Wiktionary. Summaries come from Wikipedia. Nothing you type is sent anywhere else, and no account is needed.</p>
    <dl><dt>Version</dt><dd>${version}</dd><dt>Source</dt><dd><a href="https://github.com/dylpckl/crossword-helper" target="_blank" rel="noopener">github.com/dylpckl/crossword-helper</a></dd></dl>
  </div>`;
}
