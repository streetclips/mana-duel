import type { SoundId } from './sounds';

export const SAME_SOUND_GAP = 0.045;
export const CROWD_WINDOW = 0.25;
export const CROWD_LIMIT = 10;

export class SoundGate {
  private last = new Map<SoundId, number>();
  private recent: number[] = [];

  constructor(
    private readonly gap = SAME_SOUND_GAP,
    private readonly window = CROWD_WINDOW,
    private readonly limit = CROWD_LIMIT,
  ) {}

  allow(sound: SoundId, at: number): boolean {
    const previous = this.last.get(sound);
    if (previous !== undefined && Math.abs(at - previous) < this.gap) return false;
    this.recent = this.recent.filter((time) => Math.abs(at - time) < this.window);
    if (this.recent.length >= this.limit) return false;
    this.last.set(sound, at);
    this.recent.push(at);
    return true;
  }

  reset(): void {
    this.last.clear();
    this.recent = [];
  }
}
