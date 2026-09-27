import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CORE_CARDS } from '../../src/engine/cards';

const artDir = new URL('../../public/cards/', import.meta.url);
const artFiles = readdirSync(artDir)
  .filter((name) => name.endsWith('.svg'))
  .sort();

describe('card art', () => {
  it('gives every card one SVG named after its id', () => {
    expect(artFiles).toEqual(CORE_CARDS.map((def) => `${def.id}.svg`).sort());
  });

  it('draws every card on the same 120×80 canvas', () => {
    for (const file of artFiles) {
      const svg = readFileSync(new URL(file, artDir), 'utf8');
      expect(svg, file).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="120" height="80" viewBox="0 0 120 80">/);
      expect(svg.trimEnd(), file).toMatch(/<\/svg>$/);
    }
  });
});
