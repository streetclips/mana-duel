import { describe, expect, it } from 'vitest';
import {
  RELICS,
  VIGOR_LIFE,
  duelPerks,
  isRelicId,
  mostCommonLand,
  relicOf,
  relicsOf,
  startsEveryDuel,
  type RelicId,
  type SeatRelics,
} from '../../src/app/relics';
import { RELIC_DEFS, getDeck, hasCardDef } from '../../src/engine';

function seat(deck: string, relics: RelicId[] = [], extra: Partial<SeatRelics> = {}): SeatRelics {
  const def = getDeck(deck);
  return { relics, deck: def.cards, colors: def.colors, ...extra };
}

describe('relics', () => {
  it('are twelve for the player, ten of which a rival may carry too, and three more for bosses only', () => {
    expect(relicsOf(['any', 'player'])).toHaveLength(12);
    expect(relicsOf(['any'])).toEqual([
      'vigor',
      'foresight',
      'banner',
      'cartographer',
      'mask',
      'censer',
      'urn',
      'drum',
      'chalice',
      'tome',
    ]);
    expect(relicsOf(['player'])).toEqual(['hourglass', 'phoenix']);
    expect(relicsOf(['boss'])).toEqual(['bell', 'grimoire', 'crown']);
    expect(new Set(RELICS.map((relic) => relic.name)).size).toBe(RELICS.length);
  });

  it('bring the relics in play the engine knows, with the engine’s name and rules text', () => {
    expect(RELICS.filter((relic) => relic.kind === 'play').map((relic) => relic.id)).toEqual(
      RELIC_DEFS.map((def) => def.id),
    );
    for (const relic of RELICS) expect(hasCardDef(relic.id), relic.id).toBe(relic.kind === 'play');
    expect(relicOf('bell')).toEqual({
      id: 'bell',
      name: 'Campana fúnebre',
      text: 'Al comienzo de tu mantenimiento, cada oponente pierde 1 vida.',
      kind: 'play',
      owner: 'boss',
    });
    expect(relicOf('vigor').text).toBe(`Empiezas cada duelo con ${VIGOR_LIFE} vidas más.`);
    expect([isRelicId('tome'), isRelicId('gong'), isRelicId(7)]).toEqual([true, false, false]);
    expect(() => relicOf('nope' as RelicId)).toThrow('Unknown relic "nope"');
  });

  it('turn into perks for the seat that holds them, the mask into a card fewer for the other seat', () => {
    expect(duelPerks([seat('crossroads'), seat('emberwild')])).toEqual([{}, {}]);
    const all = relicsOf(['any', 'player']);
    expect(duelPerks([seat('crossroads', all), seat('emberwild', [], { life: 16, openingHand: 6 })])).toEqual([
      {
        life: 20 + VIGOR_LIFE,
        battlefield: ['soldier_token', 'silver_spire'],
        relics: ['censer', 'urn', 'drum', 'chalice', 'tome'],
        drawOnFirstTurn: true,
      },
      { life: 16, openingHand: 5 },
    ]);
    expect(
      duelPerks([seat('dawntide', ['foresight']), seat('duskmire', ['bell', 'banner'], { life: 20, openingHand: 6 })]),
    ).toEqual([{ openingHand: 8 }, { openingHand: 6, battlefield: ['soldier_token'], relics: ['bell'] }]);
    expect(duelPerks([seat('wildland', ['cartographer']), seat('dawntide', ['mask'])])).toEqual([
      { openingHand: 5, battlefield: ['forest'] },
      {},
    ]);
    expect(duelPerks([seat('wildland', [], { openingHand: 1 }), seat('dawntide', ['mask'])])[0]).toEqual({
      openingHand: 1,
    });
  });

  it('start the duel for the hourglass, and find the most common land of a deck, or a basic of its first color', () => {
    expect([startsEveryDuel(['hourglass', 'vigor']), startsEveryDuel(['vigor'])]).toEqual([true, false]);
    expect(mostCommonLand(getDeck('emberwild').cards, ['R', 'G'])).toBe('forest');
    expect(mostCommonLand([{ card: 'kiln_sprite', count: 40 }], ['R'])).toBe('mountain');
    expect(mostCommonLand([], [])).toBeNull();
  });
});
