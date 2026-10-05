import type { JSX } from 'preact';
import type { RelicId } from '../../app/relics';

const RELIC_GLYPHS: Record<RelicId, () => JSX.Element> = {
  vigor: () => <path d="M10 16.4 C4.6 12.6 2.4 9.9 2.4 7 C2.4 4.8 4.1 3.2 6.2 3.2 C7.7 3.2 9 4 10 5.4 C11 4 12.3 3.2 13.8 3.2 C15.9 3.2 17.6 4.8 17.6 7 C17.6 9.9 15.4 12.6 10 16.4 Z" />,
  foresight: () => (
    <>
      <path
        fill-rule="evenodd"
        d="M1.6 10 C3.8 6 6.6 4.4 10 4.4 C13.4 4.4 16.2 6 18.4 10 C16.2 14 13.4 15.6 10 15.6 C6.6 15.6 3.8 14 1.6 10 Z M10 6.8 A3.2 3.2 0 1 0 10 13.2 A3.2 3.2 0 1 0 10 6.8 Z"
      />
      <circle cx="10" cy="10" r="1.6" />
    </>
  ),
  banner: () => <path d="M4.2 2.2 H5.8 V17.8 H4.2 Z M6.6 3 H16.2 L13.6 6.8 L16.2 10.6 H6.6 Z" />,
  cartographer: () => (
    <path
      fill-rule="evenodd"
      d="M2.4 4.6 L7.2 2.8 L12.8 4.8 L17.6 3 V15.4 L12.8 17.2 L7.2 15.2 L2.4 17 Z M7.9 4.6 V13.9 L12.1 15.4 V6.1 Z"
    />
  ),
  hourglass: () => <path d="M4.6 2.4 H15.4 V4 H14.2 C14.2 7 12.4 8.6 11 10 C12.4 11.4 14.2 13 14.2 16 H15.4 V17.6 H4.6 V16 H5.8 C5.8 13 7.6 11.4 9 10 C7.6 8.6 5.8 7 5.8 4 H4.6 Z M7.6 16 H12.4 C12.4 14.2 11.2 13 10 12 C8.8 13 7.6 14.2 7.6 16 Z" />,
  bell: () => (
    <>
      <circle cx="10" cy="2.7" r="1.3" />
      <path d="M10 4 C6.8 4 5.2 6.4 5.2 9.6 V12.2 C5.2 13.3 4 14.1 3 15.2 H17 C16 14.1 14.8 13.3 14.8 12.2 V9.6 C14.8 6.4 13.2 4 10 4 Z" />
      <circle cx="10" cy="16.9" r="1.6" />
    </>
  ),
  grimoire: () => (
    <>
      <path
        fill-rule="evenodd"
        d="M4.4 2.4 H15 C15.8 2.4 16.4 3 16.4 3.8 V17.6 H5.8 C5 17.6 4.4 17 4.4 16.2 Z M5.8 15.2 V16.2 H15 V15.2 Z M10.4 5.4 L13 9 L10.4 12.6 L7.8 9 Z"
      />
      <circle cx="10.4" cy="9" r="1.1" />
    </>
  ),
  censer: () => (
    <>
      <path d="M9.4 0.8 H10.6 V4.6 H9.4 Z" />
      <path
        fill-rule="evenodd"
        d="M6 9.4 C6 6.6 7.8 4.8 10 4.8 C12.2 4.8 14 6.6 14 9.4 Z M8.4 7.4 A0.7 0.7 0 1 0 8.4 8.8 A0.7 0.7 0 1 0 8.4 7.4 Z M10 6.2 A0.7 0.7 0 1 0 10 7.6 A0.7 0.7 0 1 0 10 6.2 Z M11.6 7.4 A0.7 0.7 0 1 0 11.6 8.8 A0.7 0.7 0 1 0 11.6 7.4 Z"
      />
      <path d="M5.2 9.9 H14.8 V11 H5.2 Z M5.8 11.4 H14.2 C14 13.8 12.2 15.4 10 15.4 C7.8 15.4 6 13.8 5.8 11.4 Z M8.4 15.6 H11.6 L12.4 17.6 H7.6 Z" />
      <path d="M15.6 3.4 C16.9 4 17.2 5.3 16.5 6.2 C17.8 6.7 18.2 8.2 17.3 9.2 C17.1 8.3 16.5 7.7 15.6 7.6 C16.3 6.8 16.1 5.7 15.2 5.2 C15.8 4.7 15.8 4 15.6 3.4 Z M4.4 3.4 C3.1 4 2.8 5.3 3.5 6.2 C2.2 6.7 1.8 8.2 2.7 9.2 C2.9 8.3 3.5 7.7 4.4 7.6 C3.7 6.8 3.9 5.7 4.8 5.2 C4.2 4.7 4.2 4 4.4 3.4 Z" />
    </>
  ),
  urn: () => (
    <>
      <circle cx="10" cy="2.6" r="1.1" />
      <path d="M6.8 3.9 H13.2 L12.5 5.4 H7.5 Z" />
      <path
        fill-rule="evenodd"
        d="M7.8 5.4 H12.2 V7 C14.8 7.9 16.1 10 16.1 12.5 C16.1 15.2 13.9 17 11.6 17.4 H8.4 C6.1 17 3.9 15.2 3.9 12.5 C3.9 10 5.2 7.9 7.8 7 Z M4.9 11.4 V12.7 H15.1 V11.4 Z"
      />
      <path d="M7.2 17.4 H12.8 V18.6 H7.2 Z" />
    </>
  ),
  drum: () => (
    <>
      <path d="M3.6 2.2 L4.6 1.4 L11 7.6 L10 8.4 Z M16.4 2.2 L15.4 1.4 L9 7.6 L10 8.4 Z" />
      <path
        fill-rule="evenodd"
        d="M10 7.6 C13.6 7.6 16.6 8.6 16.6 10 V15.4 C16.6 16.8 13.6 17.8 10 17.8 C6.4 17.8 3.4 16.8 3.4 15.4 V10 C3.4 8.6 6.4 7.6 10 7.6 Z M10 9 C7.2 9 5 9.5 5 10 C5 10.5 7.2 11 10 11 C12.8 11 15 10.5 15 10 C15 9.5 12.8 9 10 9 Z M5.6 12.6 L7.2 15.8 L8.8 12.6 L10 14.9 L11.2 12.6 L12.8 15.8 L14.4 12.6 L14.4 13.5 L12.8 16.6 L11.2 13.5 L10 15.8 L8.8 13.5 L7.2 16.6 L5.6 13.5 Z"
      />
    </>
  ),
  chalice: () => (
    <path
      fill-rule="evenodd"
      d="M4.6 2.6 H15.4 C15.4 7.2 13.3 10 10.9 10.5 V14.3 C12.3 14.6 13.7 15.3 14.1 16.3 V17.6 H5.9 V16.3 C6.3 15.3 7.7 14.6 9.1 14.3 V10.5 C6.7 10 4.6 7.2 4.6 2.6 Z M10 4.6 A1.6 1.6 0 1 0 10 7.8 A1.6 1.6 0 1 0 10 4.6 Z"
    />
  ),
  mask: () => (
    <path
      fill-rule="evenodd"
      d="M3.2 4.2 C6.8 2.8 13.2 2.8 16.8 4.2 C17 9.8 14.3 15.8 10 17.2 C5.7 15.8 3 9.8 3.2 4.2 Z M5.6 8.4 C5.6 7.4 6.6 6.8 7.6 6.8 C8.6 6.8 9.4 7.5 9.4 8.4 C8.4 9.3 6.6 9.3 5.6 8.4 Z M14.4 8.4 C14.4 7.4 13.4 6.8 12.4 6.8 C11.4 6.8 10.6 7.5 10.6 8.4 C11.6 9.3 13.4 9.3 14.4 8.4 Z M7.8 12.4 H12.2 V13.4 H7.8 Z"
    />
  ),
  tome: () => (
    <path
      fill-rule="evenodd"
      d="M1.8 4.6 C4.6 3.4 7.4 3.6 9.4 5.2 V16.6 C7.4 15 4.6 14.8 1.8 16 Z M18.2 4.6 C15.4 3.4 12.6 3.6 10.6 5.2 V16.6 C12.6 15 15.4 14.8 18.2 16 Z M3.4 7.4 C5 6.8 6.6 6.9 7.9 7.6 V8.5 C6.6 7.8 5 7.7 3.4 8.3 Z M3.4 10.2 C5 9.6 6.6 9.7 7.9 10.4 V11.3 C6.6 10.6 5 10.5 3.4 11.1 Z M16.6 7.4 C15 6.8 13.4 6.9 12.1 7.6 V8.5 C13.4 7.8 15 7.7 16.6 8.3 Z M16.6 10.2 C15 9.6 13.4 9.7 12.1 10.4 V11.3 C13.4 10.6 15 10.5 16.6 11.1 Z"
    />
  ),
  phoenix: () => (
    <>
      <path
        fill-rule="evenodd"
        d="M16 2.2 C10.6 3.2 6.4 7.6 5.2 13.4 L4 17.8 L5.3 17.3 L6.8 14 C11.8 13.2 15.6 9.2 16 2.2 Z M14.6 3.9 C11.2 6.4 8.6 9.8 7 13.4 L6.6 13.1 C8.2 9.5 10.8 6.1 14.2 3.6 Z"
      />
      <path d="M17.2 6.6 C18.2 8.2 17.8 10 16.6 10.8 C16.8 9.8 16.4 9 15.9 8.4 C16.8 8 17.3 7.4 17.2 6.6 Z M14.4 11.6 C15.2 12.8 14.9 14.2 14 14.8 C14.1 14 13.8 13.4 13.4 13 C14 12.7 14.4 12.2 14.4 11.6 Z" />
    </>
  ),
  crown: () => (
    <>
      <path
        fill-rule="evenodd"
        d="M2.4 6 L6.4 9.8 L10 3.2 L13.6 9.8 L17.6 6 L16.2 15.4 H3.8 Z M10 9.6 A1.5 1.5 0 1 0 10 12.6 A1.5 1.5 0 1 0 10 9.6 Z"
      />
      <path d="M3.8 16.4 H16.2 V18 H3.8 Z" />
    </>
  ),
};

