// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/preact';
import { afterEach, describe, expect, it } from 'vitest';
import { GameController, type Matchup } from '../../src/app/controller';
import { DECK_LIST, type ScenarioSpec } from '../../src/engine';
import { App } from '../../src/ui/App';
import { loadAutoPass } from '../../src/ui/autoPassChoice';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function setup(scenario?: ScenarioSpec, initialScreen: 'start' | 'game' = 'game', decks?: Matchup) {
  const controller = new GameController({ seed: 5, aiDelayMs: 0, startingPlayer: 0, decks });
  if (scenario) controller.loadScenario(scenario);
  render(<App controller={controller} initialScreen={initialScreen} />);
  const settle = (): void => {
    act(() => controller.settle());
  };
  return { controller, settle };
}

const byTestId = (id: string): HTMLElement => screen.getByTestId(id);

function click(element: HTMLElement): void {
  fireEvent.click(element);
}

function playFromHand(card: string, button: 'sheet-cast' | 'sheet-playLand'): void {
  click(byTestId(`card-${card}`));
  click(byTestId(button));
}

describe('start screen', () => {
  it('shows your deck box against the AI’s and starts a game', () => {
    const { settle } = setup(undefined, 'start');
    expect(byTestId('seat-0').dataset.deck).toBe('emberwild');
    expect(byTestId('seat-1').dataset.deck).toBe('random');
    expect(byTestId('seat-0').getAttribute('aria-label')).toBe('Tú: Brasalvaje');
    expect(byTestId('seat-1').getAttribute('aria-label')).toBe('IA: Aleatorio');
    expect(screen.queryByTestId('deck-picker')).toBeNull();
    click(byTestId('btn-play'));
    settle();
    expect(byTestId('prompt').textContent).toBe('¿Te quedas con tu mano inicial?');
    expect(within(byTestId('hand')).getAllByRole('button')).toHaveLength(7);
  });
});

const checked = (id: string): string | null => byTestId(id).getAttribute('aria-checked');
const expanded = (seat: 0 | 1): string | null => byTestId(`seat-${seat}`).getAttribute('aria-expanded');
const boxOpen = (element: HTMLElement): string | undefined =>
  element.querySelector<HTMLElement>('.deck-box')?.dataset.open;
const options = (): string[] =>
  within(byTestId('deck-picker'))
    .getAllByRole('radio')
    .map((option) => option.dataset.testid ?? '');

