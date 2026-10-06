import { APICallError, LoadAPIKeyError } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import { chooseAction } from '../../src/ai';
import { applyAction, createGame, forcedAction, getLegalActions, type GameState } from '../../src/engine';
import { buildPrompt, createLlmPlayer, decisionFor, eventLines, lazyLlmPlayer, systemPrompt } from '../../src/llm';
import { attack, passTo, scenario, scrambleHiddenInformation } from '../helpers';
import { COST_PER_CALL, choose, hangingModel, mockModel, promptText, schemaOf } from './model';

function mainPhase(): GameState {
  return scenario({
    activePlayer: 1,
    players: [
      { hand: [{ card: 'crag_dragon', id: 'secret' }], battlefield: [{ card: 'grove_tender', id: 'elf' }] },
      {
        hand: [
          { card: 'forest', id: 'f' },
          { card: 'ember_snap', id: 'snap' },
        ],
        battlefield: ['mountain'],
      },
    ],
  });
}

function menaceAttack(): GameState {
  return passTo(
    attack(
      scenario({
        players: [
          { battlefield: [{ card: 'ridge_marauder', id: 'marauder' }] },
          {
            battlefield: [
              { card: 'canopy_spider', id: 's1' },
              { card: 'canopy_spider', id: 's2' },
            ],
          },
        ],
      }),
      ['marauder'],
    ),
    'declareBlockers',
  );
}

function authError(): APICallError {
  return new APICallError({
    message: 'No auth credentials found',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    requestBodyValues: {},
    statusCode: 401,
    isRetryable: false,
  });
}

