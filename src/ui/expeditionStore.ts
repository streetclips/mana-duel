import type { ExpeditionRun } from '../app/expedition';
import type { RunStore } from '../app/expeditionController';

const RUN_KEY = 'manaDuel.expedition';

export const localRunStore: RunStore = {
  load(): unknown {
    try {
      return JSON.parse(localStorage.getItem(RUN_KEY) ?? 'null');
    } catch {
      return null;
    }
  },
  save(run: ExpeditionRun | null): void {
    try {
      if (run) localStorage.setItem(RUN_KEY, JSON.stringify(run));
      else localStorage.removeItem(RUN_KEY);
    } catch {
      return;
    }
  },
};
