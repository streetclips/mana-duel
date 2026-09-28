import { DECK_LIST, getDeck, type DeckDef } from '../engine';
import { cardArtUrl } from './cardInfo';
import { ColorDots } from './components/DeckViewer';
import { RANDOM_DECK, type DeckChoice } from './deckChoice';
import { REASONING_EFFORTS, isReasoningEffort } from '../llm/models';
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
}

interface DeckTileProps {
  deck: DeckDef;
  selected: boolean;
  onSelect: () => void;
  onView: () => void;
}

function DeckTile({ deck, selected, onSelect, onView }: DeckTileProps) {
  return (
    <div class={`deck-tile${selected ? ' selected' : ''}`}>
      <button
        type="button"
        class="deck-choice"
        role="radio"
        aria-checked={selected}
        data-testid={`deck-${deck.id}`}
        onClick={onSelect}
      >
        <img class="deck-art" src={cardArtUrl(deck.featured)} alt="" draggable={false} />
        <span class="deck-text">
          <span class="deck-title">
            <b>{deck.name}</b>
            <ColorDots deck={deck} />
          </span>
          <span class="deck-description">{deck.description}</span>
        </span>
      </button>
      <button
        type="button"
        class="deck-view"
        aria-label={`View the ${deck.name} deck`}
        data-testid={`deck-view-${deck.id}`}
        onClick={onView}
      >
        View
      </button>
    </div>
  );
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

export function StartScreen({ choice, onChange, onView, onPlay, onWatch, llm }: StartScreenProps) {
  const opponents = [RANDOM_DECK, ...DECK_LIST.map((deck) => deck.id)];
  const problem = llmProblem(llm.choice, llm.apiKey, llm.proxy);
  const players = [
    { kind: 'classic', label: 'Classic' },
    { kind: 'llm', label: 'LLM' },
  ] as const;
  return (
    <main class="start" data-testid="start-screen">
      <header>
        <h1>Mana Duel</h1>
        <p class="tagline">A minimalist card duel. Pick a deck, then take on the AI.</p>
      </header>

      <section class="start-section" aria-labelledby="your-deck-label">
        <h2 id="your-deck-label" class="section-label">
          Your deck
        </h2>
        <div class="deck-picker" role="radiogroup" aria-labelledby="your-deck-label">
          {DECK_LIST.map((deck) => (
            <DeckTile
              key={deck.id}
              deck={deck}
              selected={deck.id === choice.deck}
              onSelect={() => onChange({ ...choice, deck: deck.id })}
              onView={() => onView(deck.id)}
            />
          ))}
        </div>
      </section>

      <section class="start-section" aria-labelledby="ai-deck-label">
        <h2 id="ai-deck-label" class="section-label">
          AI's deck
        </h2>
        <div class="segmented" role="radiogroup" aria-labelledby="ai-deck-label">
          {opponents.map((id) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={choice.opponent === id}
              class={choice.opponent === id ? 'on' : ''}
              data-testid={`opponent-${id}`}
              onClick={() => onChange({ ...choice, opponent: id })}
            >
              {id === RANDOM_DECK ? 'Random' : getDeck(id).name}
            </button>
          ))}
        </div>
      </section>

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

      <div class="start-actions">
        <button type="button" class="btn" data-testid="btn-play" disabled={!!problem} onClick={onPlay}>
          Play vs AI
        </button>
        <button type="button" class="btn secondary" data-testid="btn-watch" disabled={!!problem} onClick={onWatch}>
          Watch AI vs AI
        </button>
      </div>

      <details class="rules">
        <summary>How to play</summary>
        <ul>
          <li>Pick your deck and the AI's, or let chance choose the AI's. You both start at 20 life with 40 cards.</li>
          <li>
            The classic AI plays on its own. Pick LLM to let a language model from OpenRouter make the AI's decisions
            instead: it sees what the AI may see, never your hand, and the classic AI steps in if it fails to answer.
          </li>
          <li>Bring the AI to 0 life to win. Play one land per turn; lands pay for spells automatically.</li>
          <li>Creatures can't attack the turn they arrive, unless they have haste.</li>
          <li>Attack with your creatures; the defender picks blockers. Damage happens all at once.</li>
          <li>Instants can be cast whenever you have priority, even in response to a spell.</li>
          <li>A counterspell targets a spell on the stack: tap it in the strip between the two sides.</li>
          <li>Tap a card to see what it does. Long-press or right-click to inspect any card.</li>
        </ul>
      </details>
    </main>
  );
}
