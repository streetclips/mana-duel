import { describe, expect, it } from 'vitest';
import { getCardDef } from '../../src/engine';
import { abilityHints, cardColors, effectHint, landHint, lastingTriggers } from '../../src/ui/cardInfo';

describe('short card texts', () => {
  it('abbreviate triggers, tokens, discards, mana and sacrifice costs, and leave keywords to the icons', () => {
    expect(abilityHints('crag_dragon')).toEqual(['R: +1/+0']);
    expect(abilityHints('grove_tender')).toEqual(['T: +G']);
    expect(abilityHints('kelpweaver_druid')).toEqual(['T: +G/U']);
    expect(abilityHints('forge_cadet')).toEqual(['Otra entra: +1 contador']);
    expect(abilityHints('brightforge_marshal')).toEqual(['Entra: +2 Soldados']);
    expect(abilityHints('brightforge_warlord')).toEqual(['Entra: todas +1/+0 prisa']);
    expect(abilityHints('hushwing_bat')).toEqual(['Golpea: rival descarta 1']);
    expect(abilityHints('rotwing_crow')).toEqual(['Otra muere: rival -1 vida']);
    expect(abilityHints('bloodspore_thrall')).toEqual(['Sacr.: rival -1 vida']);
  });

  it('abbreviate life gain triggers, bloodthirst and bites; evolve and hexproof are keywords only', () => {
    expect(abilityHints('vesper_novice')).toEqual(['Ganas vidas: +1 contador']);
    expect(abilityHints('sanguine_chorister')).toEqual(['Ganas vidas: rival -1 vida']);
    expect(abilityHints('blistering_hellion')).toEqual(['Sed de sangre: +2 contadores']);
    expect(abilityHints('reefwing_fledgling')).toEqual([]);
    expect(abilityHints('deepgrove_leviathan')).toEqual([]);
    expect(effectHint({ kind: 'bite', a: 0, b: 1 })).toBe('morder');
  });

  it('abbreviate landfall, land searches, extra land plays and mana of any color; prowess is a keyword only', () => {
    expect(abilityHints('quake_boar')).toEqual(['Aterrizaje: +1 contador']);
    expect(abilityHints('cliff_lynx')).toEqual(['Aterrizaje: +2/+2']);
    expect(abilityHints('wildland_colossus')).toEqual(['Aterrizaje: +1 Bestia']);
    expect(abilityHints('trail_scout')).toEqual(['Entra: busca Bosque']);
    expect(abilityHints('tribe_elder')).toEqual(['Sacr.: busca Bosque']);
    expect(abilityHints('wayfarer_druid')).toEqual(['T: +cualquier color']);
    expect(abilityHints('flamecrest_mentor')).toEqual(['Hechizo: +1 Monje']);
    expect(abilityHints('cloister_lancer')).toEqual([]);
    expect(landHint(getCardDef('silver_spire'))).toBe('Entra girada. {W}{U}{B}');
    expect(landHint(getCardDef('prismatic_fount'))).toBe('Entra girada. {any}');
    expect(landHint(getCardDef('forest'))).toBeNull();
    expect(effectHint({ kind: 'extraLands', amount: 1 })).toBe('+1 tierra');
    expect(effectHint({ kind: 'searchLand', land: 'forest', battlefield: 1, hand: 1, tapped: true })).toBe('busca 2 Bosques');
  });

  it('keep for the battlefield only the triggers that can still happen', () => {
    expect(lastingTriggers(getCardDef('rotwing_crow')).map((trigger) => trigger.on)).toEqual(['allyDies']);
    expect(lastingTriggers(getCardDef('gloom_wisp')).map((trigger) => trigger.on)).toEqual(['dies']);
    expect(lastingTriggers(getCardDef('cinder_adept'))).toEqual([]);
    expect(lastingTriggers(getCardDef('blistering_hellion'))).toEqual([]);
    expect(lastingTriggers(getCardDef('quake_boar')).map((trigger) => trigger.on)).toEqual(['landfall']);
  });

  it('color a token by its own colors, other cards by their cost', () => {
    expect(cardColors(getCardDef('elemental_token'))).toEqual(['R']);
    expect(cardColors(getCardDef('sunbrand'))).toEqual(['W', 'R']);
    expect(cardColors(getCardDef('spirit_token'))).toEqual(['W', 'B']);
    expect(cardColors(getCardDef('silver_spire'))).toEqual(['W', 'U', 'B']);
    expect(cardColors(getCardDef('monk_token'))).toEqual(['R']);
  });
});