describe('deck selection', () => {
  it('opens a seat’s box onto every deck it may play, and closes it again', () => {
    setup(undefined, 'start');
    expect(boxOpen(byTestId('seat-0'))).toBe('false');
    click(byTestId('seat-0'));
    expect(expanded(0)).toBe('true');
    expect(expanded(1)).toBe('false');
    expect(boxOpen(byTestId('seat-0'))).toBe('true');
    expect(boxOpen(byTestId('seat-1'))).toBe('false');
    expect(byTestId('deck-picker').dataset.seat).toBe('0');
    expect(options()).toEqual(['deck-random', ...DECK_LIST.map((deck) => `deck-${deck.id}`)]);
    for (const deck of DECK_LIST) expect(byTestId('deck-picker').textContent).toContain(deck.name);
    expect(screen.queryByTestId('btn-expedition')).toBeNull();

    click(byTestId('seat-1'));
    expect(expanded(0)).toBe('false');
    expect(expanded(1)).toBe('true');
    expect(byTestId('deck-picker').dataset.seat).toBe('1');
    expect(options()).toEqual(['opponent-random', ...DECK_LIST.map((deck) => `opponent-${deck.id}`)]);

    click(byTestId('seat-1'));
    expect(screen.queryByTestId('deck-picker')).toBeNull();
    expect(expanded(1)).toBe('false');
    expect(byTestId('btn-expedition')).toBeTruthy();

    click(byTestId('seat-0'));
    click(byTestId('btn-picker-done'));
    expect(screen.queryByTestId('deck-picker')).toBeNull();
    expect(boxOpen(byTestId('seat-0'))).toBe('false');
  });

  it('plays the chosen deck against the chosen AI deck', () => {
    const { controller, settle } = setup(undefined, 'start');
    click(byTestId('seat-0'));
    expect(checked('deck-emberwild')).toBe('true');
    click(byTestId('deck-dawntide'));
    expect(checked('deck-dawntide')).toBe('true');
    expect(checked('deck-emberwild')).toBe('false');
    expect(boxOpen(byTestId('deck-dawntide'))).toBe('true');
    expect(boxOpen(byTestId('deck-emberwild'))).toBe('false');
    expect(byTestId('seat-0').dataset.deck).toBe('dawntide');
    expect(byTestId('seat-0').getAttribute('aria-label')).toBe('Tú: Albamar');
    expect(byTestId('deck-picker').dataset.seat).toBe('0');
    click(byTestId('seat-1'));
    click(byTestId('opponent-duskmire'));
    expect(checked('opponent-duskmire')).toBe('true');
    expect(byTestId('seat-1').dataset.deck).toBe('duskmire');
    click(byTestId('btn-play'));
    settle();
    expect(controller.decks).toEqual(['dawntide', 'duskmire']);
    expect(byTestId('deck-name-0').textContent).toContain('Albamar');
    expect(byTestId('deck-name-1').textContent).toContain('Fangoscuro');
  });

  it('gives the AI a random deck unless one is picked', () => {
    const { controller } = setup(undefined, 'start');
    click(byTestId('seat-1'));
    expect(checked('opponent-random')).toBe('true');
    click(byTestId('seat-0'));
    click(byTestId('deck-duskmire'));
    click(byTestId('btn-watch'));
    expect(controller.decks?.[0]).toBe('duskmire');
    expect(DECK_LIST.map((deck) => deck.id)).toContain(controller.decks?.[1]);
    expect(controller.autoplay).toBe(true);
  });

  it('draws your deck at random too when you pick Random', () => {
    const { controller } = setup(undefined, 'start');
    click(byTestId('seat-0'));
    click(byTestId('deck-random'));
    expect(checked('deck-random')).toBe('true');
    expect(checked('deck-emberwild')).toBe('false');
    expect(byTestId('seat-0').dataset.deck).toBe('random');
    expect(byTestId('seat-0').getAttribute('aria-label')).toBe('Tú: Aleatorio');
    expect(byTestId('deck-detail').textContent).toContain(
      `Un mazo distinto en cada partida: uno de los ${DECK_LIST.length}`,
    );
    click(byTestId('seat-1'));
    click(byTestId('opponent-duskmire'));
    click(byTestId('btn-play'));
    const deck = DECK_LIST.find((candidate) => candidate.id === controller.decks?.[0]);
    expect(deck).toBeDefined();
    expect(controller.decks?.[1]).toBe('duskmire');
    expect(byTestId('deck-name-0').textContent).toContain(deck?.name);
  });

  it('describes the chosen deck, or what Random does', () => {
    setup(undefined, 'start');
    click(byTestId('seat-1'));
    expect(byTestId('deck-detail').textContent).toContain(
      `Un mazo distinto en cada partida: uno de los ${DECK_LIST.length}`,
    );
    expect(within(byTestId('deck-detail')).queryByRole('button')).toBeNull();
    click(byTestId('opponent-gloamwood'));
    expect(byTestId('deck-detail').textContent).toContain('Selvumbra');
    expect(byTestId('deck-detail').textContent).toContain(
      DECK_LIST.find((deck) => deck.id === 'gloamwood')?.description,
    );
    expect(byTestId('deck-view-gloamwood')).toBeTruthy();
  });

  it('shows the LLM on the AI’s seat when it plays', () => {
    setup(undefined, 'start');
    click(byTestId('btn-settings'));
    click(byTestId('ai-llm'));
    click(byTestId('btn-settings-close'));
    expect(byTestId('seat-1').getAttribute('aria-label')).toBe('IA · LLM: Aleatorio');
    click(byTestId('btn-settings'));
    click(byTestId('ai-classic'));
    click(byTestId('btn-settings-close'));
    expect(byTestId('seat-1').getAttribute('aria-label')).toBe('IA: Aleatorio');
  });

  it('keeps who plays the AI and how to play in the settings behind the gear', () => {
    setup(undefined, 'start');
    expect(screen.queryByTestId('ai-classic')).toBeNull();
    expect(byTestId('start-screen').textContent).not.toContain('Cómo se juega');
    click(byTestId('btn-settings'));
    const settings = byTestId('settings');
    expect(within(settings).getByTestId('ai-classic').getAttribute('aria-checked')).toBe('true');
    expect(within(settings).getByRole('heading', { name: 'Cómo se juega' })).toBeTruthy();
    click(byTestId('btn-settings-close'));
    expect(screen.queryByTestId('settings')).toBeNull();
  });

  it('remembers the choice for the next visit', () => {
    setup(undefined, 'start');
    click(byTestId('seat-0'));
    click(byTestId('deck-duskmire'));
    click(byTestId('seat-1'));
    click(byTestId('opponent-dawntide'));
    cleanup();
    setup(undefined, 'start');
    expect(byTestId('seat-0').dataset.deck).toBe('duskmire');
    expect(byTestId('seat-1').dataset.deck).toBe('dawntide');
    click(byTestId('seat-0'));
    expect(checked('deck-duskmire')).toBe('true');
    click(byTestId('deck-random'));
    cleanup();
    setup(undefined, 'start');
    expect(byTestId('seat-0').dataset.deck).toBe('random');
  });

  it('ignores a stored choice that names an unknown deck', () => {
    localStorage.setItem('manaDuel.decks', JSON.stringify({ deck: 'nope', opponent: 'duskmire' }));
    setup(undefined, 'start');
    expect(byTestId('seat-0').dataset.deck).toBe('emberwild');
    expect(byTestId('seat-1').dataset.deck).toBe('random');
  });
});