describe('the LLM player', () => {
  it('sends the rules, the view and every legal option, and plays the option the model picks', async () => {
    const s = mainPhase();
    const model = mockModel((call) => choose(call, (text) => text.includes('Jugar la tierra Bosque'), 'A land first.'));
    const decision = await createLlmPlayer({ model }).decide(s, 1);
    expect(decision).toMatchObject({
      action: { type: 'playLand', player: 1, card: 'f' },
      source: 'model',
      model: 'test/model',
      attempts: 1,
      reason: 'A land first.',
      usage: { inputTokens: 1200, outputTokens: 30, cost: COST_PER_CALL },
    });
    const [call] = model.doGenerateCalls;
    if (!call) throw new Error('the model was not called');
    const { system, user } = promptText(call);
    expect(system).toBe(systemPrompt());
    expect(user).toContain('## Estado de la partida desde tu asiento');
    expect(user).toContain('"handSize": 1');
    expect(user).not.toContain('Dragón del risco');
    const choice = (schemaOf(call).properties as Record<string, { enum?: string[] }>).choice;
    expect(choice?.enum).toHaveLength(getLegalActions(s).length);
  });

  it('does not call the model when only one action is legal', async () => {
    const s = scenario({ activePlayer: 1, players: [{}, {}] });
    const model = mockModel(() => new Error('should not be called'));
    const decision = await createLlmPlayer({ model }).decide(s, 1);
    expect(decision).toMatchObject({ action: { type: 'pass', player: 1 }, source: 'forced', attempts: 0 });
    expect(model.doGenerateCalls).toHaveLength(0);
  });

  it('asks again, saying why, when the answer does not fit the schema', async () => {
    const model = mockModel((call, index) =>
      index === 0 ? { reason: 'Hmm.', choice: '99' } : choose(call, (text) => text.startsWith('Pasar')),
    );
    const decision = await createLlmPlayer({ model }).decide(mainPhase(), 1);
    expect(decision).toMatchObject({ action: { type: 'pass' }, source: 'model', attempts: 2 });
    const retry = promptText(model.doGenerateCalls[1] as (typeof model.doGenerateCalls)[number]).user;
    expect(retry).toContain('Tu respuesta anterior fue rechazada (la respuesta no cumplía el esquema');
  });

  it('asks again when the answer breaks a rule the schema cannot express', async () => {
    const model = mockModel((_, index) =>
      index === 0
        ? { reason: 'One is enough.', blocks: { s1: 'marauder', s2: 'none' } }
        : { reason: 'Both.', blocks: { s1: 'marauder', s2: 'marauder' } },
    );
    const decision = await createLlmPlayer({ model }).decide(menaceAttack(), 1);
    expect(decision.action).toEqual({
      type: 'declareBlockers',
      player: 1,
      blocks: [
        { blocker: 's1', attacker: 'marauder' },
        { blocker: 's2', attacker: 'marauder' },
      ],
    });
    expect(decision.attempts).toBe(2);
    expect(promptText(model.doGenerateCalls[1] as (typeof model.doGenerateCalls)[number]).user).toContain('amenaza');
  });

  it('lets the classic AI decide when every attempt fails', async () => {
    const s = mainPhase();
    const model = mockModel(() => 'not json at all');
    const decision = await createLlmPlayer({ model, attempts: 3 }).decide(s, 1);
    expect(decision).toMatchObject({ source: 'fallback', attempts: 3, action: chooseAction(s, 1) });
    expect(decision.error).toContain('la respuesta no cumplía el esquema');
    expect(model.doGenerateCalls).toHaveLength(3);
  });

  it('stops calling the model after an authentication error', async () => {
    const model = mockModel(() => authError());
    const player = createLlmPlayer({ model, maxRetries: 0 });
    const first = await player.decide(mainPhase(), 1);
    expect(first).toMatchObject({ source: 'fallback', error: 'OpenRouter 401: No auth credentials found' });
    expect(player.unavailable).toBe('OpenRouter 401: No auth credentials found');
    const second = await player.decide(mainPhase(), 1);
    expect(second).toMatchObject({
      source: 'fallback',
      attempts: 0,
      error: 'OpenRouter 401: No auth credentials found',
    });
    expect(model.doGenerateCalls).toHaveLength(1);
  });

  it('stops calling the model when it has no key', async () => {
    const model = mockModel(() => new LoadAPIKeyError({ message: 'OpenRouter API key is missing.' }));
    const player = createLlmPlayer({ model });
    expect(await player.decide(mainPhase(), 1)).toMatchObject({ source: 'fallback', attempts: 1 });
    expect(player.unavailable).toBe('OpenRouter API key is missing.');
  });

  it('keeps trying after a temporary error', async () => {
    const busy = new APICallError({
      message: 'Rate limited',
      url: 'x',
      requestBodyValues: {},
      statusCode: 429,
      isRetryable: true,
    });
    const model = mockModel((call, index) => (index === 0 ? busy : choose(call, (text) => text.startsWith('Pasar'))));
    const player = createLlmPlayer({ model, maxRetries: 0 });
    expect(await player.decide(mainPhase(), 1)).toMatchObject({ source: 'model', attempts: 2 });
    expect(player.unavailable).toBeNull();
    const [first, second] = model.doGenerateCalls.map((call) => promptText(call).user);
    expect(second).toBe(first);
  });

  it('gives up when the model takes too long', async () => {
    const s = mainPhase();
    const decision = await createLlmPlayer({ model: hangingModel(), timeoutMs: 30 }).decide(s, 1);
    expect(decision).toMatchObject({ source: 'fallback', error: 'sin respuesta en 30 ms', action: chooseAction(s, 1) });
  });

  it('stops at once when the game no longer needs the answer', async () => {
    const controller = new AbortController();
    const pending = createLlmPlayer({ model: hangingModel() }).decide(mainPhase(), 1, { signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toThrow();
  });
});

describe('the LLM prompt', () => {
  it('names both decks and keeps the latest events', () => {
    const s = mainPhase();
    const events = Array.from({ length: 40 }, (_, i) => `Event ${i}.`);
    const { prompt } = buildPrompt(s, 1, decisionFor(s, 1), { decks: ['emberwild', 'duskmire'], recentEvents: events });
    expect(prompt).toContain('Tu mazo: "Fangoscuro"');
    expect(prompt).toContain('Mazo del rival: "Brasalvaje"');
    expect(prompt).toContain('- Dragón del risco · {3}{R}{R}');
    expect(prompt).toContain('- Event 39.');
    expect(prompt).toContain('- Event 10.');
    expect(prompt).not.toContain('- Event 9.');
  });

  it('recalls the reasons it gave for its latest decisions, between the events and the state', () => {
    const s = mainPhase();
    const decision = decisionFor(s, 1);
    const thoughts = Array.from({ length: 12 }, (_, i) => `Thought ${i}.`);
    const { prompt } = buildPrompt(s, 1, decision, { recentEvents: ['Event.'], recentThoughts: thoughts });
    expect(prompt).toContain('## Tus pensamientos recientes, del más antiguo al más reciente\n- Thought 2.\n');
    expect(prompt).toContain('- Thought 11.\n\n## Estado de la partida desde tu asiento');
    expect(prompt).not.toContain('- Thought 1.');
    expect(prompt.indexOf('## Sucesos recientes')).toBeLessThan(prompt.indexOf('## Tus pensamientos recientes'));
    expect(buildPrompt(s, 1, decision, { recentThoughts: [] }).prompt).not.toContain('pensamientos recientes');
  });

  it('is the same whatever the hidden cards are', () => {
    let checked = 0;
    const matchups: [string, string][] = [
      ['emberwild', 'duskmire'],
      ['dawntide', 'emberwild'],
      ['duskmire', 'dawntide'],
    ];
    for (const [index, decks] of matchups.entries()) {
      let s = createGame({ seed: index + 11, players: [{ deck: decks[0] }, { deck: decks[1] }] });
      const events: string[] = [];
      let step = 0;
      while (s.pending && s.pending.kind !== 'gameOver' && step < 400) {
        const player = s.pending.player;
        if (player === 1 && !forcedAction(s) && s.pending.kind !== 'mulligan' && s.pending.kind !== 'bottom') {
          const context = { decks, recentEvents: events };
          const real = buildPrompt(s, 1, decisionFor(s, 1), context);
          const variant = scrambleHiddenInformation(s, 1, index * 1000 + step);
          expect(buildPrompt(variant, 1, decisionFor(variant, 1), context)).toEqual(real);
          checked += 1;
        }
        s = applyAction(s, chooseAction(s, player));
        events.push(...eventLines(s, 1));
        step += 1;
      }
    }
    expect(checked).toBeGreaterThan(40);
  });
});

describe('the lazily loaded LLM player', () => {
  it('loads the LLM code once, on its first decision', async () => {
    const model = mockModel((call) => choose(call, (text) => text.startsWith('Pasar')));
    const load = vi.fn(async () => createLlmPlayer({ model }));
    const player = lazyLlmPlayer('test/model', load);
    expect(player.model).toBe('test/model');
    expect(load).not.toHaveBeenCalled();
    await player.decide(mainPhase(), 1);
    await player.decide(mainPhase(), 1);
    expect(load).toHaveBeenCalledTimes(1);
    expect(model.doGenerateCalls).toHaveLength(2);
    expect(player.unavailable).toBeNull();
  });

  it('is unavailable when its code cannot be loaded', async () => {
    const player = lazyLlmPlayer('test/model', async () => {
      throw new Error('Failed to fetch dynamically imported module');
    });
    await expect(player.decide(mainPhase(), 1)).rejects.toThrow('Failed to fetch');
    expect(player.unavailable).toBe('el código del LLM no se cargó (Failed to fetch dynamically imported module)');
  });
});
