import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { PlayerId } from '../engine';
import { DeckPicker, Versus } from './components/DeckSelect';
import { SoundToggles, type AudioToggles } from './components/SoundToggles';
import type { DeckChoice } from './deckChoice';
import { REASONING_EFFORTS, isReasoningEffort } from '../llm/models';
import { prefersReducedMotion } from './motion';
import { llmProblem, type OpponentChoice } from './opponentChoice';

export interface LlmSettings {
  choice: OpponentChoice;
  apiKey: string;
  proxy: boolean;
  models: string[];
  onChoice: (choice: OpponentChoice) => void;
  onApiKey: (key: string) => void;
}

interface StartScreenProps {
  choice: DeckChoice;
  onChange: (choice: DeckChoice) => void;
  onView: (deckId: string) => void;
  onPlay: () => void;
  onWatch: () => void;
  llm: LlmSettings;
  audio?: AudioToggles;
}

function LlmFields({ llm, problem }: { llm: LlmSettings; problem: string | null }) {
  const hint =
    problem ??
    (llm.proxy && !llm.apiKey.trim()
      ? "The dev server adds its own OPENROUTER_API_KEY, so no key is needed here."
      : 'Your key stays on this device. Each AI decision is one OpenRouter request, billed to it. A lower thinking effort answers sooner, on models that reason.');
  return (
    <div class="llm-fields">
      <label class="field">
        <span>Model</span>
        <input
          type="text"
          list="llm-models"
          data-testid="llm-model"
          value={llm.choice.model}
          spellcheck={false}
          autocapitalize="off"
          autocomplete="off"
          placeholder="provider/model"
          onInput={(event) => llm.onChoice({ ...llm.choice, model: event.currentTarget.value })}
        />
      </label>
      <datalist id="llm-models" data-testid="llm-models">
        {llm.models.map((id) => (
          <option key={id} value={id} />
        ))}
      </datalist>
      <label class="field">
        <span>Thinking effort</span>
        <select
          data-testid="llm-effort"
          value={llm.choice.effort ?? 'default'}
          onChange={(event) => {
            const value = event.currentTarget.value;
            llm.onChoice({ ...llm.choice, effort: isReasoningEffort(value) ? value : null });
          }}
        >
          <option value="default">Model default</option>
          {REASONING_EFFORTS.map((effort) => (
            <option key={effort} value={effort}>
              {effort.charAt(0).toUpperCase() + effort.slice(1)}
            </option>
          ))}
        </select>
      </label>
      <label class="field">
        <span>OpenRouter API key</span>
        <input
          type="password"
          data-testid="llm-key"
          value={llm.apiKey}
          autocomplete="off"
          placeholder={llm.proxy ? 'Optional with the dev server' : 'sk-or-…'}
          onInput={(event) => llm.onApiKey(event.currentTarget.value)}
        />
      </label>
      <p class={`field-hint${problem ? ' problem' : ''}`} data-testid="llm-hint">
        {hint}{' '}
        {!llm.apiKey.trim() && !llm.proxy && (
          <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer">
            Get a key
          </a>
        )}
      </p>
    </div>
  );
}

export function StartScreen({ choice, onChange, onView, onPlay, onWatch, llm, audio }: StartScreenProps) {
  const [picking, setPicking] = useState<PlayerId | null>(null);
  const matchup = useRef<HTMLDivElement>(null);
  const lastTop = useRef<number | null>(null);
  const problem = llmProblem(llm.choice, llm.apiKey, llm.proxy);

  const pick = (seat: PlayerId | null): void => {
    lastTop.current = matchup.current?.getBoundingClientRect().top ?? null;
    setPicking(seat);
  };

  useLayoutEffect(() => {
    const element = matchup.current;
    const from = lastTop.current;
    lastTop.current = null;
    if (!element || from === null || typeof element.animate !== 'function' || prefersReducedMotion()) return;
    const offset = from - element.getBoundingClientRect().top;
    if (Math.abs(offset) < 1) return;
    element.animate([{ translate: `0 ${offset}px` }, { translate: '0 0' }], { duration: 340, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' });
  }, [picking]);

  const players = [
    { kind: 'classic', label: 'Classic' },
    { kind: 'llm', label: 'LLM' },
  ] as const;
  const names = ['You', llm.choice.kind === 'llm' ? 'AI · LLM' : 'AI'] as const;
  return (
    <main class={`start${picking === null ? '' : ' picking'}`} data-testid="start-screen">
      <div class="start-body">
        <header class="start-head">
          <div class="start-title">
            <div>
              <h1>Mana Duel</h1>
              <p class="tagline">A minimalist card duel. Tap a deck box to choose, then take on the AI.</p>
            </div>
            {audio && <SoundToggles audio={audio} />}
          </div>
        </header>

        <div class="matchup" ref={matchup}>
          <Versus choice={choice} picking={picking} names={names} onPick={(seat) => pick(picking === seat ? null : seat)} />
          {picking !== null && (
            <DeckPicker
              seat={picking}
              choice={choice}
              onChange={onChange}
              onView={onView}
              onDone={() => {
                matchup.current?.querySelector<HTMLElement>(`.seat-${picking}`)?.focus();
                pick(null);
              }}
            />
          )}
        </div>

        {picking === null && (
          <>
            <section class="start-section" aria-labelledby="ai-player-label">
              <h2 id="ai-player-label" class="section-label">
                Who plays the AI
              </h2>
              <div class="segmented" role="radiogroup" aria-labelledby="ai-player-label">
                {players.map((player) => (
                  <button
                    key={player.kind}
                    type="button"
                    role="radio"
                    aria-checked={llm.choice.kind === player.kind}
                    class={llm.choice.kind === player.kind ? 'on' : ''}
                    data-testid={`ai-${player.kind}`}
                    onClick={() => llm.onChoice({ ...llm.choice, kind: player.kind })}
                  >
                    {player.label}
                  </button>
                ))}
              </div>
              {llm.choice.kind === 'llm' && <LlmFields llm={llm} problem={problem} />}
            </section>

            <details class="rules">
              <summary>How to play</summary>
              <ul>
                <li>
                  Tap a deck box to choose your deck or the AI's, or let chance choose the AI's. You both start at 20 life
                  with 40 cards.
                </li>
                <li>
                  The classic AI plays on its own. Pick LLM to let a language model from OpenRouter make the AI's decisions
                  instead: it sees what the AI may see, never your hand, and the classic AI steps in if it fails to answer.
                </li>
                <li>Bring the AI to 0 life to win. Play one land per turn; lands pay for spells automatically.</li>
                <li>Creatures can't attack the turn they arrive, unless they have haste.</li>
                <li>Attack with your creatures; the defender picks blockers. Damage happens all at once.</li>
                <li>Instants, and creatures with flash, can be cast whenever you have priority, even in response to a spell.</li>
                <li>A counterspell targets a spell on the stack: tap it in the strip between the two sides.</li>
                <li>Tokens are creatures that cards create; they vanish when they leave the battlefield.</li>
                <li>Tap a card to see what it does. Long-press or right-click to inspect any card.</li>
              </ul>
            </details>
          </>
        )}
      </div>

      <div class="start-actions">
        <button type="button" class="btn" data-testid="btn-play" disabled={!!problem} onClick={onPlay}>
          Play vs AI
        </button>
        <button type="button" class="btn secondary" data-testid="btn-watch" disabled={!!problem} onClick={onWatch}>
          Watch AI vs AI
        </button>
      </div>
    </main>
  );
}
