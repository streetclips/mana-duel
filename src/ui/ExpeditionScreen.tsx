import { useState } from 'preact/hooks';
import {
  DUELS,
  RELIC_EVERY,
  changesLabel,
  copiesOf,
  currentRival,
  deckSizeOf,
  relicOf,
  runDeck,
  type DuelRecord,
  type ExpeditionRun,
  type RelicId,
  type Rival,
} from '../app/expedition';
import type { DuelInfo, ExpeditionController } from '../app/expeditionController';
import { DECK_LIST, OPENING_HAND, getCardDef, getDeck, hasDeck, type DeckDef } from '../engine';
import { cardColorVar, cssVars } from './cardInfo';
import { DetailFace, MiniFace } from './components/Card';
import { DeckBox } from './components/DeckBox';
import { DeckOption } from './components/DeckSelect';
import { ColorDots, DeckViewer, deckGroups } from './components/DeckViewer';
import { CheckIcon, CrownIcon, RelicIcon } from './components/ModeIcons';
import { CardDetail, Sheet } from './components/Overlays';
import { ScreenBar } from './components/ScreenBar';
import { useSubscription } from './useController';

interface ExpeditionScreenProps {
  expedition: ExpeditionController;
  customs?: readonly DeckDef[];
  initialDeck: string;
  problem: string | null;
  onFight: () => void;
  onHome: () => void;
}

const COUNT_WORDS = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez'];

function countWord(count: number): string {
  return COUNT_WORDS[count] ?? String(count);
}

