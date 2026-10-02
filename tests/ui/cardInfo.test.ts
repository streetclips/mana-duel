import { describe, expect, it } from 'vitest';
import { getCardDef } from '../../src/engine';
import { abilityHints, cardColors, effectHint, lastingTriggers } from '../../src/ui/cardInfo';

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

  it('keep for the battlefield only the triggers that can still happen', () => {
    expect(lastingTriggers(getCardDef('rotwing_crow')).map((trigger) => trigger.on)).toEqual(['allyDies']);
    expect(lastingTriggers(getCardDef('gloom_wisp')).map((trigger) => trigger.on)).toEqual(['dies']);
    expect(lastingTriggers(getCardDef('cinder_adept'))).toEqual([]);
    expect(lastingTriggers(getCardDef('blistering_hellion'))).toEqual([]);
  });

  it('color a token by its own colors, other cards by their cost', () => {
    expect(cardColors(getCardDef('elemental_token'))).toEqual(['R']);
    expect(cardColors(getCardDef('sunbrand'))).toEqual(['W', 'R']);
    expect(cardColors(getCardDef('spirit_token'))).toEqual(['W', 'B']);
  });
});