describe('deck viewer', () => {
  const copies = (): number[] =>
    within(byTestId('deck-viewer'))
      .getAllByRole('button')
      .filter((element) => element.dataset.testid?.startsWith('deck-card-'))
      .map((element) => Number(element.dataset.count));

  it('shows every card of the chosen deck with its count, curve and details, and returns to the picker', () => {
    setup(undefined, 'start');
    click(byTestId('seat-0'));
    click(byTestId('deck-duskmire'));
    click(byTestId('deck-view-duskmire'));
    expect(byTestId('deck-viewer').dataset.deck).toBe('duskmire');
    expect(copies().reduce((sum, count) => sum + count, 0)).toBe(40);
    expect(byTestId('deck-card-swamp').dataset.count).toBe('16');
    expect(byTestId('deck-stats').textContent).toContain('40 cartas');
    expect(byTestId('mana-curve').getAttribute('aria-label')).toMatch(
      /^Curva de maná de las cartas que no son tierras: \d+ de coste 1,/,
    );
    click(byTestId('deck-card-dread_tyrant'));
    expect(byTestId('card-sheet').textContent).toContain('Cuando esta criatura entre, pierdes 2 vidas.');
    expect(byTestId('card-sheet').textContent).toContain('1 copia en Fangoscuro');
    click(byTestId('card-sheet'));
    expect(screen.queryByTestId('card-sheet')).toBeNull();
    fireEvent.contextMenu(byTestId('deck-card-swamp'));
    expect(byTestId('card-sheet').textContent).toContain('16 copias en Fangoscuro');
    click(byTestId('card-sheet'));
    click(byTestId('btn-deck-close'));
    expect(screen.queryByTestId('deck-viewer')).toBeNull();
    expect(byTestId('deck-picker').dataset.seat).toBe('0');
    expect(checked('deck-duskmire')).toBe('true');
  });

  it('opens the AI’s deck from its seat without changing yours', () => {
    setup(undefined, 'start');
    click(byTestId('seat-1'));
    click(byTestId('opponent-dawntide'));
    click(byTestId('deck-view-dawntide'));
    expect(byTestId('deck-viewer').dataset.deck).toBe('dawntide');
    click(byTestId('btn-deck-close'));
    expect(screen.queryByTestId('deck-viewer')).toBeNull();
    expect(byTestId('seat-0').dataset.deck).toBe('emberwild');
    expect(byTestId('seat-1').dataset.deck).toBe('dawntide');
  });

  it('shows both decks of the game from the menu', () => {
    setup(undefined, 'game', ['dawntide', 'duskmire']);
    click(byTestId('btn-menu'));
    click(byTestId('menu-decks'));
    expect(byTestId('deck-viewer').dataset.deck).toBe('dawntide');
    click(byTestId('deck-tab-1'));
    expect(byTestId('deck-viewer').dataset.deck).toBe('duskmire');
    expect(byTestId('deck-tab-1').textContent).toBe('IA · Fangoscuro');
    click(byTestId('btn-deck-close'));
    expect(screen.queryByTestId('deck-viewer')).toBeNull();
  });

  it('is not offered for a loaded scenario', () => {
    setup({ players: [{}, {}] });
    click(byTestId('btn-menu'));
    expect(screen.queryByTestId('menu-decks')).toBeNull();
    expect(screen.queryByTestId('deck-name-0')).toBeNull();
  });
});

describe('auto-pass', () => {
  it('turns off from the menu, and the game then stops in the AI’s turn wherever you could act', () => {
    const { controller, settle } = setup({
      activePlayer: 1,
      players: [{ hand: ['ember_snap'], battlefield: ['mountain'] }, {}],
    });
    click(byTestId('btn-menu'));
    expect(checked('menu-autopass')).toBe('true');
    expect(byTestId('menu-autopass').textContent).toBe('Pase automático: sí');
    click(byTestId('menu-autopass'));
    expect(screen.queryByTestId('menu')).toBeNull();
    expect(controller.autoPass).toBe(false);
    expect(loadAutoPass()).toBe(false);
    settle();
    expect(byTestId('prompt').textContent).toBe('Fase principal del rival');
    expect(byTestId('prompt-detail').textContent).toBe('Ahora puedes lanzar instantáneos');
    click(byTestId('btn-continue'));
    settle();
    expect(byTestId('prompt').textContent).toBe('Segunda fase principal del rival');
    click(byTestId('btn-menu'));
    expect(checked('menu-autopass')).toBe('false');
    click(byTestId('menu-autopass'));
    settle();
    expect(byTestId('prompt').textContent).toBe('Tu fase principal');
    expect(loadAutoPass()).toBe(true);
  });

  it('names your own attack when it stops after it', () => {
    const { controller, settle } = setup({
      players: [{ hand: ['ember_snap'], battlefield: ['mountain', { card: 'ember_hound', id: 'hound' }] }, {}],
    });
    act(() => controller.setAutoPass(false));
    click(byTestId('btn-to-combat'));
    settle();
    click(byTestId('card-hound'));
    click(byTestId('btn-confirm-attack'));
    settle();
    expect(byTestId('prompt').textContent).toBe('Atacas con Sabueso de brasas');
  });
});

