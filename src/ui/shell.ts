/** App bar + left drawer. Views register by id; the shell only swaps visibility. */
export type ViewId = 'solver' | 'diagnostics' | 'settings' | 'about';

const NAV: { id: ViewId; label: string; icon: string }[] = [
  { id: 'solver', label: 'Solver', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/></svg>' },
  { id: 'diagnostics', label: 'API status', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3 12h4l3-8 4 16 3-8h4"/></svg>' },
  { id: 'settings', label: 'Settings', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/></svg>' },
  { id: 'about', label: 'About', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>' },
];

export interface Shell {
  root: HTMLElement;
  views: Record<ViewId, HTMLElement>;
  show(id: ViewId): void;
  setOnline(online: boolean): void;
  toast(msg: string, action?: { label: string; onClick: () => void }): void;
}

export function mountShell(app: HTMLElement, version: string): Shell {
  app.innerHTML = `
    <header class="appbar">
      <button class="iconbtn" id="menuBtn" aria-label="Menu" aria-controls="drawer" aria-expanded="false">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
      </button>
      <h1>Clue Solver</h1>
      <span class="status-dot" id="onlineDot" title="Online"></span>
    </header>
    <div class="scrim" id="scrim"></div>
    <nav class="drawer" id="drawer" aria-label="Main">
      <div class="brand">Clue Solver<small>Crossword answers and meanings</small></div>
      ${NAV.map((n) => `<button class="navbtn" data-view="${n.id}">${n.icon}${n.label}</button>`).join('')}
      <div class="foot">v${version}</div>
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
    setOnline(online) {
      const dot = $('onlineDot');
      dot.classList.toggle('off', !online);
      dot.title = online ? 'Online' : 'Offline';
    },
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
