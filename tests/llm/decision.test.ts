import { describe, expect, it } from 'vitest';
import { applyAction, createGame, forcedAction, getLegalActions } from '../../src/engine';
import { DecisionError, decisionFor, describeAction, type Decision } from '../../src/llm';
import { attack, cast, passTo, passToStep, scenario } from '../helpers';

const reason = 'Because.';

function fieldsOf(decision: Decision, key: string): Record<string, { enum?: string[] }> {
  const schema = decision.schema.toJSONSchema() as unknown as { properties: Record<string, { properties?: Record<string, { enum?: string[] }> }> };
  return schema.properties[key]?.properties ?? {};
}

function mainPhase() {
  return scenario({
    activePlayer: 1,
    players: [
      { battlefield: [{ card: 'grove_tender', id: 'elf' }] },
      {
        hand: [{ card: 'forest', id: 'f' }, { card: 'ember_snap', id: 'snap' }],
        battlefield: ['mountain', { card: 'crag_dragon', id: 'dragon' }],
      },
    ],
  });
}

describe('a decision among the legal actions', () => {
  it('lists every legal action as a numbered option and maps the chosen id back to it', () => {
    const s = mainPhase();
    const legal = getLegalActions(s);
    const decision = decisionFor(s, 1);
    expect(decision.kind).toBe('priority');
    expect(decision.options).toHaveLength(legal.length);
    expect(decision.options[0]).toMatch(/^1: Pasar la prioridad/);
    legal.forEach((action, index) => {
      expect(decision.toAction({ reason, choice: String(index + 1) })).toEqual(action);
    });
    expect(() => decision.toAction({ reason, choice: String(legal.length + 1) })).toThrow();
  });

  it('describes each option from the deciding seat', () => {
    const s = mainPhase();
    const text = decisionFor(s, 1).options.join('\n');
    expect(text).toContain('Jugar la tierra Bosque (f)');
    expect(text).toContain('Lanzar Chasquido de brasas (snap) por {R} sobre Elfa del soto (elf) del rival');
    expect(text).toContain('Lanzar Chasquido de brasas (snap) por {R} sobre el rival');
    expect(text).toContain('Activar tu Dragón del risco (dragon): "{R}: Esta criatura obtiene +1/+0 hasta el final del turno."');
    expect(describeAction(s, { type: 'pass', player: 1 }, 1)).toBe(
      'Pasar la prioridad: no haces nada ahora; cuando los dos jugadores pasen, la partida avanza a: Inicio del combate',
    );
  });

  it('asks whether to keep or mulligan the opening hand', () => {
    const s = createGame({ seed: 2, startingPlayer: 1, players: [{}, { deck: 'duskmire' }] });
    const decision = decisionFor(s, 1);
    expect(decision.kind).toBe('mulligan');
    expect(decision.options).toEqual([
      '1: Quedarte con esta mano de 7 cartas',
      '2: Mulligan: barajar esta mano, robar una mano nueva de 7 y poner 1 carta en el fondo',
    ]);
    expect(decision.toAction({ reason, choice: '2' })).toEqual({ type: 'mulligan', player: 1 });
  });

  it('refuses to decide for the wrong seat', () => {
    expect(() => decisionFor(mainPhase(), 0)).toThrow('no le toca decidir al jugador 0');
  });
});