describe('opening hand', () => {
  it('keeps and reaches the first main phase', () => {
    const { settle } = setup();
    click(byTestId('btn-keep'));
    settle();
    expect(byTestId('phase').textContent).toContain('Turno 1');
    expect(byTestId('prompt').textContent).toBe('Tu fase principal');
  });

  it('puts a card on the bottom after a mulligan', () => {
    const { controller, settle } = setup();
    click(byTestId('btn-mulligan'));
    click(byTestId('btn-keep'));
    expect(byTestId('prompt').textContent).toBe('Elige 1 carta para poner en el fondo');
    expect((byTestId('btn-confirm-cards') as HTMLButtonElement).disabled).toBe(true);
    const first = within(byTestId('hand')).getAllByRole('button')[0] as HTMLElement;
    click(first);
    expect((byTestId('btn-confirm-cards') as HTMLButtonElement).disabled).toBe(false);
    click(byTestId('btn-confirm-cards'));
    settle();
    expect(controller.state.players[0].hand).toHaveLength(6);
  });

  it('counts the cards you keep after each mulligan', () => {
    setup();
    click(byTestId('btn-mulligan'));
    expect(byTestId('prompt').textContent).toBe('¿Te quedas con 6 cartas?');
    for (let i = 0; i < 5; i++) click(byTestId('btn-mulligan'));
    expect(byTestId('prompt').textContent).toBe('¿Te quedas con 1 carta?');
    expect(screen.queryByTestId('btn-mulligan')).toBeNull();
  });
});

describe('main phase', () => {
  it('plays a land from the card sheet', () => {
    const { controller } = setup({ players: [{ hand: [{ card: 'forest', id: 'f1' }] }, {}] });
    playFromHand('f1', 'sheet-playLand');
    expect(controller.state.cards.f1?.zone).toBe('battlefield');
    expect(within(byTestId('lands-0')).getByTestId('card-f1')).toBeTruthy();
  });

  it('casts a spell at a chosen target', () => {
    const { settle } = setup({
      players: [{ hand: [{ card: 'ember_snap', id: 'snap' }], battlefield: ['mountain'] }, {}],
    });
    playFromHand('snap', 'sheet-cast');
    expect(byTestId('prompt').textContent).toBe('Elige cualquier objetivo');
    expect(byTestId('player-1').dataset.targetable).toBe('true');
    click(byTestId('player-1'));
    settle();
    expect(byTestId('life-1').textContent).toContain('18');
  });

  it('can cancel targeting', () => {
    const { controller } = setup({
      players: [{ hand: [{ card: 'ember_snap', id: 'snap' }], battlefield: ['mountain'] }, {}],
    });
    playFromHand('snap', 'sheet-cast');
    click(byTestId('btn-cancel'));
    expect(byTestId('prompt').textContent).toBe('Tu fase principal');
    expect(controller.state.stack).toHaveLength(0);
  });

  it('explains why a card cannot be played', () => {
    setup({ players: [{ hand: [{ card: 'timberland_rhino', id: 'rhino' }], battlefield: ['forest'] }, {}] });
    click(byTestId('card-rhino'));
    expect(byTestId('card-sheet').textContent).toContain('No hay suficiente maná');
    expect(byTestId('card-sheet').textContent).toContain('Arrolla');
  });

  it('shows rules text and activates abilities from the battlefield', () => {
    const { controller, settle } = setup({
      players: [{ battlefield: [{ card: 'crag_dragon', id: 'dragon' }, 'mountain'] }, {}],
    });
    click(byTestId('card-dragon'));
    expect(byTestId('card-sheet').textContent).toContain('Esta criatura obtiene +1/+0 hasta el final del turno.');
    click(byTestId('sheet-activate'));
    settle();
    expect(controller.state.effects).toHaveLength(1);
    expect(byTestId('pt-dragon').textContent).toBe('5/4');
  });
});

