import type { ComponentChildren } from 'preact';
import { startText } from '../text/start';

export interface AudioToggles {
  music: boolean;
  sfx: boolean;
  onToggleMusic: () => void;
  onToggleSfx: () => void;
}

const SLASH = <path d="M2.5 2.5l13 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />;

export function MusicIcon({ off = false }: { off?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path d="M7 13.4V4.4l7.2-1.8v9.2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" />
      <circle cx="5.2" cy="13.5" r="1.9" fill="currentColor" />
      <circle cx="12.4" cy="11.8" r="1.9" fill="currentColor" />
      {off && SLASH}
    </svg>
  );
}

export function SoundIcon({ off = false }: { off?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        d="M2.8 7.1h2.6L8.8 4.3v9.4l-3.4-2.8H2.8z"
        fill="currentColor"
        stroke="currentColor"
        stroke-width="1.2"
        stroke-linejoin="round"
      />
      {off ? (
        <path d="M11.6 7l4 4M15.6 7l-4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
      ) : (
        <path
          d="M11.6 6.4a3.7 3.7 0 0 1 0 5.2M13.8 4.4a6.6 6.6 0 0 1 0 9.2"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
        />
      )}
    </svg>
  );
}

function SoundRow({
  testId,
  label,
  on,
  icon,
  onToggle,
}: {
  testId: string;
  label: string;
  on: boolean;
  icon: ComponentChildren;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      class="setting-row"
      aria-pressed={on}
      aria-label={label}
      data-testid={testId}
      onClick={onToggle}
    >
      <span class="mode-icon">{icon}</span>
      <span class="mode-text">
        <b>{label}</b>
      </span>
      <span class="switch" aria-hidden="true" />
    </button>
  );
}

export function SoundToggles({ audio }: { audio: AudioToggles }) {
  const text = startText();
  return (
    <section class="setting-rows" aria-labelledby="sound-label">
      <h2 id="sound-label" class="section-label">
        {text.sound}
      </h2>
      <SoundRow
        testId="btn-music"
        label={text.music}
        on={audio.music}
        icon={<MusicIcon off={!audio.music} />}
        onToggle={audio.onToggleMusic}
      />
      <SoundRow
        testId="btn-sfx"
        label={text.sfx}
        on={audio.sfx}
        icon={<SoundIcon off={!audio.sfx} />}
        onToggle={audio.onToggleSfx}
      />
    </section>
  );
}
