import { DECK_LIST, getDeck, type DeckDef } from '../engine';
import { cardArtUrl } from './cardInfo';
import { ColorDots } from './components/DeckViewer';
import { RANDOM_DECK, type DeckChoice } from './deckChoice';

interface StartScreenProps {
  choice: DeckChoice;
  onChange: (choice: DeckChoice) => void;
  onView: (deckId: string) => void;
  onPlay: () => void;
  onWatch: () => void;
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

export function StartScreen({ choice, onChange, onView, onPlay, onWatch }: StartScreenProps) {
  const opponents = [RANDOM_DECK, ...DECK_LIST.map((deck) => deck.id)];
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

      <div class="start-actions">
        <button type="button" class="btn" data-testid="btn-play" onClick={onPlay}>
          Play vs AI
        </button>
        <button type="button" class="btn secondary" data-testid="btn-watch" onClick={onWatch}>
          Watch AI vs AI
        </button>
      </div>

      <details class="rules">
        <summary>How to play</summary>
        <ul>
          <li>Pick your deck and the AI's, or let chance choose the AI's. You both start at 20 life with 40 cards.</li>
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
