// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { chooseAction } from '../../src/ai';
import { GameController } from '../../src/app/controller';
import { getCardDef, type GameState, type PlayerId, type ScenarioSpec } from '../../src/engine';
import { setLocale } from '../../src/i18n';
import { DEFAULT_MODEL } from '../../src/llm';
import { App } from '../../src/ui/App';
import { abilityHints, effectHint, landHint, manaName } from '../../src/ui/cardInfo';
import { shownText, spanishIn } from '../i18n';
import { ScriptedLlm } from '../scriptedLlm';

beforeEach(() => {
  setLocale('en');
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  setLocale('es');
});

function setup(scenario?: ScenarioSpec) {
  const controller = new GameController({ seed: 5, aiDelayMs: 0, startingPlayer: 0 });
  if (scenario) controller.loadScenario(scenario);
  const view = render(<App controller={controller} initialScreen="game" />);
  return { controller, view, settle: () => act(() => controller.settle()) };
}

const byTestId = (id: string): HTMLElement => screen.getByTestId(id);
const click = (element: HTMLElement): void => {
  fireEvent.click(element);
};
const tags = (element: HTMLElement): (string | null)[] => [...element.querySelectorAll('.tag')].map((tag) => tag.textContent);

function expectEnglish(element: Element): void {
  expect(spanishIn(shownText(element))).toEqual([]);
}

