import { COLORS, localizeDeck, type DeckDef } from '../../engine';
import { cardArtUrl, cssVars } from '../cardInfo';
import { commonText } from '../text/common';

interface DeckBoxProps {
  deck: DeckDef | null;
  open: boolean;
  printed?: boolean;
}

function boxTones(deck: DeckDef): Record<`--${string}`, string> {
  const [first, second = first] = deck.colors.length > 2 ? ['M', 'M'] : deck.colors;
  return { '--box-a': `var(--mana-${first})`, '--box-b': `var(--mana-${second})` };
}

export function DeckBox({ deck, open, printed = false }: DeckBoxProps) {
  const common = commonText();
  const name = deck ? localizeDeck(deck).name : common.random;
  const lit: readonly string[] = deck ? deck.colors : COLORS;
  return (
    <span
      class={`deck-box${deck ? '' : ' random'}${open ? ' open' : ''}`}
      style={deck ? cssVars(boxTones(deck)) : undefined}
      data-open={open}
      aria-hidden="true"
    >
      <span class="box-floor" />
      <span class="box-body">
        <span class="box-face box-back" />
        <span class="box-face box-inside" />
        <span class="box-cards">
          <i />
          <i />
          <i />
        </span>
        <span class="box-face box-side box-left">{printed && <b>{name}</b>}</span>
        <span class="box-face box-side box-right">{printed && <b>{name}</b>}</span>
        <span class="box-face box-front">
          <span class="box-pips">
            {COLORS.map((color) => (
              <i key={color} class={lit.includes(color) ? 'lit' : undefined} style={cssVars({ '--pip': `var(--mana-${color})` })} />
            ))}
          </span>
          {printed && <span class="box-brand">{common.title}</span>}
          <span class="box-art">{deck ? <img src={cardArtUrl(deck.featured)} alt="" draggable={false} /> : <b>?</b>}</span>
          {printed && <span class="box-name">{name}</span>}
        </span>
        <span class="box-lid">
          <span class="box-hinge">
            <span class="box-lid-top" />
            <span class="box-lid-inner" />
          </span>
        </span>
      </span>
    </span>
  );
}
