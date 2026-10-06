import { Fragment } from 'preact';
import { useLayoutEffect, useRef } from 'preact/hooks';
import { DECK_LIST, localizeDeck, type DeckDef, type PlayerId } from '../../engine';
import { chosenDeck, deckOptions, seatDeck, withSeatDeck, type DeckChoice } from '../deckChoice';
import { cssVars } from '../cardInfo';
import { commonText } from '../text/common';
import { decksText } from '../text/decks';
import { DeckBox } from './DeckBox';
import { ColorDots } from './DeckViewer';

export const PICKER_ID = 'deck-picker';

function deckName(id: string, customs: readonly DeckDef[]): string {
  return chosenDeck(id, customs)?.name ?? commonText().random;
}

function ChevronIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  );
}

interface SeatProps {
  seat: PlayerId;
  deckId: string;
  customs: readonly DeckDef[];
  who: string;
  active: boolean;
  onTap: () => void;
}

function Seat({ seat, deckId, customs, who, active, onTap }: SeatProps) {
  return (
    <button
      type="button"
      class={`seat seat-${seat}${active ? ' active' : ''}`}
      data-testid={`seat-${seat}`}
      data-deck={deckId}
      aria-label={`${who}: ${deckName(deckId, customs)}`}
      aria-expanded={active}
      aria-controls={active ? PICKER_ID : undefined}
      onClick={onTap}
    >
      <span class="seat-box">
        <DeckBox key={deckId} deck={chosenDeck(deckId, customs)} open={active} printed />
      </span>
      <span class="seat-who">{who}</span>
      <span class="seat-deck">
        {deckName(deckId, customs)}
        <ChevronIcon />
      </span>
    </button>
  );
}

interface VersusProps {
  choice: DeckChoice;
  customs?: readonly DeckDef[];
  picking: PlayerId | null;
  names: readonly [string, string];
  onPick: (seat: PlayerId) => void;
}

export function Versus({ choice, customs = [], picking, names, onPick }: VersusProps) {
  const seat = (player: PlayerId) => (
    <Seat
      seat={player}
      deckId={seatDeck(choice, player)}
      customs={customs}
      who={names[player]}
      active={picking === player}
      onTap={() => onPick(player)}
    />
  );
  return (
    <div class={`versus${picking === null ? '' : ' picking'}`} role="group" aria-label={decksText().picker.matchup} data-testid="versus">
      {seat(0)}
      <span key={`${choice.deck}:${choice.opponent}`} class="vs" aria-hidden="true">
        vs
      </span>
      {seat(1)}
    </div>
  );
}

interface DeckOptionProps {
  deck: DeckDef | null;
  index: number;
  checked: boolean;
  testId: string;
  onSelect: () => void;
}

export function DeckOption({ deck, index, checked, testId, onSelect }: DeckOptionProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      class="deck-option"
      style={cssVars({ '--i': String(index) })}
      data-testid={testId}
      onClick={onSelect}
    >
      <DeckBox deck={deck} open={checked} />
      <span class="deck-option-name">{deck ? localizeDeck(deck).name : commonText().random}</span>
    </button>
  );
}

interface DeckPickerProps {
  seat: PlayerId;
  choice: DeckChoice;
  customs?: readonly DeckDef[];
  onChange: (choice: DeckChoice) => void;
  onView: (deckId: string) => void;
  onDone: () => void;
}

export function DeckPicker({ seat, choice, customs = [], onChange, onView, onDone }: DeckPickerProps) {
  const grid = useRef<HTMLDivElement>(null);
  const selected = seatDeck(choice, seat);
  const deck = chosenDeck(selected, customs);
  const options = deckOptions(customs);
  const text = decksText().picker;
  const title = seat === 0 ? text.yourDeck : text.aiDeck;

  useLayoutEffect(() => {
    const list = grid.current;
    const option = list?.querySelector<HTMLElement>('[aria-checked="true"]');
    const first = list?.firstElementChild;
    if (!list || !option || !(first instanceof HTMLElement)) return;
    const hidden = option.offsetTop < list.scrollTop || option.offsetTop + option.offsetHeight > list.scrollTop + list.clientHeight;
    if (hidden) list.scrollTop = option.offsetTop - first.offsetTop;
  }, [seat]);

  return (
    <section id={PICKER_ID} class="picker" data-testid="deck-picker" data-seat={seat} aria-label={title}>
      <header class="picker-head">
        <h2 class="section-label">{title}</h2>
        <span class="picker-count num">{text.deckCount(options.length - 1)}</span>
        <button type="button" class="picker-done" data-testid="btn-picker-done" onClick={onDone}>
          {text.done}
        </button>
      </header>
      <div class="picker-detail" data-testid="deck-detail" aria-live="polite">
        <div class="picker-detail-text">
          <h3>
            {deck ? deck.name : commonText().random}
            {deck && <ColorDots deck={deck} />}
          </h3>
          <p>{deck ? deck.description : text.randomDescription(DECK_LIST.length)}</p>
        </div>
        {deck && (
          <button
            type="button"
            class="btn secondary"
            aria-label={text.viewDeck(deck.name)}
            data-testid={`deck-view-${deck.id}`}
            onClick={() => onView(deck.id)}
          >
            {text.cards}
          </button>
        )}
      </div>
      <div class="picker-grid" role="radiogroup" aria-label={title} ref={grid}>
        {options.map((id, index) => (
          <Fragment key={id}>
            {id === customs[0]?.id && (
              <h3 class="picker-group" data-testid="picker-custom">
                {text.myDecks}
              </h3>
            )}
            <DeckOption
              deck={chosenDeck(id, customs)}
              index={index}
              checked={id === selected}
              testId={seat === 0 ? `deck-${id}` : `opponent-${id}`}
              onSelect={() => onChange(withSeatDeck(choice, seat, id))}
            />
          </Fragment>
        ))}
      </div>
    </section>
  );
}
