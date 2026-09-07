import type { SolveResult, SolveRequest } from '../contract';
import { parsePattern } from '../pattern';
import { renderAnswers, skeletonAnswers } from '../render/answers';
import { renderDefinition, skeletonDefinition } from '../render/definition';
import { renderHistory } from '../render/history';
import { renderReference, skeletonReference } from '../render/reference';
import { esc } from '../render/util';
import { buildRequest, isBuildError, solve } from '../solve';
import { getHistory, getSettings, pushHistory } from '../store';
import { buildLinks } from '../providers/links';
import type { Shell } from './shell';

export interface Solver {
  setQuery(q: string, pattern?: string, submit?: boolean): void;
  refreshHistory(): void;
}

export function mountSolver(view: HTMLElement, shell: Shell): Solver {
  view.innerHTML = `
    <div class="searchbar">
      <form class="search" id="form" autocomplete="off">
        <label class="field">
          <span class="sr">Clue</span>
          <input id="q" type="search" inputmode="search" enterkeyhint="search" placeholder="Word or phrase" autofocus>
          <button type="button" class="clear" id="clear" aria-label="Clear" hidden>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3 3l8 8M11 3l-8 8"/></svg>
          </button>
        </label>
        <button class="go" type="submit" aria-label="Solve">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
        </button>
      </form>
      <div class="constraints">
        <button type="button" class="chip" id="patternChip" aria-pressed="false" aria-controls="pattern">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><rect x="1" y="1" width="4" height="4"/><rect x="7" y="1" width="4" height="4"/><rect x="1" y="7" width="4" height="4"/><rect x="7" y="7" width="4" height="4"/></svg>
          Pattern
        </button>
        <div class="pattern" id="pattern">
          <input id="p" type="text" placeholder="?I??" aria-label="Letter pattern" maxlength="30" autocapitalize="characters" autocomplete="off" spellcheck="false">
          <span class="hint" id="phint">? = unknown letter</span>
        </div>
      </div>
      <div class="form-error" id="formError" hidden></div>
    </div>
    <div id="out"></div>
    <div id="recent"></div>`;

  const $ = <T extends HTMLElement>(id: string) => view.querySelector<T>(`#${id}`)!;
  const q = $<HTMLInputElement>('q'), p = $<HTMLInputElement>('p'), out = $('out'), form = $<HTMLFormElement>('form');
  const chip = $<HTMLButtonElement>('patternChip'), pat = $('pattern'), phint = $('phint'), formError = $('formError'), clearBtn = $('clear');
  const sections = { answers: '', meaning: '', about: '' };

  let ctl: AbortController | null = null;
  let current: SolveResult | null = null;
  let liveTimer: number | undefined;

  function paint() {
    out.innerHTML = sections.answers + sections.meaning + sections.about;
  }
  function refreshHistory() {
    $('recent').innerHTML = renderHistory(getHistory());
  }

  function setPatternOpen(open: boolean) {
    pat.classList.toggle('open', open);
    chip.setAttribute('aria-pressed', String(open));
  }
  function updateHint() {
    const c = parsePattern(p.value);
    phint.classList.toggle('err', Boolean(c.error));
    phint.innerHTML = c.error ? esc(c.error) : c.length ? `<b>${c.length}</b> letters` : '? = unknown letter';
  }

  async function run() {
    const built = buildRequest(q.value, pat.classList.contains('open') ? p.value : '');
    if (isBuildError(built)) {
      formError.textContent = built.error;
      formError.hidden = false;
      return;
    }
    formError.hidden = true;
    const req: SolveRequest = built;
    ctl?.abort();
    ctl = new AbortController();
    const mine = ctl;
    sections.answers = skeletonAnswers();
    sections.meaning = skeletonDefinition();
    sections.about = skeletonReference();
    paint();
    window.scrollTo({ top: 0, behavior: 'smooth' });

    const result = await solve(req, mine.signal, {
      answers: (a) => { if (mine.signal.aborted) return; sections.answers = renderAnswers(a, req); paint(); },
      definition: (d) => { if (mine.signal.aborted) return; sections.meaning = renderDefinition(d, req.query); paint(); },
      reference: (r) => { if (mine.signal.aborted) return; sections.about = renderReference(r, buildLinks(req.query, r !== null), req.query); paint(); },
      done: (r) => {
        if (mine.signal.aborted) return;
        current = r;
        const datamuseErr = r.errors.find((e) => e.provider === 'Datamuse');
        sections.answers = renderAnswers(r.answers, req, { fromCache: r.fromCache, error: datamuseErr });
        sections.meaning = renderDefinition(r.definition, req.query, r.errors);
        sections.about = renderReference(r.reference, r.links, req.query, r.errors);
        paint();
      },
    });
    if (mine.signal.aborted) return;
    pushHistory({ query: req.query, pattern: req.pattern, at: Date.now(), topAnswer: result.answers[0]?.answer });
    refreshHistory();
  }

  // ---- events ----
  form.addEventListener('submit', (e) => { e.preventDefault(); clearTimeout(liveTimer); q.blur(); run(); });
  q.addEventListener('input', () => {
    clearBtn.hidden = !q.value;
    if (getSettings().liveSearch && navigator.onLine && q.value.trim().length >= 3) {
      clearTimeout(liveTimer);
      liveTimer = window.setTimeout(run, 450);
    }
  });
  clearBtn.addEventListener('click', () => { q.value = ''; clearBtn.hidden = true; q.focus(); });
  chip.addEventListener('click', () => {
    const open = !pat.classList.contains('open');
    setPatternOpen(open);
    if (open) p.focus();
    else { p.value = ''; updateHint(); if (current) run(); }
  });
  p.addEventListener('input', updateHint);
  p.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); form.requestSubmit(); } });

  // tap = copy, hold = chain lookup
  let holdTimer: number | undefined, held = false;
  out.addEventListener('pointerdown', (e) => {
    const row = (e.target as HTMLElement).closest<HTMLElement>('.row');
    if (!row) return;
    held = false;
    holdTimer = window.setTimeout(() => {
      held = true;
      setQuery(row.dataset.display!, '', true);
      shell.toast(`Looking up “${row.dataset.display}”`);
    }, 520);
  });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) out.addEventListener(ev, () => clearTimeout(holdTimer));
  out.addEventListener('contextmenu', (e) => { if ((e.target as HTMLElement).closest('.row')) e.preventDefault(); });
  out.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const row = t.closest<HTMLElement>('.row');
    if (row) {
      if (held) return;
      navigator.clipboard?.writeText(row.dataset.answer!).then(
        () => shell.toast(`Copied ${row.dataset.answer}`),
        () => shell.toast(row.dataset.answer!),
      );
      return;
    }
    const play = t.closest<HTMLElement>('[data-audio]');
    if (play) { new Audio(play.dataset.audio).play().catch(() => shell.toast("Couldn't play audio")); return; }
    if (t.closest('[data-expand]')) t.closest('.card')?.classList.toggle('expanded');
  });
  $('recent').addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('button[data-q]');
    if (b) setQuery(b.dataset.q!, b.dataset.p ?? '', true);
  });

  function setQuery(query: string, pattern = '', submit = false) {
    q.value = query;
    clearBtn.hidden = !query;
    p.value = pattern;
    setPatternOpen(Boolean(pattern));
    updateHint();
    if (submit) run();
  }

  refreshHistory();
  updateHint();
  return { setQuery, refreshHistory };
}
