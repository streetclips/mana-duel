import { describe, expect, it } from 'vitest';
import { getCardDef } from '../../src/engine';
import { cardColors, effectHint, shortText } from '../../src/ui/cardInfo';

describe('short card texts', () => {
  it('abbreviate keywords, triggers, tokens, discards and sacrifice costs', () => {
    expect(shortText('crag_dragon')).toBe('Vuela · R: +1/+0');
    expect(shortText('forge_cadet')).toBe('Otra entra: +1 contador');
    expect(shortText('brightforge_marshal')).toBe('Entra: +2 Soldados');
    expect(shortText('brightforge_warlord')).toBe('Entra: todas +1/+0 prisa');
    expect(shortText('hushwing_bat')).toBe('Vuela · Golpea: rival descarta 1');
    expect(shortText('rotwing_crow')).toBe('Vuela · Otra muere: rival -1 vida');
    expect(shortText('bloodspore_thrall')).toBe('Resiliencia · Sacr.: rival -1 vida');
  });

  it('abbreviate life gain triggers, bloodthirst, evolve, hexproof and bites', () => {
    expect(shortText('vesper_novice')).toBe('Ganas vidas: +1 contador');
    expect(shortText('sanguine_chorister')).toBe('Ganas vidas: rival -1 vida');
    expect(shortText('blistering_hellion')).toBe('Sed de sangre: +2 contadores');
    expect(shortText('reefwing_fledgling')).toBe('Vuela · Evolucionar');
    expect(shortText('deepgrove_leviathan')).toBe('Arrolla · Antimaleficio');
    expect(effectHint({ kind: 'bite', a: 0, b: 1 })).toBe('morder');
  });

  it('color a token by its own colors, other cards by their cost', () => {
    expect(cardColors(getCardDef('elemental_token'))).toEqual(['R']);
    expect(cardColors(getCardDef('sunbrand'))).toEqual(['W', 'R']);
    expect(cardColors(getCardDef('spirit_token'))).toEqual(['W', 'B']);
  });
});