describe('the game screen in English', () => {
  it('asks about the opening hand and shows both sides', () => {
    const { view } = setup();
    expect(byTestId('prompt').textContent).toBe('Keep your opening hand?');
    expect(byTestId('prompt-detail').textContent).toMatch(/^\d lands? in hand$/);
    expect(byTestId('btn-keep').textContent).toBe('Keep');
    expect(byTestId('btn-mulligan').textContent).toBe('Mulligan');
    expect(byTestId('phase').textContent).toBe('Opening hand');
    expect(byTestId('deck-name-0').textContent).toContain('Emberwild');
    expect(byTestId('counts-0').textContent).toBe('Hand 7 · Deck 33 · Graveyard 0');
    expect(byTestId('player-1').getAttribute('aria-label')).toBe('AI: 20 life, 7 in hand, 33 in library, 0 in graveyard');
    expect(byTestId('btn-menu').getAttribute('aria-label')).toBe('Menu');
    expectEnglish(view.container);
  });

  it('prompts the main phase, explains what a card cannot do and asks for targets', () => {
    const { view } = setup({
      players: [
        {
          hand: [{ card: 'ember_snap', id: 'snap' }, { card: 'timberland_rhino', id: 'rhino' }],
          battlefield: ['mountain', { card: 'crag_dragon', id: 'dragon', sick: true, damage: 1, counters: 1 }],
        },
        { battlefield: [{ card: 'grove_tender', id: 'elf', tapped: true }] },
      ],
    });
    expect(byTestId('prompt').textContent).toBe('Your main phase');
    expect(byTestId('prompt-detail').textContent).toBe('You can cast spells');
    expect(byTestId('btn-end-turn').textContent).toBe('End turn');
    expect(byTestId('phase').textContent).toBe('Turn 3 · Your turn · Main phase');
    expect(byTestId('lands-0').getAttribute('aria-label')).toBe('1 of 1 lands untapped');
    expect(byTestId('card-dragon').getAttribute('aria-label')).toBe('Crag Dragon, 5/4, 1 +1/+1 counter, summoning sick');
    expectEnglish(view.container);

    click(byTestId('card-rhino'));
    const rhino = byTestId('card-sheet');
    expect(rhino.textContent).toContain('Not enough mana');
    expect(rhino.textContent).toContain('Trample:');
    expectEnglish(rhino);
    click(rhino);

    click(byTestId('card-dragon'));
    const dragon = byTestId('card-sheet');
    expect(tags(dragon)).toEqual(['Summoning sickness', '1 damage', '1 +1/+1 counter']);
    expect(byTestId('sheet-activate').textContent).toBe('Activate (R): +1/+0');
    expectEnglish(dragon);
    click(dragon);

    click(byTestId('card-elf'));
    expect(tags(byTestId('card-sheet'))).toEqual(['Tapped', "Opponent's"]);
    expectEnglish(byTestId('card-sheet'));
    click(byTestId('card-sheet'));

    click(byTestId('card-snap'));
    expect(byTestId('sheet-cast').textContent).toBe('Cast Ember Snap');
    click(byTestId('sheet-cast'));
    expect(byTestId('prompt').textContent).toBe('Choose any target');
    expect(byTestId('prompt-detail').textContent).toBe('for Ember Snap');
    expect(byTestId('btn-cancel').textContent).toBe('Cancel');
    expect(byTestId('player-1').getAttribute('aria-label')).toBe('Target: AI');
    expectEnglish(view.container);
  });

  it('asks for blockers and names the attack', () => {
    const { controller, view, settle } = setup({
      activePlayer: 1,
      players: [
        { battlefield: [{ card: 'canopy_spider', id: 'spider' }, { card: 'grove_tender', id: 'elf' }] },
        { battlefield: [{ card: 'cinderwing_drake', id: 'drake' }, 'mountain'] },
      ],
    });
    settle();
    if (controller.state.pending?.kind !== 'declareBlockers') throw new Error('the AI was expected to attack');
    expect(byTestId('prompt').textContent).toBe('Choose blockers');
    expect(byTestId('prompt-detail').textContent).toBe('The opponent attacks with Cinderwing Drake. Tap your creature, then an attacker');
    expect(byTestId('btn-confirm-blocks').textContent).toBe("Don't block");
    click(byTestId('card-spider'));
    expect(byTestId('btn-confirm-blocks').textContent).toBe('Block (1)');
    expectEnglish(view.container);
  });

  it('names the spell on the stack and lets it resolve', () => {
    const { controller, view, settle } = setup({
      activePlayer: 1,
      players: [
        { hand: ['turn_the_tide'], battlefield: ['island', 'island', 'island'] },
        { hand: [{ card: 'timberland_rhino', id: 'rhino' }], battlefield: ['forest', 'forest', 'forest', 'forest'] },
      ],
    });
    settle();
    const item = controller.state.stack[0];
    if (!item) throw new Error('the AI was expected to cast its Rhino');
    expect(byTestId('prompt').textContent).toBe('The opponent casts Timberland Rhino');
    expect(byTestId('prompt-detail').textContent).toBe('Cast an instant in response or let it resolve');
    expect(byTestId('btn-resolve').textContent).toBe('Let it resolve');
    expect(byTestId(`stack-${item.id}`).getAttribute('aria-label')).toBe('AI: Timberland Rhino');
    expect(byTestId('fx-reveal').textContent).toContain('The opponent casts');
    expectEnglish(view.container);
    click(byTestId(`stack-${item.id}`));
    expect(tags(byTestId('card-sheet'))).toEqual(['On the stack']);
    expectEnglish(byTestId('card-sheet'));
  });

  it('opens the menu and the log, and ends the game', () => {
    const { view } = setup({ players: [{ hand: [{ card: 'forest', id: 'f1' }] }, {}] });
    click(byTestId('card-f1'));
    click(byTestId('sheet-playLand'));
    click(byTestId('btn-menu'));
    const menu = byTestId('menu');
    expect(byTestId('menu-log').textContent).toBe('Game log');
    expect(byTestId('menu-speed').textContent).toBe('AI speed: fast');
    expect(byTestId('menu-autopass').textContent).toBe('Auto-pass: on');
    expect(byTestId('menu-new-game').textContent).toBe('New game');
    expect(byTestId('menu-home').textContent).toBe('Main menu');
    expect(byTestId('menu-concede').textContent).toBe('Concede');
    expectEnglish(menu);

    click(byTestId('menu-log'));
    const log = byTestId('log-panel');
    expect(log.getAttribute('aria-label')).toBe('Game log');
    expect([...log.querySelectorAll('li')].map((item) => item.textContent)).toContain('You play Forest.');
    expectEnglish(log);
    click(within(log).getByTestId('log-card-f1'));
    expect(tags(byTestId('card-sheet'))).toEqual(['On the battlefield']);
    click(byTestId('card-sheet'));
    click(within(log).getByRole('button', { name: 'Close the log' }));

    click(byTestId('btn-menu'));
    click(byTestId('menu-concede'));
    const over = byTestId('game-over');
    expect(byTestId('game-over-title').textContent).toBe('Defeat');
    expect(over.textContent).toContain('You conceded');
    expect(over.textContent).toContain('your life');
    expect(over.textContent).toContain("opponent's life");
    expect(byTestId('btn-play-again').textContent).toBe('Play again');
    expect(byTestId('btn-home').textContent).toBe('Main menu');
    expect(byTestId('btn-view-log').textContent).toBe('View the log');
    expectEnglish(view.container);
  });

  it('asks for attackers and for the cards to put on the bottom', () => {
    const attack = setup({ players: [{ battlefield: [{ card: 'ember_hound', id: 'hound' }, { card: 'canopy_spider', id: 'spider' }] }, {}] });
    expect(byTestId('btn-to-combat').textContent).toBe('To combat');
    click(byTestId('btn-to-combat'));
    attack.settle();
    expect(byTestId('prompt').textContent).toBe('Choose attackers');
    expect(byTestId('prompt-detail').textContent).toBe('Tap the creatures you want to attack with');
    expect(byTestId('btn-confirm-attack').textContent).toBe("Don't attack");
    expect(byTestId('btn-attack-all').textContent).toBe('All');
    click(byTestId('card-hound'));
    expect(byTestId('btn-confirm-attack').textContent).toBe('Attack (1)');
    expectEnglish(attack.view.container);
    cleanup();

    const mulligan = setup();
    click(byTestId('btn-mulligan'));
    expect(byTestId('prompt').textContent).toBe('Keep 6 cards?');
    expect(byTestId('prompt-detail').textContent).toMatch(/ · you'll put 1 on the bottom of your library$/);
    click(byTestId('btn-keep'));
    expect(byTestId('prompt').textContent).toBe('Choose 1 card to put on the bottom');
    expect(byTestId('prompt-detail').textContent).toBe('0/1 chosen');
    expect(byTestId('btn-confirm-cards').textContent).toBe('Put on the bottom');
    expectEnglish(mulligan.view.container);
  });

  it('shows relics and their owners', () => {
    const { view } = setup({ players: [{ relics: [{ card: 'urn', id: 'urn' }] }, { relics: [{ card: 'bell', id: 'bell' }] }] });
    expect(byTestId('card-urn').getAttribute('aria-label')).toBe('Your relic: Urn of Souls');
    expect(byTestId('card-bell').getAttribute('aria-label')).toBe("The opponent's relic: Funeral Bell");
    click(byTestId('card-bell'));
    expect(tags(byTestId('card-sheet'))).toEqual(["The opponent's relic"]);
    expectEnglish(view.container);
  });
});

describe('card hints in English', () => {
  it('sum up abilities, lands and mana', () => {
    expect(abilityHints('forge_cadet')).toEqual(['Another enters: +1 counter']);
    expect(abilityHints('brightforge_marshal')).toEqual(['Enters: +2 Soldiers']);
    expect(abilityHints('brightforge_warlord')).toEqual(['Enters: all +1/+0 haste']);
    expect(abilityHints('hushwing_bat')).toEqual(['Hits: opponent discards 1']);
    expect(abilityHints('bloodspore_thrall')).toEqual(['Sac.: opponent -1 life']);
    expect(abilityHints('blistering_hellion')).toEqual(['Bloodthirst: +2 counters']);
    expect(abilityHints('wildland_colossus')).toEqual(['Landfall: +1 Beast']);
    expect(abilityHints('trail_scout')).toEqual(['Enters: search Forest']);
    expect(abilityHints('wayfarer_druid')).toEqual(['T: +any color']);
    expect(effectHint({ kind: 'searchLand', land: 'forest', battlefield: 1, hand: 1, tapped: true })).toBe('search 2 Forests');
    expect(effectHint({ kind: 'pump', power: 1, toughness: 0, to: 0, keywords: ['firstStrike'] })).toBe('+1/+0 1st strike');
    expect(landHint(getCardDef('silver_spire'))).toBe('Enters tapped. {W}{U}{B}');
    expect(['W', 'U', 'B', 'R', 'G', 'T', '2'].map(manaName)).toEqual(['white', 'blue', 'black', 'red', 'green', 'tap', '2 generic']);
  });
});

describe('the LLM opponent in English', () => {
  async function settled(controller: GameController): Promise<void> {
    await act(async () => {
      controller.settle();
      await controller.whenIdle();
    });
  }

  function startLlmGame(llm: ScriptedLlm) {
    const controller = new GameController({
      seed: 5,
      aiDelayMs: 0,
      startingPlayer: 0,
      opponent: { kind: 'llm', model: DEFAULT_MODEL },
      llmFactory: () => llm,
    });
    const view = render(<App controller={controller} initialScreen="game" />);
    return { controller, view };
  }

  it('writes its reasoning in the log', async () => {
    const thinking = (s: GameState, player: PlayerId) => ({ action: chooseAction(s, player), reason: 'A fine hand.' });
    const { controller } = startLlmGame(new ScriptedLlm(DEFAULT_MODEL, thinking));
    click(byTestId('btn-keep'));
    await settled(controller);
    click(byTestId('btn-menu'));
    click(byTestId('menu-log'));
    const lines = [...byTestId('log-panel').querySelectorAll('li')].map((item) => item.textContent);
    expect(lines).toContain('The opponent thinks: A fine hand.');
  });

  it('says when it is unavailable and the classic AI takes over', async () => {
    const llm: ScriptedLlm = new ScriptedLlm(DEFAULT_MODEL, (s, player) => {
      llm.unavailable = 'OpenRouter 402: Insufficient credits';
      return { action: chooseAction(s, player), source: 'fallback', error: llm.unavailable };
    });
    const { controller, view } = startLlmGame(llm);
    click(byTestId('btn-keep'));
    await settled(controller);
    expect(byTestId('llm-notice-text').textContent).toBe('LLM unavailable: OpenRouter 402: Insufficient credits. The classic AI is playing.');
    expect(byTestId('player-tag-1').getAttribute('title')).toBe('LLM unavailable: OpenRouter 402: Insufficient credits');
    expect(byTestId('llm-notice-hide').getAttribute('aria-label')).toBe('Hide');
    expect(controller.log.map((entry) => entry.text)).toContain(
      'The LLM is unavailable (OpenRouter 402: Insufficient credits): the classic AI plays the rest of the game.',
    );
    expectEnglish(view.container);
  });
});
