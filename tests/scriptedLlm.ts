import type { Action, GameState, PlayerId } from '../src/engine';
import type { DecideOptions, LlmDecision, LlmPlayer } from '../src/llm';

export interface Call {
  state: GameState;
  player: PlayerId;
  options: DecideOptions;
  answer(decision: Partial<LlmDecision> & { action: Action }): void;
  aborted(): boolean;
}

export class ScriptedLlm implements LlmPlayer {
  unavailable: string | null = null;
  calls: Call[] = [];

  constructor(
    readonly model: string,
    private readonly auto:
      | ((s: GameState, player: PlayerId) => Partial<LlmDecision> & { action: Action })
      | null = null,
  ) {}

  decide(state: GameState, player: PlayerId, options: DecideOptions = {}): Promise<LlmDecision> {
    return new Promise((resolve, reject) => {
      const answer = (decision: Partial<LlmDecision> & { action: Action }): void =>
        resolve({ source: 'model', model: this.model, attempts: 1, ms: 5, ...decision });
      options.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
      this.calls.push({ state, player, options, answer, aborted: () => options.signal?.aborted ?? false });
      if (this.auto) answer(this.auto(state, player));
    });
  }
}
