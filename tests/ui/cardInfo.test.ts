import { describe, expect, it } from 'vitest';
import { getCardDef } from '../../src/engine';
import { cardColors, effectHint, shortText } from '../../src/ui/cardInfo';

describe('short card texts', () => {
  it('abbreviate keywords, triggers, tokens, discards and sacrifice costs', () => {
    expect(shortText('crag_dragon')).toBe('Flying · R: +1/+0');
    expect(shortText('forge_cadet')).toBe('Ally enters: +1 counter');
    expect(shortText('brightforge_marshal')).toBe('Enters: +2 Soldiers');
    expect(shortText('brightforge_warlord')).toBe('Enters: team +1/+0 haste');
    expect(shortText('hushwing_bat')).toBe('Flying · Hits: opp discards 1');
    expect(shortText('rotwing_crow')).toBe('Flying · Ally dies: opp -1 life');
    expect(shortText('bloodspore_thrall')).toBe('Undying · Sac: opp -1 life');
  });

  it('abbreviate life gain triggers, bloodthirst, evolve, hexproof and bites', () => {
    expect(shortText('vesper_novice')).toBe('Gain life: +1 counter');
    expect(shortText('sanguine_chorister')).toBe('Gain life: opp -1 life');
    expect(shortText('blistering_hellion')).toBe('Bloodthirst: +2 counters');
    expect(shortText('reefwing_fledgling')).toBe('Flying · Evolve');
    expect(shortText('deepgrove_leviathan')).toBe('Trample · Hexproof');
    expect(effectHint({ kind: 'bite', a: 0, b: 1 })).toBe('bite');
  });

  it('color a token by its own colors, other cards by their cost', () => {
    expect(cardColors(getCardDef('elemental_token'))).toEqual(['R']);
    expect(cardColors(getCardDef('sunbrand'))).toEqual(['W', 'R']);
    expect(cardColors(getCardDef('spirit_token'))).toEqual(['W', 'B']);
  });
});