function capitalized(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function lives(count: number): string {
  return `${count} ${count === 1 ? 'vida' : 'vidas'}`;
}

export function rivalTerms(rival: Rival): string {
  const hand = rival.openingHand === OPENING_HAND ? '' : ` · mano de ${rival.openingHand}`;
  return `${lives(rival.life)}${hand}`;
}

export function duelLabel(number: number, total: number, boss: boolean): string {
  return boss ? `Jefe · duelo ${number} de ${total}` : `Duelo ${number} de ${total}`;
}

export function duelBadge(number: number, total: number, boss: boolean): string {
  return boss ? 'Jefe' : `Duelo ${number}/${total}`;
}

export function duelOutcome(duel: DuelInfo): string | null {
  switch (duel.result) {
    case null:
      return null;
    case 'won':
      return duel.number === duel.total ? '¡Has vencido al jefe! La expedición es tuya.' : `Duelo ${duel.number} de ${duel.total} superado: elige tu recompensa.`;
    case 'lost':
      return 'La expedición termina aquí.';
    case 'draw':
      return 'Empate: repetirás este duelo.';
  }
}

export function expeditionStatus(run: ExpeditionRun | null): string {
  if (!run) return `${capitalized(countWord(DUELS))} duelos seguidos con un mismo mazo`;
  if (run.stage.kind === 'won') return `Completada con ${run.base.name}`;
  if (run.stage.kind === 'lost') return `Terminada en el duelo ${run.wins + 1} de ${run.rivals.length}`;
  return `En curso con ${run.base.name}: ${run.wins} de ${run.rivals.length} victorias`;
}

function deckName(id: string): string {
  return hasDeck(id) ? getDeck(id).name : id;
}

function resultWord(record: DuelRecord): string {
  if (record.result === 'won') return 'Victoria';
  return record.result === 'lost' ? 'Derrota' : 'Empate';
}

function cardsWord(count: number): string {
  return `${count} ${count === 1 ? 'carta' : 'cartas'}`;
}

function RelicList({ relics }: { relics: readonly RelicId[] }) {
  if (relics.length === 0) {
    return <p class="run-note">Sin reliquias todavía: ganarás una cada {countWord(RELIC_EVERY)} victorias.</p>;
  }
  return (
    <ul class="relic-list">
      {relics.map((id) => {
        const relic = relicOf(id);
        return (
          <li key={id} class="relic-chip" data-testid={`relic-${id}`}>
            <RelicIcon relic={id} />
            <span>
              <b>{relic.name}</b>
              {relic.text}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

interface NewRunProps {
  decks: readonly DeckDef[];
  initialDeck: string;
  onStart: (deck: DeckDef) => void;
  onView: (deck: DeckDef) => void;
}

function NewRun({ decks, initialDeck, onStart, onView }: NewRunProps) {
  const [selected, setSelected] = useState(initialDeck);
  const deck = decks.find((candidate) => candidate.id === selected) ?? decks[0] ?? getDeck(DECK_LIST[0]?.id ?? '');
  return (
    <>
      <div class="expedition-body" data-testid="expedition-new">
        <p class="run-intro">
          {capitalized(countWord(DUELS))} duelos seguidos con el mismo mazo, cada rival más duro que el anterior. Tras cada victoria eliges una carta nueva; cada {countWord(RELIC_EVERY)}, una reliquia. Una derrota termina la expedición.
        </p>
        <section class="picker run-picker" aria-label="Tu mazo inicial">
          <header class="picker-head">
            <h2 class="section-label">Tu mazo inicial</h2>
            <span class="picker-count num">{decks.length} mazos</span>
          </header>
          <div class="picker-detail" data-testid="deck-detail">
            <div class="picker-detail-text">
              <h3>
                {deck.name}
                <ColorDots deck={deck} />
              </h3>
              <p>{deck.description}</p>
            </div>
            <button type="button" class="btn secondary" aria-label={`Ver el mazo ${deck.name}`} data-testid={`deck-view-${deck.id}`} onClick={() => onView(deck)}>
              Cartas
            </button>
          </div>
          <div class="picker-grid" role="radiogroup" aria-label="Tu mazo inicial">
            {decks.map((candidate, index) => (
              <DeckOption
                key={candidate.id}
                deck={candidate}
                index={index}
                checked={candidate.id === deck.id}
                testId={`expedition-deck-${candidate.id}`}
                onSelect={() => setSelected(candidate.id)}
              />
            ))}
          </div>
        </section>
      </div>
      <div class="start-actions">
        <button type="button" class="btn" data-testid="btn-expedition-start" onClick={() => onStart(deck)}>
          Empezar con {deck.name}
        </button>
      </div>
    </>
  );
}

interface RunMapProps {
  run: ExpeditionRun;
  problem: string | null;
  onFight: () => void;
  onAbandon: () => void;
  onView: (deck: DeckDef) => void;
}

function RunMap({ run, problem, onFight, onAbandon, onView }: RunMapProps) {
  const deck = runDeck(run);
  const rival = currentRival(run);
  return (
    <>
      <div class="expedition-body" data-testid="expedition-map">
        <ol class="floors" aria-label="Rivales de la expedición">
          {run.rivals.map((candidate, index) => {
            const state = index < run.wins ? 'won' : index === run.wins ? 'current' : 'next';
            const rivalDeck = getDeck(candidate.deck);
            return (
              <li
                key={candidate.deck}
                class={`floor ${state}${candidate.boss ? ' boss' : ''}`}
                data-testid={`expedition-floor-${index + 1}`}
                data-state={state}
                data-deck={candidate.deck}
                aria-current={state === 'current' ? 'step' : undefined}
              >
                <span class="floor-mark num" aria-hidden="true">
                  {state === 'won' ? <CheckIcon /> : index + 1}
                </span>
                <span class="floor-box">
                  <DeckBox deck={rivalDeck} open={false} />
                </span>
                <span class="floor-text">
                  <b>
                    {candidate.boss && <CrownIcon />}
                    {candidate.boss ? `Jefe: ${rivalDeck.name}` : rivalDeck.name}
                  </b>
                  <span>{state === 'won' ? 'Vencido' : rivalTerms(candidate)}</span>
                </span>
              </li>
            );
          })}
        </ol>

        <section class="run-panel" aria-label="Tu mazo y tus reliquias">
          <div class="run-deck">
            <span class="floor-box">
              <DeckBox deck={deck} open={false} />
            </span>
            <span class="floor-text">
              <b>{deck.name}</b>
              <span class="num" data-testid="run-deck-size">
                {cardsWord(deckSizeOf(run))} · {changesLabel(run)}
              </span>
            </span>
            <button type="button" class="btn secondary" data-testid="btn-expedition-deck" onClick={() => onView(deck)}>
              Ver mazo
            </button>
          </div>
          <h2 class="section-label">Reliquias</h2>
          <RelicList relics={run.relics} />
        </section>
        {problem && (
          <p class="field-hint problem" data-testid="expedition-problem">
            {problem}
          </p>
        )}
      </div>
      <div class="start-actions">
        <button type="button" class="btn secondary" data-testid="btn-expedition-abandon" onClick={onAbandon}>
          Abandonar
        </button>
        <button type="button" class="btn" data-testid="btn-expedition-fight" disabled={!!problem || !rival} onClick={onFight}>
          {run.duel ? 'Continuar el duelo' : `Luchar: duelo ${run.wins + 1}`}
        </button>
      </div>
    </>
  );
}

interface CardRewardProps {
  run: ExpeditionRun;
  offers: string[];
  onTake: (card: string) => void;
  onSkip: () => void;
}

function CardReward({ run, offers, onTake, onSkip }: CardRewardProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const def = selected ? getCardDef(selected) : null;
  return (
    <>
      <div class="expedition-body" data-testid="expedition-reward">
        <header class="reward-head">
          <p class="eyebrow num">
            Duelo {run.wins} de {run.rivals.length} superado
          </p>
          <h2>Elige una carta para tu mazo</h2>
        </header>
        <div class="offers" role="radiogroup" aria-label="Cartas que puedes llevarte">
          {offers.map((card) => {
            const offer = getCardDef(card);
            return (
              <button
                key={card}
                type="button"
                role="radio"
                aria-checked={card === selected}
                aria-label={offer.name}
                class={`card mini deck-card offer${offer.types.includes('land') ? ' land' : ''}`}
                style={cssVars({ '--card-color': cardColorVar(offer) })}
                data-testid={`reward-card-${card}`}
                onClick={() => setSelected(card)}
              >
                <MiniFace def={offer} />
              </button>
            );
          })}
        </div>
        {def ? (
          <div class="offer-detail" data-testid="reward-detail">
            <CardDetail
              def={def}
              face={null}
              statuses={[{ text: copiesOf(run, def.id) === 0 ? 'Nueva en tu mazo' : `Ya tienes ${copiesOf(run, def.id)} en tu mazo` }]}
            />
          </div>
        ) : (
          <p class="run-note">Toca una carta para leerla. Después decidirás qué carta de tu mazo le deja sitio.</p>
        )}
      </div>
      <div class="start-actions">
        <button type="button" class="btn secondary" data-testid="btn-reward-skip" onClick={onSkip}>
          Saltar
        </button>
        <button type="button" class="btn" data-testid="btn-reward-take" disabled={!selected} onClick={() => selected && onTake(selected)}>
          Llevármela
        </button>
      </div>
    </>
  );
}

interface SwapCardProps {
  run: ExpeditionRun;
  card: string;
  onSwap: (out: string | null) => void;
}

function SwapCard({ run, card, onSwap }: SwapCardProps) {
  const [out, setOut] = useState<string | null>(null);
  const [inspected, setInspected] = useState<string | null>(null);
  const incoming = getCardDef(card);
  const deck = runDeck(run);
  return (
    <>
      <div class="expedition-body" data-testid="expedition-swap">
        <header class="reward-head swap-head">
          <button
            type="button"
            class="card mini deck-card incoming"
            style={cssVars({ '--card-color': cardColorVar(incoming) })}
            data-testid="swap-incoming"
            aria-label={`Ver ${incoming.name}`}
            onClick={() => setInspected(card)}
          >
            <MiniFace def={incoming} />
          </button>
          <div>
            <p class="eyebrow">Entra {incoming.name}</p>
            <h2>¿Qué carta sale de tu mazo?</h2>
            <p class="run-note">Tócala, o añade la nueva sin quitar ninguna: tu mazo tendrá más cartas.</p>
          </div>
        </header>
        {deckGroups(deck).map((group) => (
          <section key={group.title} class="deck-section" aria-label={group.title}>
            <h3>{group.title}</h3>
            <div class="deck-grid" role="radiogroup" aria-label={group.title}>
              {group.entries.map((entry) => {
                const def = getCardDef(entry.card);
                return (
                  <button
                    key={entry.card}
                    type="button"
                    role="radio"
                    aria-checked={entry.card === out}
                    aria-label={`${entry.count} × ${def.name}`}
                    class={`card mini deck-card swap-option${def.types.includes('land') ? ' land' : ''}`}
                    style={cssVars({ '--card-color': cardColorVar(def) })}
                    data-testid={`swap-card-${entry.card}`}
                    data-count={entry.count}
                    onClick={() => setOut(entry.card === out ? null : entry.card)}
                  >
                    <MiniFace def={def} />
                    <span class="copies num" aria-hidden="true">
                      ×{entry.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
      <div class="start-actions">
        <button type="button" class="btn secondary" data-testid="btn-swap-add" onClick={() => onSwap(null)}>
          Añadir sin quitar
        </button>
        <button
          type="button"
          class="btn"
          data-testid="btn-swap-confirm"
          aria-label={out ? `Cambiar ${getCardDef(out).name} por ${incoming.name}` : undefined}
          disabled={!out}
          onClick={() => out && onSwap(out)}
        >
          {out ? 'Cambiar' : 'Elige qué sale'}
        </button>
      </div>
      {inspected && (
        <Sheet label={getCardDef(inspected).name} onClose={() => setInspected(null)}>
          <CardDetail def={getCardDef(inspected)} face={<DetailFace def={getCardDef(inspected)} />} />
        </Sheet>
      )}
    </>
  );
}

interface RelicRewardProps {
  run: ExpeditionRun;
  offers: RelicId[];
  onTake: (relic: RelicId) => void;
}

function RelicReward({ run, offers, onTake }: RelicRewardProps) {
  const [selected, setSelected] = useState<RelicId | null>(null);
  return (
    <>
      <div class="expedition-body" data-testid="expedition-relics">
        <header class="reward-head">
          <p class="eyebrow num">{run.wins} victorias</p>
          <h2>Elige una reliquia</h2>
          <p class="run-note">Te acompaña en cada duelo hasta el final de la expedición.</p>
        </header>
        <div class="relic-options" role="radiogroup" aria-label="Reliquias que puedes llevarte">
          {offers.map((id) => {
            const relic = relicOf(id);
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={id === selected}
                class="relic-option"
                data-testid={`relic-option-${id}`}
                onClick={() => setSelected(id)}
              >
                <RelicIcon relic={id} />
                <span>
                  <b>{relic.name}</b>
                  {relic.text}
                </span>
              </button>
            );
          })}
        </div>
        {run.relics.length > 0 && (
          <>
            <h2 class="section-label">Ya tienes</h2>
            <RelicList relics={run.relics} />
          </>
        )}
      </div>
      <div class="start-actions">
        <button type="button" class="btn" data-testid="btn-relic-take" disabled={!selected} onClick={() => selected && onTake(selected)}>
          {selected ? `Llevarme ${relicOf(selected).name}` : 'Elige una reliquia'}
        </button>
      </div>
    </>
  );
}

interface RunResultProps {
  run: ExpeditionRun;
  onNew: () => void;
  onHome: () => void;
  onView: (deck: DeckDef) => void;
}

function RunResult({ run, onNew, onHome, onView }: RunResultProps) {
  const won = run.stage.kind === 'won';
  const fallen = run.history.at(-1);
  return (
    <>
      <div class="expedition-body" data-testid="expedition-result" data-result={won ? 'won' : 'lost'}>
        <header class="reward-head result-head">
          <h2 data-testid="expedition-result-title">{won ? '¡Expedición completada!' : 'Fin de la expedición'}</h2>
          <p class="run-note">
            {won
              ? `Has vencido a los ${run.rivals.length} rivales con ${run.base.name}.`
              : `Caíste en el duelo ${run.wins + 1} de ${run.rivals.length}${fallen ? `, ante ${deckName(fallen.rival)}` : ''}.`}
          </p>
        </header>
        <div class="run-stats">
          <span>
            <b class="num">
              {run.wins}/{run.rivals.length}
            </b>
            victorias
          </span>
          <span>
            <b class="num">{run.relics.length}</b>
            {run.relics.length === 1 ? 'reliquia' : 'reliquias'}
          </span>
          <span>
            <b class="num">{run.added.length}</b>
            {run.added.length === 1 ? 'carta nueva' : 'cartas nuevas'}
          </span>
        </div>
        <ol class="run-history" aria-label="Duelos">
          {run.history.map((record, index) => (
            <li key={`${record.rival}-${index}`} data-result={record.result}>
              <span>{deckName(record.rival)}</span>
              <span class="num">
                {resultWord(record)} · {record.turns} {record.turns === 1 ? 'turno' : 'turnos'}
              </span>
            </li>
          ))}
        </ol>
        {run.relics.length > 0 && <RelicList relics={run.relics} />}
        <button type="button" class="btn secondary result-deck" data-testid="btn-expedition-deck" onClick={() => onView(runDeck(run))}>
          Ver el mazo final
        </button>
      </div>
      <div class="start-actions">
        <button type="button" class="btn secondary" data-testid="btn-expedition-home" onClick={onHome}>
          Menú principal
        </button>
        <button type="button" class="btn" data-testid="btn-expedition-new" onClick={onNew}>
          Nueva expedición
        </button>
      </div>
    </>
  );
}

export function ExpeditionScreen({ expedition, customs = [], initialDeck, problem, onFight, onHome }: ExpeditionScreenProps) {
  useSubscription(expedition);
  const run = expedition.run;
  const [choosing, setChoosing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [viewing, setViewing] = useState<DeckDef | null>(null);
  const fresh = run === null || choosing;
  const stage = fresh ? 'new' : run.stage.kind;

  let body;
  if (fresh) {
    body = (
      <NewRun
        decks={[...DECK_LIST, ...customs]}
        initialDeck={run?.base.id ?? initialDeck}
        onView={setViewing}
        onStart={(deck) => {
          expedition.start(deck);
          setChoosing(false);
        }}
      />
    );
  } else {
    switch (run.stage.kind) {
      case 'duel':
        body = <RunMap run={run} problem={problem} onFight={onFight} onAbandon={() => setConfirming(true)} onView={setViewing} />;
        break;
      case 'card':
        body = <CardReward key={run.wins} run={run} offers={run.stage.offers} onTake={(card) => expedition.chooseCard(card)} onSkip={() => expedition.chooseCard(null)} />;
        break;
      case 'swap':
        body = <SwapCard key={run.stage.card} run={run} card={run.stage.card} onSwap={(out) => expedition.swapCard(out)} />;
        break;
      case 'relic':
        body = <RelicReward key={run.wins} run={run} offers={run.stage.offers} onTake={(relic) => expedition.chooseRelic(relic)} />;
        break;
      case 'won':
      case 'lost':
        body = <RunResult run={run} onNew={() => setChoosing(true)} onHome={onHome} onView={setViewing} />;
        break;
    }
  }

  const detail = fresh || !run ? undefined : `${run.wins}/${run.rivals.length}`;
  return (
    <main class="expedition" data-testid="expedition" data-stage={stage}>
      <ScreenBar title="Expedición" detail={detail} backLabel="Volver al menú principal" backTestId="btn-expedition-back" onBack={onHome} />
      {body}
      {confirming && run && (
        <div class="scrim center-modal" data-testid="expedition-abandon" onClick={() => setConfirming(false)}>
          <div class="modal" role="dialog" aria-label="Abandonar la expedición" onClick={(event) => event.stopPropagation()}>
            <h2 class="modal-title">¿Abandonar?</h2>
            <p>
              Perderás la expedición con {run.base.name}: {run.wins} {run.wins === 1 ? 'victoria' : 'victorias'}, {cardsWord(run.added.length)} nuevas y{' '}
              {run.relics.length} {run.relics.length === 1 ? 'reliquia' : 'reliquias'}.
            </p>
            <div class="sheet-actions">
              <button
                type="button"
                class="btn danger"
                data-testid="btn-abandon-yes"
                onClick={() => {
                  setConfirming(false);
                  expedition.abandon();
                }}
              >
                Abandonar la expedición
              </button>
              <button type="button" class="btn secondary" data-testid="btn-abandon-no" onClick={() => setConfirming(false)}>
                Seguir
              </button>
            </div>
          </div>
        </div>
      )}
      {viewing && <DeckViewer tabs={[{ key: viewing.id, label: viewing.name, deck: viewing }]} onClose={() => setViewing(null)} />}
    </main>
  );
}
