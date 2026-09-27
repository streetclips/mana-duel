import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderCardsMarkdown } from './cardsDoc';

const target = fileURLToPath(new URL('../docs/CARDS.md', import.meta.url));
const markdown = renderCardsMarkdown();

if (process.argv.includes('--check')) {
  let current = '';
  try {
    current = readFileSync(target, 'utf8');
  } catch {
    current = '';
  }
  if (current !== markdown) {
    console.error('docs/CARDS.md is out of date. Run: npm run cards');
    process.exit(1);
  }
  console.log('docs/CARDS.md is up to date.');
} else {
  writeFileSync(target, markdown);
  console.log(`Wrote ${target}`);
}
