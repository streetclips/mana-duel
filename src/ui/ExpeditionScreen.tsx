import { useState } from 'preact/hooks';
import {
  DUELS,
  RELIC_EVERY,
  RIVAL_RELICS,
  baseName,
  changesLabel,
  copiesOf,
  currentRival,
  deckSizeOf,
  rivalStart,
  runDeck,
  type DuelRecord,
  type ExpeditionRun,
  type Rival,
} from '../app/expedition';
import type { DuelInfo, ExpeditionController } from '../app/expeditionController';
import { relicOf, type RelicId } from '../app/relics';
import { DECK_LIST, OPENING_HAND, getCardDef, getDeck, hasCardDef, hasDeck, localizeDeck, type DeckDef } from '../engine';
import { MiniCard } from './components/Card';
import { DeckBox } from './components/DeckBox';
import { DeckOption } from './components/DeckSelect';
import { ColorDots, DeckViewer, deckGroups } from './components/DeckViewer';
import { CheckIcon, CrownIcon, RelicIcon } from './components/ModeIcons';
import { CardDefSheet, Sheet } from './components/Overlays';
import { ScreenBar } from './components/ScreenBar';
import { expeditionText } from './text/expedition';
import { useSubscription } from './useController';

interface ExpeditionScreenProps {
  expedition: ExpeditionController;
  customs?: readonly DeckDef[];
  initialDeck: string;
  problem: string | null;
  onFight: () => void;
  onHome: () => void;
}

function countWord(count: number): string {
  return expeditionText().countWords[count] ?? String(count);
}

function firstArmed(): string {
  const text = expeditionText();
  return text.ordinals[RIVAL_RELICS.findIndex((count) => count > 0)] ?? text.lastOrdinal;
}