describe('counterspells', () => {
  it('target a spell on the stack by tapping it in the center strip', () => {
    const { controller, settle } = setup({
      activePlayer: 1,
      players: [
        { hand: [{ card: 'turn_the_tide', id: 'tide' }], battlefield: ['island', 'island', 'island'] },
        { hand: [{ card: 'timberland_rhino', id: 'rhino' }], battlefield: ['forest', 'forest', 'forest', 'forest'] },
      ],
    });
    settle();
    const item = controller.state.stack[0];
    if (!item) throw new Error('the AI was expected to cast its Rhino');
    expect(byTestId('btn-resolve').textContent).toBe('Dejar que se resuelva');
    playFromHand('tide', 'sheet-cast');
    expect(byTestId('prompt').textContent).toBe('Elige un hechizo objetivo');
    expect(byTestId(`stack-${item.id}`).dataset.targetable).toBe('true');
    click(byTestId(`stack-${item.id}`));
    settle();
    expect(controller.state.cards.rhino?.zone).toBe('graveyard');
    expect(controller.log.map((entry) => entry.text)).toContain('Se contrarresta Rinoceronte forestal del rival.');
  });

  it('shows the card behind a stack item when it is tapped outside targeting', () => {
    const { settle } = setup({
      activePlayer: 1,
      players: [
        { hand: ['turn_the_tide'], battlefield: ['island', 'island', 'island'] },
        { hand: [{ card: 'timberland_rhino', id: 'rhino' }], battlefield: ['forest', 'forest', 'forest', 'forest'] },
      ],
    });
    settle();
    click(
      screen
        .getAllByRole('button')
        .find(
          (element) => element.dataset.card === 'rhino' && element.dataset.testid?.startsWith('stack-'),
        ) as HTMLElement,
    );
    expect(byTestId('card-sheet').textContent).toContain('Rinoceronte forestal');
    expect(byTestId('card-sheet').textContent).toContain('En la pila');
  });
});

describe('card art', () => {
  it('shows each card art in hand, on the battlefield and in the card sheet', () => {
    setup({
      players: [
        { hand: [{ card: 'ember_snap', id: 'snap' }], battlefield: [{ card: 'timberland_rhino', id: 'rhino' }] },
        {},
      ],
    });
    const artOf = (element: HTMLElement): string | null | undefined =>
      element.querySelector('.art img')?.getAttribute('src');
    expect(artOf(byTestId('card-snap'))).toMatch(/cards\/ember_snap\.svg$/);
    expect(artOf(byTestId('card-rhino'))).toMatch(/cards\/timberland_rhino\.svg$/);
    click(byTestId('card-rhino'));
    expect(artOf(byTestId('card-sheet'))).toMatch(/cards\/timberland_rhino\.svg$/);
  });
});

describe('card faces', () => {
  const iconsOf = (element: HTMLElement, selector: string): string[] =>
    [...element.querySelectorAll(`${selector} .icon`)].map((icon) => icon.getAttribute('data-icon') ?? '');

  it('show keyword icons and ability pills on the battlefield, and a trigger icon only while it can still happen', () => {
    setup({
      players: [
        {
          battlefield: [
            { card: 'crag_dragon', id: 'dragon' },
            { card: 'grove_tender', id: 'elf' },
            { card: 'cinder_adept', id: 'adept' },
          ],
        },
        {
          battlefield: [
            { card: 'rotwing_crow', id: 'crow' },
            { card: 'bloodspore_thrall', id: 'thrall' },
          ],
        },
      ],
    });
    expect(iconsOf(byTestId('card-dragon'), '.icons')).toEqual(['flying']);
    expect(iconsOf(byTestId('card-elf'), '.icons')).toEqual([]);
    expect(iconsOf(byTestId('card-adept'), '.icons')).toEqual([]);
    expect(iconsOf(byTestId('card-crow'), '.icons')).toEqual(['flying', 'trigger']);
    expect(iconsOf(byTestId('card-thrall'), '.icons')).toEqual(['undying']);
    expect(byTestId('ability-dragon-0').textContent).toBe('R: +1/+0');
    expect(byTestId('ability-elf-mana').textContent).toBe('T: +G');
    expect(byTestId('ability-thrall-0').textContent).toBe('Sacr.: rival -1\u00a0vida');
    expect(byTestId('card-adept').querySelector('.ability')).toBeNull();
  });

  it('light an ability pill up only while you can pay it', () => {
    const { settle } = setup({ players: [{ battlefield: [{ card: 'crag_dragon', id: 'dragon' }, 'mountain'] }, {}] });
    expect(byTestId('ability-dragon-0').dataset.usable).toBe('true');
    click(byTestId('card-dragon'));
    click(byTestId('sheet-activate'));
    settle();
    expect(byTestId('pt-dragon').textContent).toBe('5/4');
    expect(byTestId('ability-dragon-0').dataset.usable).toBeUndefined();
  });

  it('dim the mana pill of a creature that is tapped or summoning sick', () => {
    setup({
      players: [
        {
          battlefield: [
            { card: 'grove_tender', id: 'elf' },
            { card: 'kelpweaver_druid', id: 'druid', tapped: true },
            { card: 'grove_tender', id: 'newcomer', sick: true },
          ],
        },
        {},
      ],
    });
    expect(byTestId('ability-elf-mana').dataset.spent).toBeUndefined();
    expect(byTestId('ability-druid-mana').dataset.spent).toBe('true');
    expect(byTestId('ability-druid-mana').textContent).toBe('T: +G/U');
    expect(byTestId('ability-newcomer-mana').dataset.spent).toBe('true');
  });

  it('show a keyword granted until end of turn', () => {
    const { settle } = setup({
      players: [
        {
          hand: [{ card: 'nightshade_tonic', id: 'tonic' }],
          battlefield: [{ card: 'grove_tender', id: 'elf' }, 'forest', 'forest'],
        },
        {},
      ],
    });
    expect(iconsOf(byTestId('card-elf'), '.icons')).toEqual([]);
    playFromHand('tonic', 'sheet-cast');
    click(byTestId('card-elf'));
    settle();
    expect(iconsOf(byTestId('card-elf'), '.icons')).toEqual(['deathtouch']);
  });

  it('write in hand the printed keywords as icons before the rest of the text', () => {
    setup({
      players: [
        {
          hand: [
            { card: 'crag_dragon', id: 'dragon' },
            { card: 'ember_snap', id: 'snap' },
          ],
        },
        {},
      ],
    });
    const dragon = byTestId('card-dragon');
    expect(dragon.querySelector('.name')?.textContent).toBe('Dragón del risco');
    expect(iconsOf(dragon, '.text')).toEqual(['flying']);
    expect(dragon.querySelector('.text')?.textContent).toContain('R: +1/+0');
    expect(iconsOf(byTestId('card-snap'), '.text')).toEqual([]);
    expect(byTestId('card-snap').querySelector('.text')?.textContent).toContain(
      'Chasquido de brasas hace 2 puntos de daño',
    );
  });
});

