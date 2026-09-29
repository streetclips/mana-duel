import { describe, expect, it } from 'vitest';
import { getCardDef } from '../../src/engine';
import { cardColors, shortText } from '../../src/ui/cardInfo';

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

  it('color a token by its own colors, other cards by their cost', () => {
    expect(cardColors(getCardDef('elemental_token'))).toEqual(['R']);
    expect(cardColors(getCardDef('sunbrand'))).toEqual(['W', 'R']);
  });
});