function capitalized(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function rivalTerms(run: ExpeditionRun, rival: Rival): string {
  const text = expeditionText();
  const start = rivalStart(run, rival);
  const hand = start.openingHand === OPENING_HAND ? '' : text.openingHand(start.openingHand);
  return `${text.lives(start.life)}${hand}`;
}

export function duelBadge(number: number, total: number, boss: boolean): string {
  return expeditionText().duelBadge(number, total, boss);
}

export function duelOutcome(duel: DuelInfo): string | null {
  const text = expeditionText();
  switch (duel.result) {
    case null:
      return null;
    case 'won':
      return duel.number === duel.total ? text.bossBeaten : text.duelCleared(duel.number, duel.total);
    case 'lost':
      return duel.revived ? text.phoenixBurns : text.runOver;
    case 'draw':
      return text.drawReplay;
  }
}

export function expeditionStatus(run: ExpeditionRun | null): string {
  const text = expeditionText();
  if (!run) return text.statusNew(capitalized(countWord(DUELS)));
  if (run.stage.kind === 'won') return text.statusWon(baseName(run));
  if (run.stage.kind === 'lost') return text.statusLost(run.wins + 1, run.rivals.length);
  return text.statusOngoing(baseName(run), run.wins, run.rivals.length);
}

function deckName(id: string): string {
  return hasDeck(id) ? getDeck(id).name : id;
}

function resultWord(record: DuelRecord): string {
  return expeditionText().results[record.result];
}

function RelicList({ relics, spent = [] }: { relics: readonly RelicId[]; spent?: readonly RelicId[] }) {
  const text = expeditionText();
  if (relics.length === 0) {
    return <p class="run-note">{text.noRelics(countWord(RELIC_EVERY))}</p>;
  }
  return (
    <ul class="relic-list">
      {relics.map((id) => {
        const relic = relicOf(id);
        const used = spent.includes(id);
        return (
          <li key={id} class={`relic-chip${used ? ' spent' : ''}`} data-testid={`relic-${id}`} data-spent={used ? 'true' : undefined}>
            <RelicIcon relic={id} />
            <span>
              <b>
                {relic.name}
                {used && <span class="relic-used">{text.used}</span>}
              </b>
              {relic.text}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

interface RelicSheetProps {
  relic: RelicId;
  holder: string;
  onClose: () => void;
}

function RelicSheet({ relic, holder, onClose }: RelicSheetProps) {
  const { name, text, owner } = relicOf(relic);
  const flavor = hasCardDef(relic) ? getCardDef(relic).flavor : undefined;
  return (
    <Sheet label={name} testId="relic-sheet" onClose={onClose}>
      <div class="relic-detail">
        <RelicIcon relic={relic} />
        <div>
          <h3>{name}</h3>
          <p class="relic-holder">{holder}</p>
          {owner === 'boss' && <p class="relic-boss">{expeditionText().bossOnly}</p>}
          <p>{text}</p>
          {flavor && <p class="flavor">{flavor}</p>}
        </div>
      </div>
    </Sheet>
  );
}

function RivalRelics({ rival, onRead }: { rival: Rival; onRead: (relic: RelicId) => void }) {
  if (rival.relics.length === 0) return null;
  return (
    <span class="floor-relics">
      {rival.relics.map((id) => (
        <button
          key={id}
          type="button"
          class={`relic-pill${relicOf(id).owner === 'boss' ? ' boss' : ''}`}
          data-testid={`rival-relic-${id}`}
          onClick={() => onRead(id)}
        >
          <RelicIcon relic={id} />
          {relicOf(id).name}
        </button>
      ))}
    </span>
  );
}

interface NewRunProps {
  decks: readonly DeckDef[];
  initialDeck: string;
  onStart: (deck: DeckDef) => void;
  onView: (deck: DeckDef) => void;
}

function NewRun({ decks, initialDeck, onStart, onView }: NewRunProps) {
  const text = expeditionText();
  const [selected, setSelected] = useState(initialDeck);
  const deck = decks.find((candidate) => candidate.id === selected) ?? decks[0] ?? getDeck(DECK_LIST[0]?.id ?? '');
  return (
    <>
      <div class="expedition-body" data-testid="expedition-new">
        <p class="run-intro">{text.intro(capitalized(countWord(DUELS)), firstArmed(), countWord(RELIC_EVERY))}</p>
        <section class="picker run-picker" aria-label={text.startingDeck}>
          <header class="picker-head">
            <h2 class="section-label">{text.startingDeck}</h2>
            <span class="picker-count num">{text.deckCount(decks.length)}</span>
          </header>
          <div class="picker-detail" data-testid="deck-detail">
            <div class="picker-detail-text">
              <h3>
                {deck.name}
                <ColorDots deck={deck} />
              </h3>
              <p>{deck.description}</p>
            </div>
            <button type="button" class="btn secondary" aria-label={text.viewDeck(deck.name)} data-testid={`deck-view-${deck.id}`} onClick={() => onView(deck)}>
              {text.cardsButton}
            </button>
          </div>
          <div class="picker-grid" role="radiogroup" aria-label={text.startingDeck}>
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
          {text.startWith(deck.name)}
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
  const text = expeditionText();
  const deck = runDeck(run);
  const rival = currentRival(run);
  const [reading, setReading] = useState<{ relic: RelicId; holder: string } | null>(null);
  return (
    <>
      <div class="expedition-body" data-testid="expedition-map">
        <ol class="floors" aria-label={text.rivals}>
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
                    {candidate.boss ? text.boss(rivalDeck.name) : rivalDeck.name}
                  </b>
                  <span>{state === 'won' ? text.defeated : rivalTerms(run, candidate)}</span>
                  {state !== 'won' && (
                    <RivalRelics
                      rival={candidate}
                      onRead={(relic) => setReading({ relic, holder: candidate.boss ? text.bossRelicHolder(rivalDeck.name) : text.relicHolder(rivalDeck.name) })}
                    />
                  )}
                </span>
              </li>
            );
          })}
        </ol>

        <section class="run-panel" aria-label={text.deckAndRelics}>
          <div class="run-deck">
            <span class="floor-box">
              <DeckBox deck={deck} open={false} />
            </span>
            <span class="floor-text">
              <b>{deck.name}</b>
              <span class="num" data-testid="run-deck-size">
                {text.cards(deckSizeOf(run))} · {changesLabel(run)}
              </span>
            </span>
            <button type="button" class="btn secondary" data-testid="btn-expedition-deck" onClick={() => onView(deck)}>
              {text.viewRunDeck}
            </button>
          </div>
          <h2 class="section-label">{text.relics}</h2>
          <RelicList relics={run.relics} spent={run.spent} />
        </section>
        {problem && (
          <p class="field-hint problem" data-testid="expedition-problem">
            {problem}
          </p>
        )}
      </div>
      <div class="start-actions">
        <button type="button" class="btn secondary" data-testid="btn-expedition-abandon" onClick={onAbandon}>
          {text.abandon}
        </button>
        <button type="button" class="btn" data-testid="btn-expedition-fight" disabled={!!problem || !rival} onClick={onFight}>
          {run.duel ? text.continueDuel : text.fight(run.wins + 1)}
        </button>
      </div>
      {reading && <RelicSheet relic={reading.relic} holder={reading.holder} onClose={() => setReading(null)} />}
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
  const text = expeditionText();
  const [selected, setSelected] = useState<string | null>(null);
  const [inspected, setInspected] = useState<string | null>(null);
  const copies = inspected ? copiesOf(run, inspected) : 0;
  return (
    <>
      <div class="expedition-body" data-testid="expedition-reward">
        <header class="reward-head">
          <p class="eyebrow num">{text.rewardEyebrow(run.wins, run.rivals.length)}</p>
          <h2>{text.chooseCard}</h2>
        </header>
        <div class="offers" role="radiogroup" aria-label={text.cardOffers}>
          {offers.map((card) => (
            <MiniCard
              key={card}
              def={getCardDef(card)}
              label={getCardDef(card).name}
              className="offer"
              testId={`reward-card-${card}`}
              checked={card === selected}
              onTap={() => setSelected(card)}
              onInspect={() => setInspected(card)}
            />
          ))}
        </div>
        <p class="run-note">{text.rewardNote}</p>
      </div>
      <div class="start-actions">
        <button type="button" class="btn secondary" data-testid="btn-reward-skip" onClick={onSkip}>
          {text.skip}
        </button>
        <button type="button" class="btn" data-testid="btn-reward-take" disabled={!selected} onClick={() => selected && onTake(selected)}>
          {text.take}
        </button>
      </div>
      {inspected && (
        <CardDefSheet
          def={getCardDef(inspected)}
          statuses={[{ text: copies === 0 ? text.newInDeck : text.copiesInDeck(copies) }]}
          onClose={() => setInspected(null)}
        />
      )}
    </>
  );
}

interface SwapCardProps {
  run: ExpeditionRun;
  card: string;
  onSwap: (out: string | null) => void;
}

function SwapCard({ run, card, onSwap }: SwapCardProps) {
  const text = expeditionText();
  const [out, setOut] = useState<string | null>(null);
  const [inspected, setInspected] = useState<string | null>(null);
  const incoming = getCardDef(card);
  const deck = runDeck(run);
  return (
    <>
      <div class="expedition-body" data-testid="expedition-swap">
        <header class="reward-head swap-head">
          <MiniCard
            def={incoming}
            label={text.viewCard(incoming.name)}
            className="incoming"
            testId="swap-incoming"
            onTap={() => setInspected(card)}
            onInspect={() => setInspected(card)}
          />
          <div>
            <p class="eyebrow">{text.incoming(incoming.name)}</p>
            <h2>{text.whichLeaves}</h2>
            <p class="run-note">{text.swapNote}</p>
          </div>
        </header>
        {deckGroups(deck).map((group) => (
          <section key={group.title} class="deck-section" aria-label={group.title}>
            <h3>{group.title}</h3>
            <div class="deck-grid" role="radiogroup" aria-label={group.title}>
              {group.entries.map((entry) => (
                <MiniCard
                  key={entry.card}
                  def={getCardDef(entry.card)}
                  label={`${entry.count} × ${getCardDef(entry.card).name}`}
                  className="swap-option"
                  testId={`swap-card-${entry.card}`}
                  checked={entry.card === out}
                  count={entry.count}
                  onTap={() => setOut(entry.card === out ? null : entry.card)}
                  onInspect={() => setInspected(entry.card)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
      <div class="start-actions">
        <button type="button" class="btn secondary" data-testid="btn-swap-add" onClick={() => onSwap(null)}>
          {text.addWithoutRemoving}
        </button>
        <button
          type="button"
          class="btn"
          data-testid="btn-swap-confirm"
          aria-label={out ? text.swapLabel(getCardDef(out).name, incoming.name) : undefined}
          disabled={!out}
          onClick={() => out && onSwap(out)}
        >
          {out ? text.swap : text.chooseOut}
        </button>
      </div>
      {inspected && <CardDefSheet def={getCardDef(inspected)} onClose={() => setInspected(null)} />}
    </>
  );
}

interface RelicRewardProps {
  run: ExpeditionRun;
  offers: RelicId[];
  onTake: (relic: RelicId) => void;
}

function RelicReward({ run, offers, onTake }: RelicRewardProps) {
  const text = expeditionText();
  const [selected, setSelected] = useState<RelicId | null>(null);
  return (
    <>
      <div class="expedition-body" data-testid="expedition-relics">
        <header class="reward-head">
          <p class="eyebrow num">{text.winsEyebrow(run.wins)}</p>
          <h2>{text.chooseRelic}</h2>
          <p class="run-note">{text.relicNote}</p>
        </header>
        <div class="relic-options" role="radiogroup" aria-label={text.relicOffers}>
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
            <h2 class="section-label">{text.alreadyHave}</h2>
            <RelicList relics={run.relics} spent={run.spent} />
          </>
        )}
      </div>
      <div class="start-actions">
        <button type="button" class="btn" data-testid="btn-relic-take" disabled={!selected} onClick={() => selected && onTake(selected)}>
          {selected ? text.takeRelic(relicOf(selected).name) : text.chooseRelic}
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
  const text = expeditionText();
  const won = run.stage.kind === 'won';
  const fallen = run.history.at(-1);
  return (
    <>
      <div class="expedition-body" data-testid="expedition-result" data-result={won ? 'won' : 'lost'}>
        <header class="reward-head result-head">
          <h2 data-testid="expedition-result-title">{won ? text.wonTitle : text.lostTitle}</h2>
          <p class="run-note">
            {won ? text.wonNote(run.rivals.length, baseName(run)) : text.lostNote(run.wins + 1, run.rivals.length, fallen ? deckName(fallen.rival) : null)}
          </p>
        </header>
        <div class="run-stats">
          <span>
            <b class="num">
              {run.wins}/{run.rivals.length}
            </b>
            {text.winsStat}
          </span>
          <span>
            <b class="num">{run.relics.length}</b>
            {text.relicsStat(run.relics.length)}
          </span>
          <span>
            <b class="num">{run.added.length}</b>
            {text.newCardsStat(run.added.length)}
          </span>
        </div>
        <ol class="run-history" aria-label={text.duels}>
          {run.history.map((record, index) => (
            <li key={`${record.rival}-${index}`} data-result={record.result}>
              <span>{deckName(record.rival)}</span>
              <span class="num">
                {resultWord(record)} · {text.turns(record.turns)}
              </span>
            </li>
          ))}
        </ol>
        {run.relics.length > 0 && <RelicList relics={run.relics} spent={run.spent} />}
        <button type="button" class="btn secondary result-deck" data-testid="btn-expedition-deck" onClick={() => onView(runDeck(run))}>
          {text.viewFinalDeck}
        </button>
      </div>
      <div class="start-actions">
        <button type="button" class="btn secondary" data-testid="btn-expedition-home" onClick={onHome}>
          {text.mainMenu}
        </button>
        <button type="button" class="btn" data-testid="btn-expedition-new" onClick={onNew}>
          {text.newExpedition}
        </button>
      </div>
    </>
  );
}

export function ExpeditionScreen({ expedition, customs = [], initialDeck, problem, onFight, onHome }: ExpeditionScreenProps) {
  useSubscription(expedition);
  const text = expeditionText();
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
        decks={[...DECK_LIST.map(localizeDeck), ...customs]}
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
      <ScreenBar title={text.title} detail={detail} backLabel={text.backToMenu} backTestId="btn-expedition-back" onBack={onHome} />
      {body}
      {confirming && run && (
        <div class="scrim center-modal" data-testid="expedition-abandon" onClick={() => setConfirming(false)}>
          <div class="modal" role="dialog" aria-label={text.abandonRun} onClick={(event) => event.stopPropagation()}>
            <h2 class="modal-title">{text.abandonTitle}</h2>
            <p>{text.abandonWarning(baseName(run), run.wins, run.added.length, run.relics.length)}</p>
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
                {text.abandonRun}
              </button>
              <button type="button" class="btn secondary" data-testid="btn-abandon-no" onClick={() => setConfirming(false)}>
                {text.keepGoing}
              </button>
            </div>
          </div>
        </div>
      )}
      {viewing && <DeckViewer tabs={[{ key: viewing.id, label: viewing.name, deck: viewing }]} onClose={() => setViewing(null)} />}
    </main>
  );
}
