import type { DraftRun } from '../app/draft';
import type { DraftStore } from '../app/draftController';

const DRAFT_KEY = 'manaDuel.draft';

export const localDraftStore: DraftStore = {
  load(): unknown {
    try {
      return JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null');
    } catch {
      return null;
    }
  },
  save(run: DraftRun | null): void {
    try {
      if (run) localStorage.setItem(DRAFT_KEY, JSON.stringify(run));
      else localStorage.removeItem(DRAFT_KEY);
    } catch {
      return;
    }
  },
};
