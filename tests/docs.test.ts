import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LOCALES } from '../src/i18n';
import { CARD_DOCS, renderCardsMarkdown } from '../scripts/cardsDoc';

describe('documentation', () => {
  for (const locale of LOCALES) {
    it(`keeps ${CARD_DOCS[locale]} in sync with the card definitions`, () => {
      const current = readFileSync(new URL(`../${CARD_DOCS[locale]}`, import.meta.url), 'utf8');
      expect(current).toBe(renderCardsMarkdown(locale));
    });
  }
});