describe('combat decisions', () => {
  it('ask one yes or no per creature that can attack', () => {
    const s = passTo(
      scenario({
        activePlayer: 1,
        players: [{ battlefield: ['canopy_spider'] }, { battlefield: [{ card: 'ember_hound', id: 'h1' }, { card: 'timberland_rhino', id: 'rhino' }, { card: 'grove_tender', id: 'sick', sick: true }] }],
      }),
      'declareAttackers',
    );
    const decision = decisionFor(s, 1);
    expect(Object.keys(fieldsOf(decision, 'attack'))).toEqual(['h1', 'rhino']);
    expect(decision.question).toContain('Araña del dosel 1/3, Alcance');
    expect(decision.toAction({ reason, attack: { h1: false, rhino: true } })).toEqual({ type: 'declareAttackers', player: 1, attackers: ['rhino'] });
  });

  it('let each blocker pick only an attacker it can block', () => {
    const s = passTo(
      attack(
        scenario({
          players: [
            { battlefield: [{ card: 'cinderwing_drake', id: 'drake' }, { card: 'ember_hound', id: 'hound' }] },
            { battlefield: [{ card: 'timberland_rhino', id: 'rhino' }, { card: 'canopy_spider', id: 'spider' }] },
          ],
        }),
        ['drake', 'hound'],
      ),
      'declareBlockers',
    );
    const decision = decisionFor(s, 1);
    expect(fieldsOf(decision, 'blocks').rhino?.enum).toEqual(['none', 'hound']);
    expect(fieldsOf(decision, 'blocks').spider?.enum).toEqual(['none', 'drake', 'hound']);
    expect(decision.toAction({ reason, blocks: { rhino: 'hound', spider: 'drake' } })).toEqual({
      type: 'declareBlockers',
      player: 1,
      blocks: [
        { blocker: 'rhino', attacker: 'hound' },
        { blocker: 'spider', attacker: 'drake' },
      ],
    });
    expect(() => decision.toAction({ reason, blocks: { rhino: 'drake', spider: 'none' } })).toThrow();
  });

  it('reject blocks the rules forbid, saying why', () => {
    const s = passTo(
      attack(
        scenario({
          players: [
            { battlefield: [{ card: 'ridge_marauder', id: 'marauder' }] },
            { battlefield: [{ card: 'canopy_spider', id: 's1' }, { card: 'canopy_spider', id: 's2' }] },
          ],
        }),
        ['marauder'],
      ),
      'declareBlockers',
    );
    const decision = decisionFor(s, 1);
    expect(() => decision.toAction({ reason, blocks: { s1: 'marauder', s2: 'none' } })).toThrow(DecisionError);
    expect(() => decision.toAction({ reason, blocks: { s1: 'marauder', s2: 'none' } })).toThrow(/amenaza/);
    expect(decision.toAction({ reason, blocks: { s1: 'marauder', s2: 'marauder' } })).toMatchObject({ type: 'declareBlockers' });
  });
});

describe('choosing cards', () => {
  it('asks for exactly the number of cards to put on the bottom', () => {
    let s = createGame({ seed: 3, startingPlayer: 1, players: [{}, {}] });
    s = applyAction(applyAction(s, { type: 'mulligan', player: 1 }), { type: 'mulligan', player: 1 });
    s = applyAction(s, { type: 'keep', player: 1 });
    const decision = decisionFor(s, 1);
    expect(decision.kind).toBe('bottom');
    const [first, second, third] = s.players[1].hand as [string, string, string];
    expect(decision.toAction({ reason, cards: [first, second] })).toEqual({ type: 'bottom', player: 1, cards: [first, second] });
    expect(() => decision.toAction({ reason, cards: [first, first] })).toThrow('elige exactamente 2 cartas distintas de tu mano, no 1');
    expect(() => decision.toAction({ reason, cards: [first, second, third] })).toThrow(DecisionError);
  });

  it('asks which cards to discard at cleanup', () => {
    const s = passTo(
      scenario({
        activePlayer: 1,
        step: 'main2',
        players: [{}, { hand: ['forest', 'forest', 'forest', 'forest', 'forest', 'forest', 'forest', 'swamp', 'swamp'] }],
      }),
      'discard',
    );
    const decision = decisionFor(s, 1);
    expect(decision.kind).toBe('discard');
    expect(decision.answer).toBe('Responde con "cards": exactamente 2 ids de carta de la lista.');
    expect(decision.options).toHaveLength(9);
  });

  it('names the card that makes it discard', () => {
    const s = passTo(
      cast(
        scenario({
          players: [
            { hand: [{ card: 'memory_leech', id: 'leech' }], battlefield: ['swamp', 'swamp', 'swamp'] },
            { hand: [{ card: 'forest', id: 'f' }, { card: 'ember_snap', id: 'snap' }] },
          ],
        }),
        'leech',
      ),
      'discard',
    );
    const decision = decisionFor(s, 1);
    expect(decision.question).toBe('Sanguijuela mental del rival te obliga a descartar 1 carta: elige cuáles.');
    expect(decision.toAction({ reason, cards: ['snap'] })).toEqual({ type: 'discard', player: 1, cards: ['snap'] });
  });
});

describe('forced decisions', () => {
  it('are the only legal action, when there is one', () => {
    const empty = scenario({ activePlayer: 1, players: [{}, {}] });
    expect(forcedAction(empty)).toEqual({ type: 'pass', player: 1 });
    expect(forcedAction(mainPhase())).toBeNull();
    const noAttackers = passToStep(scenario({ activePlayer: 1, players: [{}, { battlefield: [{ card: 'ember_hound', sick: true }] }] }), 'main2');
    expect(forcedAction(noAttackers)).toEqual({ type: 'pass', player: 1 });
  });
});
