import type { Answer, SolveRequest } from './contract';
import { fits, letterHits } from './pattern';

/**
 * Re-derive the constraint-dependent fields and order for a set of answers.
 * Pure, so the UI can re-rank instantly when the letters change without a
 * refetch, and the cache can store answers independent of the view.
 */
export function rankAnswers(answers: Answer[], req: SolveRequest): Answer[] {
  return answers
    .map((a) => ({ ...a, fitsPattern: fits(a.answer, req), letterHits: letterHits(a.answer, req.letters) }))
    .sort(
      (a, b) =>
        Number(b.fitsPattern === true) - Number(a.fitsPattern === true) ||
        (b.letterHits ?? 0) - (a.letterHits ?? 0) ||
        b.score - a.score ||
        a.length - b.length,
    );
}
