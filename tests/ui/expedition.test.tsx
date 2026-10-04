// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/preact';
import { afterEach, describe, expect, it } from 'vitest';
import { GameController } from '../../src/app/controller';
import { chooseRelic, createRun, recordDuel, type ExpeditionRun } from '../../src/app/expedition';
import { ExpeditionController } from '../../src/app/expeditionController';
import { getDeck } from '../../src/engine';
import { App, type Screen } from '../../src/ui/App';
import { localRunStore } from '../../src/ui/expeditionStore';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function setup(initialScreen: Screen = 'start', run?: ExpeditionRun) {
  if (run) localRunStore.save(run);
  const controller = new GameController({ seed: 5, aiDelayMs: 0, startingPlayer: 0 });
  const expedition = new ExpeditionController(controller, localRunStore);
  render(<App controller={controller} initialScreen={initialScreen} expedition={expedition} />);
  const settle = (): void => {
    act(() => controller.settle());
  };
  return { controller, expedition, settle };
}

const byTestId = (id: string): HTMLElement => screen.getByTestId(id);

function click(element: HTMLElement): void {
  fireEvent.click(element);
}

function stored(): ExpeditionRun | null {
  return localRunStore.load() as ExpeditionRun | null;
}

function cardOffer(seed = 11): ExpeditionRun {
  return recordDuel(createRun(getDeck('emberwild'), seed), 'won', 9);
}

function offersOf(run: ExpeditionRun): string[] {
  if (run.stage.kind !== 'card') throw new Error('expected a card offer');
  return run.stage.offers;
}

