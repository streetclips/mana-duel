import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { LOCALES } from '../src/i18n';
import { CARD_DOCS, renderCardsMarkdown } from './cardsDoc';

const check = process.argv.includes('--check');
let stale = false;

for (const locale of LOCALES) {
  const target = fileURLToPath(new URL(`../${CARD_DOCS[locale]}`, import.meta.url));
  const markdown = renderCardsMarkdown(locale);
  if (check) {
    let current = '';
    try {
      current = readFileSync(target, 'utf8');
    } catch {
      current = '';
    }
    if (current !== markdown) {
      console.error(`${CARD_DOCS[locale]} is out of date. Run: npm run cards`);
      stale = true;
    } else console.log(`${CARD_DOCS[locale]} is up to date.`);
  } else {
    writeFileSync(target, markdown);
    console.log(`Wrote ${target}`);
  }
}

if (stale) process.exit(1);
