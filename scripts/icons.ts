import { writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const MANA = ['#d8bf6a', '#3f77c3', '#5a5461', '#cf5841', '#3e8a5a'];
const BACKGROUND = '#121211';

interface IconStyle {
  corner: number;
  scale: number;
}

function pips(): string {
  return MANA.map((color, index) => {
    const angle = ((-90 + index * 72) * Math.PI) / 180;
    const x = (58 * Math.cos(angle)).toFixed(1);
    const y = (58 * Math.sin(angle)).toFixed(1);
    return `<circle cx="${x}" cy="${y}" r="25" fill="${color}"/>`;
  }).join('');
}

function iconSvg({ corner, scale }: IconStyle, size = 512): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${size}" height="${size}">`,
    `<rect width="512" height="512" rx="${corner}" fill="${BACKGROUND}"/>`,
    `<g transform="translate(256 256) scale(${scale})">`,
    '<g transform="translate(-40 -4) rotate(-14)">',
    '<rect x="-100" y="-140" width="200" height="280" rx="22" fill="#3b3a36"/>',
    '<rect x="-78" y="-118" width="156" height="236" rx="12" fill="none" stroke="#5f5c55" stroke-width="8"/>',
    '</g>',
    '<g transform="translate(42 8) rotate(9)">',
    '<rect x="-100" y="-140" width="200" height="280" rx="22" fill="#edeae4"/>',
    pips(),
    '</g>',
    '</g>',
    '</svg>',
  ].join('');
}

const ROUNDED: IconStyle = { corner: 112, scale: 1 };
const FULL_BLEED: IconStyle = { corner: 0, scale: 0.9 };
const MASKABLE: IconStyle = { corner: 0, scale: 0.74 };

const PNGS: { file: string; style: IconStyle; size: number }[] = [
  { file: 'icon-192.png', style: ROUNDED, size: 192 },
  { file: 'icon-512.png', style: ROUNDED, size: 512 },
  { file: 'icon-maskable-512.png', style: MASKABLE, size: 512 },
  { file: 'apple-touch-icon.png', style: FULL_BLEED, size: 180 },
];

const dir = new URL('../public/icons/', import.meta.url);
writeFileSync(new URL('favicon.svg', dir), `${iconSvg(ROUNDED).replace(/ width="\d+" height="\d+"/, '')}\n`);

const browser = await chromium.launch();
const page = await browser.newPage();
for (const { file, style, size } of PNGS) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<body style="margin:0">${iconSvg(style, size)}</body>`);
  await page.screenshot({ path: new URL(file, dir).pathname, omitBackground: true });
  console.log(`public/icons/${file}`);
}
await browser.close();
