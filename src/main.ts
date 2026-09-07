import './styles.css';
import { registerSW } from 'virtual:pwa-register';
import { mountShell, type ViewId } from './ui/shell';
import { mountSolver } from './ui/solver';
import { mountDiagnostics } from './ui/diagnostics';
import { applyTheme, mountAbout, mountSettings } from './ui/settings';
import { getSettings } from './store';

const VERSION = __APP_VERSION__;
const VIEWS: ViewId[] = ['solver', 'diagnostics', 'settings', 'about'];

applyTheme(getSettings().theme);

const app = document.getElementById('app')!;
const shell = mountShell(app, VERSION);
const solver = mountSolver(shell.views.solver, shell);
mountDiagnostics(shell.views.diagnostics);
mountSettings(shell.views.settings, () => solver.refreshHistory());
mountAbout(shell.views.about, VERSION);

// Views raise toasts as bubbling events so they don't need the shell.
app.addEventListener('toast', (e) => shell.toast((e as CustomEvent<string>).detail));

// Route: #diagnostics etc. Default is the solver.
function route() {
  const id = location.hash.slice(1) as ViewId;
  shell.show(VIEWS.includes(id) ? id : 'solver');
}
window.addEventListener('hashchange', route);
route();

// Online indicator
shell.setOnline(navigator.onLine);
window.addEventListener('online', () => { shell.setOnline(true); shell.toast('Back online'); });
window.addEventListener('offline', () => { shell.setOnline(false); shell.toast("You're offline — cached results still work"); });

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