describe('combat', () => {
  it('declares attackers by tapping creatures', () => {
    const { settle } = setup({ players: [{ battlefield: [{ card: 'ember_hound', id: 'hound' }] }, {}] });
    click(byTestId('btn-to-combat'));
    settle();
    expect(byTestId('prompt').textContent).toBe('Elige las atacantes');
    expect(byTestId('btn-confirm-attack').textContent).toBe('No atacar');
    click(byTestId('card-hound'));
    expect(byTestId('btn-confirm-attack').textContent).toBe('Atacar (1)');
    click(byTestId('btn-confirm-attack'));
    settle();
    expect(byTestId('life-1').textContent).toContain('18');
  });

  it('declares blockers by tapping a blocker and then an attacker', () => {
    const { controller, settle } = setup({
      activePlayer: 1,
      players: [
        {
          battlefield: [
            { card: 'canopy_spider', id: 'spider' },
            { card: 'grove_tender', id: 'elf' },
          ],
        },
        { battlefield: [{ card: 'cinderwing_drake', id: 'drake' }, 'mountain'] },
      ],
    });
    settle();
    if (controller.state.pending?.kind !== 'declareBlockers') throw new Error('the AI was expected to attack');
    expect(byTestId('prompt').textContent).toBe('Elige las bloqueadoras');
    click(byTestId('card-elf'));
    expect(controller.state.pending.kind).toBe('declareBlockers');
    click(byTestId('card-spider'));
    expect(byTestId('btn-confirm-blocks').textContent).toBe('Bloquear (1)');
    click(byTestId('btn-confirm-blocks'));
    settle();
    expect(controller.state.cards.spider?.zone).toBe('graveyard');
    expect(controller.state.players[0].life).toBe(20);
  });
});

describe('tokens, sacrifices and discards', () => {
  it('shows the tokens a spell creates on the battlefield, as tokens in the card sheet', () => {
    const { controller, settle } = setup({
      players: [{ hand: [{ card: 'raise_the_banners', id: 'banners' }], battlefield: ['plains', 'plains'] }, {}],
    });
    playFromHand('banners', 'sheet-cast');
    settle();
    const tokens = controller.state.players[0].battlefield.filter(
      (id) => controller.state.cards[id]?.def === 'soldier_token',
    );
    expect(tokens).toHaveLength(2);
    expect(
      within(byTestId('battlefield-0'))
        .getAllByRole('button')
        .filter((button) => button.dataset.def === 'soldier_token'),
    ).toHaveLength(2);
    click(byTestId(`card-${tokens[0]}`));
    expect(byTestId('card-sheet').textContent).toContain('Criatura ficha — Soldado');
  });

  it('sacrifices a creature from its card sheet, then asks for the target', () => {
    const { controller, settle } = setup({
      players: [
        { battlefield: [{ card: 'bonewood_stalker', id: 'stalker' }] },
        { battlefield: [{ card: 'ember_hound', id: 'hound' }] },
      ],
    });
    click(byTestId('card-stalker'));
    expect(byTestId('card-sheet').textContent).toContain(
      'Sacrificar esta criatura: La criatura objetivo obtiene -2/-2 hasta el final del turno.',
    );
    expect(byTestId('sheet-activate').textContent).toBe('Activar (sacrificar): -2/-2');
    click(byTestId('sheet-activate'));
    expect(byTestId('prompt').textContent).toBe('Elige una criatura objetivo');
    click(byTestId('card-hound'));
    settle();
    expect([controller.state.cards.stalker?.zone, controller.state.cards.hound?.zone]).toEqual([
      'graveyard',
      'graveyard',
    ]);
  });

  it('asks which card to discard when a spell says so, in the middle of the turn', () => {
    const { controller, settle } = setup({
      players: [
        {
          hand: [{ card: 'sift_the_depths', id: 'sift' }],
          battlefield: ['island', 'island'],
          library: [
            { card: 'forest', id: 'a' },
            { card: 'island', id: 'b' },
          ],
        },
        {},
      ],
    });
    playFromHand('sift', 'sheet-cast');
    settle();
    expect(byTestId('prompt').textContent).toBe('Elige 1 carta para descartar');
    expect(byTestId('prompt-detail').textContent).toBe('Cribar el fondo · 0/1 elegida');
    click(byTestId('card-a'));
    click(byTestId('btn-confirm-cards'));
    settle();
    expect(controller.state.players[0].hand).toEqual(['b']);
    expect(byTestId('prompt').textContent).toBe('Tu fase principal');
  });
});

