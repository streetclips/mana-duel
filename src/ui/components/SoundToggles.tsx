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
      <path d="M2.8 7.1h2.6L8.8 4.3v9.4l-3.4-2.8H2.8z" fill="currentColor" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" />
      {off ? (
        <path d="M11.6 7l4 4M15.6 7l-4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
      ) : (
        <path d="M11.6 6.4a3.7 3.7 0 0 1 0 5.2M13.8 4.4a6.6 6.6 0 0 1 0 9.2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
      )}
    </svg>
  );
}

export function SoundToggles({ audio }: { audio: AudioToggles }) {
  return (
    <div class="sound-toggles" role="group" aria-label="Sonido">
      <button
        type="button"
        class="icon-btn sound-toggle"
        aria-pressed={audio.music}
        aria-label="Música"
        title={audio.music ? 'Música activada' : 'Música desactivada'}
        data-testid="btn-music"
        onClick={audio.onToggleMusic}
      >
        <MusicIcon off={!audio.music} />
      </button>
      <button
        type="button"
        class="icon-btn sound-toggle"
        aria-pressed={audio.sfx}
        aria-label="Efectos de sonido"
        title={audio.sfx ? 'Efectos de sonido activados' : 'Efectos de sonido desactivados'}
        data-testid="btn-sfx"
        onClick={audio.onToggleSfx}
      >
        <SoundIcon off={!audio.sfx} />
      </button>
    </div>
  );
}
