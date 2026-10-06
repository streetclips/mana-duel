import type { LlmPlayer } from './player';
import { loadingText } from './text/loading';

export function lazyLlmPlayer(model: string, load: () => Promise<LlmPlayer>): LlmPlayer {
  let player: LlmPlayer | null = null;
  let failure: string | null = null;
  let loading: Promise<LlmPlayer> | null = null;
  return {
    model,
    get unavailable() {
      return failure ?? player?.unavailable ?? null;
    },
    async decide(s, seat, options) {
      loading ??= load().then(
        (loaded) => (player = loaded),
        (error: unknown) => {
          failure = loadingText().codeFailed(error instanceof Error ? error.message : String(error));
          throw error;
        },
      );
      return (await loading).decide(s, seat, options);
    },
  };
}
