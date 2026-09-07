/** App bar + left drawer. Views register by id; the shell only swaps visibility. */
export type ViewId = 'solver' | 'diagnostics' | 'settings' | 'about';

const NAV: { id: ViewId; label: string; icon: string }[] = [
  { id: 'solver', label: 'Solver', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/></svg>' },
  { id: 'diagnostics', label: 'API status', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3 12h4l3-8 4 16 3-8h4"/></svg>' },
  { id: 'settings', label: 'Settings', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/></svg>' },
  { id: 'about', label: 'About', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>' },
];

export const DONATE_URL = 'https://paypal.me/askdyl';
export const REPO_URL = 'https://github.com/dylpckl/crossword-helper';
export const AUTHOR_URL = 'https://www.dylansmith.dev';
export const COMMIT = __APP_COMMIT__;

export interface Shell {
  root: HTMLElement;
  views: Record<ViewId, HTMLElement>;
  show(id: ViewId): void;
  toast(msg: string, action?: { label: string; onClick: () => void }): void;
}

export function mountShell(app: HTMLElement): Shell {
  app.innerHTML = `
    <header class="appbar">
      <button class="iconbtn" id="menuBtn" aria-label="Menu" aria-controls="drawer" aria-expanded="false">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
      </button>
      <h1>Crosscheck</h1>
    </header>
    <div class="scrim" id="scrim"></div>
    <nav class="drawer" id="drawer" aria-label="Main">
      <div class="brand">Crosscheck<small>Crossword answers and word meanings</small></div>
      ${NAV.map((n) => `<button class="navbtn" data-view="${n.id}">${n.icon}${n.label}</button>`).join('')}
      <div class="foot">
        <a class="footlink" href="${REPO_URL}" target="_blank" rel="noopener">
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.9 1.53 2.35 1.09 2.92.83.09-.65.35-1.09.63-1.34-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02A9.6 9.6 0 0 1 12 6.84c.85 0 1.71.11 2.51.34 1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2z"/></svg>
          GitHub
        </a>
        <a class="footlink" href="${DONATE_URL}" target="_blank" rel="noopener">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 8h1a4 4 0 0 1 0 8h-1M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z"/><path d="M6 2v2M10 2v2M14 2v2"/></svg>
          Buy me a coffee
        </a>
        <a class="build" href="${REPO_URL}/commit/${COMMIT}" target="_blank" rel="noopener" title="Open this build's commit">Build ${COMMIT}</a>
      </div>
    </nav>
    ${NAV.map((n) => `<main class="view" id="view-${n.id}" hidden></main>`).join('')}
    <div class="toast" id="toast" role="status" aria-live="polite"></div>`;

  const $ = <T extends HTMLElement>(id: string) => app.querySelector<T>(`#${id}`)!;
  const drawer = $('drawer'), scrim = $('scrim'), menuBtn = $<HTMLButtonElement>('menuBtn');
  const views = Object.fromEntries(NAV.map((n) => [n.id, $(`view-${n.id}`)])) as Record<ViewId, HTMLElement>;

  const setOpen = (open: boolean) => {
    drawer.classList.toggle('open', open);
    scrim.classList.toggle('open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    if (open) drawer.querySelector<HTMLElement>('.navbtn[aria-current]')?.focus();
  };
  menuBtn.addEventListener('click', () => setOpen(!drawer.classList.contains('open')));
  scrim.addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', (e) => e.key === 'Escape' && setOpen(false));
  drawer.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('.navbtn');
    if (!b) return;
    show(b.dataset.view as ViewId);
    setOpen(false);
  });

  let toastTimer: number | undefined;
  const toastEl = $('toast');

  function show(id: ViewId) {
    for (const n of NAV) {
      views[n.id].hidden = n.id !== id;
      const b = drawer.querySelector(`.navbtn[data-view="${n.id}"]`)!;
      if (n.id === id) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    }
    if (location.hash !== `#${id}` && !(id === 'solver' && !location.hash)) history.replaceState(null, '', id === 'solver' ? location.pathname + location.search : `#${id}`);
    window.scrollTo({ top: 0 });
    views[id].dispatchEvent(new CustomEvent('view:show'));
  }

  return {
    root: app,
    views,
    show,
    toast(msg, action) {
      toastEl.innerHTML = '';
      toastEl.append(msg);
      toastEl.classList.toggle('action', Boolean(action));
      if (action) {
        const b = document.createElement('button');
        b.textContent = action.label;
        b.addEventListener('click', () => { action.onClick(); toastEl.classList.remove('show'); });
        toastEl.append(b);
      }
      toastEl.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = window.setTimeout(() => toastEl.classList.remove('show'), action ? 8000 : 1600);
    },
  };
}
