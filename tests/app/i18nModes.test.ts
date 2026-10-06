import { afterEach, describe, expect, it } from 'vitest';
import { GameController } from '../../src/app/controller';
import { aiDraftDeck, createDraft, defaultDraftName } from '../../src/app/draft';
import { baseName, changesLabel, createRun, runDeck, type ExpeditionRun } from '../../src/app/expedition';
import { ExpeditionController, type RunStore } from '../../src/app/expeditionController';
import { RELICS, VIGOR_LIFE, relicOf } from '../../src/app/relics';
import { getDeck, resolveDeck, type DeckDef } from '../../src/engine';
import { setLocale } from '../../src/i18n';
import { spanishIn } from '../i18n';

afterEach(() => {
  setLocale('es');
});

function memoryStore(): RunStore {
  let saved: unknown = null;
  return {
    load: () => JSON.parse(JSON.stringify(saved)) as unknown,
    save: (run: ExpeditionRun | null) => {
      saved = run === null ? null : JSON.parse(JSON.stringify(run));
    },
  };
}

describe('the modes in English', () => {
  it('name and describe every relic in English', () => {
    setLocale('en');
    for (const relic of RELICS) expect(spanishIn(`${relic.name} ${relic.text}`), relic.id).toEqual([]);
    expect(new Set(RELICS.map((relic) => relic.name)).size).toBe(RELICS.length);
    expect(relicOf('vigor')).toEqual({
      id: 'vigor',
      name: 'Amulet of Vigor',
      text: `You start each duel with ${VIGOR_LIFE} more life.`,
      kind: 'start',
      owner: 'any',
    });
    expect(relicOf('banner').text).toBe('You start each duel with a 1/1 white Soldier creature token.');
    expect(relicOf('bell')).toEqual({
      id: 'bell',
      name: 'Funeral Bell',
      text: 'At the beginning of your upkeep, each opponent loses 1 life.',
      kind: 'play',
      owner: 'boss',
    });
  });

  it('switch the relics’ names and texts with the language', () => {
    const vigor = relicOf('vigor');
    expect(vigor.name).toBe('Amuleto de vigor');
    setLocale('en');
    expect(vigor.name).toBe('Amulet of Vigor');
    expect(relicOf('phoenix').text).toBe(
      'The first time you lose a duel, the feather burns and you replay it instead of ending the expedition.',
    );
    setLocale('es');
    expect(vigor.text).toBe(`Empiezas cada duelo con ${VIGOR_LIFE} vidas más.`);
  });

  it('show a run started in Spanish under the English name of its built-in deck, and a deck of your own under its own name', () => {
    const run = createRun(getDeck('emberwild'), 3);
    expect(run.base.name).toBe('Brasalvaje');
    setLocale('en');
    expect(baseName(run)).toBe('Emberwild');
    expect(runDeck(run)).toMatchObject({
      name: 'Emberwild',
      description: 'Your expedition deck: Emberwild, unchanged.',
    });
    expect(changesLabel({ ...run, added: ['ember_snap'] })).toBe('with 1 new card');
    expect(changesLabel({ ...run, added: ['ember_snap', 'magma_lance'] })).toBe('with 2 new cards');
    const mine: DeckDef = { ...getDeck('emberwild'), id: 'mine-1', name: 'Mi mazo rojo' };
    expect(baseName(createRun(mine, 3))).toBe('Mi mazo rojo');
  });

  it('name a new draft and the AI’s draft deck in the current language', () => {
    setLocale('en');
    expect(defaultDraftName()).toBe('My draft');
    const run = createDraft('sealed', 3);
    expect(run.name).toBe('My draft');
    expect(aiDraftDeck(run)).toMatchObject({
      name: "The AI's draft",
      description: 'The deck the AI built from its cards.',
    });
    setLocale('es');
    expect(aiDraftDeck(run)).toMatchObject({
      name: 'Draft de la IA',
      description: 'El mazo que la IA se construyó con sus cartas.',
    });
  });

  it('resume a duel saved in Spanish with the English names of its decks', () => {
    const store = memoryStore();
    const controller = new GameController({ seed: 5, aiDelayMs: 0 });
    const expedition = new ExpeditionController(controller, store);
    expedition.start(getDeck('cindermaw'), 9);
    expedition.fight();
    controller.dispatch({ type: 'keep', player: 0 });
    controller.settle();
    expedition.flush();
    expect(resolveDeck(controller.decks?.[0] ?? 'emberwild').name).toBe('Fauceniza');
    const state = controller.state;
    setLocale('en');
    const later = new GameController({ seed: 5, aiDelayMs: 0 });
    new ExpeditionController(later, store).fight();
    expect(later.state.actionCount).toBe(state.actionCount);
    expect(resolveDeck(later.decks?.[0] ?? 'emberwild')).toMatchObject({
      name: 'Cindermaw',
      description: 'Your expedition deck: Cindermaw, unchanged.',
    });
  });
});