export function hasRelicGlyph(id: string): id is RelicId {
  return Object.hasOwn(RELIC_GLYPHS, id);
}

export function RelicIcon({ relic }: { relic: RelicId }) {
  const Glyph = RELIC_GLYPHS[relic];
  return (
    <svg class="relic-icon" width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <Glyph />
    </svg>
  );
}

export function MapIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M3 5.2 L7.4 3.4 L12.6 5.4 L17 3.6 V14.8 L12.6 16.6 L7.4 14.6 L3 16.4 Z" />
      <path d="M7.4 3.4 V14.6 M12.6 5.4 V16.6" />
    </svg>
  );
}

export function ChevronRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path d="M5 3l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  );
}

export function BackIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path d="M11 4l-5 5 5 5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  );
}

export function GearIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true">
      <path d="M7.47 3.3 L7.66 1.42 A7.7 7.7 0 0 1 10.34 1.42 L10.53 3.3 A5.9 5.9 0 0 1 11.95 3.89 L13.42 2.69 A7.7 7.7 0 0 1 15.31 4.58 L14.11 6.05 A5.9 5.9 0 0 1 14.7 7.47 L16.58 7.66 A7.7 7.7 0 0 1 16.58 10.34 L14.7 10.53 A5.9 5.9 0 0 1 14.11 11.95 L15.31 13.42 A7.7 7.7 0 0 1 13.42 15.31 L11.95 14.11 A5.9 5.9 0 0 1 10.53 14.7 L10.34 16.58 A7.7 7.7 0 0 1 7.66 16.58 L7.47 14.7 A5.9 5.9 0 0 1 6.05 14.11 L4.58 15.31 A7.7 7.7 0 0 1 2.69 13.42 L3.89 11.95 A5.9 5.9 0 0 1 3.3 10.53 L1.42 10.34 A7.7 7.7 0 0 1 1.42 7.66 L3.3 7.47 A5.9 5.9 0 0 1 3.89 6.05 L2.69 4.58 A7.7 7.7 0 0 1 4.58 2.69 L6.05 3.89 A5.9 5.9 0 0 1 7.47 3.3 Z" />
      <circle cx="9" cy="9" r="2.4" />
    </svg>
  );
}

export function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path d="M3 7.4l2.6 2.6L11 4.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  );
}

export function CrownIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
      <path d="M1.6 4.2 L4.6 6.8 L7 2.4 L9.4 6.8 L12.4 4.2 L11.4 11 H2.6 Z" />
    </svg>
  );
}

export function CardsIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true">
      <rect x="6.2" y="2.6" width="9.4" height="13" rx="1.6" transform="rotate(8 10.9 9.1)" />
      <rect x="3.6" y="4.4" width="9.4" height="13" rx="1.6" fill="var(--surface-2)" />
    </svg>
  );
}

export function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path d="M7 2.5v9M2.5 7h9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
    </svg>
  );
}

export function MinusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path d="M2.5 7h9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
    </svg>
  );
}

export function TrashIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M3.5 5h11M7.2 5V3.4h3.6V5M5 5l.7 9.6h6.6L13 5M7.6 7.6v4.6M10.4 7.6v4.6" />
    </svg>
  );
}

export function PackIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true">
      <path d="M4.5 3.2h11l-1 2 1 2v9.6h-11V7.2l1-2z" />
      <path d="M4.5 7.2h11M7.6 11.2l2.4-1.8 2.4 1.8-2.4 3.2z" />
    </svg>
  );
}
