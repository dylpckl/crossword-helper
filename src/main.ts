import './styles.css';
import { registerSW } from 'virtual:pwa-register';
import { mountShell, type ViewId } from './ui/shell';
import { mountSolver } from './ui/solver';
import { mountDiagnostics } from './ui/diagnostics';
import { applyTheme, mountSheet } from './ui/sheet';
import { getSettings } from './store';

const VIEWS: ViewId[] = ['solver', 'diagnostics'];

applyTheme(getSettings().theme);

const app = document.getElementById('app')!;
const shell = mountShell(app);
const solver = mountSolver(shell.views.solver, shell);
mountDiagnostics(shell.views.diagnostics);
mountSheet(shell, () => { solver.refreshHistory(); solver.applySettings(); });

// Views raise toasts as bubbling events so they don't need the shell.
app.addEventListener('toast', (e) => shell.toast((e as CustomEvent<string>).detail));

// Route: #diagnostics etc. Default is the solver.
function route() {
  const id = location.hash.slice(1) as ViewId;
  shell.show(VIEWS.includes(id) ? id : 'solver');
}
window.addEventListener('hashchange', route);
route();

// Connectivity changes are announced with a toast; there is no persistent indicator.
window.addEventListener('online', () => shell.toast('Back online'));
window.addEventListener('offline', () => shell.toast("You're offline. Cached results still work."));

// Share target (?q=) and deep links (?q=&p=)
const params = new URLSearchParams(location.search);
const q = params.get('q') ?? params.get('text');
if (q) solver.setQuery(q, params.get('p') ?? '', true);

// Service worker with an explicit update prompt (never reload mid-typing).
const updateSW = registerSW({
  onNeedRefresh() {
    shell.toast('Update available', { label: 'Reload', onClick: () => updateSW(true) });
  },
  onOfflineReady() {
    shell.toast('Ready to work offline');
  },
});

// One-time iOS install hint: Safari has no install prompt.
const nav = navigator as Navigator & { standalone?: boolean };
const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
if (isIos && !nav.standalone && !localStorage.getItem('clues.iosHint')) {
  setTimeout(() => {
    shell.toast('Add to Home Screen from the Share menu to install', { label: 'Got it', onClick: () => localStorage.setItem('clues.iosHint', '1') });
  }, 4000);
}
