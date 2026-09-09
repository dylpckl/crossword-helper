import type { Answer, SolveResult, SolveRequest } from '../contract';
import { parsePattern } from '../pattern';
import { renderAnswers, skeletonAnswers } from '../render/answers';
import { renderEmpty } from '../render/empty';
import { renderHistory } from '../render/history';
import { renderMeaning, skeletonMeaning } from '../render/meaning';
import { esc } from '../render/util';
import { rankAnswers } from '../rank';
import { buildRequest, isBuildError, solve } from '../solve';
import { getHistory, getSettings, pushHistory } from '../store';
import { buildLinks } from '../providers/links';
import type { Shell } from './shell';

export interface Solver {
  setQuery(q: string, pattern?: string, submit?: boolean): void;
  refreshHistory(): void;
  /** Re-read settings that affect the solver view (result order). */
  applySettings(): void;
}

export function mountSolver(view: HTMLElement, shell: Shell): Solver {
  view.innerHTML = `
    <div class="searchbar">
      <div class="querybar" id="querybar">
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
      <div class="form-error" id="formError" hidden></div>
      </div>
      <!-- Letters/pattern input, parked: hidden in the UI while the idea is
           reconsidered. The parser, ranking and highlighting all still work,
           so removing this attribute brings it back. -->
      <div class="constraints" hidden>
        <label class="pattern">
          <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><rect x="1" y="1" width="4" height="4"/><rect x="7" y="1" width="4" height="4"/><rect x="1" y="7" width="4" height="4"/><rect x="7" y="7" width="4" height="4"/></svg>
          <input id="p" type="text" placeholder="Letters you have" aria-label="Letters you have, or a ? pattern" maxlength="30" autocapitalize="characters" autocomplete="off" spellcheck="false">
          <button type="button" class="clear" id="pclear" aria-label="Clear letters" hidden>
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3 3l8 8M11 3l-8 8"/></svg>
          </button>
        </label>
        <span class="hint" id="phint"></span>
      </div>
    </div>
    <div id="recent"></div>
    <div id="out"></div>`;

  const $ = <T extends HTMLElement>(id: string) => view.querySelector<T>(`#${id}`)!;
  const q = $<HTMLInputElement>('q'), p = $<HTMLInputElement>('p'), out = $('out'), form = $<HTMLFormElement>('form');
  const phint = $('phint'), formError = $('formError'), clearBtn = $('clear'), pclear = $<HTMLButtonElement>('pclear');
  const sections = { meaning: '', answers: '' };

  /**
   * Wrap a re-render so the browser tweens between the old and new lists.
   * View Transitions do the work; where they're missing, or motion is not
   * wanted, the change simply applies at once.
   */
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  function withTransition(fn: () => void) {
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
    if (reduceMotion.matches || !doc.startViewTransition) { fn(); return; }
    doc.startViewTransition(fn);
  }

  let ctl: AbortController | null = null;
  let current: SolveResult | null = null;
  /**
   * Answers as they stand before every provider has settled. Meaning waits on
   * a dictionary that can take eight seconds to time out, so `current` is not
   * set until well after the answers are on screen — and the length filter
   * has to work in that gap, not sit dead until the slowest provider gives up.
   */
  let live: { req: SolveRequest; answers: Answer[] } | null = null;
  let liveTimer: number | undefined;

  /**
   * Whether the Meaning section is open. Closed by default on every search:
   * answers are what was asked for, and the definition is one tap away when
   * it's wanted. Sections keep a fixed order, so nothing reflows as results land.
   */
  let meaningOpen = false;
  /** Length segment selection. View-only, reset on each new search. */
  let lengthFilter: number | null = null;

  function paint() {
    const body = sections.meaning + sections.answers;
    out.innerHTML = body || renderEmpty(getHistory().length === 0);
  }
  /**
   * Swap one section in place. Rebuilding the whole of `out` for a change to
   * one section throws away the other's DOM mid-interaction — a definition
   * landing would tear out the answer list under the reader's thumb.
   */
  function paintSection(id: string, html: string) {
    const el = out.querySelector(id);
    if (el) el.outerHTML = html;
    else paint();
  }
  const paintAnswers = () => paintSection('#sec-answers', sections.answers);
  const paintMeaningSection = () => paintSection('#sec-meaning', sections.meaning);
  /** Re-render every section, in place. */
  function repaintAll() {
    if (!current) return;
    renderSections();
    paintMeaningSection();
    paintAnswers();
  }
  /**
   * Hold the chosen length across a repaint, but drop it if the new answers
   * have nothing of that length — a filter matching nothing reads as a bug.
   */
  function keepLengthFilter(answers: Answer[]): number | null {
    if (lengthFilter !== null && !answers.some((a) => a.length === lengthFilter)) lengthFilter = null;
    return lengthFilter;
  }
  /** Renders from the finished result when there is one, the partial otherwise. */
  function renderAnswersSection() {
    if (current) {
      const r = current;
      sections.answers = renderAnswers(r.answers, r.request, {
        fromCache: r.fromCache,
        error: r.errors.find((e) => e.provider === 'Datamuse'),
        lengthFilter: keepLengthFilter(r.answers),
      });
    } else if (live) {
      sections.answers = renderAnswers(live.answers, live.req, { lengthFilter: keepLengthFilter(live.answers) });
    }
  }
  function renderSections() {
    if (current) {
      const r = current, req = r.request;
      sections.meaning = renderMeaning(r.definition, r.reference, r.links, req.query, r.errors, { open: meaningOpen });
    }
    renderAnswersSection();
  }

  /** Toggling only flips a class, so the CSS height transition can run. */
  function toggleMeaning() {
    meaningOpen = !meaningOpen;
    const sec = out.querySelector('#sec-meaning');
    sec?.classList.toggle('open', meaningOpen);
    sec?.querySelector('.disclosure')?.setAttribute('aria-expanded', String(meaningOpen));
    sec?.querySelector('.peek')?.setAttribute('tabindex', meaningOpen ? '-1' : '0');
    renderSections();
  }

  function applySettings() {
    document.body.classList.toggle('search-bottom', getSettings().searchPosition === 'bottom');
    repaintAll();
  }
  /** Empty input means no results: drop them rather than leave a stale answer set. */
  function clearResults() {
    ctl?.abort();
    ctl = null;
    clearTimeout(liveTimer);
    current = null;
    live = null;
    lengthFilter = null;
    sections.meaning = '';
    sections.answers = '';
    formError.hidden = true;
    paint();
  }

  function refreshHistory() {
    $('recent').innerHTML = renderHistory(getHistory());
  }

  function updateHint() {
    const c = parsePattern(p.value);
    pclear.hidden = !p.value;
    phint.classList.toggle('err', Boolean(c.error));
    phint.innerHTML = c.error
      ? esc(c.error)
      : c.pattern
        ? `<b>${c.length}</b> letters, by position`
        : c.length
          ? `<b>${c.length}</b> letters long`
          : c.letters
            ? 'any order · use ? for positions'
            : '';
  }

  /** Letters changed: re-rank what we have instantly. Pattern/length changed: refetch. */
  function onConstraintInput() {
    updateHint();
    if (!current) return;
    const built = buildRequest(q.value, p.value);
    if (isBuildError(built)) return;
    const sameFetch = built.query === current.request.query && built.pattern === current.request.pattern && built.length === current.request.length;
    clearTimeout(liveTimer);
    if (sameFetch) {
      current = { ...current, request: built, answers: rankAnswers(current.answers, built) };
      repaintAll();
    } else {
      liveTimer = window.setTimeout(run, 500);
    }
  }

  async function run() {
    const built = buildRequest(q.value, p.value);
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
    lengthFilter = null;
    current = null;
    live = null;
    sections.meaning = skeletonMeaning();
    sections.answers = skeletonAnswers();
    meaningOpen = false;
    paint();

    // The two halves of Meaning land separately; keep both and redraw the pair.
    let liveDef: Parameters<typeof renderMeaning>[0] = null;
    let liveRef: Parameters<typeof renderMeaning>[1] = null;
    const paintMeaning = () => {
      sections.meaning = renderMeaning(liveDef, liveRef, buildLinks(req.query, liveRef !== null), req.query, [], { open: meaningOpen });
      paintMeaningSection();
    };
    window.scrollTo({ top: 0, behavior: 'smooth' });

    const result = await solve(req, mine.signal, {
      answers: (a) => {
        if (mine.signal.aborted) return;
        live = { req, answers: a };
        renderAnswersSection();
        paintAnswers();
      },
      definition: (d) => {
        if (mine.signal.aborted) return;
        liveDef = d;
        paintMeaning();
      },
      reference: (r) => {
        if (mine.signal.aborted) return;
        liveRef = r;
        paintMeaning();
      },
      done: (r) => {
        if (mine.signal.aborted) return;
        current = r;
        repaintAll();
      },
    });
    if (mine.signal.aborted) return;
    pushHistory({ query: req.query, pattern: req.pattern, letters: req.letters, at: Date.now(), topAnswer: result.answers[0]?.answer });
    refreshHistory();
  }

  // ---- events ----
  form.addEventListener('submit', (e) => { e.preventDefault(); clearTimeout(liveTimer); q.blur(); run(); });
  q.addEventListener('input', () => {
    clearBtn.hidden = !q.value;
    if (!q.value.trim()) { clearResults(); return; }
    if (getSettings().liveSearch && navigator.onLine && q.value.trim().length >= 3) {
      clearTimeout(liveTimer);
      liveTimer = window.setTimeout(run, 450);
    }
  });
  clearBtn.addEventListener('click', () => {
    q.value = '';
    clearBtn.hidden = true;
    clearResults();
    q.focus();
  });
  pclear.addEventListener('click', () => { p.value = ''; onConstraintInput(); p.focus(); });
  p.addEventListener('input', onConstraintInput);
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
    if (t.closest('[data-toggle-meaning]')) { toggleMeaning(); return; }
    const len = t.closest<HTMLElement>('[data-len]');
    if (len) {
      const n = Number(len.dataset.len);
      lengthFilter = n === 0 || lengthFilter === n ? null : n;
      renderAnswersSection();
      withTransition(paintAnswers);
      return;
    }
    const eg = t.closest<HTMLElement>('[data-example]');
    if (eg) { setQuery(eg.dataset.example!, '', true); return; }
    const play = t.closest<HTMLElement>('[data-audio]');
    if (play) { new Audio(play.dataset.audio).play().catch(() => shell.toast("Couldn't play audio")); return; }
    if (t.closest('[data-expand]')) t.closest('.block')?.classList.toggle('expanded');
  });
  $('recent').addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('button[data-q]');
    if (b) setQuery(b.dataset.q!, b.dataset.p ?? '', true);
  });

  function setQuery(query: string, pattern = '', submit = false) {
    q.value = query;
    clearBtn.hidden = !query;
    p.value = pattern;
    updateHint();
    if (submit) run();
  }

  refreshHistory();
  updateHint();
  applySettings();
  paint();
  return { setQuery, refreshHistory, applySettings };
}
