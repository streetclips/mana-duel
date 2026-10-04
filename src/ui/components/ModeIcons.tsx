import type { JSX } from 'preact';
import type { RelicId } from '../../app/expedition';

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
};

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