describe('relics', () => {
  it('sit beside each player’s bar, open as their card, flash when they trigger and appear in the log', () => {
    const { settle } = setup({
      players: [
        {
          hand: [{ card: 'ember_snap', id: 'snap' }],
          battlefield: ['mountain', { card: 'soldier_token', id: 'soldier' }],
          relics: [{ card: 'urn', id: 'urn' }],
        },
        {
          relics: [
            { card: 'bell', id: 'bell' },
            { card: 'crown', id: 'crown' },
          ],
        },
      ],
    });
    expect(
      within(byTestId('relics-0'))
        .getAllByRole('button')
        .map((button) => button.dataset.def),
    ).toEqual(['urn']);
    expect(
      within(byTestId('relics-1'))
        .getAllByRole('button')
        .map((button) => button.getAttribute('aria-label')),
    ).toEqual(['Reliquia del rival: Campana fúnebre', 'Reliquia del rival: Corona del tirano']);
    expect(byTestId('card-urn').dataset.zone).toBe('command');
    click(byTestId('card-bell'));
    const sheet = byTestId('card-sheet');
    expect(within(sheet).getByRole('heading', { name: 'Campana fúnebre' })).toBeTruthy();
    expect(sheet.querySelector('.type-line')?.textContent).toBe('Reliquia');
    expect(sheet.textContent).toContain('Al comienzo de tu mantenimiento, cada oponente pierde 1 vida.');
    expect([...sheet.querySelectorAll('.tag')].map((tag) => tag.textContent)).toEqual(['Reliquia del rival']);
    expect(sheet.querySelector('.relic-art .relic-icon')).not.toBeNull();
    click(sheet);
    playFromHand('snap', 'sheet-cast');
    click(byTestId('card-soldier'));
    settle();
    expect(byTestId('life-1').textContent).toBe('19');
    expect(byTestId('card-urn').dataset.fx).toContain('ability');
    click(byTestId('btn-menu'));
    click(byTestId('menu-log'));
    expect([...byTestId('log-panel').querySelectorAll('li')].map((item) => item.textContent)).toContain(
      'Se dispara tu Urna de almas.',
    );
    click(within(byTestId('log-panel')).getByTestId('log-card-urn'));
    expect([...byTestId('card-sheet').querySelectorAll('.tag')].map((tag) => tag.textContent)).toEqual(['Tu reliquia']);
  });

  it('leave the bar alone when no player has one', () => {
    setup({ players: [{}, {}] });
    expect(screen.queryByTestId('relics-0')).toBeNull();
    expect(screen.queryByTestId('relics-1')).toBeNull();
  });
});

describe('end of turn and game over', () => {
  it('asks to discard down to seven cards', () => {
    const { controller, settle } = setup({
      step: 'main2',
      players: [{ hand: Array.from({ length: 9 }, (_, i) => ({ card: 'forest', id: `f${i}` })), landsPlayed: 1 }, {}],
    });
    click(byTestId('btn-end-turn'));
    settle();
    expect(byTestId('prompt').textContent).toBe('Elige 2 cartas para descartar');
    click(byTestId('card-f0'));
    click(byTestId('card-f1'));
    click(byTestId('btn-confirm-cards'));
    expect(controller.state.players[0].hand).toHaveLength(7);
    expect(controller.state.players[0].graveyard).toEqual(['f0', 'f1']);
    expect(controller.state.activePlayer).toBe(1);
  });

  it('concedes from the menu and offers a new game', () => {
    const { controller } = setup({ players: [{}, {}] });
    click(byTestId('btn-menu'));
    click(byTestId('menu-concede'));
    expect(byTestId('game-over-title').textContent).toBe('Derrota');
    click(byTestId('btn-play-again'));
    expect(controller.state.pending?.kind).toBe('mulligan');
  });

  it('goes from the result back to the main menu', () => {
    const { controller, settle } = setup({ players: [{}, {}] });
    click(byTestId('btn-menu'));
    click(byTestId('menu-concede'));
    expect(byTestId('game-over-title').textContent).toBe('Derrota');
    click(byTestId('btn-home'));
    expect(screen.queryByTestId('game')).toBeNull();
    expect(byTestId('start-screen')).toBeTruthy();
    expect(controller.busy).toBe(false);
    click(byTestId('btn-play'));
    settle();
    expect(byTestId('prompt').textContent).toBe('¿Te quedas con tu mano inicial?');
    expect(screen.queryByTestId('game-over')).toBeNull();
  });

  it('opens the log from the result and from the menu, which is the only way in', () => {
    setup({ players: [{ hand: [{ card: 'forest', id: 'f1' }] }, {}] });
    playFromHand('f1', 'sheet-playLand');
    expect(screen.queryByTestId('btn-log')).toBeNull();
    click(byTestId('btn-menu'));
    click(byTestId('menu-log'));
    expect(byTestId('log-panel').textContent).toContain('Juegas Bosque.');
    click(within(byTestId('log-panel')).getByRole('button', { name: 'Cerrar el registro' }));
    click(byTestId('btn-menu'));
    click(byTestId('menu-concede'));
    click(byTestId('btn-view-log'));
    expect(screen.queryByTestId('game-over')).toBeNull();
    expect(byTestId('log-panel').textContent).toContain('Te rindes.');
  });
});

