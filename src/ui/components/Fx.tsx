import { getCardDef, targetRef, type GameState, type PlayerId } from '../../engine';
import { cardColorVar, cssVars } from '../cardInfo';
import type { FxView, RevealFx } from '../fx';
import { MiniFace, fxDelay } from './Card';

function revealCaption(human: PlayerId, reveal: RevealFx): string {
  if (reveal.kind === 'counter') return 'Contrarrestado';
  if (reveal.kind === 'fizzle') return 'Sin efecto';
  const land = reveal.via === 'land';
  if (reveal.player === human) return land ? 'Juegas' : 'Lanzas';
  return land ? 'El rival juega' : 'El rival lanza';
}

function Reveal({ s, human, reveal }: { s: GameState; human: PlayerId; reveal: RevealFx }) {
  const def = getCardDef(reveal.def);
  const targets = reveal.targets.map((target) => targetRef(s, target, human)).join(', ');
  return (
    <div
      class={`fx-reveal ${reveal.player === human ? 'bottom' : 'top'} ${reveal.kind}`}
      data-testid="fx-reveal"
      data-fx={reveal.kind}
      data-card={reveal.card}
      data-def={reveal.def}
      data-player={reveal.player}
    >
      <span class="fx-reveal-caption">{revealCaption(human, reveal)}</span>
      <div
        class={`card mini fx-reveal-card${def.types.includes('land') ? ' land' : ''}`}
        style={cssVars({ '--card-color': cardColorVar(def) })}
      >
        <MiniFace def={def} />
      </div>
      {targets && <span class="fx-reveal-target">→ {targets}</span>}
    </div>
  );
}

export function FxLayer({ s, human, fx }: { s: GameState; human: PlayerId; fx: FxView }) {
  return (
    <div class="fx-layer" aria-hidden="true">
      {fx.hurt && <span key={fx.hurt.key} class="fx-hurt" data-testid="fx-hurt" data-fx="hurt" style={fxDelay(fx.hurt.delay)} />}
      {fx.reveal && <Reveal key={fx.reveal.key} s={s} human={human} reveal={fx.reveal} />}
    </div>
  );
}
