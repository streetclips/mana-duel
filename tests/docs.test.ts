import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { renderCardsMarkdown } from '../scripts/cardsDoc';

describe('documentation', () => {
  it('keeps docs/CARDS.md in sync with the card definitions', () => {
    const current = readFileSync(new URL('../docs/CARDS.md', import.meta.url), 'utf8');
    expect(current).toBe(renderCardsMarkdown());
  });
});