describe('game log', () => {
  function playSnapAtTheElf() {
    const context = setup({
      players: [
        {
          hand: [
            { card: 'mountain', id: 'm' },
            { card: 'ember_snap', id: 'snap' },
          ],
        },
        { battlefield: [{ card: 'grove_tender', id: 'elf' }] },
      ],
    });
    playFromHand('m', 'sheet-playLand');
    playFromHand('snap', 'sheet-cast');
    click(byTestId('card-elf'));
    context.settle();
    click(byTestId('btn-menu'));
    click(byTestId('menu-log'));
    return context;
  }

  const logCards = (id: string): HTMLElement[] => within(byTestId('log-panel')).queryAllByTestId(`log-card-${id}`);

  it('makes every card it names a button, in the words of the line', () => {
    playSnapAtTheElf();
    const lines = [...byTestId('log-panel').querySelectorAll('li')].map((item) => item.textContent);
    expect(lines).toContain('Lanzas Chasquido de brasas sobre Elfa del soto del rival.');
    expect(lines).toContain('Tu Chasquido de brasas hace 2 puntos de daño a Elfa del soto del rival.');
    expect(lines).toContain('Muere Elfa del soto del rival.');
    expect(logCards('snap').map((button) => button.textContent)).toEqual([
      'Chasquido de brasas',
      'Chasquido de brasas',
    ]);
    expect(logCards('elf').map((button) => button.textContent)).toEqual([
      'Elfa del soto',
      'Elfa del soto',
      'Elfa del soto',
    ]);
    expect(logCards('m').map((button) => button.tagName)).toEqual(['BUTTON']);
    const turn = [...byTestId('log-panel').querySelectorAll('li.turn')];
    expect(turn.length).toBeGreaterThan(0);
    expect(turn.every((item) => item.querySelector('button') === null)).toBe(true);
  });

  it('opens a card it names above the log, read-only, with where that card is now', () => {
    playSnapAtTheElf();
    click(logCards('elf')[2] as HTMLElement);
    const sheet = byTestId('card-sheet');
    expect(sheet.classList.contains('raised')).toBe(true);
    expect(within(sheet).getByRole('dialog').getAttribute('aria-label')).toBe('Elfa del soto');
    expect(within(sheet).getByRole('heading', { name: 'Elfa del soto' })).toBeTruthy();
    expect(sheet.textContent).toContain('Ella tararea y la tierra responde.');
    expect([...sheet.querySelectorAll('.tag')].map((tag) => tag.textContent)).toEqual(['En el cementerio del rival']);
    expect(within(sheet).queryAllByRole('button')).toEqual([]);

    click(sheet);
    expect(screen.queryByTestId('card-sheet')).toBeNull();
    expect(byTestId('log-panel')).toBeTruthy();

    click(logCards('m')[0] as HTMLElement);
    expect(byTestId('card-sheet').querySelector('.tag')?.textContent).toBe('En el campo de batalla');
    click(byTestId('card-sheet'));
    click(logCards('snap')[0] as HTMLElement);
    expect([...byTestId('card-sheet').querySelectorAll('.tag')].map((tag) => tag.textContent)).toEqual([
      'En tu cementerio',
    ]);
  });

  it('closes with its card sheet, and leaves the card sheet of the board alone', () => {
    playSnapAtTheElf();
    click(logCards('elf')[0] as HTMLElement);
    click(within(byTestId('log-panel')).getByRole('button', { name: 'Cerrar el registro' }));
    expect(screen.queryByTestId('log-panel')).toBeNull();
    expect(screen.queryByTestId('card-sheet')).toBeNull();
  });
});
