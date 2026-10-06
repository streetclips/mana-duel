import type { JSX } from 'preact';
import { keywordName, type Keyword } from '../../engine';
import { cardText } from '../text/card';

export type IconName = Keyword | 'trigger';

function Sword({ transform }: { transform: string }) {
  return (
    <g transform={transform}>
      <path d="M8 0.9 L9.25 2.4 V9.7 H6.75 V2.4 Z" />
      <path d="M4.1 9.7 H11.9 V11.3 H4.1 Z" />
      <path d="M7.2 11.3 H8.8 V13.4 H7.2 Z" />
      <circle cx="8" cy="14.3" r="1.15" />
    </g>
  );
}

const GLYPHS: Record<IconName, () => JSX.Element> = {
  flying: () => (
    <path d="M2.2 13.6 C2.6 8.6 6 4.2 13.8 2.2 C12.9 4.3 11.5 5.6 9.9 6.4 C11.3 6.5 12.4 6.3 13.3 5.9 C12.3 8.1 10.6 9.3 8.6 9.7 C9.7 10 10.7 10 11.6 9.7 C10.2 11.8 7.4 12.9 4.6 12.4 Z" />
  ),
  reach: () => <path d="M2.8 1.8 H13.2 V3.6 H2.8 Z M8 4.6 L12.8 9.4 H9.5 V14.4 H6.5 V9.4 H3.2 Z" />,
  haste: () => <path d="M9.6 1.2 L3.4 9.2 H7.3 L6.3 14.8 L12.6 6.5 H8.7 Z" />,
  vigilance: () => (
    <>
      <path
        fill-rule="evenodd"
        d="M1.2 8 C3.1 4.5 5.4 3.1 8 3.1 C10.6 3.1 12.9 4.5 14.8 8 C12.9 11.5 10.6 12.9 8 12.9 C5.4 12.9 3.1 11.5 1.2 8 Z M8 5.4 A2.6 2.6 0 1 0 8 10.6 A2.6 2.6 0 1 0 8 5.4 Z"
      />
      <circle cx="8" cy="8" r="1.3" />
    </>
  ),
  trample: () => <path d="M1.6 3 H4.6 L9.6 8 L4.6 13 H1.6 L6.6 8 Z M6.8 3 H9.8 L14.8 8 L9.8 13 H6.8 L11.8 8 Z" />,
  firstStrike: () => <Sword transform="rotate(40 8 8)" />,
  doubleStrike: () => (
    <>
      <Sword transform="translate(4.6 8) scale(0.86) translate(-8 -8)" />
      <Sword transform="translate(11.4 8) scale(0.86) translate(-8 -8)" />
    </>
  ),
  deathtouch: () => (
    <path
      fill-rule="evenodd"
      d="M8 1.4 C4.5 1.4 2.2 3.9 2.2 7 C2.2 9 3.2 10.4 4.6 11.1 V13.4 C4.6 14 5 14.4 5.6 14.4 H10.4 C11 14.4 11.4 14 11.4 13.4 V11.1 C12.8 10.4 13.8 9 13.8 7 C13.8 3.9 11.5 1.4 8 1.4 Z M5.7 5.8 A1.7 1.7 0 1 0 5.7 9.2 A1.7 1.7 0 1 0 5.7 5.8 Z M10.3 5.8 A1.7 1.7 0 1 0 10.3 9.2 A1.7 1.7 0 1 0 10.3 5.8 Z M8 9.3 L9 11 H7 Z M6.5 12.3 H7.3 V14.4 H6.5 Z M8.7 12.3 H9.5 V14.4 H8.7 Z"
    />
  ),
  lifelink: () => (
    <path d="M8 14.4 C3 10.9 1.3 8.4 1.3 5.7 C1.3 3.6 2.9 2 4.8 2 C6.2 2 7.3 2.8 8 3.9 C8.7 2.8 9.8 2 11.2 2 C13.1 2 14.7 3.6 14.7 5.7 C14.7 8.4 13 10.9 8 14.4 Z" />
  ),
  menace: () => (
    <>
      <path d="M1.2 1.8 C1.5 5.6 3 7.9 5.6 8.6 L6.3 6.9 C4.2 6.2 2.5 4.6 1.2 1.8 Z M14.8 1.8 C14.5 5.6 13 7.9 10.4 8.6 L9.7 6.9 C11.8 6.2 13.5 4.6 14.8 1.8 Z" />
      <path
        fill-rule="evenodd"
        d="M8 6 A4.2 4.2 0 1 0 8 14.4 A4.2 4.2 0 1 0 8 6 Z M5.6 9.1 L7.5 10 L7.2 11 L5.4 10.1 Z M10.4 9.1 L8.5 10 L8.8 11 L10.6 10.1 Z"
      />
    </>
  ),
  defender: () => (
    <path d="M1.4 2.4 H7.6 V5.2 H1.4 Z M8.4 2.4 H14.6 V5.2 H8.4 Z M1.4 6 H4.4 V8.8 H1.4 Z M5.2 6 H10.8 V8.8 H5.2 Z M11.6 6 H14.6 V8.8 H11.6 Z M1.4 9.6 H7.6 V12.4 H1.4 Z M8.4 9.6 H14.6 V12.4 H8.4 Z M1.4 13.2 H14.6 V14.4 H1.4 Z" />
  ),
  flash: () => (
    <path d="M8 0.8 C8.5 5.1 10.9 7.5 15.2 8 C10.9 8.5 8.5 10.9 8 15.2 C7.5 10.9 5.1 8.5 0.8 8 C5.1 7.5 7.5 5.1 8 0.8 Z" />
  ),
  skulk: () => (
    <path
      fill-rule="evenodd"
      d="M1 6.1 C1 4.5 3.4 3.8 8 3.8 C12.6 3.8 15 4.5 15 6.1 C15 9.8 13.2 11.7 11 11.7 C9.6 11.7 9 10.2 8 10.2 C7 10.2 6.4 11.7 5 11.7 C2.8 11.7 1 9.8 1 6.1 Z M3.3 7.3 C4 6.3 5.6 6.3 6.7 7.5 C5.8 8.6 4.2 8.6 3.3 7.3 Z M12.7 7.3 C12 6.3 10.4 6.3 9.3 7.5 C10.2 8.6 11.8 8.6 12.7 7.3 Z"
    />
  ),
  undying: () => (
    <>
      <path
        d="M12.9 9.4 A5.1 5.1 0 1 1 10.3 3.5"
        fill="none"
        stroke="currentColor"
        stroke-width="2.3"
        stroke-linecap="round"
      />
      <path d="M8.6 0.6 L14 2.9 L10 7 Z" />
    </>
  ),
  hexproof: () => (
    <path
      fill-rule="evenodd"
      d="M8 1.1 L14 3.2 V7.6 C14 11.2 11.5 13.7 8 15.1 C4.5 13.7 2 11.2 2 7.6 V3.2 Z M8 5.3 A2.4 2.4 0 1 0 8 10.1 A2.4 2.4 0 1 0 8 5.3 Z"
    />
  ),
  evolve: () => (
    <path d="M8 1.4 L13.8 7.2 H10.9 L8 4.3 L5.1 7.2 H2.2 Z M8 7.6 L13.8 13.4 H10.9 L8 10.5 L5.1 13.4 H2.2 Z" />
  ),
  prowess: () => (
    <>
      <path
        fill-rule="evenodd"
        d="M3.4 5.4 C3.4 4.3 4.2 3.5 5.2 3.5 H11.4 C12.6 3.5 13.5 4.4 13.5 5.6 V10.4 C13.5 12.8 11.7 14.6 9.3 14.6 H7.1 C5 14.6 3.4 13 3.4 10.9 Z M5.9 3.5 H6.5 V7.4 H5.9 Z M8.4 3.5 H9 V7.4 H8.4 Z M10.9 3.5 H11.5 V7.4 H10.9 Z M3.4 8.3 H9.2 C10 8.3 10.6 8.9 10.6 9.7 C10.6 10.5 10 11.1 9.2 11.1 H3.4 Z"
      />
      <path
        d="M1 6 H2.4 M0.8 8.6 H2.2 M1 11.2 H2.4"
        fill="none"
        stroke="currentColor"
        stroke-width="0.9"
        stroke-linecap="round"
      />
    </>
  ),
  trigger: () => <path d="M2.6 3.4 H13.4 V5.2 H2.6 Z M2.6 7.1 H13.4 V8.9 H2.6 Z M2.6 10.8 H9.8 V12.6 H2.6 Z" />,
};

export function CardIcon({ name, title }: { name: IconName; title?: string }) {
  return (
    <svg class="icon" viewBox="0 0 20 20" data-icon={name} aria-hidden="true">
      <title>{title ?? (name === 'trigger' ? cardText().triggeredAbility : keywordName(name))}</title>
      <circle class="icon-disc" cx="10" cy="10" r="9.7" />
      <circle class="icon-ring" cx="10" cy="10" r="9.15" />
      <g class="icon-glyph" transform="translate(2 2)">
        {GLYPHS[name]()}
      </g>
    </svg>
  );
}