describe('starting an expedition', () => {
  it('opens from the start screen, starts a run with the chosen deck and shows its rivals', () => {
    setup();
    expect(byTestId('btn-expedition-status').textContent).toBe('Siete duelos seguidos con un mismo mazo');
    click(byTestId('btn-expedition'));
    expect(byTestId('expedition').dataset.stage).toBe('new');
    expect(byTestId('expedition-deck-emberwild').getAttribute('aria-checked')).toBe('true');
    click(byTestId('expedition-deck-dawntide'));
    expect(byTestId('deck-detail').textContent).toContain('Albamar');
    click(byTestId('btn-expedition-start'));
    const run = stored();
    expect(run?.base.id).toBe('dawntide');
    expect(byTestId('expedition').dataset.stage).toBe('duel');
    const floors = within(byTestId('expedition-map')).getAllByRole('listitem');
    expect(floors).toHaveLength(7);
    expect(floors.map((floor) => floor.dataset.state)).toEqual(['current', 'next', 'next', 'next', 'next', 'next', 'next']);
    expect(floors.map((floor) => floor.dataset.deck)).toEqual(run?.rivals.map((rival) => rival.deck));
    expect(byTestId('expedition-floor-1').textContent).toContain('14 vidas · mano de 6');
    expect(byTestId('expedition-floor-7').textContent).toContain('Jefe:');
    expect(byTestId('btn-expedition-fight').textContent).toBe('Luchar: duelo 1');
  });

  it('shows the run on the start screen and back on the expedition screen', () => {
    setup('start', createRun(getDeck('sunmeadow'), 3));
    expect(byTestId('btn-expedition-status').textContent).toBe('En curso con Pradosol: 0 de 7 victorias');
    click(byTestId('btn-expedition'));
    expect(byTestId('expedition').dataset.stage).toBe('duel');
    click(byTestId('btn-expedition-back'));
    expect(byTestId('start-screen')).toBeTruthy();
  });

  it('shows the expedition deck with its card list', () => {
    setup('expedition', createRun(getDeck('duskmire'), 3));
    click(byTestId('btn-expedition-deck'));
    expect(byTestId('deck-viewer').dataset.deck).toBe('expedition');
    expect(byTestId('deck-card-swamp').dataset.count).toBe('16');
    click(byTestId('btn-deck-close'));
    expect(screen.queryByTestId('deck-viewer')).toBeNull();
  });

  it('abandons a run only after confirming', () => {
    setup('expedition', createRun(getDeck('duskmire'), 3));
    click(byTestId('btn-expedition-abandon'));
    click(byTestId('btn-abandon-no'));
    expect(stored()).not.toBeNull();
    click(byTestId('btn-expedition-abandon'));
    click(byTestId('btn-abandon-yes'));
    expect(stored()).toBeNull();
    expect(byTestId('expedition').dataset.stage).toBe('new');
  });

  it('will not fight while the LLM it would play lacks a key', () => {
    localStorage.setItem('manaDuel.opponent', JSON.stringify({ kind: 'llm', model: 'openai/gpt-6-luna', effort: null }));
    setup('expedition', createRun(getDeck('duskmire'), 3));
    expect(byTestId('expedition-problem').textContent).toBe('Escribe tu clave de API de OpenRouter.');
    expect((byTestId('btn-expedition-fight') as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('an expedition duel', () => {
  it('plays the next rival with the expedition deck, a duel badge and no new game in the menu', () => {
    const { controller, settle } = setup('expedition', createRun(getDeck('brightforge'), 4));
    click(byTestId('btn-expedition-fight'));
    settle();
    expect(controller.matchupIds()?.[0]).toBe('expedition');
    expect(byTestId('duel-badge-1').textContent).toBe('Duelo 1/7');
    expect(byTestId('deck-name-0').textContent).toContain('Forjaluz');
    expect(byTestId('life-1').textContent).toBe('14');
    click(byTestId('btn-menu'));
    expect(screen.queryByTestId('menu-new-game')).toBeNull();
    expect(byTestId('menu-home').textContent).toBe('Volver a la expedición');
  });

  it('goes back to the expedition mid-duel and resumes the same duel', () => {
    const { controller, settle } = setup('expedition', createRun(getDeck('brightforge'), 4));
    click(byTestId('btn-expedition-fight'));
    settle();
    const state = controller.state;
    click(byTestId('btn-menu'));
    click(byTestId('menu-home'));
    expect(byTestId('expedition').dataset.stage).toBe('duel');
    expect(stored()?.duel?.actions).toEqual(controller.getReplay().actions);
    expect(byTestId('btn-expedition-fight').textContent).toBe('Continuar el duelo');
    click(byTestId('btn-expedition-fight'));
    expect(controller.state).toEqual(state);
    expect(byTestId('duel-badge-1').textContent).toBe('Duelo 1/7');
  });

  it('ends the run on a defeat and continues to its summary', () => {
    setup('expedition', createRun(getDeck('brightforge'), 4));
    click(byTestId('btn-expedition-fight'));
    click(byTestId('btn-menu'));
    click(byTestId('menu-concede'));
    expect(byTestId('game-over-title').textContent).toBe('Derrota');
    expect(byTestId('game-over').textContent).toContain('La expedición termina aquí.');
    expect(screen.queryByTestId('btn-play-again')).toBeNull();
    expect(byTestId('btn-mode-next').textContent).toBe('Continuar la expedición');
    click(byTestId('btn-mode-continue'));
    expect(byTestId('expedition-result').dataset.result).toBe('lost');
    expect(byTestId('expedition-result-title').textContent).toBe('Fin de la expedición');
    expect(byTestId('expedition-result').textContent).toContain('Caíste en el duelo 1 de 7');
    click(byTestId('btn-expedition-new'));
    expect(byTestId('expedition').dataset.stage).toBe('new');
    expect(byTestId('expedition-deck-brightforge').getAttribute('aria-checked')).toBe('true');
  });

  it('leaves a plain game for the start screen, with no badge', () => {
    const { controller } = setup('expedition', createRun(getDeck('brightforge'), 4));
    click(byTestId('btn-expedition-fight'));
    act(() => controller.newGame({ decks: ['emberwild', 'emberwild'] }));
    expect(screen.queryByTestId('duel-badge-1')).toBeNull();
    click(byTestId('btn-menu'));
    expect(byTestId('menu-home').textContent).toBe('Menú principal');
    click(byTestId('menu-home'));
    expect(byTestId('start-screen')).toBeTruthy();
  });
});

describe('expedition rewards', () => {
  it('takes one of three cards and swaps it for a card of the deck', () => {
    const run = cardOffer();
    const [card = ''] = offersOf(run);
    setup('expedition', run);
    expect(byTestId('expedition-reward').textContent).toContain('Duelo 1 de 7 superado');
    expect(within(byTestId('expedition-reward')).getAllByRole('radio')).toHaveLength(3);
    expect((byTestId('btn-reward-take') as HTMLButtonElement).disabled).toBe(true);
    click(byTestId(`reward-card-${card}`));
    expect(byTestId('reward-detail').textContent).toContain('Nueva en tu mazo');
    click(byTestId('btn-reward-take'));
    expect(byTestId('expedition').dataset.stage).toBe('swap');
    expect((byTestId('btn-swap-confirm') as HTMLButtonElement).disabled).toBe(true);
    click(byTestId('swap-card-ember_snap'));
    expect(byTestId('btn-swap-confirm').textContent).toBe('Cambiar');
    click(byTestId('btn-swap-confirm'));
    const after = stored();
    expect(after?.added).toEqual([card]);
    expect(after?.removed).toEqual(['ember_snap']);
    expect(byTestId('expedition').dataset.stage).toBe('duel');
    expect(byTestId('expedition-floor-1').dataset.state).toBe('won');
    expect(byTestId('run-deck-size').textContent).toBe('40 cartas · con 1 carta nueva');
  });

  it('adds a card without taking one out, or skips the reward', () => {
    const run = cardOffer();
    const [card = ''] = offersOf(run);
    setup('expedition', run);
    click(byTestId(`reward-card-${card}`));
    click(byTestId('btn-reward-take'));
    click(byTestId('btn-swap-add'));
    expect(byTestId('run-deck-size').textContent).toBe('41 cartas · con 1 carta nueva');
    cleanup();
    setup('expedition', cardOffer(12));
    click(byTestId('btn-reward-skip'));
    expect(stored()?.added).toEqual([]);
    expect(byTestId('expedition').dataset.stage).toBe('duel');
  });

  it('offers a relic after the third win and lists it on the map', () => {
    let run = createRun(getDeck('stormglass'), 5);
    for (let i = 0; i < 3; i++) {
      run = recordDuel(run, 'won', 8);
      run = { ...run, stage: { kind: 'duel' } };
    }
    run = { ...run, wins: 3, stage: { kind: 'relic', offers: ['vigor', 'banner', 'hourglass'] } };
    setup('expedition', run);
    expect(byTestId('expedition-relics').textContent).toContain('Elige una reliquia');
    click(byTestId('relic-option-banner'));
    expect(byTestId('btn-relic-take').textContent).toBe('Llevarme Estandarte del alba');
    click(byTestId('btn-relic-take'));
    expect(stored()?.relics).toEqual(['banner']);
    expect(byTestId('relic-banner').textContent).toContain('Soldado blanca 1/1');
  });

  it('celebrates a finished expedition', () => {
    let run = createRun(getDeck('gloamwood'), 6);
    run = { ...run, wins: 6, history: run.rivals.slice(0, 6).map((rival) => ({ rival: rival.deck, result: 'won' as const, turns: 9 })) };
    run = chooseRelic({ ...run, stage: { kind: 'relic', offers: ['vigor'] } }, 'vigor');
    run = recordDuel(run, 'won', 12);
    setup('expedition', run);
    expect(byTestId('expedition-result').dataset.result).toBe('won');
    expect(byTestId('expedition-result-title').textContent).toBe('¡Expedición completada!');
    expect(within(byTestId('expedition-result')).getAllByRole('listitem').length).toBeGreaterThanOrEqual(7);
    click(byTestId('btn-expedition-home'));
    expect(byTestId('btn-expedition-status').textContent).toBe('Completada con Selvumbra');
  });
});
